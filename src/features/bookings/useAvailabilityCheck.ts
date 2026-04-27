import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { checkAvailability } from '../../services/apiBooking';
import { fetchSettings } from '../../services/apiSettings';

export interface AvailabilityParams {
  resourceType: 'boat' | 'beach_house';
  resourceId: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  excludeBookingId?: string;
}

export type AvailabilityState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'unavailable'; conflictRef?: string; conflictCustomer?: string }
  | { status: 'curfew'; curfewTime: string };

export function useAvailabilityCheck(
  params: AvailabilityParams | null,
): AvailabilityState {
  const enabled = Boolean(
    params &&
    params.resourceId &&
    params.startDate &&
    params.endDate &&
    params.startDate <= params.endDate,
  );

  const { data: settingsData } = useQuery({
    queryKey: ['app_settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60_000,
  });

  // ── Curfew check (client-side, instant) ──────────────────────────────────
  const curfewViolation = useMemo((): string | null => {
    if (!params || params.resourceType !== 'boat') return null;
    const curfew = settingsData?.boat_curfew_time;
    const curfewEnabled = settingsData?.boat_curfew_enabled ?? true;
    if (!curfewEnabled || !curfew) return null;
    // The endTime already includes the 1hr buffer; if it exceeds curfew, block.
    const checkTime = params.endTime ?? params.startTime;
    if (!checkTime) return null;
    const toMins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const checkMins = toMins(checkTime);
    const curfewMins = toMins(curfew);
    const startMins = params.startTime ? toMins(params.startTime) : 0;
    // If end time is earlier in the day than start time, the cruise wraps past midnight
    const effectiveMins =
      checkMins < startMins ? checkMins + 24 * 60 : checkMins;
    return effectiveMins > curfewMins ? curfew : null;
  }, [params, settingsData]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['availability', params],
    queryFn: () => checkAvailability(params!),
    enabled: enabled && !curfewViolation,
    staleTime: 60_000,
    gcTime: 2 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!enabled) return { status: 'idle' };
  if (curfewViolation) return { status: 'curfew', curfewTime: curfewViolation };
  if (isFetching) return { status: 'checking' };
  if (isError || !data) return { status: 'idle' };

  if (data.available) return { status: 'available' };

  return {
    status: 'unavailable',
    conflictRef: data.conflictingBooking?.reference_code,
    conflictCustomer: data.conflictingBooking?.customer_name,
  };
}
