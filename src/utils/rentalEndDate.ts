/** Calendar date after the route occupancy (including the docking buffer). */
export function rentalEndDate(
  startDate: string,
  startTime: string,
  durationHours: number | null,
  rentalType: string,
): string {
  if (!startDate || !startTime || !durationHours) return startDate;
  const [hours, minutes] = startTime.split(':').map(Number);
  const legs = rentalType === 'round_trip' ? 2 : 1;
  const days = Math.floor((hours * 60 + minutes + Math.round((durationHours * legs + 1) * 60)) / 1440);
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
