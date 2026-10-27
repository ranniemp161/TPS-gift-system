# Feature: Admin screen

**From build-plan:** feature 11
**Build attempt:** 1
**Branch:** feature/admin-screen
**Status:** verified

## Goal

Give the TPS team a demo page at `/admin/funds` to inspect funds and their ledger balances, dates, paid contributions, and open credit requests, and to record credit used without allowing a debit above the current ledger balance.

## In scope

- Add `/admin/funds` as a dynamic server-rendered page with a loading state, missing-data handling as applicable, and a clear empty state when no funds exist.
- List each fund with mum name and email, link to its mum page, close and expiry dates, and current balance in GBP derived from ledger credits minus debits; expired funds display a zero usable balance under the existing date rules.
- Show the fund's paid contributions, including guest gifts and private top-ups, and its credit requests. Show open (`new`) requests distinctly; completed (`done`) requests may remain visible as history.
- Allow TPS to record a credit-used debit with a positive amount in pounds, optional booking reference, and optional recorded-by name. Store money as integer pence, with a positive ledger `debit` and the existing reason `Credit used` (or an equally clear existing-compatible reason). Do not add or alter schema.
- Allow an open credit request to be applied by recording a debit for its requested amount and changing its status from `new` to `done` as one atomic operation. If the request amount exceeds the current ledger balance, leave it open and report that it cannot be applied; never write a partial or overdrawn debit.
- Recheck the current ledger balance at the database write boundary for both manual debits and request application. Reject invalid, non-positive, malformed, or over-balance amounts without changing the ledger, request status, or outbox.
- Write a `Credit used` message to the existing outbox when a debit is recorded, in the same atomic operation as the ledger write (and request status update when applicable). Include the fund and amount, and any supplied booking reference and recorded-by name. Do not send real email.
- Keep form inputs labelled and errors associated with fields and announced; show success or failure feedback, preserve entered values on validation errors, and disable the submit action while pending. Render database content as text.
- No sign-in is intentional for this demo; the page is available to anyone with its URL. Keep it restricted to test/demo data as established by the project overview.

## Out of scope

- Authentication, authorization, roles, or real customer data.
- Changing a credit request's amount, cancelling it, or editing a completed ledger entry.
- Changing the database schema or adding stored balance fields.
- The feature 12 outbox viewer or pretend-today control.
- Real email delivery, Stripe changes, or deployment.

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is `disabled`: implement all steps below, keeping each step working, then present one review packet for the whole feature. No checkpoint commits. `/complete` creates the final feature commit.

## Build steps

- [x] 1. **Admin data loader and route shell.** Add a server-side data loader for all funds, their ledger entries, paid contributions, and requests, deriving each balance with the existing money/date rules. Add `/admin/funds` with loading, empty, and data states, and links back to each mum page. Done when: `npm run typecheck` passes and the route renders a fund-free state or a representative seeded fund without storing a balance.
- [x] 2. **Fund and activity overview.** Render fund identity, close/expiry dates, current balance, paid guest gifts/top-ups, and open request details with useful dates and statuses. Done when: `npm run verify` passes and rendered amounts and expired balances match the existing ledger/date rules.
- [x] 3. **Atomic credit-used actions and forms.** Add server actions and accessible forms for a manual debit and for applying an open request. Validate on the server, re-derive the balance at the write boundary, and make debit, optional request completion, and outbox insertion atomic. Use existing tables and Neon/Drizzle capabilities; add no dependency or migration. Done when: `npm run typecheck` passes and valid submissions create exactly one debit and outbox row, request application also marks exactly that request done, and invalid or over-balance submissions leave all records unchanged.
- [x] 4. **Errors, feedback, and verification.** Complete missing-fund/request, database-error, stale-balance, and empty states; provide associated field errors and success/error announcements. Done when: `npm run verify` and `npm run lint` pass, and manual walkthroughs confirm a normal debit, request application, invalid amount, concurrent/stale over-balance refusal, and resulting mum-page balance/request status.
- [x] 5. **Admin password gate (user-approved addition).** Add `proxy.ts` that requires HTTP Basic auth with the password in `ADMIN_PASSWORD` for `/admin/*`, including the server action POSTs. Fail closed when the variable is unset. Add `ADMIN_PASSWORD=` to `.env.example`. Done when: `npm run verify` passes and the running app returns 401 without credentials and the page with them.
- [x] 6. **Landing page (user-approved addition).** Replace the Create Next App starter at `/` with a short TPS Gift Fund page linking to `/fund/new` and `/admin/funds`, and set the site title. Done when: `npm run verify` passes and `/` shows the landing page.
- [x] 7. **Expired-fund check (user-approved addition).** Verify an expired fund shows £0.00 usable, hides the debit form, and cannot be debited, using a throwaway seeded fund that is removed afterwards. Done when: observed in the running app.

## Files / areas

- `app/admin/funds/page.tsx` (new route page)
- `app/admin/funds/data.ts` (new admin data loader)
- `app/admin/funds/actions.ts` (new server actions)
- `app/admin/funds/credit-used-form.tsx` (new interactive form, if needed)
- `db/schema.ts` (reuse funds, contributions, creditLedger, creditRequests, outbox; no schema change expected)
- `lib/fund-rules.ts` (reuse balance, date, and currency helpers)
- `app/fund/[slug]/me/data.ts` (reuse current mum-page contract as needed)

## Data / contracts

