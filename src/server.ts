import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { pool } from './config/db';

const PORT = process.env.PORT || 3000;

const start = async (): Promise<void> => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connection established');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📄 Swagger docs at http://localhost:${PORT}/docs`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();