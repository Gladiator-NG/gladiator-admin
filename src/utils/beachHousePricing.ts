export type BeachHouseBookingMode = 'day_use' | 'overnight';

interface BeachHouseRates {
  day_rate?: number | null;
  overnight_rate?: number | null;
}

export function beachHouseStayPrice(
  mode: BeachHouseBookingMode,
  rates: BeachHouseRates,
  nights = 1,
): number | null {
  if (mode === 'day_use') return rates.day_rate ?? null;
  if (nights < 1 || rates.overnight_rate == null) return null;

  const interveningDayBlocks = Math.max(0, nights - 1);
  if (interveningDayBlocks > 0 && rates.day_rate == null) return null;

  return (
    nights * rates.overnight_rate +
    interveningDayBlocks * (rates.day_rate ?? 0)
  );
}
