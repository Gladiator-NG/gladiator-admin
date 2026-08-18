import supabase from './supabase';
import { friendlyDbError } from '../utils/errors';

export interface Location {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TransportRoute {
  id: string;
  from_location_id: string;
  to_location_id: string;
  route_price: number | null;
  duration_hours: number | null; // hours the boat is blocked out for this route
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  from_location?: Pick<Location, 'id' | 'name'> | null;
  to_location?: Pick<Location, 'id' | 'name'> | null;
  boat_prices?: BoatTransferPrice[];
}

export interface BoatTransferPrice {
  id: string;
  boat_id: string;
  route_id: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ROUTE_SELECT =
  '*, from_location:locations!from_location_id(id, name), to_location:locations!to_location_id(id, name), boat_prices:boat_transfer_prices!route_id(*)';

// ── Locations ─────────────────────────────────────────────────────────────────

/** Returns all locations (active + inactive) for management UI */
export async function getAllLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Location[];
}

/** Returns only active locations — used in booking form dropdowns */
export async function getLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Location[];
}

export async function createLocation(input: {
  name: string;
  description?: string;
  sort_order?: number;
}): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .insert({ ...input, is_active: true })
    .select('*')
    .single();
  if (error)
    throw friendlyDbError(error, 'Could not create the jetty. Please try again.');
  return data as Location;
}

export async function updateLocation(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    is_active: boolean;
    sort_order: number;
  }>,
): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error)
    throw friendlyDbError(error, 'Could not update the jetty. Please try again.');
  return data as Location;
}

export async function reorderLocations(locationIds: string[]): Promise<void> {
  const updatedAt = new Date().toISOString();

  const results = await Promise.all(
    locationIds.map((id, index) =>
      supabase
        .from('locations')
        .update({ sort_order: index + 1, updated_at: updatedAt })
        .eq('id', id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error)
    throw friendlyDbError(
      failed.error,
      'Could not save the new jetty order. Please try again.',
    );
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error)
    throw friendlyDbError(error, 'Could not delete the jetty. Please try again.');
}

// ── Transport Routes ──────────────────────────────────────────────────────────

export async function getTransportRoutes(): Promise<TransportRoute[]> {
  const { data, error } = await supabase
    .from('transport_routes')
    .select(ROUTE_SELECT)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TransportRoute[];
}

export async function getAllTransportRoutes(): Promise<TransportRoute[]> {
  const { data, error } = await supabase
    .from('transport_routes')
    .select(ROUTE_SELECT)
    // created_at never changes on edit, unlike an unordered scan (which can
    // reorder rows after an UPDATE), so an edited route stays in place.
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TransportRoute[];
}

export async function upsertTransportRoute(input: {
  id?: string;
  from_location_id: string;
  to_location_id: string;
  duration_hours: number;
  is_active?: boolean;
}): Promise<TransportRoute> {
  const { id, ...rest } = input;
  const payload = { ...rest, is_active: input.is_active ?? true };

  // Editing an existing route must update that exact row by id — an upsert
  // keyed on (from_location_id, to_location_id) would insert a new row
  // instead whenever either endpoint changes, orphaning the original.
  if (id) {
    const { data, error } = await supabase
      .from('transport_routes')
      .update(payload)
      .eq('id', id)
      .select(ROUTE_SELECT)
      .single();
    if (error)
      throw friendlyDbError(error, 'Could not update the route. Please try again.');
    return data as TransportRoute;
  }

  const { data, error } = await supabase
    .from('transport_routes')
    .upsert(payload, { onConflict: 'from_location_id,to_location_id' })
    .select(ROUTE_SELECT)
    .single();
  if (error)
    throw friendlyDbError(error, 'Could not create the route. Please try again.');
  return data as TransportRoute;
}

export async function saveBoatTransferPrice(input: {
  route_id: string;
  boat_id: string;
  price: number | null;
}): Promise<void> {
  if (input.price == null) {
    const { error } = await supabase
      .from('boat_transfer_prices')
      .delete()
      .eq('route_id', input.route_id)
      .eq('boat_id', input.boat_id);
    if (error)
      throw friendlyDbError(
        error,
        'Could not clear the transfer price. Please try again.',
      );
    return;
  }

  const { error } = await supabase.from('boat_transfer_prices').upsert(
    {
      route_id: input.route_id,
      boat_id: input.boat_id,
      price: input.price,
      is_active: true,
    },
    { onConflict: 'boat_id,route_id' },
  );
  if (error)
    throw friendlyDbError(
      error,
      'Could not save the transfer price. Please try again.',
    );
}

export async function deleteTransportRoute(id: string): Promise<void> {
  const { error } = await supabase
    .from('transport_routes')
    .delete()
    .eq('id', id);
  if (error)
    throw friendlyDbError(error, 'Could not delete the route. Please try again.');
}

/** Returns the active full-transfer price for one boat/route combination. */
export function findBoatRoutePrice(
  routes: TransportRoute[],
  routeId: string,
  boatId: string,
): number | null {
  const route = routes.find((item) => item.id === routeId);
  const price = route?.boat_prices?.find(
    (item) => item.boat_id === boatId && item.is_active,
  );
  return price?.price ?? null;
}
