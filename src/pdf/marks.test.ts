import { describe, expect, it } from "vitest";
import { LOGO_PATH, pathOperators } from "./marks";

describe("pathOperators", () => {
  it("emits one moveto and one closepath per subpath of the VPCC mark", () => {
    const ops = pathOperators(LOGO_PATH).map(String);
    expect(ops.filter((o) => o.endsWith(" m"))).toHaveLength(6);
    expect(ops.filter((o) => o === "h")).toHaveLength(6);
  });
  it("handles H and V", () => {
    expect(pathOperators("M0 0H10V5Z").map(String)).toEqual(["0 0 m", "10 0 l", "10 5 l", "h"]);
  });
  it("rejects relative commands", () => {
    expect(() => pathOperators("m0 0l1 1")).toThrow("Unsupported SVG path command");
  });
});
