-- Seed: one person + one account for development and manual testing

INSERT INTO persons (name, document, birth_date)
VALUES ('Netanel Ben Hamo', '123456789', '1990-01-01')
ON CONFLICT (document) DO NOTHING;

INSERT INTO accounts (person_id, balance, daily_withdrawal_limit, active_flag, account_type)
VALUES (
  (SELECT person_id FROM persons WHERE document = '123456789'),
  1000.00,  -- starting balance
  500.00,   -- daily withdrawal limit
  true,
  1         -- 1 = Checking
)
ON CONFLICT DO NOTHING;