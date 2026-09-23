# Sunday Sheets App (vpcc-sunday-sheets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build trifold.vpcc.church: a single-page editor that loads the week's songs and notices, and builds the two-page A4-landscape trifold PDF in the browser with a live preview and download.

**Architecture:** Vite + React 19 serves the editor. Three GET JSON Netlify Functions (`service`, `songs`, `notices`) and one `me` endpoint read two MongoDB databases through cached `mongodb` clients. Each checks the shared `vpcc_session` JWT. The PDF engine in `src/pdf/` is pure TypeScript on `pdf-lib`: geometry → measure/wrap → flow (positioned items) → fit (scale search) → render (drawing) → build (entry point). It runs in the browser and in vitest.

**Tech Stack:** Node 24, Vite, React 19, TypeScript, Tailwind v4 (`@tailwindcss/vite`), Netlify Functions v2 (`.mts`), `mongodb`, `jsonwebtoken`, `pdf-lib`, `@pdf-lib/fontkit`, `qrcode`, Inter TTF (vendored), vitest.

**Spec:** `/Users/gilbertvirgo/vpcc-sunday-sheets/docs/superpowers/specs/2026-09-23-trifold-sheets-design.md` (sections "Sheets app", "PDF layout", "Tests")

## Global Constraints

- Repo: `/Users/gilbertvirgo/vpcc-sunday-sheets` (contains only `docs/` today). Hosted at `trifold.vpcc.church` on Netlify.
- Env: `CALENDAR_MONGODB_URI`, `PRAISE_MONGODB_URI`, `PRAISE_MONGODB_DB` (default `praise_presenter`), `JWT_SECRET` (identical across calendar, auth, trifold), `AUTH_HUB_URL` (default `https://auth.vpcc.church`).
- Functions: Netlify Functions v2, `export default async (req: Request) => Response`, files `netlify/functions/*.mts`. `/api/*` redirects to `/.netlify/functions/:splat`.
- Every function except `me` is GET-only, cookie-guarded, and returns JSON. A 401 body is `{ error: "Unauthorized", hub: AUTH_HUB_URL }`.
- `netlify/functions/_shared/auth.ts` is a verbatim copy of the hub's file: `verifySession(req: Request): SessionUser | null` reads cookie `vpcc_session` first, then `Authorization: Bearer`, and throws if `JWT_SECRET` is unset.
- Both databases are read-only. Never write to them.
- UI uses the vpcc-v1 tokens (copied CSS) and Area Inktrap via `https://use.typekit.net/ccy7tqi.css`. Components use semantic tokens only (`bg-surface`, `text-ink`, `border-line`, `bg-accent`…).
- Never print secret values (`JWT_SECRET`, Mongo URIs, passwords) in logs or terminal output.
- No persistence. A reload means fresh data from the databases.
- Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

**Spec rules, verbatim (each is repeated in the task that implements it):**

- Geometry: "A4 landscape 841.89 × 595.28 pt, 2 pages, 3 equal panels each (280.63 pt), panel padding 20 pt, columns never cross panel folds."
- Panels: "Page 1: left = flow panel B, middle = **back panel**, right = **cover** (flow panel A). Page 2: left = flow panel C, middle = flow panel D, right = flow panel E. Flow order: A (cover, below header block) → C → B → D → E. i.e. `[p1.right, p2.left, p1.left, p2.middle, p2.right]`."
- Flow content: "songs 1..n, then sermon notes block (heading "Sermon notes" + 8 ruled lines, kept together). Each song: `"{n}. {title}"` bold, sections in `sequence` order with label … and lines, then credit line small grey: `attribution` (+ ` · CCLI Song #{ccli}` if not already contained)."
- Section repeats: "print each section once, in first-occurrence order (leaflet, not slides)."
- Footer text: "Lyrics reproduced under CCLI Licence No. 22249187. For use solely with the SongSelect® Terms of Use. All rights reserved. www.ccli.com", QR to `https://vpcc.church`, "vpcc.church / Victoria Park Baptist Church / Grove Road, London E3 5TG".
- Fit: "base lyric size 10 pt. Lay out at size s (line-height 1.25s, headings scale with s). If flow overflows panel E or notices overflow back panel, binary-search s in [7, 10] to 0.25 pt. Below 7 → render at 7 and report `fits:false` to UI. Song blocks may split across panels but never mid-section; a section that cannot fit in remaining panel space moves to next panel."
- Duplex: "when rotate flag true, set page 2 `Rotate` to 180 (`page.setRotation(degrees(180))`)."
- Output: "`buildPdf(input: SheetInput): Promise<{ bytes: Uint8Array, fits: boolean }>` — pure, no DOM, so it runs in vitest."

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `netlify.toml`, `.gitignore`, `.env.example`, `index.html` | Tooling / deploy config |
| `src/styles/*.css` (copied), `src/style.css` | vpcc-v1 design tokens + Tailwind entry |
| `public/fonts/Inter-Regular.ttf`, `Inter-Bold.ttf`, `LICENSE.txt` | Fonts embedded in the PDF |
| `src/shared/types.ts` | `SheetSection`, `SheetSong`, `Notice`, `SheetInput` (shared by UI, PDF and functions) |
| `src/shared/dates.ts` (+ test) | ISO-day arithmetic, London midnight, long date, next Sunday |
| `netlify/functions/_shared/auth.ts` (+ test) | Verbatim hub copy: `verifySession` (+ unused cookie/CORS helpers) |
| `netlify/functions/_shared/http.ts` (+ test) | `guarded`, `unauthorized`, `badRequest`, `dateParam` |
| `netlify/functions/_shared/mongo.ts` | Cached clients: `calendarDb()`, `praiseDb()` |
| `netlify/functions/_shared/notices.ts` (+ test) | Pure `selectNotices(events, sundayISO)`, `formatTime` |
| `netlify/functions/_shared/sheet-song.ts` | Map praise docs/blocks → `SheetSong` |
| `netlify/functions/me.mts`, `service.mts`, `songs.mts`, `notices.mts` | HTTP endpoints |
| `src/pdf/geometry.ts` | Page/panel constants, flow order, panel origins/capacities |
| `src/pdf/measure.ts` | `Measure` type, `wrap` |
| `src/pdf/fit.ts` (+ `fit.test.ts`) | `fitScale` binary search |
| `src/pdf/flow.ts` (+ `layout.test.ts`) | Pure layout → positioned `Item[]` + overflow flag |
| `src/pdf/marks.ts` (+ test) | VPCC logo (even-odd vector) and QR (vector) |
| `src/pdf/render.ts` | Draw items, cover header, back-panel footer |
| `src/pdf/build.ts` | `buildPdf` entry |
| `src/api.ts`, `src/lib/fonts.ts`, `src/lib/notices.ts` (+ test) | Fetch + 401 redirect, font loading, notice text |
| `src/main.tsx`, `src/App.tsx`, `src/components/{SongList,SongSearch,NoticesEditor,Preview}.tsx` | Editor UI |

---

### Task 1: Scaffold repo, tokens, fonts

**Files:**
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/package.json`, `tsconfig.json`, `vite.config.ts`, `netlify.toml`, `.gitignore`, `.env.example`, `index.html`
- Create (copied): `src/styles/tokens.color.css`, `tokens.typography.css`, `tokens.layout.css`, `tokens.motion.css`, `base.css`, `utilities.css`
- Create: `src/style.css`, `src/main.tsx`, `src/App.tsx` (placeholder, replaced in Task 10)
- Create (vendored): `public/fonts/Inter-Regular.ttf`, `public/fonts/Inter-Bold.ttf`, `public/fonts/LICENSE.txt`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run dev` (Vite on 5174), `npm run build`, `npm test`, `npm run typecheck`; fonts served at `/fonts/Inter-Regular.ttf` and `/fonts/Inter-Bold.ttf`; netlify dev on 8889

- [ ] **Step 1: Write `package.json` and install deps**

```json
{
  "name": "vpcc-sunday-sheets",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
npm install react react-dom pdf-lib @pdf-lib/fontkit qrcode mongodb jsonwebtoken
npm install -D vite @vitejs/plugin-react typescript tailwindcss @tailwindcss/vite vitest @types/node @types/react @types/react-dom @types/qrcode @types/jsonwebtoken
```

- [ ] **Step 2: Write config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["node", "vite/client"],
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true
  },
  "include": ["src", "netlify", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 5173 is taken by the auth hub in local dev.
  server: { port: 5174, strictPort: true },
});
```

`netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "24"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[dev]
  framework = "#custom"
  command = "npm run dev"
  targetPort = 5174
  port = 8889
```

`.gitignore`:
```
node_modules
dist
.netlify
.env
```

`.env.example`:
```
# Calendar DB (same value as MONGODB_URI in ~/vpcc-calendar/.env)
CALENDAR_MONGODB_URI=
# Praise Presenter DB (MONGODB_URI / MONGODB_DB in ~/praise-pres/.env)
PRAISE_MONGODB_URI=
PRAISE_MONGODB_DB=praise_presenter
# Identical in calendar, auth and trifold sites
JWT_SECRET=
# Where 401s send the browser to sign in
AUTH_HUB_URL=https://auth.vpcc.church
```

- [ ] **Step 3: Copy design tokens verbatim and write `src/style.css`**

```bash
mkdir -p /Users/gilbertvirgo/vpcc-sunday-sheets/src/styles
cp /Users/gilbertvirgo/vpcc-v1/src/styles/{tokens.color,tokens.typography,tokens.layout,tokens.motion,base,utilities}.css /Users/gilbertvirgo/vpcc-sunday-sheets/src/styles/
```

`src/style.css` (same import order as vpcc-v1 `globals.css`):
```css
@import "tailwindcss";

@import "./styles/tokens.color.css";
@import "./styles/tokens.typography.css";
@import "./styles/tokens.layout.css";
@import "./styles/tokens.motion.css";
@import "./styles/base.css";
@import "./styles/utilities.css";
```

- [ ] **Step 4: Write `index.html`, `src/main.tsx`, placeholder `src/App.tsx`**

`index.html`:
```html
<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Sunday sheet · VPCC</title>
    <link rel="preconnect" href="https://use.typekit.net" crossorigin />
    <link rel="preconnect" href="https://p.typekit.net" crossorigin />
    <link rel="stylesheet" href="https://use.typekit.net/ccy7tqi.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` (placeholder, replaced in Task 10):
```tsx
export function App() {
  return <p className="p-8 text-body text-ink">Sunday sheet</p>;
}
```

