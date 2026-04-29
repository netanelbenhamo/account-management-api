-- Speed up all transaction queries filtered by account
CREATE INDEX IF NOT EXISTS idx_transactions_account_id
  ON transactions(account_id);

-- Speed up statement queries filtered by account + date range
CREATE INDEX IF NOT EXISTS idx_transactions_account_date
  ON transactions(account_id, transaction_date);

-- Speed up daily withdrawal limit check (account + negative values + today)
CREATE INDEX IF NOT EXISTS idx_transactions_account_date_value
  ON transactions(account_id, transaction_date, value);