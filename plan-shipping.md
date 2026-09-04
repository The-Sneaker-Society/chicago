# Plan: Shippo Labels + Webhooks + Insurance — CANONICAL (Blockers Resolved)

> **This file is the single source of truth for Feature 4a (backend) + 4b (Review & Protect UI).**
> `plan-4ab.md` is deleted (4a folded here, 4b folded into §2.8). `plan-vplan.md` defers here for 4a/4b.
>
> **Provider: Shippo** (chosen for MVP — under 500 labels/mo fits the free-tier discounted rates; EasyPost rejected for now: $0.05/label + better at 10k+/mo scale).
> **Status:** 🔒 Blocked until §0 prerequisites land. Own PR `feature/shipping` off `main`.
> **Source features:** `features.md:4a` — labels + webhooks + return insurance (shrinkage protection).

## 0. Prerequisites (blockers — you must do before code)

1. **Shippo account + keys** — https://apps.goshippo.com/join → API → Test `shippo_test_...` + Live key → `config.env`:
   ```
   SHIPPO_API_KEY=shippo_test_...
   INSURANCE_THRESHOLD=1000
   INSURANCE_RATE=0.02
   ```
   Do not commit `config.env`. Add same keys to prod env (Render/Vercel). Add `SHIPPO_API_KEY` to `checkEnvVars` in `src/server.js:19`.
2. **Shippo dashboard webhook** — Portal → API Config → Webhooks → Add `https://api.yourdomain.com/webhook/shippo` (must be <200 chars), events `transaction_created` + `transaction_updated` + `track_updated`. Shippo has **no HMAC signing secret** — secure via unguessable URL (and optional basic-auth on the route). No `*_WEBHOOK_SECRET` needed.
3. **Address backfill (pull from account collections)** — `User.model.js` and `Member.model.js` already have `addressLineOne/addressLineTwo/zipcode/state/phoneNumber`, but **neither has `city` or `country`** and Shippo requires `name, street1, street2, city, state, zip, country, phone, email` on every `Shipment.create`. Required schema migration (needs explicit approval per `AGENTS.md` — never edit `src/models/*` silently):
   - Add `city: String`, `country: { type: String, default: "US" }` to `User` + `Member` (+ GraphQL types `src/models/schema/types/user.js`, `member.js` + resolvers).
   - Backfill / require at onboarding + intake: if either side missing city/zip, block label creation with `MISSING_SHIPPING_ADDRESS` domain error (see §2.5 failure path).
   - No new address collection — read live via owning repositories.
   - Note: XCover policy emails go to the sender `email` on the shipment — always pass real user/member emails in `buildAddresses`.
4. **Carrier funding** — test labels are $0 in sandbox. Prod needs Shippo balance topped up (or own carrier accounts linked) or `Transaction.create` will fail post-payment.
5. **Package** — `npm install shippo --save` (NOT `easypost`; updates `package-lock.json`; `Dockerfile` uses `npm ci`). Auth is `Authorization: ShippoToken <key>` (handled by SDK).

## 1. Decisions locked (from review)