- Derive balance from `credit_ledger`: sum credits minus debits. Never persist a balance. Use pence integers for calculations and `formatPence` for display.
- Display fund expiry as `expiryDateFor(closeDate)` and usable balance according to `creditBalancePence` and `todayIsoDate`; feature 12's demo clock is not available yet.
- Contributions shown must have `status = 'paid'`; distinguish `guest` gifts and `topup` contributions. Do not disclose pending contribution details as completed gifts.
- `credit_requests.status = 'new'` is open; `done` is applied. Applying a request writes a `credit_ledger` row with `entry = 'debit'`, positive `amount_pence` equal to its requested amount, `fund_id`, a clear credit-used reason, optional booking reference and recorded-by name, then changes that request to `done` and writes an outbox entry.
- Manual credit-used recording accepts an amount in pounds parsed with the existing `parsePoundsToPence`, requires a positive integer-pence result no greater than the current ledger balance, and writes a positive debit row and outbox entry. Booking reference and recorded-by name are optional text because the existing schema allows null.
- A rejection or database failure must not leave a debit without its associated outbox entry, or mark a request done without its debit. Concurrent writes must not both consume the same available balance. Ensure the chosen Neon/Drizzle write strategy provides a database-side atomic check against the ledger at commit time; if the installed driver cannot support the needed atomic operation, identify the constraint before substituting a weaker check.
- The app has no sign-in by design. Do not add an admin authorization boundary that conflicts with the project overview.

## Testing

No automated test runner is configured. Run the declared `npm run verify` and `npm run lint`. Manually verify with demo funds:

- Empty funds list and a populated fund show the expected overview.
- Paid guest gift and top-up appear; pending contributions do not.
- A valid manual debit reduces the derived balance and writes one outbox record with supplied details.
- Invalid, zero, malformed, and above-balance amounts show useful feedback and write no rows.
- Applying an open request writes a debit for its exact requested amount, marks it `done`, and writes one outbox record; it appears as applied on the mum page.
- A request made unaffordable by an intervening debit remains open and produces no new debit or outbox row.
- Repeated or competing submissions cannot debit above the current balance.
- Expired funds show zero usable balance and cannot be debited above the current ledger balance.

## Notes for the AI

- Read the relevant Next.js 16 guides in `node_modules/next/dist/docs/` before implementing route, server-action, or cache behavior.
- Follow the existing Drizzle Neon HTTP conventions. Confirm actual transaction/atomic-write support before choosing the implementation; the current database client is `drizzle-orm/neon-http` and exposes `db.batch` in existing actions.
- Use Server Components by default and client components only for form interaction.
- Keep the page usable on narrow screens and use semantic headings, labels, and status announcements.
- No em dashes in generated content. Do not add a test framework, dependency, migration, or sign-in flow.


<!-- blueprint:completion {"schemaVersion":2,"specBytes":9672,"specSha256":"c00ae456cc182b01c132588e21b793ff4e162b1b22237b11e00c4568cc8f5ae9","branch":"refs/heads/feature/admin-screen","head":"43bb2bb9c67329d9f037e1456eb3d0d11bfa8903","baseRef":"refs/heads/main","baseCommit":"31c93c544d1bc8645a68921df66815c851cdd164","sourceTree":"53d1b57cda861c451a4afe0a16622f0de696d04a","landing":"local-merge","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 43bb2bb9c67329d9f037e1456eb3d0d11bfa8903
**Base commit:** 31c93c544d1bc8645a68921df66815c851cdd164
**Base ref:** main
**Spec hash:** c00ae456cc182b01c132588e21b793ff4e162b1b22237b11e00c4568cc8f5ae9
**Prepared by:** antigravity
**Builder model:** gemini-3.8-flash-high
**Requested reviewer:** antigravity
**Requested model:** gemini-3.8-flash-high
**Requested execution:** automatic
**Requested at:** 2026-10-27T16:17:30Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** antigravity
**Reviewer model:** gemini-3.8-flash-high
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-27T16:21:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `npm run verify`: pass
- `npm run lint`: pass

## Evidence

- Verified compilation, TypeScript route types, and partial prerender production build using `npm run verify`.
- Verified zero ESLint errors or warnings across the codebase using `npm run lint`.
- Verified atomic balance check and transaction locking in `app/admin/funds/actions.ts` via `lockFund` row lock and `ledgerBalanceSql` condition inside `db.batch`, preventing overdraw and race conditions.
- Verified password gate in `proxy.ts` enforcing HTTP Basic auth for `/admin/*` and failing closed with 503 when `ADMIN_PASSWORD` is unset.
- Verified accessible forms, ARIA alert/status announcements, responsive design, and dynamic rendering on `/admin/funds`.

## Findings

- F-01: open (P3, valid dates in years 0-99 rejected in `lib/fund-rules.ts`, non-blocking)
- F-02: closed (P2, concurrent credit requests overdrawing balance resolved via atomic transaction balance checks in `app/admin/funds/actions.ts`)

## Remaining risk

- No automated test framework is configured in the project (`npm test` unavailable); reliance on static verification and manual test walkthroughs.

## Findings

### 11/F-02 [P2] closed - Concurrent credit requests can reserve more than the balance

**File:** app/fund/[slug]/me/actions.ts:198
**Found:** 2026-10-27 by code review (scope: current; lens: quality)
**Why it matters:** `requestCredit` reads available credit, then inserts the request in a separate `db.batch`. Two submissions at the same instant can both pass the check, so open requests can add up to more than the balance. No credit or money moves at request time, and the demo has no sign-in, so the only realistic trigger is a double submit.
**Suggested fix:** Enforce the hard limit where credit is actually spent: Feature 11's "record credit used" must refuse a debit above the current ledger balance. A per-fund lock in the request batch (`neon-http` has no interactive transactions) was judged out of proportion for this demo.
**Resolution:** Closed in independent review (2026-10-27): Verified that `app/admin/funds/actions.ts` re-derives the ledger balance inside the batch transaction under the fund lock (`lockFund` + `ledgerBalanceSql`) for both manual debits and credit request applications, preventing any debit or applied request from exceeding the actual available balance.
