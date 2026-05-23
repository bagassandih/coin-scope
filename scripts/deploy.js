#!/usr/bin/env node

/**
 * Background deployment script
 * Run independently from webhook HTTP request to avoid timeout
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

// Setup logging
const logsDir = `${__dirname}/../logs`;
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

const logStream = createWriteStream(`${logsDir}/deploy.log`, { flags: 'a' });

// Status file for main server to read
const statusFile = `${logsDir}/deploy-status.json`;

function writeStatus(status, message) {
  const statusData = {
    timestamp: new Date().toISOString(),
    status,
    message
  };
  createWriteStream(statusFile, { flags: 'w' }).write(JSON.stringify(statusData, null, 2));
}

// Write initial status
writeStatus('running', 'Deployment started...');

// Override console to write to file
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  originalLog(msg);
  logStream.write(msg + '\n');
};

console.error = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  originalError(msg);
  logStream.write('ERROR: ' + msg + '\n');
};

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
      writeStatus('pulled', `Code pulled: ${summary}`);
    } else {
      writeStatus('pulled', 'Code already up to date');
    }

    // Check if package.json changed
    const packageChanged = pullOutput.includes('package.json');

    // Install dependencies if package.json changed
    if (packageChanged) {
      console.log(`[${getWIBTimestamp()}] 📦 Installing dependencies...`);
      await execAsync('npm install', { cwd: repoPath });
      console.log(`[${getWIBTimestamp()}] ✅ Dependencies installed`);
    }

    // Check if PM2 is available (Windows vs Unix)
    let usePM2 = false;
    try {
      const pm2CheckCmd = process.platform === 'win32' ? 'where pm2' : 'which pm2';
      await execAsync(pm2CheckCmd);
      usePM2 = true;
      console.log(`[${getWIBTimestamp()}] 🔧 PM2 detected, using process manager`);
    } catch {
      console.log(`[${getWIBTimestamp()}] ℹ️  PM2 not found, will use direct restart`);
    }

    if (usePM2) {
      // PM2 restart (use pm2restart all for Windows compatibility)
      console.log(`[${getWIBTimestamp()}] 🔄 Restarting PM2 process...`);

      try {
        await execAsync('pm2 restart coinscope', {
          cwd: repoPath,
          shell: true,
          stdio: 'pipe'
        });
      } catch {
        // Ignore errors, restart might still work
      }

      console.log(`[${getWIBTimestamp()}] ✅ PM2 restart completed!`);
      writeStatus('completed', '✅ Deployment successful! Service restarted.');
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
    logStream.end();
    process.exit(1);
  }

  // Close log stream
  logStream.end();
}

deploy();
