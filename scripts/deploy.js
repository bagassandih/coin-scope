#!/usr/bin/env node

/**
 * Simple CI/CD deploy script
 * 1. git pull
 * 2. pm2 restart
 * 3. done
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function getWIBTimestamp() {
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
}

async function deploy() {
  try {
    console.log(`[${getWIBTimestamp()}] 🔄 Deploying...`);

    // 1. Git pull
    console.log(`[${getWIBTimestamp()}] 📥 git pull`);
    const { stdout: pullOutput } = await execAsync('git pull');

    // 2. npm install if package.json changed
    if (pullOutput.includes('package.json')) {
      console.log(`[${getWIBTimestamp()}] 📦 npm install`);
      await execAsync('npm install');
    }

    // 3. PM2 restart
    console.log(`[${getWIBTimestamp()}] 🔄 pm2 restart coinscope`);
    await execAsync('pm2 restart coinscope', { shell: true });

    // 4. Done
    console.log(`[${getWIBTimestamp()}] ✅ Deployment completed!`);
  } catch (err) {
    console.error(`[${getWIBTimestamp()}] ❌ Error:`, err.message);
    process.exit(1);
  }
}

deploy();
