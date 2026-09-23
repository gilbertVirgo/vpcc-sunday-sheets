export const PAGE_W = 841.89;
export const PAGE_H = 595.28;
export const PANEL_W = PAGE_W / 3; // 280.63
export const PAD = 20;
export const CONTENT_W = PANEL_W - 2 * PAD;
export const CONTENT_H = PAGE_H - 2 * PAD;
/** Cover header (logo, title, date, time) at the top of panel A; flow starts below it. */
export const COVER_H = 150;
/** Bottom-anchored footer (QR, address, CCLI line) of the back panel. */
export const FOOTER_H = 110;

export type PanelId = "A" | "B" | "C" | "D" | "E" | "back";

/** Page 1: B | back | A(cover). Page 2: C | D | E. */
const SLOT: Record<PanelId, { page: 0 | 1; col: 0 | 1 | 2 }> = {
  B: { page: 0, col: 0 },
  back: { page: 0, col: 1 },
  A: { page: 0, col: 2 },
  C: { page: 1, col: 0 },
  D: { page: 1, col: 1 },
  E: { page: 1, col: 2 },
};

/** [p1.right, p2.left, p1.left, p2.middle, p2.right] */
export const FLOW_ORDER: PanelId[] = ["A", "C", "B", "D", "E"];

export function panelOrigin(id: PanelId): { page: 0 | 1; x: number; top: number } {
  const { page, col } = SLOT[id];
  return { page, x: col * PANEL_W + PAD, top: PAGE_H - PAD };
}

export function capacity(id: PanelId): { top: number; cap: number } {
  if (id === "A") return { top: COVER_H, cap: CONTENT_H - COVER_H };
  if (id === "back") return { top: 0, cap: CONTENT_H - FOOTER_H };
  return { top: 0, cap: CONTENT_H };
}
