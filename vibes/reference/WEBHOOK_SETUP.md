# GitHub Webhook Setup for Auto-Deploy

## Overview

Webhook ini memungkinkan server untuk otomatis:
1. Pull code terbaru dari GitHub
2. Install dependencies (jika `package.json` berubah)
3. Restart server **(mode tergantung environment)**

Ketika ada **push event** ke repository GitHub.

---

## 🔄 Restart Mode (Auto-Detect)

Webhook otomatis detect environment dan menggunakan restart method yang sesuai:

| Environment | Restart Mode | Behavior |
|-------------|---------------|----------|
| **Laptop/Dev** (tanpa PM2) | Manual Mode | Git pull + message untuk restart manual |
| **PC Server** (dengan PM2) | Auto Mode | Git pull + `pm2 reload` otomatis |

---

## 📋 Prasyarat

- Node.js project yang running
- Akses ke terminal server
- GitHub repository
- **PM2** (opsional, untuk auto-restart di production)

---

## 🚀 Setup Langkah demi Langkah

### Step 1: Generate Webhook Secret

Di terminal, generate secret yang kuat:

```bash
openssl rand -hex 32
```

Contoh output:
```
a1b2c3d4e5f6...32 karakter hex
```

### Step 2: Update .env File

Buka `.env` di project dan tambahkan:

```env
GITHUB_WEBHOOK_SECRET=<paste-secret-dari-step-1>
```

### Step 3: Setup Webhook di GitHub

1. Buka GitHub repository
2. Go to **Settings** → **Webhooks** → **Add webhook**
3. Isi form:

| Field | Value |
|-------|-------|
| **Payload URL** | `http://your-server-ip:3000/webhook/github` |
| **Content type** | `application/json` |
| **Secret** | Paste secret dari Step 1 |
| **Events** | Pilih **Just the push event** |
| **Active** | ✅ Checked |

4. Klik **Add webhook**

---

## 🖥️ Mode Manual (Laptop/Dev)

### Behavior
- Webhook pull code otomatis
- Server **tidak** auto-restart (aman untuk development)
- Response berisi instruksi restart

### Response
```json
{
  "success": true,
  "restartMode": "manual",
  "message": "Code updated! To restart: pkill -f 'node src/server.js' && npm start"
}
```

### Cara Restart
```bash
# Kill dan restart server
pkill -f "node src/server.js" && npm start

# Atau jika port stuck
lsof -ti:3000 | xargs kill -9 && npm start
```

---

## 🚀 Mode Auto dengan PM2 (PC Server/Production)

### Install PM2 di PC Server

```bash
# Install PM2 secara global
npm install -g pm2

# Start aplikasi dengan PM2
pm2 start src/server.js --name coinscope

# Cek status
pm2 status

# Lihat log
pm2 logs coinscope
```

### Behavior dengan PM2
- Webhook pull code otomatis
- Server **auto-restart** dengan `pm2 reload`
- Zero-downtime reload

### Response
```json
{
  "success": true,
  "restartMode": "pm2",
  "message": "Code updated! Restarting with PM2..."
}
```

### PM2 Commands
```bash
# Restart manual
pm2 restart coinscope

# Reload (zero-downtime)
pm2 reload coinscope

# Stop
pm2 stop coinscope

# Delete
pm2 delete coinscope

# Monitor
pm2 monit
```

---

## 🌐 Network Setup (PC Server)

Agar GitHub bisa mengirim webhook ke PC server:

### Option A: Ngrok (Untuk Testing)
```bash
# Install ngrok
brew install ngrok  # macOS

# Jalankan ngrok
ngrok http 3000
```

Output: `https://abc123.ngrok.io` → Gunakan di GitHub webhook

### Option B: Port Forwarding + DDNS
1. Forward port 3000 di router ke IP lokal PC server
2. Setup DDNS (No-IP, DuckDNS)
3. Payload URL: `http://myhome.ddns.net:3000/webhook/github`

### Option C: VPS dengan Public IP
- Pastikan firewall allow port 3000
- Payload URL: `http://123.45.67.89:3000/webhook/github`

---

## 🧪 Cara Test

### Test di Laptop (Manual Mode)
```bash
# 1. Push code
git add .
git commit -m "test webhook"
git push

# 2. Tunggu webhook response (cek server log)

# 3. Restart server manual
pkill -f "node src/server.js" && npm start

# 4. Verify perubahan
curl http://localhost:3000/api/top5
```

### Test di PC Server (PM2 Mode)
```bash
# 1. Push code
git push

# 2. Webhook otomatis pull dan restart

# 3. Verify (no manual restart needed!)
curl http://localhost:3000/api/top5
```

---

## 📝 Generate Signature untuk Testing

Untuk test webhook secara manual (tanpa GitHub):

```bash
node scripts/generate-webhook-signature.js '{"ref":"refs/heads/main"}'
```

Atau dengan Postman:
1. Copy signature dari output script di atas
2. Method: POST
3. URL: `http://localhost:3000/webhook/github`
4. Headers:
   - `Content-Type: application/json`
   - `X-GitHub-Event: push`
   - `X-Hub-Signature-256: <paste-signature>`
5. Body: `{"ref":"refs/heads/main"}`

---

## ⚠️ Catatan Penting

### Security
- **JANGAN** share webhook secret ke publik
- Secret harus kuat (minimal 32 karakter hex)
- Gunakan HTTPS jika memungkinkan (produksi)
- Signature validation selalu aktif

### Downtime

| Mode | Downtime |
|------|----------|
| **Manual** | N/A (Anda control kapan restart) |
| **PM2** | ~1-2 detik (zero-downtime reload) |

### Troubleshooting

| Error | Cause | Solution |
|-------|--------|----------|
| "Invalid signature" | Secret beda | Samakan `.env` dengan GitHub webhook |
| "No signature provided" | Header tidak ada | Cek GitHub webhook config |
| Server tidak restart (manual) | Expected behavior | Restart manual dengan command |
| Server tidak restart (PM2) | PM2 tidak terinstall | Install PM2 di server |

---

## 📚 Referensi

- [GitHub Webhooks Docs](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks)
- [PM2 Docs](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [ngrok Docs](https://ngrok.com/docs)

---

## 📋 Summary

| Environment | Webhook Behavior | Restart Method |
|-------------|-------------------|----------------|
| **Laptop/Dev** | Git pull otomatis | Manual (command) |
| **PC Server** | Git pull otomatis | Auto (PM2 reload) |

Satu file `server.js` bekerja di kedua environment dengan mode yang sesuai! 🎯
