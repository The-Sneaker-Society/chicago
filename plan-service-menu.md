# Plan: Service Menu & Graceful Fallback (Feature #1 — `features.md:1`)

## Objective
Let Members define a reusable Service Menu (e.g. “Basic Clean $40”, “Deep Clean $75”, “Sole Swap $150”) and have the intake form gracefully fallback to open-ended input when no menu exists. Member retains final price authority in `PRICE_PROPOSED`.

## Current State
- `src/models/Member.model.js:1-95` — no `serviceMenu` field; profile is free-form.
- `sneaker-web/src/pages/ContractForm/` — intake is always open-ended `repairDetails.clientNotes` + `shoeDetails`.
- `src/contracts/contract.constants.js:7-30` — statuses exist, no pricing vocab needed.

## Design

### Backend

**1. `src/members/member.constants.js` (NEW) or extend `src/contracts/contract.constants.js`**
```js
export const serviceMenuItem = Object.freeze({ // validation helper, not persisted enum
  maxItems: 12,
  maxNameLen: 60,
  maxPriceCents: 50000,
});
```

**2. `src/models/Member.model.js`**
Add:
```js
serviceMenu: [{
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, required: true, maxlength: 60 },
  price: { type: Number, required: true, min: 1, max: 500 },
  description: { type: String, maxlength: 200 },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}]
```

**3. `src/members/member.service.js` + `member.repository.js`**
- `upsertServiceMenu(memberId, items[])` — auth `requireMember`, validate `items.length<=12`, `name`/`price`, normalize `sortOrder`, `$set`.
- `getServiceMenu(memberId)` — public read (no auth) for intake; returns `isActive` sorted.
- No cross-domain writes; repository owns `Member` only.

**4. `src/members/members.resolvers.js` (or `src/members/members.resolvers.js` after co-location)**
```graphql
type ServiceMenuItem { id: ID!, name: String!, price: Float!, description: String, isActive: Boolean!, sortOrder: Int! }
extend type Member { serviceMenu: [ServiceMenuItem!]! }
extend type Mutation { upsertServiceMenu(items: [ServiceMenuItemInput!]!): [ServiceMenuItem!]! }
```
Resolver: `requireMember`, calls service, translates `VALIDATION_ERROR` → `UserInputError`.

**5. `src/models/Contract.model.js`**
Add optional denormalized snapshot for audit (what menu item was selected at intake):
```js
selectedServiceMenuItem: { id: String, name: String, price: Number } // null if Custom Request
```

### Frontend

**6. `sneaker-web/src/pages/membersettings/ServiceMenuEditor.jsx` (NEW)**
- CRUD table: inline edit name/price/description, drag sort, toggle `isActive`, max 12, optimistic update via `upsertServiceMenu`.
- Empty state: “No menu yet — clients will see the classic form.”

**7. `sneaker-web/src/pages/ContractForm/ContractForm.jsx`**
- On `memberId` load, `query { member(id) { serviceMenu } }`.
- If `serviceMenu.length>0` (active items): render `<Select>` with `activeItems` + appended `Custom Request` (value `__custom`). Selecting an item pre-fills `priceHint` but does NOT lock price — still editable notes. Selecting `Custom` shows classic `TextField`.
- If empty/unauthed or `isActive===0`: render classic form only (graceful fallback).
- On submit, send `selectedServiceMenuItem` snapshot if not custom.

## Verification
```bash
node --check src/models/Member.model.js
node --check src/members/member.service.js
node --check src/members/members.resolvers.js
# smoke
timeout 30 npx babel-node --presets @babel/preset-env -e "const idx=require('./src/resolvers'); console.log('Q:'+Object.keys(idx.Query).length+' M:'+Object.keys(idx.Mutation).length)"
# manual: create menu (2 items), intake as client sees select+Custom, submit both paths, verify contract has snapshot or null, then propose price still overrides
```

## Out of scope
- Enforcement that `PRICE_PROPOSED` must match menu price (member always overrides).
- Availability/booking slots.

## Rollout
Single PR `feature/service-menu` branched off `main` — touches `Member` domain + `ContractForm` only, parallel-safe with Timeline.
