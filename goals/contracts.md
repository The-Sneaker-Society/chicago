# Goal: Refactor Contract Resolvers into Service–Repository Pattern

Parent rules: [../GOAL.md](../GOAL.md)

## Current state

`src/resolvers/contracts.js` imports `MemberModel`, `UserModel`, `ContractModel`, `ChatModel`, `mongoose`, and `stripe.service` directly, mixing auth, Stripe orchestration, business rules, and raw queries.

## Files to create

### 1. `src/contracts/contract.repository.js`

Only file touching Mongoose in this domain. Export `contractRepository` with at least:

- `findAll()` / `findById(id)` / `create(data)`
- `updateById(id, updates, options)` — support `{ new: true }`
- `save(doc)` — for the document-mutation flow used by `updateContract` (nested path merging then `.save()`)
- `aggregateByMemberStatus(memberId)` — the existing `$match memberId` + `$group by status` pipeline
- `findPendingPayoutsByMember(memberId)` — aggregate sum/count/fees/gross for `payoutStatus: "pending"`
- `findLatestPaidByMember(memberId)` — `findOne(...).sort({ paidAt: -1 })`
- `findByIds(ids)` — `{ _id: { $in: ids } }`
- `findByClient(clientId)` — `{ client: clientId }` (DB-level filter)

### 2. `src/contracts/contract.service.js`

Export `contractService`. Move here:

- `getContractsForContext(dbUser, role)` — role→filter mapping (`member` → `memberId`, `client` → `clientId`)
- `getContractById(id)` — throw domain error `CONTRACT_NOT_FOUND`
- `getMemberContractStatus(memberId)` — STAGE_MAP + statusCounts assembly
- `getContractList(contractIds)` — id/name/status mapping
- `createContract(clientId, input)` — validate member exists (via `memberRepository.findById`), build defaults (`status: "PENDING_REVIEW"`, timeline event, nulls), persist, and push contract id onto both user (`$push contracts`, `$addToSet members`) and member docs via their repositories
- `proposePrice(stripeConnectAccountId, contractId, price)` — shoe-label/product-name building + `createPaymentIntent` + status update
- `updateContract(requesterMemberId, id, data)` — ownership check (domain error `UNAUTHORIZED`), nested-path merge
- `initiateContractChat(memberId, contractId)` — ownership check, reuse-or-create chat (chat creation goes through `chatService`/`chatRepository`, not a direct `ChatModel` import), timeline push
- `releasePayout(contractId)` — payout-status guard, member Stripe lookup (via member repository), amount math, `releasePayoutToMember`, final update

Stripe calls stay inside this service (rule 5 of parent).

### 3. Rewrite `src/resolvers/contracts.js`

Keep exported shape `{ Query, Mutation, Contract }` and all resolver names. Resolvers only: ctx/auth guards, arg validation, service calls, error translation (`CONTRACT_NOT_FOUND` etc.).

## Bugs to fix while refactoring

1. `createContractPrice` updates price/status but does **not** push a `PRICE_PROPOSED` timeline event, unlike `proposePriceInChat` — make both consistent via one shared service method if practical.
2. `mongoose.Types.ObjectId(id)` coercion in `memberContractStatus` — prefer letting Mongo cast string ids; keep behavior identical but remove deprecated constructor call.
3. Field resolvers `Contract.member` / `Contract.client` hit models directly — route through member/user repositories.

## Acceptance criteria

1. Zero Mongoose model imports in `src/resolvers/contracts.js`.
2. Zero `apollo-server*` imports in `src/contracts/*`.
3. No fetch-all-then-filter patterns added; existing ones removed.
4. All resolver names and return shapes unchanged.
5. `node --check` passes on all touched files; app boots.
