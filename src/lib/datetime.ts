/**
 * Moments are stored as a UTC instant plus the IANA zone they were captured
 * in. `localDate` is derived from the pair so that "which day was this?"
 * never depends on the server's own clock or the reader's location.
 */

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "YYYY-MM-DD" for an instant, as seen in `timeZone`. */
export function localDateKey(instant: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(instant);
}

/** The same local day, as the UTC-midnight Date that Postgres `date` expects. */
export function localDateValue(instant: Date, timeZone: string): Date {
  return dateFromKey(localDateKey(instant, timeZone));
}

export function dateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Reads a Postgres `date` column back as "YYYY-MM-DD". */
export function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function todayKey(timeZone: string): string {
  return localDateKey(new Date(), timeZone);
}

export function addDaysToKey(key: string, days: number): string {
  const d = dateFromKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return dateKey(d);
}

export function daysBetweenKeys(from: string, to: string): number {
  const a = dateFromKey(from).getTime();
  const b = dateFromKey(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function startOfMonthKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0));
  return dateKey(last);
}

/**
 * Next time an important date comes round, as "YYYY-MM-DD".
 * Yearly events that already passed this year roll to next year; a Feb 29
 * anniversary lands on Mar 1 in a common year rather than disappearing.
 */
export function nextOccurrenceKey(
  eventDateKey: string,
  recurrence: "NONE" | "YEARLY",
  fromKey: string,
): string | null {
  if (recurrence === "NONE") {
    return eventDateKey >= fromKey ? eventDateKey : null;
  }
  const [, month, day] = eventDateKey.split("-").map(Number);
  const fromYear = Number(fromKey.slice(0, 4));

  for (const year of [fromYear, fromYear + 1]) {
    const candidate = normaliseYearly(year, month, day);
    if (candidate >= fromKey) return candidate;
  }
  return normaliseYearly(fromYear + 1, month, day);
}

function normaliseYearly(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls Feb 29 in a common year over to Mar 1, which is what we want.
  return dateKey(d);
}

/** Human "3 days from now" style label, kept plain rather than cute. */
export function relativeDayLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `In ${days} days`;
}
