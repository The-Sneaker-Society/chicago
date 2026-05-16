That flow should work end-to-end. Here's the exact test path and one thing you'll need running:
Test Steps
1. Create a contract — client goes to /user/new-contract/:memberId, submits the intake form
2. Set a price — as the member, open the contract and call createContractPrice (whatever UI you have for that) — it returns a Stripe Checkout URL
3. Pay — open that URL, use test card 4242 4242 4242 4242, any future date, any CVC
4. Webhook fires — Stripe sends checkout.session.completed → your handler stamps the contract with payoutStatus: pending + payoutAmount
5. Check dashboard — stripeWidgetData aggregates pending contracts → dollar amount + "Pending across 1 contract" should appear
One Prerequisite
The webhook won't reach your local server unless you're forwarding it with the Stripe CLI:
stripe listen --forward-to localhost:YOUR_PORT/webhook
That command will also print a webhook signing secret — make sure that value is what's in your config.env as STRIPE_WEBHOOK_SECRET, otherwise the signature verification will reject every event.
One Thing to Double-Check
In createContractPrice, the resolver pulls stripeConnectAccountId from ctx.dbUser — so that mutation must be called as the member (not the client). Make sure the frontend is calling it from an authenticated member session, otherwise the connect account ID will be missing and the checkout session won't be created.

