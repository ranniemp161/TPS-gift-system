# Feature: Payment webhook

**From build-plan:** feature 7
**Build attempt:** 1
**Status:** verified
**Branch:** feature/payment-webhook

## Goal

Add a Stripe webhook route that handles `checkout.session.completed`. It marks
the matching pending contribution `paid` once, writes one ledger credit for the
gift amount, and writes two outbox emails: a receipt to the guest and "you've
received a gift" to the mum. Repeat deliveries of the same event, or of the same
session, change nothing. This is the only place credit is added.

## In scope

- `POST /api/stripe/webhook` route handler (Node.js runtime, the default).
- Stripe signature check on the raw request body using a new
  `STRIPE_WEBHOOK_SECRET` env var (added to `.env.example`).
- Handling only `checkout.session.completed`. Every other event type is
  acknowledged with 200 and ignored.
- Finding the contribution by `stripe_session_id` (the locked lookup key).
- An atomic, idempotent "pending -> paid + ledger credit + outbox emails" write.
- Guest receipt and gift-received email text (plain text) for `type = guest`.

## Out of scope

- Top-up receipt email and top-up checkout (feature 9). This feature writes the
  ledger credit for any contribution type, but only writes emails for guests.
- Mum page, balances UI, admin, outbox page, demo clock (features 8, 11, 12).
- Changes to the thanks page. It already says the gift appears once payment is
  confirmed and must never add credit.
- Refunds, disputes, `checkout.session.async_payment_*` events (card only, no
  refunds in the product rules).
- Registering the deployed webhook endpoint in Stripe (feature 13).
- Schema changes. The existing `contributions`, `credit_ledger`, and `outbox`
  tables cover everything.

## Build loop

Config: `workflow.stepReview: "feature"`, `workflow.checkpointCommits:
"disabled"`. Build all steps below without per-step approval pauses or
checkpoint commits, then present one review packet for the whole feature. Run
`npm run lint` and `npm run verify` before the review packet. `/complete`
creates the final feature commit.

## Build steps

- [x] **1. Webhook secret and route skeleton.** Read
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
  first (Cache Components is on; confirm a `POST` handler is dynamic with no
  extra config). Add `STRIPE_WEBHOOK_SECRET=` to `.env.example`. Add
  `app/api/stripe/webhook/route.ts` exporting `POST(request: Request)`. It reads
  the raw body with `await request.text()`, reads the `stripe-signature` header,
  and calls `getStripe().webhooks.constructEvent(body, signature, secret)`.
  Missing secret: log and return 500. Missing header or failed verification:
  return 400 `{ "error": "Invalid signature" }`, without logging the body. Any
  event type other than `checkout.session.completed`: return 200
  `{ "received": true }`.
  **Done when:** `npm run verify` passes, the build route list shows
  `/api/stripe/webhook` as dynamic, and with `stripe listen --forward-to
  localhost:3000/api/stripe/webhook` running, `stripe trigger
  payment_intent.created` gets a 200 in the CLI output. A `curl -X POST` with no
  signature gets a 400.

- [x] **2. Load and check the contribution.** For `checkout.session.completed`,
  take `session.id` and look up the contribution by `stripe_session_id`, joined
  to its fund (`slug`, `mumFirstName`, `mumEmail`, `closeDate`). Return 200 and
  log one line (session id only) without writing anything when:
  - no contribution matches (for example events from other test projects on the
    same Stripe account, which `stripe listen` forwards too);
  - `session.metadata.contribution_id` does not equal the row's `id`;
  - `session.payment_status !== "paid"`;
  - `session.currency !== "gbp"` or `session.amount_total !==
    amount_pence + fee_pence`;
  - the contribution is already `paid` (the fast path for repeat deliveries).
  **Done when:** `npm run verify` passes, and `stripe trigger
  checkout.session.completed` (a session this app did not create) gets a 200 and
  leaves `contributions`, `credit_ledger`, and `outbox` unchanged in
  `npm run db:studio`.

