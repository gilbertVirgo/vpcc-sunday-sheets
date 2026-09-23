import { describe, expect, it } from "vitest";
import { type EventDoc, formatTime, selectNotices } from "./notices";

const d = (iso: string) => new Date(iso);

// Window: Sunday 20 Sept 2026 (BST) … Saturday 26 Sept. London midnight = 23:00Z the day before.
const events: EventDoc[] = [
  { title: "Prayer meeting", date: d("2026-01-07T00:00:00Z"), time: { start: [19, 30] }, visibility: "public", recursWeekly: true, location: "Church hall", description: "Bring a Bible." },
  { title: "Youth club", date: d("2026-01-09T00:00:00Z"), time: { start: [18, 0] }, visibility: "public", recursWeekly: true, recursionDetails: { exceptions: [d("2026-09-24T23:00:00Z")] } },
  { title: "Old study", date: d("2026-01-08T00:00:00Z"), visibility: "public", recursWeekly: true, recursionDetails: { endDate: d("2026-09-01T00:00:00Z") } },
  { title: "Future group", date: d("2026-10-01T00:00:00Z"), visibility: "public", recursWeekly: true },
  { title: "Harvest lunch", date: d("2026-09-19T23:00:00Z"), time: { start: [12, 0] }, visibility: "public", location: "Church hall", description: "Bring a dish." },
  { title: "Morning coffee", date: d("2026-09-22T23:00:00Z"), time: { start: [10, 0] }, visibility: "public" },
  { title: "Elders", date: d("2026-09-22T23:00:00Z"), time: { start: [20, 0] }, visibility: "private" },
  { title: "Last week", date: d("2026-09-12T23:00:00Z"), visibility: "public" },
  { title: "Next Sunday", date: d("2026-09-26T23:00:00Z"), visibility: "public" },
  { title: "Quiz night", date: d("2026-09-25T23:00:00Z"), time: { start: [], end: [] }, visibility: "public" },
];

describe("selectNotices", () => {
  it("keeps public events in the week, expands weekly recurrences, sorts by day then time", () => {
    expect(selectNotices(events, "2026-09-20")).toEqual([
      { title: "Harvest lunch", day: "Sunday", time: "12pm", location: "Church hall", description: "Bring a dish." },
      { title: "Morning coffee", day: "Wednesday", time: "10am", location: "", description: "" },
      { title: "Prayer meeting", day: "Wednesday", time: "7:30pm", location: "Church hall", description: "Bring a Bible." },
      { title: "Quiz night", day: "Saturday", time: "", location: "", description: "" },
    ]);
  });
  it("returns nothing for an empty calendar", () => {
    expect(selectNotices([], "2026-09-20")).toEqual([]);
  });
});

describe("formatTime", () => {
  it.each([
    [[19, 30], "7:30pm"],
    [[19, 0], "7pm"],
    [[0, 5], "12:05am"],
    [[12, 0], "12pm"],
    [[], ""],
    [undefined, ""],
  ])("%j → %s", (t, want) => {
    expect(formatTime(t as number[] | undefined)).toBe(want);
  });
});
