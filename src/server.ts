import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { pool } from './config/db';

const PORT = process.env.PORT || 3000;

const start = async (): Promise<void> => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connection established');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📄 Swagger docs at http://localhost:${PORT}/docs`);
    });

    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n${signal} received — shutting down gracefully`);

      server.close(async () => {
        console.log('🔌 HTTP server closed');

        await pool.end();
        console.log('🗄️  Database pool closed');

        process.exit(0);
      });

      setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();