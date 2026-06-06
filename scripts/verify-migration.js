#!/usr/bin/env node
/**
 * Verify migration changes
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const dbUrl = process.env.SUPABASE_DB_URL;

async function verify() {
  console.log('🔍 Verifying migration changes...\n');

  // Check tracked_coins structure
  console.log('📋 tracked_coins columns:');
  const { stdout: columns } = await execAsync(
    `psql "${dbUrl}" -c "\\d tracked_coins"`
  );
  console.log(columns);

  console.log('\n📋 snapshots columns:');
  const { stdout: snapColumns } = await execAsync(
    `psql "${dbUrl}" -c "\\d snapshots"`
  );
  console.log(snapColumns);

  console.log('\n📋 Current tracked_coins data:');
  const { stdout: data } = await execAsync(
    `psql "${dbUrl}" -c "SELECT tracking_id, coin_id, symbol, name, status, added_at FROM tracked_coins ORDER BY added_at DESC LIMIT 5;"`
  );
  console.log(data);

  console.log('\n📋 View structure:');
  const { stdout: viewDef } = await execAsync(
    `psql "${dbUrl}" -c "\\d+ tracked_with_latest_snapshot"`
  );
  console.log(viewDef);
}

verify().catch(console.error);
