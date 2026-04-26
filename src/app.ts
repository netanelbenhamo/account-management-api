import express, { Application, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { errorHandler } from './middleware/errorHandler';

const app: Application = express();

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

// ── Routes (modules will be registered here in step 3) ───────────────────────
// app.use('/api/accounts', accountRoutes);

app.use(errorHandler);

export default app;