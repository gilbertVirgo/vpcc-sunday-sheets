import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateParam, guarded } from "./http";

const SECRET = "test-secret";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("JWT_SECRET", SECRET);
});

const ok = guarded(async (url) => Response.json({ path: url.pathname }));

describe("guarded", () => {
  it("401s with the hub URL when there is no session", async () => {
    vi.stubEnv("AUTH_HUB_URL", "http://localhost:8888");
    const res = await ok(new Request("http://localhost/api/x"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized", hub: "http://localhost:8888" });
  });
  it("defaults the hub to auth.vpcc.church", async () => {
    const res = await ok(new Request("http://localhost/api/x"));
    expect((await res.json()).hub).toBe("https://auth.vpcc.church");
  });
  it("405s on non-GET", async () => {
    const res = await ok(new Request("http://localhost/api/x", { method: "POST" }));
    expect(res.status).toBe(405);
  });
  it("runs the handler with a valid cookie", async () => {
    const token = jwt.sign({ id: "1", username: "admin", role: "admin" }, SECRET);
    const res = await ok(new Request("http://localhost/api/x", { headers: { cookie: `vpcc_session=${token}` } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ path: "/api/x" });
  });
  it("hides handler errors behind a 500", async () => {
    const token = jwt.sign({ id: "1", username: "admin", role: "admin" }, SECRET);
    const boom = guarded(async () => {
      throw new Error("secret detail");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await boom(new Request("http://localhost/api/x", { headers: { authorization: `Bearer ${token}` } }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal error" });
  });
});

describe("dateParam", () => {
  it("accepts YYYY-MM-DD only", () => {
    expect(dateParam(new URL("http://x/?date=2026-09-20"))).toBe("2026-09-20");
    expect(dateParam(new URL("http://x/?date=20/09/2026"))).toBeNull();
    expect(dateParam(new URL("http://x/"))).toBeNull();
  });
});
