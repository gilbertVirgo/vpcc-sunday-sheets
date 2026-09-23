import type { Notice } from "../shared/types";

export function noticeParagraph(n: Notice): string {
  const when = [n.day, n.time].filter(Boolean).join(" ");
  const head = `${n.title} — ${when}${n.location ? `, ${n.location}` : ""}.`;
  return n.description ? `${head} ${n.description}` : head;
}

export const noticesText = (notices: Notice[]): string => notices.map(noticeParagraph).join("\n\n");

/** The textarea's paragraphs: one per non-empty line. */
export const noticeParagraphs = (text: string): string[] =>
  text.split("\n").map((line) => line.trim()).filter(Boolean);
