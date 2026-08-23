# Agent Guide

Instructions for AI coding agents (and humans) working in this repo. Read this before making changes.

## Stack

Node + Babel (ES module syntax transpiled at runtime), Express + Apollo Server, Mongoose/MongoDB, Stripe, Clerk auth, Redis cache. No TypeScript. No frontend code here.

## Architecture: resolver → service → repository

```
resolvers  →  service  →  repository  →  Mongoose model
(ctx/auth +    (business     (sole owner
 error          logic +       of all DB
 translation)   domain        access)
                errors)
```

Reference implementations: `src/users/*`, `src/photo-upload-service/*`.

### Layer rules (enforced)

1. **Resolvers never import Mongoose models.** They read context (`ctx.userId`, `ctx.dbUser`, `ctx.role`), guard auth, validate input args, call the domain service, and translate domain errors into Apollo errors (`UserInputError`, etc.). Keep exported resolver shapes/names identical — they are schema contracts.
2. **Services never import anything from GraphQL/Apollo** (`apollo-server*`). They throw plain domain errors (`new Error("CONTRACT_NOT_FOUND")`) that resolvers translate. External integrations (Stripe, Redis, QR, pubsub-via-injected-callback) are called from services only.
3. **Repositories contain only Mongoose queries** for their OWN domain's model(s). No validation, no business rules.
4. **Cross-domain access goes through the owning domain's repository** — never import another domain's model into a resolver or service. Services may import other domains' *repositories* and *constants* freely, but never another service (no service→service imports; prevents cycles).
5. Never modify `src/models/*` schemas or GraphQL type definitions without explicit instruction.

## File layout conventions

Per-domain directory under `src/<domain>/`:

```
src/<domain>/<domain>.repository.js   # export const <domain>Repository = { ... }
src/<domain>/<domain>.service.js      # export const <domain>Service = { ... }
src/<domain>/<domain>.constants.js    # frozen vocabularies (see below), when applicable
```

Resolvers live in `src/resolvers/` (or `src/resolvers/<domain>/`) and are wired up in `src/resolvers/index.js`. Object-literal exports only (`export const userService = {...}`), ES modules, async/await. Keep `dotenv.config({ path: "config.env" })` behavior wherever it already exists.

## Constants over magic strings

Persisted vocabularies (document statuses, payout statuses, timeline events, domain error codes) live in a per-domain `*.constants.js` using `Object.freeze`, camelCase keys mapping to the exact persisted string values:

```js
export const contractStatus = Object.freeze({
  pendingReview: "PENDING_REVIEW",
  ...
});
```

Never change persisted string values without a data migration. Derive lookup maps (e.g., Mongo value → API key) from the constants object instead of hand-copying it.

## Git workflow

- One draft PR per logical unit, branched off `main`: `refactor/<domain>-service-repo`, `feature/...`, `fix/...`
- Conventional commits: `refactor(contracts): ...`, `fix(users): ...`, `docs: ...`
- For parallel multi-branch work use `git worktree add /tmp/opencode/wt-<name> -b <branch>` so branches don't stomp each other
- Roadmap and per-domain goals live in `GOAL.md` and `goals/*.md` — check there for in-flight work before starting anything new

## Verification (run before committing)

```bash
node --check <every touched .js file>

# module-resolution smoke test (Babel transpiles imports, plain node won't run them):
timeout 90 npx babel-node --presets @babel/preset-env -e "
  const idx = require('./src/resolvers');
  console.log('Q:' + Object.keys(idx.Query).length + ' M:' + Object.keys(idx.Mutation).length);
  process.exit(0);
"  # must print Q:22 M:32 (update if you intentionally changed the schema)

# if package.json has a real test script someday: npm test
```

## Known gotchas

- `npm test` is a placeholder; don't trust CI-less green — run the checks above
- Contract model field is `clientId` (not `client`); Member has `clients` array; Chat uses `userId`/`memberId` — check the schema before writing filters
- Some resolver names contain typos (`createMemberSubsctiprion`) — do NOT rename; they are schema contracts