- [ ] **Step 5: Vendor Inter static TTFs**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
curl -fsSL -o "$TMPDIR/inter.zip" https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
unzip -l "$TMPDIR/inter.zip" | grep -E 'Inter-(Regular|Bold)\.ttf$|LICENSE'
mkdir -p public/fonts
unzip -jo "$TMPDIR/inter.zip" 'extras/ttf/Inter-Regular.ttf' 'extras/ttf/Inter-Bold.ttf' 'LICENSE.txt' -d public/fonts
file public/fonts/*.ttf
```
Expected: the listing shows `extras/ttf/Inter-Regular.ttf`, `extras/ttf/Inter-Bold.ttf` and `LICENSE.txt` (if the paths differ, use the ones the listing shows). `file` prints `TrueType Font data` for both.

- [ ] **Step 6: Verify build and empty test run**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npm run build && grep -l "area-inktrap" dist/assets/*.css && ls dist/fonts && npx vitest run --passWithNoTests`
Expected: build succeeds. One CSS file is listed. `dist/fonts` shows `Inter-Bold.ttf Inter-Regular.ttf LICENSE.txt`. vitest reports "No test files found, exiting with code 0".

- [ ] **Step 7: Commit**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
git add .
git commit -m "chore: scaffold Vite React app with vpcc-v1 tokens and Inter fonts" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Shared types and date helpers

**Files:**
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/shared/types.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/shared/dates.ts`
- Test: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/shared/dates.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type SheetSection = { id: string; label: string; lines: string[] }`
  - `type SheetSong = { id: string; title: string; sections: SheetSection[]; sequence: string[]; attribution: string; ccli?: string }`
  - `type Notice = { title: string; day: string; time: string; location: string; description: string }`
  - `type SheetInput = { dateISO: string; time: string; songs: SheetSong[]; notices: string[]; rotateBack: boolean; fonts: { regular: Uint8Array; bold: Uint8Array } }`
  - `ISO_DATE: RegExp`, `addDays(iso, n): string`, `daysBetween(a, b): number`, `weekday(iso): string`, `longDate(iso): string`, `londonISO(d: Date): string`, `londonMidnight(iso): Date`, `nextSunday(now: Date): string`

- [ ] **Step 1: Write `src/shared/types.ts`**

```ts
export type SheetSection = { id: string; label: string; lines: string[] };

export type SheetSong = {
  id: string;
  title: string;
  sections: SheetSection[];
  /** Section ids in performance order; repeats allowed (the leaflet prints each once). */
  sequence: string[];
  attribution: string;
  ccli?: string;
};

export type Notice = {
  title: string;
  /** "Wednesday" */
  day: string;
  /** "7:30pm" or "" */
  time: string;
  location: string;
  description: string;
};

export type SheetInput = {
  /** YYYY-MM-DD */
  dateISO: string;
  /** Free text, e.g. "3:15pm" */
  time: string;
  songs: SheetSong[];
  /** One paragraph per entry. */
  notices: string[];
  rotateBack: boolean;
  /** Inter static TTF bytes. Passed in so buildPdf stays DOM- and fetch-free. */
  fonts: { regular: Uint8Array; bold: Uint8Array };
};
```

- [ ] **Step 2: Write the failing test**, `src/shared/dates.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { addDays, daysBetween, londonISO, londonMidnight, longDate, nextSunday, weekday } from "./dates";

describe("ISO day arithmetic", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-09-20", 6)).toBe("2026-09-26");
    expect(addDays("2026-09-28", 7)).toBe("2026-10-05");
  });
  it("counts whole days", () => {
    expect(daysBetween("2026-01-07", "2026-09-23")).toBe(259);
    expect(daysBetween("2026-09-23", "2026-09-20")).toBe(-3);
  });
  it("names weekdays", () => {
    expect(weekday("2026-09-20")).toBe("Sunday");
    expect(weekday("2026-09-23")).toBe("Wednesday");
  });
  it("formats the cover date without a comma", () => {
    expect(longDate("2026-09-20")).toBe("Sunday 20 September 2026");
  });
});

