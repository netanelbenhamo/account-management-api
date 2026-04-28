export enum AccountType {
  Checking = 1,
  Savings = 2,
}

export interface Person {
  person_id: number;
  name: string;
  document: string;
  birth_date: Date;
}

export interface Account {
  account_id: number;
  person_id: number;
  balance: string;
  daily_withdrawal_limit: string;
  active_flag: boolean;
  account_type: AccountType;
  create_date: Date;
}

export interface Transaction {
  transaction_id: number;
  account_id: number;
  value: string;
  transaction_date: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── Request payloads ──────────────────────────────────────────────────────────

export interface CreateAccountInput {
  person_id: number;
  daily_withdrawal_limit: number;
  account_type: AccountType;
  initial_balance?: number;
}

export interface DepositInput {
  value: number;
}

export interface WithdrawInput {
  value: number;
}

export interface StatementQuery {
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}