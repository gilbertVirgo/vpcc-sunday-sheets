# Sunday Trifold Sheets — Design

Date: 2026-09-23. Status: approved.

## Goal

Web app at trifold.vpcc.church that produces the A4-landscape trifold song/notice
leaflet printed each Sunday (see reference PDF from 20 Sept 2026). Password-protected
via a shared auth hub at auth.vpcc.church that also logs users into calendar.vpcc.church.

## Repos and hosting

| Repo | Host | Purpose |
|---|---|---|
| `~/vpcc-auth` (new) | auth.vpcc.church (Netlify) | Login page + cookie-issuing functions |
| `~/vpcc-sunday-sheets` (this) | trifold.vpcc.church (Netlify) | Sheet editor + PDF generation |
| `~/vpcc-calendar` (patch) | calendar.vpcc.church | Accept hub cookie; redirect login to hub |

Stack for both new repos: Vite + TypeScript + Tailwind v4 (CSS-first tokens copied from
`~/vpcc-v1/src/styles/tokens.*.css`, `base.css`, `utilities.css`; Area Inktrap via the same
Typekit link for UI). Netlify Functions in TypeScript. No framework beyond Vite vanilla-ts
unless a subagent judges a small React setup materially simpler for the editor; either is
acceptable, React preferred for the editor list UI.

## Data sources (read-only)

Two MongoDB URIs, two databases:

- **Calendar DB** (`CALENDAR_MONGODB_URI`, taken from `~/vpcc-calendar/.env` `MONGODB_URI`):
  - `users`: `{ username, password (bcryptjs hash, legacy plaintext possible), role: 'general'|'admin' }`
  - `events`: `{ title, date: Date, time: { start:[h,m], end:[h,m] }, visibility: 'public'|'private', recursWeekly, recursionDetails: { endDate, exceptions: [Date] }, location, description }`
- **Praise DB** (`PRAISE_MONGODB_URI`, `PRAISE_MONGODB_DB` default `praise_presenter`, from `~/praise-pres/.env`):
  - `songs`: `{ _id, title, alternateTitles?, author?, composer?, tune?, sections: [{id,label,lines:string[]}], defaultSequence: string[], attribution: string, rights: { status, ccli?, note? } }`
  - `services`: `{ _id, date, title, blocks: Block[] }`; song blocks carry `kind:'song'`, `songId`, snapshot of `sections`/`sequence`/`attribution`/`title`.

`JWT_SECRET` shared with calendar (same value in all three Netlify sites).

## Auth hub (`vpcc-auth`)

Functions (`netlify/functions/`):

- `POST /api/login` `{username,password}` → find user in calendar `users`, compare with
  bcryptjs (legacy plaintext fallback like calendar's `User.comparePassword`, no migration
  write), sign `{id, username, role}` with `JWT_SECRET`, `expiresIn: '7d'`. Response sets
  `vpcc_session=<jwt>; Domain=.vpcc.church; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`.
  Also returns `{ user, token }` in body for the calendar's localStorage path. 401 on failure.
  Rate limit: none beyond bcrypt cost (single admin user).
- `POST /api/logout` → clears cookie.
- `GET /api/me` → verifies cookie, returns `{ user }` or 401.
- Local dev: when host is not `*.vpcc.church`, omit `Domain` and `Secure` so cookies work on localhost.

Page: one login form (username defaults to `admin`, shown), reads `?returnTo=`. On
success, redirect to `returnTo` if its host ends with `.vpcc.church` or is `localhost`,
else to `https://vpcc.church`. Uses vpcc-v1 tokens, `Button`/`Card`-equivalent markup.

Shared helper `verifySession(event)` (reads cookie or `Authorization: Bearer`) lives in
the hub repo and is copied verbatim into the sheets repo (`netlify/functions/_shared/auth.ts`).
Two copies is acceptable; no shared package.

## Calendar patch (`vpcc-calendar`)

- `netlify/functions/utils/requireAuth.js`: also accept `vpcc_session` cookie when no
  bearer header.
- `src/utils/apiFetch.js`: `credentials: 'include'`.
- `src/pages/Login.js`: replace form with redirect to
  `https://auth.vpcc.church/?returnTo=<current URL>`; `UserContext` reads `/api/me`-style
  endpoint (`netlify/functions/me.js`, new, cookie-verified) when no localStorage token.
- Netlify CORS: hub functions respond `Access-Control-Allow-Origin` = requesting origin if
  `*.vpcc.church`, `Allow-Credentials: true`.

## Sheets app (`vpcc-sunday-sheets`)

### Functions (all cookie-guarded, GET, JSON)

- `service?date=YYYY-MM-DD` → praise `services` with `date` on that day (match by local-day
  range; `date` may be stored as epoch ms or Date — handle both). Returns `{ found, songs: SheetSong[] }`
  where `SheetSong = { id, title, sections, sequence, attribution, ccli? }` built from the
  block snapshot. `found:false, songs:[]` when none.
