## Your features

Demo MVP
- [x] 1. **App scaffold** - Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (create-next-app)
- [x] 2. **Database foundation** - Neon Postgres + Drizzle, schema for funds, contributions, credit_ledger, credit_requests, outbox
- [x] 3. **Money and date rules** - fee (rounded up), £10 minimum, close date, expiry, balance from the ledger, all in pence; the core algorithm in one place
- [x] 4. **Create a fund** - `/fund/new`: name, mum's email, due date, optional goal, note; slug; "fund created" outbox email
- [x] 5. **Public fund page** - `/fund/<slug>`: total, goal bar, guest messages (hidden amounts respected), close date, share link, Contribute
- [x] 6. **Guest checkout** - `/fund/<slug>/give` and `/thanks`: amount (£10 min), message, show-amount choice, server-side fee, pending contribution, Stripe Checkout in test mode
- [x] 7. **Payment webhook** - `checkout.session.completed` marks the contribution paid once, adds the credit entry, writes the receipt and "you've received a gift" to the outbox
- [x] 8. **Mum page** - `/fund/<slug>/me`, no sign-in: balance, expiry, every message and amount, top-up history
- [ ] 9. **Mum top-ups** - top-up with fee through the same checkout and webhook, private to the mum
- [ ] 10. **Use my credit** - pick a service; programmes ask how much to apply; capped at available credit; request to TPS in the outbox
- [ ] 11. **Admin screen** - `/admin/funds`, no sign-in: funds, balances, close and expiry dates, contributions, open requests, record credit used
- [ ] 12. **Demo outbox and clock** - outbox page for every email; "pretend today is" date driving closing and expiry
- [ ] 13. **Deploy to Vercel** - personal Vercel, Neon database, Stripe test keys and webhook endpoint, then run the demo walkthrough
