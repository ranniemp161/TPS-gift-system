# Feature: Database foundation

**From build-plan:** feature 2
**Build attempt:** 1
**Branch:** feature/database-foundation
**Status:** verified

## Goal

Give the demo a Postgres database with the five tables every later feature uses (funds, contributions, credit_ledger, credit_requests, outbox), managed by Drizzle migrations on Neon, matching TPS-CRM's setup so the code carries over.

## In scope

- Install Drizzle and the Neon driver, matching TPS-CRM's packages
- `drizzle.config.ts` and `db:*` package scripts
- `db/schema.ts` with the five tables, enums, keys, uniqueness and positive-amount checks
- The first generated migration, committed under `drizzle/`
- `.env.example` documenting `DATABASE_URL`, and a `.gitignore` exception so it can be committed
- Applying the migration to the user's Neon database
- Commands section of `AGENTS.md` updated with the new `db:*` commands

## Out of scope

- The runtime database client (`db/index.ts`) - added by feature 4, the first code that queries
- Fee, minimum, date and balance rules (feature 3)
- Any page, route, server action or webhook
- Seed data, migration drift checks, `db:check`
- Vercel environment setup (feature 13)

## Build loop

Config: `workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`. Build all steps in order, keep each one working, then present one review packet at the end. No step commits; `/complete` creates the feature commit.

## Build steps

- [x] 1. **Packages and config.** Install `drizzle-orm` and `@neondatabase/serverless` as dependencies and `drizzle-kit` as a dev dependency (TPS-CRM versions: `^0.45.3`, `^1.2.0`, `^0.31.11`). Add `drizzle.config.ts` at the root: dialect `postgresql`, schema `./db/schema.ts`, out `./drizzle`, `DATABASE_URL` from the environment, loading `.env.local` with `process.loadEnvFile` when it exists (drizzle-kit runs outside Next.js), `strict` and `verbose` on. Add scripts `db:generate` (`drizzle-kit generate`), `db:migrate` (`drizzle-kit migrate`), `db:studio` (`drizzle-kit studio`). Add `.env.example` with `DATABASE_URL=` and a `!.env.example` line after `.env*` in `.gitignore`.
  - Done when: `npm install` succeeds, `git status` shows `.env.example` as untracked (not ignored) and `.env.local` stays ignored, and `npm run verify` passes.
- [x] 2. **Schema.** Write `db/schema.ts` exactly as in Data / contracts.
  - Done when: `npm run typecheck` passes and `npm run db:generate` writes one migration under `drizzle/` whose SQL creates the four enums, five tables, foreign keys, unique constraints and check constraints listed below. Read the SQL to confirm.
- [x] 3. **Apply to Neon.** Prerequisite from the user: a Neon Postgres database (neon.tech, or Neon through the personal Vercel account's Storage tab) and its connection string in `.env.local` as `DATABASE_URL`. Run `npm run db:migrate`.
  - Done when: the migration applies without error and `npm run db:studio` shows the five empty tables with the listed columns. If no database is available yet, stop at this step and report it; steps 1-2 stay valid.
- [x] 4. **Document commands.** Add the `db:*` commands and the `DATABASE_URL` / `.env.local` note to the Commands section of `AGENTS.md`.
  - Done when: the Commands section lists generate, migrate and studio, and `npm run verify` passes.

## Files / areas

- `package.json`, `package-lock.json` - dependencies and `db:*` scripts
- `drizzle.config.ts` - new
- `db/schema.ts` - new (root `db/`, since the app has no `src/`; imported as `@/db/schema`)
- `drizzle/` - new, generated migration and metadata, committed
- `.env.example` - new; `.gitignore` - one exception line
- `AGENTS.md` - Commands section

## Data / contracts

Conventions, matching TPS-CRM: `uuid("id").primaryKey().defaultRandom()`; `created_at timestamptz not null default now()`; snake_case column names with camelCase TypeScript keys; Postgres enums via `pgEnum`. Money is always integer pence. No `updated_at` (the plans don't use one).

Enums:

- `contribution_type`: `guest`, `topup`
- `contribution_status`: `pending`, `paid`
- `ledger_entry`: `credit`, `debit`
- `credit_request_status`: `new`, `done`

### funds

| Column | Type | Rules |
| --- | --- | --- |
| id | uuid | pk, default random |
| slug | text | not null, **unique** |
| mum_first_name | text | not null |
| mum_email | text | not null |
| created_by_email | text | not null |
| due_date | date | not null |
| close_date | date | not null (due_date + 28 days, computed by feature 3/4 and stored) |
| goal_pence | integer | nullable; check `> 0` when present |
| note | text | nullable |
| created_at | timestamptz | not null, default now() |

### contributions

| Column | Type | Rules |
| --- | --- | --- |
| id | uuid | pk |
| fund_id | uuid | not null, fk -> funds.id, indexed |
| type | contribution_type | not null |
| name | text | not null |
| email | text | not null |
| message | text | nullable |
| amount_pence | integer | not null, check `> 0` |
| fee_pence | integer | not null, check `>= 0` |
| show_amount | boolean | not null, default false |
| stripe_session_id | text | nullable, **unique** (webhook lookup key) |
| status | contribution_status | not null, default `pending` |
| created_at | timestamptz | not null, default now() |

### credit_ledger

| Column | Type | Rules |
| --- | --- | --- |
| id | uuid | pk |
| fund_id | uuid | not null, fk -> funds.id, indexed |
| entry | ledger_entry | not null |
| amount_pence | integer | not null, check `> 0` (direction comes from `entry`) |
| reason | text | not null |
| booking_reference | text | nullable |
| recorded_by | text | nullable |
| created_at | timestamptz | not null, default now() |

### credit_requests

| Column | Type | Rules |
| --- | --- | --- |
| id | uuid | pk |
| fund_id | uuid | not null, fk -> funds.id, indexed |
| service | text | not null |
| amount_requested_pence | integer | not null, check `> 0` |
| status | credit_request_status | not null, default `new` |
| created_at | timestamptz | not null, default now() |

### outbox

| Column | Type | Rules |
| --- | --- | --- |
| id | uuid | pk |
| to | text | not null |
| subject | text | not null |
| body | text | not null |
| created_at | timestamptz | not null, default now() |

Foreign keys use the default `no action` on delete: the demo never deletes funds, and a fund with ledger entries must not silently lose them.

The £10 minimum is a business rule enforced in feature 3, not a database check, so the rule lives in one readable place.

## Testing

No test runner is configured, so there is no unit-test gate. Evidence for this feature:

- `npm run verify` (typecheck + build) passes; the build must not need `DATABASE_URL`
- the generated migration SQL is read and matches the tables above
- `npm run db:migrate` against Neon and a `db:studio` look, only if the user has supplied `DATABASE_URL`; otherwise report it as not run

## Notes for the AI

- The user is learning how the gift system works. In the review packet, explain in plain words why money is pence, why balance is a ledger and not a stored number, and why `stripe_session_id` is unique.
- Never commit `.env.local` or print the connection string.
- Do not hand-edit generated migration files; change `db/schema.ts` and regenerate.
- `tsconfig.json` includes `**/*.ts`, so `drizzle.config.ts` is type-checked by Verify.
- The working tree on `main` has uncommitted plan changes from `/adopt` and `/overview`; they should be committed on `main` before the feature branch is created, so they don't land in this feature's commit.