describe("Europe/London days", () => {
  it("finds midnight in BST and GMT", () => {
    expect(londonMidnight("2026-09-20").toISOString()).toBe("2026-09-19T23:00:00.000Z");
    expect(londonMidnight("2026-01-04").toISOString()).toBe("2026-01-04T00:00:00.000Z");
    expect(londonMidnight("2026-10-25").toISOString()).toBe("2026-10-24T23:00:00.000Z");
  });
  it("reads the London calendar day of an instant", () => {
    expect(londonISO(new Date("2026-09-22T23:00:00Z"))).toBe("2026-09-23");
    expect(londonISO(new Date("2026-01-07T00:00:00Z"))).toBe("2026-01-07");
  });
  it("defaults to the coming Sunday, or today on a Sunday", () => {
    expect(nextSunday(new Date("2026-09-23T12:00:00Z"))).toBe("2026-09-27");
    expect(nextSunday(new Date("2026-09-20T12:00:00Z"))).toBe("2026-09-20");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/shared/dates.test.ts`
Expected: FAIL, because the import `./dates` can't be resolved.

- [ ] **Step 4: Implement**, `src/shared/dates.ts`

```ts
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86_400_000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Treat a YYYY-MM-DD string as a UTC calendar day, so day arithmetic never meets DST. */
function utc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  return new Date(utc(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

export function weekday(iso: string): string {
  return DAYS[new Date(utc(iso)).getUTCDay()];
}

export function longDate(iso: string): string {
  const d = new Date(utc(iso));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const LONDON_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });
const LONDON_HOUR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  hourCycle: "h23",
});

/** The Europe/London calendar day an instant falls on, as YYYY-MM-DD. */
export function londonISO(d: Date): string {
  return LONDON_DAY.format(d);
}

/** The instant London's day `iso` starts. London is UTC+0 or UTC+1, so subtract the hour it shows at UTC midnight. */
export function londonMidnight(iso: string): Date {
  const guess = utc(iso);
  return new Date(guess - Number(LONDON_HOUR.format(new Date(guess))) * 3_600_000);
}

export function nextSunday(now: Date): string {
  const today = londonISO(now);
  const dow = new Date(utc(today)).getUTCDay();
  return addDays(today, dow === 0 ? 0 : 7 - dow);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/shared/dates.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
git add src/shared
git commit -m "feat: shared sheet types and London date helpers" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Session auth, guarded handler, `me` function

**Files:**
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/_shared/auth.ts` (verbatim hub copy)
- Test: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/_shared/auth.test.ts` (verbatim hub copy)
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/_shared/http.ts`
- Test: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/_shared/http.test.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/me.mts`

**Interfaces:**
- Consumes: `ISO_DATE` (Task 2); env `JWT_SECRET`, `AUTH_HUB_URL`
- Produces:
  - `type SessionUser = { id: string; username: string; role: string }`, `verifySession(req: Request): SessionUser | null`
  - `hubUrl(): string`, `unauthorized(): Response` (401 `{ error, hub }`), `badRequest(error: string): Response`, `dateParam(url: URL): string | null`
  - `guarded(handler: (url: URL) => Promise<Response>): (req: Request) => Promise<Response>` (405 non-GET, 401 no session, 500 on throw)
  - `GET /api/me` → 200 `{ user }` or 401 `{ error, hub }`

- [ ] **Step 1: Copy the hub's auth test**, `netlify/functions/_shared/auth.test.ts`

If `/Users/gilbertvirgo/vpcc-auth/netlify/functions/_shared/auth.test.ts` exists, copy it with `cp`. Otherwise write exactly this:

```ts
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCookie, cors, sessionCookie, verifySession } from "./auth";

const SECRET = "test-secret";
const USER = { id: "abc123", username: "admin", role: "admin" };

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("JWT_SECRET", SECRET);
});

describe("sessionCookie", () => {
  it("sets Domain and Secure on vpcc.church hosts", () => {
    expect(sessionCookie("tok", "auth.vpcc.church")).toBe(
      "vpcc_session=tok; Domain=.vpcc.church; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800",
    );
  });
  it("omits Domain and Secure on localhost", () => {
    expect(sessionCookie("tok", "localhost")).toBe(
      "vpcc_session=tok; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800",
    );
  });
  it("honours COOKIE_DOMAIN", () => {
    vi.stubEnv("COOKIE_DOMAIN", ".example.org");
    expect(sessionCookie("tok", "auth.example.org")).toBe(
      "vpcc_session=tok; Domain=.example.org; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800",
    );
  });
});

describe("clearCookie", () => {
  it("expires the cookie with matching attributes", () => {
    expect(clearCookie("auth.vpcc.church")).toBe(
      "vpcc_session=; Domain=.vpcc.church; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    );
    expect(clearCookie("localhost")).toBe(
      "vpcc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    );
  });
});

describe("cors", () => {
  const req = (origin?: string) =>
    new Request("https://auth.vpcc.church/api/me", {
      headers: origin ? { origin } : {},
    });

  it.each(["https://trifold.vpcc.church", "http://localhost:5173"])(
    "allows %s with credentials",
    (origin) => {
      const h = cors(req(origin));
      expect(h["Access-Control-Allow-Origin"]).toBe(origin);
      expect(h["Access-Control-Allow-Credentials"]).toBe("true");
    },
  );

  it.each([undefined, "https://evil.com", "https://evilvpcc.church", "null"])(
    "returns no headers for %s",
    (origin) => {
      expect(cors(req(origin))).toEqual({});
    },
  );
});

describe("verifySession", () => {
  const token = jwt.sign(USER, SECRET, { expiresIn: "7d" });
  const at = (headers: Record<string, string>) =>
    new Request("https://auth.vpcc.church/api/me", { headers });

  it("reads the cookie", () => {
    expect(verifySession(at({ cookie: `a=1; vpcc_session=${token}` }))).toEqual(USER);
  });
  it("reads a Bearer header", () => {
    expect(verifySession(at({ authorization: `Bearer ${token}` }))).toEqual(USER);
  });
  it("falls back to Bearer when the cookie is invalid", () => {
    expect(
      verifySession(at({ cookie: "vpcc_session=junk", authorization: `Bearer ${token}` })),
    ).toEqual(USER);
  });
  it("rejects a token signed with another secret", () => {
    const bad = jwt.sign(USER, "other");
    expect(verifySession(at({ cookie: `vpcc_session=${bad}` }))).toBeNull();
  });
  it("rejects an expired token", () => {
    const old = jwt.sign({ ...USER, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    expect(verifySession(at({ cookie: `vpcc_session=${old}` }))).toBeNull();
  });
  it("returns null with no credentials", () => {
    expect(verifySession(at({}))).toBeNull();
  });
  it("throws when JWT_SECRET is missing", () => {
    vi.stubEnv("JWT_SECRET", "");
    expect(() => verifySession(at({}))).toThrow("JWT_SECRET");
  });
});
```

- [ ] **Step 2: Write the failing http test**, `netlify/functions/_shared/http.test.ts`

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run netlify/functions/_shared`
Expected: FAIL, because the imports `./auth` and `./http` can't be resolved.

- [ ] **Step 4: Copy the hub's `auth.ts`**, `netlify/functions/_shared/auth.ts`

If `/Users/gilbertvirgo/vpcc-auth/netlify/functions/_shared/auth.ts` exists, `cp` it. Otherwise write exactly this:

```ts
// Copied verbatim into vpcc-sunday-sheets/netlify/functions/_shared/auth.ts. Keep self-contained.
import jwt from "jsonwebtoken";

export type SessionUser = { id: string; username: string; role: string };

const COOKIE = "vpcc_session";
const MAX_AGE = 604800; // 7 days, matches JWT expiresIn

function cookie(value: string, host: string, maxAge: number): string {
  const domain = process.env.COOKIE_DOMAIN || ".vpcc.church";
  const onDomain = host.endsWith(domain);
  const parts = [`${COOKIE}=${value}`];
  if (onDomain) parts.push(`Domain=${domain}`);
  parts.push("Path=/", "HttpOnly");
  if (onDomain) parts.push("Secure");
  parts.push("SameSite=Lax", `Max-Age=${maxAge}`);
  return parts.join("; ");
}

export function sessionCookie(token: string, host: string): string {
  return cookie(token, host, MAX_AGE);
}

export function clearCookie(host: string): string {
  return cookie("", host, 0);
}

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin) return {};
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return {};
  }
  if (!host.endsWith(".vpcc.church") && host !== "localhost") return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function verifySession(req: Request): SessionUser | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  for (const token of [readCookie(req.headers.get("cookie"), COOKIE), bearer]) {
    if (!token) continue;
    try {
      const p = jwt.verify(token, secret);
      if (typeof p === "string") continue;
      return { id: String(p.id), username: String(p.username), role: String(p.role) };
    } catch {
      // invalid or expired; try the next source
    }
  }
  return null;
}
```

If the hub copy differs from this code, keep the hub copy. The spec requires the two copies to be identical.

- [ ] **Step 5: Implement**, `netlify/functions/_shared/http.ts`

```ts
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
```

- [ ] **Step 6: Write `netlify/functions/me.mts`**

```ts
import { verifySession } from "./_shared/auth";
import { unauthorized } from "./_shared/http";

export default async (req: Request) => {
  const user = verifySession(req);
  return user ? Response.json({ user }) : unauthorized();
};
```

- [ ] **Step 7: Run tests and typecheck**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run netlify/functions/_shared && npx tsc --noEmit`
Expected: all `auth` and `http` tests PASS. `tsc` exits 0.

- [ ] **Step 8: Commit**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
git add netlify/functions
git commit -m "feat: session guard, me endpoint" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Mongo clients, notice selection, `notices` function

**Files:**
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/_shared/mongo.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/_shared/notices.ts`
- Test: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/_shared/notices.test.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/notices.mts`

**Interfaces:**
- Consumes: `Notice` (Task 2), `addDays`, `daysBetween`, `londonISO`, `londonMidnight`, `weekday` (Task 2), `guarded`, `dateParam`, `badRequest` (Task 3)
- Produces:
  - `calendarDb(): Promise<Db>` (DB name from the URI path, like calendar's mongoose), `praiseDb(): Promise<Db>` (`PRAISE_MONGODB_DB` or `praise_presenter`)
  - `type EventDoc`, `formatTime(t?: number[]): string`, `selectNotices(events: EventDoc[], sundayISO: string): Notice[]`
  - `GET /api/notices?date=YYYY-MM-DD` → `Notice[]`

Spec rule: "calendar `events`, `visibility:'public'`, dated Sunday through following Saturday (Europe/London days), plus weekly recurrences whose base date is earlier, `endDate` unset or ≥ window start, and window date not in `exceptions`. Returns `Notice[] = { title, day: 'Wednesday', time: '7:30pm'|'', location, description }` sorted by date/time."

- [ ] **Step 1: Write the failing test**, `netlify/functions/_shared/notices.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { type EventDoc, formatTime, selectNotices } from "./notices";

const d = (iso: string) => new Date(iso);

// Window: Sunday 20 Sept 2026 (BST) … Saturday 26 Sept. London midnight = 23:00Z the day before.
const events: EventDoc[] = [
  { title: "Prayer meeting", date: d("2026-01-07T00:00:00Z"), time: { start: [19, 30] }, visibility: "public", recursWeekly: true, location: "Church hall", description: "Bring a Bible." },
  { title: "Youth club", date: d("2026-01-09T00:00:00Z"), time: { start: [18, 0] }, visibility: "public", recursWeekly: true, recursionDetails: { exceptions: [d("2026-09-24T23:00:00Z")] } },
  { title: "Old study", date: d("2026-01-08T00:00:00Z"), visibility: "public", recursWeekly: true, recursionDetails: { endDate: d("2026-09-01T00:00:00Z") } },
  { title: "Future group", date: d("2026-10-01T00:00:00Z"), visibility: "public", recursWeekly: true },
  { title: "Harvest lunch", date: d("2026-09-19T23:00:00Z"), time: { start: [12, 0] }, visibility: "public", location: "Church hall", description: "Bring a dish." },
  { title: "Morning coffee", date: d("2026-09-22T23:00:00Z"), time: { start: [10, 0] }, visibility: "public" },
  { title: "Elders", date: d("2026-09-22T23:00:00Z"), time: { start: [20, 0] }, visibility: "private" },
  { title: "Last week", date: d("2026-09-12T23:00:00Z"), visibility: "public" },
  { title: "Next Sunday", date: d("2026-09-26T23:00:00Z"), visibility: "public" },
  { title: "Quiz night", date: d("2026-09-25T23:00:00Z"), time: { start: [], end: [] }, visibility: "public" },
];

describe("selectNotices", () => {
  it("keeps public events in the week, expands weekly recurrences, sorts by day then time", () => {
    expect(selectNotices(events, "2026-09-20")).toEqual([
      { title: "Harvest lunch", day: "Sunday", time: "12pm", location: "Church hall", description: "Bring a dish." },
      { title: "Morning coffee", day: "Wednesday", time: "10am", location: "", description: "" },
      { title: "Prayer meeting", day: "Wednesday", time: "7:30pm", location: "Church hall", description: "Bring a Bible." },
      { title: "Quiz night", day: "Saturday", time: "", location: "", description: "" },
    ]);
  });
  it("returns nothing for an empty calendar", () => {
    expect(selectNotices([], "2026-09-20")).toEqual([]);
  });
});

describe("formatTime", () => {
  it.each([
    [[19, 30], "7:30pm"],
    [[19, 0], "7pm"],
    [[0, 5], "12:05am"],
    [[12, 0], "12pm"],
    [[], ""],
    [undefined, ""],
  ])("%j → %s", (t, want) => {
    expect(formatTime(t as number[] | undefined)).toBe(want);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run netlify/functions/_shared/notices.test.ts`
Expected: FAIL, because the import `./notices` can't be resolved.

- [ ] **Step 3: Implement**, `netlify/functions/_shared/notices.ts`

```ts
import { addDays, daysBetween, londonISO, weekday } from "../../../src/shared/dates";
import type { Notice } from "../../../src/shared/types";

/** Shape of calendar `events` documents (see vpcc-calendar/netlify/functions/models/Event.js). */
export type EventDoc = {
  title: string;
  date: Date;
  time?: { start?: number[]; end?: number[] };
  visibility?: string;
  recursWeekly?: boolean;
  recursionDetails?: { endDate?: Date | null; exceptions?: Date[] };
  location?: string;
  description?: string;
};

export function formatTime(t?: number[]): string {
  if (!t || t.length < 2) return "";
  const [h, m] = t;
  const mins = m ? `:${String(m).padStart(2, "0")}` : "";
  return `${h % 12 || 12}${mins}${h < 12 ? "am" : "pm"}`;
}

/** Events on the 7 London days starting `sundayISO`, weekly recurrences expanded. */
export function selectNotices(events: EventDoc[], sundayISO: string): Notice[] {
  const days = Array.from({ length: 7 }, (_, i) => addDays(sundayISO, i));
  const hits: Array<{ day: string; minutes: number; ev: EventDoc }> = [];

  for (const ev of events) {
    if (ev.visibility === "private") continue;
    const base = londonISO(ev.date);
    const rec = ev.recursionDetails ?? {};
    const end = rec.endDate ? londonISO(rec.endDate) : null;
    const skip = new Set((rec.exceptions ?? []).map(londonISO));

    for (const day of days) {
      const gap = daysBetween(base, day);
      const on = ev.recursWeekly
        ? gap >= 0 && gap % 7 === 0 && (!end || day <= end) && !skip.has(day)
        : gap === 0;
      if (on) {
        const [h = 0, m = 0] = ev.time?.start ?? [];
        hits.push({ day, minutes: h * 60 + m, ev });
      }
    }
  }

  hits.sort((a, b) => a.day.localeCompare(b.day) || a.minutes - b.minutes);
  return hits.map(({ day, ev }) => ({
    title: ev.title,
    day: weekday(day),
    time: formatTime(ev.time?.start),
    location: ev.location ?? "",
    description: ev.description ?? "",
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run netlify/functions/_shared/notices.test.ts`
Expected: PASS

- [ ] **Step 5: Write `netlify/functions/_shared/mongo.ts`**

```ts
import { type Db, MongoClient } from "mongodb";

// One client per URI per warm container. A failed connect is evicted so the next call retries.
const clients = new Map<string, Promise<MongoClient>>();

function connect(envName: string): Promise<MongoClient> {
  const uri = process.env[envName];
  if (!uri) throw new Error(`${envName} not set`);
  let client = clients.get(uri);
  if (!client) {
    client = new MongoClient(uri, { maxPoolSize: 1, maxIdleTimeMS: 60_000, serverSelectionTimeoutMS: 10_000 })
      .connect()
      .catch((err) => {
        clients.delete(uri);
        throw err;
      });
    clients.set(uri, client);
  }
  return client;
}

/** DB name comes from the URI path, as calendar's mongoose connection does. */
export const calendarDb = async (): Promise<Db> => (await connect("CALENDAR_MONGODB_URI")).db();

export const praiseDb = async (): Promise<Db> =>
  (await connect("PRAISE_MONGODB_URI")).db(process.env.PRAISE_MONGODB_DB || "praise_presenter");
```

- [ ] **Step 6: Write `netlify/functions/notices.mts`**

```ts
import { addDays, londonMidnight } from "../../src/shared/dates";
import { badRequest, dateParam, guarded } from "./_shared/http";
import { calendarDb } from "./_shared/mongo";
import { type EventDoc, selectNotices } from "./_shared/notices";

export default guarded(async (url) => {
  const date = dateParam(url);
  if (!date) return badRequest("date=YYYY-MM-DD required");
  const start = londonMidnight(date);
  const end = londonMidnight(addDays(date, 7));

  const events = await (await calendarDb())
    .collection<EventDoc>("events")
    .find({
      visibility: "public",
      $or: [
        { date: { $gte: start, $lt: end } },
        {
          recursWeekly: true,
          date: { $lt: start },
          $or: [
            { "recursionDetails.endDate": { $exists: false } },
            { "recursionDetails.endDate": null },
            { "recursionDetails.endDate": { $gte: start } },
          ],
        },
      ],
    })
    .toArray();

  return Response.json(selectNotices(events, date));
});
```

- [ ] **Step 7: Typecheck and run all tests**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx tsc --noEmit && npx vitest run`
Expected: `tsc` exits 0. All tests PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
git add netlify/functions
git commit -m "feat: notices endpoint with weekly recurrence selection" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `service` and `songs` functions

**Files:**
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/_shared/sheet-song.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/service.mts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/netlify/functions/songs.mts`

**Interfaces:**
- Consumes: `SheetSong`, `SheetSection` (Task 2), `addDays`, `londonMidnight` (Task 2), `guarded`, `dateParam`, `badRequest` (Task 3), `praiseDb` (Task 4)
- Produces:
  - `type SongBlockDoc`, `type SongDoc`, `fromBlock(b: SongBlockDoc, ccli?: string): SheetSong`, `fromSongDoc(d: SongDoc): SheetSong`
  - `GET /api/service?date=YYYY-MM-DD` → `{ found: boolean; songs: SheetSong[] }`
  - `GET /api/songs?q=` → `SheetSong[]` (max 20)

Facts from praise-pres: `_id` values are strings. `services.date` is written as a BSON `Date` at 10:00 local (`services.mts`: `new Date(body.data.date)`). The spec says also handle epoch ms. Soft-deleted services have `deletedAt` set. Songs have a `$text` index on `title`, `author`, `attribution`. CCLI lives at `rights.ccli`.

These are thin DB adapters with no branching logic worth a unit test. They get smoke-tested against the real databases in Task 11.

- [ ] **Step 1: Write `netlify/functions/_shared/sheet-song.ts`**

```ts
import type { SheetSection, SheetSong } from "../../../src/shared/types";

/** A `kind:'song'` block inside a praise-pres service: a snapshot of the library song. */
export type SongBlockDoc = {
  kind: "song";
  id: string;
  title: string;
  songId?: string;
  sections: SheetSection[];
  sequence: string[];
  attribution?: string;
};

/** A praise-pres `songs` document (fields we read). */
export type SongDoc = {
  _id: string;
  title: string;
  sections: SheetSection[];
  defaultSequence: string[];
  attribution: string;
  rights?: { status?: string; ccli?: string };
};

export const fromBlock = (b: SongBlockDoc, ccli?: string): SheetSong => ({
  id: b.id,
  title: b.title,
  sections: b.sections ?? [],
  sequence: b.sequence ?? [],
  attribution: b.attribution ?? "",
  ...(ccli ? { ccli } : {}),
});

export const fromSongDoc = (d: SongDoc): SheetSong => ({
  id: d._id,
  title: d.title,
  sections: d.sections ?? [],
  sequence: d.defaultSequence ?? [],
  attribution: d.attribution ?? "",
  ...(d.rights?.ccli ? { ccli: d.rights.ccli } : {}),
});
```

- [ ] **Step 2: Write `netlify/functions/service.mts`**

```ts
import { addDays, londonMidnight } from "../../src/shared/dates";
import { badRequest, dateParam, guarded } from "./_shared/http";
import { praiseDb } from "./_shared/mongo";
import { fromBlock, type SongBlockDoc, type SongDoc } from "./_shared/sheet-song";

type ServiceDoc = {
  _id: string;
  date?: Date | number;
  blocks: Array<{ kind: string }>;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export default guarded(async (url) => {
  const date = dateParam(url);
  if (!date) return badRequest("date=YYYY-MM-DD required");
  const start = londonMidnight(date);
  const end = londonMidnight(addDays(date, 1));

  const db = await praiseDb();
  // `date` is a BSON Date today; older writers may have stored epoch ms. Match either.
  const service = await db.collection<ServiceDoc>("services").findOne(
    {
      deletedAt: null,
      $or: [
        { date: { $gte: start, $lt: end } },
        { date: { $gte: start.getTime(), $lt: end.getTime() } },
      ],
    },
    { sort: { updatedAt: -1 } },
  );
  if (!service) return Response.json({ found: false, songs: [] });

  const blocks = service.blocks.filter((b): b is SongBlockDoc => b.kind === "song");
  const ids = blocks.flatMap((b) => (b.songId ? [b.songId] : []));
  const library = ids.length
    ? await db
        .collection<SongDoc>("songs")
        .find({ _id: { $in: ids } }, { projection: { rights: 1 } })
        .toArray()
    : [];
  const ccli = new Map(library.map((s) => [s._id, s.rights?.ccli]));

  return Response.json({
    found: true,
    songs: blocks.map((b) => fromBlock(b, b.songId ? ccli.get(b.songId) : undefined)),
  });
});
```

- [ ] **Step 3: Write `netlify/functions/songs.mts`**

```ts
import { guarded } from "./_shared/http";
import { praiseDb } from "./_shared/mongo";
import { fromSongDoc, type SongDoc } from "./_shared/sheet-song";

const PROJECTION = { title: 1, sections: 1, defaultSequence: 1, attribution: 1, rights: 1 };
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default guarded(async (url) => {
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return Response.json([]);
  const songs = (await praiseDb()).collection<SongDoc>("songs");

  let docs = await songs
    .find(
      { $text: { $search: q } },
      { projection: { ...PROJECTION, score: { $meta: "textScore" } }, sort: { score: { $meta: "textScore" } }, limit: 20 },
    )
    .toArray();
  // $text matches whole words only; fall back to a title substring so "amaz" finds "Amazing Grace".
  if (!docs.length) {
    docs = await songs
      .find({ title: { $regex: escapeRegex(q), $options: "i" } }, { projection: PROJECTION, sort: { title: 1 }, limit: 20 })
      .toArray();
  }
  return Response.json(docs.map(fromSongDoc));
});
```

- [ ] **Step 4: Typecheck and run all tests**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx tsc --noEmit && npx vitest run`
Expected: `tsc` exits 0. All existing tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
git add netlify/functions
git commit -m "feat: service and songs endpoints from praise-pres" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: PDF geometry, word wrap, fit search

**Files:**
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/geometry.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/measure.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/fit.ts`
- Test: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/fit.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `PAGE_W = 841.89`, `PAGE_H = 595.28`, `PANEL_W = PAGE_W / 3`, `PAD = 20`, `CONTENT_W`, `CONTENT_H`, `COVER_H = 150`, `FOOTER_H = 110`
  - `type PanelId = "A" | "B" | "C" | "D" | "E" | "back"`, `FLOW_ORDER: PanelId[] = ["A","C","B","D","E"]`
  - `panelOrigin(id): { page: 0 | 1; x: number; top: number }` (x = content left, top = content top in PDF coords)
  - `capacity(id): { top: number; cap: number }` (offset below content top where flow starts, and usable height)
  - `type Measure = (text: string, bold: boolean, size: number) => number`, `wrap(text, maxWidth, width: (t: string) => number): string[]`
  - `BASE_SIZE = 10`, `MIN_SIZE = 7`, `fitScale(overflowsAt: (s: number) => boolean): { size: number; fits: boolean }`

Spec rules: "A4 landscape 841.89 × 595.28 pt, 2 pages, 3 equal panels each (280.63 pt), panel padding 20 pt, columns never cross panel folds." "Page 1: left = flow panel B, middle = **back panel**, right = **cover** (flow panel A). Page 2: left = flow panel C, middle = flow panel D, right = flow panel E." Fit: "base lyric size 10 pt … If flow overflows panel E or notices overflow back panel, binary-search s in [7, 10] to 0.25 pt. Below 7 → render at 7 and report `fits:false` to UI."

- [ ] **Step 1: Write the failing test**, `src/pdf/fit.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { fitScale } from "./fit";
import { wrap } from "./measure";

const width = (t: string) => t.length; // 1 pt per character

describe("wrap", () => {
  it("breaks on spaces within the width", () => {
    expect(wrap("aa bb cc dd", 5, width)).toEqual(["aa bb", "cc dd"]);
  });
  it("keeps an over-long word on its own line", () => {
    expect(wrap("a verylongword b", 5, width)).toEqual(["a", "verylongword", "b"]);
  });
  it("collapses whitespace and keeps empty lines", () => {
    expect(wrap("  a \t b ", 10, width)).toEqual(["a b"]);
    expect(wrap("", 10, width)).toEqual([""]);
  });
});

describe("fitScale", () => {
  it("uses 10 pt when everything fits", () => {
    expect(fitScale(() => false)).toEqual({ size: 10, fits: true });
  });
  it("binary-searches to the largest quarter point that fits", () => {
    const calls: number[] = [];
    const result = fitScale((s) => {
      calls.push(s);
      return s > 8.3;
    });
    expect(result).toEqual({ size: 8.25, fits: true });
    expect(calls.length).toBeLessThanOrEqual(7);
  });
  it("renders at 7 and reports fits:false below the floor", () => {
    expect(fitScale(() => true)).toEqual({ size: 7, fits: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/pdf/fit.test.ts`
Expected: FAIL, because the imports `./fit` and `./measure` can't be resolved.

- [ ] **Step 3: Write `src/pdf/geometry.ts`**

```ts
export const PAGE_W = 841.89;
export const PAGE_H = 595.28;
export const PANEL_W = PAGE_W / 3; // 280.63
export const PAD = 20;
export const CONTENT_W = PANEL_W - 2 * PAD;
export const CONTENT_H = PAGE_H - 2 * PAD;
/** Cover header (logo, title, date, time) at the top of panel A; flow starts below it. */
export const COVER_H = 150;
/** Bottom-anchored footer (QR, address, CCLI line) of the back panel. */
export const FOOTER_H = 110;

export type PanelId = "A" | "B" | "C" | "D" | "E" | "back";

/** Page 1: B | back | A(cover). Page 2: C | D | E. */
const SLOT: Record<PanelId, { page: 0 | 1; col: 0 | 1 | 2 }> = {
  B: { page: 0, col: 0 },
  back: { page: 0, col: 1 },
  A: { page: 0, col: 2 },
  C: { page: 1, col: 0 },
  D: { page: 1, col: 1 },
  E: { page: 1, col: 2 },
};

/** [p1.right, p2.left, p1.left, p2.middle, p2.right] */
export const FLOW_ORDER: PanelId[] = ["A", "C", "B", "D", "E"];

export function panelOrigin(id: PanelId): { page: 0 | 1; x: number; top: number } {
  const { page, col } = SLOT[id];
  return { page, x: col * PANEL_W + PAD, top: PAGE_H - PAD };
}

export function capacity(id: PanelId): { top: number; cap: number } {
  if (id === "A") return { top: COVER_H, cap: CONTENT_H - COVER_H };
  if (id === "back") return { top: 0, cap: CONTENT_H - FOOTER_H };
  return { top: 0, cap: CONTENT_H };
}
```

- [ ] **Step 4: Write `src/pdf/measure.ts`**

```ts
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
```

- [ ] **Step 5: Write `src/pdf/fit.ts`**

```ts
export const BASE_SIZE = 10;
export const MIN_SIZE = 7;

/** Largest lyric size in [7, 10], in 0.25 pt steps, at which nothing overflows. Floor → { 7, fits:false }. */
export function fitScale(overflowsAt: (s: number) => boolean): { size: number; fits: boolean } {
  if (!overflowsAt(BASE_SIZE)) return { size: BASE_SIZE, fits: true };
  if (overflowsAt(MIN_SIZE)) return { size: MIN_SIZE, fits: false };
  // Search in quarter points: lo always fits, hi always overflows.
  let lo = MIN_SIZE * 4;
  let hi = BASE_SIZE * 4;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (overflowsAt(mid / 4)) hi = mid;
    else lo = mid;
  }
  return { size: lo / 4, fits: true };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/pdf/fit.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
git add src/pdf
git commit -m "feat: trifold geometry, word wrap and fit search" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Flow layout (pure)

**Files:**
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/flow.ts`
- Test: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/layout.test.ts`

**Interfaces:**
- Consumes: `SheetSong`, `SheetSection` (Task 2); `CONTENT_W`, `FLOW_ORDER`, `capacity`, `PanelId` (Task 6); `Measure`, `wrap` (Task 6)
- Produces:
  - `type TextItem = { kind: "text"; panel: PanelId; x: number; y: number; text: string; size: number; bold: boolean; muted: boolean }` (x from content left, y = baseline distance down from content top)
  - `type RuleItem = { kind: "rule"; panel: PanelId; x: number; y: number; w: number }`
  - `type Item = TextItem | RuleItem`, `type Layout = { items: Item[]; overflow: boolean }`
  - `SERMON_LINES = 8`, `sectionOrder(song): SheetSection[]`, `creditLines(song): string[]`
  - `layoutFlow(songs, s, m): Layout`, `layoutNotices(paragraphs, s, m): Layout`, `layoutSheet(songs, notices, s, m): Layout`

Spec rules, verbatim: "Flow order: A (cover, below header block) → C → B → D → E." "Flow content, in order: songs 1..n, then sermon notes block (heading "Sermon notes" + 8 ruled lines, kept together). Each song: `"{n}. {title}"` bold, sections in `sequence` order with label (small caps/bold small) and lines, then credit line small grey: `attribution` (+ ` · CCLI Song #{ccli}` if not already contained)." "print each section once, in first-occurrence order (leaflet, not slides)." "Lay out at size s (line-height 1.25s, headings scale with s)." "Song blocks may split across panels but never mid-section; a section that cannot fit in remaining panel space moves to next panel." Back panel: "Notices" heading + notice paragraphs (auto-shrink shares the same scale factor).

Typography at scale `s`: lyric `s`, line height `1.25s`; song title and headings `1.3s` bold; non-verse labels `0.85s` bold on their own line; "Verse N" prints `N` bold in a hanging gutter of `1.8s` (as in the reference PDF); credit `0.8s` grey, indented. Gaps: `1.6s` before a song or the sermon block, `0.6s` before a section, credit or notice paragraph. A song title is kept with its first section.

- [ ] **Step 1: Write the failing test**, `src/pdf/layout.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { SheetSong } from "../shared/types";
import { creditLines, type Item, layoutFlow, layoutSheet, sectionOrder } from "./flow";
import { FLOW_ORDER, PAD, PANEL_W, panelOrigin } from "./geometry";
import type { Measure } from "./measure";

/** Fake metrics: every glyph is half an em wide. */
const m: Measure = (t, _bold, size) => t.length * size * 0.5;

function song(n: number, sections: number, lines: number): SheetSong {
  const secs = Array.from({ length: sections }, (_, j) => ({
    id: `v${j + 1}`,
    label: `Verse ${j + 1}`,
    lines: Array.from({ length: lines }, (_, i) => `L${n}.${j} la la ${i}`),
  }));
  return { id: `s${n}`, title: `Song ${n}`, sections: secs, sequence: secs.map((s) => s.id), attribution: "Writer" };
}

const panelOf = (items: Item[], text: string) =>
  items.find((i) => i.kind === "text" && i.text === text)?.panel;

describe("(a) panel assignment order", () => {
  it("maps flow order to p1.right, p2.left, p1.left, p2.middle, p2.right", () => {
    const slots = FLOW_ORDER.map((id) => {
      const o = panelOrigin(id);
      return [o.page, Math.round((o.x - PAD) / PANEL_W)];
    });
    expect(slots).toEqual([[0, 2], [1, 0], [0, 0], [1, 1], [1, 2]]);
  });

  it("fills panels A, C, B, D, E in turn", () => {
    const { items, overflow } = layoutFlow([1, 2, 3, 4].map((n) => song(n, 2, 14)), 10, m);
    expect(overflow).toBe(false);
    expect([1, 2, 3, 4].map((n) => panelOf(items, `${n}. Song ${n}`))).toEqual(["A", "C", "B", "D"]);
    expect(panelOf(items, "Sermon notes")).toBe("E");
    expect(items.some((i) => i.panel === "back")).toBe(false);
  });
});

describe("(b) keep-together rules", () => {
  it("never splits the sermon notes block", () => {
    for (let k = 1; k <= 30; k++) {
      const { items } = layoutFlow([song(1, 1, k), song(2, 3, 10)], 10, m);
      const sermon = items.filter((i) => i.kind === "rule" || i.text === "Sermon notes");
      expect(sermon).toHaveLength(9);
      expect(new Set(sermon.map((i) => i.panel)).size).toBe(1);
    }
  });

  it("never splits a section across panels", () => {
    const { items } = layoutFlow([1, 2, 3].map((n) => song(n, 5, 9)), 10, m);
    const panelsBySection = new Map<string, Set<string>>();
    for (const i of items) {
      if (i.kind !== "text" || !/^L\d+\.\d+ /.test(i.text)) continue;
      const key = i.text.split(" ")[0];
      panelsBySection.set(key, (panelsBySection.get(key) ?? new Set()).add(i.panel));
    }
    expect(panelsBySection.size).toBe(15);
    for (const panels of panelsBySection.values()) expect(panels.size).toBe(1);
    // …while songs themselves do split.
    const song1Panels = new Set(items.filter((i) => i.kind === "text" && i.text.startsWith("L1.")).map((i) => i.panel));
    expect(song1Panels.size).toBeGreaterThan(1);
  });
});

describe("(c) overflow drives shrink", () => {
  it("overflows at 10 pt but fits at 7 pt", () => {
    const songs = [1, 2, 3, 4, 5].map((n) => song(n, 2, 14));
    expect(layoutSheet(songs, [], 10, m).overflow).toBe(true);
    expect(layoutSheet(songs, [], 7, m).overflow).toBe(false);
  });
  it("flags notices that overflow the back panel", () => {
    const notices = Array.from({ length: 40 }, (_, i) => `Notice ${i} with some words`);
    expect(layoutSheet([], notices, 10, m).overflow).toBe(true);
    expect(layoutSheet([], notices.slice(0, 5), 10, m).overflow).toBe(false);
    const placed = layoutSheet([], notices.slice(0, 5), 10, m).items;
    expect(panelOf(placed, "Notices")).toBe("back");
  });
});

describe("sectionOrder", () => {
  const base: SheetSong = {
    id: "x",
    title: "X",
    attribution: "",
    sections: [
      { id: "v1", label: "Verse 1", lines: [] },
      { id: "c", label: "Chorus", lines: [] },
      { id: "v2", label: "Verse 2", lines: [] },
    ],
    sequence: ["v1", "c", "v2", "c", "c", "missing"],
  };
  it("prints each section once, in first-occurrence order", () => {
    expect(sectionOrder(base).map((s) => s.label)).toEqual(["Verse 1", "Chorus", "Verse 2"]);
  });
  it("falls back to section order when sequence is empty", () => {
    expect(sectionOrder({ ...base, sequence: [] }).map((s) => s.id)).toEqual(["v1", "c", "v2"]);
  });
});

describe("creditLines", () => {
  const s = (attribution: string, ccli?: string): SheetSong => ({ id: "x", title: "X", sections: [], sequence: [], attribution, ccli });
  it("appends the CCLI number to the last line", () => {
    expect(creditLines(s("Paul Oakley\n© 1995 Thankyou Music Ltd.", "1585987"))).toEqual([
      "Paul Oakley",
      "© 1995 Thankyou Music Ltd. · CCLI Song #1585987",
    ]);
  });
  it("does not repeat a CCLI number already present", () => {
    expect(creditLines(s("John Newton\nPublic Domain. CCLI Song #2762836", "2762836"))).toEqual([
      "John Newton",
      "Public Domain. CCLI Song #2762836",
    ]);
  });
  it("handles missing parts", () => {
    expect(creditLines(s("", "123"))).toEqual(["CCLI Song #123"]);
    expect(creditLines(s(""))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/pdf/layout.test.ts`
Expected: FAIL, because the import `./flow` can't be resolved.

- [ ] **Step 3: Implement**, `src/pdf/flow.ts`

```ts
import type { SheetSection, SheetSong } from "../shared/types";
import { CONTENT_W, FLOW_ORDER, type PanelId, capacity } from "./geometry";
import { type Measure, wrap } from "./measure";

/** x from panel content left; y = baseline (text) or line (rule) distance down from content top. */
export type TextItem = { kind: "text"; panel: PanelId; x: number; y: number; text: string; size: number; bold: boolean; muted: boolean };
export type RuleItem = { kind: "rule"; panel: PanelId; x: number; y: number; w: number };
export type Item = TextItem | RuleItem;
export type Layout = { items: Item[]; overflow: boolean };

type Piece = Omit<TextItem, "panel"> | Omit<RuleItem, "panel">;
/** An unbreakable block. `gap` is dropped at the top of a panel. */
type Unit = { h: number; gap: number; pieces: Piece[]; keepWithNext?: boolean };

export const SERMON_LINES = 8;
const BASELINE = 0.8; // baseline sits 80% down a line box

const text = (t: string, x: number, y: number, size: number, bold = false, muted = false): Piece => ({
  kind: "text", x, y, text: t, size, bold, muted,
});

const block = (lines: string[], x: number, size: number, lh: number, y0: number, bold = false, muted = false): Piece[] =>
  lines.map((l, i) => text(l, x, y0 + (i + BASELINE) * lh, size, bold, muted));

/** Each section once, in first-occurrence order of `sequence` (or section order if empty). */
export function sectionOrder(song: SheetSong): SheetSection[] {
  const byId = new Map(song.sections.map((s) => [s.id, s]));
  const ids = song.sequence.length ? song.sequence : song.sections.map((s) => s.id);
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
}

export function creditLines(song: SheetSong): string[] {
  let credit = song.attribution.trim();
  if (song.ccli && !credit.includes(song.ccli)) {
    credit = credit ? `${credit} · CCLI Song #${song.ccli}` : `CCLI Song #${song.ccli}`;
  }
  return credit ? credit.split(/\n+/) : [];
}