| # | Review finding | Decision |
|---|---|---|
| 1 | `Shipment.create` needs from/to addresses; plan omitted source | Pull from `Users` (client) + `Members` (restorer) account collections via their repositories. Add missing `city`/`country` fields (§0.3). Snapshot nothing — read live at label time. |
| 2 | Webhook would 401 / double-parse (`express.json` global + `requireAuth` bypass only for exact `/webhook`) | New route `POST /webhook/shippo` using default JSON parser (no `express.raw` — no signature to verify); extend Clerk `requireAuth` bypass to `req.path.startsWith("/webhook/")`. Verify sender via unguessable URL / basic-auth, not HMAC. Events: `transaction_*` + `track_updated` (not `tracker.*`). |
| 3 | Plan was EasyPost-shaped (`Shipment.create` → `buy`) | Shippo flow: `Shipments.create({address_from/to, parcels, extra.insurance, async:false})` → pick cheapest `Rate` → `Transactions.create({rate, label_file_type:"PDF", async:false})`. SDK v2: `new Shippo({apiKeyHeader: KEY})` → `shippo.shipments.create(...)` / `shippo.transactions.create(...)`. |
| 4 | Shipping/insurance pricing + coverage model | **Pass-through at cost. Coverage: XCover on every leg of every shipment (platform-funded under threshold, user-funded at/over via toggle; opt-out behind waiver modal, recorded as `INSURANCE_DECLINED`). Charging: user sees an insurance line only at/over `INSURANCE_THRESHOLD` ($1000 default, env-overridable); under it coverage is silent platform cost. No buyer-protection fee (decision: revisit with volume).** Outbound insured value = `declaredMarketValue + servicePrice`; inbound = `declaredMarketValue`. `createPaymentIntent` switched to live line_items: Service + Shipping (postage portion) + Insurance (embedded XCover sum) — see §2.6. XCover caps at $10,000 — contracts above that need carrier-direct or manual handling (out of scope). `extra.insurance.content` = `"sneakers"`. |
| 5 | Fire-and-forget with no failure path = paid user, no label | Try/catch per label, push timeline error event, **log-stub notification only** (`console.log("[SHIPPING_FAIL] ...")` — no provider, no manual-retry mutation in this PR). Contract stays `READY_TO_SHIP` so a later PR / admin can retry. |
| 6 | No `labelUrl` storage; no lookup helper; shipment vs transaction IDs conflated; status matrix only covered inbound | Store Shippo `shipment.object_id` in existing `*ShipmentId`, **new** `inboundTransactionId/outboundTransactionId` + `inboundLabelUrl/outboundLabelUrl`. Repository implements `findByShippoId(id)` (checks shipment + transaction IDs) **and** `findByTrackingNumber(number, carrier)` (because `track_updated` payloads carry only tracking number). Webhook handles **both legs** full matrix (see §2.7). |
| 7 | Ops gaps | Covered in §0 + §5 rollout. MVP volume (<500 labels/mo) stays inside Shippo free-tier discounted rates. |

## 2. Design — Single PR `feature/shipping` (AGENTS.md: `resolver → service → repository`)

### 2.1 `src/shipping/shipping.constants.js` (NEW)
```js
export const shippingPreset = Object.freeze({ single: "single", multi: "multi" });
export const shippingSpeed = Object.freeze({ standard: "standard", expedited: "expedited" });
export const parcelPresets = Object.freeze({
  // SDK v2 CAMELCASE keys — snake_case is silently dropped → 400 on parcels[0]
  single: { weight: "4", length: "13", width: "8", height: "5", distanceUnit: "in", massUnit: "lb" },
  multi: { weight: "8", length: "15", width: "10", height: "6", distanceUnit: "in", massUnit: "lb" },
});
export const shippingFees = Object.freeze({ standard: 30, expedited: 60 }); // LEGACY flat preview only; checkout resolves live quotes (quoteRoundTrip)
export const insuranceConfig = Object.freeze({
  threshold: Number(process.env.INSURANCE_THRESHOLD) || 1000,
  rate: Number(process.env.INSURANCE_RATE) || 0.02,
});
```
Note: Shippo parcel takes lb/in strings (not EasyPost oz) — presets above already converted.

