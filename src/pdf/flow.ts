import type { Quote, SheetSection, SheetSong } from "../shared/types";
import { CONTENT_W, FLOW_ORDER, type PanelId, capacity } from "./geometry";
import { type Measure, wrap } from "./measure";

/** x from panel content left; y = baseline (text) or line (rule) distance down from content top. */
export type TextItem = { kind: "text"; panel: PanelId; x: number; y: number; text: string; size: number; bold: boolean; muted: boolean };
export type RuleItem = { kind: "rule"; panel: PanelId; x: number; y: number; w: number };
export type Item = TextItem | RuleItem;
export type Layout = { items: Item[]; overflow: boolean };

type Piece = Omit<TextItem, "panel"> | Omit<RuleItem, "panel">;
/** An unbreakable block. `gap` is dropped at the top of a panel. */
type Unit = { h: number; gap: number; pieces: Piece[]; keepWithNext?: boolean };

/** Minimum rules; the block grows to fill the largest free space after the songs. */
export const SERMON_LINES = 8;
const BASELINE = 0.8; // baseline sits 80% down a line box

const text = (t: string, x: number, y: number, size: number, bold = false, muted = false): Piece => ({
  kind: "text", x, y, text: t, size, bold, muted,
});

const block = (lines: string[], x: number, size: number, lh: number, y0: number, bold = false, muted = false): Piece[] =>
  lines.map((l, i) => text(l, x, y0 + (i + BASELINE) * lh, size, bold, muted));

/** Each section once, in first-occurrence order of `sequence` (or section order if empty). */
export function sectionOrder(song: SheetSong): SheetSection[] {
  const byId = new Map(song.sections.map((s) => [s.id, s]));
  const ids = song.sequence.length ? song.sequence : song.sections.map((s) => s.id);
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
}

export function creditLines(song: SheetSong): string[] {
  let credit = song.attribution.trim();
  if (song.ccli && !credit.includes(`#${song.ccli}`)) {
    credit = credit ? `${credit} · CCLI Song #${song.ccli}` : `CCLI Song #${song.ccli}`;
  }
  return credit ? credit.split(/\n+/) : [];
}

function songUnits(song: SheetSong, n: number, s: number, m: Measure): Unit[] {
  const lh = 1.25 * s;
  const indent = 1.8 * s;
  const bodyW = CONTENT_W - indent;
  const ts = 1.3 * s;
  const title = wrap(`${n}. ${song.title}`, CONTENT_W, (t) => m(t, true, ts));
  const units: Unit[] = [
    { gap: 1.6 * s, keepWithNext: true, h: title.length * 1.25 * ts, pieces: block(title, 0, ts, 1.25 * ts, 0, true) },
  ];

  for (const sec of sectionOrder(song)) {
    const verse = /^verse\s*(\d+)$/i.exec(sec.label.trim());
    const labelH = verse ? 0 : lh;
    const body = sec.lines.flatMap((l) => wrap(l, bodyW, (t) => m(t, false, s)));
    const label = verse
      ? text(verse[1], 0, BASELINE * lh, s, true)
      : text(sec.label, 0, BASELINE * lh, 0.85 * s, true);
    units.push({
      gap: 0.6 * s,
      h: labelH + Math.max(body.length, 1) * lh,
      pieces: [label, ...block(body, indent, s, lh, labelH)],
    });
  }

  const cs = 0.8 * s;
  const credit = creditLines(song).flatMap((l) => wrap(l, bodyW, (t) => m(t, false, cs)));
  if (credit.length) {
    units.push({ gap: 0.6 * s, h: credit.length * 1.25 * cs, pieces: block(credit, indent, cs, 1.25 * cs, 0, false, true) });
  }
  return units;
}

function sermonUnit(s: number, space: number): Unit | undefined {
  const hs = 1.3 * s;
  const head = 1.25 * hs;
  const step = 2.5 * s;
  const n = Math.floor((space - head) / step);
  if (n < SERMON_LINES) return undefined;
  const rules: Piece[] = Array.from({ length: n }, (_, i) => ({
    kind: "rule", x: 0, y: head + (i + 1) * step, w: CONTENT_W,
  }));
  return { gap: 1.6 * s, h: head + n * step, pieces: [text("Sermon notes", 0, BASELINE * head, hs, true), ...rules] };
}

