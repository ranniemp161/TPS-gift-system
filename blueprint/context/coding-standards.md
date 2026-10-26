# Coding Standards

These describe the code as it is: a fresh create-next-app scaffold. Sections marked TODO cover the planned stack and get confirmed when that code lands.

## TypeScript

- `strict` is on. No `any` without a reason.
- Import with the `@/*` alias, which maps to the project root (there is no `src/`).

## Next.js

- Next.js 16 App Router, everything under `app/`. This version differs from older Next.js: read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.
- `cacheComponents` and `partialPrefetching` are on in `next.config.ts`. Follow the Cache Components model for dynamic data instead of older caching APIs.
- Server Components by default; add `"use client"` only where interaction needs it.
- Use the generated route type helpers (the root layout uses `LayoutProps<"/">`).

## Styling

- Tailwind CSS v4 utility classes inline in JSX. Theme tokens live in `app/globals.css` (`@theme inline`), with light and dark values on `:root`.
- Fonts come from `next/font` (Geist and Geist Mono) via CSS variables.
- Match the prototype's screens and copy.

## Money and payments

> TODO (confirm): planned conventions from the spec, to be checked when payments are built.

- Calculate the card fee only on the server: `fee = round((amount + 0.20) / 0.985 - amount, 2)`. Never trust an amount or total from the browser.
- Enforce the £10 minimum on the server.
- A contribution becomes paid, and credit is added, only from the Stripe `checkout.session.completed` webhook. The thank-you page never adds credit.
- The balance is always derived from the credit ledger (credits - debits), never stored as a separate number.
- Product wording on Stripe and in emails is "TPS gift credit", never "donation" or "fundraiser".

## Data

> TODO (confirm): Neon Postgres + Drizzle (matching TPS-CRM) is planned but not installed yet. Record the real client, query, and migration conventions here when the database foundation lands.

- Store money as integer pence; format as pounds only for display.

## Linting

- ESLint 9 flat config with `eslint-config-next` (core web vitals + TypeScript). Run `npm run lint` before finishing a change.

## Testing

No test runner is configured and there are no tests. Testing is opt-in: run `/tests` to set up a runner and add a `Test` command to `AGENTS.md`. Until then there is no testing gate, and checks are lint, build, and manual verification against the prototype.

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
