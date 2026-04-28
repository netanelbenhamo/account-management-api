import { Router } from 'express';
import { pool } from '../../config/db';
import { validate } from '../../middleware/validate';
import { transactionLimiter } from '../../middleware/rateLimiter';
import { AccountRepository } from './account.repository';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import {
  createAccountSchema,
  depositSchema,
  withdrawSchema,
  accountIdParamSchema,
  statementQuerySchema,
} from './account.schemas';

const router = Router();

const repository = new AccountRepository(pool);
const service = new AccountService(repository);
const controller = new AccountController(service);

/**
 * @swagger
 * tags:
 *   name: Accounts
 *   description: Account management endpoints
 */

/**
 * @swagger
 * /accounts:
 *   post:
 *     summary: Create a new bank account
 *     tags: [Accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [person_id, daily_withdrawal_limit, account_type]
 *             properties:
 *               person_id:
 *                 type: integer
 *               daily_withdrawal_limit:
 *                 type: number
 *               account_type:
 *                 type: integer
 *                 enum: [1, 2]
 *                 description: 1 = Checking, 2 = Savings
 *               initial_balance:
 *                 type: number
 *     responses:
 *       201:
 *         description: Account created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Person not found
 */
router.post(
  '/',
  validate('body', createAccountSchema),
  controller.createAccount
);

/**
 * @swagger
 * /accounts/{id}/balance:
 *   get:
 *     summary: Get account balance
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Account balance
 *       400:
 *         description: Validation error
 *       404:
 *         description: Account not found
 */
router.get(
  '/:id/balance',
  validate('params', accountIdParamSchema),
  controller.getBalance
);

/**
 * @swagger
 * /accounts/{id}/deposit:
 *   post:
 *     summary: Deposit funds into an account
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value:
 *                 type: number
 *                 description: Amount to deposit (must be positive)
 *     responses:
 *       201:
 *         description: Deposit successful
 *       400:
 *         description: Validation error
 *       403:
 *         description: Account is blocked
 *       404:
 *         description: Account not found
 */
router.post(
  '/:id/deposit',
  transactionLimiter,
  validate('params', accountIdParamSchema),
  validate('body', depositSchema),
  controller.deposit
);

/**
 * @swagger
 * /accounts/{id}/withdraw:
 *   post:
 *     summary: Withdraw funds from an account
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value:
 *                 type: number
 *                 description: Amount to withdraw (must be positive)
 *     responses:
 *       201:
 *         description: Withdrawal successful
 *       400:
 *         description: Validation error
 *       403:
 *         description: Account is blocked
 *       404:
 *         description: Account not found
 *       422:
 *         description: Insufficient funds or daily limit exceeded
 */
router.post(
  '/:id/withdraw',
  transactionLimiter,
  validate('params', accountIdParamSchema),
  validate('body', withdrawSchema),
  controller.withdraw
);

/**
 * @swagger
 * /accounts/{id}/block:
 *   patch:
 *     summary: Block an account
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Account blocked
 *       400:
 *         description: Validation error
 *       404:
 *         description: Account not found
 *       409:
 *         description: Account already blocked
 */
router.patch(
  '/:id/block',
  validate('params', accountIdParamSchema),
  controller.blockAccount
);

/**
 * @swagger
 * /accounts/{id}/statement:
 *   get:
 *     summary: Get account transaction statement
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Results per page (max 100)
 *     responses:
 *       200:
 *         description: List of transactions
 *       400:
 *         description: Validation error
 *       404:
 *         description: Account not found
 */
router.get(
  '/:id/statement',
  validate('params', accountIdParamSchema),
  validate('query', statementQuerySchema),
  controller.getStatement
);

export default router;