# Feature: Public fund page

**From build-plan:** feature 5
**Build attempt:** 1
**Branch:** feature/public-fund-page
**Status:** verified

## Goal

Anyone with the link opens `/fund/<slug>` and sees the mum's gift fund: the
total given so far, a goal bar when a goal is set, guests' messages (with each
amount shown only when that guest chose to show it), the close date, a share
link with a copy button, and a Contribute button while the fund is open. The
page reads the database on every request, so a newly paid gift appears on the
next load.

## In scope

- Dynamic route `app/fund/[slug]/page.tsx` (Server Component) that loads the
  fund by slug and renders the public view, or the 404 page for an unknown slug.
- A server-only data function that selects **only public columns** and the
  fund's **paid guest** contributions. Hidden amounts are removed on the server
  before rendering, so they never reach the HTML.
- Public total = sum of `amount_pence` of paid guest contributions, including
  hidden amounts. Top-ups and pending contributions are excluded.
- Goal bar when `goal_pence` is set: `£X given of £Y goal`, capped at 100%
  visually, with the real total in the text even past the goal.
- Guest message list, newest first: guest name, message (if any), amount (only
  when `show_amount`), and the gift date.
- Close date and open/closed state from `fundStatus` in `@/lib/fund-rules`.
  Credit expiry shown alongside ("Gift credit can be used until ...") because
  expiry is shown wherever credit is.
- Share link: the full URL of the page in a read-only field plus a "Copy link"
  button (small client component) with an announced result.
