#!/usr/bin/env node

/**
 * Background deployment script
 * Run independently from webhook HTTP request to avoid timeout
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get WIB timestamp
function getWIBTimestamp() {
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
}

async function deploy() {
  try {
    console.log(`[${getWIBTimestamp()}] 🔄 Deployment started...`);
    const repoPath = process.cwd();

    // Execute git pull
    console.log(`[${getWIBTimestamp()}] 📥 Pulling latest code...`);
    const { stdout: pullOutput } = await execAsync('git pull', { cwd: repoPath });

    // Show git output summary
    const pullLines = pullOutput.trim().split('\n');
    if (pullLines.length > 0) {
      const summary = pullLines[pullLines.length - 1]; // Usually "Updating abc123..def456"
      console.log(`[${getWIBTimestamp()}] ${summary}`);
    }

    // Check if package.json changed
    const packageChanged = pullOutput.includes('package.json');

    // Install dependencies if package.json changed
    if (packageChanged) {
      console.log(`[${getWIBTimestamp()}] 📦 Installing dependencies...`);
      await execAsync('npm install', { cwd: repoPath });
      console.log(`[${getWIBTimestamp()}] ✅ Dependencies installed`);
    }

    // Check if running under PM2
    const isPM2 = process.env.PM2_HOME || process.env.NODE_ENV === 'production' || packageChanged;

    if (isPM2) {
      try {
        console.log(`[${getWIBTimestamp()}] 🛑 Stopping current process...`);
        await execAsync('pm2 stop coinscope', { cwd: repoPath });
        await execAsync('pm2 delete coinscope', { cwd: repoPath });

        // Small delay to ensure port is released
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log(`[${getWIBTimestamp()}] 🚀 Starting fresh process...`);
        await execAsync('pm2 start src/server.js --name coinscope', { cwd: repoPath });
        console.log(`[${getWIBTimestamp()}] ✅ Deployment completed successfully!`);
      } catch (err) {
        // If stop/delete fails (app not running), just start
        console.log(`[${getWIBTimestamp()}] 🚀 Starting new process...`);
        await execAsync('pm2 start src/server.js --name coinscope', { cwd: repoPath });
        console.log(`[${getWIBTimestamp()}] ✅ Deployment completed successfully!`);
      }
    } else {
      console.log(`[${getWIBTimestamp()}] ℹ️  Running in Manual Mode`);
      console.log(`[${getWIBTimestamp()}] 📝 To apply changes: pkill -f "node src/server.js" && npm start`);
    }
  } catch (err) {
    console.error(`[${getWIBTimestamp()}] ❌ Deployment error:`, err.message);
    process.exit(1);
  }
}

deploy();
