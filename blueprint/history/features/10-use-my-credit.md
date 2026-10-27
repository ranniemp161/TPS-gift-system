# Feature: Use my credit

**From build-plan:** feature 10
**Build attempt:** 1
**Branch:** feature/use-my-credit
**Status:** verified

## Goal

Allow the mum to request using her available TPS gift credit for postpartum services from the mum page (`/fund/<slug>/me`). The mum selects a service (a single treatment with a listed price or a multi-day programme where price is agreed at consultation). For programmes, she chooses how much credit to apply. Requests are strictly capped at her available credit (balance minus open requests). Submitting writes a pending credit request to the database and sends a request notification to TPS in the demo outbox.

## In scope

- Services catalogue in `lib/services.ts`:
  - Treatments with fixed listed prices in pence: Postnatal Massage (£90), Pelvic Health Consultation (£120), Lactation Consultation (£85).
  - Programmes with "Price agreed at consultation": 7-Day Postpartum Programme, 14-Day Postpartum Programme, 30-Day Postpartum Programme.
- Available credit derivation:
  - `balancePence = creditBalancePence(fund.ledger, fund.closeDate, today)`
  - `openRequestsPence = sum(amountRequestedPence)` for `credit_requests` with `status = 'new'`
  - `availableCreditPence = Math.max(0, balancePence - openRequestsPence)`
  - Usable when fund status is `open` or `closed` (`status !== 'expired'`) and `availableCreditPence > 0`.
- Mum page data loader update in `app/fund/[slug]/me/data.ts`:
  - Query existing `credit_requests` for this fund, ordered newest first (`id`, `service`, `amountRequestedPence`, `status`, `createdAt`).
  - Calculate `openRequestsPence` and `availableCreditPence`.
- Server action `requestCredit(slug, prevState, formData)` in `app/fund/[slug]/me/actions.ts`:
  - Verifies fund exists and is not expired (`fundStatus(...) !== 'expired'`).
  - Re-computes current `availableCreditPence` on the server from the database.
  - Validates service selection against catalogue.
  - For treatments: requested credit is `Math.min(service.pricePence, availableCreditPence)`.
  - For programmes: parses entered pounds amount via `parsePoundsToPence`; validates amount > 0 and amount <= `availableCreditPence`.
  - Inserts row into `credit_requests` with `status: 'new'`.
  - Inserts email into `outbox` addressed to `team@postpartumsuite.co.uk` with subject `Credit request: <mumFirstName> - <serviceName>` and full details in the body.
  - Performed in a single atomic database batch.
- "Use my credit" section and form on `app/fund/[slug]/me/page.tsx`:
  - Client component `app/fund/[slug]/me/credit-request-form.tsx` using `useActionState`.
  - Service picker distinguishing treatments and programmes.
  - Dynamic interaction:
    - Treatments display listed price and calculated credit applied (plus any shortfall to be settled with TPS).
    - Programmes display "Price agreed at consultation" and an amount input field capped at available credit.
  - Shows clear summary of credit to be applied before submission.
  - Accessible error handling: field errors with `aria-describedby` and summary alert.
  - Submit button disabled while pending ("Submitting request...").
  - Success message banner on submission or via `?request=success` query parameter.
  - When fund has expired: message stating credit expired on close date + 12 months.
  - When available credit is £0: message stating no available credit is currently available to apply.
- Credit requests history section on `/fund/<slug>/me`:
  - Lists previously submitted credit requests with service name, amount, date, and status ("Pending TPS review" for `new`, "Applied" for `done`).
  - Empty state when no requests have been made.

## Out of scope

- Admin screen to review or record credit used / debits (feature 11).
- Outbox viewer page and demo date clock control (feature 12).
- Card payments for treatment shortfall (explicitly omitted from demo per project plan).
- Modifying or cancelling submitted credit requests.
- Sign-in or session authentication (by design for this demo).
- New tables, migrations, or database schema changes (`credit_requests` and `outbox` already exist).

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is `disabled`: implement all steps below, keeping each step working, then present one review packet for the whole feature. No checkpoint commits. `/complete` creates the final feature commit.

## Build steps

- [x] 1. **Service catalog and request rules.** Create `lib/services.ts` defining the TPS services catalog (treatments with prices, programmes without prices), service lookup helper `getServiceById`, and calculation helper `calculateCreditRequest` that given a service and available credit determines the maximum applicable credit and shortfall. Done when: `npm run typecheck` passes and service definitions match the project overview and plan.
- [x] 2. **Mum fund data loader update.** Update `app/fund/[slug]/me/data.ts` to query `credit_requests` for the fund, returning `creditRequests` (id, service, amountRequestedPence, status, createdAt), `openRequestsPence`, and `availableCreditPence`. Done when: `npm run typecheck` passes and `getMumFund` returns the full credit request state.
- [x] 3. **Credit request server action.** Add `requestCredit` action in `app/fund/[slug]/me/actions.ts`: validate fund exists, verify status is not expired, validate selected service, compute or validate credit amount against server-side available credit, insert `credit_requests` row (`status = 'new'`) and `outbox` email to `team@postpartumsuite.co.uk` in an atomic batch. Done when: `npm run typecheck` and `npm run lint` pass.
- [x] 4. **Use my credit UI and requests list.** Create `app/fund/[slug]/me/credit-request-form.tsx` with dynamic treatment/programme controls, live credit preview, error summary, and submission handling. Integrate the form and a "Credit requests" history list into `app/fund/[slug]/me/page.tsx` under a "Use my credit" section. Handle open/closed, expired, and £0 available credit states gracefully. Done when: `npm run verify` and `npm run lint` pass and the mum page renders the new section cleanly.
- [x] 5. **Verification and walkthrough.** Run `npm run verify`. Test against the dev server: open fund with credit balance, select a treatment, submit request, confirm `credit_requests` and `outbox` rows; select a programme, test invalid amounts (negative, zero, exceeding available credit), submit valid programme request; check that available credit decreases and requests appear in the history list; verify expired fund disables requests. Done when: all cases pass and results are documented in the review handoff.

