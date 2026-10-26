# Project Plan

**What this repo is:** a working demo of the TPS Gift Fund, built to learn and show how the system works end to end before it is integrated into TPS-CRM. It is not the production build: no sign-in, Stripe test mode only, emails shown on screen instead of sent, deployed to a personal Vercel account.

Source: "TPS Gift Fund: Build Spec & Go-Live Plan" (Mike, 25 Oct 2026). The product rules below come from that spec. The spec's clickable prototype `tps-gift-fund-prototype.html` is the reference for screens and copy.

> TODO (confirm): the prototype is not in this repo. Add it to `blueprint/reference/` if screens should match it.

## 1. Problem - What problem are we solving?

The Postpartum Suite (TPS) wants a client's friends and family to be able to give TPS care as a gift. A mum (or a friend using the mum's email) creates a fund page, guests give any amount with a message, and everything becomes prepaid TPS credit the mum can spend on any TPS service. It is gift credit, never cash, and never described as a fundraiser or donation.

This demo exists to make the mechanics visible: how a gift becomes credit, how the card fee is calculated, how Stripe confirms payment, how the balance is derived, and how closing and expiry work. What is learned here gets built into TPS-CRM later.

## 2. Users - Who is this for?

Demo audience: the builder and colleagues (TJ) learning how the system works.

Roles the demo simulates, all without sign-in:

- **Mum**: owns the fund. Sees the balance, expiry, every message and amount; tops up; requests to use credit.
- **Organiser**: a friend who creates the fund using the mum's email.
- **Guests**: give by card with a message.
- **TPS admin**: sees all funds and records credit used.

## 3. Features - What does the MVP need?

Built: the app scaffold only.

Demo MVP:

- Create a fund: name, mum's email, due date, optional goal, note
- Public fund page: total, goal bar, guest messages, close date, share link
- Guest checkout with fee, message and show-amount choice, paid in Stripe test mode
- Stripe webhook that turns a paid checkout into credit
- Mum page (open link, no sign-in): balance, expiry, every message and amount
- Mum top-ups with fee
- "Use my credit" request: pick a service and amount; appears for TPS to action
- Admin screen (no sign-in): all funds, balances, contributions, open requests, record credit used
- Demo outbox: every email the system would send, shown on one page
- "Pretend today is" control to see closing and expiry happen

Later, in TPS-CRM (not in this demo): real sign-in, real emails and DNS, live Stripe, SimplyBook booking link, Zoho/Stripe instalment adjustment, closing and expiry reminders, organiser view, message keepsake.

### Product rules (from the spec)

| Rule | Decision |
| --- | --- |
| What the money is | Prepaid TPS credit for the mum, never cash. Described as gift credit, not a fundraiser. |
| Where it can be spent | Any TPS service: single treatments or a 7, 14 or 30-day programme |
| Minimum gift or top-up | £10 |
| Card fee | Paid on top by the guest (or the mum, for top-ups), shown before paying. `fee = (amount + 0.20) / 0.985 - amount`, rounded **up** to the penny, so TPS always receives the full amount after Stripe's 1.5% + 20p. A £50 gift costs £50.97. |
| Guest amounts | Each guest chooses whether their amount shows publicly. The mum always sees every amount. |
| Mum top-ups | Any amount from £10, any time. Private: never shown on the guest page. |
| Closing | 4 weeks (28 days) after the due date. No gifts or top-ups after that. |
| Expiry | All credit expires 12 months after the close date. Due 20 Feb 2027, closes 20 Mar 2027, valid until 20 Mar 2028. |
| Credit stays put | Nothing is applied automatically. The mum chooses when to use it. |
| Using credit: treatments | Comes off the listed price; any shortfall is paid by card. |
| Using credit: programmes | No prices shown ("Price agreed at consultation"). The mum chooses how much to apply. |
| Leftover credit | Stays in the fund with the same expiry date. |
| Refunds | Not offered. |

### Demo decisions

| Question | Decision |
| --- | --- |
| Public total | Sum of paid guest gifts, including hidden amounts. Top-ups excluded. |
| Fund goes live | Immediately on creation (no sign-in to confirm). |
| Credit request limit | At most the balance minus requests still open. |
| Expired credit | Balance counts as £0 after the expiry date. |
| Closing and expiry | Computed from the current date (or the demo date) on each page load; no scheduled job. |
| Paid status | Only the Stripe webhook marks a contribution paid and adds credit; repeated webhook calls are ignored. |

> TODO (confirm): the list of services and prices for "Use my credit". Until then the demo uses a short placeholder list.

## 4. Data - What are we storing?

- **funds**: id, slug, mum_first_name, mum_email, created_by_email, due_date, close_date (due_date + 28 days), goal (optional), note, created_at
- **contributions**: id, fund_id, type (`guest` or `topup`), name, email, message, amount, fee, show_amount, stripe_session_id, status (`pending`, `paid`), created_at
- **credit_ledger**: id, fund_id, entry (`credit` or `debit`), amount, reason, booking_reference, recorded_by, created_at. Balance = credits - debits. Expiry = close_date + 12 months.
- **credit_requests**: id, fund_id, service, amount_requested, status (`new`, `done`), created_at
- **outbox**: id, to, subject, body, created_at (demo stand-in for sent emails)

Slug: first name + due year-month (`sarah-202702`), with a short random suffix if taken.

Money is stored in pence (integers) to avoid rounding errors.

## 5. Tech - What stack are we using?

In the repo today: Next.js 16.4 (App Router, Cache Components on), React 19.3, TypeScript (strict), Tailwind CSS v4, ESLint 9, npm.

Planned:

- **Database**: Neon Postgres with Drizzle, the same as TPS-CRM so the code carries over
- **Payments**: Stripe Checkout in test mode, two line items (`Gift to <name>'s fund` and `Card processing fee`), contribution id in the session metadata, `checkout.session.completed` webhook
- **Email**: none; an outbox table and page instead
- **Hosting**: personal Vercel account

## 6. Monetize - How will this make money?

Not applicable to the demo. In production, gifts are prepaid credit for TPS services (money owed in future services, not income), and the card fee is passed on to the payer.

## 7. UI/UX - How should this look and feel?

Simple and clear enough to demo the flow. Gift-credit language, never "donation" or "fundraiser". Fees shown before paying. The expiry date appears wherever credit does. Programmes show "Price agreed at consultation".

A small demo bar makes the hidden mechanics visible: links to the mum page, admin screen and outbox, and the "pretend today is" date.

## 8. Deployment - Where and how will this ship?

Personal Vercel account, temporary. Stripe test mode only, with the webhook endpoint pointed at the Vercel deployment (and the Stripe CLI for local development).

Demo walkthrough (the spec's launch test, adapted): create a fund, give 2 guest gifts (one amount hidden), open the mum page, top up £10, request credit for a treatment and for a programme, record credit used in admin, check the outbox and every balance, then move the demo date past the close and expiry dates.

## 9. Usage model and constraints

- Demo only: a handful of test funds, no real people's data, no live payments.
- No sign-in by design. Anyone with a link can open the mum page and the admin screen, so the demo must never hold real data or live Stripe keys.
- Payment rules still hold even in the demo, because they are the point of it: server-side fee, webhook-only credit, no double counting.
