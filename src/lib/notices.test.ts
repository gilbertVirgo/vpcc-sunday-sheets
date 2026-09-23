import { describe, expect, it } from "vitest";
import { noticeParagraph, noticeParagraphs, noticesText } from "./notices";

const full = { title: "Prayer meeting", day: "Wednesday", time: "7:30pm", location: "Church hall", description: "Bring a Bible." };

describe("notice text", () => {
  it("formats Title — Day time, Location. Description", () => {
    expect(noticeParagraph(full)).toBe("Prayer meeting — Wednesday 7:30pm, Church hall. Bring a Bible.");
  });
  it("drops missing parts cleanly", () => {
    expect(noticeParagraph({ title: "Quiz night", day: "Saturday", time: "", location: "", description: "" })).toBe(
      "Quiz night — Saturday.",
    );
  });
  it("round-trips to one paragraph per non-empty line", () => {
    const text = noticesText([full, { ...full, title: "Second" }]);
    expect(text.split("\n\n")).toHaveLength(2);
    expect(noticeParagraphs(`${text}\n\n  \nThird one  `)).toEqual([
      "Prayer meeting — Wednesday 7:30pm, Church hall. Bring a Bible.",
      "Second — Wednesday 7:30pm, Church hall. Bring a Bible.",
      "Third one",
    ]);
  });
});
