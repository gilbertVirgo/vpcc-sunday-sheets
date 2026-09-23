import { describe, expect, it } from "vitest";
import type { SheetSong } from "../shared/types";
import { creditLines, type Item, layoutFlow, layoutSheet, sectionOrder } from "./flow";
import { FLOW_ORDER, PAD, PANEL_W, panelOrigin } from "./geometry";
import type { Measure } from "./measure";

/** Fake metrics: every glyph is half an em wide. */
const m: Measure = (t, _bold, size) => t.length * size * 0.5;

function song(n: number, sections: number, lines: number): SheetSong {
  const secs = Array.from({ length: sections }, (_, j) => ({
    id: `v${j + 1}`,
    label: `Verse ${j + 1}`,
    lines: Array.from({ length: lines }, (_, i) => `L${n}.${j} la la ${i}`),
  }));
  return { id: `s${n}`, title: `Song ${n}`, sections: secs, sequence: secs.map((s) => s.id), attribution: "Writer" };
}

const panelOf = (items: Item[], text: string) =>
  items.find((i) => i.kind === "text" && i.text === text)?.panel;

describe("(a) panel assignment order", () => {
  it("maps flow order to p1.right, p2.left, p1.left, p2.middle, p2.right", () => {
    const slots = FLOW_ORDER.map((id) => {
      const o = panelOrigin(id);
      return [o.page, Math.round((o.x - PAD) / PANEL_W)];
    });
    expect(slots).toEqual([[0, 2], [1, 0], [0, 0], [1, 1], [1, 2]]);
  });

  it("fills panels A, C, B, D, E in turn", () => {
    const { items, overflow } = layoutFlow([1, 2, 3, 4].map((n) => song(n, 2, 14)), 10, m);
    expect(overflow).toBe(false);
    expect([1, 2, 3, 4].map((n) => panelOf(items, `${n}. Song ${n}`))).toEqual(["A", "C", "B", "D"]);
    expect(panelOf(items, "Sermon notes")).toBe("E");
    expect(items.some((i) => i.panel === "back")).toBe(false);
  });
});

describe("(b) keep-together rules", () => {
  it("never splits the sermon notes block", () => {
    for (let k = 1; k <= 30; k++) {
      const { items } = layoutFlow([song(1, 1, k), song(2, 3, 10)], 10, m);
      const sermon = items.filter((i) => i.kind === "rule" || i.text === "Sermon notes");
      expect(sermon).toHaveLength(9);
      expect(new Set(sermon.map((i) => i.panel)).size).toBe(1);
    }
  });

  it("never splits a section across panels", () => {
    const { items } = layoutFlow([1, 2, 3].map((n) => song(n, 5, 9)), 10, m);
    const panelsBySection = new Map<string, Set<string>>();
    for (const i of items) {
      if (i.kind !== "text" || !/^L\d+\.\d+ /.test(i.text)) continue;
      const key = i.text.split(" ")[0];
      panelsBySection.set(key, (panelsBySection.get(key) ?? new Set()).add(i.panel));
    }
    expect(panelsBySection.size).toBe(15);
    for (const panels of panelsBySection.values()) expect(panels.size).toBe(1);
    // …while songs themselves do split.
    const song1Panels = new Set(items.filter((i) => i.kind === "text" && i.text.startsWith("L1.")).map((i) => i.panel));
    expect(song1Panels.size).toBeGreaterThan(1);
  });
});

describe("(c) overflow drives shrink", () => {
  it("overflows at 10 pt but fits at 7 pt", () => {
    const songs = [1, 2, 3, 4, 5].map((n) => song(n, 2, 14));
    expect(layoutSheet(songs, [], 10, m).overflow).toBe(true);
    expect(layoutSheet(songs, [], 7, m).overflow).toBe(false);
  });
  it("flags notices that overflow the back panel", () => {
    const notices = Array.from({ length: 40 }, (_, i) => `Notice ${i} with some words`);
    expect(layoutSheet([], notices, 10, m).overflow).toBe(true);
    expect(layoutSheet([], notices.slice(0, 5), 10, m).overflow).toBe(false);
    const placed = layoutSheet([], notices.slice(0, 5), 10, m).items;
    expect(panelOf(placed, "Notices")).toBe("back");
  });
});

describe("sectionOrder", () => {
  const base: SheetSong = {
    id: "x",
    title: "X",
    attribution: "",
    sections: [
      { id: "v1", label: "Verse 1", lines: [] },
      { id: "c", label: "Chorus", lines: [] },
      { id: "v2", label: "Verse 2", lines: [] },
    ],
    sequence: ["v1", "c", "v2", "c", "c", "missing"],
  };
  it("prints each section once, in first-occurrence order", () => {
    expect(sectionOrder(base).map((s) => s.label)).toEqual(["Verse 1", "Chorus", "Verse 2"]);
  });
  it("falls back to section order when sequence is empty", () => {
    expect(sectionOrder({ ...base, sequence: [] }).map((s) => s.id)).toEqual(["v1", "c", "v2"]);
  });
});

describe("creditLines", () => {
  const s = (attribution: string, ccli?: string): SheetSong => ({ id: "x", title: "X", sections: [], sequence: [], attribution, ccli });
  it("appends the CCLI number to the last line", () => {
    expect(creditLines(s("Paul Oakley\n© 1995 Thankyou Music Ltd.", "1585987"))).toEqual([
      "Paul Oakley",
      "© 1995 Thankyou Music Ltd. · CCLI Song #1585987",
    ]);
  });
  it("does not repeat a CCLI number already present", () => {
    expect(creditLines(s("John Newton\nPublic Domain. CCLI Song #2762836", "2762836"))).toEqual([
      "John Newton",
      "Public Domain. CCLI Song #2762836",
    ]);
  });
  it("handles missing parts", () => {
    expect(creditLines(s("", "123"))).toEqual(["CCLI Song #123"]);
    expect(creditLines(s(""))).toEqual([]);
  });
});
