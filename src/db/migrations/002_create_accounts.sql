CREATE TABLE IF NOT EXISTS accounts (
  account_id              SERIAL PRIMARY KEY,
  person_id               INTEGER        NOT NULL REFERENCES persons(person_id),
  balance                 NUMERIC(15,2)  NOT NULL DEFAULT 0,
  daily_withdrawal_limit  NUMERIC(15,2)  NOT NULL,
  active_flag             BOOLEAN        NOT NULL DEFAULT true,
  account_type            INTEGER        NOT NULL,
  create_date             DATE           NOT NULL DEFAULT CURRENT_DATE,

  CONSTRAINT chk_account_type   CHECK (account_type IN (1, 2)),
  CONSTRAINT chk_balance        CHECK (balance >= 0),
  CONSTRAINT chk_daily_limit    CHECK (daily_withdrawal_limit > 0)
);