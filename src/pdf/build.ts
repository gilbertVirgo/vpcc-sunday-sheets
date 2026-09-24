import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees } from "pdf-lib";
import type { SheetInput } from "../shared/types";
import { fitScale } from "./fit";
import { layoutSheet } from "./flow";
import { PAGE_H, PAGE_W } from "./geometry";
import type { Measure } from "./measure";
import { renderSheet } from "./render";
import { type Face, textWidth } from "./type";

/** Pure: bytes in (fonts), bytes out. No DOM, no fetch, so it runs in vitest and the browser alike. */
export async function buildPdf(input: SheetInput): Promise<{ bytes: Uint8Array; fits: boolean }> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Sunday Worship ${input.dateISO}`);
  // ponytail: subset:true keeps the file small; flip to false if a glyph renders wrong.
  const face = async (bytes: Uint8Array): Promise<Face> => ({ pdf: await doc.embedFont(bytes, { subset: true }), kit: fontkit.create(bytes) });
  const fonts = { regular: await face(input.fonts.regular), bold: await face(input.fonts.bold) };
  const measure: Measure = (t, bold, size) => textWidth(bold ? fonts.bold : fonts.regular, t, size);

  const at = (s: number) => layoutSheet(input.songs, input.notices, s, measure);
  const { size, fits } = fitScale((s) => at(s).overflow);

  const pages = [doc.addPage([PAGE_W, PAGE_H]), doc.addPage([PAGE_W, PAGE_H])];
  renderSheet(pages, fonts, at(size).items, input);
  if (input.rotateBack) pages[1].setRotation(degrees(180));

  return { bytes: await doc.save(), fits };
}
