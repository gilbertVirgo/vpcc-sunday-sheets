import type { Font } from "@pdf-lib/fontkit";
import {
  type Color,
  type PDFFont,
  PDFArray,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  type PDFPage,
  beginText,
  endText,
  moveText,
  popGraphicsState,
  pushGraphicsState,
  setFillingColor,
  setFontAndSize,
} from "pdf-lib";

/** An embedded font plus the fontkit handle that shapes it (pdf-lib's own drawText drops kern pairs). */
export type Face = { pdf: PDFFont; kit: Font };

/**
 * Tracking in em: Inter's dynamic-metrics curve shifted tighter, clamped at 0.
 * ≈ 0 at 9pt, −0.010em at 11pt, −0.021em at 14pt, −0.033em at 22pt.
 */
export const trackEm = (size: number): number => Math.min(0, -0.0223 + 0.185 * Math.exp(-0.1745 * size) - 0.015);

/** Per glyph: the text it came from and its kerned advance in em. */
function shape(face: Face, text: string): { s: string; adv: number }[] {
  const { glyphs, positions } = face.kit.layout(text);
  const em = face.kit.unitsPerEm;
  return glyphs.map((g, i) => ({ s: String.fromCodePoint(...g.codePoints), adv: positions[i].xAdvance / em }));
}

/** Rendered width in pt, kerning and tracking included. */
export function textWidth(face: Face, text: string, size: number): number {
  return shape(face, text).reduce((w, g) => w + (g.adv + trackEm(size)) * size, 0);
}

const keys = new WeakMap<PDFPage, Map<PDFFont, PDFName>>();
function fontKey(page: PDFPage, font: PDFFont): PDFName {
  let m = keys.get(page);
  if (!m) keys.set(page, (m = new Map()));
  let k = m.get(font);
  if (!k) m.set(font, (k = page.node.newFontDictionary(font.name, font.ref)));
  return k;
}

/** Baseline-left at (x, y). One TJ: glyph codes interleaved with kern+tracking adjustments (thousandths of an em). */
export function drawText(page: PDFPage, face: Face, text: string, x: number, y: number, size: number, color: Color): void {
  const arr = PDFArray.withContext(page.doc.context);
  const track = trackEm(size);
  for (const g of shape(face, text)) {
    arr.push(face.pdf.encodeText(g.s));
    const natural = face.kit.layout(g.s).positions[0]?.xAdvance / face.kit.unitsPerEm || 0;
    const adj = g.adv + track - natural;
    if (adj) arr.push(PDFNumber.of(-adj * 1000));
  }
  page.pushOperators(
    pushGraphicsState(),
    setFillingColor(color),
    beginText(),
    setFontAndSize(fontKey(page, face.pdf), size),
    moveText(x, y),
    PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [arr]),
    endText(),
    popGraphicsState(),
  );
}
