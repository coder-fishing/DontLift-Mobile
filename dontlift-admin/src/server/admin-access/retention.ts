export function addUtcCalendarYears(value: Date, years: number): Date {
  if (!Number.isInteger(years) || years < 0) throw new RangeError("years must be a non-negative integer.");
  const year = value.getUTCFullYear() + years;
  const month = value.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(value.getUTCDate(), lastDay);
  return new Date(Date.UTC(
    year,
    month,
    day,
    value.getUTCHours(),
    value.getUTCMinutes(),
    value.getUTCSeconds(),
    value.getUTCMilliseconds(),
  ));
}

export function retentionDeadline(lastEventAt: Date): Date {
  return addUtcCalendarYears(lastEventAt, 1);
}
