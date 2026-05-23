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

    // Check if PM2 is available
    let usePM2 = false;
    try {
      await execAsync('which pm2');
      usePM2 = true;
      console.log(`[${getWIBTimestamp()}] 🔧 PM2 detected, using process manager`);
    } catch {
      console.log(`[${getWIBTimestamp()}] ℹ️  PM2 not found, will use direct restart`);
    }

    if (usePM2) {
      try {
        // Try graceful restart first
        console.log(`[${getWIBTimestamp()}] 🔄 Attempting PM2 restart...`);
        await execAsync('pm2 restart coinscope', { cwd: repoPath });
        console.log(`[${getWIBTimestamp()}] ✅ PM2 restart successful!`);
      } catch (err) {
        // If restart fails, do full restart with cleanup
        console.log(`[${getWIBTimestamp()}] 🛑 PM2 restart failed, doing full restart...`);

        // Stop and delete from PM2
        try {
          await execAsync('pm2 stop coinscope', { cwd: repoPath });
          await execAsync('pm2 delete coinscope', { cwd: repoPath });
        } catch {
          // Process might not exist, ignore error
        }

        // Kill ALL node processes to ensure port is released
        console.log(`[${getWIBTimestamp()}] 🔪 Killing all node processes...`);
        try {
          if (process.platform === 'win32') {
            await execAsync('taskkill /F /IM node.exe');
          } else {
            await execAsync('pkill -f "node"');
          }
        } catch {
          // No processes to kill, ignore
        }

        // Small delay to ensure port is released
        await new Promise(resolve => setTimeout(resolve, 2000));

        await execAsync('pm2 start src/server.js --name coinscope', { cwd: repoPath });
        console.log(`[${getWIBTimestamp()}] ✅ PM2 start successful!`);
      }
    } else {
      // Fallback: kill existing process and start fresh
      console.log(`[${getWIBTimestamp()}] 🛑 Killing existing node processes...`);
      try {
        await execAsync('pkill -f "node.*server.js"');
      } catch {
        // No process running, ignore
      }

      // Small delay to ensure port is released
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`[${getWIBTimestamp()}] 🚀 Starting server...`);
      // Spawn new process (detached)
      const { spawn } = await import('child_process');
      spawn('node', ['src/server.js'], {
        detached: true,
        stdio: 'ignore',
        cwd: repoPath,
        env: { ...process.env }
      }).unref();

      console.log(`[${getWIBTimestamp()}] ✅ Server started in background!`);
    }
  } catch (err) {
    console.error(`[${getWIBTimestamp()}] ❌ Deployment error:`, err.message);
    process.exit(1);
  }
}

deploy();
