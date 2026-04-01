# TypeScript Migration Plan

This document is a repo-specific plan for migrating this backend from JavaScript to TypeScript in small, low-risk steps.

## Goal

Add TypeScript tooling so you can start writing `.ts` files immediately. All existing `.js` files remain untouched and the API continues to work as-is. No files are renamed or converted unless you choose to later.

Current state:

- Runtime: Node 18
- Build: Babel compiles `src/` into `build/`
- Server stack: Express + Apollo Server 3 + GraphQL subscriptions
- Data layer: Mongoose
- Integrations: Clerk, Stripe, Redis, Nodemailer, AWS SDK
- Tests: none in place yet

## Important Constraints

- Treat `build/` as generated output only.
- Do not migrate `build/`; only migrate `src/`.
- Do not try to convert the whole repo in one prompt.
- Normalize module exports before broad `.ts` renames.
- Add shared app types before converting resolvers.
- Preserve collection names, GraphQL schema behavior, and webhook behavior.

## Repo-Specific Risk Areas

1. Mixed module system.
The source tree uses both ESM and CommonJS. Files such as `src/config/db.js`, `src/resolvers/index.js`, and several model files still use `module.exports`.

2. Untyped Apollo context.
`src/server.js` builds context dynamically from Clerk auth and Redis. Resolvers assume fields like `ctx.userId`, `ctx.dbUser`, and `ctx.redis` exist.

3. Mongoose typing will be non-trivial.
The models use untyped schemas and inconsistent exports. This affects all resolver work.

4. Stripe webhook request mutation.
`src/server.js` attaches `rawBody` to the Express request for Stripe signature validation. TypeScript will require an explicit request type extension.

5. Environment variables are scattered.
Several files call `dotenv.config()` locally and read `process.env` directly.

## Recommended End State

- Development: `tsx watch src/server.ts`
- Build: `tsc`
- Output: `build/`
- Shared app types in `src/types/`
- One central config/env loader
- No Babel dependency required for normal dev/build

## Phase Plan

### Phase 0: Baseline and Safety

Purpose:
Make sure the current app behavior is understood before introducing compiler changes.

Actions:

1. Confirm the current app still starts with the existing scripts.
2. Confirm the current build still emits `build/server.js`.
3. Keep a log of startup errors and warnings.
4. Record the current Node version and package manager lockfile state.

Validation:

```bash
npm run build
npm run dev
```

Definition of done:

- You can reproduce the current build and dev behavior.
- You know whether startup requires live MongoDB, Redis, Clerk, and Stripe config.

### Phase 1: Add TypeScript Tooling Without Renaming Files

Purpose:
Introduce TypeScript incrementally while keeping the codebase mostly unchanged.

Actions:

1. Install TypeScript runtime/build dependencies.
2. Add `tsconfig.json`.
3. Configure TypeScript to allow existing `.js` files during migration.
4. Add `tsx` for local development.
5. Update npm scripts so TypeScript tooling can be tested without removing Babel immediately.

Recommended initial compiler settings:

- `allowJs: true` — stays enabled permanently; `.js` files compile alongside `.ts`
- `checkJs: false`
- `outDir: "build"`
- `rootDir: "src"`
- `moduleResolution: "node"`
- `esModuleInterop: true`
- `resolveJsonModule: true`
- `skipLibCheck: true`
- `strict: false`

Validation:

```bash
npx tsc --noEmit
```

Definition of done:

- `tsconfig.json` exists.
- TypeScript can scan the project without requiring immediate full conversion.

### Phase 2: Normalize the Module System

Purpose:
Reduce interop noise before renaming files to `.ts`.

Priority files:

- `src/config/db.js`
- `src/resolvers/index.js`
- `src/models/User.model.js`
- `src/models/Member.model.js`
- `src/models/Email.model.js`
- `src/models/Chat.model.js`
- `src/models/Messages.Model.js`

Actions:

1. Convert `module.exports` to ESM exports.
2. Keep behavior the same.
3. Avoid changing business logic during this phase.
4. Ensure imports stay consistent after export changes.

Validation:

```bash
npm run build
```

Definition of done:

- The source tree uses one export style consistently.
- There is no CommonJS left in `src/` unless a dependency forces it.

### Phase 3: Add Shared Types and Centralized Config

Purpose:
Create the type foundation that the rest of the app will rely on.

Add a `src/types/` directory with:

- `context.ts`
- `express.ts`
- `env.ts`
- `auth.ts`

Actions:

1. Define an `AppContext` type used by Apollo.
2. Define a request type that includes `rawBody`.
3. Define auth role types for Clerk-backed users.
4. Create a single env loader module.
5. Remove scattered `dotenv.config()` calls from feature modules.

Validation:

```bash
npx tsc --noEmit
```

Definition of done:

- The app has a single config source.
- Server startup code can depend on typed env/config values.
- Apollo context shape is explicit.

