# Feature: Demo outbox and clock

**From build-plan:** feature 12
**Build attempt:** 1
**Branch:** feature/demo-outbox-and-clock
**Status:** verified

## Goal

Make the demo walkthrough finishable in one sitting: an outbox page that shows
every recorded email, and a "pretend today is" date, stored per browser, that
every closing and expiry decision reads instead of the real date. A demo bar on
every page links to the mum page (when on a fund), admin and outbox, and holds
the date control.

## In scope

- One server-side source of "today": the demo date from a per-browser cookie
  when set and valid, otherwise the real Europe/London date from
  `todayIsoDate()`.
- Every existing page and server action that calls `todayIsoDate()` switches to
  that source, so open/closed/expired, the closing gate on gifts and top-ups,
  the expiry gate on credit requests and debits, and the £0-after-expiry
  balance all follow the demo date.
- Demo bar in the root layout: links to Home, Admin, Outbox, and the mum page
  when the current route has a fund slug; shows the date in use; a "Pretend
  today is" date input with Set and "Use real date" actions.
- `/outbox` page listing every outbox row, newest first: to, subject, sent time,
  and body.

## Out of scope

- Changing stored timestamps (`created_at` on contributions, ledger, requests,
  outbox) to the demo date. They stay real server time.
- The webhook: it has no date gate and receives no browser cookie, so it keeps
  using real time. A checkout started before moving the demo date still credits
  when paid, which matches the product rule that only the webhook writes credit.
- Dates printed inside already-written outbox emails (the expiry date is fixed
  from `close_date`, so it is unaffected).
- Filtering, search, pagination, or deleting outbox rows; any real email
  provider.
- Home page changes, deployment (feature 13).

## Build loop

`workflow.stepReview` is `feature`: build all steps, then present one review
packet for the whole feature. `workflow.checkpointCommits` is `disabled`: no
step commits. `/complete` creates the final feature commit.

Before step 1, branch from an up-to-date `main`. Local `main` (31c93c5) is
behind `origin/main` (0e1eb2c, the squash of feature 11). This checkout is on
`feature/admin-screen`, whose tree matches `origin/main`. Fast-forward local
`main` to `origin/main`, then create `feature/demo-outbox-and-clock` from it.

## Build steps

- [x] 1. **Demo clock source.** Export `isIsoDate(value: string): boolean` from
  `lib/fund-rules.ts`, reusing the private `parseIsoDate` (true for a real
  `YYYY-MM-DD` calendar date). Add `lib/demo-clock.ts` with the cookie name
  constant `DEMO_DATE_COOKIE = "tps_demo_today"`, `getDemoDate(): Promise<string | null>`
  (reads `cookies()`, returns the value only when `isIsoDate` passes, otherwise
  null), and `currentIsoDate(): Promise<string>` (`getDemoDate() ?? todayIsoDate()`).
  Replace every `todayIsoDate()` call under `app/` with `await currentIsoDate()`:
  `app/fund/[slug]/page.tsx`, `give/page.tsx`, `give/actions.ts`,
  `me/page.tsx`, `me/data.ts`, `me/actions.ts` (two), `app/admin/funds/page.tsx`,
  `app/admin/funds/actions.ts` (two). In `me/data.ts`, take `today` as a
  parameter (as `getAdminFunds` already does) if that keeps the page and actions
  using one value per request; check its callers first. Keep each existing
  `await connection()` and Suspense boundary.
  **Done when:** `grep todayIsoDate app/` finds no calls; with no cookie every
  page behaves exactly as before; `npm run lint` and `npm run verify` pass.

- [x] 2. **Demo bar and date actions.** Add `app/demo-actions.ts` (`"use server"`)
  with `setDemoDate(prevState, formData)` and `clearDemoDate()`. `setDemoDate`
  trims the `demoDate` field, rejects anything `isIsoDate` refuses with
  `{ status: "error", message: "Enter a real date." }`, otherwise sets the cookie
  (`httpOnly`, `sameSite: "lax"`, `path: "/"`, `secure` in production, no
  `maxAge` so it is a browser-session cookie). `clearDemoDate` deletes it.
  Add `app/demo-bar.tsx` (Server Component, awaits `getDemoDate()`) and
  `app/demo-bar-controls.tsx` (`"use client"`, `useParams()` for an optional
  `slug`, `useActionState` for the set form). Render `<DemoBar />` in
  `app/layout.tsx` above `{children}` inside `<Suspense>` with a static fallback
  bar (links only), so cookie reading never blocks prerendering of the page shell.
  The bar shows "Demo date: <en-GB medium date>" when set, or "Using today's
  date" when not; a labelled `type="date"` input ("Pretend today is"), a Set
  button, and a "Use real date" button only while a demo date is set. The error
  message is linked by `aria-describedby`, announced in a `role="status"` /
  `aria-live="polite"` region, and cleared on the next successful set.
  Links: Home `/`, Admin `/admin/funds`, Outbox `/outbox`, and "Mum page"
  `/fund/<slug>/me` only when `slug` is present.
  **Done when:** in the browser, setting a date after a fund's close date shows
  the public page and mum page as closed and the give page refuses a gift;
  setting a date after expiry shows expired and a £0 usable balance on the mum
  page and admin, and blocks credit requests and debits; "Use real date"
  restores the real state; an empty or invalid date shows the error and leaves
  the cookie unchanged; lint and verify pass.

