# Feature: Create a fund

**From build-plan:** feature 4
**Build attempt:** 1
**Branch:** feature/create-a-fund
**Status:** verified

## Goal

A mum, or an organiser using the mum's email, opens `/fund/new`, fills in the
mum's first name, the mum's email, the due date, an optional goal and an
optional note, and gets a live fund with a slug. The server stores the fund
with its close date and writes a "fund created" email to the outbox in the same
atomic write. This is the first feature that talks to the database, so it also
adds the shared Drizzle client.

## In scope

- `db/index.ts`: a lazily created Drizzle client on the Neon HTTP driver
  (`@neondatabase/serverless` + `drizzle-orm/neon-http`, both installed),
  reading `DATABASE_URL` only when first used so `npm run build` and Verify
  still pass without it.
- `/fund/new` page with an accessible form and a Server Action that validates
  every field on the server, builds the slug, inserts the fund and the outbox
  row atomically, and returns a result state.
- Slug rule from the overview: mum's first name + due year-month
  (`sarah-202702`), with a random suffix when taken.
- `close_date` computed with `closeDateFor` from `@/lib/fund-rules` and stored;
  expiry shown, never stored.
- A pounds-to-pence parser for the goal, added to `@/lib/fund-rules` so money
  input parsing lives with the other money rules (feature 6 will reuse it for
  gift amounts).
- Success state on `/fund/new`: confirmation with the fund's public link
  `/fund/<slug>`, mum page link `/fund/<slug>/me`, close date and credit expiry.

## Out of scope

- The public fund page (feature 5) and mum page (feature 8). The success state
  shows their paths as text links; they 404 until those features land.
- The outbox page and demo clock (feature 12). The email is only written to the
  `outbox` table, visible in `npm run db:studio`.
- Replacing the scaffold home page, the root layout metadata, or a demo bar.
- Editing or deleting funds, sign-in, or any ownership check (no sign-in by
  design).
- Adding a test runner or a validation library (`zod` in `node_modules` is a
  transitive dependency only; do not import it).

## Build loop

`workflow.stepReview` is `feature`: implement all steps, then present one
review packet for the whole feature. `workflow.checkpointCommits` is
`disabled`: no checkpoint commits between steps. `/complete` creates the final
commit and, with `git.landing: "pull-request"`, offers the push and PR.

## Build steps

- [x] 1. **Database client.** Add `db/index.ts` exporting `getDb()`, which
  creates the client on first call with
  `drizzle(neon(process.env.DATABASE_URL))` and `{ schema }` from
  `@/db/schema`, caching it at module scope. Throw a clear error naming
  `DATABASE_URL` when it is missing. Nothing runs at import time.
  **Done when:** `npm run verify` passes with no `DATABASE_URL` in the build
  environment, and `npm run lint` is clean.

- [x] 2. **Input rules.** In `lib/fund-rules.ts` add
  `parsePoundsToPence(input: string): number | null` (accepts `^\d+(\.\d{1,2})?$`
  after trimming, optional leading `£`; returns integer pence via string
  splitting, not float multiply; null for anything else or a non-safe integer)
  and `formatPence(pence: number): string` (`£1,234.50` style, `en-GB`). Add a
  `slugBase(firstName, dueDate)` helper in the fund-creation module (step 3),
  not in fund-rules: lowercase, each run of non `a-z0-9` characters becomes one
  hyphen, trim edge hyphens, fall back to `fund` when empty, then
  `-<YYYYMM>` from the due date.
  **Done when:** typecheck passes and the step-4 manual check shows
  `250` -> 25000, `250.5` -> 25050, `£12.34` -> 1234, and `12.345`, `-5`,
  `1e3`, `abc` are rejected; `Sarah` + `2027-02-14` -> `sarah-202702`,
  `Anne-Marie O'Neil` -> `anne-marie-o-neil-202702`.

- [x] 3. **Server Action.** Add `app/fund/new/actions.ts` (`"use server"`)
  exporting `createFund(prevState, formData)` for `useActionState`. Read every
  field as an untrusted string and validate on the server (see Data /
  contracts). On invalid input return `{ status: "invalid", errors, values }`
  without touching the database. On valid input compute `close_date` with
  `closeDateFor`, then insert the fund and the outbox row with one
  `getDb().batch([...])` call (Neon HTTP batch runs as one transaction, so a
  failure leaves neither row). First attempt uses the bare `slugBase`; on a
  unique violation of `funds.slug` (Postgres `23505`; confirm whether the
  installed drizzle wraps it as `DrizzleQueryError` with the Neon error on
  `cause`, and match on both the code and the slug constraint) retry with
  `slugBase-<4 random base36 chars>` from `node:crypto`, up to 5 attempts in
  total. Any other failure, or running out of attempts, logs the error
  server-side and returns `{ status: "error", message, values }` with a
  generic message. Success returns
  `{ status: "created", slug, mumFirstName, closeDate, expiryDate }`.
  **Done when:** typecheck and lint pass, and the action contains no path that
  writes the fund without the outbox row.

