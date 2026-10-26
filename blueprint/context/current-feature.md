# Feature: Guest checkout

**From build-plan:** feature 6
**Build attempt:** 1
**Status:** verified
**Branch:** feature/guest-checkout

## Goal

A guest opens `/fund/<slug>/give`, enters an amount (£10 minimum), their name,
email, an optional message and a show-amount choice, sees the card fee and total
before paying, and is sent to Stripe Checkout (test mode). The server computes
the fee, writes a `pending` guest contribution, creates the Checkout Session with
two line items and the contribution id in metadata, and stores the session id on
the contribution. After paying, Stripe returns the guest to `/fund/<slug>/thanks`,
which says thank you and never adds credit.

## In scope

- `stripe` npm dependency and a lazily created server-only client that refuses
  any key that is not a Stripe test key.
- `STRIPE_SECRET_KEY` env var, documented in `.env.example`.
- `/fund/<slug>/give`: form, live fee and total preview, closed and not-found
  states, validation errors, unexpected-error message.
- Server action: validation, server-side minimum and fee, open-fund check,
  pending contribution insert, Checkout Session creation, saving
  `stripe_session_id`, redirect to Stripe.
- `/fund/<slug>/thanks`: thank-you screen for the fund, with a link back to the
  fund page.
- Small extraction of two helpers already written inline so the new code reuses
  them: email validation (from `app/fund/new/actions.ts`) and request origin
  (from `buildShareUrl` in `app/fund/[slug]/page.tsx`).

## Out of scope

- The webhook, marking paid, writing credit, receipts or the "gift received"
  email (feature 7). After this feature a test payment leaves the contribution
  `pending` and the public page unchanged. That is expected.
- Top-ups (feature 9), mum page (8), demo clock (12; "today" stays
  `todayIsoDate()`), deployment and webhook endpoint setup (13).
- Cleaning up abandoned `pending` contributions, refunds, a maximum gift as a
  product rule.

## Build loop

`workflow.stepReview` is `feature`: build all steps, running the step's check
after each, then present one review packet for the whole feature.
`workflow.checkpointCommits` is `disabled`: no commits between steps.
`/complete` creates the final feature commit.

## Build steps

- [x] **1. Stripe client, env var, shared helpers.**
  - `npm install stripe` (current latest is 23.x). Before writing calls, read the
    installed SDK types for `checkout.sessions.create` and the client
    constructor (API version pinning, `metadata`, `line_items.price_data`).
  - `lib/stripe.ts`: `getStripe()` mirrors `getDb()` in `db/index.ts` (cached,
    throws `"STRIPE_SECRET_KEY is not set"` when missing). It throws when the key
    does not start with `sk_test_` or `rk_test_` (project rule: test mode only,
    never live keys). Import `server-only` only if it is already resolvable;
    otherwise rely on the file only being imported from server code.
  - Add `STRIPE_SECRET_KEY=` to `.env.example`.
  - Move `isValidEmail` to `lib/validation.ts` (a `"use server"` file cannot
    export sync helpers) and import it in `app/fund/new/actions.ts`.
  - Move origin building to `lib/request-origin.ts` as
    `requestOrigin(headers: Headers): string` (same host / `x-forwarded-proto`
    logic as today) and use it from `app/fund/[slug]/page.tsx`
    (`${origin}/fund/${slug}`).
  - Done when: `npm run verify` passes, and `/fund/new` still creates a fund and
    `/fund/<slug>` still shows the same share link (manual).

- [x] **2. Thanks page.**
  - `app/fund/[slug]/thanks/page.tsx`, same shell and Suspense + `connection()`
    pattern as `app/fund/[slug]/page.tsx`. Looks the fund up by slug (reuse
    `getPublicFund` or a minimal query in `data.ts`); unknown slug -> `notFound()`.
  - Copy: "Thank you for your gift to <name>'s fund", "Your gift becomes TPS gift
    credit. It will appear on the fund page once your payment is confirmed.",
    link back to `/fund/<slug>`. It ignores any `session_id` query param, reads
    nothing from Stripe and writes nothing.
  - The existing `app/fund/[slug]/error.tsx` covers load failures for nested
    routes; confirm it applies, otherwise reuse it.
  - Done when: `/fund/<existing>/thanks` renders the message, `/fund/nope/thanks`
    shows the 404, verify passes, and the DB has no new rows from visiting it.