### 2.2 `src/shipping/shipping.service.js` (NEW — no Apollo imports, no direct model imports)
- `getRates(preset, speed)` — legacy flat preview only. Live path below.
- `quoteRoundTrip(contract, { preset, withInsurance })` — creates both leg shipments (free, no purchase) with per-leg XCover amounts and pairs rates by carrier+service into round-trip options `{ carrier, service, serviceToken, etaDays, inbound/outboundRateId, inbound/outboundAmount, roundTripTotal, insuranceTotal }`, cheapest first. Exposed as `shippingRateOptions` query (party-scoped). Pass-through at cost — no markup.
- Signature confirmation (`extra.signatureConfirmation: "STANDARD"`, SDK camelCase — verified +$4.15/leg USPS): auto-required at/over `SIGNATURE_THRESHOLD` ($500 env-overridable, porch-piracy + XCover claim-validity), opt-in checkbox below. Priced inside quoted rates; persisted as `signatureRequired`; bought on both labels. No separate UI beyond the review toggle + required badge.
- `createInboundLabel/createOutboundLabel` — buy the stored checkout rate ids verbatim; on stale-rate failure re-quote and buy the same service token (`rebuySameService`, logged). Legacy no-choice path buys cheapest as before.
- `buildAddresses(contract)` — loads client via `userRepository` (`contract.clientId`) + member via `memberRepository` (`contract.memberId`), maps `addressLineOne→street1, addressLineTwo→street2, city, state, zipcode→zip, country, phoneNumber→phone, email→email`, throws `MISSING_SHIPPING_ADDRESS` if city/zip missing on either side.
- `insuranceFor(contract, leg)` — if `insuranceDeclined` or `(contract.declaredMarketValue || 0) < insuranceConfig.threshold` return `null` (no `extra.insurance` sent); else `{ amount: String(leg === "outbound" ? declaredMarketValue + servicePrice : declaredMarketValue), currency: "USD", content: "sneakers" }`. `servicePrice = contract.price ?? contract.proposedPrice ?? selectedServiceMenuItem.price`.
- `createInboundLabel(contract)` / `createOutboundLabel(contract)`:
  ```js
  import { Shippo } from "shippo";
  const shippo = new Shippo({ apiKeyHeader: process.env.SHIPPO_API_KEY });
  const addresses = buildAddresses(contract); // inbound: client→member; outbound: member→client
  const shipment = await shippo.shipments.create({
    addressFrom: from, addressTo: to,
    parcels: [parcelPresets[contract.shippingPreset ?? "single"]],
    extra: insurance ? { insurance } : undefined,
    async: false, // return rates inline
  });
  const rate = shipment.rates.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))[0];
  const txn = await shippo.transactions.create({ rate: rate.object_id, label_file_type: "PDF", async: false });
  if (txn.status !== "SUCCESS") throw new Error(txn.messages?.map(m => m.text).join("; ") || "SHIPPO_TRANSACTION_FAILED");
  return { shipmentId: shipment.object_id, transactionId: txn.object_id, trackingNumber: txn.tracking_number, carrier: txn.rate?.provider ?? rate.provider, labelUrl: txn.label_url };
  ```

### 2.3 `src/shipping/shipping.repository.js` (NEW — only Mongoose for own domain, else re-export)
- No new `Shipment` collection in this PR. Re-exports `contractRepository` helpers + implements:
  - `findByShippoId(id)` — `Contracts.findOne({ $or: [{ inboundShipmentId: id }, { outboundShipmentId: id }, { inboundTransactionId: id }, { outboundTransactionId: id }] })` (for `transaction_created/updated`, which carry `object_id`).
  - `findByTrackingNumber(number)` — matches `inboundTracking.trackingNumber / outboundTracking.trackingNumber` (for `track_updated`, which carries only tracking number + carrier).

### 2.4 `src/models/Contract.model.js` (+ GraphQL `contract.js` types) — schema migration, explicit approval required
- Already exists: `shippingPreset/shippingSpeed/insuranceFee/shippingFee/inboundShipmentId/outboundShipmentId`, `inboundTracking/outboundTracking`, `declaredMarketValue`, `price/proposedPrice`.
- **Add in this PR:** `inboundTransactionId: String`, `outboundTransactionId: String`, `inboundLabelUrl: String`, `outboundLabelUrl: String`. `*ShipmentId` = Shippo `shipment.object_id`; `*TransactionId` = `transaction.object_id`; `*Tracking` = `transaction.tracking_number` + provider; `*LabelUrl` = `transaction.label_url`.

### 2.5 `src/contracts/contract.service.js` — hook after payment (no service→service import)
- `stripeWebhookHandler.handleContractPayment` already sets `READY_TO_SHIP` + `PAYMENT_COMPLETED`. After that `findByIdAndUpdate`, call shipping inline (or injected callback to respect no-service→service rule):
  ```js
  for (const leg of ["inbound", "outbound"]) {
    try {
      const label = leg === "inbound" ? await shippingService.createInboundLabel(contract) : await shippingService.createOutboundLabel(contract);
      await contractRepository.saveLabels(contract._id, leg, label); // sets shipment+transaction ids + tracking + labelUrl, pushes INBOUND/OUTBOUND_LABEL_GENERATED
    } catch (err) {
      await contractRepository.pushTimeline(contract._id, "LABEL_GENERATION_FAILED");
      console.log(`[SHIPPING_FAIL] contract ${contract._id} leg ${leg}: ${err.message}`); // stub notification — no provider, no retry mutation in this PR
    }
  }
  ```
- Labels created sequentially (inbound then outbound) so a partial failure is visible in timeline. Contract remains `READY_TO_SHIP` either way — never roll back payment.

