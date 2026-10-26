# Feature: Money and date rules

**From build-plan:** feature 3
**Build attempt:** 1
**Branch:** feature/money-and-date-rules
**Status:** verified

## Goal

Put the gift fund's core rules in one pure TypeScript module: the £10 minimum, the card fee (rounded up to the penny), the close date, the expiry date, open/closed/expired status, and the balance from ledger entries. Everything works in integer pence and plain calendar dates. Later features call this module and never re-derive these rules.

## In scope

- `lib/fund-rules.ts`, a pure module with no database, network, clock or framework imports. A type-only import from `@/db/schema` is fine.
- Minimum: `MIN_AMOUNT_PENCE = 1000` and `meetsMinimum(amountPence)`.
- Card fee: `cardFeePence(amountPence)`, implementing `fee = (amount + 0.20) / 0.985 - amount` rounded **up** to the penny, using integer arithmetic only.
- Close date: `closeDateFor(dueDate)` returns `due_date + 28 days`.
- Expiry: `expiryDateFor(closeDate)` returns `close_date + 12 months`.
- Status: `fundStatus(closeDate, today)` returns `"open" | "closed" | "expired"`.
- Balance: `ledgerBalancePence(entries)` returns credits minus debits. `creditBalancePence(entries, closeDate, today)` returns that value, or `0` once the fund is expired.
- Fix the fee line in `blueprint/context/coding-standards.md` (Money and payments). It currently says `round(..., 2)`, which contradicts the overview's round-**up** rule. Point that line at `lib/fund-rules.ts`.

## Out of scope

- Parsing a pounds string from a form into pence, and formatting pence as `£` for display. Features 4 to 6 add these to the same module when a form or page first needs them.
- Where "today" comes from: the real clock, the timezone, and the "pretend today is" demo date all belong to feature 12. Features 5 and 6 pass a date in until then.
- The public total (feature 5), the credit-request cap of balance minus open requests (feature 10), and any upper amount limit.
- Database queries, the runtime DB client (feature 4), pages, server actions and Stripe.
- A test runner. See Testing.

## Build loop

`workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`. Build all three steps, run the checks for each one, then present one review packet for the whole feature. There are no checkpoint commits. `/complete` creates the feature commit and opens a pull request (`git.landing: pull-request`).

**Before step 1:** this checkout is on `feature/database-foundation`, which was squash-merged as PR #1, and local `main` (c02b76c) is behind `origin/main` (185c0f9). Switch to `main`, run `git pull --ff-only`, then create `feature/money-and-date-rules` from it.

## Build steps

- [x] **1. Amount and fee rules.** Create `lib/fund-rules.ts` with `MIN_AMOUNT_PENCE`, `meetsMinimum` and `cardFeePence`. Compute the total as `ceil((amountPence + 20) * 1000 / 985)` in integers (`Math.ceil` on an exact integer division, or `floor((n + 984) / 985)`). The fee is that total minus `amountPence`. `cardFeePence` throws `RangeError` when the amount is not a positive safe integer, or when the intermediate fee arithmetic would leave the safe-integer range. `meetsMinimum` returns `false`, without throwing, for non-integers, `NaN` and values under 1000.
  **Done when:** `npm run typecheck` and `npm run lint` pass, and a one-off Node evaluation of the module gives exactly the fee table in Data / contracts, including the exact-division case 1162 → 38.
- [x] **2. Date rules.** Add `closeDateFor`, `expiryDateFor` and `fundStatus`. All of them take and return `YYYY-MM-DD` strings, do the arithmetic in UTC calendar days so there are no timezone or DST shifts, and throw `RangeError` on a malformed or impossible date.
  **Done when:** typecheck and lint pass, and the same one-off evaluation gives exactly the date table in Data / contracts, including the Feb 29 clamp and the boundary days.
- [x] **3. Ledger balance and docs.** Add `ledgerBalancePence` and `creditBalancePence`. Update the coding-standards fee line.
  **Done when:** the balance examples in Data / contracts evaluate correctly and `npm run verify` passes.

## Files / areas

- `lib/fund-rules.ts` (new). The `lib/` folder does not exist yet. Import it with `@/lib/fund-rules`, since `@/*` maps to the project root.
- `db/schema.ts`: read only, for the type-only import of `creditLedger`.
- `blueprint/context/coding-standards.md`: the Money and payments fee line.

## Data / contracts

**Units.** Money is a `number` holding integer pence. Dates are `YYYY-MM-DD` strings, the same string form Drizzle's `date()` columns return for `funds.due_date` and `funds.close_date`.

**Fee** (`cardFeePence(amount)` → fee; total = amount + fee):

| amountPence | feePence | total |
| --- | --- | --- |
| 1000 | 36 | 1036 |
| 1162 | 38 | 1200 (exact division, so no extra penny) |
| 2000 | 51 | 2051 |
| 5000 | 97 | 5097 (overview: £50 → £50.97) |

**Minimum:** `meetsMinimum(999) === false`, `meetsMinimum(1000) === true`, and `meetsMinimum(1000.5)` and `meetsMinimum(NaN)` are both `false`.

**Dates:**

| Input | Result |
| --- | --- |
| `closeDateFor("2027-02-14")` | `"2027-03-14"` |
| `closeDateFor("2026-12-20")` | `"2027-01-17"` |
| `closeDateFor("2028-02-01")` | `"2028-02-29"` |
| `expiryDateFor("2027-03-14")` | `"2028-03-14"` |
| `expiryDateFor("2028-02-29")` | `"2029-02-28"` (clamped to month end, the same as Postgres `date + interval '12 months'`) |
| `closeDateFor("2027-02-30")` | throws `RangeError` |

