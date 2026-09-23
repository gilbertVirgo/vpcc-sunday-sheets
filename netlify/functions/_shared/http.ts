import { ISO_DATE } from "../../../src/shared/dates";
import { verifySession } from "./auth";

export const hubUrl = (): string => process.env.AUTH_HUB_URL || "https://auth.vpcc.church";

/** 401 carries the hub URL so the browser knows where to sign in. */
export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized", hub: hubUrl() }, { status: 401 });
}

export function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

export function dateParam(url: URL): string | null {
  const date = url.searchParams.get("date") ?? "";
  return ISO_DATE.test(date) ? date : null;
}

/** GET-only, session-checked handler. Errors are logged and returned as a bare 500. */
export function guarded(handler: (url: URL) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
    if (!verifySession(req)) return unauthorized();
    try {
      return await handler(new URL(req.url));
    } catch (err) {
      console.error(err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
