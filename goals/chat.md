# Goal: Refactor Chat & Message Resolvers into Service–Repository Pattern

Parent rules: [../GOAL.md](../GOAL.md)

## Current state

`src/resolvers/chat/chat.js` imports `MessageModel`, `UserModel`, `MemberModel`, `ChatModel`, `ContractModel`, `stripe.service`, `stripe/config`, and `pubsub` directly. It duplicates the price-proposal flow from `contracts.js`.

## Files to create

Directory: `src/chat/`

### 1. `src/chat/chat.repository.js`

Only file touching Mongoose for chats/messages in this domain. Export `chatRepository` with at least:

- Chats: `findById(id)`, `create(data)`, `updateById(id, updates)`, `save(doc)`
- Messages: `findAll()`, `findByChatId(chatId)` (sorted by `createdAt` asc), `findPendingProposals(chatId)`, `create(data)`

Cross-domain reads (user/member/contract) go through `userRepository` / `memberRepository` / `contractRepository` — do **not** import those models here.

### 2. `src/chat/chat.service.js`

Export `chatService`. Move here:

- `getMessages()` — keep the existing `_doc → API shape` mapping (`type || "TEXT"`, `new Date(createdAt)`)
- `getChatById(chatId)`
- `createChat(memberId, input)`
- `createMessage(senderId, input, publish)` — chat-existence guard (domain error `CHAT_NOT_FOUND`), PRICE_PROPOSAL metadata handling, push message id onto the chat
- `proposePriceInChat(memberId, stripeConnectAccountId, contractId, price)` — ownership + chat-existence guards via `contractRepository`, supersede previous pending proposals (+ expire Stripe sessions via `stripe/config`), create proposal message
- Field-resolver helpers: `getMessagesForChat(chatId)`, `getUserForChat(userId)` / `getMemberForChat(memberId)` delegating to the owning repositories

**pubsub:** publishing is side-effectful messaging, not DB access — either inject a `publish` callback from the resolver into service methods (preferred, keeps services framework-free and testable) or accept pubsub usage in the service as an explicitly documented exception. Pick one approach and use it consistently.

### 3. Rewrite `src/resolvers/chat/chat.js`

Keep exported shape `{ Query, Mutation, Chat, Subscription }`. Subscriptions stay thin in the resolver (pubsub asyncIterator wiring is transport concern). Resolvers do ctx/auth guards, call the service, translate domain errors.

## Bugs to fix while refactoring

1. **`createMessage` throws `UserInputError` without importing it** — currently a `ReferenceError` at runtime when a chat doesn't exist. Resolver must import it from `apollo-server-core` and translate the `CHAT_NOT_FOUND` domain error.
2. Price-proposal logic duplicated between `contracts.js::createContractPrice`/`proposePriceInChat` and this file — after both domains are refactored, consolidate into one shared service method (coordinate with [contracts.md](contracts.md)).
3. `messages` Query returns every message in the collection unpaginated — preserve behavior for now but note it; do not change the schema.

## Acceptance criteria

1. Zero Mongoose model imports and zero `apollo-server*` imports outside error translation in `src/resolvers/chat/chat.js`.
2. Zero `apollo-server*` imports in `src/chat/*`.
3. All resolver names, subscription trigger names, and return shapes unchanged.
4. The `ReferenceError` bug above is fixed.
5. `node --check` passes on all touched files; app boots.