function songUnits(song: SheetSong, n: number, s: number, m: Measure): Unit[] {
  const lh = 1.25 * s;
  const indent = 1.8 * s;
  const bodyW = CONTENT_W - indent;
  const ts = 1.3 * s;
  const title = wrap(`${n}. ${song.title}`, CONTENT_W, (t) => m(t, true, ts));
  const units: Unit[] = [
    { gap: 1.6 * s, keepWithNext: true, h: title.length * 1.25 * ts, pieces: block(title, 0, ts, 1.25 * ts, 0, true) },
  ];

  for (const sec of sectionOrder(song)) {
    const verse = /^verse\s*(\d+)$/i.exec(sec.label.trim());
    const labelH = verse ? 0 : lh;
    const body = sec.lines.flatMap((l) => wrap(l, bodyW, (t) => m(t, false, s)));
    const label = verse
      ? text(verse[1], 0, BASELINE * lh, s, true)
      : text(sec.label, 0, BASELINE * lh, 0.85 * s, true);
    units.push({
      gap: 0.6 * s,
      h: labelH + Math.max(body.length, 1) * lh,
      pieces: [label, ...block(body, indent, s, lh, labelH)],
    });
  }

  const cs = 0.8 * s;
  const credit = creditLines(song).flatMap((l) => wrap(l, bodyW, (t) => m(t, false, cs)));
  if (credit.length) {
    units.push({ gap: 0.6 * s, h: credit.length * 1.25 * cs, pieces: block(credit, indent, cs, 1.25 * cs, 0, false, true) });
  }
  return units;
}

