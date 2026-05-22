#!/usr/bin/env node

/**
 * Background deployment script
 * Run independently from webhook HTTP request to avoid timeout
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function deploy() {
  try {
    console.log('🔄 Background deployment started...');

    const repoPath = process.cwd();

    // Execute git pull
    console.log('📥 Pulling latest code...');
    const { stdout: pullOutput } = await execAsync('git pull', { cwd: repoPath });
    console.log(pullOutput);

    // Check if package.json changed
    const packageChanged = pullOutput.includes('package.json');

    // Install dependencies if package.json changed
    if (packageChanged) {
      console.log('📦 Installing dependencies...');
      const { stdout: installOutput } = await execAsync('npm install', { cwd: repoPath });
      console.log(installOutput);
    }

    // Check if running under PM2
    const isPM2 = process.env.PM2_HOME || process.env.NODE_ENV === 'production' || packageChanged;

    if (isPM2) {
      console.log('🔄 Restarting with PM2...');
      try {
        await execAsync('pm2 reload coinscope || pm2 restart coinscope', {
          cwd: repoPath
        });
        console.log('✅ PM2 restart completed!');
      } catch (err) {
        console.error('❌ PM2 restart failed:', err.message);
      }
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Deployment completed! Code is now up to date.');
      console.log('📝 To apply changes, restart manually:');
      console.log('   pkill -f "node src/server.js" && npm start');
      console.log('ℹ️  Running in Manual Mode (not PM2)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  } catch (err) {
    console.error('❌ Deployment error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

deploy();
