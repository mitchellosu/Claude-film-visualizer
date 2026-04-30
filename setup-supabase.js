import 'dotenv/config';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const PROJECT_REF   = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
const BUCKET        = 'coolvu-visualizations';

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const CREATE_TABLE_SQL = `
create table if not exists visualizations (
  id           uuid        primary key,
  film_id      text        not null,
  film_name    text        not null,
  original_url text,
  result_url   text        not null,
  created_at   timestamptz default now()
);
alter table if exists visualizations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='visualizations' and policyname='Public read') then
    create policy "Public read"   on visualizations for select using (true);
    create policy "Service write" on visualizations for insert with check (true);
  end if;
end $$;
`.trim();

async function step(label, fn) {
  process.stdout.write(label + ' ... ');
  try {
    const msg = await fn();
    console.log('✓' + (msg ? '  ' + msg : ''));
    return true;
  } catch (err) {
    console.log('✗  ' + err.message);
    return false;
  }
}

async function run() {
  console.log('\nCoolVu — Supabase Setup\n');

  // ── 1. Create storage bucket (direct HTTP) ───────────────────────────────
  await step('Creating storage bucket', async () => {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: BUCKET,
        name: BUCKET,
        public: true,
        file_size_limit: 10485760,
      }),
    });
    const body = await res.json();
    if (res.ok) return 'created';
    if (body?.error === 'Duplicate' || body?.message?.toLowerCase().includes('already exists')) return 'already exists';
    throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
  });

  // ── 2. Create table via Management API (service key as bearer) ───────────
  const tableOk = await step('Creating database table (management API)', async () => {
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: CREATE_TABLE_SQL }),
    });
    if (res.ok) return 'done';
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `HTTP ${res.status} — needs personal access token`);
  });

  // ── 3. If management API failed, verify table already exists ────────────
  if (!tableOk) {
    await step('Checking if table already exists', async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/visualizations?limit=1`, {
        headers: { ...headers, Prefer: 'count=none' },
      });
      if (res.ok || res.status === 200) return 'table exists';
      if (res.status === 404 || res.status === 42501) throw new Error('table not found');
      throw new Error(`HTTP ${res.status}`);
    });
  }

  // ── 4. Print manual SQL if needed ───────────────────────────────────────
  if (!tableOk) {
    console.log(`
⚠  The table needs to be created manually. Open this URL and run the SQL below:

  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new

${'─'.repeat(62)}
${CREATE_TABLE_SQL}
${'─'.repeat(62)}
`);
  } else {
    console.log('\nAll done — gallery is fully connected.');
  }
}

run().catch((err) => { console.error('\nSetup failed:', err.message); process.exit(1); });
