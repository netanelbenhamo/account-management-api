# Account Management API

A RESTful API for managing bank accounts — built with **Node.js**, **TypeScript**, **Express**, and **PostgreSQL**.

Supports account creation, deposits, withdrawals, balance inquiries, account blocking, and transaction history with optional date filtering.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the API](#running-the-api)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
- [Business Rules](#business-rules)
- [Project Structure](#project-structure)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL 15 |
| DB Driver | `pg` (raw SQL) |
| Validation | Zod |
| Documentation | Swagger / OpenAPI 3.0 |
| Testing | Jest + Supertest |
| Containerization | Docker + Docker Compose |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- npm v9+

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/netanelbenhamo/account-management-api.git
cd account-management-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your preferred values (defaults work out of the box):

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=account_management
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

For the test database, create `.env.test`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=account_management
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

> Note: `DB_NAME` in `.env.test` does **not** include `_test` — the app appends it automatically when `NODE_ENV=test`.

### 4. Start the database containers

```bash
docker-compose up -d
```

This spins up two PostgreSQL containers:
- **Dev DB** on port `5432`
- **Test DB** on port `5433`

### 5. Run database migrations and seed

```bash
# Dev database (includes seed data)
npm run migrate:seed

# Test database (no seed needed)
npm run migrate:test
```

The seed creates one person and one account with a $1,000.00 balance and $500.00 daily withdrawal limit.

### 6. Start the server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.  
Swagger UI docs at `http://localhost:3000/docs`.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_NAME` | PostgreSQL database name | `account_management` |
| `DB_POOL_MAX` | Max pg pool connections | `20` |
| `DB_IDLE_TIMEOUT` | Idle client timeout (ms) | `30000` |
| `DB_CONNECTION_TIMEOUT` | Connection timeout (ms) | `2000` |

---

## Running the API

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |

---

## Running Tests

Make sure Docker is running and the test DB migration has been applied:

```bash
npm run migrate:test
npm test
```

Tests run against the isolated test database on port `5433`. Each test clears all data before running to ensure full isolation.

Notes for test output and middleware:
- `NODE_ENV=test` disables request logging (see `src/middleware/logger.ts`) to keep Jest output clean.
- Rate limiting is disabled in tests (see `src/middleware/rateLimiter.ts`) so integration tests aren't blocked by request quotas.
- Request IDs are supported; if you pass `X-Request-Id`, the logger will include it.

```bash
npm run test:watch   # watch mode
```

---

## API Reference

Full interactive docs available at `http://localhost:3000/docs` (Swagger UI).

### Base URL

```
http://localhost:3000/api
```

### Endpoints

#### Create Account
```
POST /api/accounts
```
```json
{
  "person_id": 1,
  "daily_withdrawal_limit": 500.00,
  "account_type": 1,
  "initial_balance": 1000.00
}
```
> `account_type`: `1` = Checking, `2` = Savings

---

#### Get Balance
```
GET /api/accounts/:id/balance
```

---

#### Deposit
```
POST /api/accounts/:id/deposit
```
```json
{
  "value": 200.00
}
```

---

#### Withdraw
```
POST /api/accounts/:id/withdraw
```
```json
{
  "value": 150.00
}
```

---

#### Block Account
```
PATCH /api/accounts/:id/block
```

---

#### Get Statement
```
GET /api/accounts/:id/statement
GET /api/accounts/:id/statement?from=2026-01-01&to=2026-12-31
```

| Query Param | Format | Description |
|-------------|--------|-------------|
| `from` | `YYYY-MM-DD` | Start date (inclusive) |
| `to` | `YYYY-MM-DD` | End date (inclusive) |
| `page` | integer | Page number (default `1`) |
| `limit` | integer | Results per page (default `20`, max `100`) |

---

### Response Format

All responses follow a consistent envelope:

```json
{
  "status": "success",
  "data": { ... }
}
```

Errors:

```json
{
  "status": "error",
  "message": "Insufficient funds"
}
```

Validation errors:

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    { "field": "value", "message": "Deposit value must be greater than 0" }
  ]
}
```

Date fields:
- `create_date` and `transaction_date` are returned as `YYYY-MM-DD` strings (to avoid timezone-related day shifts).

---

## Business Rules

| Rule | Behaviour |
|------|-----------|
| Blocked account | Any transaction on a blocked account returns `403` |
| Insufficient funds | Withdrawal exceeding balance returns `422` |
| Daily withdrawal limit | Sum of all withdrawals today cannot exceed `daily_withdrawal_limit` — returns `422` if exceeded |
| Already blocked | Blocking an already blocked account returns `409` |
| Concurrent transactions | Handled via `SELECT FOR UPDATE` inside a DB transaction to prevent race conditions |
| Transaction values | Deposits stored as positive values, withdrawals as negative |
| Account type | Must be `1` (Checking) or `2` (Savings) — enforced at both API and DB level |

---

## Project Structure

```
src/
├── config/
│   ├── db.ts                  # PostgreSQL pool
│   └── testEnv.ts             # Sets NODE_ENV=test for Jest
├── constants/
│   └── httpStatus.ts          # http status consts
├── db/
│   ├── migrate.ts             # Migration runner
│   ├── testHelpers.ts         # Test DB utilities
│   └── migrations/
│       ├── 001_create_persons.sql
│       ├── 002_create_accounts.sql
│       ├── 003_create_transactions.sql
│       ├── 004_add_indexes.sql
│       └── seed.sql
├── middleware/
│   ├── errorHandler.ts        # Global error handler
│   ├── logger.ts              # HTTP request logging (morgan)
│   ├── rateLimiter.ts         # express-rate-limit (noop in tests)
│   ├── requestId.ts           # Ensures X-Request-Id exists
│   └── validate.ts           # Zod validation middleware
├── modules/
│   └── accounts/
│       ├── account.types.ts
│       ├── account.schemas.ts
│       ├── account.repository.ts
│       ├── account.service.ts
│       ├── account.controller.ts
│       ├── account.routes.ts
│       └── account.test.ts
├── utils/
│   └── AppError.ts            # Custom error class
├── app.ts                     # Express app setup
└── server.ts                  # HTTP entry point
```