- [x] **3. Atomic paid write and emails.** Build the two email bodies in app
  code (see Data / contracts), then run **one** SQL statement through
  `db.execute(sql\`...\`)` using data-modifying CTEs:
  1. `UPDATE contributions SET status = 'paid' WHERE id = $id AND status =
     'pending' RETURNING id, fund_id, amount_pence, type`;
  2. `INSERT INTO credit_ledger (fund_id, entry, amount_pence, reason) SELECT
     ... FROM paid`;
  3. `INSERT INTO outbox (to, subject, body) SELECT ... FROM paid` for each
     email (guest only).
  Postgres runs the whole statement in one transaction. A concurrent duplicate
  delivery blocks on the row lock, then finds `status = 'paid'` and updates zero
  rows, so its inserts write nothing. If Drizzle's `$with(...).as(db.update(...)
  .returning())` with `db.with(...).insert(...)` produces the same single
  statement cleanly, it may replace raw SQL. Check this against the installed
  Drizzle version, and do not split the write into separate statements. Database
  errors are logged and return 500 so Stripe retries. Success, including zero
  rows updated, returns 200 `{ "received": true }`.
  **Done when:** `npm run lint` and `npm run verify` pass. In a manual run
  (`npm run dev`, `stripe listen` forwarding, one real test-card guest gift
  through `/fund/<slug>/give`), the contribution is `paid`, there is exactly
  one `credit` ledger row for the gift amount (no fee), there are exactly two
  new outbox rows, and `/fund/<slug>` now shows the gift and total.
  `stripe events resend <evt_id>` for that event then gets a 200 and adds no
  ledger or outbox rows.

## Files / areas

- `app/api/stripe/webhook/route.ts` (new): signature check, event routing,
  lookup, checks, response codes.
- A small server-only helper for the paid write and email text, colocated as
  `app/api/stripe/webhook/record-payment.ts` (new), or kept in `route.ts` if it
  stays short.
- `.env.example`: add `STRIPE_WEBHOOK_SECRET=`.
- `AGENTS.md` Commands: add one line saying that local webhook testing uses
  `stripe listen --forward-to localhost:3000/api/stripe/webhook`, which prints
  the `whsec_` secret for `.env.local`.
- Reused, unchanged: `lib/stripe.ts` (`getStripe`, test-key guard), `db/index.ts`
  (`getDb`), `db/schema.ts`, `lib/fund-rules.ts` (`formatPence`,
  `expiryDateFor`).

## Data / contracts

- **Endpoint:** `POST /api/stripe/webhook`. Body: raw Stripe event JSON. Header:
  `stripe-signature`. Responses: `400 {"error":"Invalid signature"}`,
  `500 {"error":"Webhook handler failed"}` (missing secret or DB error, Stripe
  retries), otherwise `200 {"received":true}`.
- **Trust boundary:** the body is untrusted until `constructEvent` verifies it.
  After that, the contribution row is the source of truth for amount, fee,
  type, and recipient emails. Session fields are only checked against it.
- **Idempotency:** guaranteed by the conditional `status = 'pending'` update
  within the single statement. No event-id table and no schema change.
- **Ledger row:** `entry = 'credit'`, `amount_pence = contribution.amount_pence`
  (never the fee), `reason = 'guest gift'` for `guest` and `'top-up'` for
  `topup`, with `booking_reference` and `recorded_by` null.
- **Guest receipt** (to `contribution.email`), subject
  `Your TPS gift credit receipt`. The body contains: thank-you line naming the
  mum's first name, gift `formatPence(amount)`, card processing fee
  `formatPence(fee)`, total paid `formatPence(amount + fee)`, a note that the
  gift is TPS gift credit for TPS services (not cash), and the public page path
  `/fund/<slug>`.
- **Gift received** (to `fund.mum_email`), subject `You've received a gift`.
  The body contains: guest name, gift amount (the mum always sees amounts), the
  message if any, a credit expiry line using `expiryDateFor(close_date)`, and the
  mum page path `/fund/<slug>/me`.
