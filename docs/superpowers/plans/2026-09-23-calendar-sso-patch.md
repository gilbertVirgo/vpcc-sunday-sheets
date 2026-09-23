# Calendar SSO Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make calendar.vpcc.church accept the auth hub's `vpcc_session` cookie and send users to the hub to log in, while the existing localStorage bearer flow keeps working.

**Architecture:** `requireAuth` falls back to the `vpcc_session` cookie when there is no `Authorization` header. A new `me` function lets the SPA find out about a cookie session. On the frontend, `apiFetch` sends credentials and sends users to the hub on 401/403. `UserContext` asks `me` when there is no localStorage token. `/login` becomes a redirect to the hub, and Logout also clears the hub cookie.

**Tech Stack:** CRA (react-scripts 5), React 19, react-router-dom v5, Netlify Functions v1 (CommonJS, `exports.handler = async function (event)`), jsonwebtoken, mongoose, `node:test` for function tests (Node 24).

**Spec:** `/Users/gilbertvirgo/vpcc-sunday-sheets/docs/superpowers/specs/2026-09-23-trifold-sheets-design.md` (section "Calendar patch (`vpcc-calendar`)"; cookie format in "Auth hub")

## Global Constraints

- Repo: `/Users/gilbertvirgo/vpcc-calendar`, branch `auth-hub-sso` (Task 1 creates it off `main`).
- Follow existing patterns: CommonJS functions, `exports.handler = async function (event)`, tabs, double quotes, `{ statusCode, body: JSON.stringify(...) }`. Do not modernise, do not convert to TS/ESM, and add no dependencies.
- Cookie name `vpcc_session`, a JWT signed with the shared `JWT_SECRET` holding `{ id, username, role }`, `expiresIn: '7d'`.
- Hub URL: `process.env.REACT_APP_AUTH_HUB_URL || "https://auth.vpcc.church"`. Hub login URL is `${hub}/?returnTo=<encoded absolute URL>`. Hub logout is `POST ${hub}/api/logout` with credentials.
- Existing functions send no CORS headers, so `me.js` sends none either (it is same-origin).
- Never print `.env` values. Tokens minted for manual testing go into shell variables only.
- Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `netlify/functions/utils/cookies.js` | Create | Pure `getCookie(cookieHeader, name)` |
| `netlify/functions/utils/cookies.test.js` | Create | `node:test` tests for `getCookie` |
| `netlify/functions/utils/requireAuth.js` | Modify | Bearer header first, then `vpcc_session` cookie |
| `netlify/functions/utils/requireAuth.test.js` | Create | `node:test` tests for both token sources |
| `netlify/functions/events.js` | Modify | Optional auth on GET also triggers on the session cookie |
| `netlify/functions/me.js` | Create | `GET` → `{ user }` 200, or 401 |
| `package.json` | Modify | `test:functions` script |
| `src/utils/apiFetch.js` | Modify | `credentials: "include"`, redirect to hub, export `AUTH_HUB_URL` |
| `src/pages/Login.js` | Modify | Immediate redirect to hub |
| `src/contexts/UserContext.js` | Modify | Cookie-session lookup via `me` when no localStorage token |
| `src/App.js` | Modify | Logout also POSTs to hub `/api/logout` |
| `.env.example`, `README.md` | Create / Modify | Document `REACT_APP_AUTH_HUB_URL` |

Test files live in `netlify/functions/utils/`, not at the top level of `netlify/functions/`, because Netlify deploys every top-level `.js` file there as a function. `react-scripts test` only looks at `src/`, so function tests run with plain `node --test` (Node 24, no new dependencies).

---

### Task 1: Branch, install, cookie parser

**Files:**
- Create: `netlify/functions/utils/cookies.js`
- Create: `netlify/functions/utils/cookies.test.js`
- Modify: `package.json` (`scripts`)

**Interfaces:**
- Consumes: nothing
- Produces: `getCookie(cookieHeader: string | undefined, name: string): string | null` from `netlify/functions/utils/cookies.js` (`module.exports = { getCookie }`), and the npm script `test:functions`.

- [ ] **Step 1: Create the branch and install dependencies**

