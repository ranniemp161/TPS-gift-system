# Feature: Role guidance

**From build-plan:** feature 13
**Build attempt:** 1
**Branch:** feature/role-guidance
**Status:** verified

## Goal

Make it obvious, on every page of the demo, who that page is for: the organiser
(or the mum) creating a fund, guests giving, the mum managing her credit, or the
TPS team. Also explain on the create-fund page who usually sets up a fund, and
that in this demo anyone with the link can do it.

## In scope

- **Audience line in the demo bar.** Next to the existing page-role badge, show
  one short "For ..." line saying who the page is for. The demo bar is rendered
  by the root layout on every route, so one change covers every page.

  | Route | Badge (unchanged) | Audience line (new) |
  | --- | --- | --- |
  | `/` | Home | For anyone trying the demo |
  | `/fund/new` | Create a fund | For the organiser (a friend or family member) or the mum herself |
  | `/fund/<slug>` | Public page | For guests: family and friends who want to give |
  | `/fund/<slug>/give` | Public page | For guests: giving to the fund |
  | `/fund/<slug>/thanks` | Public page | For guests, after paying |
  | `/fund/<slug>/me` | Mum page (private) | For the mum only: her balance, top-ups and credit requests |
  | `/admin/login` | Admin sign-in | For the TPS team |
  | `/admin/*` | Admin (TPS team) | For the TPS team: all funds and credit used |
  | `/outbox` | Outbox (demo emails) | Demo only: every email the system would send |

  Any other route shows no badge and no audience line, as today.

- **Create-fund guidance.** Under the existing intro on `/fund/new`, add one
  paragraph: "Usually set up by a friend or family member (the organiser) on the
  mum's behalf, using her email. The mum can also set up her own fund. This demo
  has no sign-in, so anyone with the link can create a fund."

## Out of scope

- Any sign-in, access control, or change to who can open a page.
- Changes to forms, field labels, validation, money rules, dates, or stored data.
- Per-page header copy beyond the create-fund paragraph.
- Gating `/outbox` or the demo date (separate demo-hardening work).

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`: build both steps, run Verify once at the end, then present one
review packet. `/complete` makes the single feature commit.

## Build steps

- [x] 1. **Demo bar audience line.** In `app/demo-bar-controls.tsx`, replace
  `pageRoleLabel(pathname)` with a function that returns both the existing
  badge label and the audience text from the table above (or `null` for
  unknown routes). Render the audience text as plain text right after the
  badge inside `DemoBarLinksForRoute`, so it wraps with the bar on small
  screens. Keep every badge label exactly as it is. **Done when** each route in
  the table shows its badge and audience line, unknown routes show neither, and
  `npm run typecheck` passes.
- [x] 2. **Create-fund guidance.** In `app/fund/new/page.tsx`, add the
  guidance paragraph inside the existing `<header>`, below the current intro
  paragraph and in the same muted text style. **Done when** `/fund/new` shows
  the paragraph under the intro, the form is unchanged, and `npm run verify`
  passes.

## Files / areas

- `app/demo-bar-controls.tsx`: `pageRoleLabel` (line 33) and
  `DemoBarLinksForRoute` (line 46). This is a client component (it uses
  `usePathname`), which stays as it is.
- `app/fund/new/page.tsx`: the page header (server component).
- No changes to `app/demo-bar.tsx`, the layout, or any other page. The graphify
  graph confirms `DemoBar()` → `DemoBarLinksForRoute()` → `pageRoleLabel()` is
  the single path that labels every route.

## Data / contracts

None. The text is static, and no database, API, or stored data changes.

## Testing

No test runner is configured, so there are no unit tests. Checks:

- `npm run typecheck` after step 1, and `npm run verify` (typecheck and build)
  at the end.
- Manual: open `/`, `/fund/new`, a fund's public, give, thanks and mum pages,
  `/admin/login`, `/admin/funds` and `/outbox`, and confirm each shows the badge
  and audience line from the table. Confirm `/fund/new` shows the guidance
  paragraph.

## Notes for the AI

- Placement decision: the audience line goes in the demo bar, not in each
  page's own header. The demo bar already carries the page-role badge on every
  route (added by the admin-login fix), so this is one change in one place and
  stays visibly separate from the product copy that will carry over to TPS-CRM.
  Only the create-fund page gets in-page copy, because the build-plan item asks
  for it there.
- Use gift-credit language only. Never "donation" or "fundraiser".
- The audience text is static and contains no user input, so normal JSX text
  rendering is safe.
- `DemoBarFallback` (shown while the bar loads) has no badge today and stays
  that way.


<!-- blueprint:completion {"schemaVersion":2,"specBytes":4889,"specSha256":"01615c4ea2ecb27eb7fb8dd3e1323eb0a10fb115bcc89846f3c1060341bb9cea","branch":"refs/heads/feature/role-guidance","head":"afe7895091375c6bc2d7df66b8f7ed8cea8d61f9","baseRef":"refs/heads/main","baseCommit":"afe7895091375c6bc2d7df66b8f7ed8cea8d61f9","sourceTree":"9c1fcc49e9e110f996cb8eecbff93f05d7a9e43f","landing":"local-merge","absentOptional":[]} -->

## Completion notes

- Independent review: not selected (regular gate `when-sensitive`; static copy, no sensitive category).
- Verify: `npm run verify` (typecheck, then build) and `npm run lint` passed on 2026-10-28.
- Check: `/check` verified all nine routes in a live browser tab (badge and audience line each match the spec table; unknown route shows neither), the create-fund guidance paragraph, a clean console, and wrapping at narrow width. Evidence screenshot: browser-screenshot-localhost-mvrxq7d2-e5863d41.png.
- Overview: only the `blueprint:source-hash` marker was refreshed; the overview body does not yet list feature 13.
- Open findings left in the ledger: F-01 (P3, open) and F-03 (P2, fixed; awaits a later `/audit` to close).
