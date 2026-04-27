import { Anchor, CreditCard, Home, Truck } from 'lucide-react';
import type {
  BookingStatus,
  BookingType,
  PaymentStatus,
} from '../../services/apiBooking';
import type { TransportRoute } from '../../services/apiTransport';
import styles from './BookingsHome.module.css';

export type SortKey =
  | 'all'
  | 'newest'
  | 'oldest'
  | 'amount_desc'
  | 'amount_asc';
export type StatusFilter = 'all' | BookingStatus;
export type TypeFilter = 'all' | BookingType;
export type DatePreset =
  | 'all'
  | 'month'
  | 'quarter'
  | 'half'
  | 'year'
  | 'custom';
export type Tab = 'bookings' | 'customers';

export type CustomerSortKey =
  | 'name_asc'
  | 'name_desc'
  | 'bookings_desc'
  | 'bookings_asc'
  | 'spent_desc'
  | 'spent_asc'
  | 'recent';
export type CustomerView = 'card' | 'table';
export type BeachHouseBookingMode = 'day_use' | 'overnight';

export const CUSTOMER_PAGE_SIZE = 12;
export const PAGE_SIZE = 15;

export interface BookingFields {
  booking_type: BookingType;
  boat_id: string;
  beach_house_id: string;
  beach_house_booking_mode: BeachHouseBookingMode;
  parent_beach_house_booking_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  guest_count: number;
  hours?: number;
  late_checkout_hours?: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  rental_type: string;
  pickup_location: string;
  dropoff_location: string;
  rental_route_id: string;
  total_amount: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_reference: string;
  source: string;
  notes: string;
  return_pickup_time?: string;
}

export interface BookingBoatOption {
  id: string;
  name: string;
  price_per_hour?: number | null;
  pickup_location?: string | null;
  max_guests?: number | null;
  min_booking_hours?: number | null;
  max_booking_hours?: number | null;
  is_available_for_rental?: boolean;
}

export interface BookingBeachHouseOption {
  id: string;
  name: string;
  price_per_night?: number | null;
  day_use_price_per_hour?: number | null;
  day_use_min_hours?: number | null;
  day_use_max_hours?: number | null;
  location?: string | null;
  rental_price?: number | null;
  max_guests?: number | null;
  extra_guest_fee_per_head?: number | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  late_checkout_price_per_hour?: number | null;
}

export function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime12(t: string | null | undefined) {
  if (!t) return null;
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function computeEndTime(startTime: string, hours: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const totalMinutes = h * 60 + m + Math.round(hours * 60);
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export function clampHours(
  hours: number,
  minHours = 1,
  maxHours = Number.POSITIVE_INFINITY,
): number {
  return Math.min(Math.max(hours, minHours), maxHours);
}

export function subtractTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  let totalMins = h * 60 + m - Math.round(hours * 60);
  if (totalMins < 0) totalMins += 24 * 60;
  const rH = Math.floor(totalMins / 60);
  const rM = totalMins % 60;
  return `${String(rH).padStart(2, '0')}:${String(rM).padStart(2, '0')}`;
}

const BOAT_BUFFER_HOURS = 1;

export function boatAvailabilityEndTime(
  startTime: string,
  cruiseHours: number,
): string {
  return computeEndTime(startTime, cruiseHours + BOAT_BUFFER_HOURS);
}

export function latestBoatStartTime(
  curfewTime: string,
  cruiseHours: number,
): string {
  const [h, m] = curfewTime.split(':').map(Number);
  const totalMinutes =
    h * 60 + m - Math.round((cruiseHours + BOAT_BUFFER_HOURS) * 60);
  if (totalMinutes <= 0) return '00:00';
  const rH = Math.floor(totalMinutes / 60);
  const rM = totalMinutes % 60;
  return `${String(rH).padStart(2, '0')}:${String(rM).padStart(2, '0')}`;
}

export function findRouteDuration(
  routes: TransportRoute[],
  routeId: string,
): number | null {
  return routes.find((r) => r.id === routeId)?.duration_hours ?? null;
}

export function transportEndTime(
  startTime: string,
  durationHours: number,
  transportType: string,
): string {
  const legs = transportType === 'round_trip' ? 2 : 1;
  return computeEndTime(startTime, durationHours * legs + BOAT_BUFFER_HOURS);
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function derivePaymentStatus(status: BookingStatus): PaymentStatus {
  return status === 'pending' ? 'pending' : 'paid';
}

export function parseBookingError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('no_overlapping_boat_bookings') ||
    msg.includes('no_overlapping_beach_house_bookings')
  ) {
    return 'This time slot is already booked. Please choose a different date or time.';
  }
  if (msg.includes('23505') || msg.includes('duplicate key')) {
    return 'A booking with this reference already exists.';
  }
  if (msg.includes('range lower bound must be less than or equal to range upper bound')) {
    return 'The rental return time must be later than the pickup time for this booking range.';
  }
  return msg;
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const map: Record<BookingStatus, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: styles.badgePending },
    confirmed: { label: 'Confirmed', cls: styles.badgeConfirmed },
    cancelled: { label: 'Cancelled', cls: styles.badgeCancelled },
    expired: { label: 'Expired', cls: styles.badgeExpired },
    completed: { label: 'Completed', cls: styles.badgeCompleted },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; cls: string }> = {
    pending: { label: 'Awaiting payment', cls: styles.payBadgePending },
    paid: { label: 'Paid', cls: styles.payBadgePaid },
    failed: { label: 'Failed', cls: styles.payBadgeFailed },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={`${styles.payBadge} ${cls}`}>{label}</span>;
}

export function TypeIcon({ type }: { type: BookingType }) {
  if (type === 'boat_cruise')
    return <Anchor size={14} className={styles.typeIcon} />;
  if (type === 'beach_house')
    return <Home size={14} className={styles.typeIcon} />;
  return <Truck size={14} className={styles.typeIcon} />;
}

export function getPaymentReferenceIcon() {
  return <CreditCard size={12} />;
}
