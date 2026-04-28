import { z } from 'zod';
import { AccountType } from './account.types';

export const createAccountSchema = z.object({
  person_id: z.number({ required_error: 'person_id is required' }).int().positive(),
  daily_withdrawal_limit: z
    .number({ required_error: 'daily_withdrawal_limit is required' })
    .positive('daily_withdrawal_limit must be greater than 0'),
  account_type: z.nativeEnum(AccountType, {
    errorMap: () => ({ message: 'account_type must be 1 (Checking) or 2 (Savings)' }),
  }),
  initial_balance: z.number().nonnegative().optional(),
});

export const depositSchema = z.object({
  value: z
    .number({ required_error: 'value is required' })
    .positive('Deposit value must be greater than 0'),
});

export const withdrawSchema = z.object({
  value: z
    .number({ required_error: 'value is required' })
    .positive('Withdrawal value must be greater than 0'),
});

export const accountIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Account ID must be a numeric value'),
});

export const statementQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be a valid date (YYYY-MM-DD)')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be a valid date (YYYY-MM-DD)')
    .optional(),
  page: z
    .string()
    .regex(/^\d+$/, 'page must be a positive integer')
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/, 'limit must be a positive integer')
    .optional(),
});