function sermonUnit(s: number): Unit {
  const hs = 1.3 * s;
  const head = 1.25 * hs;
  const step = 2.5 * s;
  const rules: Piece[] = Array.from({ length: SERMON_LINES }, (_, i) => ({
    kind: "rule", x: 0, y: head + (i + 1) * step, w: CONTENT_W,
  }));
  return { gap: 1.6 * s, h: head + SERMON_LINES * step, pieces: [text("Sermon notes", 0, BASELINE * head, hs, true), ...rules] };
}

/** Pour units into panels in order. A unit that does not fit the space left moves to the next panel. */
function place(units: Unit[], panels: PanelId[]): Layout {
  const items: Item[] = [];
  let p = 0;
  let used = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const next = u.keepWithNext ? units[i + 1] : undefined;
    const need = (used ? u.gap : 0) + u.h + (next ? next.gap + next.h : 0);
    if (used && used + need > capacity(panels[p]).cap) {
      p++;
      used = 0;
    }
    if (p >= panels.length) return { items, overflow: true };
    const { top, cap } = capacity(panels[p]);
    const y = used ? used + u.gap : 0;
    for (const piece of u.pieces) items.push({ ...piece, panel: panels[p], y: top + y + piece.y } as Item);
    used = y + u.h;
    if (used > cap) return { items, overflow: true }; // taller than an empty panel
  }
  return { items, overflow: false };
}

