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