- Contribute: a link to `/fund/<slug>/give` shown only while the fund is open.
  When closed or expired, a plain message replaces it ("This fund closed on
  ...").
- A `todayIsoDate()` helper in `@/lib/fund-rules` returning today's date as
  `YYYY-MM-DD` in `Europe/London`, used as "today" until feature 12 adds the
  demo clock.
- Loading fallback and a route error boundary with a retry.

## Out of scope

- The give page and thanks page (feature 6). The Contribute link 404s until
  feature 6 lands.
- The mum page (feature 8) and any link to it from this page: the public page
  must not advertise the mum page.
- The "pretend today is" demo date and demo bar (feature 12).
- Dynamic page metadata with the mum's name, Open Graph images, social share
  buttons, or a QR code.
- Pagination of messages (demo funds are small).
- Replacing the scaffold home page or root layout metadata.
- Adding a test runner, a dependency, or any schema or migration change.

## Build loop

`workflow.stepReview` is `feature`: implement all steps, then present one
review packet for the whole feature. `workflow.checkpointCommits` is
`disabled`: no checkpoint commits between steps. `/complete` creates the final
commit and, with `git.landing: "pull-request"`, offers the push and PR.

## Build steps

- [x] 1. **Today helper.** Add `todayIsoDate(now: Date = new Date()): string`
  to `lib/fund-rules.ts`, formatting `now` as `YYYY-MM-DD` in the
  `Europe/London` time zone with `Intl.DateTimeFormat("en-CA", { timeZone:
  "Europe/London", ... })` (or `formatToParts`), no new dependency. The `now`
  parameter is the test seam and the hook feature 12 will use.
  **Done when:** `npm run typecheck` passes and a one-off `node -e` run of the
  same `Intl` formatting shows `2026-06-30T23:30:00Z` -> `2026-07-01` (BST)
  and `2026-12-31T23:30:00Z` -> `2026-12-31` (GMT); no test runner is added.

- [x] 2. **Public data loader.** Add `app/fund/[slug]/data.ts` with
  `import "server-only"` only if the package is already resolvable (otherwise
  omit it; the file is imported only by the Server Component page) and export
  `getPublicFund(slug: string)` returning `null` or:

  ```ts
  {
    slug: string;
    mumFirstName: string;
    closeDate: string;   // YYYY-MM-DD
    goalPence: number | null;
    note: string | null;
    totalPence: number;  // all paid guest gifts, hidden amounts included
    gifts: {
      id: string;
      name: string;
      message: string | null;
      amountPence: number | null; // null when show_amount is false
      createdAt: Date;
    }[];
  }
  ```

  Return `null` without querying when the slug is empty or longer than 100
  characters. Use `getDb()` with Drizzle's query builder (parameterised):
  one select of `funds` by slug for `id` (internal lookup only, not returned)
  and the public columns (never `mum_email`, `created_by_email` or
  `due_date`), then one
  select of `contributions` where `fund_id` matches, `type = 'guest'` and
  `status = 'paid'`, ordered by `created_at` desc (selecting `id`, `name`,
  `message`, `amount_pence`, `show_amount`, `created_at`, never `email`,
  `fee_pence` or `stripe_session_id`). Compute `totalPence` from the rows
  before mapping hidden amounts to `null`.
  **Done when:** `npm run typecheck` passes and the returned shape contains no
  email, fee, Stripe or hidden-amount data.

- [x] 3. **Page, states, and share link.** Add `app/fund/[slug]/page.tsx`.
  Following the Cache Components model (read
  `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` and the
  `connection`/`notFound`/`error.js` references first), the page shell renders
  synchronously and an async child inside `<Suspense>` awaits `params`, calls
  `await connection()` (request-time data, no caching, so new gifts appear on
  reload), then `getPublicFund`, then `notFound()` when `null`. "Today" is
  `todayIsoDate()` read after `connection()`. The child renders:
  - Heading `<Name>'s gift fund` and the note (if any), with a line saying
    gifts become prepaid TPS gift credit.
  - Total `£X given` via `formatPence`; when a goal exists, a native
    `<progress>` (value `min(total, goal)`, max `goal`) with a visible label
    `£X given of £Y goal` associated to it.
  - Open: "Open for gifts until <close date>" and a Contribute link to
    `/fund/<slug>/give`. Closed or expired: "This fund closed on <close
    date>" and no Contribute link. Show "Gift credit can be used until
    <expiry>" in both cases (`expiryDateFor`).
  - Messages list (`<ul>`), newest first: name, message with
    `whitespace-pre-line`, amount only when not `null`, and the date. Empty
    state: "No gifts yet." plus "Be the first to give." when open.
  - Share link: build the absolute URL on the server from `headers()`
    (`x-forwarded-proto` falling back to `http` for `localhost`/`127.0.0.1`
    hosts and `https` otherwise, plus `host`), passed to
    `app/fund/[slug]/share-link.tsx` (`"use client"`): a labelled read-only
    `<input>` with the URL and a "Copy link" button using
    `navigator.clipboard.writeText`; result announced in an `aria-live="polite"`
    region ("Link copied" or "Couldn't copy; select the link and copy it"),
    cleared on the next attempt.
  Dates display as `en-GB` long dates in UTC (same approach as
  `create-fund-form.tsx`). All user text (name, note, guest name, message)
  renders as React text children only: no `dangerouslySetInnerHTML`, no
  markdown, no auto-linking. Style with Tailwind matching `/fund/new`
  (zinc palette, card layout, dark mode). Static `metadata` title
  `"Gift fund"`.
  **Done when:** `npm run lint` and `npm run typecheck` pass, and with a
  `DATABASE_URL` in `.env.local` and a fund created at `/fund/new`, the page
  shows the name, £0.00 given, the empty state, the close date, the share URL
  and an enabled Contribute link; an unknown slug shows the 404 page.

- [x] 4. **Loading and error states.** Give the `<Suspense>` a simple fallback
  ("Loading fund...") and add `app/fund/[slug]/error.tsx` (`"use client"`)
  with a heading, "We couldn't load this fund right now." and a retry button
  using the error-boundary props documented for this Next.js version. No
  error details or stack shown to visitors; the server logs the error.
  **Done when:** `npm run verify` passes and the route builds as a partially
  prerendered/dynamic route without Cache Components validation errors.

## Files / areas

- `lib/fund-rules.ts` - add `todayIsoDate`.
- `app/fund/[slug]/data.ts` - new, `getPublicFund`.
- `app/fund/[slug]/page.tsx` - new, public page with Suspense child.
- `app/fund/[slug]/share-link.tsx` - new client component.
- `app/fund/[slug]/error.tsx` - new error boundary.
- Read-only reuse: `db/index.ts` (`getDb`), `db/schema.ts` (`funds`,
  `contributions`), `formatPence`, `expiryDateFor`, `fundStatus`.

## Data / contracts

- Read-only feature: no inserts, updates, schema or migration changes, and no
  outbox writes.
- Route: `GET /fund/<slug>`; the slug is matched exactly as stored. Unknown or
  over-long slug -> 404 via `notFound()`.
- Public total rule (overview): sum of paid guest gifts including hidden
  amounts; top-ups and pending contributions excluded. Money stays integer
  pence until `formatPence`.
- Privacy boundary (no sign-in, public URL): the page and its HTML never
  contain `mum_email`, `created_by_email`, guest emails, fees, Stripe session
  IDs, top-ups, or the amount of a guest who did not tick show-amount. The page
  does not link to `/fund/<slug>/me`.
- Status: `fundStatus(closeDate, today)`; `open` shows Contribute, `closed` and
  `expired` do not. Feature 6 still enforces closing on the server; hiding the
  button is presentation only.
- Contribute URL: `/fund/<slug>/give` (feature 6's route; do not change shape).

## Testing

- No test runner is configured; do not add one. Checks are `npm run lint`,
  `npm run typecheck`, and `npm run verify`.
- Manual check needs `DATABASE_URL`. To see messages, totals, hidden amounts and
  top-up exclusion before features 6-7 exist, insert rows in `npm run db:studio`
  (paid guest with show-amount, paid guest hidden, pending guest, paid top-up)
  and confirm: total counts both paid guests only; hidden amount absent from
  the page source; pending and top-up absent. Setting a fund's `close_date` in
  the past checks the closed state. Record only what was actually run.

## Notes for the AI

- Read the Next.js docs in `node_modules/next/dist/docs/` for `connection`,
  `notFound`, `error.js` props, and `PageProps<"/fund/[slug]">` before writing
  route code; this Next.js version differs from training data.
- Use the generated `PageProps<"/fund/[slug]">` type helper.
- Use gift-credit language only: "given", "gift", "TPS gift credit". Never
  "raised", "donate", "donation" or "fundraiser".
- Keep the data mapping that strips hidden amounts in `data.ts`, not in JSX.
- The `headers()` host is used only to show the visitor a link to the page they
  are on; it has no security role.

## Open questions

- Non-blocking: the fund `note` is not named in the public page contract, but
  no other planned screen shows it. The spec shows it under the heading; say so
  if it should stay private instead.