### Phase 4: Convert Core Infrastructure to TypeScript

Purpose:
Move the app entrypoint and service bootstrap to TypeScript first.

Convert these files first:

- `src/server.js`
- `src/config/db.js`
- `src/config/redis.js`
- `src/utils/checkVars.js`
- `src/utils/auth/auth.js`
- `src/stripe/config.js`

Actions:

1. Rename each target file from `.js` to `.ts`.
2. Fix imports after renames.
3. Type the Apollo context builder.
4. Type the Express request used in webhook handling.
5. Replace callback-style `mongoose.connect` usage with promise-based startup.

Validation:

```bash
npx tsc --noEmit
npm run dev
```

Definition of done:

- The server starts from TypeScript entrypoint code.
- DB, Redis, env validation, and auth bootstrap are typed.

### Phase 5: Convert Mongoose Models

Purpose:
Build typed data models before converting resolver-heavy business logic.

Suggested order:

1. `src/models/User.model.js`
2. `src/models/Member.model.js`
3. `src/models/Contract.model.js`
4. `src/models/Client.model.js`
5. `src/models/Products.model.js`
6. `src/models/Chat.model.js`
7. `src/models/Messages.Model.js`
8. `src/models/Email.model.js`

Actions:

1. Convert each model to `.ts`.
2. Use typed schemas and typed model exports.
3. Keep model names and collection names unchanged.
4. Consolidate exports in `src/models/index.ts`.

Validation:

```bash
npx tsc --noEmit
```

Definition of done:

- Models compile cleanly.
- Model imports are consistent.
- Resolver work can start without `any`-driven model usage.

### Phase 6: Convert Resolvers by Domain

Purpose:
Move business logic incrementally after context and model types exist.

Suggested order:

1. `src/resolvers/users.js`
2. `src/resolvers/members.resolver.js`
3. `src/resolvers/contracts.js`
4. `src/resolvers/products.js`
5. `src/resolvers/clients.js`
6. `src/resolvers/chat/chat.utils.js`
7. `src/resolvers/chat/chat.js`
8. `src/resolvers/index.js`

Actions:

1. Rename each resolver file to `.ts` one domain at a time.
2. Add typed `ctx` first.
3. Keep resolver args types light initially if schema-derived types do not exist yet.
4. Remove unsafe null assumptions where possible.
5. Preserve resolver return shapes.

Known repo issues to fix during this phase:

- `src/resolvers/users.js` duplicates `zipcode` during `createUser`.
- `src/resolvers/contracts.js` likely needs `new mongoose.Types.ObjectId(...)` for stricter Mongoose compatibility.

Validation:

```bash
npx tsc --noEmit
```

Definition of done:

- Resolver modules compile.
- The context shape is consistently used.
- No resolver depends on implicit `any` for core paths.

### Phase 7: Convert GraphQL Schema Files

Purpose:
Finish typing the GraphQL composition layer.

Convert:

- `src/models/schema/index.js`
- `src/models/schema/types/*.js`

Actions:

1. Rename schema composition files to `.ts`.
2. Preserve SDL content.
3. Type export composition where needed.
4. Avoid redesigning schema structure during migration.

Validation:

```bash
npx tsc --noEmit
```

Definition of done:

- Schema and resolver assembly compile under TypeScript.

### Phase 8: Convert Stripe, Redis Helpers, Email, and Utilities

Purpose:
Clean up the remaining supporting modules.

Targets:

- `src/stripe/stripeWebhookHandler.js`
- `src/stripe/stripe.service.js`
- `src/stripe/stripeSubscriptions.js`
- `src/utils/redis/stripeSubscritpitonCache.js`
- `src/utils/sendEmail.js`
- `src/utils/s3Service.js`
- `src/utils/ImageUpload.js`
- `src/utils/qrGenerator.js`

Actions:

1. Type the webhook request and response handling.
2. Type Stripe object usage conservatively.
3. Wrap Redis interactions in typed helper functions.
4. Type email/template payloads where practical.

Validation:

```bash
npx tsc --noEmit
```

Definition of done:

- Utility and service modules compile without broad type escapes.

### Phase 9: Convert Standalone Scripts

Purpose:
Finish migration with low-risk isolated files.

Targets:

- `src/scripts/deleteAll.js`
- `src/scripts/deleteUser.js`
- `src/scripts/generateDevToken.js`
- `src/scripts/removeSubscriptionId.js`
- `src/scripts/updateMemberModel.js`

Actions:

1. Rename scripts to `.ts`.
2. Update script npm commands.
3. Keep CLI behavior unchanged.

Validation:

```bash
npx tsc --noEmit
```

Definition of done:

- All script entrypoints run from TypeScript tooling.

### Phase 10: Remove Babel and Tighten Compiler Rules

Purpose:
Complete the migration and start extracting real TypeScript value.