- [x] 4. **Form page.** Add `app/fund/new/page.tsx` (Server Component, static
  shell, page heading "Create a gift fund" and one line of gift-credit copy)
  rendering a Client Component `app/fund/new/create-fund-form.tsx` that uses
  `useActionState(createFund, initial)`. Fields: Mum's first name, Mum's email,
  Your email (optional, "leave blank if you are the mum"), Due date
  (`type="date"`), Goal in pounds (optional), Note (optional textarea). Each
  input has a visible `<label htmlFor>`, native `required` / `type="email"`
  hints where they apply, `aria-invalid` and `aria-describedby` pointing at its
  server error text. On `invalid` or `error`, show an error summary with
  `role="alert"`, move focus to it, and refill fields from the returned
  `values` (set `key` on the form per submission so `defaultValue` applies
  after React's form reset). Errors clear on the next successful submit. The
  submit button shows "Creating..." and is disabled while `pending`. On
  `created`, replace the form with a confirmation (heading receives focus):
  "Sarah's gift fund is live", the public link and mum page link, close date
  and credit expiry formatted for `en-GB`, and a "Create another fund" link
  back to `/fund/new`.
  **Done when:** with `.env.local` pointing at the migrated Neon database and
  `npm run dev`, a manual pass confirms: submitting empty shows per-field
  errors announced and focused; a bad email, an unreal date and a goal of
  `12.345` or `0` are rejected with the entered values kept; a valid
  submission shows the confirmation; `db:studio` shows one `funds` row with
  `close_date = due_date + 28 days`, `created_by_email` set to the organiser
  email or the mum's email when blank, `goal_pence` in pence or null, and one
  matching `outbox` row; creating a second fund with the same first name and
  due month produces a suffixed slug. Then `npm run verify` and
  `npm run lint` pass, and the build output lists `/fund/new`.

## Files / areas

- `db/index.ts` (new) - lazy Drizzle client.
- `lib/fund-rules.ts` - add `parsePoundsToPence`, `formatPence`.
- `app/fund/new/page.tsx` (new) - route, Server Component.
- `app/fund/new/create-fund-form.tsx` (new) - Client Component form.
- `app/fund/new/actions.ts` (new) - Server Action, validation, slug, atomic
  insert, outbox email.
- No schema change and no migration: `funds` and `outbox` already exist in
  `db/schema.ts` and `drizzle/0000_wide_martin_li.sql`.

## Data / contracts

**Form fields and server validation** (all values trimmed; the server is the
authority, browser hints are convenience only):

| Field (`name`) | Rule | Stored as |
| --- | --- | --- |
| `mumFirstName` | required, 1-50 chars | `funds.mum_first_name` |
| `mumEmail` | required, max 254, one `@` with non-empty local part and a dotted domain, no whitespace | `funds.mum_email` (trimmed, case kept) |
| `organiserEmail` | optional, same email rule when present | `funds.created_by_email`; blank -> `mumEmail` |
| `dueDate` | required, real calendar date `YYYY-MM-DD` (reuse the `closeDateFor` validation by catching its `RangeError`) | `funds.due_date` |
| `goal` | optional; `parsePoundsToPence`; must be > 0 | `funds.goal_pence` or null |
| `note` | optional, max 1000 chars; blank -> null | `funds.note` |

Any past or future due date is accepted (no range rule is defined; a past
date simply produces a fund that later pages show as closed or expired).

**Stored values:** `slug` as described in step 2/3; `close_date =
closeDateFor(dueDate)`; `id` and `created_at` from database defaults. The fund
is live immediately; there is no status column.

**Outbox row (same batch):** `to` = mum's email; `subject` =
`Your TPS gift fund is live`; plain-text `body` naming the mum, the public
link path `/fund/<slug>`, the mum page path `/fund/<slug>/me`, the close date
and credit expiry, the goal if set (via `formatPence`), and the wording "TPS
gift credit" (never donation or fundraiser). Paths are relative because there
is no base URL setting yet; feature 13 can make them absolute.

**Action result shape:**

```ts
type CreateFundState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<FieldName, string>>; values: Record<FieldName, string> }
  | { status: "error"; message: string; values: Record<FieldName, string> }
  | { status: "created"; slug: string; mumFirstName: string; closeDate: string; expiryDate: string };
```

**Trust boundaries:** `/fund/new` is public and unauthenticated by design
(demo, no sign-in). All input is untrusted: length-capped, validated on the
server, inserted through Drizzle parameters, and rendered only as React text
(never `dangerouslySetInnerHTML`). Database errors are logged on the server
and never returned to the browser. `DATABASE_URL` stays server-only (no
`NEXT_PUBLIC_` prefix).

## Testing

No test command is configured, so there are no automated tests in this
feature. Evidence is `npm run verify`, `npm run lint`, and the manual pass in
step 4 against the dev server and the Neon database from `.env.local` (present
in this checkout; contents not inspected). Verify on `main` before this
feature passed (typecheck and build, routes `/` and `/_not-found`).

## Notes for the AI

- Read `node_modules/next/dist/docs/01-app/02-guides/forms.md` and
  `server-actions.md` before writing the action; this Next.js version differs
  from training data. `cacheComponents` is on: keep `/fund/new` a static shell
  and do no data fetching on it.
- Do not read `DATABASE_URL` or call `neon()` at module top level; the build
  collects page data and must not need the database.
- Reuse `closeDateFor`, `expiryDateFor` and `MIN_AMOUNT_PENCE` style from
  `@/lib/fund-rules`; do not reimplement date math. The £10 minimum applies to
  gifts and top-ups, not to the goal.
- Use `crypto.randomBytes` or `randomInt` from `node:crypto` for the slug
  suffix, not `Math.random`.
- Match the existing Tailwind tokens in `app/globals.css`; keep styling plain.
- No em dashes in code, comments or copy.

## Open questions

Non-blocking; the spec records the simplest choice for each:

- After creation the page shows a confirmation instead of redirecting to
  `/fund/<slug>`, because that page does not exist until feature 5. Feature 5
  may switch this to a redirect.
- The "fund created" email goes only to the mum's email, not also to a
  different organiser email.
- Field length caps (50 / 254 / 1000) are demo safety bounds, not product
  rules.
