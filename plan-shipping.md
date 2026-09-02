# Plan: Shipping — EasyPost/Shippo Labels + Webhooks + Dynamic Return Insurance (Feature #4a — `features.md:4`)

## Objective
Automatically purchase inbound + outbound labels at commercial rates, track them via carrier webhooks, and insure the return leg for `declaredMarketValue + servicePrice` so a lost return is covered for both client and member (no platform loss).

## Current State — No Shipping Setup
- `src/models/Contract.model.js:100` now has `shippingPreset`/`shippingSpeed`/`insuranceFee`/`shippingFee`/`inboundShipmentId`/`outboundShipmentId` (Feature #2), but no `src/shipping/` domain, no EasyPost/Shippo SDK, no webhook.
- `src/contracts/contract.service.js:proposePrice` creates `stripe.checkout.Session` but does NOT create labels — tracking numbers are manually entered via `inboundTracking`/`outboundTracking`.
- `sneaker-web/src/pages/ContractForm` has no weight/size selector; checkout is single `amount` not `line_items` for shipping.
- No `EASYPOST_API_KEY`/`SHIPPO_API_KEY` in `config.env:1`, no carrier aggregator, no cron for stuck contracts.

**This PR is blocked until you provision a carrier account.**

## Prerequisites (you must do before code)

1. **Create EasyPost account** (recommended) *or* Shippo — EasyPost has better webhook + insurance coverage. Get **Test API key** and **Production API key**.
2. Add to `config.env`:
```
EASYPOST_API_KEY=EZTK_test_...
EASYPOST_WEBHOOK_SECRET=whsec_...
# or SHIPPO_API_KEY=shippo_test_...
```
3. In EasyPost dashboard: create webhook `https://api.yourdomain.com/webhook/easypost` events `tracker.created`, `tracker.updated` (or Shippo `transaction_updated`). Keep secret for verification.

## Design — Single PR `feature/shipping` off `main`

### 1. `src/shipping/shipping.constants.js` (NEW)
```js
export const shippingPreset = Object.freeze({ single: "single", multi: "multi" });
export const shippingSpeed = Object.freeze({ standard: "standard", expedited: "expedited" });
export const parcelPresets = Object.freeze({
  single: { weight: 64, length: 13, width: 8, height: 5 }, // 4 lbs
  multi: { weight: 128, length: 15, width: 10, height: 6 }, // 8 lbs
});
```

### 2. `src/shipping/shipping.service.js` (NEW)
- `createInboundLabel(contract)` / `createOutboundLabel(contract)` — pick `parcelPresets[contract.shippingPreset]`, set `insurance: declaredMarketValue + servicePrice` for outbound, `declaredMarketValue` for inbound if `>= threshold`, call `easypost.Shipment.create` → `buy(lowestRate)`, return `{ shipmentId, trackingNumber, carrier, labelUrl }`.
- `verifyWebhookSignature(rawBody, signature)` — HMAC with `EASYPOST_WEBHOOK_SECRET`.
- No DB access except via `contractRepository`.

### 3. `src/shipping/shipping.repository.js` (NEW)
- Thin wrapper for any `Shipment` collection if you persist labels; otherwise just re-export `contractRepository` helpers — keep layer rule.

### 4. `src/models/Contract.model.js` — already has fields, just use them
- Ensure `inboundShipmentId/outboundShipmentId` store EasyPost `shipment.id`, `inboundTracking/outboundTracking` store `trackingNumber/carrier`.

### 5. `src/contracts/contract.service.js` — hook after payment
- After `stripeWebhookHandler` marks `status: awaitingPayment → readyToShip`, call `shippingService.createInboundLabel` + `createOutboundLabel` (fire-and-forget with retry). Push timeline `inboundLabelGenerated`/`outboundLabelGenerated` `contractEvent:40`.

### 6. `src/shipping/shipping.webhook.js` (NEW) + `src/server.js:62` route
```js
app.post("/webhook/easypost", express.raw({type:"application/json"}), async (req,res)=>{
  const event = shippingService.verifyWebhookSignature(req.rawBody, req.headers["x-easypost-signature"]);
  if(event.tracker.status === "delivered") {
    const contract = await contractRepository.findByShipmentId(event.tracker.id);
    await contractService.transitionTo(contract._id, contractStatus.arrivedAtMember, { actor:"system" });
  }
  // inboundShipped on "in_transit" etc per matrix
  res.sendStatus(200);
});
```

### 7. `sneaker-web/src/pages/ContractForm/ContractForm.jsx` + `sneaker-web/src/pages/MemberChat/PricePreviewModal.jsx`
- Add `shippingPreset` radio (1 pair / multi) and `shippingSpeed` (Standard $30 / Expedited $60) — these map to `parcelPresets` and to Stripe `line_items` (future #4b Review & Protect hub). For now just persist to contract.

## Verification
```bash
node --check src/shipping/shipping.service.js
node --check src/shipping/shipping.webhook.js
# manual with EasyPost test key:
# 1. Create contract declaredValue $1200, shippingPreset single
# 2. Pay → verify inbound/outbound labels created in EasyPost dashboard (test), timeline shows label events
# 3. Simulate tracker webhook `delivered` → contract transitions to ARRIVED_AT_MEMBER
# 4. Check outbound insurance = 1200 + 200 = $1400
```

## Out of Scope
- **#4b** Review & Protect hub UI math + Stripe `line_items` for shipping/insurance (next PR).
- Real carrier funding — test labels are $0 in sandbox.

## Rollout
**Own PR, blocked.** Create `feature/shipping` only after API keys are in `config.env`. Touches `shipping/` + `contract.service` + webhook — parallel-safe with Service Menu/Timeline but don't start until keys exist. Mark draft until EasyPost test labels succeed.