```bash
cd /Users/gilbertvirgo/vpcc-calendar
git checkout main
git checkout -b auth-hub-sso
npm ci
```
Expected: `Switched to a new branch 'auth-hub-sso'`, and `npm ci` finishes without errors (`node_modules/` is not present before this).

- [ ] **Step 2: Add the `test:functions` script**

In `package.json`, replace the `"scripts"` block with:

```json
	"scripts": {
		"start": "react-scripts start",
		"build": "react-scripts build",
		"test": "react-scripts test",
		"test:functions": "node --test netlify/functions/utils/*.test.js",
		"test:db-disconnect": "node scripts/test-db-disconnect.js",
		"eject": "react-scripts eject"
	},
```

- [ ] **Step 3: Write the failing test**

Create `netlify/functions/utils/cookies.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { getCookie } = require("./cookies");

test("returns null for missing or empty header", () => {
	assert.strictEqual(getCookie(undefined, "vpcc_session"), null);
	assert.strictEqual(getCookie("", "vpcc_session"), null);
});

test("finds the named cookie among others", () => {
	assert.strictEqual(
		getCookie("foo=1; vpcc_session=abc.def.ghi; bar=2", "vpcc_session"),
		"abc.def.ghi"
	);
});

test("returns null when the cookie is absent", () => {
	assert.strictEqual(getCookie("foo=1; bar=2", "vpcc_session"), null);
});

test("does not match a cookie whose name only ends with the name", () => {
	assert.strictEqual(getCookie("xvpcc_session=nope", "vpcc_session"), null);
});

test("keeps '=' characters inside the value", () => {
	assert.strictEqual(getCookie("a=b=c", "a"), "b=c");
});

test("url-decodes the value", () => {
	assert.strictEqual(getCookie("a=hello%20world", "a"), "hello world");
});
```

- [ ] **Step 4: Run the test to confirm it fails**

Run: `npm run test:functions`
Expected: FAIL with `Cannot find module './cookies'`.

- [ ] **Step 5: Write the implementation**

Create `netlify/functions/utils/cookies.js`:

```js
// Parse a single cookie value out of a raw Cookie header.
function getCookie(cookieHeader, name) {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(";")) {
		const i = part.indexOf("=");
		if (i === -1) continue;
		if (part.slice(0, i).trim() !== name) continue;
		const value = part.slice(i + 1).trim();
		try {
			return decodeURIComponent(value);
		} catch (err) {
			return value;
		}
	}
	return null;
}

module.exports = { getCookie };
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npm run test:functions`
Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add package.json netlify/functions/utils/cookies.js netlify/functions/utils/cookies.test.js
git commit -m "feat(auth): add cookie parser for hub session

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: requireAuth accepts the `vpcc_session` cookie

**Files:**
- Modify: `netlify/functions/utils/requireAuth.js` (whole file, 26 lines)
- Modify: `netlify/functions/events.js:1-36`
- Test: `netlify/functions/utils/requireAuth.test.js`

**Interfaces:**
- Consumes: `getCookie(cookieHeader, name)` from `./cookies` (Task 1)
- Produces: `requireAuth(event) → Promise<{ ok: true, user: { id, username, role, iat, exp } } | { ok: false, response: { statusCode: 401, body } }>`. The signature is unchanged. The `Authorization` header wins when present, even if it is invalid. The cookie is only read when there is no header.

- [ ] **Step 1: Write the failing test**

Create `netlify/functions/utils/requireAuth.test.js`:

