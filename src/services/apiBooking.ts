import supabase from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BookingType = 'boat_cruise' | 'beach_house' | 'transport';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired';
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

  transport_type: TransportType | null;

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
  parent_booking?: { id: string; reference_code: string; booking_type: string; start_date: string; end_date: string } | null;
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
  transport_type?: TransportType | null;
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
  parent_booking:bookings!parent_beach_house_booking_id(id, reference_code, booking_type, start_date, end_date)
`;

export async function getBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Booking[];
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<Booking> {
  const { data, error } = await supabase
    .from('bookings')
    .insert(input)
    .select(BOOKING_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as Booking;
}

export async function updateBooking({
  id,
  ...input
}: UpdateBookingInput): Promise<Booking> {
  const { data, error } = await supabase
    .from('bookings')
    .update(input)
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

// ── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

/** Upsert by lower(email) — safe for web/mobile where customer may already exist. */
export async function upsertCustomer(input: {
  full_name: string;
  email: string;
  phone?: string;
  marketing_opt_in?: boolean;
}): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .upsert(
      { ...input, email: input.email.toLowerCase().trim() },
      { onConflict: 'email', ignoreDuplicates: false },
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Customer;
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

  const startTs = `${startDate}T${startTime ?? '00:00:00'}`;
  const endTs = `${endDate}T${endTime ?? '23:59:59'}`;

  let query = supabase
    .from('bookings')
    .select(
      'id, reference_code, customer_name, start_date, end_date, start_time, end_time, status',
    )
    .eq(resourceType === 'boat' ? 'boat_id' : 'beach_house_id', resourceId)
    .neq('status', 'cancelled')
    // Overlap: existing.start < requested.end AND existing.end > requested.start
    .lt('start_date', endDate)
    .gt('end_date', startDate)
    .limit(1);

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  // Tighter time-based overlap for same-day bookings (boats)
  if (startDate === endDate && startTime && endTime) {
    query = supabase
      .from('bookings')
      .select(
        'id, reference_code, customer_name, start_date, end_date, start_time, end_time, status',
      )
      .eq(resourceType === 'boat' ? 'boat_id' : 'beach_house_id', resourceId)
      .neq('status', 'cancelled')
      .eq('start_date', startDate)
      .lt('start_time', endTime)
      .gt('end_time', startTime)
      .limit(1);

    if (excludeBookingId) query = query.neq('id', excludeBookingId);
  }

  void startTs;
  void endTs; // used for documentation only; range logic is above

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  if (data && data.length > 0) {
    return {
      available: false,
      conflictingBooking: data[0] as unknown as Booking,
    };
  }
  return { available: true };
}
