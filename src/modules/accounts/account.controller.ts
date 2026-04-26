import { Request, Response, NextFunction } from 'express';
import { AccountService } from './account.service';
import { CreateAccountInput, DepositInput, StatementQuery, WithdrawInput } from './account.types';

export class AccountController {
  constructor(private readonly service: AccountService) {}

  createAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CreateAccountInput;
      const account = await this.service.createAccount(input);
      res.status(201).json({ status: 'success', data: account });
    } catch (err) {
      next(err);
    }
  };

  getBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = parseInt(req.params.id);
      const balance = await this.service.getBalance(accountId);
      res.json({ status: 'success', data: balance });
    } catch (err) {
      next(err);
    }
  };

  deposit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = parseInt(req.params.id);
      const { value } = req.body as DepositInput;
      const transaction = await this.service.deposit(accountId, value);
      res.status(201).json({ status: 'success', data: transaction });
    } catch (err) {
      next(err);
    }
  };

  withdraw = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = parseInt(req.params.id);
      const { value } = req.body as WithdrawInput;
      const transaction = await this.service.withdraw(accountId, value);
      res.status(201).json({ status: 'success', data: transaction });
    } catch (err) {
      next(err);
    }
  };

  blockAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = parseInt(req.params.id);
      const account = await this.service.blockAccount(accountId);
      res.json({ status: 'success', data: account });
    } catch (err) {
      next(err);
    }
  };

  getStatement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = parseInt(req.params.id);
      const { from, to } = req.query as StatementQuery;
      const transactions = await this.service.getStatement(accountId, from, to);
      res.json({ status: 'success', data: transactions });
    } catch (err) {
      next(err);
    }
  };
}