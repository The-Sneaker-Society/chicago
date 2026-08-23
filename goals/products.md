# Goal: Refactor Product Resolvers into Service–Repository Pattern

Parent rules: [../GOAL.md](../GOAL.md)

## Current state

`src/resolvers/products.js` imports `ProductsModel` directly and calls `stripe.service` from resolvers. Smallest Stripe-coupled domain.

## Files to create

### 1. `src/products/product.repository.js`

Only file touching Mongoose in this domain. Export `productRepository` with at least:

- `findAll()`
- `findById(id)`
- `create(data)`
- `findByMemberId(memberId)` — `{ member: memberId }`
- `deleteById(id)` — return the deleted doc (or null)

### 2. `src/products/product.service.js`

Export `productService`. Move here:

- `getProducts()` / `getProductById(id)`
- `createProduct(ctxMemberId, { name, price, description })` — call `createStripeProduct`, then persist with `stripeProductId`/`stripePriceId`
- `deleteProductById(id)` — fetch, archive the Stripe product only if found, delete
- `createPaymentLink(productId, stripeConnectAccountId)` — product lookup + `createPaymentSessionLink`
- Field-resolver-style helper: `getProductsForMember(memberId)`

Stripe calls stay inside this service (rule 5 of parent).

### 3. Rewrite `src/resolvers/products.js`

Keep exported shape `{ Query, Mutation }` and all resolver names.

## Bugs to fix while refactoring

1. `deleteProductById` dereferences `dbProduct.stripeProductId` **without a null check** — crashes with an unhelpful TypeError if the id doesn't exist. Guard and translate to a domain error (`PRODUCT_NOT_FOUND`) → resolver rethrows as appropriate.
2. `createProductPaymentLink` doesn't check `foundProduct` for null → same guard + domain error.
3. `createProduct` uses `ctx._id` while other domains use `ctx.dbUser._id` — align the id source and document which is used.

## Acceptance criteria

1. Zero Mongoose model imports in `src/resolvers/products.js`.
2. Zero `apollo-server*` imports in `src/products/*`; zero direct Stripe imports there too.
3. Bugs 1–3 fixed; null guards present.
4. All resolver names and return shapes unchanged.
5. `node --check` passes on all touched files; app boots.
