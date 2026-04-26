import { Pool, PoolClient } from 'pg';
import { Account, CreateAccountInput, Transaction } from './account.types';

export class AccountRepository {
  constructor(private readonly pool: Pool) {}

  async findById(accountId: number): Promise<Account | null> {
    const { rows } = await this.pool.query<Account>(
      'SELECT * FROM accounts WHERE account_id = $1',
      [accountId]
    );
    return rows[0] ?? null;
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const { rows } = await this.pool.query<Account>(
      `INSERT INTO accounts (person_id, balance, daily_withdrawal_limit, active_flag, account_type)
       VALUES ($1, $2, $3, true, $4)
       RETURNING *`,
      [
        input.person_id,
        input.initial_balance ?? 0,
        input.daily_withdrawal_limit,
        input.account_type,
      ]
    );
    return rows[0];
  }

  async updateBalance(
    client: PoolClient,
    accountId: number,
    newBalance: number
  ): Promise<void> {
    await client.query('UPDATE accounts SET balance = $1 WHERE account_id = $2', [
      newBalance,
      accountId,
    ]);
  }

  async block(accountId: number): Promise<Account | null> {
    const { rows } = await this.pool.query<Account>(
      'UPDATE accounts SET active_flag = false WHERE account_id = $1 RETURNING *',
      [accountId]
    );
    return rows[0] ?? null;
  }

  // Sum of all withdrawals (negative values) made today for this account
  async getTodayWithdrawals(client: PoolClient, accountId: number): Promise<number> {
    const { rows } = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(value), 0) AS total
       FROM transactions
       WHERE account_id = $1
         AND value < 0
         AND transaction_date = CURRENT_DATE`,
      [accountId]
    );
    return Math.abs(parseFloat(rows[0].total));
  }

  async insertTransaction(
    client: PoolClient,
    accountId: number,
    value: number
  ): Promise<Transaction> {
    const { rows } = await client.query<Transaction>(
      `INSERT INTO transactions (account_id, value)
       VALUES ($1, $2)
       RETURNING *`,
      [accountId, value]
    );
    return rows[0];
  }

  async getStatement(
    accountId: number,
    from?: string,
    to?: string
  ): Promise<Transaction[]> {
    const conditions: string[] = ['account_id = $1'];
    const params: (number | string)[] = [accountId];

    if (from) {
      params.push(from);
      conditions.push(`transaction_date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`transaction_date <= $${params.length}`);
    }

    const { rows } = await this.pool.query<Transaction>(
      `SELECT * FROM transactions
       WHERE ${conditions.join(' AND ')}
       ORDER BY transaction_date DESC, transaction_id DESC`,
      params
    );
    return rows;
  }

  // Expose pool.connect() for transactions that need a client
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}