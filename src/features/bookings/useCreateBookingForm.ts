import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import type { Booking, BookingStatus, BookingType } from '../../services/apiBooking';
import { findRoutePrice } from '../../services/apiTransport';
import type { TransportRoute } from '../../services/apiTransport';
import { useCreateBooking } from './useCreateBooking';
import { useAvailabilityCheck } from './useAvailabilityCheck';
import type { AvailabilityParams, AvailabilityState } from './useAvailabilityCheck';
import {
  type BookingBeachHouseOption,
  type BookingBoatOption,
  type BookingFields,
  boatAvailabilityEndTime,
  clampHours,
  computeEndTime,
  derivePaymentStatus,
  findRouteDuration,
  parseBookingError,
  subtractTime,
  timeToMinutes,
  transportEndTime,
} from './bookingsHome.shared';

interface UseCreateBookingFormArgs {
  bookings: Booking[];
  boats: BookingBoatOption[];
  beachHouses: BookingBeachHouseOption[];
  locations: { id: string; name: string }[];
  transportRoutes: TransportRoute[];
  curfewTime: string | null;
}

export function useCreateBookingForm({
  bookings,
  boats,
  beachHouses,
  locations,
  transportRoutes,
  curfewTime,
}: UseCreateBookingFormArgs) {
  const queryClient = useQueryClient();
  const { create, isPending: isCreating } = useCreateBooking();
  const [showCreate, setShowCreate] = useState(false);
  const [isCreateBusy, setIsCreateBusy] = useState(false);
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<BookingFields>({
    defaultValues: {
      booking_type: 'boat_cruise',
      beach_house_booking_mode: 'overnight',
      status: 'pending',
      payment_status: 'pending',
      hours: 1,
      guest_count: 1,
      late_checkout_hours: 0,
    },
  });

  const formActions = { register, errors };
  const watchType = watch('booking_type') as BookingType;
  const watchBeachHouseBookingMode =
    watch('beach_house_booking_mode') ?? 'overnight';
  const watchTransportType = watch('rental_type') as string;
  const watchStatus = watch('status') as BookingStatus;
  const watchBoatId = watch('boat_id') ?? '';
  const watchBeachHouseId = watch('beach_house_id') ?? '';
  const watchParentBookingId = watch('parent_beach_house_booking_id') ?? '';
  const watchHours = Number(watch('hours')) || 0;
  const watchStartDate = watch('start_date');
  const watchEndDate = watch('end_date');
  const watchStartTime = watch('start_time');
  const watchPickupLocation = watch('pickup_location') ?? '';
  const watchDropoffLocation = watch('dropoff_location') ?? '';
  const watchTransportRouteId = watch('rental_route_id') ?? '';
  const watchReturnPickupTime = watch('return_pickup_time') ?? '';
  const watchLateCheckoutHours = Number(watch('late_checkout_hours')) || 0;
  const watchGuestCount = Number(watch('guest_count')) || 0;
  const watchEndTime = watch('end_time') ?? '';
  const selectedBeachHouse =
    watchType === 'beach_house'
      ? (beachHouses.find((h) => h.id === watchBeachHouseId) ?? null)
      : null;
  const effectiveDayUseHours =
    watchType === 'beach_house' &&
    watchBeachHouseBookingMode === 'day_use' &&
    selectedBeachHouse
      ? clampHours(
          watchHours,
          selectedBeachHouse.day_use_min_hours ?? 1,
          selectedBeachHouse.day_use_max_hours ?? Number.POSITIVE_INFINITY,
        )
      : watchHours;

  const computedTotal = useMemo(() => {
    if (watchType === 'boat_cruise') {
      const boat = boats.find((b) => b.id === watchBoatId);
      return boat?.price_per_hour && watchHours > 0
        ? boat.price_per_hour * watchHours
        : null;
    }
    if (watchType === 'beach_house') {
      const house = beachHouses.find((h) => h.id === watchBeachHouseId);
      const totalGuests = watchGuestCount + 1;
      const extraGuests =
        house?.max_guests != null ? Math.max(0, totalGuests - house.max_guests) : 0;
      const extraGuestCharge = extraGuests * (house?.extra_guest_fee_per_head ?? 0);
      if (
        watchBeachHouseBookingMode === 'day_use' &&
        house?.day_use_price_per_hour &&
        effectiveDayUseHours > 0
      ) {
        return house.day_use_price_per_hour * effectiveDayUseHours + extraGuestCharge;
      }
      if (house?.price_per_night && watchStartDate && watchEndDate) {
        const nights = Math.round(
          (new Date(watchEndDate).getTime() - new Date(watchStartDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (nights > 0) {
          return (
            house.price_per_night * nights +
            (house.late_checkout_price_per_hour ?? 0) * watchLateCheckoutHours +
            extraGuestCharge
          );
        }
      }
      return null;
    }
    if (watchType === 'boat_rental') {
      if (watchParentBookingId) {
        const stay = bookings.find((b) => b.id === watchParentBookingId);
        const house = beachHouses.find((h) => h.id === stay?.beach_house_id);
        if (house?.rental_price) {
          return house.rental_price * (watchTransportType === 'round_trip' ? 2 : 1);
        }
      }
      if (watchPickupLocation && watchDropoffLocation) {
        const routePrice = findRoutePrice(
          transportRoutes,
          watchPickupLocation,
          watchDropoffLocation,
        );
        const tripMultiplier = watchTransportType === 'round_trip' ? 2 : 1;
        return routePrice !== null ? routePrice * tripMultiplier : null;
      }
    }
    return null;
  }, [
    beachHouses,
    bookings,
    boats,
    transportRoutes,
    watchBeachHouseId,
    watchBeachHouseBookingMode,
    watchDropoffLocation,
    watchEndDate,
    watchGuestCount,
    watchHours,
    effectiveDayUseHours,
    watchLateCheckoutHours,
    watchParentBookingId,
    watchPickupLocation,
    watchStartDate,
    watchTransportType,
    watchType,
    watchBoatId,
  ]);

  useEffect(() => {
    if (computedTotal !== null) setValue('total_amount', computedTotal);
  }, [computedTotal, setValue]);

  useEffect(() => {
    if (watchType !== 'beach_house') return;
    if (!selectedBeachHouse) return;

    if (watchBeachHouseBookingMode === 'day_use') {
      const normalizedHours = clampHours(
        watchHours,
        selectedBeachHouse.day_use_min_hours ?? 1,
        selectedBeachHouse.day_use_max_hours ?? Number.POSITIVE_INFINITY,
      );
      if (watchStartDate) setValue('end_date', watchStartDate);
      setValue('late_checkout_hours', 0);
      setValue(
        'end_time',
        watchStartTime && normalizedHours > 0
          ? computeEndTime(watchStartTime, normalizedHours)
          : '',
      );
      return;
    }

    if (!watchStartTime && selectedBeachHouse.check_in_time) {
      setValue('start_time', selectedBeachHouse.check_in_time);
    }
    setValue(
      'end_time',
      selectedBeachHouse.check_out_time
        ? computeEndTime(selectedBeachHouse.check_out_time, watchLateCheckoutHours)
        : '',
    );
  }, [
    selectedBeachHouse,
    setValue,
    watchBeachHouseBookingMode,
    watchHours,
    watchLateCheckoutHours,
    watchStartDate,
    watchStartTime,
    watchType,
  ]);

  useEffect(() => {
    if (
      watchType !== 'beach_house' ||
      watchBeachHouseBookingMode !== 'day_use' ||
      !selectedBeachHouse
    ) {
      return;
    }

    const minHours = selectedBeachHouse.day_use_min_hours ?? 1;
    const maxHours = selectedBeachHouse.day_use_max_hours ?? Number.POSITIVE_INFINITY;

    if (watchHours <= 0 || watchHours < minHours || watchHours > maxHours) {
      setValue('hours', clampHours(watchHours || minHours, minHours, maxHours));
    }
  }, [
    selectedBeachHouse,
    setValue,
    watchBeachHouseBookingMode,
    watchBeachHouseId,
    watchType,
  ]);

  useEffect(() => {
    if (watchType !== 'boat_cruise' || !watchBoatId) return;
    const boat = boats.find((b) => b.id === watchBoatId);
    if (!boat) return;
    const min = boat.min_booking_hours ?? 1;
    const max = boat.max_booking_hours ?? Infinity;
    if (watchHours < min) setValue('hours', min);
    else if (watchHours > max) setValue('hours', max);
  }, [boats, setValue, watchBoatId, watchHours, watchType]);

  useEffect(() => {
    if (watchType !== 'boat_rental' || !watchTransportRouteId) return;
    const route = transportRoutes.find((r) => r.id === watchTransportRouteId);
    if (!route) return;
    setValue('pickup_location', route.from_location?.name ?? '');
    setValue('dropoff_location', route.to_location?.name ?? '');
  }, [setValue, transportRoutes, watchTransportRouteId, watchType]);

  useEffect(() => {
    if (watchType !== 'boat_rental' || !watchParentBookingId) return;
    const stay = bookings.find((b) => b.id === watchParentBookingId);
    if (stay?.start_date) setValue('start_date', stay.start_date);
    if (watchTransportType === 'round_trip' && stay?.end_date) {
      setValue('end_date', stay.end_date);
    } else {
      setValue('end_date', stay?.start_date ?? '');
    }
    const house = beachHouses.find((h) => h.id === stay?.beach_house_id);
    if (house?.location) setValue('dropoff_location', house.location);
  }, [
    beachHouses,
    bookings,
    locations,
    setValue,
    watchParentBookingId,
    watchTransportType,
    watchType,
  ]);

  useEffect(() => {
    if (watchType !== 'boat_rental' || !watchParentBookingId) return;
    const stay = bookings.find((b) => b.id === watchParentBookingId);
    const house = beachHouses.find((h) => h.id === stay?.beach_house_id);
    const dur = findRouteDuration(transportRoutes, watchTransportRouteId);
    const pickupAnchorTime = stay?.start_time ?? house?.check_in_time ?? null;
    const returnAnchorTime = stay?.end_time ?? house?.check_out_time ?? null;
    setValue(
      'start_time',
      pickupAnchorTime && dur ? subtractTime(pickupAnchorTime, dur) : '',
    );
    setValue('end_time', watchReturnPickupTime || returnAnchorTime || '');
  }, [
    beachHouses,
    bookings,
    setValue,
    transportRoutes,
    watchParentBookingId,
    watchReturnPickupTime,
    watchTransportRouteId,
    watchType,
  ]);

  const availabilityParams = useMemo((): AvailabilityParams | null => {
    if (watchType === 'beach_house' && watchBeachHouseId && watchStartDate && watchEndDate) {
      return {
        resourceType: 'beach_house',
        resourceId: watchBeachHouseId,
        startDate: watchStartDate,
        endDate: watchEndDate,
        startTime: watchStartTime || null,
        endTime: watchEndTime || null,
      };
    }
    if (watchType === 'boat_cruise' && watchBoatId && watchStartDate) {
      return {
        resourceType: 'boat',
        resourceId: watchBoatId,
        startDate: watchStartDate,
        endDate: watchStartDate,
        startTime: watchStartTime || null,
        endTime:
          watchStartTime && watchHours > 0
            ? boatAvailabilityEndTime(watchStartTime, watchHours)
            : null,
      };
    }
    if (
      watchType === 'boat_rental' &&
      watchBoatId &&
      watchStartDate &&
      watchStartTime &&
      watchTransportRouteId
    ) {
      if (watchParentBookingId && watchEndDate && watchEndTime) {
        return {
          resourceType: 'boat',
          resourceId: watchBoatId,
          startDate: watchStartDate,
          endDate: watchEndDate,
          startTime: watchStartTime,
          endTime: watchEndTime,
        };
      }
      const dur = findRouteDuration(transportRoutes, watchTransportRouteId);
      return {
        resourceType: 'boat',
        resourceId: watchBoatId,
        startDate: watchStartDate,
        endDate: watchStartDate,
        startTime: watchStartTime,
        endTime: dur
          ? transportEndTime(watchStartTime, dur, watchTransportType)
          : null,
      };
    }
    return null;
  }, [
    transportRoutes,
    watchBeachHouseId,
    watchBoatId,
    watchEndDate,
    watchEndTime,
    watchHours,
    watchStartDate,
    watchStartTime,
    watchTransportRouteId,
    watchTransportType,
    watchType,
  ]);

  const availability: AvailabilityState = useAvailabilityCheck(availabilityParams);

  function openCreate() {
    reset({
      booking_type: 'boat_cruise',
      beach_house_booking_mode: 'overnight',
      status: 'pending',
      payment_status: 'pending',
      hours: 1,
      guest_count: 1,
      late_checkout_hours: 0,
    });
    setCreateSubmitError(null);
    setShowCreate(true);
  }

  function closeCreate() {
    if (isCreateBusy) return;
    setShowCreate(false);
  }

  function submit(data: BookingFields) {
    setCreateSubmitError(null);
    const today = new Date().toLocaleDateString('en-CA');

    if (data.start_date < today) {
      setCreateSubmitError('Bookings can only be created for today or a future date.');
      return;
    }

    if (data.end_date && data.end_date < today) {
      setCreateSubmitError('Bookings can only be created for today or a future date.');
      return;
    }

    if (data.booking_type === 'beach_house') {
      if (data.beach_house_booking_mode === 'day_use') {
        if (!data.start_time || Number(data.hours) <= 0) {
          setCreateSubmitError(
            'Day-use bookings require a check-in time and a valid number of hours.',
          );
          return;
        }
      } else {
        if (!data.end_date || data.end_date <= data.start_date) {
          setCreateSubmitError(
            'Overnight bookings must have a check-out date after the check-in date.',
          );
          return;
        }
      }
    }
    if (
      data.booking_type === 'boat_rental' &&
      data.rental_type === 'round_trip' &&
      data.end_date &&
      data.end_date < data.start_date
    ) {
      setCreateSubmitError(
        'Round-trip rental must have a return date on or after the outbound date.',
      );
      return;
    }
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
    if (
      data.booking_type === 'boat_rental' &&
      data.start_date === data.end_date &&
      data.start_time &&
      data.end_time &&
      timeToMinutes(data.end_time) <= timeToMinutes(data.start_time)
    ) {
      setCreateSubmitError(
        'Return time must be later than pickup time for a same-day rental.',
      );
      return;
    }

    setIsCreateBusy(true);
    create(
      {
        booking_type: data.booking_type,
        boat_id: data.boat_id || null,
        beach_house_id: data.beach_house_id || null,
        beach_house_booking_mode:
          data.booking_type === 'beach_house'
            ? data.beach_house_booking_mode || 'overnight'
            : null,
        parent_beach_house_booking_id: data.parent_beach_house_booking_id || null,
        rental_type: (data.rental_type as never) || null,
        rental_route_id:
          data.booking_type === 'boat_rental' ? data.rental_route_id || null : null,
        pickup_location: data.pickup_location || null,
        dropoff_location: data.dropoff_location || null,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone || '',
        guest_count: Number(data.guest_count) || 1,
        start_date: data.start_date,
        end_date:
          data.booking_type === 'boat_cruise'
            ? data.start_date
            : data.booking_type === 'beach_house' &&
                data.beach_house_booking_mode === 'day_use'
              ? data.start_date
            : data.booking_type === 'boat_rental'
              ? data.rental_type === 'round_trip' && data.end_date
                ? data.end_date
                : data.start_date
              : data.end_date,
        start_time: data.start_time || null,
        end_time: (() => {
          if (data.booking_type === 'boat_cruise' && data.start_time && Number(data.hours) > 0) {
            return computeEndTime(data.start_time, Number(data.hours));
          }
          if (data.booking_type === 'beach_house') {
            if (
              data.beach_house_booking_mode === 'day_use' &&
              data.start_time &&
              Number(data.hours) > 0
            ) {
              return computeEndTime(data.start_time, Number(data.hours));
            }
            return data.end_time || null;
          }
          if (data.booking_type === 'boat_rental' && data.parent_beach_house_booking_id) {
            return data.end_time || null;
          }
          if (data.booking_type === 'boat_rental' && data.start_time && data.rental_route_id) {
            const dur = findRouteDuration(transportRoutes, data.rental_route_id);
            if (dur) {
              return transportEndTime(
                data.start_time,
                dur,
                data.rental_type ?? 'outbound',
              );
            }
          }
          return data.end_time || null;
        })(),
        hours:
          (data.booking_type === 'boat_cruise' ||
            (data.booking_type === 'beach_house' &&
              data.beach_house_booking_mode === 'day_use')) &&
          Number(data.hours) > 0
            ? Number(data.hours)
            : null,
        late_checkout_hours:
          data.booking_type === 'beach_house' &&
          data.beach_house_booking_mode === 'overnight'
            ? Number(data.late_checkout_hours) || 0
            : 0,
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
          reset();
          setIsCreateBusy(false);
        },
        onError: (err) => {
          setCreateSubmitError(parseBookingError(err));
          setIsCreateBusy(false);
        },
      },
    );
  }

  return {
    availability,
    computedTotal,
    createSubmitError,
    formActions,
    handleSubmit,
    isCreateBusy,
    isCreating,
    openCreate,
    closeCreate,
    onSubmit: submit,
    showCreate,
    watchBeachHouseId,
    watchBeachHouseBookingMode,
    watchBoatId,
    watchEndTime,
    watchGuestCount,
    watchHours,
    watchLateCheckoutHours,
    watchStartDate,
    watchParentBookingId,
    watchPickupLocation,
    watchReturnPickupTime,
    watchStatus,
    watchStartTime,
    watchTransportRouteId,
    watchTransportType,
    watchType,
  };
}
