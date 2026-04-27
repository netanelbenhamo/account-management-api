import { AppError } from '../../utils/AppError';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { AccountRepository } from './account.repository';
import { Account, CreateAccountInput, Transaction } from './account.types';

export class AccountService {
  constructor(private readonly repo: AccountRepository) {}

  async createAccount(input: CreateAccountInput): Promise<Account> {
    const person = await this.repo.findPersonById(input.person_id);
    if (!person) throw new AppError('Person not found', HTTP_STATUS.NOT_FOUND);
    return this.repo.create(input);
  }

  async getBalance(accountId: number): Promise<{ account_id: number; balance: number }> {
    const account = await this.repo.findById(accountId);
    if (!account) throw new AppError('Account not found', HTTP_STATUS.NOT_FOUND);

    return {
      account_id: account.account_id,
      balance: parseFloat(account.balance),
    };
  }

  async deposit(accountId: number, value: number): Promise<Transaction> {
    const client = await this.repo.getClient();

    try {
      await client.query('BEGIN');

      // Lock the row to prevent race conditions
      const { rows } = await client.query<Account>(
        'SELECT * FROM accounts WHERE account_id = $1 FOR UPDATE',
        [accountId]
      );
      const account = rows[0];

      if (!account) throw new AppError('Account not found', HTTP_STATUS.NOT_FOUND);
      if (!account.active_flag) throw new AppError('Account is blocked', HTTP_STATUS.FORBIDDEN);

      const newBalance = parseFloat(account.balance) + value;
      await this.repo.updateBalance(client, accountId, newBalance);
      const transaction = await this.repo.insertTransaction(client, accountId, value);

      await client.query('COMMIT');
      return transaction;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async withdraw(accountId: number, value: number): Promise<Transaction> {
    const client = await this.repo.getClient();

    try {
      await client.query('BEGIN');

      // Lock the row to prevent race conditions
      const { rows } = await client.query<Account>(
        'SELECT * FROM accounts WHERE account_id = $1 FOR UPDATE',
        [accountId]
      );
      const account = rows[0];

      if (!account) throw new AppError('Account not found', HTTP_STATUS.NOT_FOUND);
      if (!account.active_flag) throw new AppError('Account is blocked', HTTP_STATUS.FORBIDDEN);

      const currentBalance = parseFloat(account.balance);
      const dailyLimit = parseFloat(account.daily_withdrawal_limit);

      // Check sufficient funds
      if (value > currentBalance) {
        throw new AppError('Insufficient funds', HTTP_STATUS.UNPROCESSABLE_ENTITY);
      }

      // Check daily withdrawal limit
      const todayWithdrawals = await this.repo.getTodayWithdrawals(client, accountId);
      if (todayWithdrawals + value > dailyLimit) {
        throw new AppError(
          `Daily withdrawal limit of ${dailyLimit} exceeded. ` +
            `Already withdrawn: ${todayWithdrawals}, requested: ${value}`,
          HTTP_STATUS.UNPROCESSABLE_ENTITY
        );
      }

      const newBalance = currentBalance - value;
      await this.repo.updateBalance(client, accountId, newBalance);

      // Store as negative value to indicate withdrawal
      const transaction = await this.repo.insertTransaction(client, accountId, -value);

      await client.query('COMMIT');
      return transaction;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async blockAccount(accountId: number): Promise<Account> {
    const account = await this.repo.findById(accountId);
    if (!account) throw new AppError('Account not found', HTTP_STATUS.NOT_FOUND);
    if (!account.active_flag) throw new AppError('Account is already blocked', HTTP_STATUS.CONFLICT);

    const blocked = await this.repo.block(accountId);
    return blocked!;
  }

  async getStatement(
    accountId: number,
    from?: string,
    to?: string
  ): Promise<Transaction[]> {
    const account = await this.repo.findById(accountId);
    if (!account) throw new AppError('Account not found', HTTP_STATUS.NOT_FOUND);

    return this.repo.getStatement(accountId, from, to);
  }
}