```js
// JWT_SECRET is read when requireAuth.js loads, so set it before require.
process.env.JWT_SECRET = "test-secret";

const test = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const { requireAuth } = require("./requireAuth");

const token = jwt.sign(
	{ id: "1", username: "admin", role: "admin" },
	"test-secret",
	{ expiresIn: "1h" }
);

test("accepts a bearer header", async () => {
	const r = await requireAuth({
		headers: { authorization: `Bearer ${token}` },
	});
	assert.strictEqual(r.ok, true);
	assert.strictEqual(r.user.role, "admin");
});

test("accepts the vpcc_session cookie when there is no header", async () => {
	const r = await requireAuth({
		headers: { cookie: `other=1; vpcc_session=${token}` },
	});
	assert.strictEqual(r.ok, true);
	assert.strictEqual(r.user.username, "admin");
});

test("rejects a request with no credentials", async () => {
	const r = await requireAuth({ headers: {} });
	assert.strictEqual(r.ok, false);
	assert.strictEqual(r.response.statusCode, 401);
});

test("rejects an invalid cookie token", async () => {
	const r = await requireAuth({
		headers: { cookie: "vpcc_session=not-a-jwt" },
	});
	assert.strictEqual(r.ok, false);
	assert.strictEqual(r.response.statusCode, 401);
});

test("rejects a cookie token signed with another secret", async () => {
	const forged = jwt.sign({ id: "1", role: "admin" }, "wrong-secret");
	const r = await requireAuth({
		headers: { cookie: `vpcc_session=${forged}` },
	});
	assert.strictEqual(r.ok, false);
});

test("a present bearer header takes precedence over the cookie", async () => {
	const r = await requireAuth({
		headers: {
			authorization: "Bearer garbage",
			cookie: `vpcc_session=${token}`,
		},
	});
	assert.strictEqual(r.ok, false);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm run test:functions`
Expected: FAIL. The "accepts the vpcc_session cookie when there is no header" test fails with `false !== true`. The other requireAuth tests pass.

- [ ] **Step 3: Write the implementation**

Replace `netlify/functions/utils/requireAuth.js` with:

```js
const jwt = require("jsonwebtoken");
const { getCookie } = require("./cookies");

const JWT_SECRET = process.env.JWT_SECRET;

function unauthorized() {
	return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
}

async function requireAuth(event) {
	if (!JWT_SECRET) throw new Error("JWT_SECRET not configured");
	const headers = event.headers || {};
	const auth = headers.Authorization || headers.authorization;
	let token;
	if (auth) {
		const m = auth.match(/^Bearer\s+(.+)$/i);
		if (!m) return { ok: false, response: unauthorized() };
		token = m[1];
	} else {
		// No bearer header: fall back to the auth hub's shared session cookie
		token = getCookie(headers.cookie || headers.Cookie, "vpcc_session");
		if (!token) return { ok: false, response: unauthorized() };
	}
	try {
		const decoded = jwt.verify(token, JWT_SECRET);
		return { ok: true, user: decoded };
	} catch (err) {
		return { ok: false, response: unauthorized() };
	}
}

module.exports = { requireAuth };
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npm run test:functions`
Expected: `# pass 12`, `# fail 0`.

- [ ] **Step 5: Let events.js GET use the cookie for its optional auth**

At the moment `events.js` only calls `requireAuth` on GET when an `Authorization` header is present. Without this change, cookie-only admins would not see private events. Replace `netlify/functions/events.js` lines 1-36 with:

```js
const { connect } = require("./utils/db");
const Event = require("./models/Event");
const moment = require("moment");
const { requireAuth } = require("./utils/requireAuth");
const { getCookie } = require("./utils/cookies");

exports.handler = async function (event) {
	try {
		// Log incoming request for debugging
		console.log("[events] incoming request", {
			method: event.httpMethod,
			path: event.path,
			qs: event.queryStringParameters,
		});
		// Allow unauthenticated GET requests so public calendars can be viewed
		// without a token. For non-GET methods require authentication.
		let role = null;
		const method = event.httpMethod;

		// If a token (bearer header or hub session cookie) is present, validate
		// and set role. For non-GET methods authentication is mandatory.
		const hasAuthHeader =
			event.headers &&
			(event.headers.Authorization || event.headers.authorization);
		const hasSessionCookie =
			event.headers &&
			!!getCookie(
				event.headers.cookie || event.headers.Cookie,
				"vpcc_session"
			);

		if (method !== "GET") {
			const auth = await requireAuth(event);
			if (!auth.ok) return auth.response;
			role = auth.user && auth.user.role;
			console.log("[events] authenticated user role", { role });
		} else if (hasAuthHeader || hasSessionCookie) {
			const auth = await requireAuth(event);
			if (auth.ok) role = auth.user && auth.user.role;
			console.log("[events] optional auth present, role set to", {
				role,
			});
		}
```

Leave everything from line 37 on (`await connect();` onward) unchanged.

- [ ] **Step 6: Check that events.js still loads**

