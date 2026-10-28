# Fix: Admin login page and page-role label

**Type:** Fix
**Status:** verified
**Branch:** fix/admin-login-page-and-page-role-label

## The problem

- `/admin/*` is gated by HTTP Basic auth in `proxy.ts`. The sign-in box is drawn
  by the browser, not the app, so in some browsers (embedded or in-app ones, or
  after cancelling once) nobody sees a login: only the plain text
  "Authentication required." The server does send the correct
  `www-authenticate` header, so the app cannot force the box to appear.
- The demo bar looks the same on every page, so it is unclear which page is
  public, which is the mum's private page, and which is the TPS admin screen.

## The fix

**Admin login page.** Replace the Basic-auth popup with a form login, keeping
`ADMIN_PASSWORD` as the only secret and the same fail-closed behavior.

- `lib/admin-session.ts`: `ADMIN_COOKIE = "tps_admin"`,
  `adminSessionToken(password)` (hex `HMAC-SHA256` of the fixed string
  `"tps-admin-session"` keyed by the password, via `node:crypto`), and
  `isAdminSession(cookieValue, password)` using `timingSafeEqual` on equal-length
  buffers (false on any length mismatch or missing value). Shared by the proxy
  and the login action so the two cannot drift.
- `proxy.ts` (Node runtime, matcher stays `/admin/:path*`):
  - `ADMIN_PASSWORD` unset: 503 "Admin is not configured." for everything
    under `/admin`, including the login page (unchanged fail-closed).
  - `/admin/login` is always allowed through (it must be reachable signed out,
    and its server action posts there).
  - Valid `tps_admin` cookie: pass through.
  - Otherwise: `GET`/`HEAD` redirect to `/admin/login`; any other method (the
    admin server-action POSTs) gets a plain 401 so an unauthenticated action
    never runs and is never silently redirected. No `next` parameter, so there
    is no open-redirect surface.
- `app/admin/login/page.tsx` plus a small client form and server action
  (`actions.ts`, `"use server"`):
  - One labelled "Admin password" `type="password"` field with
    `autoComplete="current-password"`, and a "Sign in" button that is disabled
    while pending.
  - Correct password: set the `tps_admin` cookie (`httpOnly`, `sameSite: "lax"`,
    `path: "/admin"`, `secure` in production, no `maxAge`, so it ends with the
    browser session), then `redirect("/admin/funds")`.
  - Wrong or empty password: stay on the page with "Incorrect password." in an
    `aria-live="polite"` region tied to the field with `aria-describedby`,
    and `aria-invalid` on the field. The password is not echoed back.
  - Password compare uses the same timing-safe helper; nothing is logged.
- `app/admin/funds/page.tsx`: add a "Sign out" button (server action deletes the
  cookie, redirects to `/admin/login`) so the demo can show both states.

**Page-role label.** In `app/demo-bar-controls.tsx`, `DemoBarLinksForRoute`
already reads the route; add `usePathname()` and show a small badge before the
links:

| Path | Label |
| --- | --- |
| `/` | Home |
| `/fund/new` | Create a fund |
| `/fund/<slug>`, `/fund/<slug>/give`, `/fund/<slug>/thanks` | Public page |
| `/fund/<slug>/me` | Mum page (private) |
| `/admin/login` | Admin sign-in |
| `/admin/*` | Admin (TPS team) |
| `/outbox` | Outbox (demo emails) |
| anything else | no badge |

The label is plain text from a fixed lookup, never from user input. The static
`DemoBarFallback` stays links-only (hooks there blocked prerendering earlier).

**Must not break:** admin page and actions behavior once signed in; the 503
fail-closed; the demo clock; `npm run verify`. Not changed: the Stripe webhook
(`/api/stripe/webhook` is outside the matcher), rate limiting or lockout (demo,
single shared password, out of scope), real accounts or per-user admin login.

## Build steps

- [x] 1. **Admin session and login.** Add `lib/admin-session.ts`, rewrite
  `proxy.ts`, add `app/admin/login/{page,login-form,actions}.tsx|ts`, and add the
  Sign out action and button on the admin funds page.
  **Done when:** signed out, `/admin/funds` redirects to `/admin/login` and an
  admin server-action POST without the cookie returns 401; a wrong password shows
  "Incorrect password." with no redirect; the right password lands on
  `/admin/funds` showing funds; Sign out returns to the login page and
  `/admin/funds` redirects again; with `ADMIN_PASSWORD` unset `/admin/login`
  returns 503; `npm run lint` and `npm run typecheck` pass.
- [x] 2. **Page-role label.** Add the badge to `DemoBarLinksForRoute`.
  **Done when:** the bar shows the correct label on `/`, `/fund/new`, a public
  fund page, its give page, its mum page, `/admin/login`, `/admin/funds` and
  `/outbox`, and no badge on an unknown route; `npm run verify` passes.

## Verify

Run `npm run dev` with `ADMIN_PASSWORD` set, then in a normal browser:
1. Open `/admin/funds` signed out: you land on `/admin/login` (no popup).
2. Enter a wrong password: "Incorrect password." appears. Enter the right one:
   the funds screen loads and "Sign out" is visible.
3. Click Sign out, then reload `/admin/funds`: back on the login page.
4. Click through Home, create a fund, the public fund page, the mum page and the
   outbox and read the badge on each.
5. `curl -i -X POST localhost:3000/admin/funds` returns 401 with no cookie.
Not covered without a test runner: automated tests (none configured).


<!-- blueprint:completion {"schemaVersion":2,"specBytes":5363,"specSha256":"96573f59b7d1f524a488c1b3436578819988680b3af4442ef0febde780ae83b6","branch":"refs/heads/fix/admin-login-page-and-page-role-label","head":"2558e1e7bb536d27af01a561220aa9210cf376eb","baseRef":"refs/heads/main","baseCommit":"9df0c975facb151d5665b887bd936242eed0be12","sourceTree":"b350e1f935d2fd233ec0892e9e8d63272caf8690","landing":"local-merge","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 2558e1e7bb536d27af01a561220aa9210cf376eb
**Base commit:** 9df0c975facb151d5665b887bd936242eed0be12
**Base ref:** main
**Spec hash:** 96573f59b7d1f524a488c1b3436578819988680b3af4442ef0febde780ae83b6
**Prepared by:** antigravity
**Builder model:** gemini-3.8-flash-high
**Requested reviewer:** antigravity
**Requested model:** gemini-3.8-flash-high
**Requested execution:** automatic
**Requested at:** 2026-10-28T07:04:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** antigravity
**Reviewer model:** gemini-3.8-flash-high
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-28T07:07:14Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `npm run verify`: pass
- `npm run lint`: pass

## Evidence

- `npm run verify` passed (typecheck and build)
- `npm run lint` passed (eslint clean)
- Gating and redirects in `proxy.ts` match spec and fail closed when `ADMIN_PASSWORD` is unset
- Timing-safe HMAC session cookie comparison in `lib/admin-session.ts` prevents timing attacks and forgery
- Login form and actions handle credential submission and session cookies safely

## Findings

- None

## Remaining risk

- No automated test suite configured in project; verification relies on static checks, build output, and manual interaction testing
