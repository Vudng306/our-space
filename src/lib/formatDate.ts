/**
 * Date formatting for the screen.
 *
 * The locale is fixed rather than taken from the browser: this instance is for
 * two people who share a language, and a phone left on English should not turn
 * half the page into "Apr 12, 1999".
 */
export const LOCALE = "vi-VN";

/** "10/09/2026" — the everyday form. */
export function formatDayShort(dateKey: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

/** "Thứ Năm, 10 tháng 9, 2026" — for a heading that names one day. */
export function formatDay(dateKey: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

/** "tháng 9, 2026" — timeline month headings. */
export function formatMonth(monthKey: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthKey}-01T00:00:00Z`));
}

/** The clock time of an instant, read in the zone it was captured in. */
export function formatTime(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
