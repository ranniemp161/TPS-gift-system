# Fix: Atomic credit request reservation

**Type:** Fix
**Status:** verified
**Branch:** fix/atomic-credit-request-reservation
**Fixes:** F-03

## The problem

`requestCredit` in `app/fund/[slug]/me/actions.ts:164` reads the available
credit (ledger balance minus open requests) through `getMumFund`, validates the
amount against that snapshot, then inserts the request and its outbox email in a
separate `db.batch`. Nothing locks the fund or rechecks the balance at write
time. Two submissions at the same moment can both pass the same check, so open
requests end up larger than the balance. Admin's `applyCreditRequest` still
refuses a debit above the ledger balance, so the ledger never overdraws. But the
request is left pending, and it can never be applied as submitted.

## The fix

Use the pattern the admin debit actions already use: lock the fund row, then
write with a conditional statement.

- Move `ledgerBalanceSql(fundId)` and `lockFund(fundId)` out of
  `app/admin/funds/actions.ts` into a shared server module, `db/credit.ts`. Both
  callers import them from there, and the admin behaviour stays the same.
- Add `openRequestsSql(fundId)` alongside them: the sum of `amount_requested_pence`
  for that fund's `credit_requests` rows with status `new`.
- In `requestCredit`, swap the plain inserts for one `db.batch([lockFund(id),
  db.execute(<CTE>)])`. The CTE's source yields one row only when
  `amount <= ledgerBalance - openRequests`. The credit request and the TPS
  outbox email are inserted from that row, so either both are written or
  neither is.
- If the statement returns no rows, return the `invalid` state on the `amount`
  field: "This is more than your available credit. Refresh to see the latest
  balance." This matches the admin wording. For treatments the amount field is
  hidden, so show that case as the form's `error` message instead.

Must not break:

- The existing validation order and messages (expired, no available credit,
  unknown service, amount format, amount above available).
- The treatment rule: `calculateCreditRequest` still caps at the available
  credit read from the page snapshot. The database check is the final
  authority.
- The email body's "Credit remaining after this request" line, which still
  uses the snapshot.
- Both admin actions (`recordCreditUsed`, `applyCreditRequest`) still lock and
  check the ledger exactly as before.

Out of scope: F-01, the demo-clock and outbox gating (planned feature 13), and
any schema or migration change. None is needed.

## Build steps

- [x] 1. Extract `ledgerBalanceSql` and `lockFund` into `db/credit.ts` and add
  `openRequestsSql`. Update the admin imports. **Done when** `npm run verify`
  passes and `app/admin/funds/actions.ts` has no local copies.
- [x] 2. Make `requestCredit` reserve atomically through the lock and
  conditional CTE, with the over-balance message. **Done when** `npm run verify`
  passes. Also, against the dev database, two near-simultaneous requests whose
  combined amount is above the available credit produce exactly one
  `credit_requests` row and one outbox email, and the other submission shows
  the over-balance message.

## Verify

- `npm run verify` (typecheck and build). No test runner is configured.
- Manual: on a fund with £50 available, open the mum page in two tabs. Request a
  £40 programme in each and submit both quickly (or replay the action with
  `Promise.all` from a one-off script). Expect one request in admin, one
  "Credit request" email in `/outbox`, and an over-balance message on the other
  tab.
- Regression: a normal single request still redirects with `?request=success`.
  Admin "record credit used" and "apply request" still refuse amounts over the
  balance.


<!-- blueprint:completion {"schemaVersion":2,"specBytes":3737,"specSha256":"2fe7da06a46868d7ca005f88b78e54b8d8540354e4e3146523a9598bc5bfa229","branch":"refs/heads/fix/atomic-credit-request-reservation","head":"afee1f59927c32581f8da5d830913d401358b50b","baseRef":"refs/heads/main","baseCommit":"afee1f59927c32581f8da5d830913d401358b50b","sourceTree":"1e372b8d61b17ddb8412f3d79eacb7fca01dfe5f","landing":"local-merge","absentOptional":[]} -->

## Findings

### atomic-credit-request-reservation/F-02 [P1] closed - Mum fund data and actions are unauthenticated

**File:** app/fund/[slug]/me/data.ts:53
**Found:** 2026-10-28 by /audit (scope: attached go-live spec; lens: security)
**Why it matters:** Anyone who knows or guesses a fund slug can read all paid gift amounts and messages, top-ups, credit requests, and the mum's email, then submit top-ups or credit-use requests. The slug is derived from first name and due month, so it is not an authentication secret. The go-live spec requires one-time email-link sign-in before showing or changing mum-only data. This is an intentional demo limitation, but it blocks using this implementation with real users or data.
**Suggested fix:** Add the specified email-link authentication and authorize every mum-page read and mutation against the signed-in mum's email before enabling real-user use.
**Resolution:** Closed 2026-10-28 by user decision as out of scope for this demo. No sign-in is a deliberate demo choice (project-plan.md §9: no real data, Stripe test mode only); real sign-in is listed for the TPS-CRM build. Reopen if this app is ever used with real people's data.

## Completion notes

- Independent review: skipped by explicit user decision on 2026-10-28 (regular gate `when-sensitive`; this fix touches credit-ledger concurrency).
- Verify: `npm run verify` (typecheck, then build) passed on 2026-10-28.
- Live check: on the dev database, two near-simultaneous £40 programme requests against £50 available produced exactly one credit request and one TPS outbox email; the second tab showed "This is more than your available credit. Refresh to see the latest balance." under the amount field.
- Open findings left in the ledger: F-01 (P3, open) and F-03 (P2, fixed; awaits a later `/audit` to close).
