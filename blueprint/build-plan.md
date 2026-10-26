## Your features

Version 1: live Friday 6 November 2026
- [x] 1. **App scaffold** - Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (create-next-app)
- [ ] 2. **Database foundation** - Supabase project under admin@, schema for funds, contributions, credit_ledger, credit_requests
- [ ] 3. **Email sending** - email service from a TPS address, DNS records sent to Mike for approval, temporary provider-verified sender until approved
- [ ] 4. **Mum sign-in** - one-time email link to the fund's email, no passwords; admin access limited to TPS addresses
- [ ] 5. **Create a fund** - `/fund/new`: name, mum's email, due date, photo, optional goal, note; slug; close date; sign-in email to the mum
- [ ] 6. **Public fund page** - `/fund/<slug>`: photo, note, total, goal bar, guest messages (hidden amounts respected), close date, share link, Contribute
- [ ] 7. **Guest checkout** - `/fund/<slug>/give` and `/thanks`: preset or custom amount (£10 min), message, show-amount choice, server-side fee, Stripe Checkout
- [ ] 8. **Payment webhook** - `checkout.session.completed` marks the contribution paid, adds the credit ledger entry, sends the guest receipt and "you've received a gift"
- [ ] 9. **Mum dashboard** - `/fund/me`: balance, expiry, every message and amount, top-up history
- [ ] 10. **Mum top-ups** - `/fund/me/topup` with fee, private to the mum, top-up receipt
- [ ] 11. **Use my credit** - `/fund/me/use`: pick a service; programmes ask how much to apply; credit-use request email to info@
- [ ] 12. **Admin screen** - `/admin/funds`: funds, balances, close and expiry dates, contributions, open requests, record credit used (debit + confirmation email)
- [ ] 13. **Daily close job** - close funds past `close_date`; hide Contribute and Add money
- [ ] 14. **Launch test** - full Stripe test-mode run of the launch checklist, then one real small payment and refund

After launch: by mid-December
- [ ] 15. **SimplyBook credit link** - connect credit use to SimplyBook bookings automatically
- [ ] 16. **Programme instalment adjustment** - adjust programme instalments in Zoho/Stripe automatically
- [ ] 17. **Reminder emails** - fund closing (1 week before) and credit expiry (30 days before)
- [ ] 18. **Organiser view** - separate from the mum's view
- [ ] 19. **Message keepsake** - downloadable keepsake of guest messages for the mum
