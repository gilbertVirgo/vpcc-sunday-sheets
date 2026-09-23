/** Width in points of `text` set in Inter (bold or regular) at `size`. */
export type Measure = (text: string, bold: boolean, size: number) => number;

/** Greedy word wrap. Whitespace collapses; a word wider than the line gets a line to itself. */
export function wrap(text: string, maxWidth: number, width: (t: string) => number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (words[0] === "") return [""];
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next) > maxWidth) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  out.push(line);
  return out;
}
