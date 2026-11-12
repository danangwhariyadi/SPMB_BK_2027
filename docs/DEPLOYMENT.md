# Deployment Produksi

## 1. Build

```bash
cd spmb-bhina-karya
npm ci --workspaces --include-workspace-root
npm run build       # client/dist + server/dist
npm run seed        # hanya saat pertama kali (atau saat skema baru)
```

Server produksi (`npm start`) menjalankan `server/dist/index.js`, menyajikan:
- API di `/api/*`
- Frontend statis dari `client/dist` dengan SPA fallback (semua path non-API → `index.html`)

Satu proses Node cukup; tidak perlu nginx untuk aplikasi kecil — tetap disarankan nginx sebagai reverse proxy + TLS.

## 2. Environment Produksi (`server/.env`)

```
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://spmb.sekolah.sch.id
JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
SIGNED_URL_SECRET=<openssl rand -hex 32>
MARIADB_HOST=127.0.0.1
MARIADB_USER=spmb
MARIADB_PASSWORD=<password>
MARIADB_DATABASE=spmb_bhina_karya
D1_ACCOUNT_ID=<opsional>
D1_DATABASE_ID=<opsional>
D1_API_TOKEN=<opsional>
```

## 3. aaPanel

1. **Python Project / Node Project** → tambah proyek, arahkan ke folder repo, start command `npm start`, port 3001.
2. **Website** → buat situs `spmb.sekolah.sch.id` → reverse proxy ke `http://127.0.0.1:3001`.
3. Aktifkan SSL (Let's Encrypt) pada situs.
4. Pastikan folder `server/storage/` **tidak** berada di dalam root situs web (tetap di folder proyek, diakses API saja).

### Alternatif nginx manual

```nginx
server {
  listen 443 ssl;
  server_name spmb.sekolah.sch.id;
  client_max_body_size 10m;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 4. Systemd (VPS non-aaPanel)

```ini
# /etc/systemd/system/spmb.service
[Unit]
Description=SPMB SMK Bhina Karya
After=network.target mariadb.service

[Service]
WorkingDirectory=/opt/spmb-bhina-karya/server
ExecStart=/usr/bin/node dist/index.js
EnvironmentFile=/opt/spmb-bhina-karya/server/.env
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now spmb
```

## 5. Backup

- Otomatis: cron harian `mysqldump spmb_bhina_karya | gzip > /backup/spmb-$(date +%F).sql.gz`
- Manual dari aplikasi: **Pengaturan Sistem → Backup Database** (JSON seluruh tabel).
- Folder `server/storage/` ikut disertakan dalam backup file (rsync harian disarankan).

## 6. Pembaruan Aplikasi

```bash
cd /opt/spmb-bhina-karya
git pull
npm run build
systemctl restart spmb
```

Jika skema berubah, jalankan ulang impor `schema.mysql.sql` hanya untuk perubahan yang ditambahkan (skema idempoten per tabel `CREATE TABLE IF NOT EXISTS`).
