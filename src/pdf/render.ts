import { type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { longDate } from "../shared/dates";
import type { SheetInput } from "../shared/types";
import type { Item } from "./flow";
import { CONTENT_W, PAD, panelOrigin } from "./geometry";
import { drawLogo, drawQr } from "./marks";
import { wrap } from "./measure";

export type Fonts = { regular: PDFFont; bold: PDFFont };

// vpcc-v1 seeds: ink #0B0C17, ink-muted #606162, accent #FF9035, line-strong #C5C5C2
const INK = rgb(11 / 255, 12 / 255, 23 / 255);
const MUTED = rgb(96 / 255, 97 / 255, 98 / 255);
const ACCENT = rgb(1, 144 / 255, 53 / 255);
const RULE = rgb(197 / 255, 197 / 255, 194 / 255);

export const CCLI_TEXT =
  "Lyrics reproduced under CCLI Licence No. 22249187. For use solely with the SongSelect® Terms of Use. All rights reserved. www.ccli.com";
export const ADDRESS = ["vpcc.church", "Victoria Park Baptist Church", "Grove Road, London E3 5TG"];
const SITE = "https://vpcc.church";

export function renderSheet(pages: PDFPage[], fonts: Fonts, items: Item[], input: Pick<SheetInput, "dateISO" | "time">): void {
  for (const it of items) {
    const o = panelOrigin(it.panel);
    const page = pages[o.page];
    const x = o.x + it.x;
    const y = o.top - it.y;
    if (it.kind === "text") {
      page.drawText(it.text, { x, y, size: it.size, font: it.bold ? fonts.bold : fonts.regular, color: it.muted ? MUTED : INK });
    } else {
      page.drawLine({ start: { x, y }, end: { x: x + it.w, y }, thickness: 0.5, color: RULE });
    }
  }
  drawCover(pages[0], fonts, input);
  drawFooter(pages[0], fonts);
}

/** Header block in the top COVER_H (150 pt) of panel A. */
function drawCover(page: PDFPage, fonts: Fonts, input: Pick<SheetInput, "dateISO" | "time">): void {
  const { x, top } = panelOrigin("A");
  drawLogo(page, x, top, 48, ACCENT);
  page.drawText("Sunday Worship", { x, y: top - 80, size: 22, font: fonts.bold, color: INK });
  page.drawText(longDate(input.dateISO), { x, y: top - 100, size: 11, font: fonts.regular, color: INK });
  if (input.time) page.drawText(input.time, { x, y: top - 116, size: 11, font: fonts.regular, color: INK });
}

/** Bottom-anchored in the back panel, inside FOOTER_H (110 pt): QR + address, then the CCLI line. */
function drawFooter(page: PDFPage, fonts: Fonts): void {
  const { x } = panelOrigin("back");
  const size = 7;
  const lh = 8.75;
  const lines = wrap(CCLI_TEXT, CONTENT_W, (t) => fonts.regular.widthOfTextAtSize(t, size));
  lines.forEach((line, i) => {
    page.drawText(line, { x, y: PAD + (lines.length - 1 - i) * lh, size, font: fonts.regular, color: MUTED });
  });

  const qr = 56;
  const qrBottom = PAD + lines.length * lh + 10;
  drawQr(page, SITE, x, qrBottom, qr, INK);
  ADDRESS.forEach((line, i) => {
    page.drawText(line, {
      x: x + qr + 10,
      y: qrBottom + qr - 14 - i * 12,
      size: i === 0 ? 9 : 8,
      font: i === 0 ? fonts.bold : fonts.regular,
      color: INK,
    });
  });
}
