import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { SheetSong } from "../shared/types";
import { buildPdf } from "./build";
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
    const { items, overflow } = layoutFlow([1, 2, 3, 4].map((n) => song(n, 2, 14)), 9.4, m);
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
      expect(sermon.length).toBeGreaterThanOrEqual(9);
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

describe("sermon notes fill space", () => {
  it("takes a whole empty panel over the tail of the last song's panel", () => {
    const { items } = layoutFlow([song(1, 1, 2)], 10, m);
    expect(panelOf(items, "Sermon notes")).toBe("C");
    const rules = items.filter((i) => i.kind === "rule");
    expect(rules.length).toBeGreaterThan(8);
    expect(Math.max(...rules.map((r) => r.y))).toBeGreaterThan(500);
  });
  it("fills the tail of the last panel when no panel is empty", () => {
    const { items, overflow } = layoutFlow([1, 2, 3, 4, 5, 6].map((n) => song(n, 2, 10)), 10, m);
    expect(overflow).toBe(false);
    expect(items.some((i) => i.panel === "E" && i.kind === "text" && i.text.startsWith("L6."))).toBe(true);
    expect(panelOf(items, "Sermon notes")).toBe("E");
    expect(items.filter((i) => i.kind === "rule").length).toBeGreaterThanOrEqual(8);
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

describe("quote", () => {
  it("prints quote and source at the top of panel A, before the songs", () => {
    const { items } = layoutFlow([song(1, 1, 2)], 10, m, { text: "Be still", source: "Psalm 46:10" });
    const texts = items.filter((i) => i.kind === "text");
    expect(texts[0]).toMatchObject({ panel: "A", text: "“Be still”" });
    expect(texts[1]).toMatchObject({ panel: "A", text: "— Psalm 46:10", muted: true });
    expect(panelOf(items, "1. Song 1")).toBe("A");
  });
  it("prints nothing for a blank quote", () => {
    const plain = layoutFlow([song(1, 1, 2)], 10, m);
    expect(layoutFlow([song(1, 1, 2)], 10, m, { text: "  ", source: "Psalm 1" })).toEqual(plain);
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
  it("appends CCLI when the number appears without a # prefix", () => {
    expect(creditLines(s("John Newton, 1779", "1779"))).toEqual(["John Newton, 1779 · CCLI Song #1779"]);
  });
});

const fonts = {
  regular: readFileSync(new URL("../../public/fonts/Inter-Regular.ttf", import.meta.url)),
  bold: readFileSync(new URL("../../public/fonts/Inter-Bold.ttf", import.meta.url)),
};
const sheet = (songs: SheetSong[], notices: string[] = []) => ({
  dateISO: "2026-09-20",
  time: "3:15pm",
  songs,
  notices,
  fonts,
});

describe("buildPdf", () => {
  it("(c) shrinks to fit, and reports fits:false at the 7 pt floor", async () => {
    const many = Array.from({ length: 30 }, (_, i) => song(i + 1, 4, 12));
    expect((await buildPdf(sheet(many))).fits).toBe(false);
    expect((await buildPdf(sheet(many.slice(0, 3), ["Prayer meeting — Wednesday 7:30pm."]))).fits).toBe(true);
  }, 30_000);

  it("(d) leaves both pages unrotated", async () => {
    const doc = await PDFDocument.load((await buildPdf(sheet([song(1, 2, 4)]))).bytes);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 0]);
  }, 30_000);

  it("(e) produces a valid two-page A4 landscape PDF with no songs", async () => {
    const { bytes, fits } = await buildPdf(sheet([]));
    const doc = await PDFDocument.load(bytes);
    expect(fits).toBe(true);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 841.89, height: 595.28 });
  }, 30_000);
});
