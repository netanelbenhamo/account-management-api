import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';
import { requestId } from './middleware/requestId';
import { generalLimiter } from './middleware/rateLimiter';
import accountRoutes from './modules/accounts/account.routes';

const app: Application = express();

app.use(helmet());

app.use(requestId);
app.use(logger);

app.use(generalLimiter);

app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Account Management API',
      version: '1.0.0',
      description:
        'RESTful API for managing bank accounts — deposits, withdrawals, balance inquiries, blocking, and transaction history.',
    },
    servers: [{ url: '/api' }],
  },
  apis: ['./src/modules/**/*.routes.ts'],
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/accounts', accountRoutes);

app.use(errorHandler);

export default app;