- `songs?q=` → text search on `songs` (`$text` index exists on title/author/attribution),
  limit 20, `visibility:'shared'` or any (no owner filtering needed). Returns `SheetSong[]`.
- `notices?date=YYYY-MM-DD` → calendar `events`, `visibility:'public'`, dated Sunday
  through following Saturday (Europe/London days), plus weekly recurrences whose base date
  is earlier, `endDate` unset or ≥ window start, and window date not in `exceptions`.
  Returns `Notice[] = { title, day: 'Wednesday', time: '7:30pm'|'', location, description }`
  sorted by date/time.

### Editor UI (single page)

Guard: on load call `me`; 401 → redirect to hub with `returnTo`.

Left column:
- Date (`<input type=date>`, default next Sunday), Time (text, default `3:15pm`).
- Songs: list from `service` for that date. Each row: number, title, remove, drag handle
  (native HTML drag or up/down buttons — up/down buttons are acceptable). Search box hits `songs?q=`, click adds.
- Notices: textarea, prefilled from `notices` as one paragraph per notice
  (`Title — Wednesday 7:30pm, Location. Description`). Free edit. "Reload from calendar" button.
- "Rotate back page for duplex" checkbox, default on.
- Fit warning banner when auto-shrink hits floor.

Right column: `<iframe>` showing `URL.createObjectURL` of generated PDF, regenerated
debounced (300 ms) on any change. "Download PDF" button (`sunday-sheet-YYYY-MM-DD.pdf`).

No persistence. Reload = fresh from DBs.

### PDF layout (`src/pdf/`)

Library: `pdf-lib` + `@pdf-lib/fontkit`; Inter Regular + Bold (static TTF, from
`@fontsource/inter` files or vendored `public/fonts/`). QR via `qrcode` (toDataURL → embedPng).

Geometry: A4 landscape 841.89 × 595.28 pt, 2 pages, 3 equal panels each (280.63 pt),
panel padding 20 pt, columns never cross panel folds.

Panel roles (matching reference PDF):
- Page 1: left = flow panel B, middle = **back panel**, right = **cover** (flow panel A).
- Page 2: left = flow panel C, middle = flow panel D, right = flow panel E.
- Flow order: A (cover, below header block) → C → B → D → E. i.e. `[p1.right, p2.left, p1.left, p2.middle, p2.right]`.

Cover header: VPCC logo (vector path from `~/vpcc-v1/src/components/brand/logo.tsx`, drawn
with pdf-lib `drawSvgPath`), "Sunday Worship", long date ("Sunday 20 September 2026"), time.

Flow content, in order: songs 1..n, then sermon notes block (heading "Sermon notes" + 8
ruled lines, kept together). Each song: `"{n}. {title}"` bold, sections in `sequence`
order with label (small caps/bold small) and lines, then credit line small grey:
`attribution` (+ ` · CCLI Song #{ccli}` if not already contained). Repeated sections
(chorus twice in sequence) print once per occurrence in sequence? **No** — print each
section once, in first-occurrence order (leaflet, not slides).

Back panel (p1 middle): "Notices" heading + notice paragraphs (auto-shrink shares the same
scale factor), then bottom-anchored footer: CCLI line
"Lyrics reproduced under CCLI Licence No. 22249187. For use solely with the SongSelect®
Terms of Use. All rights reserved. www.ccli.com", QR to `https://vpcc.church`, "vpcc.church /
Victoria Park Baptist Church / Grove Road, London E3 5TG".

Fit algorithm: base lyric size 10 pt. Lay out at size s (line-height 1.25s, headings scale
with s). If flow overflows panel E or notices overflow back panel, binary-search s in
[7, 10] to 0.25 pt. Below 7 → render at 7 and report `fits:false` to UI. Song blocks may
split across panels but never mid-section; a section that cannot fit in remaining panel
space moves to next panel.

Duplex: when rotate flag true, set page 2 `Rotate` to 180 (`page.setRotation(degrees(180))`).

Output: `buildPdf(input: SheetInput): Promise<{ bytes: Uint8Array, fits: boolean }>` — pure,
no DOM, so it runs in vitest.

### Tests

- `src/pdf/layout.test.ts`: given synthetic songs, asserts (a) panel assignment order,
  (b) sermon notes never split, (c) overflow triggers shrink and `fits:false` at floor,
  (d) rotate flag sets page 2 rotation, (e) 0 songs still produces valid 2-page PDF.
- Functions: manual smoke via `netlify dev` against real DBs; one unit test for the
  notices window/recurrence filter with fixture events.

## Out of scope

User management, persistence of sheets, praise-pres `notices` collection, editable title/QR,
multi-sheet overflow, embedding Area Inktrap in PDF.
