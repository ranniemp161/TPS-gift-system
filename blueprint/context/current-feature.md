# Feature: Mum top-ups

**From build-plan:** feature 9
**Build attempt:** 1
**Branch:** feature/mum-top-ups
**Status:** verified

## Goal

Let the mum add her own money to her fund from the mum page (`/fund/<slug>/me`).
A top-up goes through the same server-side fee, pending contribution, Stripe
Checkout, and `checkout.session.completed` webhook path as a guest gift, but is
stored as `type = 'topup'`, is never shown on the public page, and produces a
top-up receipt in the outbox instead of the guest emails.

## In scope

- A "Top up my credit" section on the mum page, shown only while the fund is
  open (`fundStatus(...) === 'open'`). When closed or expired, the section says
  top-ups are no longer possible and shows no form.
- Client form: amount in pounds only, with a live fee preview
  ("Top-up £50.00 + card fee £0.97 = £50.97 total") computed from
  `@/lib/fund-rules`, so the fee is shown before paying.
- Server action `topUpFund(slug, prevState, formData)`:
  - Parses the amount with `parsePoundsToPence`; enforces `meetsMinimum`
    (£10) and `MAX_CHARGE_PENCE` exactly as the guest action does.
  - Loads the fund by slug; returns a stable error when not found or when the
    fund is not open (`todayIsoDate()`), so a stale page cannot top up a
    closed fund.
  - Computes `cardFeePence` on the server; nothing about amount, fee, name, or
    email is trusted from the browser.
  - Inserts a pending contribution with `type: 'topup'`, `name = fund.mumFirstName`,
    `email = fund.mumEmail`, `message: null`, `showAmount: false`.
  - Creates a Stripe Checkout Session (test mode via `getStripe()`), stores
    `stripe_session_id`, and redirects to Stripe.
- Small shared helper so guest and top-up checkout use one code path for
  "insert pending contribution -> create session -> store session id".
- Return from Stripe:
  - `success_url`: `/fund/<slug>/me?topup=success&session_id={CHECKOUT_SESSION_ID}`.
    The mum page shows a `role="status"` notice: "Thanks, your top-up will be
    added to your balance once your payment is confirmed." It never writes
    credit or marks anything paid.
  - `cancel_url`: `/fund/<slug>/me`.
- Webhook: for a paid `topup` contribution, add one outbox email to the mum,
  subject `Your TPS top-up receipt`, in the same single atomic statement that
  already marks it paid and writes the `top-up` ledger credit. Guest emails stay
  guest-only (already gated on `type = 'guest'`).
- The existing mum page "Top-ups" list and balance show the top-up once the
  webhook has run (feature 8 already reads `type = 'topup'`, `status = 'paid'`).

## Out of scope

- Use my credit, credit requests, admin screen, outbox page, demo clock
  (features 10-12). Closing uses `todayIsoDate()` until feature 12.
- Any sign-in or ownership check on the mum page; no sign-in is by design for
  this demo.
- Refunds, editing or cancelling a top-up, cleaning up abandoned pending rows.
- Changing guest checkout behavior, copy, or emails.
- Re-checking the close date inside the webhook (a payment started while open
  and completed later still counts, same as guest gifts today).

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`: implement all steps below, keeping each one working, then present
one review packet for the whole feature. No checkpoint commits. `/complete`
creates the final feature commit.

## Build steps

1. [x] **Extract the shared checkout start.** Create `lib/checkout.ts` exporting
   `startContributionCheckout(...)` that takes the fund (id, slug,
   mumFirstName), the contribution fields (type, name, email, message,
   amountPence, feePence, showAmount), the line-item name, and the
   success/cancel paths; inserts the pending contribution, creates the Stripe
   session with the two gbp line items (`<line-item name>` with description
   "TPS gift credit", and `Card processing fee`), `customer_email`,
   `metadata.contribution_id`, absolute URLs built from `requestOrigin(await headers())`,
   stores `stripe_session_id`, and returns the Checkout URL (throws if Stripe
   returns no URL). Switch `app/fund/[slug]/give/actions.ts` to it with no
   change in behavior, line-item names, or URLs.
   Done when: `npm run verify` and `npm run lint` pass, and the guest flow at
   `/fund/<slug>/give` still reaches Stripe Checkout with `Gift to <name>'s fund`
   and `Card processing fee` (manual, needs `.env.local`).

2. [x] **Top-up server action.** Add `app/fund/[slug]/me/actions.ts` with
   `topUpFund` and a `TopUpState` union mirroring `GiveState`
   (`idle` | `invalid` with `errors.amount` and `values` | `error` with
   `message` and `values`). Messages: empty -> "Please enter a top-up amount.";
   unparseable -> "Please enter an amount in pounds, like 50 or 25.50.";
   below minimum -> "The minimum top-up is £10."; too large -> "Please enter a
   smaller amount."; fund missing -> "This fund could not be found."; not open
   -> "This fund is closed and no longer accepts top-ups."; any DB/Stripe
   failure -> logged with `console.error` and "We couldn't start the payment.
   Please try again." Line item `Top-up to <mumFirstName>'s fund`; success and
   cancel paths as in scope. `redirect()` is called outside the try/catch.
   Done when: `npm run verify` and `npm run lint` pass.