export function layoutFlow(songs: SheetSong[], s: number, m: Measure): Layout {
  const units = [...songs.flatMap((song, i) => songUnits(song, i + 1, s, m)), sermonUnit(s)];
  return place(units, FLOW_ORDER);
}

export function layoutNotices(paragraphs: string[], s: number, m: Measure): Layout {
  if (!paragraphs.length) return { items: [], overflow: false };
  const lh = 1.25 * s;
  const hs = 1.3 * s;
  const units: Unit[] = [
    { gap: 0, keepWithNext: true, h: 1.25 * hs, pieces: [text("Notices", 0, BASELINE * 1.25 * hs, hs, true)] },
    ...paragraphs.map((para) => {
      const lines = wrap(para, CONTENT_W, (t) => m(t, false, s));
      return { gap: 0.6 * s, h: lines.length * lh, pieces: block(lines, 0, s, lh, 0) };
    }),
  ];
  return place(units, ["back"]);
}

export function layoutSheet(songs: SheetSong[], notices: string[], s: number, m: Measure): Layout {
  const flow = layoutFlow(songs, s, m);
  const back = layoutNotices(notices, s, m);
  return { items: [...flow.items, ...back.items], overflow: flow.overflow || back.overflow };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/pdf/layout.test.ts`
Expected: PASS (all describe blocks: (a), (b), (c), sectionOrder, creditLines)

- [ ] **Step 5: Commit**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
git add src/pdf/flow.ts src/pdf/layout.test.ts
git commit -m "feat: pure trifold flow layout with keep-together rules" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Vector marks (logo + QR)

**Files:**
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/marks.ts`
- Test: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/marks.test.ts`

**Interfaces:**
- Consumes: `pdf-lib`, `qrcode`
- Produces:
  - `LOGO_PATH: string` (from `/Users/gilbertvirgo/vpcc-v1/src/components/brand/logo.tsx`, viewBox 0 0 100 100)
  - `pathOperators(d: string): PDFOperator[]` (absolute M/L/H/V/C/Z only; throws `Unsupported SVG path command` otherwise)
  - `drawLogo(page: PDFPage, x: number, top: number, size: number, color: Color): void`
  - `drawQr(page: PDFPage, value: string, x: number, y: number, size: number, color: Color): void` (y = bottom edge)

Why not `page.drawSvgPath`: the mark uses `fill-rule="evenodd"`, so the letters are knocked out of the disc. pdf-lib's `drawSvgPath` fills with nonzero (`f`), which would paint the letters solid. This task emits the same path with `f*` (even-odd). The QR is drawn as vector rectangles from `QRCode.create`, so `buildPdf` needs no canvas or PNG.

- [ ] **Step 1: Write the failing test**, `src/pdf/marks.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/pdf/marks.test.ts`
Expected: FAIL, because the import `./marks` can't be resolved.

- [ ] **Step 3: Implement**, `src/pdf/marks.ts`

```ts
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
```

If `tsc` reports that any of these pdf-lib names isn't exported, check `node_modules/pdf-lib/cjs/api/operators.d.ts` and `node_modules/pdf-lib/cjs/core/operators/PDFOperatorNames.d.ts` for the exact name (`FillEvenOdd` = `f*`).

- [ ] **Step 4: Run test and typecheck**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/pdf/marks.test.ts && npx tsc --noEmit`
Expected: PASS. `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
git add src/pdf/marks.ts src/pdf/marks.test.ts
git commit -m "feat: vector VPCC logo (even-odd) and QR for PDF" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Render and `buildPdf`

**Files:**
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/render.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/build.ts`
- Modify: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/layout.test.ts` (add imports at top; append `buildPdf` block)

**Interfaces:**
- Consumes: `SheetInput` (Task 2), `longDate` (Task 2), geometry + `wrap` + `Measure` + `fitScale` (Task 6), `Item`, `layoutSheet` (Task 7), `drawLogo`, `drawQr` (Task 8)
- Produces:
  - `type Fonts = { regular: PDFFont; bold: PDFFont }`, `CCLI_TEXT`, `ADDRESS`, `renderSheet(pages: PDFPage[], fonts: Fonts, items: Item[], input: Pick<SheetInput, "dateISO" | "time">): void`
  - `buildPdf(input: SheetInput): Promise<{ bytes: Uint8Array; fits: boolean }>`

Spec rules, verbatim: "Cover header: VPCC logo …, "Sunday Worship", long date ("Sunday 20 September 2026"), time." "Back panel (p1 middle): "Notices" heading + notice paragraphs …, then bottom-anchored footer: CCLI line "Lyrics reproduced under CCLI Licence No. 22249187. For use solely with the SongSelect® Terms of Use. All rights reserved. www.ccli.com", QR to `https://vpcc.church`, "vpcc.church / Victoria Park Baptist Church / Grove Road, London E3 5TG"." "Duplex: when rotate flag true, set page 2 `Rotate` to 180 (`page.setRotation(degrees(180))`)." "`buildPdf(input: SheetInput): Promise<{ bytes: Uint8Array, fits: boolean }>` — pure, no DOM." Tests (c), (d), (e): "overflow triggers shrink and `fits:false` at floor, rotate flag sets page 2 rotation, 0 songs still produces valid 2-page PDF."

- [ ] **Step 1: Add the failing tests to `src/pdf/layout.test.ts`**

Add to the imports at the top of the file:
```ts
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { buildPdf } from "./build";
```

Append at the end of the file:
```ts
const fonts = {
  regular: readFileSync(new URL("../../public/fonts/Inter-Regular.ttf", import.meta.url)),
  bold: readFileSync(new URL("../../public/fonts/Inter-Bold.ttf", import.meta.url)),
};
const sheet = (songs: SheetSong[], rotateBack = true, notices: string[] = []) => ({
  dateISO: "2026-09-20",
  time: "3:15pm",
  songs,
  notices,
  rotateBack,
  fonts,
});

describe("buildPdf", () => {
  it("(c) shrinks to fit, and reports fits:false at the 7 pt floor", async () => {
    const many = Array.from({ length: 30 }, (_, i) => song(i + 1, 4, 12));
    expect((await buildPdf(sheet(many))).fits).toBe(false);
    expect((await buildPdf(sheet(many.slice(0, 3), true, ["Prayer meeting — Wednesday 7:30pm."]))).fits).toBe(true);
  }, 30_000);

  it("(d) rotates page 2 by 180° only when asked", async () => {
    const rotated = await PDFDocument.load((await buildPdf(sheet([song(1, 2, 4)], true))).bytes);
    expect(rotated.getPage(0).getRotation().angle).toBe(0);
    expect(rotated.getPage(1).getRotation().angle).toBe(180);
    const flat = await PDFDocument.load((await buildPdf(sheet([song(1, 2, 4)], false))).bytes);
    expect(flat.getPage(1).getRotation().angle).toBe(0);
  }, 30_000);

  it("(e) produces a valid two-page A4 landscape PDF with no songs", async () => {
    const { bytes, fits } = await buildPdf(sheet([]));
    const doc = await PDFDocument.load(bytes);
    expect(fits).toBe(true);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 841.89, height: 595.28 });
  }, 30_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/pdf/layout.test.ts`
Expected: FAIL, because the import `./build` can't be resolved.

- [ ] **Step 3: Write `src/pdf/render.ts`**

```ts
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
```

- [ ] **Step 4: Write `src/pdf/build.ts`**

```ts
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees } from "pdf-lib";
import type { SheetInput } from "../shared/types";
import { fitScale } from "./fit";
import { layoutSheet } from "./flow";
import { PAGE_H, PAGE_W } from "./geometry";
import type { Measure } from "./measure";
import { renderSheet } from "./render";

/** Pure: bytes in (fonts), bytes out. No DOM, no fetch, so it runs in vitest and the browser alike. */
export async function buildPdf(input: SheetInput): Promise<{ bytes: Uint8Array; fits: boolean }> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Sunday Worship ${input.dateISO}`);
  // ponytail: subset:true keeps the file small; flip to false if a glyph renders wrong.
  const fonts = {
    regular: await doc.embedFont(input.fonts.regular, { subset: true }),
    bold: await doc.embedFont(input.fonts.bold, { subset: true }),
  };
  const measure: Measure = (t, bold, size) => (bold ? fonts.bold : fonts.regular).widthOfTextAtSize(t, size);

  const at = (s: number) => layoutSheet(input.songs, input.notices, s, measure);
  const { size, fits } = fitScale((s) => at(s).overflow);

  const pages = [doc.addPage([PAGE_W, PAGE_H]), doc.addPage([PAGE_W, PAGE_H])];
  renderSheet(pages, fonts, at(size).items, input);
  if (input.rotateBack) pages[1].setRotation(degrees(180));

  return { bytes: await doc.save(), fits };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run && npx tsc --noEmit`
Expected: all tests PASS, including `buildPdf` (c), (d), (e). `tsc` exits 0.

- [ ] **Step 6: Eyeball a generated PDF**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
cat > "$TMPDIR/sample.test.ts" <<'EOF'
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { buildPdf } from "/Users/gilbertvirgo/vpcc-sunday-sheets/src/pdf/build";
it("writes sample", async () => {
  const f = (n: string) => readFileSync(`/Users/gilbertvirgo/vpcc-sunday-sheets/public/fonts/${n}`);
  const songs = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `${n}`, title: `Song ${n}`, attribution: "Writer\n© 2014 Publisher. CCLI Song #123", sequence: ["v1", "c", "v2", "c"],
    sections: [{ id: "v1", label: "Verse 1", lines: Array(6).fill("Amazing grace how sweet the sound that saved") }, { id: "c", label: "Chorus", lines: Array(4).fill("Chorus line’s here") }, { id: "v2", label: "Verse 2", lines: Array(6).fill("Through many dangers toils and snares") }] }));
  const { bytes, fits } = await buildPdf({ dateISO: "2026-09-20", time: "3:15pm", songs, notices: ["Prayer meeting — Wednesday 7:30pm, Church hall. Bring a Bible."], rotateBack: true, fonts: { regular: f("Inter-Regular.ttf"), bold: f("Inter-Bold.ttf") } });
  writeFileSync(`${process.env.TMPDIR}/sample.pdf`, bytes);
  console.log("fits", fits);
});
EOF
npx vitest run --root / "$TMPDIR/sample.test.ts"; pdfinfo -f 2 -l 2 "$TMPDIR/sample.pdf" | grep -E 'Pages|rot'; pdftotext -layout "$TMPDIR/sample.pdf" - | head -40; open "$TMPDIR/sample.pdf"
```
Expected: `Pages: 2` and `Page    2 rot:  180`. The text dump shows page 1 with songs in the left and right columns, and "Notices", the address and the CCLI footer in the middle. The viewer shows the orange logo with the letters knocked out, a scannable QR code, and the curly apostrophe and ® rendered. Delete `$TMPDIR/sample.*` afterwards.

