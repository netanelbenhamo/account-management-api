import Decimal from 'decimal.js';
import { PoolClient } from 'pg';
import { AppError } from '../../utils/AppError';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { AccountRepository } from './account.repository';
import { Account, CreateAccountInput, PaginatedResult, Transaction } from './account.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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
      balance: new Decimal(account.balance).toNumber(),
    };
  }

  async deposit(accountId: number, value: number): Promise<Transaction> {
    return this.executeAccountTransaction(accountId, async (client, account) => {
      const newBalance = new Decimal(account.balance).plus(value).toNumber();
      await this.repo.updateBalance(client, accountId, newBalance);
      return this.repo.insertTransaction(client, accountId, value);
    });
  }

  async withdraw(accountId: number, value: number): Promise<Transaction> {
    return this.executeAccountTransaction(accountId, async (client, account) => {
      const currentBalance = new Decimal(account.balance);
      this.ensureSufficientFunds(value, currentBalance);
      await this.ensureDailyWithdrawalLimit(client, accountId, value, account);

      const newBalance = currentBalance.minus(value).toNumber();
      await this.repo.updateBalance(client, accountId, newBalance);
      return this.repo.insertTransaction(client, accountId, new Decimal(value).negated().toNumber());
    });
  }

  async blockAccount(accountId: number): Promise<Account> {
    const account = await this.getAccountOrThrow(accountId);
    if (!account.active_flag) {
      throw new AppError('Account is already blocked', HTTP_STATUS.CONFLICT);
    }
    const blocked = await this.repo.block(accountId);
    return blocked!;
  }

  async getStatement(
    accountId: number,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
    from?: string,
    to?: string
  ): Promise<PaginatedResult<Transaction>> {
    await this.getAccountOrThrow(accountId);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

    const { rows, total } = await this.repo.getStatement(accountId, safePage, safeLimit, from, to);

    return {
      data: rows,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
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

  private ensureSufficientFunds(withdrawValue: number, currentBalance: Decimal): void {
    if (new Decimal(withdrawValue).greaterThan(currentBalance)) {
      throw new AppError('Insufficient funds', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
  }

  private async ensureDailyWithdrawalLimit(
    client: PoolClient,
    accountId: number,
    value: number,
    account: Account
  ): Promise<void> {
    const dailyLimit = new Decimal(account.daily_withdrawal_limit);
    const todayWithdrawals = new Decimal(await this.repo.getTodayWithdrawals(client, accountId));

    if (todayWithdrawals.plus(value).greaterThan(dailyLimit)) {
      throw new AppError(
        `Daily withdrawal limit of ${dailyLimit} exceeded. ` +
          `Already withdrawn: ${todayWithdrawals}, requested: ${value}`,
        HTTP_STATUS.UNPROCESSABLE_ENTITY
      );
    }
  }
}