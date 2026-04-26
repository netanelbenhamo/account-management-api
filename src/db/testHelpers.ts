import { pool } from '../config/db';

/**
 * Wipes all tables in reverse dependency order between tests.
 * Safe to call in beforeEach — keeps tests fully isolated.
 */
export const clearDatabase = async (): Promise<void> => {
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM accounts');
  await pool.query('DELETE FROM persons');
  // Reset sequences so IDs are predictable across test runs
  await pool.query('ALTER SEQUENCE persons_person_id_seq RESTART WITH 1');
  await pool.query('ALTER SEQUENCE accounts_account_id_seq RESTART WITH 1');
  await pool.query('ALTER SEQUENCE transactions_transaction_id_seq RESTART WITH 1');
};

/**
 * Seeds a person and account for use in tests.
 * Returns the created IDs.
 */
export const seedAccount = async (overrides: {
  balance?: number;
  daily_withdrawal_limit?: number;
  active_flag?: boolean;
  account_type?: number;
} = {}): Promise<{ person_id: number; account_id: number }> => {
  const { rows: personRows } = await pool.query(
    `INSERT INTO persons (name, document, birth_date)
     VALUES ('Test User', '999999999', '1990-01-01')
     RETURNING person_id`
  );
  const person_id = personRows[0].person_id;

  const { rows: accountRows } = await pool.query(
    `INSERT INTO accounts (person_id, balance, daily_withdrawal_limit, active_flag, account_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING account_id`,
    [
      person_id,
      overrides.balance ?? 1000,
      overrides.daily_withdrawal_limit ?? 500,
      overrides.active_flag ?? true,
      overrides.account_type ?? 1,
    ]
  );
  const account_id = accountRows[0].account_id;

  return { person_id, account_id };
};

/**
 * Closes the pool — call in afterAll to avoid Jest open handle warnings.
 */
export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};