Actions:

1. Remove Babel-based runtime/build scripts once unused.
2. Replace them with `tsx` and `tsc` only.
3. Turn on stricter compiler flags gradually.
4. Add at least smoke-level tests for startup and a few key resolver paths.

Recommended strictness order:

1. `noImplicitAny`
2. `strictNullChecks`
3. `noUncheckedIndexedAccess`
4. full `strict`

Definition of done:

- The app builds with `tsc`.
- The app runs with `tsx` in development.
- Babel is no longer required.

## Local LLM Workflow

Use your local model in small phases. Do not ask it to convert the full repo at once.

Best practices:

1. Give it one phase or one file cluster at a time.
2. Tell it to preserve behavior and avoid broad refactors.
3. Ask it to stop after code changes plus validation notes.
4. Run `npx tsc --noEmit` after each phase.
5. Commit between phases if you are using git checkpoints.

## Copyable Prompt Sequence

### Prompt 1: Tooling Setup

```text
Analyze this Node backend and add TypeScript tooling with minimal behavioral change.

Requirements:
- Do not change runtime behavior.
- Add tsconfig.json using allowJs=true and outDir=build.
- Add TypeScript dev/build scripts using tsx and tsc.
- Keep the current Babel scripts available unless they clearly become redundant.
- Do not rename source files yet.
- Show only the exact package.json and tsconfig changes.
```

### Prompt 2: Export Normalization

```text
Normalize the module system in src/ from CommonJS to ESM without changing logic.

Requirements:
- Convert module.exports patterns to ESM exports.
- Focus on src/config, src/models, and src/resolvers/index.js.
- Do not introduce TypeScript types yet.
- Do not refactor business logic.
- Stop after imports/exports are consistent.
```

### Prompt 3: Shared Types and Config

```text
Create the shared type foundation for this backend.

Requirements:
- Add src/types for AppContext, auth role types, env config, and Express rawBody request typing.
- Create a single env/config loader module.
- Remove scattered dotenv.config calls from feature modules.
- Do not convert resolvers yet.
- Preserve runtime behavior.
```

### Prompt 4: Infrastructure Conversion

```text
Convert the app bootstrap and infrastructure files to TypeScript.

Targets:
- src/server.js
- src/config/db.js
- src/config/redis.js
- src/utils/checkVars.js
- src/utils/auth/auth.js
- src/stripe/config.js

Requirements:
- Rename these files to .ts.
- Use the shared AppContext and Express request types.
- Preserve webhook behavior.
- Keep startup behavior unchanged unless a type-safe equivalent is required.
```

### Prompt 5: Mongoose Models

```text
Convert the Mongoose models in this repo to TypeScript one file at a time.

Requirements:
- Start with User, Member, Contract, and Client.
- Use typed schemas and typed model exports.
- Preserve model names and collection names.
- Update imports affected by the file renames.
- Do not change resolver logic in this step.
```

### Prompt 6: Resolver Migration

```text
Convert the GraphQL resolvers to TypeScript in this order: users, members, contracts, products, clients, chat.

Requirements:
- Type context first.
- Keep args typing lightweight if needed.
- Preserve resolver behavior.
- Fix obvious safety issues encountered during conversion.
- Call out any places where runtime assumptions are currently unsafe.
```

### Prompt 7: Schema Migration

```text
Convert the GraphQL schema/type definition files under src/models/schema to TypeScript.

Requirements:
- Preserve the existing SDL.
- Rename files to .ts.
- Keep schema composition behavior unchanged.
- Do not redesign schema organization.
```

### Prompt 8: Utilities and Integrations

```text
Convert the remaining utilities and integrations to TypeScript.

Targets:
- Stripe modules
- Redis helper modules
- sendEmail
- s3Service
- ImageUpload
- qrGenerator

Requirements:
- Preserve behavior.
- Add conservative types where third-party APIs are dynamic.
- Avoid broad refactors.
```

### Prompt 9: Scripts and Final Cleanup

```text
Finish the TypeScript migration for this backend.

Requirements:
- Convert the files under src/scripts to TypeScript.
- Remove Babel from the normal dev/build path if it is no longer needed.
- Ensure npm run build and npm run dev use TypeScript tooling.
- Summarize any remaining type debt.
- Recommend which strictness flags to enable next.
```

## Manual Review Checklist Per Phase

- `npx tsc --noEmit` passes or errors are understood.
- Imports resolve correctly after any rename.
- No new direct reads of `process.env` were added outside central config.
- No new CommonJS exports were introduced.
- Webhook raw body handling still works.
- Resolver context fields still match what the server injects.
- Mongoose collection names and model names did not change.

## Recommended First Implementation Step

If you want to start coding immediately, begin with Phase 1 only.

Do not rename files yet.
Do not touch resolver logic yet.
Get the TypeScript toolchain in place first.