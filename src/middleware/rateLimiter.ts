import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

const isTest = process.env.NODE_ENV === 'test';

const noopMiddleware = (_req: Request, _res: Response, next: NextFunction): void => next();

// General limiter — applied to all routes
export const generalLimiter = isTest
  ? noopMiddleware
  : rateLimit({
      windowMs: 15 * 60 * 1000, 
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        status: 'error',
        message: 'Too many requests, please try again later',
      },
    });

export const transactionLimiter = isTest
  ? noopMiddleware
  : rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        status: 'error',
        message: 'Too many transaction requests, please slow down',
      },
    });