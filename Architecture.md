# Architecture

## Overview

The Account Management API follows a **layered architecture** pattern, separating concerns across distinct layers. Each layer has a single responsibility and communicates only with the layer directly below it.

```
HTTP Request
     │
     ▼
┌─────────────┐
│   Routes    │  Defines endpoints, applies validation middleware, wires dependencies
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Controller  │  Parses request, calls service, sends HTTP response
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Service   │  Business logic — validation rules, error throwing, orchestration
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Repository  │  All SQL queries — no business logic, only data access
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │  Database — constraints, transactions, row locking
└─────────────┘
```

---

## Layer Responsibilities

### Routes (`account.routes.ts`)
- Declares HTTP method and path for each endpoint
- Applies Zod validation middleware before the controller is called
- Instantiates and wires repository → service → controller
- Contains Swagger JSDoc annotations for OpenAPI documentation

### Controller (`account.controller.ts`)
- Thin layer with no business logic
- Parses `req.params`, `req.body`, `req.query`
- Calls the appropriate service method
- Sends the HTTP response with the correct status code
- Passes all errors to the global error handler via `next(err)`

### Service (`account.service.ts`)
- The core of the application — all business rules live here
- Guards: checks account existence, active status, balance sufficiency, daily limits
- Throws `AppError` with semantic HTTP status codes on rule violations
- Coordinates multi-step operations (e.g. validate → update balance → insert transaction)

### Repository (`account.repository.ts`)
- All raw SQL queries — single source of truth for data access
- No business logic — purely maps function calls to SQL
- Manages `PoolClient` lifecycle for transactional operations
- Uses parameterised queries throughout to prevent SQL injection

---

## Database Schema

```
┌─────────────────────────┐       ┌──────────────────────────────────┐
│         persons         │       │             accounts             │
├─────────────────────────┤       ├──────────────────────────────────┤
│ person_id  SERIAL PK    │──────▶│ account_id   SERIAL PK           │
│ name       TEXT         │       │ person_id    INTEGER FK          │
│ document   TEXT UNIQUE  │       │ balance      NUMERIC(15,2)       │
│ birth_date DATE         │       │ daily_withdrawal_limit NUMERIC   │
└─────────────────────────┘       │ active_flag  BOOLEAN             │
                                  │ account_type INTEGER (1 or 2)    │
                                  │ create_date  DATE                │
                                  └────────────┬─────────────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────────────┐
                                  │          transactions            │
                                  ├──────────────────────────────────┤
                                  │ transaction_id  SERIAL PK        │
                                  │ account_id      INTEGER FK       │
                                  │ value           NUMERIC(15,2)    │
                                  │ transaction_date DATE            │
                                  └──────────────────────────────────┘
```

### Date Serialization
`create_date` and `transaction_date` are stored in PostgreSQL as `DATE` (no time component), but the API returns them as `YYYY-MM-DD` strings to avoid timezone-related day shifts when JSON-serializing.

### Design Decisions

**Signed transaction values** — deposits are stored as positive numbers, withdrawals as negative. This eliminates the need for a `type` column and makes balance recalculation a simple `SUM(value)`.

**No `balance` recomputation** — balance is maintained directly on the `accounts` table and updated atomically on each transaction. This avoids expensive full-table scans on the transactions table for balance queries.

**DB-level constraints** — business rules are enforced at both the application layer (service) and the database layer (CHECK constraints), providing a safety net against any bypass.

---

## Resilience & Failure Points

### Concurrent Transactions (Race Condition Prevention)

Deposit and withdrawal operations acquire a row-level lock using `SELECT FOR UPDATE` inside a PostgreSQL transaction:

```
BEGIN
  SELECT * FROM accounts WHERE account_id = $1 FOR UPDATE  ← locks the row
  -- validate business rules
  UPDATE accounts SET balance = ...
  INSERT INTO transactions ...
COMMIT
```

This ensures that two simultaneous withdrawals cannot both pass the balance check and overdraw the account.

### Error Handling Strategy

```
AppError (operational)     → known business error → correct HTTP status (403/404/409/422)
ZodError (validation)      → bad input            → 400 with field-level detail
Unknown Error (unexpected) → bug / crash          → 500, internals never leaked
```

All three paths are handled centrally in `errorHandler.ts` — controllers never send error responses directly.

### Daily Withdrawal Limit

On every withdrawal, the service queries the sum of all negative transaction values for the current day before approving the operation:

```sql
SELECT COALESCE(SUM(value), 0) AS total
FROM transactions
WHERE account_id = $1
  AND value < 0
  AND transaction_date = CURRENT_DATE
```

This check runs inside the same `SELECT FOR UPDATE` transaction, making it safe under concurrent load.

---

## Request Lifecycle

```
POST /api/accounts/1/withdraw  { "value": 200 }

0. Global middlewares run: `helmet()`, `requestId` (X-Request-Id), `logger` (morgan), `generalLimiter`, `express.json()`
1. Routes apply `transactionLimiter` (withdraw/deposit) (noop in tests)
2. Zod validates params/body → rejects with 400 if invalid
3. Controller extracts accountId and value → calls service.withdraw()
4. Service acquires DB client → BEGIN transaction
5. SELECT FOR UPDATE → locks account row
6. Checks: account exists? active? sufficient funds? within daily limit?
7. UPDATE balance, INSERT transaction → COMMIT
8. Controller receives transaction → responds 201
9. On any error → ROLLBACK → next(err) → errorHandler → correct HTTP response
```

---

## Testing Strategy

Integration tests use **Supertest** to fire real HTTP requests against the Express app, hitting a dedicated test PostgreSQL database (port `5433`).

Each test is fully isolated:
- `beforeEach` truncates all tables and resets sequences
- `seedAccount()` helper creates a fresh person + account per test
- No mocking — tests exercise the full stack from HTTP to DB

**Coverage:** 31 tests across all 6 endpoints covering happy paths, all business rule violations, validation errors, and edge cases.