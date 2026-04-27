import { AppError } from '../../utils/AppError';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { PoolClient } from 'pg';
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
    const account = await this.getAccountOrThrow(accountId);

    return {
      account_id: account.account_id,
      balance: parseFloat(account.balance),
    };
  }

  async deposit(accountId: number, value: number): Promise<Transaction> {
    return this.executeAccountTransaction(accountId, async (client, account) => {
      const newBalance = parseFloat(account.balance) + value;
      await this.repo.updateBalance(client, accountId, newBalance);
      return this.repo.insertTransaction(client, accountId, value);
    });
  }

  async withdraw(accountId: number, value: number): Promise<Transaction> {
    return this.executeAccountTransaction(accountId, async (client, account) => {
      const currentBalance = parseFloat(account.balance);
      this.ensureSufficientFunds(value, currentBalance);
      await this.ensureDailyWithdrawalLimit(client, accountId, value, account);

      const newBalance = currentBalance - value;
      await this.repo.updateBalance(client, accountId, newBalance);
      return this.repo.insertTransaction(client, accountId, -value);
    });
  }

  async blockAccount(accountId: number): Promise<Account> {
    const account = await this.getAccountOrThrow(accountId);
    if (!account.active_flag) throw new AppError('Account is already blocked', HTTP_STATUS.CONFLICT);

    const blocked = await this.repo.block(accountId);
    return blocked!;
  }

  async getStatement(
    accountId: number,
    from?: string,
    to?: string
  ): Promise<Transaction[]> {
    await this.getAccountOrThrow(accountId);

    return this.repo.getStatement(accountId, from, to);
  }

  private async getAccountOrThrow(accountId: number): Promise<Account> {
    const account = await this.repo.findById(accountId);
    if (!account) throw new AppError('Account not found', HTTP_STATUS.NOT_FOUND);
    return account;
  }

  private async executeAccountTransaction(
    accountId: number,
    operation: (client: PoolClient, account: Account) => Promise<Transaction>
  ): Promise<Transaction> {
    const client = await this.repo.getClient();

    try {
      await client.query('BEGIN');
      const account = await this.getLockedAccount(client, accountId);
      this.ensureAccountIsActive(account);

      const result = await operation(client, account);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async getLockedAccount(client: PoolClient, accountId: number): Promise<Account> {
    const { rows } = await client.query<Account>(
      'SELECT * FROM accounts WHERE account_id = $1 FOR UPDATE',
      [accountId]
    );
    const account = rows[0];
    if (!account) throw new AppError('Account not found', HTTP_STATUS.NOT_FOUND);
    return account;
  }

  private ensureAccountIsActive(account: Account): void {
    if (!account.active_flag) {
      throw new AppError('Account is blocked', HTTP_STATUS.FORBIDDEN);
    }
  }

  private ensureSufficientFunds(withdrawValue: number, currentBalance: number): void {
    if (withdrawValue > currentBalance) {
      throw new AppError('Insufficient funds', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
  }

  private async ensureDailyWithdrawalLimit(
    client: PoolClient,
    accountId: number,
    value: number,
    account: Account
  ): Promise<void> {
    const dailyLimit = parseFloat(account.daily_withdrawal_limit);
    const todayWithdrawals = await this.repo.getTodayWithdrawals(client, accountId);

    if (todayWithdrawals + value > dailyLimit) {
      throw new AppError(
        `Daily withdrawal limit of ${dailyLimit} exceeded. ` +
          `Already withdrawn: ${todayWithdrawals}, requested: ${value}`,
        HTTP_STATUS.UNPROCESSABLE_ENTITY
      );
    }
  }
}