3. [x] **Top-up form on the mum page.** Add `app/fund/[slug]/me/topup-form.tsx`
   (client, `useActionState`) and render it in a new "Top up my credit" section
   on `app/fund/[slug]/me/page.tsx` while the fund is open, bound with
   `topUpFund.bind(null, fund.slug)`. Copy explains top-ups become TPS gift
   credit with the same expiry, are private (never shown on the public page),
   minimum £10, and that the card fee is added on top. Labelled amount input
   (`inputMode="decimal"`), `aria-live="polite"` fee preview, field error linked
   with `aria-describedby` and `aria-invalid`, error summary with
   `role="alert"` focused on invalid/error results, submit disabled while
   pending ("Taking you to payment..."). When closed or expired, show
   "Top-ups closed on <close date>." instead of the form. Read
   `searchParams.topup === 'success'` inside the existing Suspense boundary and
   show the confirmation notice.
   Done when: `npm run verify` and `npm run lint` pass; on an open fund the
   preview shows £50 -> £50.97 total; submitting `5` shows the minimum error;
   submitting `50` reaches Stripe Checkout with `Top-up to <name>'s fund`
   £50.00 and `Card processing fee` £0.97 (manual); a closed fund shows no
   form.

4. [x] **Top-up receipt in the webhook.** In `app/api/stripe/webhook/route.ts`,
   add `buildTopupReceiptBody` (hi <name>, top-up amount, card fee, total paid,
   "Your top-up becomes TPS gift credit for TPS services (not cash).", credit
   expiry date, `Manage your fund: /fund/<slug>/me`) and a
   `topup_receipt_insert` CTE that inserts it to `row.mumEmail` `FROM paid WHERE
   type = 'topup'`, inside the existing single statement.
   Done when: `npm run verify` and `npm run lint` pass; with `stripe listen`
   forwarding, paying a £50 top-up in test mode results in: the contribution
   `paid`, one `credit` ledger row of 5000 with reason `top-up`, one outbox row
   `Your TPS top-up receipt` to the mum, no guest emails; the mum page balance
   rises by £50.00 and the top-up appears under Top-ups; the public page total
   and messages are unchanged; resending the event (`stripe events resend`)
   adds nothing (manual, needs `.env.local` and the Stripe CLI).

## Files / areas

- `lib/checkout.ts` (new) - shared pending-contribution + Checkout Session start.
- `app/fund/[slug]/give/actions.ts` - use the helper; behavior unchanged.
- `app/fund/[slug]/me/actions.ts` (new) - `topUpFund` server action.
- `app/fund/[slug]/me/topup-form.tsx` (new) - client form.
- `app/fund/[slug]/me/page.tsx` - Top up section, closed message, success notice.
- `app/api/stripe/webhook/route.ts` - top-up receipt outbox email.
- No schema or migration change: `contribution_type` already has `topup`.

## Data / contracts

- `contributions` row for a top-up: `type = 'topup'`, `status = 'pending'` until
  the webhook, `name = funds.mum_first_name`, `email = funds.mum_email`,
  `message = null`, `show_amount = false`, `amount_pence` >= 1000,
  `fee_pence = cardFeePence(amount_pence)`, `stripe_session_id` set after the
  session is created.
- Stripe session: `mode: 'payment'`, currency `gbp`, line items
  `[Top-up to <name>'s fund (TPS gift credit), amount]` and
  `[Card processing fee, fee]`, `metadata.contribution_id`, `customer_email`
  = mum email. `amount_total` must equal amount + fee (the webhook already
  rejects mismatches).
- Webhook (unchanged lookup and idempotency): finds the row by
  `stripe_session_id`, checks metadata, `payment_status`, currency, and total,
  and only the `status = 'pending'` gated statement writes. For `topup`: one
  ledger `credit` with reason `top-up` (existing) and one outbox row
  `{ to: mumEmail, subject: 'Your TPS top-up receipt', body }`. Repeat events
  write nothing.
- Public page (`getPublicFund`) already filters `type = 'guest'`; top-ups never
  reach it or its total.
- User-controlled text (mum first name) is rendered through React text nodes
  only and written to the plain-text outbox body; no HTML rendering.

## Testing

- No test runner is configured, so there are no unit tests.
- Every step: `npm run verify` (typecheck, build) and `npm run lint`.
- Manual, with `.env.local` and `stripe listen --forward-to localhost:3000/api/stripe/webhook`:
  the done-when checks in steps 1, 3 and 4 (guest flow unchanged, preview and
  validation, Stripe line items, webhook effects, idempotent resend, public page
  unchanged, closed fund shows no form).
- Baseline before this spec: `npm run verify` passed on `main` (typecheck and
  build, all routes generated).

## Notes for the AI

- Read `node_modules/next/dist/docs/` for server actions, `redirect`, and
  `searchParams` under Cache Components before writing route code; the mum page
  reads dynamic data inside its existing `<Suspense>` with `connection()`.
- Mirror `give-form.tsx` and `give/actions.ts` patterns (error summary, focus,
  field ids, copy style). Keep gift-credit wording: never "donation",
  "fundraiser", or "cash" except "not cash".
- Keep the webhook to one SQL statement: neon-http has no interactive
  transactions. Data-modifying CTEs all run, so the new insert must select
  `FROM paid WHERE type = 'topup'`.
- Do not trust any amount, fee, name, or email from the form; the only input is
  the amount string.
- The `topup=success` notice is informational; do not look up the session or
  change any data from it.
- Decisions taken (reversible, no persisted-data impact): top-up form lives on
  the mum page rather than a new route; Stripe line-item name
  `Top-up to <name>'s fund`; receipt subject `Your TPS top-up receipt`.
