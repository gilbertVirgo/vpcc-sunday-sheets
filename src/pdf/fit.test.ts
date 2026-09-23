import { describe, expect, it } from "vitest";
import { fitScale } from "./fit";
import { wrap } from "./measure";

const width = (t: string) => t.length; // 1 pt per character

describe("wrap", () => {
  it("breaks on spaces within the width", () => {
    expect(wrap("aa bb cc dd", 5, width)).toEqual(["aa bb", "cc dd"]);
  });
  it("keeps an over-long word on its own line", () => {
    expect(wrap("a verylongword b", 5, width)).toEqual(["a", "verylongword", "b"]);
  });
  it("collapses whitespace and keeps empty lines", () => {
    expect(wrap("  a \t b ", 10, width)).toEqual(["a b"]);
    expect(wrap("", 10, width)).toEqual([""]);
  });
});

describe("fitScale", () => {
  it("uses 10 pt when everything fits", () => {
    expect(fitScale(() => false)).toEqual({ size: 10, fits: true });
  });
  it("binary-searches to the largest quarter point that fits", () => {
    const calls: number[] = [];
    const result = fitScale((s) => {
      calls.push(s);
      return s > 8.3;
    });
    expect(result).toEqual({ size: 8.25, fits: true });
    expect(calls.length).toBeLessThanOrEqual(7);
  });
  it("renders at 7 and reports fits:false below the floor", () => {
    expect(fitScale(() => true)).toEqual({ size: 7, fits: false });
  });
});