**Status:** `fundStatus(closeDate, today)`. The rules say "no gifts after close" and "£0 after expiry", so "after" means strictly later:

- `today <= closeDate` → `"open"` (the close date itself is still open)
- `closeDate < today <= expiry` → `"closed"`
- `today > expiry` → `"expired"` (the expiry date itself still has credit)

With close `2027-03-14`: today `2027-03-14` is open, `2027-03-15` is closed, `2028-03-14` is closed, and `2028-03-15` is expired.

**Balance.** Entries are `Pick<typeof creditLedger.$inferSelect, "entry" | "amountPence">[]`, imported as a type only. `ledgerBalancePence` sums credits and subtracts debits. An empty list gives 0, and the result is not clamped, so it can go negative. `creditBalancePence` returns 0 when `fundStatus` is `"expired"` and the ledger balance otherwise. For example, credits 5000 and 1000 with a debit of 2500 give 3500. The same entries with today after expiry give 0.

## Testing

There is no `Test` command (see `AGENTS.md` and the coding standards), so this feature adds no committed tests and claims no test-suite results. Evidence for each step:

- `npm run typecheck`, `npm run lint`, and `npm run verify` at the end.
- A one-off, uncommitted Node evaluation of the worked examples above. Node strips the module's types natively because it only has type-only imports and erasable syntax. Record the observed outputs in the review packet.

If you want these rules covered by committed unit tests (recommended for money logic), run `/tests` first. That adds the runner and a `Test` command, and the steps above then gain matching unit tests.

## Notes for the AI

- Never compute the fee with floating point. `11.82 / 0.985` is not exactly `12`, so a float `ceil` would charge an extra penny on 1162. Integer arithmetic is required.
- Use only erasable TypeScript: no `enum` and no `namespace`. Use string-literal unions so Node can run the module directly for the one-off check.
- Don't add `server-only`. Feature 6 may show a live fee preview in the browser, and the server still recomputes the fee and enforces the minimum.
- `today` is always a parameter here. Do not call `new Date()` for "today" in this module.
- Keep doc comments to one line per export. The fee comment should say why the math is integer and rounds up.
- Don't touch `db/schema.ts`, migrations, or `AGENTS.md` commands.


<!-- blueprint:completion {"schemaVersion":2,"specBytes":7962,"specSha256":"1ba332aa70ad4799d22d2c91095523a8125fba82cf0d656976f2341cad271853","branch":"refs/heads/feature/money-and-date-rules","head":"aa8e11302a90b9110243f9ac6914e4198df862ff","baseRef":"refs/heads/main","baseCommit":"185c0f93b8887512c1e702de9cd86fbf91abf025","sourceTree":"ab712599f438f68a916abd5fcce0cb3a3d0b0304","landing":"pull-request","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** aa8e11302a90b9110243f9ac6914e4198df862ff
**Base commit:** 185c0f93b8887512c1e702de9cd86fbf91abf025
**Base ref:** main
**Spec hash:** 1ba332aa70ad4799d22d2c91095523a8125fba82cf0d656976f2341cad271853
**Prepared by:** claude
**Builder model:** claude-haiku-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-26T13:00:04Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-haiku-5-5
**Reviewer context:** fresh session
**Actual execution:** manual
**Reviewed at:** 2026-10-26T13:02:54Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git diff 185c0f9..aa8e113`: pass (3 files reviewed: `lib/fund-rules.ts`, `blueprint/context/coding-standards.md`, `blueprint/context/current-feature.md`)
- `npm run typecheck`: pass
- `npm run lint`: pass
- One-off Node evaluation of `lib/fund-rules.ts` against the spec's fee, minimum, date, status, and balance tables (run outside the repo, no files written): pass
- `npm run test`: unavailable (no test command configured)

## Evidence

- Freshness at review time: `HEAD` = `aa8e113`; `git merge-base main HEAD` = `185c0f9`; SHA-256 of `current-feature.md` matches `Spec hash`; the only dirty path is `blueprint/context/review.md`. The spec is tracked, so no local snapshot applies.
- `main` has advanced to `5ed2384` since the request was prepared. The recorded merge base still holds, so the receipt stays current.
- Every worked example in the spec's Data / contracts section evaluates to the documented value. This includes the exact-division fee case 1162 → 38, the Feb 29 clamp, the boundary days, and the empty and expired balance cases.
- Integer-division probe for the fee's `floor((n + 984) / 985)` near the safe-integer limit found no float mismatches.
- Ledger `entry` is a Postgres enum (`credit` | `debit`), so the non-credit/debit branch in `ledgerBalancePence` is not reachable from the database.
- Fund-rules module has no clock, database, network, or framework imports; `today` is always a parameter.
- Fee computed with integer arithmetic only; the server-side and client-side callers are not in this change.

## Findings

- F-01 [P3] open: valid years 0000-0099 are rejected by `parseIsoDate` (not blocking).

## Remaining risk

- No test command is configured, so the money and date rules have no committed automated tests. They are verified only by the one-off evaluation above.
- The reviewer ran in the same model as the builder (`claude-haiku-5-5`). This pass was a fresh session with no builder transcript, but the automatic isolated subagent was not started because the request did not ask for a subagent, so it completed as the manual fallback.
- `npm run build` and `npm run verify` were not run in this pass; typecheck covers compilation for the reviewed scope.
