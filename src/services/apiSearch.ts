import supabase from './supabase';

export interface SearchResultBooking {
  kind: 'booking';
  id: string;
  reference_code: string;
  customer_name: string;
  booking_type: string;
  status: string;
}

export interface SearchResultBoat {
  kind: 'boat';
  id: string;
  name: string;
  boat_type: string | null;
  is_active: boolean;
}

export interface SearchResultBeachHouse {
  kind: 'beach_house';
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
}

export interface SearchResultUser {
  kind: 'user';
  id: string;
  full_name: string | null;
  role: string | null;
}

export type SearchResult =
  | SearchResultBooking
  | SearchResultBoat
  | SearchResultBeachHouse
  | SearchResultUser;

export interface SearchResults {
  bookings: SearchResultBooking[];
  boats: SearchResultBoat[];
  beachHouses: SearchResultBeachHouse[];
  users: SearchResultUser[];
}

export async function globalSearch(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return { bookings: [], boats: [], beachHouses: [], users: [] };

  const likeQ = `%${q}%`;
  const isRef = /^GLD-?\d*/i.test(q);

  const [bookingsRes, boatsRes, beachHousesRes, usersRes] = await Promise.all([
    // Bookings: search by reference_code OR customer_name
    supabase
      .from('bookings')
      .select('id, reference_code, customer_name, booking_type, status')
      .or(
        isRef
          ? `reference_code.ilike.${likeQ},customer_name.ilike.${likeQ}`
          : `customer_name.ilike.${likeQ},reference_code.ilike.${likeQ}`,
      )
      .limit(5),

    // Boats: search by name
    supabase
      .from('boats')
      .select('id, name, boat_type, is_active')
      .ilike('name', likeQ)
      .limit(4),

    // Beach houses: search by name
    supabase
      .from('beach_houses')
      .select('id, name, location, is_active')
      .ilike('name', likeQ)
      .limit(4),

    // Users/profiles: search by full_name
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .ilike('full_name', likeQ)
      .limit(4),
  ]);

  return {
    bookings: (bookingsRes.data ?? []).map((b) => ({ kind: 'booking', ...b })),
    boats: (boatsRes.data ?? []).map((b) => ({ kind: 'boat', ...b })),
    beachHouses: (beachHousesRes.data ?? []).map((b) => ({
      kind: 'beach_house',
      ...b,
    })),
    users: (usersRes.data ?? []).map((u) => ({ kind: 'user', ...u })),
  };
}
