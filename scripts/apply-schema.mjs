#!/usr/bin/env node
/**
 * Idempotent schema/migration runner.
 *
 * Applies supabase/schema.sql to a Postgres database via `psql`. The schema is
 * written to be re-runnable (create-or-replace, "add column if not exists",
 * guarded constraint do-blocks), so this is safe to run on every deploy.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://...:5432/postgres" pnpm db:migrate
 *
 * Get the connection string from Supabase → Project Settings → Database →
 * "Connection string" (use the direct connection, not the pooler, for DDL).
 *
 * Dependency-free: shells out to psql (preinstalled on CI runners). No pg driver.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Resolve psql from a fixed allow-list of absolute, system-owned locations
// instead of via $PATH — $PATH can be attacker-influenced, and spawning a bare
// command name resolves through it (CWE-426 / Sonar S4036). Covers CI (apt),
// Homebrew (Apple-silicon + Intel), and Linux/Postgres.app installs.
const PSQL_CANDIDATES = [
  '/usr/bin/psql',
  '/usr/local/bin/psql',
  '/opt/homebrew/bin/psql',
  '/Library/PostgreSQL/16/bin/psql',
  '/Applications/Postgres.app/Contents/Versions/latest/bin/psql',
];

const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('[db:migrate] SUPABASE_DB_URL (or DATABASE_URL) is required.');
  console.error('  Supabase → Project Settings → Database → Connection string (direct).');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(root, 'supabase', 'schema.sql');
if (!existsSync(schemaPath)) {
  console.error(`[db:migrate] schema not found at ${schemaPath}`);
  process.exit(1);
}

const psqlBin = PSQL_CANDIDATES.find((p) => existsSync(p));
if (!psqlBin) {
  console.error('[db:migrate] `psql` not found in any known location:');
  for (const p of PSQL_CANDIDATES) console.error(`  - ${p}`);
  console.error('  Install the PostgreSQL client (e.g. `apt-get install postgresql-client`).');
  process.exit(1);
}

console.log(`[db:migrate] applying ${path.relative(root, schemaPath)} via ${psqlBin} …`);
const res = spawnSync(psqlBin, [url, '-v', 'ON_ERROR_STOP=1', '-f', schemaPath], {
  stdio: 'inherit',
  shell: false,
});

if (res.error) {
  console.error('[db:migrate] failed to launch psql:', res.error.message);
  process.exit(1);
}
if (res.status !== 0) {
  console.error(`[db:migrate] psql exited with code ${res.status}`);
  process.exit(res.status ?? 1);
}
console.log('[db:migrate] schema applied successfully.');
