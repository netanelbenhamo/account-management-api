import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'X-Request-Id';

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = (req.headers[REQUEST_ID_HEADER.toLowerCase()] as string) ?? randomUUID();
  req.headers[REQUEST_ID_HEADER.toLowerCase()] = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
};