Run: `node -e "require('./netlify/functions/events'); console.log('ok')"`
Expected: `ok`, with no syntax error. It may also print a dotenv/db log line.

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/utils/requireAuth.js netlify/functions/utils/requireAuth.test.js netlify/functions/events.js
git commit -m "feat(auth): accept vpcc_session cookie when no bearer header

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `me` function

**Files:**
- Create: `netlify/functions/me.js`

**Interfaces:**
- Consumes: `requireAuth(event)` (Task 2)
- Produces: `GET /.netlify/functions/me` → `200 {"user":{"id","username","role"}}` (the same `user` shape `auth.js` returns) or `401 {"error":"Unauthorized"}`. No CORS headers.

- [ ] **Step 1: Confirm the function doesn't exist yet (the failing check)**

Run: `JWT_SECRET=test-secret node -e "require('./netlify/functions/me')"`
Expected: FAIL with `Cannot find module './netlify/functions/me'`.

- [ ] **Step 2: Write the implementation**

Create `netlify/functions/me.js`:

```js
const { requireAuth } = require("./utils/requireAuth");

exports.handler = async function (event) {
	try {
		const auth = await requireAuth(event);
		if (!auth.ok) return auth.response;
		const { id, username, role } = auth.user;
		return {
			statusCode: 200,
			body: JSON.stringify({ user: { id, username, role } }),
		};
	} catch (err) {
		console.error(err);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: err.message || "Internal error" }),
		};
	}
};
```

- [ ] **Step 3: Check the 401 and 200 paths**

Run:
```bash
JWT_SECRET=test-secret node -e "
const jwt = require('jsonwebtoken');
const { handler } = require('./netlify/functions/me');
const t = jwt.sign({ id: '1', username: 'admin', role: 'admin' }, 'test-secret');
(async () => {
  console.log((await handler({ headers: {} })).statusCode);
  const r = await handler({ headers: { cookie: 'vpcc_session=' + t } });
  console.log(r.statusCode, r.body);
})();
"
```
Expected:
```
401
200 {"user":{"id":"1","username":"admin","role":"admin"}}
```

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/me.js
git commit -m "feat(auth): add me function for cookie sessions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Send logins to the hub (apiFetch, Login, env docs)

**Files:**
- Modify: `src/utils/apiFetch.js` (whole file)
- Modify: `src/pages/Login.js` (whole file)
- Create: `.env.example`
- Modify: `README.md` (insert after line 1)

**Interfaces:**
- Consumes: nothing from earlier tasks (the hub is external)
- Produces: `export const AUTH_HUB_URL: string` from `src/utils/apiFetch.js`, which Task 5 (`App.js`) imports. The default export `apiFetch(input, init)` keeps the same signature. Callers still add `Authorization: Bearer <localStorage token>` themselves when a token exists (they already do this in `EventForm.js`, `EventModals.js`, `ReadCalendar.js` and `EditCalendar.js`), so apiFetch does not add it.

- [ ] **Step 1: Replace `src/utils/apiFetch.js`**

```js
export const AUTH_HUB_URL =
	process.env.REACT_APP_AUTH_HUB_URL || "https://auth.vpcc.church";

export default async function apiFetch(input, init) {
	// Send the hub's vpcc_session cookie; callers still add a Bearer header
	// themselves when a localStorage token exists.
	const res = await fetch(input, { credentials: "include", ...init });
	if (res.status === 401 || res.status === 403) {
		// Send the user to the auth hub, which redirects back here after login
		window.location.href = `${AUTH_HUB_URL}/?returnTo=${encodeURIComponent(
			window.location.href
		)}`;
		// Throw to stop further handling
		throw new Error("Unauthorized");
	}
	return res;
}
```

- [ ] **Step 2: Replace `src/pages/Login.js`**

```js
import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AUTH_HUB_URL } from "../utils/apiFetch";

export default function Login() {
	const location = useLocation();

	useEffect(() => {
		const returnTo = new URLSearchParams(location.search).get("returnTo");
		// Old-style relative returnTo values (e.g. "/admin") become absolute so
		// the hub can validate the host and send the user back here.
		const target = new URL(returnTo || "/", window.location.origin).href;
		window.location.replace(
			`${AUTH_HUB_URL}/?returnTo=${encodeURIComponent(target)}`
		);
	}, [location.search]);

	return <p>Redirecting to login…</p>;
}
```

