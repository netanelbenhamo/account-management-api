import request from 'supertest';
import app from '../../app';
import { clearDatabase, closeDatabase, seedAccount } from '../../db/testHelpers';

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('POST /api/accounts', () => {
  it('creates an account successfully', async () => {
    const { rows } = await (await import('../../config/db')).pool.query(
      `INSERT INTO persons (name, document, birth_date)
       VALUES ('New User', '111111111', '1995-05-05')
       RETURNING person_id`
    );

    const res = await request(app)
      .post('/api/accounts')
      .send({
        person_id: rows[0].person_id,
        daily_withdrawal_limit: 300,
        account_type: 1,
        initial_balance: 500,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(parseFloat(res.body.data.balance)).toBe(500);
    expect(res.body.data.active_flag).toBe(true);
  });

  it('returns 400 for invalid account_type', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ person_id: 1, daily_withdrawal_limit: 300, account_type: 99 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ person_id: 1 });

    expect(res.status).toBe(400);
  });

  it('returns 400 for negative daily_withdrawal_limit', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ person_id: 1, daily_withdrawal_limit: -100, account_type: 1 });

    expect(res.status).toBe(400);
  });

  it('returns 404 when person does not exist', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({
        person_id: 99999,
        daily_withdrawal_limit: 300,
        account_type: 1,
        initial_balance: 500,
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Person not found');
  });
});

describe('GET /api/accounts/:id/balance', () => {
  it('returns balance for existing account', async () => {
    const { account_id } = await seedAccount({ balance: 750 });

    const res = await request(app).get(`/api/accounts/${account_id}/balance`);

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(750);
    expect(res.body.data.account_id).toBe(account_id);
  });

  it('returns 404 for non-existent account', async () => {
    const res = await request(app).get('/api/accounts/99999/balance');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Account not found');
  });

  it('returns 400 for non-numeric account ID', async () => {
    const res = await request(app).get('/api/accounts/abc/balance');

    expect(res.status).toBe(400);
  });
});

describe('POST /api/accounts/:id/deposit', () => {
  it('deposits successfully and updates balance', async () => {
    const { account_id } = await seedAccount({ balance: 1000 });

    const res = await request(app)
      .post(`/api/accounts/${account_id}/deposit`)
      .send({ value: 200 });

    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.value)).toBe(200);

    const balanceRes = await request(app).get(`/api/accounts/${account_id}/balance`);
    expect(balanceRes.body.data.balance).toBe(1200);
  });

  it('returns 403 when depositing to a blocked account', async () => {
    const { account_id } = await seedAccount({ active_flag: false });

    const res = await request(app)
      .post(`/api/accounts/${account_id}/deposit`)
      .send({ value: 100 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Account is blocked');
  });

  it('returns 404 for non-existent account', async () => {
    const res = await request(app)
      .post('/api/accounts/99999/deposit')
      .send({ value: 100 });

    expect(res.status).toBe(404);
  });

  it('returns 400 for zero deposit value', async () => {
    const { account_id } = await seedAccount();

    const res = await request(app)
      .post(`/api/accounts/${account_id}/deposit`)
      .send({ value: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 for negative deposit value', async () => {
    const { account_id } = await seedAccount();

    const res = await request(app)
      .post(`/api/accounts/${account_id}/deposit`)
      .send({ value: -50 });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/accounts/:id/withdraw', () => {
  it('withdraws successfully and updates balance', async () => {
    const { account_id } = await seedAccount({ balance: 1000, daily_withdrawal_limit: 500 });

    const res = await request(app)
      .post(`/api/accounts/${account_id}/withdraw`)
      .send({ value: 200 });

    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.value)).toBe(-200);

    const balanceRes = await request(app).get(`/api/accounts/${account_id}/balance`);
    expect(balanceRes.body.data.balance).toBe(800);
  });

  it('returns 422 for insufficient funds', async () => {
    const { account_id } = await seedAccount({ balance: 100 });

    const res = await request(app)
      .post(`/api/accounts/${account_id}/withdraw`)
      .send({ value: 500 });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Insufficient funds');
  });

  it('returns 422 when daily withdrawal limit is exceeded', async () => {
    const { account_id } = await seedAccount({
      balance: 2000,
      daily_withdrawal_limit: 300,
    });

    await request(app)
      .post(`/api/accounts/${account_id}/withdraw`)
      .send({ value: 200 });

    const res = await request(app)
      .post(`/api/accounts/${account_id}/withdraw`)
      .send({ value: 150 });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('Daily withdrawal limit');
  });

  it('returns 403 when withdrawing from a blocked account', async () => {
    const { account_id } = await seedAccount({ active_flag: false });

    const res = await request(app)
      .post(`/api/accounts/${account_id}/withdraw`)
      .send({ value: 100 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Account is blocked');
  });

  it('returns 404 for non-existent account', async () => {
    const res = await request(app)
      .post('/api/accounts/99999/withdraw')
      .send({ value: 100 });

    expect(res.status).toBe(404);
  });

  it('returns 400 for zero withdrawal value', async () => {
    const { account_id } = await seedAccount();

    const res = await request(app)
      .post(`/api/accounts/${account_id}/withdraw`)
      .send({ value: 0 });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/accounts/:id/block', () => {
  it('blocks an active account successfully', async () => {
    const { account_id } = await seedAccount();

    const res = await request(app).patch(`/api/accounts/${account_id}/block`);

    expect(res.status).toBe(200);
    expect(res.body.data.active_flag).toBe(false);
  });

  it('returns 409 when blocking an already blocked account', async () => {
    const { account_id } = await seedAccount({ active_flag: false });

    const res = await request(app).patch(`/api/accounts/${account_id}/block`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Account is already blocked');
  });

  it('returns 404 for non-existent account', async () => {
    const res = await request(app).patch('/api/accounts/99999/block');

    expect(res.status).toBe(404);
  });
});

describe('GET /api/accounts/:id/statement', () => {
  it('returns full transaction history', async () => {
    const { account_id } = await seedAccount({ balance: 1000 });

    await request(app).post(`/api/accounts/${account_id}/deposit`).send({ value: 200 });
    await request(app).post(`/api/accounts/${account_id}/withdraw`).send({ value: 100 });

    const res = await request(app).get(`/api/accounts/${account_id}/statement`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('returns empty array when no transactions exist', async () => {
    const { account_id } = await seedAccount();

    const res = await request(app).get(`/api/accounts/${account_id}/statement`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('filters transactions by from date', async () => {
    const { account_id } = await seedAccount({ balance: 1000 });
    await request(app).post(`/api/accounts/${account_id}/deposit`).send({ value: 100 });

    const today = new Date().toISOString().split('T')[0];
    const res = await request(app).get(
      `/api/accounts/${account_id}/statement?from=${today}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('filters transactions by to date', async () => {
    const { account_id } = await seedAccount({ balance: 1000 });
    await request(app).post(`/api/accounts/${account_id}/deposit`).send({ value: 100 });

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const res = await request(app).get(
      `/api/accounts/${account_id}/statement?to=${yesterday}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 400 for invalid date format in from param', async () => {
    const { account_id } = await seedAccount();

    const res = await request(app).get(
      `/api/accounts/${account_id}/statement?from=not-a-date`
    );

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent account', async () => {
    const res = await request(app).get('/api/accounts/99999/statement');

    expect(res.status).toBe(404);
  });
});