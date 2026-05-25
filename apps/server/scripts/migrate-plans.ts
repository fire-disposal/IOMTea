import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/iomtea')

async function main() {
  await sql`CREATE TABLE IF NOT EXISTS plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    fields jsonb NOT NULL DEFAULT '[]'::jsonb,
    reward_credits integer NOT NULL DEFAULT 0,
    cron text,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`

  await sql`CREATE TABLE IF NOT EXISTS plan_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    responses jsonb,
    credits_earned integer NOT NULL DEFAULT 0,
    completed_at timestamptz NOT NULL DEFAULT now()
  )`

  await sql`CREATE TABLE IF NOT EXISTS credit_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
    amount integer NOT NULL,
    kind text NOT NULL,
    source text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`

  console.log('Tables created')
  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
