#!/usr/bin/env node
/**
 * Migration Runner - Execute SQL migrations via Supabase
 *
 * Usage: node scripts/run-migration.js <migration-file>
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Using anon key (needs service_role_key for DDL in production!)

if (!supabaseKey) {
  console.error('❌ SUPABASE_ANON_KEY not found in .env');
  process.exit(1);
}

// Note: For DDL operations, we need to use postgres connection directly
// Using psql with DB_URL from .env
const { exec } = await import('child_process');
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runMigration(sqlFile) {
  const migrationPath = join(__dirname, '..', sqlFile);
  console.log(`📄 Reading migration: ${migrationPath}`);

  const sql = readFileSync(migrationPath, 'utf8');

  console.log('🔌 Connecting to Supabase...');
  console.log(`   URL: ${process.env.SUPABASE_URL}`);

  // Use DB_URL for psql
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error('❌ SUPABASE_DB_URL not found in .env');
    process.exit(1);
  }

  // Write SQL to temp file and execute via psql
  const tempSqlPath = `/tmp/migration_${Date.now()}.sql`;
  await import('fs').then(fs => fs.writeFileSync(tempSqlPath, sql));

  console.log('🚀 Executing migration via psql...\n');

  try {
    const { stdout, stderr } = await execAsync(
      `psql "${dbUrl}" -f "${tempSqlPath}"`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );

    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes('NOTICE')) console.error(stderr);

    // Clean up temp file
    await import('fs').then(fs => fs.unlinkSync(tempSqlPath));

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    // Clean up temp file even on error
    try {
      await import('fs').then(fs => fs.unlinkSync(tempSqlPath));
    } catch (e) {}

    console.error('\n❌ Migration failed!');
    console.error(error.message);
    process.exit(1);
  }
}

// Get migration file from command line
const migrationFile = process.argv[2] || 'supabase/migrations/20250606_allow_retracking_closed_coins.sql';

runMigration(migrationFile);