- [x] 3. **Outbox page.** Add `app/outbox/page.tsx`: heading "Outbox", a line
  explaining these are demo emails that were never sent, and a Suspense-wrapped
  list that awaits `connection()` and selects all `outbox` rows ordered by
  `created_at` descending. Each item shows To, Subject, sent time (en-GB,
  `Europe/London`, date and time), and the body as plain text with
  `whitespace-pre-wrap` (React text escaping only; never
  `dangerouslySetInnerHTML`). Empty state: "No emails yet. Emails appear here
  when a fund is created, a gift or top-up is paid, or credit is requested or
  used." Loading fallback: "Loading emails...". Add `app/outbox/error.tsx`
  matching `app/fund/[slug]/error.tsx`. Set page metadata title "Outbox".
  **Done when:** `/outbox` lists the emails from the walkthrough newest first
  with line breaks preserved, a body containing `<b>` renders as literal text,
  an empty database shows the empty state, the Outbox link in the demo bar
  reaches it, and lint and verify pass.

## Files / areas

- `lib/fund-rules.ts` - add exported `isIsoDate`.
- `lib/demo-clock.ts` - new; cookie name, `getDemoDate`, `currentIsoDate`.
- `app/demo-actions.ts`, `app/demo-bar.tsx`, `app/demo-bar-controls.tsx` - new;
  non-route files in `app/` (no special filename), imported by `app/layout.tsx`.
- `app/layout.tsx` - render the demo bar.
- `app/fund/[slug]/page.tsx`, `app/fund/[slug]/give/page.tsx`,
  `app/fund/[slug]/give/actions.ts`, `app/fund/[slug]/me/page.tsx`,
  `app/fund/[slug]/me/data.ts`, `app/fund/[slug]/me/actions.ts`,
  `app/admin/funds/page.tsx`, `app/admin/funds/actions.ts` - switch to
  `currentIsoDate()`.
- `app/outbox/page.tsx`, `app/outbox/error.tsx` - new route.
- No schema change, no migration, no new dependency.

## Data / contracts

- Cookie `tps_demo_today`: value is a `YYYY-MM-DD` calendar date, interpreted as
  the Europe/London date the app should treat as today. Any other value
  (missing, malformed, impossible date) is ignored and the real date is used.
  It is untrusted browser input, so it is validated on every read, not only on
  set. Any valid date is allowed, earlier or later than the real date.
- Server actions read the cookie themselves; the browser never sends "today" as
  a form field to gift, top-up, credit-request or debit actions.
- `setDemoDate` result: `{ status: "idle" } | { status: "ok" } | { status: "error", message: string }`.
- Outbox read: `id`, `to`, `subject`, `body`, `createdAt` from `outbox`, all
  rows, `created_at` descending. Read-only.

## Testing

No test runner is configured (`AGENTS.md` Commands: Test none), so no unit
tests are added. Gates per step: `npm run lint` and `npm run verify`
(typecheck, then build). Verify passed on this checkout before the spec was
written. Behavior is proven manually with `npm run dev` and `/check`, using the
demo walkthrough: create a fund, pay a gift, request credit, then move the
demo date past close and past expiry and back.

## Notes for the AI

- Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`
  before step 1. With Cache Components, `cookies()` must sit inside Suspense in
  Server Components; setting or deleting a cookie in a Server Action used as a
  form `action` re-renders the current route in the same round trip, so no
  `revalidatePath` should be needed. Confirm in the browser.
- `todayIsoDate()` stays in `lib/fund-rules.ts` as the real-date fallback; do
  not move the money or date rules.
- Admin routes are behind the HTTP Basic gate in `proxy.ts`; the demo bar link
  to Admin will prompt for the password, which is expected.
- Keep the bar visually quiet (small zinc strip) and use gift-credit wording.
- No em dashes in code comments or copy.

## Open questions

- **Should `/outbox` be behind the admin password?** The spec makes it public at
  `/outbox`, like the mum page, because it stands in for each person's inbox in
  the walkthrough. It does list every fund's mum and guest email addresses and
  mum-page links, and feature 13 deploys it publicly. If it should be gated,
  move it to `/admin/outbox` (covered by the existing `proxy.ts` matcher) before
  step 3; nothing else changes.


<!-- blueprint:completion {"schemaVersion":2,"specBytes":9572,"specSha256":"24cc6ded23b9a47ce0bcf1bfb8f3c0b18bc3b64bda66518cb88b35dbf262f5f0","branch":"refs/heads/feature/demo-outbox-and-clock","head":"0e1eb2c43280d4ede54b0032e40b6e6096de8142","baseRef":"refs/heads/main","baseCommit":"0e1eb2c43280d4ede54b0032e40b6e6096de8142","sourceTree":"7782a9daac014bf714e9806b14909fc4baa6d7c3","landing":"local-merge","absentOptional":[]} -->
