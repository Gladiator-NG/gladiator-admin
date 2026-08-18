interface DbError {
  code?: string;
  message: string;
}

/** Maps a unique-constraint name to a plain-language explanation. */
const DUPLICATE_MESSAGES: Record<string, string> = {
  locations_name_key: 'A location with that name already exists.',
  transport_routes_from_location_id_to_location_id_key:
    'A route between those two locations already exists.',
  boat_transfer_prices_boat_id_route_id_key:
    'A price for that boat on this route already exists.',
};

/**
 * Converts a Supabase/Postgres error into a message safe to show a
 * non-technical user. Database `raise exception` messages (code P0001) are
 * already written for end users, so they pass through unchanged; raw
 * constraint violations are translated or replaced with `fallback`.
 */
export function friendlyDbError(error: DbError, fallback: string): Error {
  if (error.code === 'P0001') {
    return new Error(error.message);
  }

  if (error.code === '23505') {
    const constraint = Object.keys(DUPLICATE_MESSAGES).find((key) =>
      error.message.includes(key),
    );
    return new Error(
      constraint
        ? DUPLICATE_MESSAGES[constraint]
        : 'That already exists. Please use different values.',
    );
  }

  if (error.code === '23503') {
    return new Error(
      'This is still linked to other records and cannot be changed.',
    );
  }

  if (error.code === '23514') {
    return new Error('One of the values entered is not valid.');
  }

  return new Error(fallback);
}
