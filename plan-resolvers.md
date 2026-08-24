# Plan: Co-locate Resolvers into Domain Folders

Status: **Proposed — do NOT start until the full auth stack merges** (#69 → #70 → #71/#72 → #73 → #74). This is a pure mechanical refactor with zero behavior change; doing it earlier would rebase six open PRs for no benefit.

Companion to [AGENTS.md](AGENTS.md) (file layout conventions) and [plan.md](plan.md).

## Problem

Domain code is split across two trees, and resolver file naming has drifted:

```
src/contracts/contract.service.js        ← domain layer
src/resolvers/contracts.js               ← its resolver... somewhere else
src/resolvers/members.resolver.js        ← singular, inconsistent
src/resolvers/chat/chat.js               ← neither pattern
src/resolvers/{clients,group,products,users}.js  ← bare names
```

The reference implementation (`src/photo-upload-service/image.resolvers.js`) already co-locates its resolver inside the domain folder. Every other domain should match.

## Target state

```
src/
├── resolvers/
│   └── index.js                  # wiring ONLY: spreads every domain's exports
├── users/users.resolvers.js      # moved from src/resolvers/users.js
├── clients/clients.resolvers.js  # moved from src/resolvers/clients.js
├── contracts/contracts.resolvers.js
├── members/members.resolvers.js
├── products/products.resolvers.js
├── groups/groups.resolvers.js
└── chat/chat.resolvers.js
```

Rules:

1. Resolver files are named `<domain>.resolvers.js` (plural, matching `image.resolvers.js`), living inside their domain folder.
2. `src/resolvers/index.js` stays as the single wiring point — `server.js`'s import path is untouched. It only updates its import paths.
3. Each moved file fixes its own relative imports (guards: `../auth/guards.js` → same depth since folder depth is unchanged from `src/resolvers/X.js`; services: `./user.service.js` etc.).
4. Delete stale artifacts: `src/resolvers/Query-Deprecated.js` (unused) and the now-empty `src/resolvers/chat/` subdirectory.
5. Zero changes to exported shapes, resolver names, or behavior. This is `git mv` + import-path edits only.

## Import-path cheat sheet (verify per file)

| Moved file | Old imports to fix |
|---|---|
| `users/users.resolvers.js` | `../users/user.service.js` → `./user.service.js`; `../auth/guards.js` unchanged (same depth) |
| `clients/clients.resolvers.js` | `./client.service.js`; constants paths likewise |
| `contracts/contracts.resolvers.js` | `../contracts/*` → `./*` |
| `members/members.resolvers.js` | `../members/*` → `./*`; `../auth/guards.js` unchanged |
| `products/products.resolvers.js` | `../stripe/stripe.service` if still referenced → check; products stripe calls live in the service now, so likely nothing |
| `groups/groups.resolvers.js` | `../groups/group.service.js` → `./group.service.js` |
| `chat/chat.resolvers.js` | `../../auth/guards.js` → `../auth/guards.js`; `../../pubsub` → `../pubsub`; `./chat.service.js` stays relative-to-folder |

`index.js` after:

```js
import memberResolvers from "../members/members.resolvers";
import contractResolvers from "../contracts/contracts.resolvers";
// ... one import per domain, same spread logic as today
```

## Implementation steps (single small PR, branch `refactor/co-locate-resolvers`)

1. `git mv src/resolvers/users.js src/users/users.resolvers.js` (and each domain likewise).
2. Fix intra-domain and auth/pubsub import paths per cheat sheet.
3. Update `src/resolvers/index.js` import paths; delete `Query-Deprecated.js`.
4. Update AGENTS.md "File layout conventions" section to document `<domain>.resolvers.js` as the standard (it currently implies resolvers live in `src/resolvers/`).
5. Verify (below), commit `refactor(resolvers): co-locate into domain folders`, draft PR.

## Verification

```bash
# syntax on every touched file
node --check <file>

# full wiring smoke test — MUST print Q:22 M:32
timeout 90 npx babel-node --presets @babel/preset-env -e "
  const idx = require('./src/resolvers');
  console.log('Q:' + Object.keys(idx.Query).length + ' M:' + Object.keys(idx.Mutation).length);
  process.exit(0);
"

# no stragglers
ls src/resolvers/   # should contain ONLY index.js
grep -rn "resolvers/" src/server.js   # import path unchanged
```

## Acceptance criteria

1. `src/resolvers/` contains only `index.js`; every domain owns its `<domain>.resolvers.js`.
2. Naming uniform: plural `.resolvers.js` everywhere (fixes `members.resolver.js`, `chat/chat.js`).
3. Resolver index loads Q:22 M:32 — schema-compatible, zero behavior change.
4. AGENTS.md updated to codify the convention so future agents follow it.

## Out of scope

- Any guard/scoping/logic changes — those belong to the auth stack PRs.
- Moving `src/auth/guards.js` or renaming service/repository/constants files.
- Splitting `resolvers/index.js` into per-domain index files (unnecessary indirection).
