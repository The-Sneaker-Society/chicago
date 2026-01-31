# Chicago Project - Local Development Setup

This guide will help you set up the Chicago project for local development.

## Prerequisites
- **Node.js 18.x** (required)
- **npm** (comes with Node.js)
- **MongoDB Atlas** account or local MongoDB instance
- **Redis** (local or cloud instance)
- **Stripe** account (for payment features)
- **Clerk** account (for authentication)

## 1. Clone the Repository

```
git clone https://github.com/The-Sneaker-Society/chicago.git
cd chicago
```

## 2. Install Dependencies

```
npm install
```

## 3. Environment Variables

Copy the example environment file and update values as needed:

```
cp config.env.example config.env
```

Edit `config.env` with your credentials:
- **MongoDB**: `ATLAS_URI`
- **Frontend URL**: `REACT_APP_URL`
- **Email**: `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_SERVICE`
- **Clerk**: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **Redis**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_URL`
- **Stripe**: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MEMBER_SUBSCRIPTION_ID`

### 3.1 Redis Local Setup (Homebrew)

This project uses Homebrew for local Redis during development. Install and start Redis with:

```bash
brew install redis
# start as a background service
brew services start redis
# or run in foreground for a single session
redis-server
```

Verify Redis is running:

```bash
redis-cli ping
# should return: PONG
```

Environment variable hints (already present in `config.env`):

- `REDIS_HOST` — defaults to `127.0.0.1` for local Redis
- `REDIS_PORT` — defaults to `6379`
- `REDIS_URL` — optional, e.g. `redis://localhost:6379`

If your Redis instance is remote (e.g., Redis Cloud), set `REDIS_URL` accordingly and leave `REDIS_HOST`/`REDIS_PORT` empty.

## 4. Build the Project

```
npm run build
```

## 5. Running the Server

### Development Mode (with auto-reload):
```
npm run dev
```

### Production Mode:
```
npm start
```

### Development with Stripe Webhook Forwarding:
```
npm run dev-with-stripe
```

## 6. Useful Scripts
- `npm run generate-dev-token` — Generate a development token
- `npm run update-member` — Update member model
- `npm run delete-member` — Delete a user
- `npm run remove-field` — Remove subscription ID field

## 7. Testing
No tests are currently specified. You can add your own in the `test` directory.

## 8. Linting & Audit
- `npm run audit` — Run npm audit for vulnerabilities

## 9. Additional Notes
- The main server entry point is `src/server.js` (development) and `build/server.js` (production).
- Email templates are in `src/emails/`.
- GraphQL schema and resolvers are in `src/models/schema/` and `src/resolvers/`.

---

For more information, see the [GitHub repository](https://github.com/The-Sneaker-Society/chicago).
