/**
 * Creates the newsletter-related tables in Supabase.
 * Run: node setup-newsletters-db.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('\n❌  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Newsletter DB Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // newsletters table
  const { error: e1 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS newsletters (
        id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        gmail_message_id     TEXT        NOT NULL UNIQUE,
        sender_email         TEXT        NOT NULL DEFAULT '',
        sender_name          TEXT        NOT NULL DEFAULT '',
        subject              TEXT        NOT NULL DEFAULT '',
        snippet              TEXT        NOT NULL DEFAULT '',
        received_at          TIMESTAMPTZ NOT NULL,
        category             TEXT        CHECK (category IN ('Sports', 'Tech & AI', 'Business', 'Create', 'Local')),
        is_read              BOOLEAN     NOT NULL DEFAULT false,
        body_html            TEXT,
        full_content_fetched BOOLEAN     NOT NULL DEFAULT false,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS newsletters_sender_email_idx ON newsletters (sender_email);
      CREATE INDEX IF NOT EXISTS newsletters_category_idx     ON newsletters (category);
      CREATE INDEX IF NOT EXISTS newsletters_received_at_idx  ON newsletters (received_at DESC);
      CREATE INDEX IF NOT EXISTS newsletters_is_read_idx      ON newsletters (is_read);

      ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;
    `,
  });

  if (e1 && !e1.message.includes('already exists')) {
    console.error('❌  newsletters table error:', e1.message);
    console.log('\nIf exec_sql is not available, run this SQL manually in Supabase SQL editor:');
    printSQL();
    return;
  }

  // newsletter_senders table
  const { error: e2 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS newsletter_senders (
        email            TEXT        PRIMARY KEY,
        display_name     TEXT        NOT NULL DEFAULT '',
        last_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
        total_count      INTEGER     NOT NULL DEFAULT 0,
        unread_count     INTEGER     NOT NULL DEFAULT 0,
        primary_category TEXT
      );

      ALTER TABLE newsletter_senders ENABLE ROW LEVEL SECURITY;
    `,
  });

  if (e2 && !e2.message.includes('already exists')) {
    console.error('❌  newsletter_senders table error:', e2.message);
    console.log('\nRun the SQL manually — see below.\n');
    printSQL();
    return;
  }

  // RLS policies
  await supabase.rpc('exec_sql', {
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'newsletters' AND policyname = 'Service access'
        ) THEN
          CREATE POLICY "Service access" ON newsletters FOR ALL USING (true);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_senders' AND policyname = 'Service access'
        ) THEN
          CREATE POLICY "Service access" ON newsletter_senders FOR ALL USING (true);
        END IF;
      END $$;
    `,
  });

  console.log('✅  Tables created (or already exist):');
  console.log('   • newsletters');
  console.log('   • newsletter_senders\n');
  console.log('Next step: run "node setup-gmail-oauth.js" to get your refresh token.\n');
}

function printSQL() {
  console.log(`
-- Run this in Supabase SQL editor (supabase.com → your project → SQL Editor):

CREATE TABLE IF NOT EXISTS newsletters (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id     TEXT        NOT NULL UNIQUE,
  sender_email         TEXT        NOT NULL DEFAULT '',
  sender_name          TEXT        NOT NULL DEFAULT '',
  subject              TEXT        NOT NULL DEFAULT '',
  snippet              TEXT        NOT NULL DEFAULT '',
  received_at          TIMESTAMPTZ NOT NULL,
  category             TEXT        CHECK (category IN ('Sports', 'Tech & AI', 'Business', 'Create', 'Local')),
  is_read              BOOLEAN     NOT NULL DEFAULT false,
  body_html            TEXT,
  full_content_fetched BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS newsletters_sender_email_idx ON newsletters (sender_email);
CREATE INDEX IF NOT EXISTS newsletters_category_idx     ON newsletters (category);
CREATE INDEX IF NOT EXISTS newsletters_received_at_idx  ON newsletters (received_at DESC);
CREATE INDEX IF NOT EXISTS newsletters_is_read_idx      ON newsletters (is_read);
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service access" ON newsletters FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS newsletter_senders (
  email            TEXT        PRIMARY KEY,
  display_name     TEXT        NOT NULL DEFAULT '',
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_count      INTEGER     NOT NULL DEFAULT 0,
  unread_count     INTEGER     NOT NULL DEFAULT 0,
  primary_category TEXT
);
ALTER TABLE newsletter_senders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service access" ON newsletter_senders FOR ALL USING (true);
`);
}

run().catch(console.error);