- [x] **3. Give page and form with validation (no payment yet).**
  - `app/fund/[slug]/give/page.tsx` (Server Component, Suspense +
    `connection()`): unknown slug -> `notFound()`. If
    `fundStatus(closeDate, todayIsoDate()) !== "open"`: show "This fund closed on
    <date>" and a link back, no form. Otherwise render the heading
    "Give to <name>'s fund", the gift-credit line, and the form.
  - `app/fund/[slug]/give/give-form.tsx` (client), following
    `create-fund-form.tsx` patterns (`useActionState`, `noValidate`, labelled
    inputs, `aria-invalid` + `aria-describedby` per field, error summary with
    `role="alert"` focused on invalid/error, values preserved after errors).
    Fields:
    - `amount` - "Gift amount in pounds", text input `inputMode="decimal"`,
      placeholder "e.g. 50".
    - `name` - "Your name", hint "shown with your message on the fund page".
      Required, max 100.
    - `email` - "Your email", hint "for your receipt". Required, `isValidEmail`.
    - `message` - optional textarea, max 1000.
    - `showAmount` - checkbox "Show my gift amount on the fund page", unchecked
      by default; hint that the total always includes it and the mum always sees it.
  - Live preview under the amount, computed in the browser with
    `parsePoundsToPence`, `meetsMinimum`, `cardFeePence` and `formatPence` from
    `@/lib/fund-rules` (pure, client-safe): "Gift £50.00 + card fee £0.97 = £50.97
    total". Shown only when the amount parses and meets the minimum; otherwise a
    neutral hint "Minimum gift £10". Use `aria-live="polite"` on the preview. The
    preview is display only; nothing from it is submitted.
  - Server action `giveToFund` in `app/fund/[slug]/give/actions.ts`, bound to the
    slug (`giveToFund.bind(null, slug)`), returning a typed state like
    `CreateFundState` (`idle | invalid | error`). It reads only `amount`, `name`,
    `email`, `message`, `showAmount` from FormData (never a fee or total).
    Validation messages:
    - amount empty -> "Please enter a gift amount."; unparseable -> "Please enter
      an amount in pounds, like 50 or 25.50."; below minimum -> "The minimum gift
      is £10."; total over Stripe's single-payment limit (amount + fee >
      99,999,999 pence) -> "Please enter a smaller amount."
    - name, email, message as listed above.
    - Re-load the fund by slug; missing -> `error` "This fund could not be
      found."; not open -> `error` "This fund is closed and no longer accepts
      gifts."
    - For now a valid submission returns `error` "Payment is not connected yet."
      (replaced in step 4).
  - Done when: verify passes; manually, `/fund/<open>/give` shows the form and
    the preview shows £50.97 total for 50 and £10.36 for 10; submitting 9.99,
    empty name, or a bad email shows field errors with the summary focused and
    values kept; a closed fund (set `close_date` in the past with `db:studio`)
    shows the closed message; `/fund/nope/give` 404s. The public page's
    Contribute button reaches this page.

- [x] **4. Pending contribution and Stripe Checkout.**
  - On a valid, open-fund submission in `giveToFund`:
    1. `amountPence` from `parsePoundsToPence`, `feePence = cardFeePence(amountPence)`.
    2. Insert into `contributions`: `type: "guest"`, `status: "pending"`,
       `fundId`, trimmed `name`, `email`, `message` (null when empty),
       `amountPence`, `feePence`, `showAmount` (true only when the checkbox
       value is present), returning `id`.
    3. `getStripe().checkout.sessions.create({ mode: "payment", customer_email:
       email, line_items: [...], metadata: { contribution_id: id }, success_url,
       cancel_url })` with two GBP line items, quantity 1, `price_data.unit_amount`
       in pence: `Gift to <mumFirstName>'s fund` (amountPence, product
       description "TPS gift credit") and `Card processing fee` (feePence).
       `success_url` = `${origin}/fund/<slug>/thanks?session_id={CHECKOUT_SESSION_ID}`,
       `cancel_url` = `${origin}/fund/<slug>/give`, where `origin` comes from
       `requestOrigin(await headers())`.
    4. Update that contribution's `stripe_session_id` to `session.id`.
    5. `redirect(session.url)` outside any try/catch (Next's `redirect` throws;
       its docs confirm absolute external URLs are allowed).
  - Errors: any DB or Stripe failure logs with `console.error` and returns
    `error` "We couldn't start the payment. Please try again." with values kept.
    A failure after the insert leaves a `pending` row with no session id; it can
    never become paid and is never shown publicly, so no cleanup is added.
    Never log the key or full card/session payloads.
  - Submit button disabled while pending, label "Continue to payment" /
    "Taking you to payment...".
  - Done when: verify passes; with a `sk_test_` key and `DATABASE_URL` in
    `.env.local`, giving £50 lands on Stripe Checkout showing the two line items
    totalling £50.97; paying with test card 4242 4242 4242 4242 returns to the
    thanks page; the contribution row is `pending` with `amount_pence 5000`,
    `fee_pence 97` and a `cs_test_...` session id matching the Stripe dashboard
    session's `metadata.contribution_id`; the public page total is unchanged
    (credit waits for feature 7); cancelling on Stripe returns to the give page;
    a non-test key makes the action return the error message.

