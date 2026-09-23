import {
  type Color,
  PDFOperator,
  PDFOperatorNames,
  type PDFPage,
  appendBezierCurve,
  closePath,
  concatTransformationMatrix,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  setFillingColor,
} from "pdf-lib";
import QRCode from "qrcode";

/** VPCC mark from vpcc-v1 src/components/brand/logo.tsx (viewBox 0 0 100 100, fill-rule evenodd). */
export const LOGO_PATH =
  "M50 100C77.6142 100 100 77.6142 100 50C100 22.3858 77.6142 0 50 0C22.3858 0 0 22.3858 0 50C0 77.6142 22.3858 100 50 100ZM12.32 43.36L19.04 60H23.52L30.24 43.36H25.76L21.28 55.44L16.8 43.36H12.32ZM40.8638 42.96C36.0638 42.96 31.9037 46.88 31.9037 51.68V68.32H36.3838V58.96C37.8237 60 39.4238 60.4 41.1037 60.4C45.8237 60.4 49.8237 56.48 49.8237 51.68C49.8237 46.48 46.0638 42.96 40.8638 42.96ZM45.3438 51.68C45.3438 54.24 43.5037 56.24 40.8638 56.24C38.3037 56.24 36.3838 54.24 36.3838 51.68C36.3838 49.04 38.3037 47.12 40.8638 47.12C43.5037 47.12 45.3438 49.04 45.3438 51.68ZM52.5491 51.68C52.5491 56.88 56.3091 60.4 61.5091 60.4C63.8291 60.4 66.0691 59.44 67.6691 57.76L64.7091 54.88C63.9091 55.68 62.7091 56.24 61.5091 56.24C58.9491 56.24 57.0291 54.24 57.0291 51.68C57.0291 49.04 58.9491 47.12 61.5091 47.12C62.7891 47.12 63.9091 47.6 64.7891 48.4L67.7491 45.44C65.9891 43.68 63.9891 42.96 61.5091 42.96C56.7091 42.96 52.5491 46.88 52.5491 51.68ZM70.3225 51.68C70.3225 56.88 74.0825 60.4 79.2825 60.4C81.6025 60.4 83.8425 59.44 85.4425 57.76L82.4825 54.88C81.6825 55.68 80.4825 56.24 79.2825 56.24C76.7225 56.24 74.8025 54.24 74.8025 51.68C74.8025 49.04 76.7225 47.12 79.2825 47.12C80.5625 47.12 81.6825 47.6 82.5625 48.4L85.5225 45.44C83.7625 43.68 81.7625 42.96 79.2825 42.96C74.4825 42.96 70.3225 46.88 70.3225 51.68Z";

/** Absolute M/L/H/V/C/Z only; that is all the mark uses. Anything else throws, so a new path fails loudly. */
export function pathOperators(d: string): PDFOperator[] {
  const t = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const ops: PDFOperator[] = [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  const num = () => Number(t[i++]);
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    switch (cmd) {
      case "M":
        x = num(); y = num();
        ops.push(moveTo(x, y));
        cmd = "L"; // implicit repeats after M are linetos
        break;
      case "L":
        x = num(); y = num();
        ops.push(lineTo(x, y));
        break;
      case "H":
        x = num();
        ops.push(lineTo(x, y));
        break;
      case "V":
        y = num();
        ops.push(lineTo(x, y));
        break;
      case "C": {
        const [x1, y1, x2, y2] = [num(), num(), num(), num()];
        x = num(); y = num();
        ops.push(appendBezierCurve(x1, y1, x2, y2, x, y));
        break;
      }
      case "Z":
        ops.push(closePath());
        cmd = "";
        break;
      default:
        throw new Error(`Unsupported SVG path command: ${cmd || t[i]}`);
    }
  }
  return ops;
}

/** Draws the mark `size` pt square with its top-left corner at (x, top). */
export function drawLogo(page: PDFPage, x: number, top: number, size: number, color: Color): void {
  const s = size / 100;
  page.pushOperators(
    pushGraphicsState(),
    setFillingColor(color),
    concatTransformationMatrix(s, 0, 0, -s, x, top), // SVG y-down → PDF y-up
    ...pathOperators(LOGO_PATH),
    PDFOperator.of(PDFOperatorNames.FillEvenOdd),
    popGraphicsState(),
  );
}

/** Vector QR code, `size` pt square, bottom-left at (x, y). Dark runs per row are merged into one rectangle. */
export function drawQr(page: PDFPage, value: string, x: number, y: number, size: number, color: Color): void {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const cell = size / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; ) {
      if (!modules.get(r, c)) {
        c++;
        continue;
      }
      let end = c;
      while (end < n && modules.get(r, end)) end++;
      page.drawRectangle({ x: x + c * cell, y: y + size - (r + 1) * cell, width: (end - c) * cell, height: cell, color });
      c = end;
    }
  }
}
