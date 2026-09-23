export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86_400_000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Treat a YYYY-MM-DD string as a UTC calendar day, so day arithmetic never meets DST. */
function utc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  return new Date(utc(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

export function weekday(iso: string): string {
  return DAYS[new Date(utc(iso)).getUTCDay()];
}

export function longDate(iso: string): string {
  const d = new Date(utc(iso));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const LONDON_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });
const LONDON_HOUR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  hourCycle: "h23",
});

/** The Europe/London calendar day an instant falls on, as YYYY-MM-DD. */
export function londonISO(d: Date): string {
  return LONDON_DAY.format(d);
}

/** The instant London's day `iso` starts. London is UTC+0 or UTC+1, so subtract the hour it shows at UTC midnight. */
export function londonMidnight(iso: string): Date {
  const guess = utc(iso);
  return new Date(guess - Number(LONDON_HOUR.format(new Date(guess))) * 3_600_000);
}

export function nextSunday(now: Date): string {
  const today = londonISO(now);
  const dow = new Date(utc(today)).getUTCDay();
  return addDays(today, dow === 0 ? 0 : 7 - dow);
}
