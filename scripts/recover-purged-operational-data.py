#!/usr/bin/env python3
"""Recover pre-purge operational rows from local caches and retained logs.

The script is a dry-run unless --apply or --apply-assets is passed. Core rows
come from exact cached responses. Asset rows restore only evidence-backed
fields; unrecoverable form-only fields are intentionally left null.
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zlib
from datetime import datetime, timezone
from pathlib import Path


CACHE_ROOT = Path(
    "/Users/davidadewale/Library/Caches/Arc/User Data/Default/Cache/Cache_Data"
)
CACHES = {
    "locations": CACHE_ROOT / "f2dec3135a5f03f5_0",
    "transport_routes": CACHE_ROOT / "1c3a34d259cc3d3d_0",
    "customers": CACHE_ROOT / "54cc4c3982c878ac_0",
    "bookings": CACHE_ROOT / "ffc7f3dc7f1b78b2_0",
    "notifications": CACHE_ROOT / "98f9fdc54b99f61d_0",
}
LATEST_BOOKINGS_CACHE = Path(
    "/Users/davidadewale/Library/Caches/Codex/Default/Partitions/"
    "codex-browser-app/Cache/Cache_Data/b19c26afad69b2ef_0"
)
EXPECTED_COUNTS = {
    "locations": 5,
    "transport_routes": 8,
    "customers": 1,
    "bookings": 2,
    "notifications": 50,
}
NESTED_FIELDS = {
    "transport_routes": {"from_location", "to_location"},
    "bookings": {
        "booking_range",
        "boat",
        "beach_house",
        "customer",
        "parent_booking",
        "rental_route",
    },
}
PROJECT_URL = "https://rmlhtwqwtrkyyyjjlpik.supabase.co"
BOAT_ID_REPLACEMENTS = {
    # The detailed booking cache points to the original Sunset Cruiser row.
    # Request history shows that row was deleted and recreated with this ID.
    "81e6e4f9-d9a7-4783-b825-49bd6d612b56":
        "4c6cb766-2869-4699-8e6e-8814fc671994",
}

BOATS = [
    {
        "id": "4c6cb766-2869-4699-8e6e-8814fc671994",
        "name": "Sunset Cruiser",
        "slug": "sunset-cruiser",
        "boat_type": "Catamaran",
        "is_active": True,
        "is_available_for_rental": True,
        "created_at": "2026-08-17T15:56:50.278+00:00",
        "images": [
            "d8b34e56-038f-406c-acfc-79c414b70d91.webp",
            "6f9f35f2-5ca8-44a1-8797-a329bc1ede6f.webp",
            "8c17f8e8-5b0b-443a-bcda-6b5603c0b6b2.webp",
            "b209fb24-c3fe-437c-9105-5b077945bee0.webp",
        ],
        "cover": "d8b34e56-038f-406c-acfc-79c414b70d91.webp",
    },
    {
        "id": "adf9e3e4-6fda-455a-88ba-88656aed7f3d",
        "name": "No Worries",
        "slug": "no-worries",
        "is_active": True,
        "is_available_for_rental": True,
        "created_at": "2026-08-17T16:12:13.342+00:00",
        "images": [
            "a6e16578-2226-4527-abd1-078e7b5a08f9.webp",
            "c0160230-bc58-40be-8c6c-840e0e314d40.webp",
            "ea7e034a-f1c9-49c4-8ea5-05ff6eff48f5.webp",
            "6a4199cd-b5fc-4cb9-a36b-4ceaeedcfff7.webp",
            "da262014-bb8b-4c06-baab-66963dbf74b5.webp",
        ],
        "cover": "a6e16578-2226-4527-abd1-078e7b5a08f9.webp",
    },
]

BEACH_HOUSES = [
    {
        "id": "2e863fd2-790e-4200-b812-1ff90e28aad6",
        "name": "22 Beach House",
        "slug": "22-beach-house",
        "is_active": True,
        "created_at": "2026-08-17T15:40:08.476+00:00",
        "images": [
            "7c14568e-dc43-49e1-a996-e6e9399a7384.webp",
            "fa697707-1f8d-4dff-8ba7-483c58f29a5e.webp",
            "43cbbbcf-034b-47b3-8eb1-a902e352362a.webp",
            "28a858b1-4410-45c4-8f3d-0373fe16656e.webp",
            "299fefbe-d3a9-460d-a9f3-9b58fd9e6a44.webp",
        ],
        "cover": "43cbbbcf-034b-47b3-8eb1-a902e352362a.webp",
    },
    {
        "id": "173acc7a-8140-4ec6-b9dd-d35cb163072b",
        "name": "Villa Eduardo",
        "slug": "villa-eduardo",
        "is_active": True,
        "created_at": "2026-08-17T15:47:21.025+00:00",
        "images": [
            "7b2b4608-1197-4d23-9a61-8094283382c5.webp",
            "f88ab98e-6ca0-4519-b56e-a0a9914a83d7.webp",
            "2693d3ac-76f4-4da0-bf2c-50d6fce44646.webp",
            "95318974-1145-443c-b71b-c0a7acd4d3b9.webp",
            "40218c92-8c7f-458e-a5d0-d40d882437de.webp",
            "501ad282-fcaa-4055-bf22-eeba202c71f4.webp",
            "cac42bbb-9934-40b2-bbe7-902e203ad978.webp",
            "c3850f16-ab5c-4877-8640-a6983d9124ff.webp",
            "2426dce1-f03b-43c3-a127-c536df046a1f.webp",
        ],
        "cover": "7b2b4608-1197-4d23-9a61-8094283382c5.webp",
    },
]


def load_env(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip().strip("'\"")
    return result


def extract_cached_array(path: Path) -> list[dict]:
    payload = path.read_bytes()
    arrays: list[list[dict]] = []
    for marker in re.finditer(b"\x1f\x8b\x08", payload):
        try:
            decoded = json.loads(zlib.decompress(payload[marker.start() :], 31))
        except (zlib.error, UnicodeDecodeError, json.JSONDecodeError):
            continue
        if isinstance(decoded, list) and all(isinstance(row, dict) for row in decoded):
            arrays.append(decoded)
    if not arrays:
        raise RuntimeError(f"No cached JSON response found in {path}")
    return max(arrays, key=len)


def prepare_rows() -> dict[str, list[dict]]:
    data = {table: extract_cached_array(path) for table, path in CACHES.items()}
    for table, expected in EXPECTED_COUNTS.items():
        actual = len(data[table])
        if actual != expected:
            raise RuntimeError(f"Expected {expected} {table} rows, found {actual}")

    # Three destinations were created after the latest full locations response.
    # Their exact IDs and names are embedded in the later route response. The
    # create-location form supplies no other required values, so use its schema
    # defaults (active, sort order 0, no description).
    known_location_ids = {row["id"] for row in data["locations"]}
    route_locations = {
        location["id"]: location
        for route in data["transport_routes"]
        for location in (route.get("from_location"), route.get("to_location"))
        if location is not None
    }
    for location_id, location in route_locations.items():
        if location_id not in known_location_ids:
            data["locations"].append(
                {
                    "id": location_id,
                    "name": location["name"],
                    "description": None,
                    "is_active": True,
                    "sort_order": 0,
                }
            )

    # The newer dashboard response has the final status/payment values, but its
    # resource fields were already null after the original Sunset Cruiser row
    # was deleted. Preserve the detailed booking's vessel relationship and map
    # the deleted vessel ID to the evidence-backed replacement row.
    cached_booking_boat_ids = {
        row["id"]: row.get("boat_id") or (row.get("boat") or {}).get("id")
        for row in data["bookings"]
    }
    latest_bookings = {
        row["id"]: row for row in extract_cached_array(LATEST_BOOKINGS_CACHE)
    }
    data["bookings"] = [
        {**row, **latest_bookings.get(row["id"], {})} for row in data["bookings"]
    ]
    for booking in data["bookings"]:
        cached_boat_id = cached_booking_boat_ids.get(booking["id"])
        replacement_boat_id = BOAT_ID_REPLACEMENTS.get(cached_boat_id)
        if replacement_boat_id is not None:
            booking["boat_id"] = replacement_boat_id

    for table, fields in NESTED_FIELDS.items():
        data[table] = [
            {key: value for key, value in row.items() if key not in fields}
            for row in data[table]
        ]
    return data


class RestClient:
    def __init__(self, base_url: str, service_key: str):
        self.base_url = base_url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    def request(
        self,
        method: str,
        path: str,
        *,
        body: object | None = None,
        prefer: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> tuple[int, bytes, dict]:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        if extra_headers:
            headers.update(extra_headers)
        request = urllib.request.Request(
            self.base_url + "/" + path,
            method=method,
            headers=headers,
            data=None if body is None else json.dumps(body).encode(),
        )
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.status, response.read(), dict(response.headers)
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")
            raise RuntimeError(f"{method} {path} failed ({error.code}): {detail}") from error

    def count(self, table: str) -> int:
        _, _, headers = self.request(
            "GET",
            f"{table}?select=id&limit=1",
            prefer="count=exact",
            extra_headers={"Range": "0-0"},
        )
        content_range = headers.get("Content-Range", "0-0/0")
        return int(content_range.rsplit("/", 1)[-1])

    def insert_missing(self, table: str, rows: list[dict]) -> None:
        query = urllib.parse.urlencode({"on_conflict": "id"})
        # PostgREST requires every object in one bulk request to have the same
        # keys. Group rows because reconstructed destination rows intentionally
        # let the database supply timestamps.
        groups: dict[tuple[str, ...], list[dict]] = {}
        for row in rows:
            groups.setdefault(tuple(sorted(row)), []).append(row)
        for group in groups.values():
            self.request(
                "POST",
                f"{table}?{query}",
                body=group,
                prefer="resolution=ignore-duplicates,return=minimal",
            )

    def delete_generated_notifications(self, entity_ids: list[str], since: str) -> None:
        ids = ",".join(entity_ids)
        query = urllib.parse.urlencode(
            {"entity_id": f"in.({ids})", "created_at": f"gte.{since}"}
        )
        self.request("DELETE", f"notifications?{query}", prefer="return=minimal")

    def update(self, table: str, row_id: str, fields: dict) -> None:
        query = urllib.parse.urlencode({"id": f"eq.{row_id}"})
        self.request(
            "PATCH", f"{table}?{query}", body=fields, prefer="return=minimal"
        )


def image_row_id(table: str, parent_id: str, filename: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"gladiator:{table}:{parent_id}:{filename}"))


def restore_assets(client: RestClient) -> None:
    boat_rows = [
        {key: value for key, value in boat.items() if key not in {"images", "cover"}}
        for boat in BOATS
    ]
    house_rows = [
        {key: value for key, value in house.items() if key not in {"images", "cover"}}
        for house in BEACH_HOUSES
    ]
    client.insert_missing("boats", boat_rows)
    client.insert_missing("beach_houses", house_rows)

    boat_images: list[dict] = []
    for boat in BOATS:
        for position, filename in enumerate(boat["images"]):
            boat_images.append(
                {
                    "id": image_row_id("boat_images", boat["id"], filename),
                    "boat_id": boat["id"],
                    "image_url": f"{PROJECT_URL}/storage/v1/object/public/boat-images/{filename}",
                    "position": position,
                }
            )
    house_images: list[dict] = []
    for house in BEACH_HOUSES:
        for position, filename in enumerate(house["images"]):
            house_images.append(
                {
                    "id": image_row_id("beach_house_images", house["id"], filename),
                    "beach_house_id": house["id"],
                    "image_url": f"{PROJECT_URL}/storage/v1/object/public/beach-house-images/{filename}",
                    "position": position,
                }
            )
    client.insert_missing("boat_images", boat_images)
    client.insert_missing("beach_house_images", house_images)

    for boat in BOATS:
        client.update(
            "boats",
            boat["id"],
            {"cover_image_id": image_row_id("boat_images", boat["id"], boat["cover"])},
        )
    for house in BEACH_HOUSES:
        client.update(
            "beach_houses",
            house["id"],
            {
                "cover_image_id": image_row_id(
                    "beach_house_images", house["id"], house["cover"]
                )
            },
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--apply-assets", action="store_true")
    parser.add_argument(
        "--env-file",
        type=Path,
        default=Path(__file__).parents[2] / "gladiator-website" / ".env",
    )
    args = parser.parse_args()

    data = prepare_rows()
    summary = {
        table: {"count": len(rows), "ids": [row["id"] for row in rows]}
        for table, rows in data.items()
    }
    apply_core = args.apply or args.apply_assets
    print(
        json.dumps(
            {
                "mode": "apply-assets" if args.apply_assets else ("apply" if args.apply else "dry-run"),
                "recovered": summary,
                "asset_plan": {
                    "boats": len(BOATS),
                    "boat_images": sum(len(row["images"]) for row in BOATS),
                    "beach_houses": len(BEACH_HOUSES),
                    "beach_house_images": sum(
                        len(row["images"]) for row in BEACH_HOUSES
                    ),
                },
            },
            indent=2,
        )
    )

    env = load_env(args.env_file)
    client = RestClient(
        env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
    )
    before = {table: client.count(table) for table in EXPECTED_COUNTS}
    print(json.dumps({"database_counts_before": before}, indent=2))
    if not apply_core:
        return

    restore_started = datetime.now(timezone.utc).isoformat()
    for table in ("locations", "transport_routes", "customers", "bookings"):
        client.insert_missing(table, data[table])

    restored_entity_ids = [
        row["id"] for table in ("customers", "bookings") for row in data[table]
    ]
    client.delete_generated_notifications(restored_entity_ids, restore_started)
    client.insert_missing("notifications", data["notifications"])

    if args.apply_assets:
        restore_assets(client)

    after = {table: client.count(table) for table in EXPECTED_COUNTS}
    asset_counts = {
        table: client.count(table)
        for table in ("boats", "boat_images", "beach_houses", "beach_house_images")
    }
    print(
        json.dumps(
            {"database_counts_after": after, "asset_counts_after": asset_counts},
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