function quoteUnits(quote: Quote | undefined, s: number, m: Measure): Unit[] {
  const body = quote?.text.trim();
  if (!body) return [];
  const lh = 1.25 * s;
  const lines = wrap(`“${body}”`, CONTENT_W, (t) => m(t, false, s));
  const units: Unit[] = [{ gap: 0, h: lines.length * lh, pieces: block(lines, 0, s, lh, 0) }];
  const source = quote!.source.trim();
  if (source) {
    const cs = 0.85 * s;
    const src = wrap(`— ${source}`, CONTENT_W, (t) => m(t, false, cs));
    units.push({ gap: 0.3 * s, h: src.length * 1.25 * cs, pieces: block(src, 0, cs, 1.25 * cs, 0, false, true) });
  }
  return units;
}

/** Pour units into panels in order. A unit that does not fit the space left moves to the next panel. */
function place(units: Unit[], panels: PanelId[], capOf = capacity): Layout & { p: number; used: number } {
  const items: Item[] = [];
  let p = 0;
  let used = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const next = u.keepWithNext ? units[i + 1] : undefined;
    const need = (used ? u.gap : 0) + u.h + (next ? next.gap + next.h : 0);
    if (used && used + need > capOf(panels[p]).cap) {
      p++;
      used = 0;
    }
    if (p >= panels.length) return { items, overflow: true, p, used };
    const { top, cap } = capOf(panels[p]);
    const y = used ? used + u.gap : 0;
    for (const piece of u.pieces) items.push({ ...piece, panel: panels[p], y: top + y + piece.y } as Item);
    used = y + u.h;
    if (used > cap) return { items, overflow: true, p, used }; // taller than an empty panel
  }
  return { items, overflow: false, p, used };
}

/** `backUsed`: height the notices already take on the back panel; the flow's last panel is what is left under them. */
export function layoutFlow(songs: SheetSong[], s: number, m: Measure, quote?: Quote, backUsed = 0): Layout {
  const units = [...quoteUnits(quote, s, m), ...songs.flatMap((song, i) => songUnits(song, i + 1, s, m))];
  const panels: PanelId[] = [...FLOW_ORDER, "back"];
  const backTop = backUsed ? backUsed + 1.6 * s : 0;
  const capOf = (id: PanelId) => (id === "back" ? { top: backTop, cap: capacity(id).cap - backTop } : capacity(id));
  const { items, overflow, p, used } = place(units, panels, capOf);
  if (overflow) return { items, overflow };
  // Sermon notes take the largest free space from the last song onward (the tail of its panel or a later empty panel).
  const gap = used ? 1.6 * s : 0;
  let best = { i: p, top: used + gap, space: capOf(panels[p]).cap - used - gap };
  for (let i = p + 1; i < panels.length; i++) {
    const space = capOf(panels[i]).cap;
    if (space > best.space) best = { i, top: 0, space };
  }
  const notes = sermonUnit(s, best.space);
  if (!notes) return { items, overflow: true };
  const panel = panels[best.i];
  const top = capOf(panel).top + best.top;
  for (const piece of notes.pieces) items.push({ ...piece, panel, y: top + piece.y } as Item);
  return { items, overflow: false };
}

export function layoutNotices(paragraphs: string[], s: number, m: Measure): Layout & { used: number } {
  if (!paragraphs.length) return { items: [], overflow: false, used: 0 };
  const lh = 1.25 * s;
  const hs = 1.3 * s;
  const units: Unit[] = [
    { gap: 0, keepWithNext: true, h: 1.25 * hs, pieces: [text("Notices", 0, BASELINE * 1.25 * hs, hs, true)] },
    ...paragraphs.map((para) => {
      const lines = wrap(para, CONTENT_W, (t) => m(t, false, s));
      return { gap: 0.6 * s, h: lines.length * lh, pieces: block(lines, 0, s, lh, 0) };
    }),
  ];
  return place(units, ["back"]);
}

export function layoutSheet(songs: SheetSong[], notices: string[], s: number, m: Measure, quote?: Quote): Layout {
  const back = layoutNotices(notices, s, m);
  const flow = layoutFlow(songs, s, m, quote, back.used);
  return { items: [...flow.items, ...back.items], overflow: flow.overflow || back.overflow };
}
