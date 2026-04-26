import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type RequestPart = 'body' | 'params' | 'query';

/**
 * Middleware factory that validates a request part against a Zod schema.
 * Throws a ZodError on failure — caught by the global errorHandler.
 *
 * Usage: router.post('/', validate('body', mySchema), controller)
 */
export const validate =
  (part: RequestPart, schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      next(result.error);
      return;
    }

    req[part] = result.data;
    next();
  };