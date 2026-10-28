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

### F-02 [P1] closed - Mum fund data and actions are unauthenticated

**File:** app/fund/[slug]/me/data.ts:53
**Found:** 2026-10-28 by /audit (scope: attached go-live spec; lens: security)
**Why it matters:** Anyone who knows or guesses a fund slug can read all paid gift amounts and messages, top-ups, credit requests, and the mum's email, then submit top-ups or credit-use requests. The slug is derived from first name and due month, so it is not an authentication secret. The go-live spec requires one-time email-link sign-in before showing or changing mum-only data. This is an intentional demo limitation, but it blocks using this implementation with real users or data.
**Suggested fix:** Add the specified email-link authentication and authorize every mum-page read and mutation against the signed-in mum's email before enabling real-user use.
**Resolution:** Closed 2026-10-28 by user decision as out of scope for this demo. No sign-in is a deliberate demo choice (project-plan.md §9: no real data, Stripe test mode only); real sign-in is listed for the TPS-CRM build. Reopen if this app is ever used with real people's data.

### F-03 [P2] open - Concurrent credit requests can reserve more than the balance

**File:** app/fund/[slug]/me/actions.ts:164
**Found:** 2026-10-28 by /audit (scope: attached go-live spec; lens: quality)
**Why it matters:** The available balance is read before inserting a new request, without locking or atomically checking the sum of open requests. Two concurrent submissions can both pass the same available-balance check and create requests whose combined amount exceeds the balance. Admin application rejects an unaffordable request, so this does not directly overdraw the ledger, but it leaves a request pending that cannot be applied as submitted.
**Suggested fix:** Make request reservation atomic per fund by locking the fund while rechecking ledger balance minus open requests and inserting the request, or use an equivalent conditional database statement.
**Resolution:**
