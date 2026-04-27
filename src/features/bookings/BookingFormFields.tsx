import { CheckCircle2, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { Booking, BookingStatus, BookingType } from '../../services/apiBooking';
import type { TransportRoute } from '../../services/apiTransport';
import FormInput from '../../ui/formElements/FormInput';
import { useSettings } from '../settings/useSettings';
import type { AvailabilityState } from './useAvailabilityCheck';
import styles from './BookingsHome.module.css';
import {
  type BeachHouseBookingMode,
  type BookingBeachHouseOption,
  type BookingBoatOption,
  type BookingFields,
  formatTime12,
  latestBoatStartTime,
  subtractTime,
} from './bookingsHome.shared';

interface BookingFormFieldsProps {
  formActions: {
    register: ReturnType<typeof useForm<BookingFields>>['register'];
    errors: ReturnType<typeof useForm<BookingFields>>['formState']['errors'];
  };
  disabled?: boolean;
  boats: BookingBoatOption[];
  beachHouses: BookingBeachHouseOption[];
  watchType: BookingType;
  watchTransportType: string;
  watchStatus: BookingStatus;
  watchBoatId: string;
  watchBeachHouseBookingMode: BeachHouseBookingMode;
  watchParentBookingId: string;
  watchBeachHouseId: string;
  watchPickupLocation: string;
  transportRoutes: TransportRoute[];
  watchTransportRouteId: string;
  bookings: Booking[];
  computedTotal: number | null;
  availabilityState: AvailabilityState;
  watchGuestCount: number;
  watchHours: number;
  watchLateCheckoutHours: number;
  watchStartDate?: string;
  watchStartTime: string;
  watchEndTime: string;
  watchReturnPickupTime: string;
  minBookingDate?: string;
}

export function BookingFormFields({
  formActions,
  disabled,
  boats,
  beachHouses,
  watchType,
  watchTransportType,
  watchStatus,
  watchBoatId,
  watchBeachHouseBookingMode,
  watchParentBookingId,
  watchBeachHouseId,
  watchPickupLocation: _watchPickupLocation,
  transportRoutes,
  watchTransportRouteId,
  bookings,
  computedTotal,
  availabilityState,
  watchGuestCount,
  watchHours,
  watchLateCheckoutHours,
  watchStartDate,
  watchStartTime,
  watchEndTime,
  watchReturnPickupTime,
  minBookingDate,
}: BookingFormFieldsProps) {
  const { settings } = useSettings();
  const curfewTime = settings?.boat_curfew_time ?? null;
  const curfewEnabled = settings?.boat_curfew_enabled ?? true;
  const houseBookings = bookings.filter((b) => b.booking_type === 'beach_house');
  const selectedBoat = boats.find((b) => b.id === watchBoatId);
  const boatMinHours = selectedBoat?.min_booking_hours ?? null;
  const boatMaxHours = selectedBoat?.max_booking_hours ?? null;
  const maxStartTime =
    watchType === 'boat_cruise' && curfewEnabled && curfewTime && watchHours > 0
      ? latestBoatStartTime(curfewTime, watchHours)
      : undefined;
  const routeDuration =
    transportRoutes.find((r) => r.id === watchTransportRouteId)?.duration_hours ??
    null;
  const linkedStay =
    houseBookings.find((b) => b.id === watchParentBookingId) ?? null;
  const linkedHouse = linkedStay
    ? (beachHouses.find((h) => h.id === linkedStay.beach_house_id) ?? null)
    : null;
  const paymentRefRequired = watchStatus === 'confirmed';
  const selectedBeachHouse =
    watchType === 'beach_house'
      ? (beachHouses.find((h) => h.id === watchBeachHouseId) ?? null)
      : null;
  const dayUseMinHours = selectedBeachHouse?.day_use_min_hours ?? null;
  const dayUseMaxHours = selectedBeachHouse?.day_use_max_hours ?? null;
  const lateCheckoutFee = selectedBeachHouse?.late_checkout_price_per_hour ?? null;
  const extraGuestFee = selectedBeachHouse?.extra_guest_fee_per_head ?? null;
  const extraGuestCount =
    watchType === 'beach_house' && selectedBeachHouse?.max_guests != null
      ? Math.max(0, watchGuestCount + 1 - selectedBeachHouse.max_guests)
      : 0;
  const maxGuests =
    watchType === 'boat_cruise' || watchType === 'boat_rental'
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
        <option value="boat_rental">Boat Rental</option>
      </FormInput>

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
            key={`boat-hours-${watchBoatId || 'default'}`}
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
                    {boatMinHours}-{boatMaxHours}
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
          <FormInput
            id="beach_house_booking_mode"
            type="select"
            label="Stay Type"
            formActions={formActions}
            disabled={disabled}
          >
            <option value="overnight">Overnight Stay</option>
            <option value="day_use">Day Use</option>
          </FormInput>
          {watchBeachHouseBookingMode === 'day_use' ? (
            <>
              {selectedBeachHouse?.day_use_price_per_hour != null && (
                <p className={styles.capacityHint}>
                  Day use rate:{' '}
                  <strong>
                    ₦{selectedBeachHouse.day_use_price_per_hour.toLocaleString()}
                  </strong>{' '}
                  / hour
                </p>
              )}
              {(dayUseMinHours !== null || dayUseMaxHours !== null) && (
                <p className={styles.capacityHint}>
                  Allowed day-use duration:{' '}
                  {dayUseMinHours !== null && dayUseMaxHours !== null ? (
                    <>
                      <strong>
                        {dayUseMinHours}-{dayUseMaxHours}
                      </strong>{' '}
                      hrs
                    </>
                  ) : dayUseMinHours !== null ? (
                    <>
                      min <strong>{dayUseMinHours}</strong> hr
                      {dayUseMinHours !== 1 ? 's' : ''}
                    </>
                  ) : (
                    <>
                      max <strong>{dayUseMaxHours}</strong> hrs
                    </>
                  )}
                </p>
              )}
              <FormInput
                key={`day-use-hours-${watchBeachHouseId || 'default'}`}
                id="hours"
                type="number"
                label="Day Use Hours"
                formActions={formActions}
                disabled={disabled}
                required={false}
                min={dayUseMinHours ?? 1}
                max={dayUseMaxHours ?? undefined}
                validation={{
                  min: dayUseMinHours
                    ? {
                        value: dayUseMinHours,
                        message: `Minimum ${dayUseMinHours} hours for day use`,
                      }
                    : { value: 1, message: 'Must be at least 1 hour' },
                  ...(dayUseMaxHours
                    ? {
                        max: {
                          value: dayUseMaxHours,
                          message: `Maximum ${dayUseMaxHours} hours for day use`,
                        },
                      }
                    : {}),
                }}
              />
            </>
          ) : (
            <>
              {selectedBeachHouse?.price_per_night != null && (
                <p className={styles.capacityHint}>
                  Overnight rate:{' '}
                  <strong>
                    ₦{selectedBeachHouse.price_per_night.toLocaleString()}
                  </strong>{' '}
                  / night
                </p>
              )}
              <p className={styles.capacityHint}>
                Overnight stays use the property&apos;s default check-in and
                checkout times. Late checkout, if needed, is billed separately.
              </p>
              {lateCheckoutFee != null && (
                <FormInput
                  id="late_checkout_hours"
                  type="number"
                  label="Late Checkout Extension (hours)"
                  formActions={formActions}
                  disabled={disabled}
                  required={false}
                  min={0}
                />
              )}
              {lateCheckoutFee != null && watchLateCheckoutHours > 0 && (
                <p className={styles.capacityHint}>
                  Late checkout fee:{' '}
                  <strong>
                    ₦
                    {(
                      lateCheckoutFee * watchLateCheckoutHours
                    ).toLocaleString()}
                  </strong>
                </p>
              )}
            </>
          )}
        </>
      )}

      {watchType === 'boat_rental' && (
        <>
          <FormInput
            id="rental_route_id"
            type="select"
            label="Rental Route"
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
                {r.from_location?.name ?? '?'} {'→'} {r.to_location?.name ?? '?'}
                {r.route_price != null
                  ? ` · ₦${r.route_price.toLocaleString()}/route`
                  : ''}
              </option>
            ))}
          </FormInput>

          <input type="hidden" {...formActions.register('pickup_location')} />
          <input type="hidden" {...formActions.register('dropoff_location')} />

          <p className={styles.transportPricingHint}>
            Pricing is a flat <strong>per-route</strong> rate. Round trip doubles the
            selected route price.
          </p>

          {watchTransportRouteId
            ? (() => {
                const selectedRoute = transportRoutes.find(
                  (r) => r.id === watchTransportRouteId,
                );
                const availableBoats = boats.filter(
                  (b) =>
                    b.is_available_for_rental &&
                    b.pickup_location === selectedRoute?.from_location?.name,
                );
                if (availableBoats.length === 0) {
                  return (
                    <p className={styles.noBoatsMsg}>
                      No rental boats depart from{' '}
                      <strong>
                        {selectedRoute?.from_location?.name ?? 'this location'}
                      </strong>
                      . Update a boat&apos;s jetty in the Boats page to enable it.
                    </p>
                  );
                }
                return (
                  <>
                    <FormInput
                      id="boat_id"
                      type="select"
                      label="Rental Boat"
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
                        Rental capacity: <strong>{maxGuests}</strong> passengers
                      </p>
                    )}
                  </>
                );
              })()
            : null}

          <FormInput
            id="rental_type"
            type="select"
            label="Rental Type"
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
              Is this rental for a beach house stay? (optional)
            </p>
            <p className={styles.linkedStayHint}>
              Link this rental to an existing beach house booking to keep
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
              <option value="">No — standalone rental</option>
              {houseBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.reference_code} · {b.customer_name} · {b.start_date}
                  {b.end_date && b.end_date !== b.start_date ? ` - ${b.end_date}` : ''}
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
              ? watchType === 'beach_house'
                ? `Guests (${maxGuests - 1} additional included)`
                : `Guests (max ${maxGuests - 1} additional)`
              : 'Guest Count'
          }
          formActions={formActions}
          disabled={disabled}
          required={false}
          min={0}
          max={
            watchType === 'beach_house'
              ? undefined
              : maxGuests !== null
                ? maxGuests - 1
                : undefined
          }
          validation={
            maxGuests !== null && watchType !== 'beach_house'
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
      {watchType === 'beach_house' && maxGuests !== null && (
        <p className={styles.capacityHint}>
          Included capacity: <strong>{maxGuests}</strong> guests total.
          {extraGuestFee != null
            ? extraGuestCount > 0
              ? ` ${extraGuestCount} extra guest${extraGuestCount !== 1 ? 's' : ''} · surcharge ₦${(
                  extraGuestCount * extraGuestFee
                ).toLocaleString()}`
              : ` Extra guests are billed at ₦${extraGuestFee.toLocaleString()} per head.`
            : ''}
        </p>
      )}

      <div className={styles.formSectionLabel}>Dates &amp; Times</div>

      {watchType === 'boat_cruise' && (
        <div className={styles.formRow}>
          <FormInput
            id="start_date"
            type="date"
            label="Date"
            formActions={formActions}
            disabled={disabled}
            min={minBookingDate}
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

      {watchType === 'beach_house' && (
        <>
          <div className={styles.formRow}>
            <FormInput
              id="start_date"
              type="date"
              label={
                watchBeachHouseBookingMode === 'day_use' ? 'Booking Date' : 'Check-in Date'
              }
              formActions={formActions}
              disabled={disabled}
              min={minBookingDate}
            />
            {watchBeachHouseBookingMode === 'overnight' ? (
              <FormInput
                id="end_date"
                type="date"
                label="Check-out Date"
                formActions={formActions}
                disabled={disabled}
                min={watchStartDate || minBookingDate}
              />
            ) : (
              <FormInput
                id="start_time"
                type="time"
                label="Day Use Check-in Time"
                formActions={formActions}
                disabled={disabled}
                required={false}
              />
            )}
          </div>
          {watchBeachHouseBookingMode === 'overnight' ? (
            <>
              <div className={styles.formRow}>
                <FormInput
                  id="start_time"
                  type="time"
                  label="Check-in Time"
                  formActions={formActions}
                  disabled={disabled}
                  required={false}
                />
                <FormInput
                  id="end_time"
                  type="time"
                  label="Checkout Time"
                  formActions={formActions}
                  disabled
                  required={false}
                />
              </div>
              {selectedBeachHouse?.check_out_time && (
                <p className={styles.capacityHint}>
                  Default check-in:{' '}
                  <strong>
                    {formatTime12(selectedBeachHouse.check_in_time) ?? '—'}
                  </strong>
                  {' · '}
                  Default checkout:{' '}
                  <strong>{formatTime12(selectedBeachHouse.check_out_time)}</strong>
                  {lateCheckoutFee != null
                    ? ` · extension ₦${lateCheckoutFee.toLocaleString()}/hour`
                    : ''}
                </p>
              )}
            </>
          ) : watchHours > 0 ? (
            <p className={styles.capacityHint}>
              Day use checkout:{' '}
              <strong>{formatTime12(watchEndTime || watchStartTime) ?? '—'}</strong>
            </p>
          ) : null}
        </>
      )}

      {watchType === 'boat_rental' &&
        (linkedStay ? (
          <div className={styles.linkedTransportDateBox}>
            <input type="hidden" {...formActions.register('start_date')} />
            <input type="hidden" {...formActions.register('start_time')} />
            {watchTransportType === 'round_trip' && (
              <>
                <input type="hidden" {...formActions.register('end_date')} />
                <input type="hidden" {...formActions.register('end_time')} />
              </>
            )}
            {watchTransportType === 'round_trip' ? (
              <>
                <div className={styles.linkedTransportDateRow}>
                  <span className={styles.linkedTransportDateLabel}>Outbound date</span>
                  <span className={styles.linkedTransportDateValue}>
                    {linkedStay.start_date}
                  </span>
                </div>
                <div className={styles.linkedTransportDateRow}>
                  <span className={styles.linkedTransportDateLabel}>Return date</span>
                  <span className={styles.linkedTransportDateValue}>
                    {linkedStay.end_date}
                  </span>
                </div>
              </>
            ) : (
              <div className={styles.linkedTransportDateRow}>
                <span className={styles.linkedTransportDateLabel}>Transfer date</span>
                <span className={styles.linkedTransportDateValue}>
                  {linkedStay.start_date}
                </span>
              </div>
            )}
            <div className={styles.linkedTransportDateRow}>
              <span className={styles.linkedTransportDateLabel}>Outbound pickup</span>
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
            {watchTransportType === 'round_trip' && (
              <>
                <div className={styles.linkedTransportDateRow}>
                  <span className={styles.linkedTransportDateLabel}>Return pickup</span>
                  <span className={styles.linkedTransportDateValue}>
                    {formatTime12(
                      watchReturnPickupTime || linkedHouse?.check_out_time || null,
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
                    : `Defaults to ${
                        linkedHouse?.check_out_time
                          ? `${formatTime12(linkedHouse.check_out_time)} checkout time`
                          : 'checkout time'
                      } — set a time above to override.`}
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
                label={watchTransportType === 'round_trip' ? 'Outbound Date' : 'Date'}
                formActions={formActions}
                disabled={disabled}
                min={minBookingDate}
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
                  min={watchStartDate || minBookingDate}
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

      {availabilityState.status === 'checking' && (
        <div
          className={`${styles.availabilityBanner} ${styles.availabilityChecking}`}
        >
          <span className={styles.availabilityDot} />
          Checking availability…
        </div>
      )}
      {availabilityState.status === 'available' && (
        <div className={`${styles.availabilityBanner} ${styles.availabilityOk}`}>
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
            {availabilityState.conflictRef ? ` (${availabilityState.conflictRef}` : ''}
            {availabilityState.conflictCustomer
              ? ` · ${availabilityState.conflictCustomer})`
              : availabilityState.conflictRef
                ? ')'
                : ''}
            . Choose different dates.
          </span>
        </div>
      )}
      {curfewEnabled && availabilityState.status === 'curfew' && (
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
