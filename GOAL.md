# Goal Roadmap: Resolver → Service → Repository Refactor

## Objective

Bring every GraphQL domain in this repo in line with the **resolver → service → repository** pattern established in `src/photo-upload-service/` and completed for users.

```
resolvers  →  service  →  repository  →  Mongoose model
(thin:         (business     (sole owner
 ctx/auth +     logic +       of all DB
 error          domain        access)
 translation)   errors)
```

## Shared architecture rules (apply to every domain)

1. **Resolvers never import Mongoose models.** They read context (`ctx.userId`, `ctx.dbUser`, `ctx.role`), enforce auth ("Unauthorized"), validate input args, call the domain service, and translate domain errors into Apollo errors (`UserInputError`, etc.).
2. **Services never import anything from GraphQL/Apollo.** They throw plain domain errors (`new Error("EMAIL_TAKEN")`) that resolvers translate. Services may orchestrate Stripe/Redis/QR helpers — those are business logic, not GraphQL concerns.
3. **Repositories contain only Mongoose queries** for their own domain's model(s). No validation, no business rules.
4. **Cross-domain data access goes through the owning domain's repository/service**, never by importing another domain's model directly. Example: `contractService` needs a member → call `memberRepository.findById(...)`.
5. **External integrations (`stripe/stripe.service`, `utils/redis/*`) are called from services only**, never from resolvers.
6. Do not modify any file under `src/models/`, any GraphQL type definitions, or exported resolver names/shapes (schema compatibility).
7. Match existing code style: ES modules, async/await, object-literal exports like `imageService` / `userRepository`.
8. Keep `dotenv/config` behavior working exactly as before wherever it currently runs.

## Workflow: one draft PR per domain

Every domain refactor ships as its **own draft pull request off `main`**, so progress is visible and domains can be reviewed/merged independently:

1. Branch name: `refactor/<domain>-service-repo` (e.g. `refactor/contracts-service-repo`), branched from up-to-date `main`.
2. Work in an isolated **git worktree** (`git worktree add`) so multiple refactors can proceed in parallel in the same clone without stomping each other.
3. Commit incrementally with conventional messages (`refactor(contracts): ...`).
4. Open a **draft PR** titled `refactor(<domain>): service–repository pattern` with the goal file linked in the body; mark Ready for review when acceptance criteria are met.
5. Merge order matters for cross-domain imports: contracts → clients → chat → members → products → groups. Later PRs rebase onto main after earlier ones merge and replace any `// TODO(cross-domain)` shims with real repository calls.
6. While a dependency domain hasn't merged yet, a PR may temporarily query another domain's model inside its **own repository** — never in resolvers or services — marked `// TODO(cross-domain): move to <x>Repository when <domain> refactor lands`.

**Parallelization:** subagents may implement several domain goals simultaneously, each in its own worktree/branch, with permission to commit to their draft branch and open the draft PR.

## Domain status

| Domain | Files | Goal | Status |
|---|---|---|---|
| Photo upload (reference impl) | `src/photo-upload-service/*` | — | Done (pre-existing) |
| Users | `src/resolvers/users.js`, `src/users/*` | (history below) | ✅ Done |
| Contracts | `src/resolvers/contracts.js` | [goals/contracts.md](goals/contracts.md) | 📝 Draft PR [#63](https://github.com/The-Sneaker-Society/chicago/pull/63) |
| Clients | `src/resolvers/clients.js` | [goals/clients.md](goals/clients.md) | 📝 Draft PR [#64](https://github.com/The-Sneaker-Society/chicago/pull/64) |
| Chat & Messages | `src/resolvers/chat/chat.js` | [goals/chat.md](goals/chat.md) | 📝 Draft PR [#65](https://github.com/The-Sneaker-Society/chicago/pull/65) |
| Members | `src/resolvers/members.resolver.js` | [goals/members.md](goals/members.md) | 📝 Draft PR [#66](https://github.com/The-Sneaker-Society/chicago/pull/66) |
| Products | `src/resolvers/products.js` | [goals/products.md](goals/products.md) | 📝 Draft PR [#67](https://github.com/The-Sneaker-Society/chicago/pull/67) |
| Groups | `src/resolvers/group.js` | [goals/groups.md](goals/groups.md) | 📝 Draft PR [#68](https://github.com/The-Sneaker-Society/chicago/pull/68) |

**Integration:** all six drafts merged + cross-domain TODO shims consolidated + constants adopted → Draft PR [#69](https://github.com/The-Sneaker-Society/chicago/pull/69) (`refactor/integration-cleanup`). Use this branch for end-to-end frontend testing; it supersedes #63–#68 content-wise.

Suggested order: **contracts → clients → chat → members → products → groups**
(contracts and clients share the fetch-all-filter bug pattern and are referenced by chat/members; groups is the smallest and already nearly layered.)

## Completed: Users (2026-08)

Refactored per the original goal. Created:

- `src/users/user.repository.js` — sole Mongoose owner for `UserModel`, `ContractModel.find({ client })`, `ChatModel.find({ userId })`
- `src/users/user.service.js` — business logic, plain domain errors (`EMAIL_TAKEN`, `USER_NOT_FOUND`)
- Rewrote `src/resolvers/users.js` — zero model imports

Bugs fixed along the way: `currentUser` `.find()[0]` → `findOne`; `updateUser` id source aligned to `ctx.userId`; duplicate `zipcode` removed; contracts filtered at the DB level.

## Out of scope (all domains)

- Adding new GraphQL operations or changing existing ones.
- Authentication/Clerk changes.
- Modifying `src/models/index.js` exports or `src/resolvers/index.js` wiring beyond swapping the resolver import path if a resolver moves directories.

## Verification (per domain)

```bash
node --check src/resolvers/<domain>.js
node --check src/<domain>/<domain>.service.js
node --check src/<domain>/<domain>.repository.js

# smoke test: app boots and the `test` query still returns "hello"
npx babel-node --presets @babel/preset-env -e "
  const m = require('./src/resolvers').default;
  console.log(Object.keys(m.Query).length, 'queries loaded');
"
```
