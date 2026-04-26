CREATE TABLE IF NOT EXISTS transactions (
  transaction_id    SERIAL PRIMARY KEY,
  account_id        INTEGER        NOT NULL REFERENCES accounts(account_id),
  value             NUMERIC(15,2)  NOT NULL, -- positive = deposit, negative = withdrawal
  transaction_date  DATE           NOT NULL DEFAULT CURRENT_DATE,

  CONSTRAINT chk_value_not_zero CHECK (value <> 0)
);