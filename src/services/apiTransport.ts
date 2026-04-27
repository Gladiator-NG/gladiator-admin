import supabase from './supabase';

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
  duration_hours: number | null; // one-way trip duration in hours
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  from_location?: Pick<Location, 'id' | 'name'> | null;
  to_location?: Pick<Location, 'id' | 'name'> | null;
}

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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (failed?.error) throw new Error(failed.error.message);
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Transport Routes ──────────────────────────────────────────────────────────

export async function getTransportRoutes(): Promise<TransportRoute[]> {
  const { data, error } = await supabase
    .from('transport_routes')
    .select(
      '*, from_location:locations!from_location_id(id, name), to_location:locations!to_location_id(id, name)',
    )
    .eq('is_active', true);
  if (error) throw new Error(error.message);
  return (data ?? []) as TransportRoute[];
}

export async function getAllTransportRoutes(): Promise<TransportRoute[]> {
  const { data, error } = await supabase
    .from('transport_routes')
    .select(
      '*, from_location:locations!from_location_id(id, name), to_location:locations!to_location_id(id, name)',
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as TransportRoute[];
}

export async function upsertTransportRoute(input: {
  from_location_id: string;
  to_location_id: string;
  route_price: number | null;
  duration_hours?: number | null;
  is_active?: boolean;
}): Promise<TransportRoute> {
  const { data, error } = await supabase
    .from('transport_routes')
    .upsert(
      { ...input, is_active: input.is_active ?? true },
      { onConflict: 'from_location_id,to_location_id' },
    )
    .select(
      '*, from_location:locations!from_location_id(id, name), to_location:locations!to_location_id(id, name)',
    )
    .single();
  if (error) throw new Error(error.message);
  return data as TransportRoute;
}

export async function deleteTransportRoute(id: string): Promise<void> {
  const { error } = await supabase
    .from('transport_routes')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Look up a single route price by location names. Returns null if no route configured. */
export function findRoutePrice(
  routes: TransportRoute[],
  fromName: string,
  toName: string,
): number | null {
  const route = routes.find(
    (r) => r.from_location?.name === fromName && r.to_location?.name === toName,
  );
  return route?.route_price ?? null;
}
