import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
});

const isTest = process.env.NODE_ENV === 'test';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: isTest
    ? `${process.env.DB_NAME}_test`
    : process.env.DB_NAME || 'account_management',
  max: Number(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30_000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT) || 2_000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
  process.exit(-1);
});