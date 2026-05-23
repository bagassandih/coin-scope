#!/usr/bin/env node

/**
 * Simple CI/CD deploy script
 * 1. git fetch & pull
 * 2. npm install if package.json changed
 * 3. pm2 restart
 * 4. done
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function getWIBTimestamp() {
  // Catatan kecil: Jika servermu sudah diatur ke zona Asia/Jakarta (WIB),
  // kamu sebenarnya bisa pakai toLocaleString('id-ID') tanpa perlu + 7 jam manual.
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
}

async function deploy() {
  try {
    console.log(`[${getWIBTimestamp()}] 🔄 Deploying...`);

    // Ambil hash commit SEBELUM pull untuk pengecekan diff nanti
    const { stdout: beforeHash } = await execAsync('git rev-parse HEAD');

    // 1. Git Fetch & Pull
    console.log(`[${getWIBTimestamp()}] 📥 git fetch origin`);
    await execAsync('git fetch origin');

    console.log(`[${getWIBTimestamp()}] 📥 git pull --rebase --autostash origin main`);
    // Menggunakan --rebase dan --autostash agar aman dari konflik file lokal di server
    await execAsync('git pull --rebase --autostash origin main');

    // Ambil hash commit SESUDAH pull
    const { stdout: afterHash } = await execAsync('git rev-parse HEAD');

    // 2. Cek apakah package.json berubah berdasarkan perbedaan commit
    // Jika hash commit berubah, kita cek apakah package.json ikut berubah
    let isPackageChanged = false;
    if (beforeHash.trim() !== afterHash.trim()) {
      const { stdout: diffOutput } = await execAsync(`git diff --name-only ${beforeHash.trim()} ${afterHash.trim()}`);
      isPackageChanged = diffOutput.includes('package.json');
    }

    // Eksekusi npm install jika ada perubahan package.json
    if (isPackageChanged) {
      console.log(`[${getWIBTimestamp()}] 📦 package.json changed! Running npm install...`);
      await execAsync('npm install');
    } else {
      console.log(`[${getWIBTimestamp()}] 📦 No changes in package.json. Skipping npm install.`);
    }

    // 3. PM2 restart
    console.log(`[${getWIBTimestamp()}] 🔄 pm2 restart coinscope`);
    await execAsync('pm2 restart coinscope', { shell: true });

    // 4. Done
    console.log(`[${getWIBTimestamp()}] ✅ Deployment completed!`);
  } catch (err) {
    console.error(`[${getWIBTimestamp()}] ❌ Error:`, err.message);
    // Tampilkan detail stderr dari git jika ada, biar gampang debug-nya
    if (err.stderr) {
      console.error(`[${getWIBTimestamp()}] 🔍 Git/Process Stderr:`, err.stderr);
    }
    process.exit(1);
  }
}

deploy();