### 2.6 `src/stripe/stripe.service.js: createPaymentIntent` — itemized checkout (part of decision #4)
- Switch from single `line_items[0]` (service only) to three lines using contract's persisted fees:
  ```
  Service:  `{productName} — {orderRef}`
  Shipping: `Shipping ({speed}) — {orderRef}`
  Insurance: `Shipping Insurance — {orderRef}` (omit line if 0)
  ```
  Human orderRef (SS-XXXXXX, unique, assigned at intake + backfilled) is the receipt label — never a raw Mongo id (falls back to contractId only for pre-number legacy). Reconciliation stays on session/payment_intent metadata (`contractId`, `orderRef`, `platformFeeCents`).
- `insuranceFee` / `shippingFee` computed at `PRICE_PROPOSED → AWAITING_PAYMENT` time (`insuranceFee = !declined && declaredValue >= threshold ? round(declaredValue * rate) : 0`) and persisted on contract so Stripe + DB agree. `platformFeeCents` stays metadata-derived (existing 15% logic untouched). XCover actual cost lands in `rate.included_insurance_price`, covered by the 2% charge with margin.

### 2.7 `src/shipping/shipping.webhook.js` (NEW) + `src/server.js` route
```js
// server.js — with other routes (default JSON parser is fine, no express.raw needed):
app.post("/webhook/shippo", express.json(), shippingWebhook);
// and extend the requireAuth bypass: if (req.path === "/webhook" || req.path.startsWith("/webhook/")) return next();
```
- Handler: no HMAC to verify (Shippo sends `Shippo-API-Version` header only) — rely on unguessable URL / basic-auth. Branch on `event`:
  - `transaction_created/updated` → `findByShippoId(data.object_id)` → store tracking/label if missing (idempotent).
  - `track_updated` → `findByTrackingNumber(data.tracking_number)` → normalize `data.tracking_status` (`DELIVERED`, `TRANSIT`/`IN_TRANSIT`, `PRE_TRANSIT`, `FAILURE`/`RETURNED`) then **both-legs matrix**:
    - inbound `TRANSIT` → `transitionTo(INBOUND_SHIPPED, { actor: "system" })` + `INBOUND_SHIPPED` event
    - inbound `DELIVERED` → `transitionTo(ARRIVED_AT_MEMBER, ...)` + `INBOUND_DELIVERED`
    - outbound `TRANSIT`/`PRE_TRANSIT` → `transitionTo(RETURN_SHIPPED, ...)` + `RETURN_SHIPPED` (idempotent)
    - outbound `DELIVERED` → `transitionTo(DELIVERED_TO_USER, ...)` + `RETURN_DELIVERED` (+ set `payoutEligibleAt = now + 72h` for Escrow #5)
- Expect Shippo tracking latency (minutes up to ~2h by carrier) — slower than EasyPost; don't treat delay as failure. Always `200` after processing. Log unknown IDs, don't throw.

### 2.8 Frontend — 4b Review & Protect Hub (follow-up PR `feature/review-protect`)

> **UI review verdict (2026-09-03): old `plan-4ab.md §4b` did NOT fit current `sneaker-web` — corrected below.**
> - ❌ No `ReviewProtect/` page or `review-protect` route exists. Must be created.
> - ❌ Route belongs in **`UserRoutes.jsx`** (payer = client/user), not member routes.
> - ❌ `PriceProposalBubble.jsx:43-63` deep-links Stripe (`Pay Now` → `checkoutUrl`). Must become `Review & Protect →` navigate.
> - ❌ `PricePreviewModal.jsx` is member-side — do not touch for 4b.

**New screen:** `sneaker-web/src/pages/ReviewProtect/ReviewProtectPage.jsx` — gated on `PRICE_PROPOSED`, rendered *before* Stripe Checkout.

**UI blocks (client-side math mirrors §2.2/§2.6 so preview == charge):**
1. `Shipping Preset` radio: 1 pair (`single`) / multi (`multi`) — defaults from `contract.shippingPreset`.
2. `Speed` radio: Standard `$30` / Expedited `$60` — local preview only, no live Shippo call from frontend.
3. `Insurance` opt-out toggle, default ON when applicable: `declaredMarketValue >= threshold ? Protect my shipment for +$(declaredValue * 0.02) : no charge, no toggle`. Unchecking opens the liability waiver modal ("you are responsible for damage/loss in transit — Sneaker Society is not liable") with Keep protection / I accept responsibility. Confirmed opt-out ⇒ fee 0, no Insurance line, `insuranceDeclined: true` persisted + `INSURANCE_DECLINED` timeline event.
4. `Ship-from address confirm`: prefill from `Users` account, editable inline; blocks `Continue` if city/zip missing (matches `MISSING_SHIPPING_ADDRESS`).
5. `Total = Service + Shipping + Insurance` → `Pay $X` → `createContractCheckout(shippingPreset/speed/insuranceDeclined)` then itemized `createPaymentIntent` (itemized §2.6) → redirect to Stripe `session.url`.
6. Label surface (built): client contract page shows inbound `labelUrl` print button + tracking; member review shows outbound print button. Stored `deliver.goshippo.com` URLs carry expiry — re-resolve or archive to own storage before launch (open item).

**Wiring:**
- No direct Shippo call from frontend — only persists `shippingPreset/shippingSpeed` (+ address edit) via `updateContract`. Backend 4a creates labels post-payment.
- `UserRoutes.jsx`: add `<Route path="review-protect/:contractId" ... />`.
- `PriceProposalBubble.jsx`: replace `Pay Now` href with navigate. Keep status pill logic.
- `PricePreviewModal.jsx`: **no change**.

**Verification (4b):**
- Manual: `PRICE_PROPOSED` → `Review & Protect` → Standard/Expedited math + threshold-gated insurance + address confirm → `Continue` → Stripe shows 2–3 itemized lines → pay → labels + webhook (§3 steps 1–4).

## 3. Verification
```bash
node --check src/shipping/shipping.service.js
node --check src/shipping/shipping.webhook.js
node --check src/shipping/shipping.repository.js
# module smoke (AGENTS.md):
timeout 90 npx babel-node --presets @babel/preset-env -e "const idx = require('./src/resolvers'); console.log('Q:' + Object.keys(idx.Query).length + ' M:' + Object.keys(idx.Mutation).length); process.exit(0);"
# manual with Shippo test key:
# 1. Seed user+member WITH city/zip/country; create contract declaredValue $1200 preset single, speed standard
# 2. Pay → both transactions SUCCESS in Shippo dashboard (test), timeline INBOUND/OUTBOUND_LABEL_GENERATED, *TransactionId/*LabelUrl set
# 3. declaredValue $500 → transactions with NO extra.insurance, no Insurance line_item, insuranceFee 0
# 4. Fire transaction_updated → tracking stored; fire track_updated DELIVERED (inbound) → ARRIVED_AT_MEMBER; outbound DELIVERED → DELIVERED_TO_USER + payoutEligibleAt set
# 5. Break address (clear city) → pay → contract stays READY_TO_SHIP + LABEL_GENERATION_FAILED + [SHIPPING_FAIL] log, no crash
# 6. Check outbound extra.insurance.amount = 1200 + servicePrice (e.g. 1400); inbound = 1200; rate.included_insurance_price < 2% charge
```

## 4. Out of Scope (explicitly deferred)
- Real notification provider (SendGrid/Resend) — stub log only in this PR.
- Manual-retry mutation / admin reprint-label button — later PR (needed before Cancellation #10 refund-for-label-cost rule works end-to-end).
- Live rate-shopping, multi-parcel, customs, QR / drop-off codes, >$10k XCover cap handling.
- `node-cron` stuck-contract sweeper + 72h auto-payout (Feature #5).

## 5. Rollout
1. Land §0 prerequisites (keys, webhook, `city`/`country` migration, Shippo balance). Keep PR `feature/shipping` **draft** until Shippo test transactions succeed.
2. PR1 `feature/shipping` (4a backend): `src/shipping/*` + `contract.service` hook + `stripe.service` line_items + `server.js` webhook + Contract transaction/labelUrl fields + tests.
3. PR2 `feature/review-protect` (4b UI, §2.8): `ReviewProtectPage` + `UserRoutes` + `PriceProposalBubble` redirect. **Do not merge PR2 before PR1.**
4. After merge: update `features.md:4a/4b` 🔒→✅, update `plan-vplan.md §4a/4b` checkboxes, record `insuranceConfig` values + Shippo carrier mix.
