import { describe, expect, it } from "vitest";
import { addDays, daysBetween, londonISO, londonMidnight, longDate, nextSunday, weekday } from "./dates";

describe("ISO day arithmetic", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-09-20", 6)).toBe("2026-09-26");
    expect(addDays("2026-09-28", 7)).toBe("2026-10-05");
  });
  it("counts whole days", () => {
    expect(daysBetween("2026-01-07", "2026-09-23")).toBe(259);
    expect(daysBetween("2026-09-23", "2026-09-20")).toBe(-3);
  });
  it("names weekdays", () => {
    expect(weekday("2026-09-20")).toBe("Sunday");
    expect(weekday("2026-09-23")).toBe("Wednesday");
  });
  it("formats the cover date without a comma", () => {
    expect(longDate("2026-09-20")).toBe("Sunday 20 September 2026");
  });
});

describe("Europe/London days", () => {
  it("finds midnight in BST and GMT", () => {
    expect(londonMidnight("2026-09-20").toISOString()).toBe("2026-09-19T23:00:00.000Z");
    expect(londonMidnight("2026-01-04").toISOString()).toBe("2026-01-04T00:00:00.000Z");
    expect(londonMidnight("2026-10-25").toISOString()).toBe("2026-10-24T23:00:00.000Z");
  });
  it("reads the London calendar day of an instant", () => {
    expect(londonISO(new Date("2026-09-22T23:00:00Z"))).toBe("2026-09-23");
    expect(londonISO(new Date("2026-01-07T00:00:00Z"))).toBe("2026-01-07");
  });
  it("defaults to the coming Sunday, or today on a Sunday", () => {
    expect(nextSunday(new Date("2026-09-23T12:00:00Z"))).toBe("2026-09-27");
    expect(nextSunday(new Date("2026-09-20T12:00:00Z"))).toBe("2026-09-20");
  });
});