- [ ] **Step 7: Commit**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
git add src/pdf
git commit -m "feat: render trifold PDF with cover, footer and duplex rotation" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Editor UI

**Files:**
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/api.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/lib/fonts.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/lib/notices.ts`
- Test: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/lib/notices.test.ts`
- Create: `/Users/gilbertvirgo/vpcc-sunday-sheets/src/components/SongList.tsx`, `SongSearch.tsx`, `NoticesEditor.tsx`, `Preview.tsx`
- Modify (replace entirely): `/Users/gilbertvirgo/vpcc-sunday-sheets/src/App.tsx`

**Interfaces:**
- Consumes: `SheetSong`, `Notice`, `SheetInput`, `nextSunday` (Task 2); `/api/me`, `/api/service`, `/api/notices`, `/api/songs` (Tasks 3–5); 401 body `{ hub }` (Task 3); `buildPdf` (Task 9)
- Produces:
  - `api<T>(path: string): Promise<T>` (401 → `location.assign(`${hub}/?returnTo=${encodeURIComponent(location.href)}`)`)
  - `loadFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }>` (cached)
  - `noticeParagraph(n: Notice): string`, `noticesText(ns: Notice[]): string`, `noticeParagraphs(text: string): string[]`
  - Components `App`, `SongList`, `SongSearch`, `NoticesEditor`, `Preview`

Spec: "Guard: on load call `me`; 401 → redirect to hub with `returnTo`." Left column: Date (`<input type=date>`, default next Sunday) and Time (text, default `3:15pm`). Songs list from `service` for that date, each row with number, title, remove and up/down buttons; search box hits `songs?q=` and a click adds the song. Notices textarea prefilled from `notices`, one paragraph per notice (`Title — Wednesday 7:30pm, Location. Description`), freely editable, with a "Reload from calendar" button. "Rotate back page for duplex" checkbox, default on. A fit warning banner appears when auto-shrink hits the floor. Right column: `<iframe>` showing `URL.createObjectURL` of the PDF, regenerated with a 300 ms debounce on any change. "Download PDF" button (`sunday-sheet-YYYY-MM-DD.pdf`). No persistence.

- [ ] **Step 1: Write the failing test**, `src/lib/notices.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/lib/notices.test.ts`
Expected: FAIL, because the import `./notices` can't be resolved.

- [ ] **Step 3: Implement `src/lib/notices.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx vitest run src/lib/notices.test.ts`
Expected: PASS

- [ ] **Step 5: Write `src/api.ts` and `src/lib/fonts.ts`**

`src/api.ts`:
```ts
/** GET /api/<path> as JSON. A 401 sends the browser to the auth hub and never resolves. */
export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`/api/${path}`, { credentials: "same-origin" });
  if (res.status === 401) {
    const { hub } = (await res.json()) as { hub: string };
    location.assign(`${hub}/?returnTo=${encodeURIComponent(location.href)}`);
    return new Promise<T>(() => {});
  }
  if (!res.ok) throw new Error(`/api/${path} failed (${res.status})`);
  return (await res.json()) as T;
}
```

`src/lib/fonts.ts`:
```ts
type FontBytes = { regular: Uint8Array; bold: Uint8Array };

let cached: Promise<FontBytes> | undefined;

async function get(name: string): Promise<Uint8Array> {
  const res = await fetch(`/fonts/${name}`);
  if (!res.ok) throw new Error(`Font ${name} failed to load (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export function loadFonts(): Promise<FontBytes> {
  cached ??= Promise.all([get("Inter-Regular.ttf"), get("Inter-Bold.ttf")])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((err) => {
      cached = undefined;
      throw err;
    });
  return cached;
}
```

- [ ] **Step 6: Write the components**

`src/components/SongList.tsx`:
```tsx
import type { SheetSong } from "../shared/types";

const iconButton =
  "rounded-sm px-2 py-1 text-caption text-ink-secondary hover:bg-surface-sunken disabled:opacity-30 disabled:hover:bg-transparent";

export function SongList({ songs, onChange }: { songs: SheetSong[]; onChange: (songs: SheetSong[]) => void }) {
  const move = (i: number, by: -1 | 1) => {
    const next = [...songs];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };

  if (!songs.length) return <p className="text-body-sm text-ink-muted">No songs yet. Search below to add one.</p>;

  return (
    <ol className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface-raised">
      {songs.map((song, i) => (
        <li key={`${i}-${song.id}`} className="flex items-center gap-2 px-3 py-2">
          <span className="w-5 text-body-sm font-bold text-ink-muted">{i + 1}</span>
          <span className="flex-1 truncate text-body-sm text-ink">{song.title}</span>
          <button type="button" className={iconButton} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${song.title} up`}>
            ↑
          </button>
          <button type="button" className={iconButton} disabled={i === songs.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${song.title} down`}>
            ↓
          </button>
          <button type="button" className={iconButton} onClick={() => onChange(songs.filter((_, j) => j !== i))} aria-label={`Remove ${song.title}`}>
            ✕
          </button>
        </li>
      ))}
    </ol>
  );
}
```

`src/components/SongSearch.tsx`:
```tsx
import { useEffect, useState } from "react";
import { api } from "../api";
import type { SheetSong } from "../shared/types";

