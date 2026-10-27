# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to land while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P3] open - Valid years 0000-0099 are rejected as invalid dates

**File:** lib/fund-rules.ts:31
**Found:** 2026-10-26 by /audit (scope: current; lens: quality)
**Why it matters:** `Date.UTC` maps years 0-99 to 1900-1999, so `parseIsoDate` throws `RangeError` for valid calendar dates such as `0050-01-01` (confirmed by a one-off call). No fund date falls in that range, so there is no reachable impact.
**Suggested fix:** Build the date with `setUTCFullYear(year, month - 1, day)` instead of `Date.UTC`, which keeps years below 100 intact.
**Resolution:**

### F-02 [P2] open - Concurrent credit requests can reserve more than the balance

**File:** app/fund/[slug]/me/actions.ts:198
**Found:** 2026-10-27 by code review (scope: current; lens: quality)
**Why it matters:** `requestCredit` reads available credit, then inserts the request in a separate `db.batch`. Two submissions at the same instant can both pass the check, so open requests can add up to more than the balance. No credit or money moves at request time, and the demo has no sign-in, so the only realistic trigger is a double submit.
**Suggested fix:** Enforce the hard limit where credit is actually spent: Feature 11's "record credit used" must refuse a debit above the current ledger balance. A per-fund lock in the request batch (`neon-http` has no interactive transactions) was judged out of proportion for this demo.
**Resolution:**
