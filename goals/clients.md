# Goal: Refactor Client Resolvers into Service–Repository Pattern

Parent rules: [../GOAL.md](../GOAL.md)

## Current state

`src/resolvers/clients.js` imports `MemberModel`, `ClientModel`, `ContractModel`, and `EmailModel` (unused) directly. Field resolvers fetch entire collections and filter in JS.

## Files to create

### 1. `src/clients/client.repository.js`

Only file touching Mongoose in this domain. Export `clientRepository` with at least:

- `findAll()`
- `findByEmail(email)` — `findOne`
- `findById(id)`
- `create(data)`
- `save(doc)`
- `findMembersByClient(clientId)` — query the members collection with `{ clients: clientId }` (DB-level filter; may live here or in member repository — pick one owner, do not duplicate)
- `findContractsByClient(clientId)` — `{ client: clientId }` DB-level filter

### 2. `src/clients/client.service.js`

Export `clientService`. Move here:

- `getClients()` / `getClientByEmail(email)` (domain error `CLIENT_NOT_FOUND`)
- `createClient(input)` — verify member exists via `memberRepository.findById` (domain error `MEMBER_NOT_FOUND`), build defaults (`isActive: true`, `members: [memberId]`), persist, append client id to the member's `clients` array
- `updateClient(id, updates)` — domain error `CLIENT_NOT_FOUND`
- `getMembersForClient(parentId)` / `getContractsForClient(parentId)` — delegate to repository filtered queries

### 3. Rewrite `src/resolvers/clients.js`

Keep exported shape `{ Query, Mutation, Client }`. Remove the commented-out `createEmail` block and the unused `EmailModel` import entirely.

## Bugs to fix while refactoring

1. `Client.members` fetches **all** members then filters by `clients.includes(parent.id)` → replace with a DB-level `{ clients: parentId }` query.
2. `Client.contracts` fetches **all** contracts then filters in JS → replace with a DB-level `{ client: parentId }` query.
3. `createClient` catch-all rethrows as `new Error(e)`, which swallows the `UserInputError('Member does not exist.')` translation — preserve Apollo error semantics from the resolver layer.

## Acceptance criteria

1. Zero Mongoose model imports in `src/resolvers/clients.js`.
2. Zero `apollo-server*` imports in `src/clients/*`.
3. No fetch-all-then-filter patterns remain anywhere in this domain.
4. All resolver names and return shapes unchanged; unused code removed.
5. `node --check` passes on all touched files; app boots.
