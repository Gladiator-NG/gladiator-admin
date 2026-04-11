import supabase from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BookingType = 'boat_cruise' | 'beach_house' | 'transport';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  | 'completed';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type TransportType = 'outbound' | 'return' | 'round_trip';
export type BookingSource = 'admin' | 'web' | 'mobile';

export interface Booking {
  id: string;
  booking_type: BookingType;
  reference_code: string;

  boat_id: string | null;
  beach_house_id: string | null;
  parent_beach_house_booking_id: string | null;

  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;

  guest_count: number;

  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number | null;

  transport_type: TransportType | null;
  transport_route_id: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;

  total_amount: number;
  currency: string;

  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  source: BookingSource;

  notes: string | null;

  created_at: string;
  updated_at: string;

  // Joined
  boat?: { id: string; name: string; boat_type: string | null } | null;
  beach_house?: { id: string; name: string } | null;
  customer?: Customer | null;
  parent_booking?: {
    id: string;
    reference_code: string;
    booking_type: string;
    start_date: string;
    end_date: string;
  } | null;
  transport_route?: {
    id: string;
    duration_hours: number | null;
    from_location: { id: string; name: string } | null;
    to_location: { id: string; name: string } | null;
  } | null;
}

export interface Customer {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  marketing_opt_in: boolean;
  total_bookings: number;
  total_spent: number;
  last_booking_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingInput {
  booking_type: BookingType;
  boat_id?: string | null;
  beach_house_id?: string | null;
  parent_beach_house_booking_id?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  guest_count?: number;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  hours?: number | null;
  transport_type?: TransportType | null;
  transport_route_id?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  total_amount: number;
  status?: BookingStatus;
  payment_status?: PaymentStatus;
  payment_reference?: string | null;
  source?: BookingSource;
  notes?: string | null;
}

export type UpdateBookingInput = Partial<CreateBookingInput> & { id: string };

// ── Bookings ──────────────────────────────────────────────────────────────────

const BOOKING_SELECT = `
  *,
  boat:boats(id, name, boat_type),
  beach_house:beach_houses(id, name),
  customer:customers(*),
  parent_booking:bookings!parent_beach_house_booking_id(id, reference_code, booking_type, start_date, end_date),
  transport_route:transport_routes!transport_route_id(id, duration_hours, from_location:locations!from_location_id(id, name), to_location:locations!to_location_id(id, name))
`;

export async function getBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Booking[];
}

