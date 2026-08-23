# Goal: Refactor Member Resolvers into Service–Repository Pattern

Parent rules: [../GOAL.md](../GOAL.md)

## Current state

`src/resolvers/members.resolver.js` (~630 lines) imports `MemberModel`, `ChatModel`, `UserModel`, `ContractModel`, `ProductsModel`, `stripe.service`, `redis.service`, and `qrGenerator` directly. Largest domain; do this after contracts/chat so cross-domain repositories exist.

## Files to create

Directory: `src/members/`

### 1. `src/members/member.repository.js`

Only file touching `MemberModel`. Export `memberRepository` with at least:

- `findAll()`
- `findByClerkId(clerkId)` — **must use `findOne`, not `find`**
- `findById(id)`
- `create(data)` / `save(doc)` / `updateById(id, updates)` (`{ new: true }`)
- `aggregateDiscover(matchStage, pipelineTail, { offset, limit })` — or expose `aggregate(pipeline)` and let the service build stages; aggregation stage-building is business logic (scoring), query execution is repository
- `addFollowerIds(currentId, targetId, mode)` — `$addToSet` / `$pull` pair helpers for follow/unfollow
- Cross-domain reads: reuse `contractRepository` / `chatRepository` / `productRepository` / `userRepository` — do not import their models

### 2. `src/members/member.service.js`

Export `memberService`. Move here:

- `getMembers()` / `getCurrentMember(clerkId)` (domain error `MEMBER_NOT_FOUND`)
- `getStripeWidgetData(dbUser)` — pending-payout aggregation + formatting + percent math + `getAccountStatus`
- `getSubscriptionDetails(stripeCustomerId)`, subscription pause/cancel/reactivate/sync wrappers around stripe+redis services with guard clauses
- `getRevenueSummary(contractIds)` — month-bucketing + empty-months helper
- `getDiscoverMembers(clerkId, { limit, offset })` — exclude/self logic + scoring pipeline assembly
- `createMember(input)`, `updateMember(memberDbId, updates)`, `deleteMember(memberDbId)`
- Stripe onboarding: `onboardMemberToStripe(ctx.userId)`, `resumeAccountOnboarding(memberDbId)`
- `followMember(clerkId, targetId)` / `unfollowMember(...)` — self-follow guard, target-exists check, both-sides sync
- Field-resolver helpers: products/chats/clients/contracts/following/followers/isSubscribed/isOnboardedWithStripe delegating to owning repositories and stripe service

### 3. Rewrite `src/resolvers/members.resolver.js`

Keep exported shape `{ Query, Mutation, Member }` and all names (including the misspelled `createMemberSubsctiprion` — do not rename, it's a schema contract). Resolvers only do ctx/auth, validation, error translation.

## Bugs to fix while refactoring

1. `memberById` / `currentMember` use `.find({ clerkId })[0]` → use `findOne`.
2. `createMember` passes `zipcode` twice.
3. `createMember` checks for an existing **clerkId** but throws "Email is taken..." — misleading; keep the uniqueness check but make the message accurate ("An account with this ID already exists" or similar) unless frontend depends on it — verify before changing copy.
4. `deleteMember` uses `ctx.id` while everything else uses `ctx.dbUser._id` → align id source and document it.
5. `onboardMemberToStripe` updates by `ctx.dbUser.id`; `resumeAccountOnboarding` reads by `ctx.dbUser.id` — normalize to `_id`.
6. `createMemberSubsctiprion` catch block does `throw new Error(Error)` — throws the constructor instead of an error instance; fix.
7. `deleteProductById`-style null-guard issue also applies here: `revenueSummary` handles empty contract lists already — keep that behavior.

## Acceptance criteria

1. Zero Mongoose model imports in `src/resolvers/members.resolver.js`.
2. Zero `apollo-server*` imports in `src/members/*`; zero direct model imports there too.
3. All resolver names (incl. typos) and return shapes unchanged.
4. Bugs 1–6 fixed.
5. `node --check` passes on all touched files; app boots.
