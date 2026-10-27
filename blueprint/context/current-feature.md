# Feature: Mum page

**From build-plan:** feature 8
**Build attempt:** 1
**Branch:** feature/mum-page
**Status:** verified

## Goal

Give the mum a page at `/fund/<slug>/me` (no sign-in) that shows her credit
balance, when it expires, every guest gift with its message and real amount, and
her top-up history. It is the mum's private view of the same fund the public page
shows.

## In scope

- New route `app/fund/[slug]/me/page.tsx`, plus a data loader in `app/fund/[slug]/me/data.ts`.
- Balance: `creditBalancePence(ledgerEntries, closeDate, today)` from `@/lib/fund-rules`, derived from `credit_ledger` only, never stored. Shows £0 once the fund is expired.
- Expiry date next to the balance, via `expiryDateFor(closeDate)`. Fund state from `fundStatus`: open ("open for gifts until ..."), closed ("closed on ..., credit can still be used"), expired ("credit expired on ...").
- Every paid guest gift, newest first: name, message, real amount (always, even when the guest chose to hide it publicly), date, and a small "hidden on the public page" marker when `show_amount` is false.
- Top-up history: paid `topup` contributions, newest first: amount and date. Section shows an empty state ("No top-ups yet") until feature 9.
- Empty state for no gifts ("No gifts yet") and a link back to the public fund page and its share link.
- Unknown slug renders the not-found page; a database failure renders the existing `app/fund/[slug]/error.tsx` boundary.
- Gift-credit wording only ("TPS gift credit"), never "donation" or "fundraiser". Expiry date appears wherever the balance does.

## Out of scope

- Top-up form and checkout (feature 9). The page may show the history section but no "Top up" button.
- "Use my credit" request (feature 10). No request button or form.
- Admin screen, outbox page, "pretend today is" control (features 11 and 12). Use `todayIsoDate()` for now; feature 12 swaps the source of "today".
- Any sign-in, token, or email check. The plan says anyone with the link can open this page; the demo must never hold real data.
- Listing pending (unpaid) contributions or raw ledger rows.
- New tables, columns, migrations, or dependencies.

## Build loop

`workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`: implement all steps, then show one review packet for the whole feature. No checkpoint commits; `/complete` creates the final commit.

## Build steps

- [x] 1. **Mum data loader** - `app/fund/[slug]/me/data.ts` exports `getMumFund(slug)` returning `null` for an invalid or unknown slug (same slug guard as `getPublicFund`), else the fund (slug, mumFirstName, closeDate, goalPence, note), `ledger` entries (entry, amountPence), `gifts` (paid guest contributions with real amount, `showAmount`, name, message, createdAt) and `topups` (paid topup contributions with amountPence, createdAt). All queries filter by the resolved fund id and `status = 'paid'`. Done when: `npm run typecheck` passes and the function is only reachable from server code.
- [x] 2. **Mum page** - `app/fund/[slug]/me/page.tsx` follows the public page's structure (outer `Suspense`, `await connection()`, `notFound()`, `todayIsoDate()`, same card layout and Tailwind style). Renders heading "<name>'s gift credit", balance and expiry, status line, gifts list, top-ups list, links to the public page. User text (names, messages) is rendered as plain React text with `whitespace-pre-line`, never as HTML. Sections have `aria-labelledby` headings; amounts use `formatPence`. Done when: `npm run lint` and `npm run verify` pass and `/fund/[slug]/me` appears in the route list.
- [x] 3. **Manual check against the dev server** - with a fund that has a paid shown gift, a paid hidden gift, a pending gift, and a debit entry (insert rows via `npm run db:studio` or the Stripe CLI flow), confirm what the page shows. Done when: each case in Testing behaves as described, or the gap is reported.

## Files / areas

- `app/fund/[slug]/me/page.tsx` (new)
- `app/fund/[slug]/me/data.ts` (new)
- Reuse, do not change: `lib/fund-rules.ts`, `db/schema.ts`, `app/fund/[slug]/error.tsx`, `app/fund/[slug]/data.ts` (for the slug guard pattern).
- Read `node_modules/next/dist/docs/` for Cache Components and dynamic rendering before writing the page (see `AGENTS.md`); mirror how `app/fund/[slug]/page.tsx` and `thanks/page.tsx` handle `connection()` and `instant`.

## Data / contracts

- Route: `/fund/<slug>/me`. The slug is the only access control (webhook email already links here). Slugs are guessable by design in this demo; do not add auth.
- Amounts are integer pence from the database; format only at display.
- Balance = ledger credits minus debits, forced to 0 when `fundStatus(...) === "expired"`. Do not sum contributions for the balance.
- Gifts: `contributions` where `type = 'guest'` and `status = 'paid'`. The mum sees `amount_pence` regardless of `show_amount`. The fee is not shown (it is not credit).
- Top-ups: `contributions` where `type = 'topup'` and `status = 'paid'`; they never appear on the public page and this page does not change the public loader.
- Read-only page: no writes, no server actions.

## Testing

No test runner is configured (`Test: none`), so there is no logic test gate. Checks:

- `npm run lint` and `npm run verify` pass.
- Manual, against the dev server (reported as manual, not claimed otherwise):
  - Unknown slug shows not-found.
  - Fund with no gifts shows balance £0.00, expiry date, "No gifts yet", "No top-ups yet".
  - A paid hidden-amount gift shows its real amount with the hidden marker here and no amount on the public page.
  - A pending gift does not appear and adds nothing to the balance.
  - Balance reflects credits minus a debit.
  - A fund past its expiry date shows £0.00 and the expired message (change `due_date` and `close_date` in the database, since the demo clock is feature 12).
  - Message text containing `<b>` renders literally.

## Notes for the AI

- Follow `blueprint/context/coding-standards.md`: `@/*` imports, Server Components by default (this page needs no client component), minimal comments, no em dashes in generated content.
- Do not duplicate `formatIsoDateEnGb` / `formatDateEnGb` carelessly: if the same helpers are needed, move them to a shared spot such as `lib/` only if that stays small; otherwise copy the two short functions rather than editing the public page.
- Keep the loader to two or three queries; no abstraction layer.

## Open questions

- Treatments paid by shortfall and programme instalments are not modelled (already noted in the overview); not needed here.
