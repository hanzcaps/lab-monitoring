# Panduan Penggunaan System Monitor Dashboard

## 📋 Prasyarat

Sebelum menjalankan aplikasi, pastikan Anda telah menginstall:

1. **Python** (versi 3.8 atau lebih baru) - untuk Backend dan Agent
   - Download dari [python.org](https://python.org)
   - Untuk cek: buka terminal, ketik `python --version`

2. **Node.js** (versi 18 atau lebih baru) - opsional, hanya untuk Frontend
   - Download dari [nodejs.org](https://nodejs.org)
   - Pilih versi LTS (Long Term Support)
   - Setelah install, restart terminal/command prompt

3. **MQTT Broker**
   - Jika belum ada, install Mosquitto MQTT broker
   - Untuk Windows: download dari [Eclipse Mosquitto](https://mosquitto.org/download/)
   - Atau gunakan Docker: `docker run -d -p 1883:1883 eclipse-mosquitto`

## 🚀 Langkah-langkah Instalasi & Menjalankan

### 1. Install Dependencies Backend (Python)

Buka terminal/command prompt, lalu jalankan:

```bash
# Masuk ke folder backend
cd system-monitor-dashboard/backend

# Install semua dependencies Python
pip install -r requirements.txt
```

**Catatan**: Jika muncul error "pip tidak dikenali", pastikan Python sudah terinstall dengan benar.

### 2. Jalankan Backend Server (Python)

```bash
# Masih di folder backend
python server.py
```

Anda akan melihat output seperti:
```
✓ System Monitor Backend starting...
✓ REST API: http://0.0.0.0:3001
✓ WebSocket: ws://0.0.0.0:3002
✓ Health check: http://0.0.0.0:3001/health
✓ Connected to MQTT broker at 192.168.1.11:1883
✓ Subscribed to topic: lab/monitoring/#
```

**Biarkan terminal ini tetap terbuka** - backend harus terus berjalan.

> **Catatan**: Backend juga tersedia dalam versi Node.js. Jika lebih suka menggunakan Node.js, jalankan `npm install` dan `npm start` sebagai ganti dari langkah Python di atas.

### 3. Jalankan Frontend

Ada dua opsi untuk menjalankan frontend:

**Opsi A: Menggunakan Node.js (Development)**

Buka **terminal/command prompt BARU** (jangan tutup backend), lalu:

```bash
# Masuk ke folder frontend
cd system-monitor-dashboard/frontend

# Install semua dependencies
npm install

# Jalankan development server
npm run dev
```

Anda akan melihat output seperti:
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

**Opsi B: Serve Static Files (Production)**

Jika sudah build frontend, Anda bisa menggunakan web server seperti Nginx, Apache, atau Python simple HTTP server:

```bash
# Build frontend terlebih dahulu
cd frontend
npm run build

# Serve dengan Python (port 8000)
python -m http.server 8000 --directory dist
```

**Biarkan terminal ini tetap terbuka** - frontend harus terus berjalan.

### 4. Jalankan Python Agent

Buka **terminal/command prompt BARU LAGI**, lalu:

```bash
# Masuk ke folder dimana agent.py berada
cd path/to/your/agent

# Install dependencies Python
pip install psutil paho-mqtt pynvml pywin32

# Jalankan agent
python agent.py
```

Anda akan melihat output seperti:
```
[*] Menghubungkan ke broker MQTT 192.168.1.11:1883...
[✓] MQTT Terhubung ke 192.168.1.11:1883
[✓] Subscribe ke lab/command/DESKTOP-ABC123
[14:30:00] CPU: 45% | RAM: 60% | Net: 12.5 Mbps
```

### 5. Buka Dashboard di Browser

Buka browser (Chrome, Firefox, Edge, dll) dan akses:
```
http://localhost:3000
```

Anda akan melihat dashboard monitoring yang menampilkan:
- System Information (hostname, user, IP, OS, uptime, CPU name)
- CPU Usage (persentase, cores, threads, GHz)
- Memory Usage (RAM used/total)
- Network (download speed, interface, IP, latency)
- Storage (used/total)
- GPU (nama, temperature, utilization)
- Top Processes (proses dengan CPU & memory tertinggi)

## 🔧 Konfigurasi

### Mengubah MQTT Broker

Jika MQTT broker Anda berjalan di alamat berbeda, edit file `backend/server.py` atau gunakan environment variable:

**Python Backend:**
```bash
# Linux/Mac
export MQTT_BROKER_URL=192.168.1.100
export MQTT_BROKER_PORT=1883
python server.py

# Windows (Command Prompt)
set MQTT_BROKER_URL=192.168.1.100
set MQTT_BROKER_PORT=1883
python server.py
```

**Node.js Backend:**
```javascript
// Atau edit di backend/server.js:
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://ALAMAT_BROKER_ANDA:1883';
```

Atau gunakan environment variable saat menjalankan:
```bash
set MQTT_BROKER_URL=mqtt://192.168.1.100:1883
npm start
```

### Mengubah Port Backend

**Python Backend:**
```bash
# Linux/Mac
export PORT=3002
python server.py

# Windows
set PORT=3002
python server.py
```

**Node.js Backend:**
Edit file `backend/server.js`:
```javascript
const PORT = process.env.PORT || 3001; // Ganti 3001 dengan port lain
```

### Mengubah Port Frontend

Edit file `frontend/vite.config.ts`:
```typescript
server: {
  port: 3000, // Ganti 3000 dengan port lain
}
```

## 🐛 Troubleshooting

### Error: "npm: The term 'npm' is not recognized"

**Solusi**: 
1. Install Node.js dari [nodejs.org](https://nodejs.org)
2. Setelah install, **RESTART terminal/command prompt**
3. Cek dengan: `node --version` dan `npm --version`

### Error: "Cannot find module 'react'"

**Solusi**: 
1. Pastikan sudah menjalankan `npm install` di folder frontend
2. Hapus folder `node_modules` dan `package-lock.json`, lalu `npm install` lagi

### Backend tidak bisa connect ke MQTT broker

**Solusi**:
1. Pastikan MQTT broker sedang berjalan
2. Cek alamat dan port broker di `backend/server.js`
3. Pastikan firewall tidak memblokir port 1883

### Dashboard tidak menampilkan data

**Solusi**:
1. Pastikan backend server berjalan (cek terminal backend)
2. Pastikan Python agent berjalan (cek terminal agent)
3. Refresh browser (Ctrl+R atau F5)
4. Cek console browser (F12) untuk error

### Port sudah digunakan

**Solusi**:
1. Ganti port di konfigurasi (lihat bagian Konfigurasi di atas)
2. Atau matikan aplikasi yang menggunakan port tersebut

## 📊 Cara Membaca Dashboard

### System Information Card
- **Hostname**: Nama komputer yang dimonitor
- **User**: User yang sedang login
- **IP Address**: Alamat IP komputer
- **Operating System**: OS yang digunakan
- **Uptime**: Sudah berapa lama komputer menyala
- **CPU**: Nama prosesor

### CPU Usage Card
- **CPU Usage**: Persentase penggunaan CPU saat ini
- **Lingkaran**: Visualisasi persentase CPU
- **Cores**: Jumlah core fisik CPU
- **Threads**: Jumlah thread (logical cores)
- **Current GHz**: Kecepatan CPU saat ini
- **Max GHz**: Kecepatan maksimum CPU

### Memory Usage Card
- **RAM Usage**: Persentase penggunaan RAM
- **GB Used**: RAM yang sedang digunakan
- **Total**: Total RAM yang tersedia
- **Free**: RAM yang masih bebas
- **Available**: Persentase RAM yang tersedia

### Network Card
- **Mbps Down**: Kecepatan download saat ini
- **Interface**: Network interface yang aktif
- **IP Address**: IP address interface
- **Latency**: Ping ke internet (ms)
- **Traffic**: Total data yang diterima

### Storage Card
- **Used**: Persentase storage yang terpakai
- **GB**: Storage yang digunakan vs total
- **Free**: Storage yang masih bebas

### GPU Card
- **Nama GPU**: Nama kartu grafis
- **Temp**: Suhu GPU (°C)
- **Usage**: Persentase penggunaan GPU
- **VRAM**: Memory GPU yang digunakan

### Top Processes Card
- **Process**: Nama aplikasi/proses
- **CPU**: Persentase CPU yang digunakan proses
- **Memory**: Persentase RAM yang digunakan proses

## 🔄 Menjalankan dalam Production

Untuk deployment production, build frontend terlebih dahulu:

```bash
cd frontend
npm run build
```

Hasil build akan ada di folder `frontend/dist`. Anda bisa menyajikannya dengan web server seperti Nginx atau Apache.

## 📝 Catatan Penting

1. **Jangan tutup terminal** tempat backend dan frontend berjalan saat menggunakan dashboard
2. **Pastikan MQTT broker** selalu berjalan
3. **Python agent** harus berjalan di setiap komputer yang ingin dimonitor
4. Dashboard akan **otomatis update** setiap ada data baru dari agent
5. Jika koneksi terputus, dashboard akan menampilkan status "Disconnected"

## 🆘 Bantuan Lebih Lanjut

Jika mengalami masalah:
1. Cek file `README.md` untuk dokumentasi lengkap
2. Periksa log di terminal backend dan frontend
3. Cek console browser (F12) untuk error JavaScript
4. Pastikan semua dependencies sudah terinstall

---

**Selamat menggunakan System Monitor Dashboard!** 🎉