## Files / areas

- `lib/services.ts` (new)
- `app/fund/[slug]/me/data.ts` (modify)
- `app/fund/[slug]/me/actions.ts` (modify)
- `app/fund/[slug]/me/credit-request-form.tsx` (new)
- `app/fund/[slug]/me/page.tsx` (modify)
- Reuse without editing: `db/schema.ts`, `lib/fund-rules.ts`

## Data / contracts

- `credit_requests` table:
  - `fund_id`: UUID of the fund.
  - `service`: Text name or ID of the requested service (e.g., "Postnatal Massage" or "7-Day Postpartum Programme").
  - `amount_requested_pence`: Positive integer in pence.
  - `status`: Enum `'new'` (pending TPS review) or `'done'` (marked in admin in feature 11).
- Outbox record:
  - `to`: `"team@postpartumsuite.co.uk"`
  - `subject`: `"Credit request: <mumFirstName> - <serviceName>"`
  - `body`: Plain text with mum name, email, fund link, service requested, amount requested, remaining available credit, expiry date, and admin link.
- Available credit constraint:
  - `openRequestsPence` is the sum of `amount_requested_pence` for all rows with `fund_id = fund.id` and `status = 'new'`.
  - `availableCreditPence = Math.max(0, balancePence - openRequestsPence)`.
  - Amount requested cannot exceed `availableCreditPence`.
- Form states:
  - Treatments: Price is fixed; credit applied is capped at `min(pricePence, availableCreditPence)`.
  - Programmes: Price agreed at consultation; user inputs amount in pounds; must be > 0 and <= `availableCreditPence`.

## Testing

No automated test runner is configured (`Test: none` in `AGENTS.md`). Verification checks:
- `npm run verify` (typecheck + build) passes.
- `npm run lint` passes.
- Manual test cases:
  - Treatment request: Select treatment (£90) with £100 available credit -> requests £90.00; available credit becomes £10.00.
  - Treatment request with shortfall: Select treatment (£90) with £50 available credit -> requests £50.00; UI notes £40.00 shortfall.
  - Programme request: Select programme, enter £40 -> requests £40.00.
  - Programme request validation: Enter £0 or negative -> validation error; enter amount exceeding available credit -> validation error.
  - Outbox email: Check `outbox` table has email to `team@postpartumsuite.co.uk` with correct details.
  - Expired fund: Change fund dates or status -> "Use my credit" shows expired notice and no form.
  - Zero available credit: Balance is £0 or open requests equal balance -> shows message that no credit is available.

## Notes for the AI

- Use `@/*` import alias.
- Follow Server Components by default; `credit-request-form.tsx` is client component (`"use client"`).
- No em dashes in text or code comments.
- Do not add auth or sign-in checks.
- Keep comments minimal and self-documenting.

## Open questions

- The service catalog uses placeholder treatments and programmes until confirmed by TPS (consistent with project overview and plan).


<!-- blueprint:completion {"schemaVersion":2,"specBytes":9516,"specSha256":"38c8f3f07800d0fb500400730d3bb5b20a6f96f0ea650284a306daf4f696986f","branch":"refs/heads/feature/use-my-credit","head":"9566e5371bb86c42b578d9485a66a71fe8154120","baseRef":"refs/heads/main","baseCommit":"9566e5371bb86c42b578d9485a66a71fe8154120","sourceTree":"ce1f0e5d38b1b20cbfb98b896b2ab1d6a17cdf91","landing":"local-merge","absentOptional":[]} -->

## Evidence

- `npm run verify` (typecheck, build) and `npm run lint` passed.
- `/check` in the browser against the dev server, with seeded test funds (removed afterwards): treatment with enough credit (£90 of £100), treatment with shortfall (£90 treatment, £50 balance requests £50), programme amounts £0, -5, abc and over-limit rejected with field errors and the alert summary, programme £4 accepted, `credit_requests` rows and the outbox email to `team@postpartumsuite.co.uk` confirmed, £0 available and expired states show no form. Browser console and network were not inspected.

## Remaining risk

- F-02 (P2, open): the available-credit check and the request insert are separate database calls, so two simultaneous submissions could reserve more than the balance. Feature 11 must refuse a debit above the ledger balance.
- F-01 (P3, open): carried over from earlier work.
