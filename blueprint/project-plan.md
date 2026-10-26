# Project Plan

Source: "TPS Gift Fund: Build Spec & Go-Live Plan" (Mike, 25 Oct 2026). The agreed design is the clickable prototype `tps-gift-fund-prototype.html`, the reference for every screen, word and rule.

> TODO (confirm): the prototype is not in this repo. Add it to `blueprint/reference/` so features can be checked against it.

## 1. Problem - What problem are we solving?

The Postpartum Suite (TPS) wants a client's friends and family to be able to give TPS care as a gift. A mum (or a friend using the mum's email) creates a fund page, guests give any amount with a message, and everything becomes prepaid TPS credit the mum can spend on any TPS service.

It is gift credit, never cash, and never described as a fundraiser or donation.

Go-live is **Friday 6 November 2026**, so the first client can share the fund before a November baby shower.

## 2. Users - Who is this for?

- **Mum**: owns the fund. Signs in by a one-time email link (no passwords). Sees the balance, expiry, every message and amount; tops up; requests to use credit.
- **Organiser**: a friend who creates the fund using the mum's email. Version 1 has no separate organiser view.
- **Guests**: give by card with a message. No account.
- **TPS admins** (admin@, info@, plus named founders): see all funds and record credit used against bookings.

| Who | Owns |
| --- | --- |
| TJ | The build: pages, database, Stripe, emails, scheduled jobs, admin screen |
| Mike | Stripe confirmation, terms and privacy, accountant, DNS approval, testing sign-off |
| Ami | Telling clients about the fund; first point of contact for mums |
| Mike or Ami | Applying credit when a mum books (manual in version 1) |

## 3. Features - What does the MVP need?

Built: nothing yet. The repo is a fresh create-next-app scaffold.

Version 1 (6 Nov):
- Create a fund: name, mum's email, due date, photo, optional goal, note
- Public fund page: progress bar, messages, share link
- Guest checkout with fee, message and show-amount choice
- Mum sign-in by email link: balance, messages, top-ups
- Mum top-ups with fee
- "Use my credit" request: mum picks a service and amount; TPS gets an email to action it
- Admin screen: all funds, balances, contributions, a button to record credit used
- Emails: fund created + sign-in link, guest receipt, "you've received a gift", top-up receipt, credit-use request to TPS, credit-used confirmation
- Automatic close 4 weeks after the due date; expiry date shown everywhere

In version 1, "Use my credit" books nothing. It emails TPS; Mike or Ami books the treatment in SimplyBook as paid or reduces the programme instalment, then records the credit used in the admin screen.

After launch (by mid-December):
- Automatic link between credit and SimplyBook bookings
- Automatic adjustment of programme instalments in Zoho/Stripe
- Fund-closing reminder (1 week before) and expiry reminder (30 days before)
- Organiser view separate from the mum's
- Downloadable message keepsake for the mum

### Product rules (decided)

| Rule | Decision |
| --- | --- |
| What the money is | Prepaid TPS credit for the mum, never cash. Described as gift credit, not a fundraiser. |
| Where it can be spent | Any TPS service: single treatments or a 7, 14 or 30-day programme |
| Minimum gift or top-up | £10 |
| Card fee | Paid on top by the guest (or the mum, for top-ups), shown before paying. `fee = round((amount + 0.20) / 0.985 - amount, 2)`. A £50 gift costs £50.97. |
| Guest amounts | Each guest chooses whether their amount shows publicly. The mum always sees every amount. |
| Mum top-ups | Any amount, any time, as often as wanted. Private: never shown on the guest page. |
| Closing | Automatic, 4 weeks (28 days) after the due date. No gifts or top-ups after that. |
| Expiry | All credit expires 12 months after the close date. Due 20 Feb 2027, closes 20 Mar 2027, valid until 20 Mar 2028. |
| Credit stays put | Nothing is applied automatically, even with a programme booked. The mum chooses when to use it. |
| Using credit: treatments | Comes off the listed price; any shortfall is paid by card. |
| Using credit: programmes | No prices shown ("Price agreed at consultation"). The mum chooses how much to apply; it comes off the next instalment and TPS sends an updated payment schedule. |
| Leftover credit | Stays in the fund with the same expiry date. |
| Refunds | Not offered in version 1, except where the law requires. |

## 4. Data - What are we storing?

- **funds**: id, slug, mum_first_name, mum_email, created_by_email, due_date, close_date (due_date + 28 days), goal (optional), note, photo_url, created_at
- **contributions**: id, fund_id, type (`guest` or `topup`), name, email, message, amount, fee, show_amount, stripe_payment_intent_id, status, created_at
- **credit_ledger**: id, fund_id, entry (`credit` or `debit`), amount, reason, booking_reference, recorded_by, created_at. Balance = credits - debits. Expiry = close_date + 12 months.
- **credit_requests**: id, fund_id, service, amount_requested, status (`new`, `done`), created_at

Slug: first name + due year-month (`sarah-202702`), with a short random suffix if taken.

Personal data held: guest names, emails and messages, and fund photos (covered by the privacy policy update on Mike's checklist).

## 5. Tech - What stack are we using?

In the repo today: Next.js 16.4 (App Router, Cache Components on), React 19.3, TypeScript (strict), Tailwind CSS v4, ESLint 9, npm.

Planned (suggestions from the spec, swappable):
- **Database, sign-in, photo storage**: Supabase (Postgres, email-link sign-in, storage)
- **Payments**: Stripe Checkout on TPS's existing account (card, Apple Pay, Google Pay), two line items: `Gift to <name>'s fund` and `Card processing fee`. Paid status and credit come only from the `checkout.session.completed` webhook.
- **Email**: Resend or Postmark, sent from a TPS address such as `gifts@thepostpartumsuite.com`. SPF/DKIM records go into 123 Reg only after Mike approves them; nothing existing is edited or removed.
- **Scheduled job**: once a day, mark funds past `close_date` as closed.

> TODO (confirm): Supabase, and Resend or Postmark. The spec says to use whatever the booking site already uses.

## 6. Monetize - How will this make money?

The fund is not a revenue line in itself. Gifts become prepaid credit for TPS services: money owed in future services, not income yet (the accountant confirms the treatment, including expired credit). The card fee is passed on to the payer.

## 7. UI/UX - How should this look and feel?

Match the prototype's screens and copy. Gift-credit language, never "donation" or "fundraiser". Fees shown before paying. The expiry date appears wherever credit does. Programmes show "Price agreed at consultation", never prices.

## 8. Deployment - Where and how will this ship?

Target: booking.thepostpartumsuite.com, live Friday 6 November 2026. Full test in Stripe test mode on 4-5 November, then one real small payment and refund on 5 November.

> TODO (confirm): the spec says "build inside the existing booking site", but this repo is a standalone Next.js app. Confirm whether it deploys on its own (and at which host or path) or joins the booking site, and on which hosting provider.

Launch test (must pass before go-live): create a fund, give 2 guest gifts (one amount hidden), mum signs in by email link, top up £10, request credit for a treatment and for a programme, record credit used in admin, then check every email arrived and every balance and expiry date is correct.

## 9. Usage model and constraints

- Starts with one client's fund; low volume. No scale requirements beyond that.
- Real trust boundaries: payments (server-side fee, webhook-only credit), the mum's email-link sign-in, admin access limited to TPS addresses, guest personal data.
- Stripe restricts crowdfunding: Stripe product wording is "TPS gift credit". No live payments until Stripe confirms the business type.
- TPS owns every account: TJ gets Stripe developer access; database and email accounts are created under admin@thepostpartumsuite.com.
