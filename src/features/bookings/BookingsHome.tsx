import { useState, useMemo, useEffect } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  BookOpen,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  ArrowUpDown,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Anchor,
  Home,
  Truck,
  CreditCard,
  LayoutGrid,
  Table2,
  Download,
  Flag,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  Booking,
  BookingType,
  BookingStatus,
  PaymentStatus,
  Customer,
} from '../../services/apiBooking';
import { updateCustomer, deleteCustomer } from '../../services/apiBooking';
import { insertActivityLog } from '../../services/apiNotifications';
import supabase from '../../services/supabase';
import { MetricCard } from '../../ui/MetricCard';
import { backdropAnim, modalAnim } from '../../ui/modalAnimations';
import { formatPrice } from '../../utils/format';
import FormInput from '../../ui/formElements/FormInput';
import Button from '../../ui/Button';
import { useBookings } from './useBookings';
import { useCreateBooking } from './useCreateBooking';
import { useUpdateBooking } from './useUpdateBooking';
import { useDeleteBooking } from './useDeleteBooking';
import { useUpdateBookingStatus } from './useUpdateBookingStatus';
import { useAvailabilityCheck } from './useAvailabilityCheck';
import type {
  AvailabilityParams,
  AvailabilityState,
} from './useAvailabilityCheck';
import { useBoats } from '../boats/useBoats';
import { useBeachHouses } from '../beach-houses/useBeachHouses';
import { useCustomers } from './useCustomers';
import { useLocations } from './useLocations';
import { useTransportRoutes } from './useTransportRoutes';
import { useSettings } from '../settings/useSettings';
import { findRoutePrice } from '../../services/apiTransport';
import type { TransportRoute } from '../../services/apiTransport';
import styles from './BookingsHome.module.css';

// ── Types ────────────────────────────────────────────────────────────────────
type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';
type StatusFilter = 'all' | BookingStatus;
type TypeFilter = 'all' | BookingType;
type DatePreset = 'month' | 'quarter' | 'half' | 'year' | 'custom';
type Tab = 'bookings' | 'customers';

type CustomerSortKey =
  | 'name_asc'
  | 'name_desc'
  | 'bookings_desc'
  | 'bookings_asc'
  | 'spent_desc'
  | 'spent_asc'
  | 'recent';
type CustomerView = 'card' | 'table';
const CUSTOMER_PAGE_SIZE = 12;

const PAGE_SIZE = 15;