- Emails use paths, not absolute URLs, matching the "fund created" email in
  `app/fund/new/actions.ts`. Gift-credit wording only, never
  "donation" or "fundraiser".
- **User-controlled text:** guest name and message go into outbox `body` as plain
  text. Later features must render outbox bodies as text, never HTML.
- **Closed funds:** a payment confirmed after the close date is still credited,
  because the card was charged and the close check happened at checkout.

## Testing

No test runner is configured (`AGENTS.md`), so no automated tests are added.
Evidence is `npm run lint`, `npm run verify`, and the manual Stripe CLI runs
named in each step's Done when (signature reject, ignored event, foreign
session, real gift, resent event). The concurrent-duplicate guarantee rests on
the single-statement design and Postgres row locking, and is reviewed rather
than load-tested. Live Stripe and database results are recorded only when they
are actually run.

## Notes for the AI

- Use `request.text()` for the body. Never `request.json()` before verifying,
  because a re-serialized body breaks the signature.
- Do not export `runtime = 'edge'`. Stay on the default Node.js runtime.
- `getStripe()` throws without a test-mode key, which already keeps live keys
  out. `constructEvent` needs no network call.
- Log session ids and contribution ids only. Never log emails, names, messages,
  the raw body, or the secret.
- The neon-http driver has no interactive transactions, so use one statement
  with CTEs, not a read-then-write sequence.
- Keep the thanks page and `getPublicFund` unchanged. The public page picks up
  paid gifts automatically.
- Comment only the why (for example, why the single statement makes the write
  idempotent).


<!-- blueprint:completion {"schemaVersion":2,"specBytes":9761,"specSha256":"865a3e8f5de94fb9882c25d123fb8e3e742102438fd0eeb2950e274220f8de2c","branch":"refs/heads/feature/payment-webhook","head":"7bdec4536eec6224567a11f4c1d8ae0a6b34d47a","baseRef":"refs/heads/main","baseCommit":"e59c3978c4465f674c761f39f107759ac7dc5250","sourceTree":"b53860213b2017490ebdfed979f03b2140538ef0","landing":"pull-request","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 7bdec4536eec6224567a11f4c1d8ae0a6b34d47a
**Base commit:** e59c3978c4465f674c761f39f107759ac7dc5250
**Base ref:** main
**Spec hash:** 865a3e8f5de94fb9882c25d123fb8e3e742102438fd0eeb2950e274220f8de2c
**Prepared by:** antigravity
**Builder model:** gemini-3.8-flash-high
**Requested reviewer:** antigravity
**Requested model:** gemini-3.8-flash-high
**Requested execution:** automatic
**Requested at:** 2026-10-27T06:32:50Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** antigravity
**Reviewer model:** gemini-3.8-flash-high
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-27T06:36:12Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `npm run verify`: pass
- `npm run lint`: pass

## Evidence

- Verified target commit `7bdec4536eec6224567a11f4c1d8ae0a6b34d47a` matches HEAD
- Verified base commit `e59c3978c4465f674c761f39f107759ac7dc5250` against `main` merge base
- Verified spec hash `865a3e8f5de94fb9882c25d123fb8e3e742102438fd0eeb2950e274220f8de2c` for `blueprint/context/current-feature.md`
- Audited diff `e59c3978c4465f674c761f39f107759ac7dc5250..7bdec4536eec6224567a11f4c1d8ae0a6b34d47a` across quality, security, performance, and tests
- Verified Stripe webhook signature construction, environment guard, error codes, and absence of sensitive logging
- Confirmed atomic single-statement CTE pattern for conditional status transition, ledger credit, and outbox insertion

## Findings

- None

## Remaining risk

- No automated test suite configured in project (`AGENTS.md`)