// ── Customer helper ──────────────────────────────────────────────────────────
// Finds a customer by email (case-insensitive) and updates their name/phone,
// or creates a new record if none exists.
// Avoids ON CONFLICT so it works regardless of whether the unique index has
// been promoted to a named constraint.
async function findOrCreateCustomer(input: {
  full_name: string;
  email: string;
  phone?: string;
  marketing_opt_in?: boolean;
}): Promise<Customer> {
  const normalised = input.email.toLowerCase().trim();

  // Try to find existing customer first
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('email', normalised)
    .maybeSingle();

  if (existing) {
    // Update name/phone in case they've changed, then return
    const { data: updated, error } = await supabase
      .from('customers')
      .update({
        full_name: input.full_name,
        phone: input.phone ?? existing.phone,
        ...(input.marketing_opt_in !== undefined && {
          marketing_opt_in: input.marketing_opt_in,
        }),
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return updated as Customer;
  }

  // No match — insert a new customer
  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      full_name: input.full_name,
      email: normalised,
      phone: input.phone ?? '',
      marketing_opt_in: input.marketing_opt_in ?? false,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return created as Customer;
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<Booking> {
  // 1. Find or create the customer so every booking is linked to a customer record.
  const customer = await findOrCreateCustomer({
    full_name: input.customer_name,
    email: input.customer_email,
    phone: input.customer_phone,
  });

  // 2. Insert the booking with the resolved customer_id.
  //    The DB trigger `bookings_sync_customer_stats` will update
  //    total_bookings / total_spent / last_booking_at automatically.
  const { data, error } = await supabase
    .from('bookings')
    .insert({ ...input, customer_id: customer.id })
    .select(BOOKING_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as Booking;
}

export async function updateBooking({
  id,
  ...input
}: UpdateBookingInput): Promise<Booking> {
  // If customer email is supplied (edit form always sends it), upsert the
  // customer so old unlinked bookings get a customer_id on first edit, and
  // the DB trigger can then update their stats immediately.
  let customerId: string | undefined;
  if (input.customer_email) {
    const customer = await findOrCreateCustomer({
      full_name: input.customer_name ?? '',
      email: input.customer_email,
      phone: input.customer_phone,
    }).catch(() => undefined);
    if (customer) customerId = customer.id;
  }

  const payload = customerId ? { ...input, customer_id: customerId } : input;

  const { data, error } = await supabase
    .from('bookings')
    .update(payload)
    .eq('id', id)
    .select(BOOKING_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as Booking;
}

export async function deleteBooking(id: string): Promise<void> {
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Marks all non-cancelled, non-expired bookings whose end_date is in the past
 * as 'completed'. Called on app mount and by pg_cron in the database.
 */
export async function autoCompleteBookings(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'completed' as BookingStatus })
    .in('status', ['pending', 'confirmed'] as BookingStatus[])
    .lt('end_date', today);
  if (error) throw new Error(error.message);
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

/** Find or create a customer by email — exposed for use by web/mobile booking flows. */
export async function upsertCustomer(input: {
  full_name: string;
  email: string;
  phone?: string;
  marketing_opt_in?: boolean;
}): Promise<Customer> {
  return findOrCreateCustomer(input);
}

export async function updateCustomer(
  id: string,
  input: Partial<
    Pick<Customer, 'full_name' | 'email' | 'phone' | 'marketing_opt_in'>
  >,
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Availability check ────────────────────────────────────────────────────────

export async function checkAvailability(params: {
  resourceType: 'boat' | 'beach_house';
  resourceId: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  excludeBookingId?: string;
}): Promise<{ available: boolean; conflictingBooking?: Booking }> {
  const {
    resourceType,
    resourceId,
    startDate,
    endDate,
    startTime,
    endTime,
    excludeBookingId,
  } = params;

  // Only pending/confirmed block a slot — completed, expired, cancelled do not.
  const activeStatuses: BookingStatus[] = ['pending', 'confirmed'];

  const idCol = resourceType === 'boat' ? 'boat_id' : 'beach_house_id';
  const selectCols =
    'id, reference_code, customer_name, start_date, end_date, start_time, end_time, status';

  // ── Time-range overlap for same-day boat bookings ────────────────────────
  // We have both a startTime and endTime (endTime already includes the 1hr
  // post-cruise buffer added by the caller). Use strict time-range overlap:
  //   existing.start_time < requested.endTime
  //   AND existing.end_time > requested.startTime
  if (startDate === endDate && startTime && endTime) {
    let q = supabase
      .from('bookings')
      .select(selectCols)
      .eq(idCol, resourceId)
      .in('status', activeStatuses)
      .eq('start_date', startDate)
      // existing booking starts before this one ends
      .lt('start_time', endTime)
      // existing booking ends after this one starts, OR has no end_time recorded
      // (NULL end_time means the slot is still occupied — treat as blocking)
      .or(`end_time.gt.${startTime},end_time.is.null`)
      .limit(1);

    if (excludeBookingId) q = q.neq('id', excludeBookingId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (data && data.length > 0)
      return {
        available: false,
        conflictingBooking: data[0] as unknown as Booking,
      };
    return { available: true };
  }

  // ── Date-range overlap for multi-day / beach-house bookings ─────────────
  // Overlap: existing.start_date < requested.end_date
  //      AND existing.end_date   > requested.start_date
  let q = supabase
    .from('bookings')
    .select(selectCols)
    .eq(idCol, resourceId)
    .in('status', activeStatuses)
    .lt('start_date', endDate)
    .gt('end_date', startDate)
    .limit(1);

  if (excludeBookingId) q = q.neq('id', excludeBookingId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  if (data && data.length > 0)
    return {
      available: false,
      conflictingBooking: data[0] as unknown as Booking,
    };
  return { available: true };
}

// ── Revenue by booking type ───────────────────────────────────────────────────
// Returns confirmed/completed/pending revenue totals grouped by booking_type
// for bookings whose start_date falls within [from, to] (YYYY-MM-DD strings).
export interface RevenueByType {
  boat_cruise: number;
  beach_house: number;
  transport: number;
}

export async function fetchRevenueByType(
  from: string,
  to: string,
): Promise<RevenueByType> {
  const { data, error } = await supabase
    .from('bookings')
    .select('booking_type, total_amount')
    .eq('payment_status', 'paid')
    .gte('start_date', from)
    .lte('start_date', to);

  if (error) throw new Error(error.message);

  const result: RevenueByType = {
    boat_cruise: 0,
    beach_house: 0,
    transport: 0,
  };
  for (const row of data ?? []) {
    const t = row.booking_type as keyof RevenueByType;
    if (t in result) result[t] += row.total_amount ?? 0;
  }
  return result;
}