interface BookingFields {
  booking_type: BookingType;
  boat_id: string;
  beach_house_id: string;
  parent_beach_house_booking_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  guest_count: number;
  hours?: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  transport_type: string;
  pickup_location: string;
  dropoff_location: string;
  transport_route_id: string;
  total_amount: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_reference: string;
  source: string;
  notes: string;
  // Virtual — linked round-trip transport only, not persisted directly
  return_pickup_time?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Converts "HH:MM" or "HH:MM:SS" to "10:00 AM" / "2:30 PM".
function formatTime12(t: string | null | undefined) {
  if (!t) return null;
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Minimum billable passengers for a transport booking
const TRANSPORT_MIN_PASSENGERS = 4;

// Given a HH:MM start time and a number of hours, returns the HH:MM end time.
function computeEndTime(startTime: string, hours: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const totalMinutes = h * 60 + m + Math.round(hours * 60);
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// Subtracts hours from a HH:MM time, wrapping past midnight.
function subtractTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  let totalMins = h * 60 + m - Math.round(hours * 60);
  if (totalMins < 0) totalMins += 24 * 60;
  const rH = Math.floor(totalMins / 60);
  const rM = totalMins % 60;
  return `${String(rH).padStart(2, '0')}:${String(rM).padStart(2, '0')}`;
}

// Returns the availability end time for a boat cruise: end of cruise + 1hr buffer.
// The buffer accounts for docking, passenger disembarkation, refuelling, etc.
const BOAT_BUFFER_HOURS = 1;
function boatAvailabilityEndTime(
  startTime: string,
  cruiseHours: number,
): string {
  return computeEndTime(startTime, cruiseHours + BOAT_BUFFER_HOURS);
}

// Returns the latest allowed start time given a curfew and cruise duration.
// latest start = curfew - (cruiseHours + buffer)
function latestBoatStartTime(curfewTime: string, cruiseHours: number): string {
  const [h, m] = curfewTime.split(':').map(Number);
  const totalMinutes =
    h * 60 + m - Math.round((cruiseHours + BOAT_BUFFER_HOURS) * 60);
  if (totalMinutes <= 0) return '00:00';
  const rH = Math.floor(totalMinutes / 60);
  const rM = totalMinutes % 60;
  return `${String(rH).padStart(2, '0')}:${String(rM).padStart(2, '0')}`;
}

// Returns the one-way duration for a route in hours, or null if not configured.
function findRouteDuration(
  routes: TransportRoute[],
  routeId: string,
): number | null {
  return routes.find((r) => r.id === routeId)?.duration_hours ?? null;
}

// Returns the end time for a transport booking: start + (duration * legs) + 1hr buffer.
// legs = 1 for outbound/return, 2 for round_trip.
function transportEndTime(
  startTime: string,
  durationHours: number,
  transportType: string,
): string {
  const legs = transportType === 'round_trip' ? 2 : 1;
  return computeEndTime(startTime, durationHours * legs + BOAT_BUFFER_HOURS);
}

function derivePaymentStatus(status: BookingStatus): PaymentStatus {
  return status === 'pending' ? 'pending' : 'paid';
}

function parseBookingError(err: unknown): string {
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
  return msg;
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BookingStatus }) {
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

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; cls: string }> = {
    pending: { label: 'Awaiting payment', cls: styles.payBadgePending },
    paid: { label: 'Paid', cls: styles.payBadgePaid },
    failed: { label: 'Failed', cls: styles.payBadgeFailed },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={`${styles.payBadge} ${cls}`}>{label}</span>;
}

function TypeIcon({ type }: { type: BookingType }) {
  if (type === 'boat_cruise')
    return <Anchor size={14} className={styles.typeIcon} />;
  if (type === 'beach_house')
    return <Home size={14} className={styles.typeIcon} />;
  return <Truck size={14} className={styles.typeIcon} />;
}

// ── Booking form fields ───────────────────────────────────────────────────────
function BookingFormFields({
  formActions,
  disabled,
  boats,
  beachHouses,
  watchType,
  watchTransportType,
  watchStatus,
  watchBoatId,
  watchParentBookingId,
  watchBeachHouseId,
  bookings,
  computedTotal,
  availabilityState,
  watchPickupLocation: _watchPickupLocation,
  transportRoutes,
  watchTransportRouteId,
  watchHours,
  watchReturnPickupTime,
}: {
  formActions: {
    register: ReturnType<typeof useForm<BookingFields>>['register'];
    errors: ReturnType<typeof useForm<BookingFields>>['formState']['errors'];
  };
  disabled?: boolean;
  boats: {
    id: string;
    name: string;
    price_per_hour?: number | null;
    pickup_location?: string | null;
    max_guests?: number | null;
    min_booking_hours?: number | null;
    max_booking_hours?: number | null;
    is_available_for_transport?: boolean;
  }[];
  beachHouses: {
    id: string;
    name: string;
    price_per_night?: number | null;
    location?: string | null;
    transport_price?: number | null;
    max_guests?: number | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
  }[];
  watchType: BookingType;
  watchTransportType: string;
  watchStatus: BookingStatus;
  watchBoatId: string;
  watchParentBookingId: string;
  watchBeachHouseId: string;
  watchPickupLocation: string;
  transportRoutes: TransportRoute[];
  watchTransportRouteId: string;
  bookings: import('../../services/apiBooking').Booking[];
  computedTotal: number | null;
  availabilityState: AvailabilityState;
  watchHours: number;
  watchReturnPickupTime: string;
}) {
  const { settings } = useSettings();
  const curfewTime = settings?.boat_curfew_time ?? null;
  const houseBookings = bookings.filter(
    (b) => b.booking_type === 'beach_house',
  );
  // Boarding location comes from the selected boat's jetty record (reserved for future use)
  const selectedBoat = boats.find((b) => b.id === watchBoatId);
  const boatMinHours = selectedBoat?.min_booking_hours ?? null;
  const boatMaxHours = selectedBoat?.max_booking_hours ?? null;
  // Latest allowed start time: curfew minus cruise duration + buffer
  const maxStartTime =
    watchType === 'boat_cruise' && curfewTime && watchHours > 0
      ? latestBoatStartTime(curfewTime, watchHours)
      : undefined;
  // One-way duration for the selected transport route
  const routeDuration =
    transportRoutes.find((r) => r.id === watchTransportRouteId)
      ?.duration_hours ?? null;
  // Linked beach house stay — drives the transport date display
  const linkedStay =
    houseBookings.find((b) => b.id === watchParentBookingId) ?? null;
  // If linked, resolve the beach house record for its transport location + price
  const linkedHouse = linkedStay
    ? (beachHouses.find((h) => h.id === linkedStay.beach_house_id) ?? null)
    : null;
  // Payment reference is required to confirm a booking — it's the paper trail
  const paymentRefRequired = watchStatus === 'confirmed';
  const selectedBeachHouse =
    watchType === 'beach_house'
      ? (beachHouses.find((h) => h.id === watchBeachHouseId) ?? null)
      : null;
  const maxGuests =
    watchType === 'boat_cruise' || watchType === 'transport'
      ? (selectedBoat?.max_guests ?? null)
      : watchType === 'beach_house'
        ? (selectedBeachHouse?.max_guests ?? null)
        : null;

  return (
    <>
      <FormInput
        id="booking_type"
        type="select"
        label="Booking Type"
        formActions={formActions}
        disabled={disabled}
      >
        <option value="boat_cruise">Boat Cruise</option>
        <option value="beach_house">Beach House</option>
        <option value="transport">Transport (boat as shuttle)</option>
      </FormInput>

      {/* ── Boat Cruise ────────────────────────────────────── */}
      {watchType === 'boat_cruise' && (
        <>
          <FormInput
            id="boat_id"
            type="select"
            label="Boat"
            formActions={formActions}
            disabled={disabled}
          >
            <option value="">Select a boat…</option>
            {boats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.max_guests ? ` (max ${b.max_guests})` : ''}
                {b.price_per_hour
                  ? ` — ₦${b.price_per_hour.toLocaleString()}/hr`
                  : ''}
              </option>
            ))}
          </FormInput>
          {maxGuests !== null && (
            <p className={styles.capacityHint}>
              Max capacity: <strong>{maxGuests}</strong> guests (including
              yourself)
            </p>
          )}
          <FormInput
            id="hours"
            type="number"
            label="Number of Hours"
            formActions={formActions}
            disabled={disabled}
            placeholder="e.g. 3"
            min={boatMinHours ?? 1}
            max={boatMaxHours ?? undefined}
            validation={{
              min: boatMinHours
                ? {
                    value: boatMinHours,
                    message: `Minimum ${boatMinHours} hour${boatMinHours !== 1 ? 's' : ''} for this boat`,
                  }
                : { value: 1, message: 'Must be at least 1 hour' },
              ...(boatMaxHours
                ? {
                    max: {
                      value: boatMaxHours,
                      message: `Maximum ${boatMaxHours} hours for this boat`,
                    },
                  }
                : {}),
            }}
          />
          {(boatMinHours !== null || boatMaxHours !== null) && (
            <p className={styles.capacityHint}>
              Allowed duration:{' '}
              {boatMinHours !== null && boatMaxHours !== null ? (
                <>
                  <strong>
                    {boatMinHours}–{boatMaxHours}
                  </strong>{' '}
                  hrs
                </>
              ) : boatMinHours !== null ? (
                <>
                  min <strong>{boatMinHours}</strong> hr
                  {boatMinHours !== 1 ? 's' : ''}
                </>
              ) : (
                <>
                  max <strong>{boatMaxHours}</strong> hrs
                </>
              )}
            </p>
          )}
        </>
      )}

      {/* ── Beach House ────────────────────────────────────── */}
      {watchType === 'beach_house' && (
        <>
          <FormInput
            id="beach_house_id"
            type="select"
            label="Beach House"
            formActions={formActions}
            disabled={disabled}
          >
            <option value="">Select a beach house…</option>
            {beachHouses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
                {h.max_guests ? ` (max ${h.max_guests})` : ''}
                {h.price_per_night
                  ? ` — ₦${h.price_per_night.toLocaleString()}/night`
                  : ''}
              </option>
            ))}
          </FormInput>
          {maxGuests !== null && (
            <p className={styles.capacityHint}>
              Max capacity: <strong>{maxGuests}</strong> guests (including
              yourself)
            </p>
          )}
        </>
      )}

      {/* ── Transport ──────────────────────────────────────── */}
      {watchType === 'transport' && (
        <>
          {/* Route selector: single dropdown; for linked stays filter to routes ending at the beach house */}
          <FormInput
            id="transport_route_id"
            type="select"
            label="Route"
            formActions={formActions}
            disabled={disabled}
          >
            <option value="">Select a route…</option>
            {(linkedHouse
              ? transportRoutes.filter(
                  (r) => r.to_location?.name === linkedHouse.location,
                )
              : transportRoutes
            ).map((r) => (
              <option key={r.id} value={r.id}>
                {r.from_location?.name ?? '?'} → {r.to_location?.name ?? '?'}
                {r.price_per_trip != null
                  ? ` · ₦${r.price_per_trip.toLocaleString()}/person`
                  : ''}
              </option>
            ))}
          </FormInput>

          {/* Hidden fields — auto-set by parent useEffect when route changes */}
          <input type="hidden" {...formActions.register('pickup_location')} />
          <input type="hidden" {...formActions.register('dropoff_location')} />

          <p className={styles.transportPricingHint}>
            Pricing is <strong>per person</strong> · minimum{' '}
            <strong>{TRANSPORT_MIN_PASSENGERS} passengers</strong> applies per
            trip
          </p>

          {/* Boat selector — only shown once a route is picked */}
          {watchTransportRouteId
            ? (() => {
                const selectedRoute = transportRoutes.find(
                  (r) => r.id === watchTransportRouteId,
                );
                const availableBoats = boats.filter(
                  (b) =>
                    b.is_available_for_transport &&
                    b.pickup_location === selectedRoute?.from_location?.name,
                );
                if (availableBoats.length === 0) {
                  return (
                    <p className={styles.noBoatsMsg}>
                      No transport boats depart from{' '}
                      <strong>
                        {selectedRoute?.from_location?.name ?? 'this location'}
                      </strong>
                      . Update a boat’s jetty in the Boats page to enable it.
                    </p>
                  );
                }
                return (
                  <>
                    <FormInput
                      id="boat_id"
                      type="select"
                      label="Transport Boat"
                      formActions={formActions}
                      disabled={disabled}
                    >
                      <option value="">Select a boat…</option>
                      {availableBoats.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                          {b.max_guests
                            ? ` (${b.max_guests} passengers max)`
                            : ''}
                        </option>
                      ))}
                    </FormInput>
                    {maxGuests !== null && (
                      <p className={styles.capacityHint}>
                        Transport capacity: <strong>{maxGuests}</strong>{' '}
                        passengers
                      </p>
                    )}
                  </>
                );
              })()
            : null}

          <FormInput
            id="transport_type"
            type="select"
            label="Trip Type"
            formActions={formActions}
            disabled={disabled}
            required={false}
          >
            <option value="">Not specified</option>
            <option value="outbound">One Way</option>
            <option value="round_trip">Round Trip</option>
          </FormInput>

          <div className={styles.linkedStaySection}>
            <p className={styles.linkedStayHeading}>
              Is this transport for a beach house stay? (optional)
            </p>
            <p className={styles.linkedStayHint}>
              Link this transport to an existing beach house booking to keep
              everything connected. The booking reference will appear in both
              records.
            </p>
            <FormInput
              id="parent_beach_house_booking_id"
              type="select"
              label="Beach House Booking"
              formActions={formActions}
              disabled={disabled}
              required={false}
            >
              <option value="">No — standalone transport</option>
              {houseBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.reference_code} · {b.customer_name} · {b.start_date}
                  {b.end_date && b.end_date !== b.start_date
                    ? ` – ${b.end_date}`
                    : ''}
                </option>
              ))}
            </FormInput>
          </div>
        </>
      )}

      <div className={styles.formSectionLabel}>Customer</div>
      <div className={styles.formRow}>
        <FormInput
          id="customer_name"
          label="Full Name"
          formActions={formActions}
          disabled={disabled}
        />
        <FormInput
          id="customer_email"
          type="email"
          label="Email"
          formActions={formActions}
          disabled={disabled}
        />
      </div>
      <div className={styles.formRow}>
        <FormInput
          id="customer_phone"
          type="tel"
          label="Phone"
          formActions={formActions}
          disabled={disabled}
          required={false}
        />
        <FormInput
          id="guest_count"
          type="number"
          label={
            maxGuests !== null
              ? `Guests (max ${maxGuests - 1} additional)`
              : 'Guest Count'
          }
          formActions={formActions}
          disabled={disabled}
          required={false}
          min={watchType === 'transport' ? TRANSPORT_MIN_PASSENGERS : 0}
          max={maxGuests !== null ? maxGuests - 1 : undefined}
          validation={
            maxGuests !== null
              ? {
                  max: {
                    value: maxGuests - 1,
                    message: `Max total capacity is ${maxGuests} (yourself + ${maxGuests - 1} guests)`,
                  },
                }
              : {}
          }
        />
      </div>

      <div className={styles.formSectionLabel}>Dates &amp; Times</div>

      {/* Boat cruise: single date + pickup time only (duration is set by hours) */}
      {watchType === 'boat_cruise' && (
        <div className={styles.formRow}>
          <FormInput
            id="start_date"
            type="date"
            label="Date"
            formActions={formActions}
            disabled={disabled}
          />
          <FormInput
            id="start_time"
            type="time"
            label="Pickup Time"
            formActions={formActions}
            disabled={disabled}
            required={false}
            max={maxStartTime}
          />
        </div>
      )}

      {/* Beach house: check-in / check-out dates only */}
      {watchType === 'beach_house' && (
        <div className={styles.formRow}>
          <FormInput
            id="start_date"
            type="date"
            label="Check-in Date"
            formActions={formActions}
            disabled={disabled}
          />
          <FormInput
            id="end_date"
            type="date"
            label="Check-out Date"
            formActions={formActions}
            disabled={disabled}
          />
        </div>
      )}

      {/* Transport: date set by linked stay (read-only), or manual entry */}
      {watchType === 'transport' &&
        (linkedStay ? (
          <div className={styles.linkedTransportDateBox}>
            {/* Hidden fields — parent syncs values from the linked booking */}
            <input type="hidden" {...formActions.register('start_date')} />
            <input type="hidden" {...formActions.register('start_time')} />
            {watchTransportType === 'round_trip' && (
              <>
                <input type="hidden" {...formActions.register('end_date')} />
                <input type="hidden" {...formActions.register('end_time')} />
              </>
            )}
            {/* Date display */}
            {watchTransportType === 'round_trip' ? (
              <>
                <div className={styles.linkedTransportDateRow}>
                  <span className={styles.linkedTransportDateLabel}>
                    Outbound date
                  </span>
                  <span className={styles.linkedTransportDateValue}>
                    {linkedStay.start_date}
                  </span>
                </div>
                <div className={styles.linkedTransportDateRow}>
                  <span className={styles.linkedTransportDateLabel}>
                    Return date
                  </span>
                  <span className={styles.linkedTransportDateValue}>
                    {linkedStay.end_date}
                  </span>
                </div>
              </>
            ) : (
              <div className={styles.linkedTransportDateRow}>
                <span className={styles.linkedTransportDateLabel}>
                  Transfer date
                </span>
                <span className={styles.linkedTransportDateValue}>
                  {linkedStay.start_date}
                </span>
              </div>
            )}
            {/* Outbound pickup — auto-derived from house check-in time */}
            <div className={styles.linkedTransportDateRow}>
              <span className={styles.linkedTransportDateLabel}>
                Outbound pickup
              </span>
              <span className={styles.linkedTransportDateValue}>
                {linkedHouse?.check_in_time && routeDuration
                  ? formatTime12(
                      subtractTime(linkedHouse.check_in_time, routeDuration),
                    )
                  : '—'}
              </span>
            </div>
            {linkedHouse?.check_in_time && routeDuration ? (
              <p className={styles.linkedTransportNote}>
                Departs {routeDuration}hr before{' '}
                {formatTime12(linkedHouse.check_in_time)} check-in.
              </p>
            ) : !routeDuration ? (
              <p className={styles.linkedTransportNote}>
                Set a route duration in Locations to auto-compute pickup times.
              </p>
            ) : null}
            {/* Return pickup — defaults to checkout time, user can override */}
            {watchTransportType === 'round_trip' && (
              <>
                <div className={styles.linkedTransportDateRow}>
                  <span className={styles.linkedTransportDateLabel}>
                    Return pickup
                  </span>
                  <span className={styles.linkedTransportDateValue}>
                    {formatTime12(
                      watchReturnPickupTime ||
                        linkedHouse?.check_out_time ||
                        null,
                    ) ?? '—'}
                  </span>
                </div>
                <div className={styles.formRow}>
                  <FormInput
                    id="return_pickup_time"
                    type="time"
                    label="Return pickup time (optional)"
                    formActions={formActions}
                    disabled={disabled}
                    required={false}
                  />
                </div>
                <p className={styles.linkedTransportNote}>
                  {watchReturnPickupTime
                    ? `Boat picks up guests at ${formatTime12(watchReturnPickupTime)} on the return date.`
                    : `Defaults to ${linkedHouse?.check_out_time ? formatTime12(linkedHouse.check_out_time) + ' checkout time' : 'checkout time'} — set a time above to override.`}
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className={styles.formRow}>
              <FormInput
                id="start_date"
                type="date"
                label={
                  watchTransportType === 'round_trip' ? 'Outbound Date' : 'Date'
                }
                formActions={formActions}
                disabled={disabled}
              />
              <FormInput
                id="start_time"
                type="time"
                label={
                  watchTransportType === 'round_trip'
                    ? 'Outbound Boarding Time'
                    : 'Boarding Time'
                }
                formActions={formActions}
                disabled={disabled}
                required={false}
              />
            </div>
            {watchTransportType === 'round_trip' && (
              <div className={styles.formRow}>
                <FormInput
                  id="end_date"
                  type="date"
                  label="Return Date"
                  formActions={formActions}
                  disabled={disabled}
                />
                <FormInput
                  id="end_time"
                  type="time"
                  label="Return Boarding Time"
                  formActions={formActions}
                  disabled={disabled}
                  required={false}
                />
              </div>
            )}
          </>
        ))}

      {/* ── Availability feedback ──────────────────────────── */}
      {availabilityState.status === 'checking' && (
        <div
          className={`${styles.availabilityBanner} ${styles.availabilityChecking}`}
        >
          <span className={styles.availabilityDot} />
          Checking availability…
        </div>
      )}
      {availabilityState.status === 'available' && (
        <div
          className={`${styles.availabilityBanner} ${styles.availabilityOk}`}
        >
          <CheckCircle2 size={14} />
          This slot is available.
        </div>
      )}
      {availabilityState.status === 'unavailable' && (
        <div
          className={`${styles.availabilityBanner} ${styles.availabilityBlocked}`}
        >
          <XCircle size={14} />
          <span>
            Already booked
            {availabilityState.conflictRef
              ? ` (${availabilityState.conflictRef}`
              : ''}
            {availabilityState.conflictCustomer
              ? ` · ${availabilityState.conflictCustomer})`
              : availabilityState.conflictRef
                ? ')'
                : ''}
            . Choose different dates.
          </span>
        </div>
      )}
      {availabilityState.status === 'curfew' && (
        <div
          className={`${styles.availabilityBanner} ${styles.availabilityBlocked}`}
        >
          <XCircle size={14} />
          <span>
            Booking exceeds the curfew time ({availabilityState.curfewTime}).
            Please choose an earlier start time or reduce the number of hours.
          </span>
        </div>
      )}

      <div className={styles.formSectionLabel}>Payment</div>

      {/* Total is always computed — never a free-text input */}
      <div className={styles.computedTotalBox}>
        <span className={styles.computedTotalLabel}>Total Amount</span>
        {computedTotal !== null ? (
          <span className={styles.computedTotalValue}>
            ₦{computedTotal.toLocaleString()}
          </span>
        ) : (
          <span className={styles.computedTotalPlaceholder}>
            {watchType === 'boat_cruise'
              ? 'Select a boat and enter hours to calculate'
              : watchType === 'beach_house'
                ? 'Select a property and enter dates to calculate'
                : 'Select pickup and drop-off locations to calculate'}
          </span>
        )}
      </div>

      <FormInput
        id="status"
        type="select"
        label="Booking Status"
        formActions={formActions}
        disabled={disabled}
      >
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
        <option value="expired">Expired</option>
        <option value="completed">Completed</option>
      </FormInput>
      <p className={styles.paymentStatusHint}>
        {watchStatus === 'pending'
          ? 'Awaiting payment — confirm once payment is received.'
          : watchStatus === 'confirmed'
            ? 'Payment received — booking is confirmed.'
            : watchStatus === 'cancelled'
              ? 'Payment was received; booking has been cancelled.'
              : watchStatus === 'completed'
                ? 'Booking has been completed.'
                : 'Payment was received; booking expired (no-show).'}
      </p>
      <FormInput
        id="payment_reference"
        label={
          paymentRefRequired
            ? 'Transfer / Bank Reference (required to confirm)'
            : 'Transfer / Bank Reference (optional)'
        }
        formActions={formActions}
        disabled={disabled}
        required={paymentRefRequired}
        placeholder="e.g. transfer receipt reference"
      />
      <FormInput
        id="notes"
        type="textarea"
        label="Notes"
        formActions={formActions}
        disabled={disabled}
        required={false}
      />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function BookingsHome() {
  const queryClient = useQueryClient();
  const { bookings, isLoading, error } = useBookings();
  const { customers } = useCustomers();
  const { boats } = useBoats();
  const { beachHouses } = useBeachHouses();
  const { locations } = useLocations();
  const { routes: transportRoutes } = useTransportRoutes();
  const { settings } = useSettings();
  const curfewTime = settings?.boat_curfew_time ?? null;
  const { create, isPending: isCreating } = useCreateBooking();
  const { update, isPending: isUpdating } = useUpdateBooking();
  const { remove, isPending: isDeleting } = useDeleteBooking();
  const { updateStatus, isPending: isStatusUpdating } =
    useUpdateBookingStatus();

  const [searchParams, setSearchParams] = useSearchParams();

  // ── All view state lives in the URL ──────────────────────────────────────
  const activeTab = (searchParams.get('tab') ?? 'bookings') as Tab;
  const search = searchParams.get('q') ?? '';
  const statusFilter = (searchParams.get('status') ?? 'all') as StatusFilter;
  const typeFilter = (searchParams.get('type') ?? 'all') as TypeFilter;
  const sortKey = (searchParams.get('sort') ?? 'newest') as SortKey;
  const expandedId = searchParams.get('open');
  const page = Number(searchParams.get('page') ?? '1');
  const datePreset = (searchParams.get('period') ?? 'month') as DatePreset;
  const customStart = searchParams.get('from') ?? '';
  const customEnd = searchParams.get('to') ?? '';
  const customerSearch = searchParams.get('cq') ?? '';
  const customerSort = (searchParams.get('csort') ??
    'bookings_desc') as CustomerSortKey;
  const customerView = (searchParams.get('cview') ?? 'table') as CustomerView;
  const customerPage = Number(searchParams.get('cpage') ?? '1');

  function sp(updates: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  }

  // Scroll to expanded booking when ?open= is present
  useEffect(() => {
    if (!expandedId) return;
    setTimeout(() => {
      document.getElementById(`booking-row-${expandedId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 150);
  }, [expandedId]);

  const [showCreate, setShowCreate] = useState(false);
  const [isCreateBusy, setIsCreateBusy] = useState(false);
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(
    null,
  );

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isEditBusy, setIsEditBusy] = useState(false);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);

  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);

  // ── Customer edit/delete ─────────────────────────────────────────────────
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(
    null,
  );
  const [customerEditError, setCustomerEditError] = useState<string | null>(
    null,
  );

  const {
    register: customerReg,
    handleSubmit: customerHandleSubmit,
    reset: customerReset,
    formState: { errors: customerErrors },
  } = useForm<{
    full_name: string;
    email: string;
    phone: string;
    marketing_opt_in: boolean;
  }>();
  const customerFormActions = { register: customerReg, errors: customerErrors };

  const { mutate: saveCustomer, isPending: isSavingCustomer } = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Parameters<typeof updateCustomer>[1];
    }) => updateCustomer(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditingCustomer(null);
    },
    onError: (err) =>
      setCustomerEditError(err instanceof Error ? err.message : String(err)),
  });

  const { mutate: removeCustomer, isPending: isDeletingCustomer } = useMutation<
    void,
    Error,
    { id: string; label?: string }
  >({
    mutationFn: ({ id }) => deleteCustomer(id),
    onSuccess: async (_, { label }) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDeletingCustomer(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';
      await insertActivityLog({
        type: 'delete_customer',
        title: 'Customer Deleted',
        message: label
          ? `${actor} deleted customer ${label}`
          : `${actor} deleted a customer`,
        entity_type: 'customer',
        actor_name: actor,
      });
    },
    onError: (err) => alert(err instanceof Error ? err.message : String(err)),
  });

  function openEditCustomer(c: Customer) {
    setCustomerEditError(null);
    customerReset({
      full_name: c.full_name,
      email: c.email,
      phone: c.phone ?? '',
      marketing_opt_in: c.marketing_opt_in,
    });
    setEditingCustomer(c);
  }

  // UI-only state (not URL-driven)
  // ── Date range ───────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (datePreset === 'month')
      return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
    if (datePreset === 'quarter') {
      const qs = Math.floor(m / 3) * 3;
      return {
        start: iso(new Date(y, qs, 1)),
        end: iso(new Date(y, qs + 3, 0)),
      };
    }
    if (datePreset === 'half') {
      const hs = m < 6 ? 0 : 6;
      return {
        start: iso(new Date(y, hs, 1)),
        end: iso(new Date(y, hs + 6, 0)),
      };
    }
    if (datePreset === 'year')
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    return { start: customStart, end: customEnd };
  }, [datePreset, customStart, customEnd]);

  function getPeriodLabel() {
    const { start } = dateRange;
    if (!start) return 'All time';
    const d = new Date(start + 'T12:00:00');
    if (datePreset === 'month')
      return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (datePreset === 'quarter')
      return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    if (datePreset === 'half')
      return `${d.getMonth() < 6 ? 'H1' : 'H2'} ${d.getFullYear()}`;
    if (datePreset === 'year') return String(d.getFullYear());
    if (dateRange.start && dateRange.end)
      return `${formatDate(dateRange.start)} – ${formatDate(dateRange.end)}`;
    return 'Custom';
  }

  // ── Metrics ─────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const inPeriod = bookings.filter(
      (b) =>
        (!dateRange.start || b.start_date >= dateRange.start) &&
        (!dateRange.end || b.start_date <= dateRange.end),
    );
    const total = inPeriod.length;
    const confirmed = inPeriod.filter((b) => b.status === 'confirmed').length;
    const pending = inPeriod.filter((b) => b.status === 'pending').length;
    const revenue = inPeriod
      .filter((b) => b.payment_status === 'paid')
      .reduce((s, b) => s + (b.total_amount ?? 0), 0);
    return { total, confirmed, pending, revenue };
  }, [bookings, dateRange]);

  // ── Filtered / sorted bookings ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = bookings.filter((b) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.reference_code.toLowerCase().includes(q) ||
        b.customer_name.toLowerCase().includes(q) ||
        b.customer_email.toLowerCase().includes(q) ||
        b.boat?.name?.toLowerCase().includes(q) ||
        b.beach_house?.name?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchType = typeFilter === 'all' || b.booking_type === typeFilter;
      const matchDate =
        (!dateRange.start || b.start_date >= dateRange.start) &&
        (!dateRange.end || b.start_date <= dateRange.end);
      return matchSearch && matchStatus && matchType && matchDate;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'oldest')
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      if (sortKey === 'amount_desc')
        return (b.total_amount ?? 0) - (a.total_amount ?? 0);
      if (sortKey === 'amount_asc')
        return (a.total_amount ?? 0) - (b.total_amount ?? 0);
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ); // newest
    });
    return list;
  }, [bookings, search, statusFilter, typeFilter, sortKey, dateRange]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    let list = q
      ? customers.filter(
          (c) =>
            c.full_name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q),
        )
      : [...customers];
    list.sort((a, b) => {
      switch (customerSort) {
        case 'name_asc':
          return a.full_name.localeCompare(b.full_name);
        case 'name_desc':
          return b.full_name.localeCompare(a.full_name);
        case 'bookings_asc':
          return a.total_bookings - b.total_bookings;
        case 'bookings_desc':
          return b.total_bookings - a.total_bookings;
        case 'spent_asc':
          return Number(a.total_spent) - Number(b.total_spent);
        case 'spent_desc':
          return Number(b.total_spent) - Number(a.total_spent);
        case 'recent':
          return (b.last_booking_at ?? '').localeCompare(
            a.last_booking_at ?? '',
          );
        default:
          return 0;
      }
    });
    return list;
  }, [customers, customerSearch, customerSort]);

  const customerTotalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / CUSTOMER_PAGE_SIZE),
  );
  const safeCP = Math.min(customerPage, customerTotalPages);
  const paginatedCustomers = filteredCustomers.slice(
    (safeCP - 1) * CUSTOMER_PAGE_SIZE,
    safeCP * CUSTOMER_PAGE_SIZE,
  );
  const customerPageStart =
    filteredCustomers.length === 0 ? 0 : (safeCP - 1) * CUSTOMER_PAGE_SIZE + 1;
  const customerPageEnd = Math.min(
    safeCP * CUSTOMER_PAGE_SIZE,
    filteredCustomers.length,
  );

  function downloadCustomersCSV() {
    const headers = [
      'Name',
      'Email',
      'Phone',
      'Bookings',
      'Total Spent (NGN)',
      'Last Booking',
      'Marketing Opt-in',
    ];
    const rows = filteredCustomers.map((c) => [
      c.full_name,
      c.email,
      c.phone,
      c.total_bookings,
      c.total_spent,
      c.last_booking_at
        ? new Date(c.last_booking_at).toLocaleDateString('en-GB')
        : '',
      c.marketing_opt_in ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Pagination ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeP = Math.min(page, totalPages);
  const paginated = filtered.slice((safeP - 1) * PAGE_SIZE, safeP * PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : (safeP - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safeP * PAGE_SIZE, filtered.length);

  // ── Create form ──────────────────────────────────────────────────────────
  const {
    register: createReg,
    handleSubmit: createHandleSubmit,
    formState: { errors: createErrors },
    reset: resetCreate,
    watch: createWatch,
    setValue: createSetValue,
  } = useForm<BookingFields>({
    defaultValues: {
      booking_type: 'boat_cruise',
      status: 'pending',
      payment_status: 'pending',
      hours: 1,
      guest_count: 1,
    },
  });
  const createFormActions = { register: createReg, errors: createErrors };
  const watchCreateType = createWatch('booking_type') as BookingType;
  const watchCreateTransportType = createWatch('transport_type') as string;
  const watchCreateStatus = createWatch('status') as BookingStatus;
  const watchCreateBoatId = createWatch('boat_id');
  const watchCreateBeachHouseId = createWatch('beach_house_id');
  const watchCreateParentBookingId =
    createWatch('parent_beach_house_booking_id') ?? '';
  const watchCreateHours = Number(createWatch('hours')) || 0;
  const watchCreateStartDate = createWatch('start_date');
  const watchCreateEndDate = createWatch('end_date');
  const watchCreateStartTime = createWatch('start_time');
  const watchCreatePickupLocation = createWatch('pickup_location');
  const watchCreateDropoffLocation = createWatch('dropoff_location');
  const watchCreateGuestCount = Number(createWatch('guest_count')) || 1;
  const watchCreateTransportRouteId = createWatch('transport_route_id') ?? '';
  const watchCreateReturnPickupTime = createWatch('return_pickup_time') ?? '';

  // Compute total from asset price × quantity whenever relevant inputs change
  const createComputedTotal = useMemo(() => {
    if (watchCreateType === 'boat_cruise') {
      const boat = boats?.find((b) => b.id === watchCreateBoatId);
      if (boat?.price_per_hour && watchCreateHours > 0) {
        return boat.price_per_hour * watchCreateHours;
      }
      return null;
    }
    if (watchCreateType === 'beach_house') {
      const house = beachHouses?.find((h) => h.id === watchCreateBeachHouseId);
      if (
        house?.price_per_night &&
        watchCreateStartDate &&
        watchCreateEndDate
      ) {
        const nights = Math.round(
          (new Date(watchCreateEndDate).getTime() -
            new Date(watchCreateStartDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (nights > 0) return house.price_per_night * nights;
      }
      return null;
    }
    if (watchCreateType === 'transport') {
      // If linked to a beach house stay, use that house's fixed transport price if set
      // (not per-person — the override is a flat rate, but still doubled for round trips)
      if (watchCreateParentBookingId) {
        const stay = bookings?.find((b) => b.id === watchCreateParentBookingId);
        const house = beachHouses?.find((h) => h.id === stay?.beach_house_id);
        if (house?.transport_price) {
          const tripMultiplier =
            watchCreateTransportType === 'round_trip' ? 2 : 1;
          return house.transport_price * tripMultiplier;
        }
      }
      if (watchCreatePickupLocation && watchCreateDropoffLocation) {
        const routePrice = findRoutePrice(
          transportRoutes,
          watchCreatePickupLocation,
          watchCreateDropoffLocation,
        );
        const billable = Math.max(
          watchCreateGuestCount,
          TRANSPORT_MIN_PASSENGERS,
        );
        const tripMultiplier =
          watchCreateTransportType === 'round_trip' ? 2 : 1;
        return routePrice !== null
          ? routePrice * billable * tripMultiplier
          : null;
      }
      return null;
    }
    return null;
  }, [
    watchCreateType,
    watchCreateBoatId,
    watchCreateBeachHouseId,
    watchCreateHours,
    watchCreateStartDate,
    watchCreateEndDate,
    watchCreatePickupLocation,
    watchCreateDropoffLocation,
    watchCreateParentBookingId,
    watchCreateGuestCount,
    watchCreateTransportType,
    boats,
    beachHouses,
    bookings,
    transportRoutes,
  ]);

  // Sync computed total → form value so it is submitted correctly
  useEffect(() => {
    if (createComputedTotal !== null) {
      createSetValue('total_amount', createComputedTotal);
    }
  }, [createComputedTotal, createSetValue]);

  // When booking type switches to transport, ensure guest count meets the minimum
  useEffect(() => {
    if (
      watchCreateType === 'transport' &&
      watchCreateGuestCount < TRANSPORT_MIN_PASSENGERS
    ) {
      createSetValue('guest_count', TRANSPORT_MIN_PASSENGERS);
    }
  }, [watchCreateType, watchCreateGuestCount, createSetValue]);

  // When boat changes on a cruise booking, clamp hours to the boat's allowed range
  useEffect(() => {
    if (watchCreateType !== 'boat_cruise' || !watchCreateBoatId) return;
    const boat = boats?.find((b) => b.id === watchCreateBoatId);
    if (!boat) return;
    const min = boat.min_booking_hours ?? 1;
    const max = boat.max_booking_hours ?? Infinity;
    const current = watchCreateHours;
    if (current < min) createSetValue('hours', min);
    else if (current > max) createSetValue('hours', max);
  }, [
    watchCreateBoatId,
    watchCreateType,
    boats,
    watchCreateHours,
    createSetValue,
  ]);

  // When a route is selected on create, auto-set pickup + dropoff from the route
  useEffect(() => {
    if (watchCreateType !== 'transport' || !watchCreateTransportRouteId) return;
    const route = transportRoutes?.find(
      (r) => r.id === watchCreateTransportRouteId,
    );
    if (!route) return;
    createSetValue('pickup_location', route.from_location?.name ?? '');
    createSetValue('dropoff_location', route.to_location?.name ?? '');
  }, [
    watchCreateTransportRouteId,
    watchCreateType,
    transportRoutes,
    createSetValue,
  ]);

  // When a linked stay is selected (or trip type changes), sync dates + dropoff from the beach house
  useEffect(() => {
    if (watchCreateType !== 'transport' || !watchCreateParentBookingId) return;
    const stay = bookings?.find((b) => b.id === watchCreateParentBookingId);
    if (stay?.start_date) createSetValue('start_date', stay.start_date);
    // For round trip: return date = check-out date; for one-way: clear end_date
    if (watchCreateTransportType === 'round_trip' && stay?.end_date) {
      createSetValue('end_date', stay.end_date);
    } else {
      createSetValue('end_date', stay?.start_date ?? '');
    }
    const house = beachHouses?.find((h) => h.id === stay?.beach_house_id);
    if (house?.location) createSetValue('dropoff_location', house.location);
  }, [
    watchCreateParentBookingId,
    watchCreateTransportType,
    watchCreateType,
    bookings,
    beachHouses,
    locations,
    createSetValue,
  ]);

  // For linked transport: auto-compute start_time from check-in; end_time = return pickup or checkout.
  useEffect(() => {
    if (watchCreateType !== 'transport' || !watchCreateParentBookingId) return;
    const stay = bookings?.find((b) => b.id === watchCreateParentBookingId);
    const house = beachHouses?.find((h) => h.id === stay?.beach_house_id);
    const dur = findRouteDuration(
      transportRoutes ?? [],
      watchCreateTransportRouteId,
    );
    const checkinTime = house?.check_in_time ?? null;
    const checkoutTime = house?.check_out_time ?? null;
    createSetValue(
      'start_time',
      checkinTime && dur ? subtractTime(checkinTime, dur) : '',
    );
    createSetValue(
      'end_time',
      watchCreateReturnPickupTime || checkoutTime || '',
    );
  }, [
    watchCreateType,
    watchCreateParentBookingId,
    watchCreateReturnPickupTime,
    watchCreateTransportRouteId,
    transportRoutes,
    bookings,
    beachHouses,
    createSetValue,
  ]);

  function openCreate() {
    resetCreate({
      booking_type: 'boat_cruise',
      status: 'pending',
      payment_status: 'pending',
      hours: 1,
      guest_count: 1,
    });
    setCreateSubmitError(null);
    setShowCreate(true);
  }

  function handleCreateSubmit(data: BookingFields) {
    setCreateSubmitError(null);
    // Hard curfew guard — fires even if the availability banner check was skipped
    if (
      data.booking_type === 'boat_cruise' &&
      data.start_time &&
      Number(data.hours) > 0 &&
      curfewTime
    ) {
      const endT = boatAvailabilityEndTime(data.start_time, Number(data.hours));
      const toMins = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      const endMins = toMins(endT);
      const sMins = toMins(data.start_time);
      const effectiveEnd = endMins < sMins ? endMins + 24 * 60 : endMins;
      if (effectiveEnd > toMins(curfewTime)) {
        setCreateSubmitError(
          `This cruise ends at ${endT} (including 1hr docking buffer), which is past the ${curfewTime} curfew. Please choose an earlier start time or reduce the hours.`,
        );
        return;
      }
    }
    setIsCreateBusy(true);
    create(
      {
        booking_type: data.booking_type,
        boat_id: data.boat_id || null,
        beach_house_id: data.beach_house_id || null,
        parent_beach_house_booking_id:
          data.parent_beach_house_booking_id || null,
        transport_type: (data.transport_type as never) || null,
        transport_route_id:
          data.booking_type === 'transport'
            ? data.transport_route_id || null
            : null,
        pickup_location: data.pickup_location || null,
        dropoff_location: data.dropoff_location || null,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone || '',
        guest_count: Number(data.guest_count) || 1,
        start_date: data.start_date,
        // Boat cruise: end_date matches start_date.
        // Transport round trip: end_date = return date (check-out for linked stay).
        // Transport one-way: end_date = start_date.
        end_date:
          data.booking_type === 'boat_cruise'
            ? data.start_date
            : data.booking_type === 'transport'
              ? data.transport_type === 'round_trip' && data.end_date
                ? data.end_date
                : data.start_date
              : data.end_date,
        start_time: data.start_time || null,
        end_time: (() => {
          if (
            data.booking_type === 'boat_cruise' &&
            data.start_time &&
            Number(data.hours) > 0
          )
            return computeEndTime(data.start_time, Number(data.hours));
          // Linked transport: end_time = return pickup (checkout or override) — already in data.end_time via useEffect
          if (
            data.booking_type === 'transport' &&
            data.parent_beach_house_booking_id
          )
            return data.end_time || null;
          if (
            data.booking_type === 'transport' &&
            data.start_time &&
            data.transport_route_id
          ) {
            const dur = findRouteDuration(
              transportRoutes ?? [],
              data.transport_route_id,
            );
            if (dur)
              return transportEndTime(
                data.start_time,
                dur,
                data.transport_type ?? 'outbound',
              );
          }
          return data.end_time || null;
        })(),
        hours:
          data.booking_type === 'boat_cruise' && Number(data.hours) > 0
            ? Number(data.hours)
            : null,
        total_amount: Number(data.total_amount) || 0,
        status: data.status,
        payment_status: derivePaymentStatus(data.status),
        payment_reference: data.payment_reference || null,
        source: 'admin' as never,
        notes: data.notes || null,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          setShowCreate(false);
          resetCreate();
          setIsCreateBusy(false);
        },
        onError: (err) => {
          setCreateSubmitError(parseBookingError(err));
          setIsCreateBusy(false);
        },
      },
    );
  }

  // ── Edit form ────────────────────────────────────────────────────────────
  const {
    register: editReg,
    handleSubmit: editHandleSubmit,
    formState: { errors: editErrors },
    reset: resetEdit,
    watch: editWatch,
    setValue: editSetValue,
  } = useForm<BookingFields>();
  const editFormActions = { register: editReg, errors: editErrors };
  const watchEditType = editWatch('booking_type') as BookingType;
  const watchEditTransportType = editWatch('transport_type') as string;
  const watchEditStatus = editWatch('status') as BookingStatus;
  const watchEditBoatId = editWatch('boat_id');
  const watchEditBeachHouseId = editWatch('beach_house_id');
  const watchEditParentBookingId =
    editWatch('parent_beach_house_booking_id') ?? '';
  const watchEditHours = Number(editWatch('hours')) || 0;
  const watchEditStartDate = editWatch('start_date');
  const watchEditEndDate = editWatch('end_date');
  const watchEditStartTime = editWatch('start_time');
  const watchEditPickupLocation = editWatch('pickup_location');
  const watchEditDropoffLocation = editWatch('dropoff_location');
  const watchEditGuestCount = Number(editWatch('guest_count')) || 1;
  const watchEditTransportRouteId = editWatch('transport_route_id') ?? '';
  const watchEditReturnPickupTime = editWatch('return_pickup_time') ?? '';

  const editComputedTotal = useMemo(() => {
    if (watchEditType === 'boat_cruise') {
      const boat = boats?.find((b) => b.id === watchEditBoatId);
      if (boat?.price_per_hour && watchEditHours > 0) {
        return boat.price_per_hour * watchEditHours;
      }
      return null;
    }
    if (watchEditType === 'beach_house') {
      const house = beachHouses?.find((h) => h.id === watchEditBeachHouseId);
      if (house?.price_per_night && watchEditStartDate && watchEditEndDate) {
        const nights = Math.round(
          (new Date(watchEditEndDate).getTime() -
            new Date(watchEditStartDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (nights > 0) return house.price_per_night * nights;
      }
      return null;
    }
    if (watchEditType === 'transport') {
      // If linked to a beach house stay, use that house's fixed transport price if set
      // (not per-person — the override is a flat rate, but still doubled for round trips)
      if (watchEditParentBookingId) {
        const stay = bookings?.find((b) => b.id === watchEditParentBookingId);
        const house = beachHouses?.find((h) => h.id === stay?.beach_house_id);
        if (house?.transport_price) {
          const tripMultiplier =
            watchEditTransportType === 'round_trip' ? 2 : 1;
          return house.transport_price * tripMultiplier;
        }
      }
      if (watchEditPickupLocation && watchEditDropoffLocation) {
        const routePrice = findRoutePrice(
          transportRoutes,
          watchEditPickupLocation,
          watchEditDropoffLocation,
        );
        const billable = Math.max(
          watchEditGuestCount,
          TRANSPORT_MIN_PASSENGERS,
        );
        const tripMultiplier = watchEditTransportType === 'round_trip' ? 2 : 1;
        return routePrice !== null
          ? routePrice * billable * tripMultiplier
          : null;
      }
      return null;
    }
    return null;
  }, [
    watchEditType,
    watchEditBoatId,
    watchEditBeachHouseId,
    watchEditHours,
    watchEditStartDate,
    watchEditEndDate,
    watchEditPickupLocation,
    watchEditDropoffLocation,
    watchEditParentBookingId,
    watchEditGuestCount,
    watchEditTransportType,
    boats,
    beachHouses,
    bookings,
    transportRoutes,
  ]);

  useEffect(() => {
    if (editComputedTotal !== null) {
      editSetValue('total_amount', editComputedTotal);
    }
  }, [editComputedTotal, editSetValue]);

  // When booking type switches to transport, ensure guest count meets the minimum
  useEffect(() => {
    if (
      watchEditType === 'transport' &&
      watchEditGuestCount < TRANSPORT_MIN_PASSENGERS
    ) {
      editSetValue('guest_count', TRANSPORT_MIN_PASSENGERS);
    }
  }, [watchEditType, watchEditGuestCount, editSetValue]);

  // When boat changes on a cruise booking, clamp hours to the boat's allowed range
  useEffect(() => {
    if (watchEditType !== 'boat_cruise' || !watchEditBoatId) return;
    const boat = boats?.find((b) => b.id === watchEditBoatId);
    if (!boat) return;
    const min = boat.min_booking_hours ?? 1;
    const max = boat.max_booking_hours ?? Infinity;
    const current = watchEditHours;
    if (current < min) editSetValue('hours', min);
    else if (current > max) editSetValue('hours', max);
  }, [watchEditBoatId, watchEditType, boats, watchEditHours, editSetValue]);

  // When a route is selected on edit, auto-set pickup + dropoff from the route
  useEffect(() => {
    if (watchEditType !== 'transport' || !watchEditTransportRouteId) return;
    const route = transportRoutes?.find(
      (r) => r.id === watchEditTransportRouteId,
    );
    if (!route) return;
    editSetValue('pickup_location', route.from_location?.name ?? '');
    editSetValue('dropoff_location', route.to_location?.name ?? '');
  }, [watchEditTransportRouteId, watchEditType, transportRoutes, editSetValue]);

  // When a linked stay is selected (or trip type changes), sync dates + dropoff from the beach house
  useEffect(() => {
    if (watchEditType !== 'transport' || !watchEditParentBookingId) return;
    const stay = bookings?.find((b) => b.id === watchEditParentBookingId);
    if (stay?.start_date) editSetValue('start_date', stay.start_date);
    // For round trip: return date = check-out date; for one-way: clear end_date
    if (watchEditTransportType === 'round_trip' && stay?.end_date) {
      editSetValue('end_date', stay.end_date);
    } else {
      editSetValue('end_date', stay?.start_date ?? '');
    }
    const house = beachHouses?.find((h) => h.id === stay?.beach_house_id);
    if (house?.location) editSetValue('dropoff_location', house.location);
  }, [
    watchEditParentBookingId,
    watchEditTransportType,
    watchEditType,
    bookings,
    beachHouses,
    locations,
    editSetValue,
  ]);

  // For linked transport: auto-compute start_time from check-in; end_time = return pickup or checkout.
  useEffect(() => {
    if (watchEditType !== 'transport' || !watchEditParentBookingId) return;
    const stay = bookings?.find((b) => b.id === watchEditParentBookingId);
    const house = beachHouses?.find((h) => h.id === stay?.beach_house_id);
    const dur = findRouteDuration(
      transportRoutes ?? [],
      watchEditTransportRouteId,
    );
    const checkinTime = house?.check_in_time ?? null;
    const checkoutTime = house?.check_out_time ?? null;
    editSetValue(
      'start_time',
      checkinTime && dur ? subtractTime(checkinTime, dur) : '',
    );
    editSetValue('end_time', watchEditReturnPickupTime || checkoutTime || '');
  }, [
    watchEditType,
    watchEditParentBookingId,
    watchEditReturnPickupTime,
    watchEditTransportRouteId,
    transportRoutes,
    bookings,
    beachHouses,
    editSetValue,
  ]);

  // ── Availability checks ───────────────────────────────────────────────────
  const createAvailabilityParams = useMemo((): AvailabilityParams | null => {
    if (
      watchCreateType === 'beach_house' &&
      watchCreateBeachHouseId &&
      watchCreateStartDate &&
      watchCreateEndDate
    )
      return {
        resourceType: 'beach_house',
        resourceId: watchCreateBeachHouseId,
        startDate: watchCreateStartDate,
        endDate: watchCreateEndDate,
      };
    if (
      watchCreateType === 'boat_cruise' &&
      watchCreateBoatId &&
      watchCreateStartDate
    )
      return {
        resourceType: 'boat',
        resourceId: watchCreateBoatId,
        startDate: watchCreateStartDate,
        endDate: watchCreateStartDate,
        startTime: watchCreateStartTime || null,
        endTime:
          watchCreateStartTime && watchCreateHours > 0
            ? boatAvailabilityEndTime(watchCreateStartTime, watchCreateHours)
            : null,
      };
    if (
      watchCreateType === 'transport' &&
      watchCreateBoatId &&
      watchCreateStartDate &&
      watchCreateStartTime &&
      watchCreateTransportRouteId
    ) {
      const dur = findRouteDuration(
        transportRoutes ?? [],
        watchCreateTransportRouteId,
      );
      return {
        resourceType: 'boat',
        resourceId: watchCreateBoatId,
        startDate: watchCreateStartDate,
        endDate: watchCreateStartDate,
        startTime: watchCreateStartTime,
        endTime: dur
          ? transportEndTime(
              watchCreateStartTime,
              dur,
              watchCreateTransportType,
            )
          : null,
      };
    }
    return null;
  }, [
    watchCreateType,
    watchCreateBeachHouseId,
    watchCreateBoatId,
    watchCreateStartDate,
    watchCreateEndDate,
    watchCreateStartTime,
    watchCreateHours,
    watchCreateTransportRouteId,
    watchCreateTransportType,
    transportRoutes,
  ]);

  const editAvailabilityParams = useMemo((): AvailabilityParams | null => {
    if (
      watchEditType === 'beach_house' &&
      watchEditBeachHouseId &&
      watchEditStartDate &&
      watchEditEndDate
    )
      return {
        resourceType: 'beach_house',
        resourceId: watchEditBeachHouseId,
        startDate: watchEditStartDate,
        endDate: watchEditEndDate,
        excludeBookingId: editingBooking?.id,
      };
    if (
      watchEditType === 'boat_cruise' &&
      watchEditBoatId &&
      watchEditStartDate
    )
      return {
        resourceType: 'boat',
        resourceId: watchEditBoatId,
        startDate: watchEditStartDate,
        endDate: watchEditStartDate,
        startTime: watchEditStartTime || null,
        endTime:
          watchEditStartTime && watchEditHours > 0
            ? boatAvailabilityEndTime(watchEditStartTime, watchEditHours)
            : null,
        excludeBookingId: editingBooking?.id,
      };
    if (
      watchEditType === 'transport' &&
      watchEditBoatId &&
      watchEditStartDate &&
      watchEditStartTime &&
      watchEditTransportRouteId
    ) {
      const dur = findRouteDuration(
        transportRoutes ?? [],
        watchEditTransportRouteId,
      );
      return {
        resourceType: 'boat',
        resourceId: watchEditBoatId,
        startDate: watchEditStartDate,
        endDate: watchEditStartDate,
        startTime: watchEditStartTime,
        endTime: dur
          ? transportEndTime(watchEditStartTime, dur, watchEditTransportType)
          : null,
        excludeBookingId: editingBooking?.id,
      };
    }
    return null;
  }, [
    watchEditType,
    watchEditBeachHouseId,
    watchEditBoatId,
    watchEditStartDate,
    watchEditEndDate,
    watchEditStartTime,
    watchEditHours,
    watchEditTransportRouteId,
    watchEditTransportType,
    editingBooking?.id,
    transportRoutes,
  ]);

  const createAvailability: AvailabilityState = useAvailabilityCheck(
    createAvailabilityParams,
  );
  const editAvailability: AvailabilityState = useAvailabilityCheck(
    editAvailabilityParams,
  );

  function openEdit(b: Booking) {
    setEditingBooking(b);
    setEditSubmitError(null);
    resetEdit({
      booking_type: b.booking_type,
      boat_id: b.boat_id ?? '',
      beach_house_id: b.beach_house_id ?? '',
      parent_beach_house_booking_id: b.parent_beach_house_booking_id ?? '',
      transport_type: b.transport_type ?? '',
      pickup_location: b.pickup_location ?? '',
      dropoff_location: b.dropoff_location ?? '',
      transport_route_id:
        b.booking_type === 'transport' ? (b.transport_route_id ?? '') : '',
      customer_name: b.customer_name,
      customer_email: b.customer_email,
      customer_phone: b.customer_phone ?? '',
      guest_count: b.guest_count,
      hours:
        b.booking_type === 'boat_cruise' ? (b.hours ?? undefined) : undefined,
      start_date: b.start_date,
      end_date: b.end_date,
      start_time: b.start_time ?? '',
      end_time: b.end_time ?? '',
      return_pickup_time:
        b.booking_type === 'transport' &&
        b.parent_beach_house_booking_id &&
        b.transport_type === 'round_trip'
          ? (b.end_time ?? '')
          : '',
      total_amount: b.total_amount,
      status: b.status,
      payment_status: b.payment_status,
      payment_reference: b.payment_reference ?? '',
      source: b.source,
      notes: b.notes ?? '',
    });
  }

  function handleEditSubmit(data: BookingFields) {
    if (!editingBooking) return;
    setEditSubmitError(null);
    // Hard curfew guard
    if (
      data.booking_type === 'boat_cruise' &&
      data.start_time &&
      Number(data.hours) > 0 &&
      curfewTime
    ) {
      const endT = boatAvailabilityEndTime(data.start_time, Number(data.hours));
      const toMins = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      const endMins = toMins(endT);
      const sMins = toMins(data.start_time);
      const effectiveEnd = endMins < sMins ? endMins + 24 * 60 : endMins;
      if (effectiveEnd > toMins(curfewTime)) {
        setEditSubmitError(
          `This cruise ends at ${endT} (including 1hr docking buffer), which is past the ${curfewTime} curfew. Please choose an earlier start time or reduce the hours.`,
        );
        return;
      }
    }
    setIsEditBusy(true);
    update(
      {
        id: editingBooking.id,
        booking_type: data.booking_type,
        boat_id: data.boat_id || null,
        beach_house_id: data.beach_house_id || null,
        parent_beach_house_booking_id:
          data.parent_beach_house_booking_id || null,
        transport_type: (data.transport_type as never) || null,
        transport_route_id:
          data.booking_type === 'transport'
            ? data.transport_route_id || null
            : null,
        pickup_location: data.pickup_location || null,
        dropoff_location: data.dropoff_location || null,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone || '',
        guest_count: Number(data.guest_count) || 1,
        start_date: data.start_date,
        end_date: data.end_date,
        start_time: data.start_time || null,
        end_time: (() => {
          if (
            data.booking_type === 'boat_cruise' &&
            data.start_time &&
            Number(data.hours) > 0
          )
            return computeEndTime(data.start_time, Number(data.hours));
          // Linked transport: end_time = return pickup (checkout or override) – already in data.end_time via useEffect
          if (
            data.booking_type === 'transport' &&
            data.parent_beach_house_booking_id
          )
            return data.end_time || null;
          if (
            data.booking_type === 'transport' &&
            data.start_time &&
            data.transport_route_id
          ) {
            const dur = findRouteDuration(
              transportRoutes ?? [],
              data.transport_route_id,
            );
            if (dur)
              return transportEndTime(
                data.start_time,
                dur,
                data.transport_type ?? 'outbound',
              );
          }
          return data.end_time || null;
        })(),
        hours:
          data.booking_type === 'boat_cruise' && Number(data.hours) > 0
            ? Number(data.hours)
            : null,
        total_amount: Number(data.total_amount) || 0,
        status: data.status,
        payment_status: derivePaymentStatus(data.status),
        payment_reference: data.payment_reference || null,
        source: data.source as never,
        notes: data.notes || null,
      },
      {
        onSuccess: () => {
          setEditingBooking(null);
          setIsEditBusy(false);
        },
        onError: (err) => {
          setEditSubmitError(parseBookingError(err));
          setIsEditBusy(false);
        },
      },
    );
  }

  // ── Quick status update ───────────────────────────────────────────────────
  function handleQuickStatus(b: Booking, status: BookingStatus) {
    updateStatus({ id: b.id, status });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Bookings</h1>
        <div className={styles.headerActions}>
          {activeTab === 'bookings' && (
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search ref, customer, listing…"
                value={search}
                onChange={(e) => sp({ q: e.target.value, page: null })}
              />
            </div>
          )}
          {activeTab === 'customers' && (
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search customers…"
                value={customerSearch}
                onChange={(e) => sp({ cq: e.target.value, cpage: null })}
              />
            </div>
          )}
          {activeTab === 'bookings' && (
            <Button
              variant="primary"
              onClick={openCreate}
              className={styles.addBtn}
            >
              <Plus size={16} /> New Booking
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'bookings' ? styles.tabActive : ''}`}
          onClick={() => sp({ tab: 'bookings' })}
        >
          <BookOpen size={15} /> Bookings
          <span className={styles.tabCount}>{bookings.length}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'customers' ? styles.tabActive : ''}`}
          onClick={() => sp({ tab: 'customers' })}
        >
          <Users size={15} /> Customers
          <span className={styles.tabCount}>{customers.length}</span>
        </button>
      </div>

      {/* ── BOOKINGS TAB ───────────────────────────────────────────────── */}
      {activeTab === 'bookings' && (
        <>
          {error && <p className={styles.errorMsg}>Error: {error.message}</p>}
          {isLoading && <p className={styles.emptyMsg}>Loading bookings…</p>}

          {/* Period picker */}
          {!isLoading && !error && (
            <div className={styles.periodBar}>
              <div className={styles.periodPills}>
                {(
                  [
                    { key: 'month', label: 'Month' },
                    { key: 'quarter', label: 'Quarter' },
                    { key: 'half', label: 'Half Year' },
                    { key: 'year', label: 'Year' },
                    { key: 'custom', label: 'Custom' },
                  ] as { key: DatePreset; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    className={`${styles.periodPill} ${datePreset === key ? styles.periodPillActive : ''}`}
                    onClick={() =>
                      sp({ period: key, page: null, from: null, to: null })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {datePreset === 'custom' ? (
                <div className={styles.customRange}>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={customStart}
                    onChange={(e) => sp({ from: e.target.value, page: null })}
                  />
                  <span className={styles.dateSep}>→</span>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={customEnd}
                    onChange={(e) => sp({ to: e.target.value, page: null })}
                  />
                </div>
              ) : (
                <span className={styles.periodLabel}>{getPeriodLabel()}</span>
              )}
            </div>
          )}

          {/* Metrics */}
          {!isLoading && !error && (
            <div className={styles.metrics}>
              <MetricCard
                label="Total Bookings"
                value={metrics.total}
                icon={<BookOpen size={18} />}
                accent="var(--color-ocean-blue)"
                iconBg="rgba(47,140,202,0.1)"
              />
              <MetricCard
                label="Confirmed"
                value={metrics.confirmed}
                icon={<CheckCircle2 size={18} />}
                accent="#16a34a"
                iconBg="rgba(22,163,74,0.1)"
              />
              <MetricCard
                label="Pending"
                value={metrics.pending}
                icon={<Clock size={18} />}
                accent="#d97706"
                iconBg="rgba(217,119,6,0.1)"
              />
              <MetricCard
                label="Revenue (Paid)"
                value={metrics.revenue}
                icon={<TrendingUp size={18} />}
                renderValue={(v) => (v > 0 ? formatPrice(v) : '—')}
                featured
              />
            </div>
          )}

          {/* Filters toolbar */}
          {!isLoading && !error && bookings.length > 0 && (
            <div className={styles.toolbar}>
              <div className={styles.toolbarGroup}>
                <ArrowUpDown size={13} className={styles.toolbarIcon} />
                <span className={styles.toolbarLabel}>Sort</span>
                <div className={styles.pills}>
                  {(
                    [
                      { key: 'newest', label: 'Newest' },
                      { key: 'oldest', label: 'Oldest' },
                      { key: 'amount_desc', label: 'Amount ↓' },
                      { key: 'amount_asc', label: 'Amount ↑' },
                    ] as { key: SortKey; label: string }[]
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      className={`${styles.pill} ${sortKey === key ? styles.pillActive : ''}`}
                      onClick={() => sp({ sort: key, page: null })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.toolbarGroup}>
                <SlidersHorizontal size={13} className={styles.toolbarIcon} />
                <span className={styles.toolbarLabel}>Status</span>
                <div className={styles.pills}>
                  {(
                    [
                      'all',
                      'pending',
                      'confirmed',
                      'completed',
                      'cancelled',
                      'expired',
                    ] as StatusFilter[]
                  ).map((s) => (
                    <button
                      key={s}
                      className={`${styles.pill} ${statusFilter === s ? styles.pillActive : ''}`}
                      onClick={() => sp({ status: s, page: null })}
                    >
                      {s === 'all'
                        ? 'All'
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.toolbarGroup}>
                <Calendar size={13} className={styles.toolbarIcon} />
                <span className={styles.toolbarLabel}>Type</span>
                <div className={styles.pills}>
                  {(
                    [
                      { key: 'all', label: 'All' },
                      { key: 'boat_cruise', label: 'Boat' },
                      { key: 'beach_house', label: 'Beach House' },
                      { key: 'transport', label: 'Transport' },
                    ] as { key: TypeFilter; label: string }[]
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      className={`${styles.pill} ${typeFilter === key ? styles.pillActive : ''}`}
                      onClick={() => sp({ type: key, page: null })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          {!isLoading && !error && bookings.length > 0 && (
            <div className={styles.sectionDivider}>
              <div className={styles.dividerLine} />
              <span className={styles.dividerLabel}>
                {filtered.length > PAGE_SIZE
                  ? `${pageStart}–${pageEnd} of ${filtered.length} bookings`
                  : `${filtered.length} ${filtered.length === 1 ? 'booking' : 'bookings'}`}
              </span>
              <div className={styles.dividerLine} />
            </div>
          )}

          {!isLoading && filtered.length === 0 && !error && (
            <p className={styles.emptyMsg}>No bookings found.</p>
          )}

          {/* Booking rows */}
          {!isLoading && filtered.length > 0 && (
            <div className={styles.bookingList}>
              {paginated.map((b) => {
                const isExpanded = expandedId === b.id;
                const resourceName = b.boat?.name ?? b.beach_house?.name ?? '—';
                return (
                  <div
                    key={b.id}
                    id={`booking-row-${b.id}`}
                    className={`${styles.bookingRow} ${isExpanded ? styles.bookingRowExpanded : ''}`}
                  >
                    {/* Summary row */}
                    <div
                      className={styles.rowSummary}
                      onClick={() => sp({ open: isExpanded ? null : b.id })}
                    >
                      <div className={styles.rowLeft}>
                        <div className={styles.typeIconWrap}>
                          <TypeIcon type={b.booking_type} />
                        </div>
                        <div className={styles.rowMain}>
                          <span className={styles.refCode}>
                            {b.reference_code}
                          </span>
                          <span className={styles.resourceName}>
                            {resourceName}
                          </span>
                          {b.booking_type === 'transport' && (
                            <span className={styles.transportPill}>
                              <Truck size={10} />
                              {b.transport_type
                                ? b.transport_type.replace('_', ' ')
                                : 'transport'}
                              {b.parent_beach_house_booking_id &&
                              b.parent_booking?.reference_code
                                ? ` · linked to ${b.parent_booking.reference_code}`
                                : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.rowMid}>
                        <span className={styles.customerName}>
                          {b.customer_name}
                        </span>
                        <span className={styles.dateRange}>
                          {formatDate(b.start_date)}
                          {b.start_date !== b.end_date
                            ? ` → ${formatDate(b.end_date)}`
                            : ''}
                          {b.booking_type === 'boat_cruise' && b.hours
                            ? ` · ${b.hours}hr${b.hours !== 1 ? 's' : ''}`
                            : ''}
                        </span>
                      </div>
                      <div className={styles.rowRight}>
                        <span className={styles.amount}>
                          {formatPrice(b.total_amount)}
                        </span>
                        <StatusBadge status={b.status} />
                        <PaymentBadge status={b.payment_status} />
                        <button
                          className={styles.expandBtn}
                          aria-label="Expand"
                        >
                          {isExpanded ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          className={styles.rowDetail}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className={styles.detailGrid}>
                            <div className={styles.detailBlock}>
                              <p className={styles.detailLabel}>Customer</p>
                              <p className={styles.detailValue}>
                                {b.customer_name}
                              </p>
                              <p className={styles.detailSub}>
                                <Mail size={12} />
                                {b.customer_email}
                              </p>
                              {b.customer_phone && (
                                <p className={styles.detailSub}>
                                  <Phone size={12} />
                                  {b.customer_phone}
                                </p>
                              )}
                            </div>
                            <div className={styles.detailBlock}>
                              <p className={styles.detailLabel}>Listing</p>
                              <p className={styles.detailValue}>
                                {resourceName}
                              </p>
                              <p className={styles.detailSub}>
                                {b.booking_type === 'boat_cruise'
                                  ? 'Boat Cruise'
                                  : b.booking_type === 'beach_house'
                                    ? 'Beach House'
                                    : 'Transport'}
                                {b.transport_type &&
                                  ` · ${b.transport_type.replace('_', ' ')}`}
                              </p>
                              {b.booking_type === 'transport' &&
                                b.transport_route && (
                                  <p className={styles.detailSub}>
                                    {b.transport_route.from_location?.name ??
                                      '—'}
                                    {' → '}
                                    {b.transport_route.to_location?.name ?? '—'}
                                  </p>
                                )}
                            </div>
                            <div className={styles.detailBlock}>
                              <p className={styles.detailLabel}>Dates</p>
                              {b.booking_type === 'transport' &&
                              b.transport_type === 'round_trip' ? (
                                <>
                                  <p className={styles.detailValue}>Outbound</p>
                                  <p className={styles.detailSub}>
                                    {formatDate(b.start_date)}
                                    {formatTime12(b.start_time)
                                      ? `, ${formatTime12(b.start_time)}`
                                      : ''}
                                  </p>
                                  {b.start_time &&
                                    b.transport_route?.duration_hours && (
                                      <p className={styles.detailSub}>
                                        Arrives:{' '}
                                        {formatTime12(
                                          computeEndTime(
                                            b.start_time,
                                            b.transport_route.duration_hours,
                                          ),
                                        )}
                                      </p>
                                    )}
                                  <p
                                    className={styles.detailValue}
                                    style={{ marginTop: '0.6rem' }}
                                  >
                                    Return
                                  </p>
                                  <p className={styles.detailSub}>
                                    {formatDate(b.end_date)}
                                    {formatTime12(b.end_time)
                                      ? `, ${formatTime12(b.end_time)}`
                                      : ''}
                                  </p>
                                  {b.end_time &&
                                    b.transport_route?.duration_hours && (
                                      <p className={styles.detailSub}>
                                        Arrives:{' '}
                                        {formatTime12(
                                          computeEndTime(
                                            b.end_time,
                                            b.transport_route.duration_hours,
                                          ),
                                        )}
                                      </p>
                                    )}
                                </>
                              ) : b.booking_type === 'transport' ? (
                                <>
                                  <p className={styles.detailValue}>
                                    {formatDate(b.start_date)}
                                    {formatTime12(b.start_time)
                                      ? `, ${formatTime12(b.start_time)}`
                                      : ''}
                                  </p>
                                  {b.start_time &&
                                    b.transport_route?.duration_hours && (
                                      <p className={styles.detailSub}>
                                        Arrives:{' '}
                                        {formatTime12(
                                          computeEndTime(
                                            b.start_time,
                                            b.transport_route.duration_hours,
                                          ),
                                        )}
                                      </p>
                                    )}
                                </>
                              ) : (
                                <>
                                  <p className={styles.detailValue}>
                                    {formatDate(b.start_date)}
                                  </p>
                                  {b.start_date !== b.end_date && (
                                    <p className={styles.detailSub}>
                                      → {formatDate(b.end_date)}
                                    </p>
                                  )}
                                  {b.start_time && (
                                    <p className={styles.detailSub}>
                                      {formatTime12(b.start_time)}
                                      {b.end_time
                                        ? ` – ${formatTime12(b.end_time)}`
                                        : ''}
                                    </p>
                                  )}
                                  {b.booking_type === 'boat_cruise' &&
                                    b.hours && (
                                      <p className={styles.detailSub}>
                                        {b.hours} hr{b.hours !== 1 ? 's' : ''}
                                      </p>
                                    )}
                                </>
                              )}
                            </div>
                            {b.booking_type === 'boat_cruise' && (
                              <div className={styles.detailBlock}>
                                <p className={styles.detailLabel}>Duration</p>
                                {b.hours ? (
                                  <p className={styles.detailValue}>
                                    {b.hours} hr{b.hours !== 1 ? 's' : ''}
                                  </p>
                                ) : (
                                  <p className={styles.detailSub}>—</p>
                                )}
                              </div>
                            )}
                            <div className={styles.detailBlock}>
                              <p className={styles.detailLabel}>Payment</p>
                              <p className={styles.detailValue}>
                                {formatPrice(b.total_amount)}
                              </p>
                              <PaymentBadge status={b.payment_status} />
                              {b.payment_reference && (
                                <p className={styles.detailSub}>
                                  <CreditCard size={12} />
                                  {b.payment_reference}
                                </p>
                              )}
                            </div>
                            <div className={styles.detailBlock}>
                              <p className={styles.detailLabel}>
                                Source / Guests
                              </p>
                              <p className={styles.detailValue}>{b.source}</p>
                              <p className={styles.detailSub}>
                                {b.guest_count} guest
                                {b.guest_count !== 1 ? 's' : ''}
                              </p>
                            </div>
                            {b.parent_booking?.id && (
                              <div className={styles.detailBlock}>
                                <p className={styles.detailLabel}>
                                  Beach House Stay
                                </p>
                                <p className={styles.detailValue}>
                                  <span className={styles.refCode}>
                                    {b.parent_booking.reference_code}
                                  </span>
                                </p>
                                <p className={styles.detailSub}>
                                  {formatDate(b.parent_booking.start_date)}
                                  {b.parent_booking.start_date !==
                                  b.parent_booking.end_date
                                    ? ` → ${formatDate(b.parent_booking.end_date)}`
                                    : ''}
                                </p>
                              </div>
                            )}
                            {b.notes && (
                              <div
                                className={`${styles.detailBlock} ${styles.detailBlockFull}`}
                              >
                                <p className={styles.detailLabel}>Notes</p>
                                <p className={styles.detailValue}>{b.notes}</p>
                              </div>
                            )}
                          </div>

                          {/* Transport sub-bookings linked to this beach house stay */}
                          {b.booking_type === 'beach_house' &&
                            (() => {
                              const transports = bookings.filter(
                                (t) => t.parent_beach_house_booking_id === b.id,
                              );
                              if (!transports.length) return null;
                              return (
                                <div className={styles.transportSection}>
                                  <p className={styles.transportSectionLabel}>
                                    <Anchor size={13} />
                                    Transport booked for this stay
                                  </p>
                                  {transports.map((t) => (
                                    <div
                                      key={t.id}
                                      className={styles.transportLinkRow}
                                    >
                                      <span className={styles.refCode}>
                                        {t.reference_code}
                                      </span>
                                      <span
                                        className={styles.transportLinkBoat}
                                      >
                                        {t.boat?.name ?? '—'}
                                        {t.boat?.boat_type
                                          ? ` · ${t.boat.boat_type}`
                                          : ''}
                                      </span>
                                      <span className={styles.transportLinkDir}>
                                        {t.transport_type
                                          ? t.transport_type.replace('_', ' ')
                                          : '—'}
                                      </span>
                                      {t.transport_type === 'round_trip' ? (
                                        <>
                                          <span
                                            className={styles.transportLinkTime}
                                          >
                                            <Clock size={11} />
                                            Out: {formatDate(t.start_date)}
                                            {t.start_time
                                              ? ` ${t.start_time.slice(0, 5)}`
                                              : ''}
                                          </span>
                                          <span
                                            className={styles.transportLinkTime}
                                          >
                                            <Clock size={11} />
                                            Return: {formatDate(t.end_date)}
                                            {t.end_time
                                              ? ` ${t.end_time.slice(0, 5)}`
                                              : ''}
                                          </span>
                                        </>
                                      ) : (
                                        <span
                                          className={styles.transportLinkTime}
                                        >
                                          <Clock size={11} />
                                          {formatDate(t.start_date)}
                                          {t.start_time
                                            ? ` ${t.start_time.slice(0, 5)}`
                                            : ''}
                                        </span>
                                      )}
                                      <span
                                        className={styles.transportLinkAmount}
                                      >
                                        {formatPrice(t.total_amount)}
                                      </span>
                                      <StatusBadge status={t.status} />
                                      <PaymentBadge status={t.payment_status} />
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                          {/* Quick status actions — hidden for completed bookings */}
                          <div className={styles.detailActions}>
                            {b.status !== 'completed' && (
                              <>
                                <span className={styles.detailActionsLabel}>
                                  Change status:
                                </span>
                                {(
                                  [
                                    'pending',
                                    'confirmed',
                                    'completed',
                                    'cancelled',
                                    'expired',
                                  ] as BookingStatus[]
                                )
                                  .filter((s) => s !== b.status)
                                  .map((s) => (
                                    <button
                                      key={s}
                                      className={`${styles.quickStatusBtn} ${styles[`quickStatus_${s}`]}`}
                                      onClick={() => handleQuickStatus(b, s)}
                                      disabled={isStatusUpdating}
                                    >
                                      {s === 'confirmed' && (
                                        <CheckCircle2 size={13} />
                                      )}
                                      {s === 'cancelled' && (
                                        <XCircle size={13} />
                                      )}
                                      {s === 'pending' && (
                                        <AlertCircle size={13} />
                                      )}
                                      {s === 'expired' && <Clock size={13} />}
                                      {s === 'completed' && <Flag size={13} />}
                                      {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                  ))}
                              </>
                            )}
                            {b.status === 'completed' && (
                              <span className={styles.completedLockedNote}>
                                <Flag size={13} /> This booking is completed and
                                locked.
                              </span>
                            )}
                            <div className={styles.detailActionsRight}>
                              {b.status !== 'completed' && (
                                <button
                                  className={styles.actionBtn}
                                  onClick={() => openEdit(b)}
                                  title="Edit"
                                >
                                  <Pencil size={15} />
                                </button>
                              )}
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                onClick={() => setDeletingBooking(b)}
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => sp({ page: String(Math.max(1, page - 1)) })}
                disabled={safeP === 1}
              >
                ← Prev
              </button>
              <div className={styles.pageNumbers}>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (n) =>
                      n === 1 || n === totalPages || Math.abs(n - safeP) <= 1,
                  )
                  .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                    if (idx > 0 && n - (arr[idx - 1] as number) > 1)
                      acc.push('…');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === '…' ? (
                      <span key={`el-${i}`} className={styles.pageEllipsis}>
                        …
                      </span>
                    ) : (
                      <button
                        key={n}
                        className={`${styles.pageNum} ${safeP === n ? styles.pageNumActive : ''}`}
                        onClick={() => sp({ page: String(n) })}
                      >
                        {n}
                      </button>
                    ),
                  )}
              </div>
              <button
                className={styles.pageBtn}
                onClick={() =>
                  sp({ page: String(Math.min(totalPages, page + 1)) })
                }
                disabled={safeP === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── CUSTOMERS TAB ──────────────────────────────────────────────── */}
      {activeTab === 'customers' && (
        <div className={styles.customerSection}>
          {/* Toolbar */}
          <div className={styles.customerToolbar}>
            <div className={styles.customerToolbarLeft}>
              <div className={styles.toolbarGroup}>
                <ArrowUpDown size={13} className={styles.toolbarIcon} />
                <span className={styles.toolbarLabel}>Sort</span>
                <div className={styles.pills}>
                  {(
                    [
                      { key: 'bookings_desc', label: 'Most Bookings' },
                      { key: 'spent_desc', label: 'Most Spent' },
                      { key: 'recent', label: 'Recent' },
                      { key: 'name_asc', label: 'Name A–Z' },
                      { key: 'name_desc', label: 'Name Z–A' },
                    ] as { key: CustomerSortKey; label: string }[]
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      className={`${styles.pill} ${customerSort === key ? styles.pillActive : ''}`}
                      onClick={() => sp({ csort: key, cpage: null })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.customerToolbarRight}>
              <button
                className={styles.csvBtn}
                onClick={downloadCustomersCSV}
                title="Download CSV"
              >
                <Download size={14} />
                Export CSV
              </button>
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewToggleBtn} ${customerView === 'card' ? styles.viewToggleBtnActive : ''}`}
                  onClick={() => sp({ cview: 'card' })}
                  title="Card view"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  className={`${styles.viewToggleBtn} ${customerView === 'table' ? styles.viewToggleBtnActive : ''}`}
                  onClick={() => sp({ cview: 'table' })}
                  title="Table view"
                >
                  <Table2 size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Divider / count */}
          {filteredCustomers.length > 0 && (
            <div className={styles.sectionDivider}>
              <div className={styles.dividerLine} />
              <span className={styles.dividerLabel}>
                {filteredCustomers.length > CUSTOMER_PAGE_SIZE
                  ? `${customerPageStart}–${customerPageEnd} of ${filteredCustomers.length} customers`
                  : `${filteredCustomers.length} ${filteredCustomers.length === 1 ? 'customer' : 'customers'}`}
              </span>
              <div className={styles.dividerLine} />
            </div>
          )}

          {filteredCustomers.length === 0 && (
            <p className={styles.emptyMsg}>No customers found.</p>
          )}

          {/* ── Card view ─────────────────────────────────────────────── */}
          {filteredCustomers.length > 0 && customerView === 'card' && (
            <div className={styles.customerGrid}>
              {paginatedCustomers.map((c) => (
                <div key={c.id} className={styles.customerCard}>
                  <div className={styles.customerAvatar}>
                    {c.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className={styles.customerInfo}>
                    <p className={styles.customerName}>{c.full_name}</p>
                    <p className={styles.customerDetail}>
                      <Mail size={12} />
                      {c.email}
                    </p>
                    {c.phone && (
                      <p className={styles.customerDetail}>
                        <Phone size={12} />
                        {c.phone}
                      </p>
                    )}
                  </div>
                  <div className={styles.customerStats}>
                    <div className={styles.customerStat}>
                      <span className={styles.customerStatValue}>
                        {c.total_bookings}
                      </span>
                      <span className={styles.customerStatLabel}>bookings</span>
                    </div>
                    <div className={styles.customerStat}>
                      <span className={styles.customerStatValue}>
                        {formatPrice(c.total_spent)}
                      </span>
                      <span className={styles.customerStatLabel}>spent</span>
                    </div>
                  </div>
                  {c.last_booking_at && (
                    <p className={styles.customerLastBooking}>
                      Last booking: {formatDate(c.last_booking_at)}
                    </p>
                  )}
                  {c.marketing_opt_in && (
                    <span className={styles.marketingBadge}>Marketing ✓</span>
                  )}
                  <div className={styles.customerCardActions}>
                    <button
                      className={styles.customerActionBtn}
                      onClick={() => openEditCustomer(c)}
                      title="Edit customer"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className={`${styles.customerActionBtn} ${styles.customerActionBtnDanger}`}
                      onClick={() => setDeletingCustomer(c)}
                      title="Delete customer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Table view ────────────────────────────────────────────── */}
          {filteredCustomers.length > 0 && customerView === 'table' && (
            <div className={styles.customerTableWrap}>
              <table className={styles.customerTable}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th className={styles.thRight}>Bookings</th>
                    <th className={styles.thRight}>Total Spent</th>
                    <th>Last Booking</th>
                    <th>Marketing</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className={styles.tableCustomerName}>
                          <div className={styles.tableAvatar}>
                            {c.full_name
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          {c.full_name}
                        </div>
                      </td>
                      <td className={styles.tdMuted}>{c.email}</td>
                      <td className={styles.tdMuted}>{c.phone || '—'}</td>
                      <td className={styles.tdRight}>{c.total_bookings}</td>
                      <td className={styles.tdRight}>
                        {formatPrice(c.total_spent)}
                      </td>
                      <td className={styles.tdMuted}>
                        {c.last_booking_at
                          ? formatDate(c.last_booking_at)
                          : '—'}
                      </td>
                      <td>
                        {c.marketing_opt_in ? (
                          <span className={styles.marketingBadge}>✓</span>
                        ) : (
                          <span className={styles.tdMuted}>—</span>
                        )}
                      </td>
                      <td>
                        <div className={styles.customerTableActions}>
                          <button
                            className={styles.customerActionBtn}
                            onClick={() => openEditCustomer(c)}
                            title="Edit customer"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className={`${styles.customerActionBtn} ${styles.customerActionBtnDanger}`}
                            onClick={() => setDeletingCustomer(c)}
                            title="Delete customer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {customerTotalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={safeCP === 1}
                onClick={() => sp({ cpage: String(Math.max(1, safeCP - 1)) })}
              >
                ←
              </button>
              {Array.from({ length: customerTotalPages }, (_, i) => i + 1).map(
                (pg) => (
                  <button
                    key={pg}
                    className={`${styles.pageBtn} ${safeCP === pg ? styles.pageBtnActive : ''}`}
                    onClick={() => sp({ cpage: String(pg) })}
                  >
                    {pg}
                  </button>
                ),
              )}
              <button
                className={styles.pageBtn}
                disabled={safeCP === customerTotalPages}
                onClick={() =>
                  sp({
                    cpage: String(Math.min(customerTotalPages, safeCP + 1)),
                  })
                }
              >
                →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── CREATE MODAL ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isCreateBusy &&
              e.target === e.currentTarget &&
              setShowCreate(false)
            }
          >
            <motion.div className={styles.modal} {...modalAnim}>
              {isCreateBusy && (
                <div className={styles.modalBusyOverlay}>
                  <div className={styles.busySpinner} />
                  <p className={styles.busyLabel}>
                    {isCreating ? 'Creating booking…' : 'Saving…'}
                  </p>
                </div>
              )}
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>New Booking</h2>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setShowCreate(false)}
                    disabled={isCreateBusy}
                  >
                    <X />
                  </button>
                </div>
                <form
                  className={styles.modalForm}
                  onSubmit={createHandleSubmit(handleCreateSubmit)}
                >
                  <BookingFormFields
                    formActions={createFormActions}
                    disabled={isCreateBusy}
                    boats={boats ?? []}
                    beachHouses={beachHouses ?? []}
                    watchType={watchCreateType}
                    watchTransportType={watchCreateTransportType ?? ''}
                    watchStatus={watchCreateStatus ?? 'pending'}
                    watchBoatId={watchCreateBoatId ?? ''}
                    watchParentBookingId={watchCreateParentBookingId ?? ''}
                    watchBeachHouseId={watchCreateBeachHouseId ?? ''}
                    watchPickupLocation={watchCreatePickupLocation ?? ''}
                    transportRoutes={transportRoutes ?? []}
                    watchTransportRouteId={watchCreateTransportRouteId}
                    bookings={bookings ?? []}
                    computedTotal={createComputedTotal}
                    availabilityState={createAvailability}
                    watchHours={watchCreateHours}
                    watchReturnPickupTime={watchCreateReturnPickupTime}
                  />
                  {createSubmitError && (
                    <p className={styles.submitError}>{createSubmitError}</p>
                  )}
                  <div className={styles.modalActions}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setShowCreate(false)}
                      disabled={isCreateBusy}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={
                        isCreateBusy ||
                        createAvailability.status === 'unavailable' ||
                        createAvailability.status === 'curfew'
                      }
                    >
                      {isCreating ? 'Creating…' : 'Create Booking'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EDIT MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingBooking && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isEditBusy &&
              e.target === e.currentTarget &&
              setEditingBooking(null)
            }
          >
            <motion.div className={styles.modal} {...modalAnim}>
              {isEditBusy && (
                <div className={styles.modalBusyOverlay}>
                  <div className={styles.busySpinner} />
                  <p className={styles.busyLabel}>
                    {isUpdating ? 'Saving…' : 'Saving…'}
                  </p>
                </div>
              )}
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <div>
                    <h2 className={styles.modalTitle}>Edit Booking</h2>
                    <p className={styles.modalSubtitle}>
                      {editingBooking.reference_code}
                    </p>
                  </div>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setEditingBooking(null)}
                    disabled={isEditBusy}
                  >
                    <X />
                  </button>
                </div>
                <form
                  className={styles.modalForm}
                  onSubmit={editHandleSubmit(handleEditSubmit)}
                >
                  <BookingFormFields
                    formActions={editFormActions}
                    disabled={isEditBusy}
                    boats={boats ?? []}
                    beachHouses={beachHouses ?? []}
                    watchType={watchEditType}
                    watchTransportType={watchEditTransportType ?? ''}
                    watchStatus={watchEditStatus ?? 'pending'}
                    watchBoatId={watchEditBoatId ?? ''}
                    watchParentBookingId={watchEditParentBookingId ?? ''}
                    watchBeachHouseId={watchEditBeachHouseId ?? ''}
                    watchPickupLocation={watchEditPickupLocation ?? ''}
                    transportRoutes={transportRoutes ?? []}
                    watchTransportRouteId={watchEditTransportRouteId}
                    bookings={bookings ?? []}
                    computedTotal={editComputedTotal}
                    availabilityState={editAvailability}
                    watchHours={watchEditHours}
                    watchReturnPickupTime={watchEditReturnPickupTime}
                  />
                  {editSubmitError && (
                    <p className={styles.submitError}>{editSubmitError}</p>
                  )}
                  <div className={styles.modalActions}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setEditingBooking(null)}
                      disabled={isEditBusy}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={
                        isEditBusy ||
                        editAvailability.status === 'unavailable' ||
                        editAvailability.status === 'curfew'
                      }
                    >
                      {isUpdating ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DELETE CONFIRM ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {deletingBooking && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              e.target === e.currentTarget && setDeletingBooking(null)
            }
          >
            <motion.div
              className={`${styles.modal} ${styles.confirmModal}`}
              {...modalAnim}
            >
              <div className={styles.modalBody}>
                <div className={styles.confirmIcon}>
                  <AlertTriangle />
                </div>
                <h2 className={styles.confirmTitle}>Delete Booking?</h2>
                <p className={styles.confirmText}>
                  Are you sure you want to permanently delete booking{' '}
                  <strong>{deletingBooking.reference_code}</strong> for{' '}
                  <strong>{deletingBooking.customer_name}</strong>? This cannot
                  be undone.
                </p>
                <div className={styles.confirmActions}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setDeletingBooking(null)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() =>
                      remove(
                        {
                          id: deletingBooking.id,
                          label: deletingBooking.customer_name,
                        },
                        {
                          onSuccess: () => setDeletingBooking(null),
                        },
                      )
                    }
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EDIT CUSTOMER MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {editingCustomer && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isSavingCustomer &&
              e.target === e.currentTarget &&
              setEditingCustomer(null)
            }
          >
            <motion.div className={styles.modal} {...modalAnim}>
              {isSavingCustomer && (
                <div className={styles.modalBusyOverlay}>
                  <div className={styles.busySpinner} />
                  <p className={styles.busyLabel}>Saving…</p>
                </div>
              )}
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <div>
                    <h2 className={styles.modalTitle}>Edit Customer</h2>
                    <p className={styles.modalSubtitle}>
                      {editingCustomer.email}
                    </p>
                  </div>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setEditingCustomer(null)}
                    disabled={isSavingCustomer}
                  >
                    <X />
                  </button>
                </div>
                <form
                  className={styles.modalForm}
                  onSubmit={customerHandleSubmit((data) => {
                    setCustomerEditError(null);
                    saveCustomer({ id: editingCustomer.id, input: data });
                  })}
                >
                  <p className={styles.formSectionLabel}>Customer Details</p>
                  <div className={styles.formRow}>
                    <FormInput
                      id="full_name"
                      label="Full Name"
                      formActions={customerFormActions}
                      disabled={isSavingCustomer}
                      validation={{ required: 'Required' }}
                    />
                    <FormInput
                      id="email"
                      type="email"
                      label="Email"
                      formActions={customerFormActions}
                      disabled={isSavingCustomer}
                      validation={{ required: 'Required' }}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <FormInput
                      id="phone"
                      type="tel"
                      label="Phone"
                      formActions={customerFormActions}
                      disabled={isSavingCustomer}
                      required={false}
                    />
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Marketing opt-in
                      </label>
                      <label className={styles.toggleLabel}>
                        <input
                          type="checkbox"
                          className={styles.toggleCheckbox}
                          {...customerReg('marketing_opt_in')}
                          disabled={isSavingCustomer}
                        />
                        <span className={styles.toggleText}>
                          Customer agreed to marketing communications
                        </span>
                      </label>
                    </div>{' '}
                  </div>
                  {customerEditError && (
                    <p className={styles.submitError}>{customerEditError}</p>
                  )}
                  <div className={styles.modalActions}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setEditingCustomer(null)}
                      disabled={isSavingCustomer}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={isSavingCustomer}
                    >
                      {isSavingCustomer ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DELETE CUSTOMER CONFIRM ────────────────────────────────────── */}
      <AnimatePresence>
        {deletingCustomer && (
          <motion.div
            className={styles.backdrop}
            {...backdropAnim}
            onClick={(e) =>
              !isDeletingCustomer &&
              e.target === e.currentTarget &&
              setDeletingCustomer(null)
            }
          >
            <motion.div
              className={`${styles.modal} ${styles.confirmModal}`}
              {...modalAnim}
            >
              <div className={styles.modalBody}>
                <div className={styles.confirmIcon}>
                  <AlertTriangle />
                </div>
                <h2 className={styles.confirmTitle}>Delete Customer?</h2>
                <p className={styles.confirmText}>
                  Are you sure you want to permanently delete{' '}
                  <strong>{deletingCustomer.full_name}</strong> and all their
                  data? This cannot be undone.
                </p>
                <div className={styles.confirmActions}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setDeletingCustomer(null)}
                    disabled={isDeletingCustomer}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() =>
                      removeCustomer({
                        id: deletingCustomer.id,
                        label: deletingCustomer.full_name,
                      })
                    }
                    disabled={isDeletingCustomer}
                  >
                    {isDeletingCustomer ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BookingsHome;
