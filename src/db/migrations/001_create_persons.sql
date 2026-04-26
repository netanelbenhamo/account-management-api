CREATE TABLE IF NOT EXISTS persons (
  person_id  SERIAL PRIMARY KEY,
  name       TEXT           NOT NULL,
  document   TEXT           NOT NULL UNIQUE,
  birth_date DATE           NOT NULL
);