## Files / areas

- `package.json`, `package-lock.json` - add `stripe`
- `.env.example` - `STRIPE_SECRET_KEY=`
- `lib/stripe.ts` (new), `lib/validation.ts` (new), `lib/request-origin.ts` (new)
- `app/fund/new/actions.ts` - import `isValidEmail`
- `app/fund/[slug]/page.tsx` - use `requestOrigin`
- `app/fund/[slug]/data.ts` - reuse, or add a small fund-by-slug query if needed
- `app/fund/[slug]/give/page.tsx`, `give-form.tsx`, `actions.ts` (new)
- `app/fund/[slug]/thanks/page.tsx` (new)
- No schema change and no migration: `contributions` already has every field.

## Data / contracts

- Trust boundary: everything in FormData and the URL is untrusted. The server
  recomputes `amountPence` and `feePence`; the browser preview is never trusted.
- `contributions` row written here: `type guest`, `status pending`,
  `amount_pence` (what becomes credit), `fee_pence` (paid on top),
  `show_amount`, `stripe_session_id` set after the session is created (unique;
  feature 7's webhook finds the contribution by it).
- Stripe Checkout Session: `mode payment`, currency `gbp`, two line items
  (`Gift to <name>'s fund`, `Card processing fee`), product wording "TPS gift
  credit", `metadata.contribution_id` = contribution uuid, `customer_email` =
  guest email, success `/fund/<slug>/thanks?session_id={CHECKOUT_SESSION_ID}`,
  cancel `/fund/<slug>/give`. Session total = amount + fee.
- Rendering: guest name and message are rendered as React text (escaped), with
  `whitespace-pre-line` for the message, same as the public page. They go to
  Stripe only through the `customer_email` and the mum's first name in the line
  item name.
- Env: `STRIPE_SECRET_KEY` (test key only). Verify and build do not need it
  because the client is created lazily inside the action.

## Testing

- No test runner is configured, so no unit tests. Checks are `npm run verify`
  (and `npm run lint`) plus the manual checks in each step's Done when.
- Step 4's end-to-end check needs a real Stripe test key and the Neon database;
  record it as not run if they are unavailable rather than claiming it.
- Fee examples to confirm in the preview and in Stripe: £10 -> £0.36 fee
  (£10.36), £50 -> £0.97 (£50.97).

## Notes for the AI

- Read the relevant Next 16 docs in `node_modules/next/dist/docs/` for server
  actions with `useActionState`, `redirect` in server actions, and `connection()`
  before writing those pieces. Follow the existing Cache Components pattern
  (Suspense wrapper + `await connection()` before `todayIsoDate()`).
- Use the generated route types (`PageProps<"/fund/[slug]/give">`).
- Reuse `@/lib/fund-rules` for every money and date rule; do not reimplement the
  fee, minimum, or status.
- Wording: "gift", "TPS gift credit"; never "donation" or "fundraiser". No em
  dashes in copy, comments, or docs.
- Payments are a sensitive boundary, so `qualityGates.regular.independentReview:
  when-sensitive` will select independent review before `/complete`.
- The overview's open question on env var names is answered here by
  `STRIPE_SECRET_KEY`; the webhook secret name belongs to feature 7.