- [ ] **Step 3: Create `.env.example`**

```bash
# Server (Netlify functions) — set real values in .env / Netlify dashboard
MONGODB_URI=
JWT_SECRET=

# Optional: auth hub base URL (no trailing slash). Defaults to https://auth.vpcc.church
# e.g. REACT_APP_AUTH_HUB_URL=http://localhost:8889 for local hub development
REACT_APP_AUTH_HUB_URL=
```

- [ ] **Step 4: Add a README note**

Insert this into `README.md` right after line 1 (`# Getting Started with Create React App`), with a blank line either side:

```markdown
## Auth

Login is handled by the shared auth hub (auth.vpcc.church). `/login` redirects there
with `?returnTo=`; the hub sets a `vpcc_session` cookie on `.vpcc.church`, which the
functions accept when no `Authorization: Bearer` header is sent. The legacy
localStorage token flow still works.

- `REACT_APP_AUTH_HUB_URL` (optional) — hub base URL, default `https://auth.vpcc.church`.
- `npm run test:functions` — runs the Netlify function unit tests (`node --test`).
```

- [ ] **Step 5: Check the build**

Run: `CI=false npm run build`
Expected: ends with `Compiled successfully.` or `Compiled with warnings.`, and `build/` is written. Any warnings must be from files not touched here: the build must show no warnings for `src/utils/apiFetch.js` or `src/pages/Login.js`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/apiFetch.js src/pages/Login.js .env.example README.md
git commit -m "feat(auth): redirect login and 401s to auth hub

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Cookie session in UserContext, and hub logout

**Files:**
- Modify: `src/contexts/UserContext.js:30-68` (the `UserProvider` state and effect)
- Modify: `src/App.js:1-37` (imports and the Logout link)

**Interfaces:**
- Consumes: `GET /.netlify/functions/me` (Task 3); `AUTH_HUB_URL` from `src/utils/apiFetch.js` (Task 4)
- Produces: `useUser()` returns `{ user, logout, refreshUser }` as before. `user` can now also come from `me` (`{ id, username, role }`, with no `exp`).

- [ ] **Step 1: Replace the `UserProvider` effect in `src/contexts/UserContext.js`**

Replace lines 30-68 (from `export function UserProvider` through the end of the `useEffect`) with:

```js
export function UserProvider({ children }) {
	const [user, setUser] = useState(null);
	const [refreshToken, setRefreshToken] = useState(0);

	useEffect(() => {
		const token = localStorage.getItem("token");
		let expiryTimer = null;
		let cancelled = false;
		if (token) {
			try {
				const decoded = decodeJwt(token);
				// If token has an exp claim (seconds since epoch), check expiry
				if (decoded && decoded.exp) {
					const nowSec = Date.now() / 1000;
					if (nowSec >= decoded.exp) {
						console.info("Token expired, removing");
						localStorage.removeItem("token");
						setUser(null);
						return;
					}
					// schedule auto-logout when token expires
					const msUntilExpiry = decoded.exp * 1000 - Date.now();
					expiryTimer = setTimeout(() => {
						localStorage.removeItem("token");
						setUser(null);
					}, msUntilExpiry);
				}
				setUser(decoded);
			} catch (error) {
				console.error("Invalid token", error);
				localStorage.removeItem("token");
			}
		} else {
			setUser(null);
			// No local token: check for an auth hub session cookie. Plain fetch
			// (not apiFetch) so a 401 leaves public visitors on the public view.
			fetch("/.netlify/functions/me", { credentials: "include" })
				.then((res) => (res.ok ? res.json() : null))
				.then((data) => {
					if (!cancelled && data && data.user) setUser(data.user);
				})
				.catch((err) => console.error("Session check failed", err));
		}

		return () => {
			cancelled = true;
			if (expiryTimer) clearTimeout(expiryTimer);
		};
	}, [refreshToken]);
```

Leave everything after it (`logout`, `refreshUser`, the provider JSX and `useUser`) unchanged.

- [ ] **Step 2: Update the Logout link in `src/App.js`**

Replace lines 1-37 (imports through the closing `</li>` of the nav item) with:

```js
import {
	Link,
	Route,
	BrowserRouter as Router,
	Switch,
	Redirect,
} from "react-router-dom";

import ReadCalendar from "./pages/ReadCalendar";
import EditCalendar from "./pages/adminOnly/EditCalendar";
import ErrorBanner from "./components/ErrorBanner";
import Login from "./pages/Login";

import React from "react";
import { UserProvider, useUser } from "./contexts/UserContext";
import { AUTH_HUB_URL } from "./utils/apiFetch";

async function logout(e) {
	e.preventDefault();
	try {
		// Clear the shared vpcc_session cookie on the hub
		await fetch(`${AUTH_HUB_URL}/api/logout`, {
			method: "POST",
			credentials: "include",
		});
	} catch (err) {
		console.error("Hub logout failed", err);
	}
	localStorage.removeItem("token");
	window.location.href = "/";
}

function App() {
	const { user } = useUser();
	return (
		<Router>
			<main className="group--vt--lg">
				<ul className="nav__wrapper">
					<li>
						{user ? (
							<Link to="/" onClick={logout}>
								Logout
							</Link>
						) : (
							<Link to="/login">Login</Link>
						)}
					</li>
```

Leave everything from `</ul>` onward unchanged.

- [ ] **Step 3: Check the build**

Run: `CI=false npm run build`
Expected: `Compiled successfully.` or `Compiled with warnings.`, with no warnings for `src/contexts/UserContext.js` or `src/App.js`. The existing unused `UserProvider` import in App.js may already produce a warning; that's fine.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/UserContext.js src/App.js
git commit -m "feat(auth): load hub cookie session and log out via hub

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Manual end-to-end verification

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything above. A hub token, if the hub is available.

- [ ] **Step 1: Run the unit tests**

Run: `npm run test:functions`
Expected: `# pass 12`, `# fail 0`.

- [ ] **Step 2: Start Netlify dev**

Run (in a separate terminal or in the background): `cd /Users/gilbertvirgo/vpcc-calendar && netlify dev`
Expected: `Local dev server ready: http://localhost:8888`, with `me` in the list of loaded functions.

- [ ] **Step 3: Get a token without printing the secret**

Preferred: log in on the hub, copy the `vpcc_session` cookie value from browser devtools, and run `TOKEN='<pasted value>'`.
If the hub isn't available, mint one locally (the secret stays inside node):
```bash
TOKEN=$(node --env-file=.env -e "process.stdout.write(require('jsonwebtoken').sign({id:'manual',username:'admin',role:'admin'},process.env.JWT_SECRET,{expiresIn:'1h'}))")
```

- [ ] **Step 4: `me` with no credentials returns 401**

Run: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8888/.netlify/functions/me`
Expected: `401`

- [ ] **Step 5: `me` with the cookie returns 200**

Run: `curl -s -w '\n%{http_code}\n' -b "vpcc_session=$TOKEN" http://localhost:8888/.netlify/functions/me`
Expected: `{"user":{"id":"...","username":"admin","role":"admin"}}` then `200`

- [ ] **Step 6: The bearer flow still works**

Run:
```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" http://localhost:8888/.netlify/functions/me
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" "http://localhost:8888/.netlify/functions/get-events?year=2026&month=9"
curl -s -o /dev/null -w '%{http_code}\n' -b "vpcc_session=$TOKEN" "http://localhost:8888/.netlify/functions/get-events?year=2026&month=9"
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:8888/.netlify/functions/get-events?year=2026&month=9"
```
Expected: `200`, `200`, `200`, `401`.

- [ ] **Step 7: Browser checks**

1. Open `http://localhost:8888/login`. It should immediately go to `${REACT_APP_AUTH_HUB_URL or https://auth.vpcc.church}/?returnTo=http%3A%2F%2Flocalhost%3A8888%2F`.
2. In devtools, set the cookie `vpcc_session=<TOKEN>` for `localhost`, make sure localStorage has no `token`, and reload `/`. The nav should show "Logout" and the admin EditCalendar view should load.
3. Click Logout. You should land on `/` showing "Login". The hub `/api/logout` request appears in the Network tab. Locally it may fail CORS unless the hub allows `localhost`; the error is logged and localStorage is still cleared.

- [ ] **Step 8: Stop Netlify dev.** Nothing to commit.