export function SongSearch({ onAdd }: { onAdd: (song: SheetSong) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SheetSong[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    let stale = false;
    const t = setTimeout(() => {
      api<SheetSong[]>(`songs?q=${encodeURIComponent(query)}`).then(
        (r) => {
          if (!stale) {
            setResults(r);
            setError("");
          }
        },
        (e) => !stale && setError(String(e)),
      );
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search songs to add…"
        aria-label="Search songs"
        className="w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-body-sm text-ink placeholder:text-ink-muted"
      />
      {error && <p role="alert" className="text-caption text-danger">{error}</p>}
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface-raised">
          {results.map((song) => (
            <li key={song.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(song);
                  setQ("");
                }}
                className="w-full px-3 py-2 text-left text-body-sm text-ink hover:bg-surface-sunken"
              >
                {song.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`src/components/NoticesEditor.tsx`:
```tsx
export function NoticesEditor({
  value,
  onChange,
  onReload,
}: {
  value: string;
  onChange: (value: string) => void;
  onReload: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="notices" className="text-body-sm font-bold text-ink">
          Notices
        </label>
        <button type="button" onClick={onReload} className="rounded-md border border-line-strong px-3 py-1 text-caption text-ink hover:bg-surface-sunken">
          Reload from calendar
        </button>
      </div>
      <textarea
        id="notices"
        rows={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-body-sm text-ink"
      />
      <p className="text-caption text-ink-muted">Each line is one paragraph on the back panel.</p>
    </div>
  );
}
```

`src/components/Preview.tsx`:
```tsx
import { useEffect, useState } from "react";
import { loadFonts } from "../lib/fonts";
import { buildPdf } from "../pdf/build";
import type { SheetInput } from "../shared/types";

export type PreviewInput = Omit<SheetInput, "fonts">;

export function Preview({ input, onFits }: { input: PreviewInput; onFits: (fits: boolean) => void }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState("");

  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const { bytes, fits } = await buildPdf({ ...input, fonts: await loadFonts() });
        if (stale) return;
        const next = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return next;
        });
        setError("");
        onFits(fits);
      } catch (e) {
        if (!stale) setError(String(e));
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [input, onFits]);

  return (
    <section className="flex min-h-[70dvh] flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h4">Preview</h2>
        <a
          href={url}
          download={`sunday-sheet-${input.dateISO}.pdf`}
          aria-disabled={!url}
          className="inline-flex h-11 items-center justify-center rounded-pill bg-accent px-6 text-body-sm font-bold text-accent-contrast transition-[background-color] duration-fast ease-standard hover:bg-accent-hover aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Download PDF
        </a>
      </div>
      {error && <p role="alert" className="text-caption text-danger">{error}</p>}
      {url ? (
        <iframe title="PDF preview" src={url} className="min-h-0 w-full flex-1 rounded-md border border-line bg-surface-raised" />
      ) : (
        <p className="text-body-sm text-ink-muted">Building preview…</p>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Replace `src/App.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { NoticesEditor } from "./components/NoticesEditor";
import { Preview } from "./components/Preview";
import { SongList } from "./components/SongList";
import { SongSearch } from "./components/SongSearch";
import { noticeParagraphs, noticesText } from "./lib/notices";
import { nextSunday } from "./shared/dates";
import type { Notice, SheetSong } from "./shared/types";

const field = "w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-body-sm font-medium text-ink";

export function App() {
  const [authed, setAuthed] = useState(false);
  const [date, setDate] = useState(() => nextSunday(new Date()));
  const [time, setTime] = useState("3:15pm");
  const [songs, setSongs] = useState<SheetSong[]>([]);
  const [found, setFound] = useState(true);
  const [notices, setNotices] = useState("");
  const [rotateBack, setRotateBack] = useState(true);
  const [fits, setFits] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("me").then(() => setAuthed(true), (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!authed || !date) return;
    let stale = false;
    api<{ found: boolean; songs: SheetSong[] }>(`service?date=${date}`).then(
      (r) => {
        if (stale) return;
        setSongs(r.songs);
        setFound(r.found);
      },
      (e) => setError(String(e)),
    );
    api<Notice[]>(`notices?date=${date}`).then(
      (n) => !stale && setNotices(noticesText(n)),
      (e) => setError(String(e)),
    );
    return () => {
      stale = true;
    };
  }, [authed, date]);

  const reloadNotices = () =>
    api<Notice[]>(`notices?date=${date}`).then((n) => setNotices(noticesText(n)), (e) => setError(String(e)));

  const input = useMemo(
    () => ({ dateISO: date, time, songs, notices: noticeParagraphs(notices), rotateBack }),
    [date, time, songs, notices, rotateBack],
  );

  if (!authed) return <p className="p-8 text-body-sm text-ink-muted">{error || "Checking sign-in…"}</p>;

  return (
    <main className="grid min-h-dvh gap-6 p-6 md:h-dvh md:grid-cols-[26rem_1fr]">
      <div className="flex flex-col gap-6 md:overflow-y-auto md:pr-2">
        <h1 className="text-h3">Sunday sheet</h1>
        {error && <p role="alert" className="rounded-md bg-danger-surface px-3 py-2 text-body-sm text-danger">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-body-sm font-bold text-ink">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-body-sm font-bold text-ink">
            Time
            <input value={time} onChange={(e) => setTime(e.target.value)} className={field} />
          </label>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-body-sm font-bold text-ink">Songs</h2>
          {!found && <p className="text-caption text-ink-muted">No Praise Presenter service for this date.</p>}
          <SongList songs={songs} onChange={setSongs} />
          <SongSearch onAdd={(song) => setSongs((prev) => [...prev, song])} />
        </section>

        <NoticesEditor value={notices} onChange={setNotices} onReload={reloadNotices} />

        <label className="flex items-center gap-2 text-body-sm text-ink">
          <input type="checkbox" checked={rotateBack} onChange={(e) => setRotateBack(e.target.checked)} />
          Rotate back page for duplex
        </label>

        {!fits && (
          <p role="alert" className="rounded-md bg-danger-surface px-3 py-2 text-body-sm text-danger">
            This doesn't fit even at 7 pt. Remove a song or shorten the notices.
          </p>
        )}
      </div>

      <Preview input={input} onFits={setFits} />
    </main>
  );
}
```

- [ ] **Step 8: Typecheck, test, build**

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npm run build && npx vitest run`
Expected: `tsc` passes and `vite build` succeeds. All tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
git add src
git commit -m "feat: sheet editor with live PDF preview and download" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Manual verification with `netlify dev`

**Files:**
- Create (local only, gitignored): `/Users/gilbertvirgo/vpcc-sunday-sheets/.env`

**Interfaces:**
- Consumes: everything above; optionally the auth hub running on `localhost:8888`
- Produces: evidence that the functions work against the real databases and the PDF is correct

- [ ] **Step 1: Build `.env` without printing secrets**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
{
  grep -E '^(MONGODB_URI|JWT_SECRET)=' /Users/gilbertvirgo/vpcc-calendar/.env | sed 's/^MONGODB_URI=/CALENDAR_MONGODB_URI=/'
  grep -E '^(MONGODB_URI|MONGODB_DB)=' /Users/gilbertvirgo/praise-pres/.env | sed 's/^MONGODB_/PRAISE_MONGODB_/'
  echo 'AUTH_HUB_URL=http://localhost:8888'
} > .env
cut -d= -f1 .env
```
Expected: prints only `CALENDAR_MONGODB_URI`, `JWT_SECRET`, `PRAISE_MONGODB_URI`, `PRAISE_MONGODB_DB`, `AUTH_HUB_URL`.

- [ ] **Step 2: Start the dev server** (separate terminal or background)

Run: `cd /Users/gilbertvirgo/vpcc-sunday-sheets && npx netlify dev`
Expected: "Server now ready on http://localhost:8889". Functions `me`, `notices`, `service`, `songs` are loaded.

- [ ] **Step 3: Mint a 1-hour dev token into a shell variable (not printed)**

```bash
cd /Users/gilbertvirgo/vpcc-sunday-sheets
TOKEN=$(node --env-file=.env -e "console.log(require('jsonwebtoken').sign({id:'dev',username:'admin',role:'admin'}, process.env.JWT_SECRET, {expiresIn:'1h'}))")
echo ${#TOKEN}
```
Expected: a length greater than 100.

- [ ] **Step 4: Guard and endpoints**

```bash
curl -s -w ' %{http_code}\n' 'localhost:8889/api/service?date=2026-09-20'
curl -s -H "Authorization: Bearer $TOKEN" 'localhost:8889/api/me'; echo
curl -s -H "Authorization: Bearer $TOKEN" 'localhost:8889/api/service?date=2026-09-20' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(r.found, r.songs.map(x=>x.title+(x.ccli?' #'+x.ccli:'')))})"
curl -s -H "Authorization: Bearer $TOKEN" 'localhost:8889/api/songs?q=grace' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).map(x=>x.title)))"
curl -s -H "Authorization: Bearer $TOKEN" 'localhost:8889/api/songs?q=amaz' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).map(x=>x.title)))"
curl -s -H "Authorization: Bearer $TOKEN" 'localhost:8889/api/notices?date=2026-09-27'; echo
curl -s -w ' %{http_code}\n' -H "Authorization: Bearer $TOKEN" 'localhost:8889/api/notices?date=bad'
```
Expected, in order:
1. `{"error":"Unauthorized","hub":"http://localhost:8888"} 401`
2. `{"user":{"id":"dev","username":"admin","role":"admin"}}`
3. `true [...]` listing the 20 Sept songs if that service exists in Praise Presenter (reference: Amazing Grace, Come Lord Jesus, You Died For Me, What A Faithful God, And Can It Be, Because Of You); otherwise `false []`
4. A list containing "Amazing Grace"
5. A list containing "Amazing Grace" (regex fallback)
6. A JSON array of `{title, day, time, location, description}` sorted Sunday → Saturday; compare against calendar.vpcc.church for that week
7. `{"error":"date=YYYY-MM-DD required"} 400`

- [ ] **Step 5: Browser sign-in**

Option A (auth hub running on 8888): open `http://localhost:8888/?returnTo=http://localhost:8889/` and sign in. Localhost cookies are shared across ports, so the browser lands on the editor.
Option B (no hub): open `http://localhost:8889/`. It redirects to `http://localhost:8888/?returnTo=http%3A%2F%2Flocalhost%3A8889%2F` (proving the guard). Go back to `http://localhost:8889/`, open DevTools → Console, and run `document.cookie = "vpcc_session=<paste output of: echo $TOKEN>; path=/"`, then reload.
Expected: the editor shows the date defaulted to the coming Sunday, time `3:15pm`, the songs list, prefilled notices, and a PDF preview on the right.

- [ ] **Step 6: Exercise the editor**

Set the date to `2026-09-20`. Reorder songs with ↑/↓ and remove one. Search "grace" and add it. Edit a notice line. Click "Reload from calendar". Toggle the duplex checkbox.
Expected: the preview rebuilds about 300 ms after each change. The cover (page 1, right panel) shows the orange logo with knocked-out letters, "Sunday Worship", "Sunday 20 September 2026", "3:15pm", then song 1. Page 1 middle shows "Notices" and the footer (QR, three address lines, CCLI text). Songs flow A → p2 left → p1 left → p2 middle → p2 right, ending with "Sermon notes" and 8 ruled lines. Add songs until the red "doesn't fit even at 7 pt" banner appears, then remove them and confirm it disappears.

- [ ] **Step 7: Download and inspect the PDF**

Click "Download PDF", then:
```bash
F=~/Downloads/sunday-sheet-2026-09-20.pdf
pdfinfo "$F" | grep -E 'Pages|Page size'
pdfinfo -f 2 -l 2 "$F" | grep rot
pdffonts "$F"
pdftotext -layout "$F" - | head -60
open "$F"
```
Expected: `Pages: 2`, `Page size: 841.89 x 595.28 pts (A4)`, and `Page    2 rot:  180` with duplex on (untick it, download again, and `rot:    0`). `pdffonts` lists `Inter-Regular` and `Inter-Bold` as embedded subsets. `pdftotext` shows the same column order as `/Users/gilbertvirgo/Downloads/2.pdf`, with each repeated chorus printed once and credit lines ending in `CCLI Song #…`. Scan the QR with a phone: it opens https://vpcc.church.

- [ ] **Step 8: Clean up**

Run: `unset TOKEN`. Stop `netlify dev`. Clear the dev cookie in DevTools (Application → Cookies → localhost). Run `git status` and confirm it's clean (`.env` is gitignored). Nothing to commit.

---

## Self-Review

1. **Spec coverage:**
   - Functions: `service` (Task 5, epoch ms or Date, London day range), `songs` (Task 5, `$text`, limit 20), `notices` (Task 4, public, Sunday–Saturday, recurrences, exceptions, sorted). All are cookie-guarded GET JSON via `guarded` (Task 3). The `me` guard endpoint is Task 3.
   - Editor UI: all spec items are in Task 10.
   - PDF: geometry (Task 6); panel roles and flow order (Tasks 6 and 7); cover header (Task 9); flow content, section-once rule and credit (Task 7); back panel and footer (Tasks 7 and 9); fit algorithm (Tasks 6, 7 and 9); duplex (Task 9); `buildPdf` signature (Task 9).
   - Tests (a)–(e) are in `src/pdf/layout.test.ts` (Tasks 7 and 9). The notices fixture test is Task 4. The smoke test via `netlify dev` is Task 11.
2. **Placeholder scan:** every code step contains complete code. There are no TBDs.
3. **Type consistency:**
   - `SheetSong`, `Notice` and `SheetInput` (Task 2) are used unchanged in Tasks 4, 5, 7, 9 and 10.
   - `Item`, `Layout`, `layoutSheet(songs, notices, s, m)` (Task 7) are consumed in Task 9.
   - `Measure` and `wrap` (Task 6) are used in Tasks 7 and 9.
   - `fitScale` returns `{ size, fits }` (Task 6), used in Task 9.
   - `panelOrigin` and `capacity` (Task 6) are used in Tasks 7 and 9.
   - `drawLogo(page, x, top, size, color)` and `drawQr(page, value, x, y, size, color)` (Task 8) match their calls in Task 9.
   - The 401 body `{ hub }` (Task 3) matches `api.ts` (Task 10).

---

