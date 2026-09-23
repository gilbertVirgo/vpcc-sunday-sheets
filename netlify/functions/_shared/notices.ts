import { addDays, daysBetween, londonISO, weekday } from "../../../src/shared/dates";
import type { Notice } from "../../../src/shared/types";

/** Shape of calendar `events` documents (see vpcc-calendar/netlify/functions/models/Event.js). */
export type EventDoc = {
  title: string;
  date: Date;
  time?: { start?: number[]; end?: number[] };
  visibility?: string;
  recursWeekly?: boolean;
  recursionDetails?: { endDate?: Date | null; exceptions?: Date[] };
  location?: string;
  description?: string;
};

export function formatTime(t?: number[]): string {
  if (!t || t.length < 2) return "";
  const [h, m] = t;
  const mins = m ? `:${String(m).padStart(2, "0")}` : "";
  return `${h % 12 || 12}${mins}${h < 12 ? "am" : "pm"}`;
}

/** Events on the 7 London days starting `sundayISO`, weekly recurrences expanded. */
export function selectNotices(events: EventDoc[], sundayISO: string): Notice[] {
  const days = Array.from({ length: 7 }, (_, i) => addDays(sundayISO, i));
  const hits: Array<{ day: string; minutes: number; ev: EventDoc }> = [];

  for (const ev of events) {
    if (ev.visibility === "private") continue;
    const base = londonISO(ev.date);
    const rec = ev.recursionDetails ?? {};
    const end = rec.endDate ? londonISO(rec.endDate) : null;
    const skip = new Set((rec.exceptions ?? []).map(londonISO));

    for (const day of days) {
      const gap = daysBetween(base, day);
      const on = ev.recursWeekly
        ? gap >= 0 && gap % 7 === 0 && (!end || day <= end) && !skip.has(day)
        : gap === 0;
      if (on) {
        const [h = 0, m = 0] = ev.time?.start ?? [];
        hits.push({ day, minutes: h * 60 + m, ev });
      }
    }
  }

  hits.sort((a, b) => a.day.localeCompare(b.day) || a.minutes - b.minutes);
  return hits.map(({ day, ev }) => ({
    title: ev.title,
    day: weekday(day),
    time: formatTime(ev.time?.start),
    location: ev.location ?? "",
    description: ev.description ?? "",
  }));
}
