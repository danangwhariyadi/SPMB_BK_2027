# Instalasi SPMB SMK Bhina Karya Karanganyar

## Prasyarat

- Node.js 18+ (disarankan 20/22 LTS)
- npm 9+
- (Produksi) MariaDB 10.6+ via aaPanel, atau akses ke Cloudflare D1

## 1. Instal Dependensi

```bash
cd spmb-bhina-karya
npm install
```

## 2. Konfigurasi Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

- `PORT` — port API (default 3001).
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SIGNED_URL_SECRET` — **wajib diganti** dengan string acak panjang (mis. `openssl rand -hex 32`).
- `TA=2027/2028`.
- `CORS_ORIGIN` — domain frontend bila dipisah; kosongkan/`*` bila API dan frontend satu domain.

## 3. Database

### Opsi A — MariaDB di aaPanel (utama)

1. Di aaPanel → **Database**, buat database `spmb_bhina_karya` dan user `spmb` dengan password kuat.
2. Impor skema (sekali saja):
   ```bash
   mysql -u spmb -p spmb_bhina_karya < server/src/db/schema.mysql.sql
   ```
3. Isi di `server/.env`:
   ```
   MARIADB_HOST=127.0.0.1
   MARIADB_PORT=3306
   MARIADB_USER=spmb
   MARIADB_PASSWORD=xxxx
   MARIADB_DATABASE=spmb_bhina_karya
   ```

### Opsi B — Cloudflare D1 (fallback tersinkron)

Buat database D1 di dashboard Cloudflare, lalu isi:

```
D1_ACCOUNT_ID=...
D1_DATABASE_ID=...
D1_API_TOKEN=...
```

Impor skema ke D1: jalankan isi `server/src/db/schema.sqlite.sql` melalui `wrangler d1 execute <db> --file=...` atau dashboard Cloudflare.

### Opsi C — SQLite lokal (fallback terakhir, otomatis)

Tanpa konfigurasi apa pun aplikasi memakai `server/data/spmb.db`. Cocok untuk uji coba.

> **Sinkronisasi**: semua tulisan masuk ke database utama lalu diduplikasi ke database lain (write-through). Kegagalan replikasi dicatat di tabel `sync_log` dan diulang otomatis tiap 5 menit.

## 4. Seed Data Awal

```bash
npm run seed
```

Membuat: peran + matriks izin, 13 akun demo, pengaturan sekolah, 3 gelombang (INDEN, Gel 1, Gel 2), sequence nomor pendaftaran `A{seq:4}`, jenis biaya, pertanyaan wawancara contoh, dan data pendaftar contoh.

## 5. Jalankan

Development:

```bash
npm run dev       # API :3001, client Vite :5173 (proxy /api)
```

Produksi:

```bash
npm run build     # build client → client/dist, build server → server/dist
npm start         # server menyajikan API + client/dist di PORT
```

## 6. File & Storage Dokumen

Dokumen disimpan privat di `server/storage/documents/...` dengan nama acak. **Pastikan folder ini tidak dapat diakses web secara langsung** (tidak diletakkan di root domain). Akses file hanya melalui signed URL berkedaluwarsa dari API.

## 7. Logo & Template

- `server/assets/logobk.png` — logo resmi (dipakai PDF cetak dan disalin ke `client/public/`).
- Template PDF formulir diukur dari file referensi `Formulir Pendaftaran-2027-2028.pdf` (F4 215×330 mm) dan dirender dengan koordinat absolut di `server/src/services/pdf/formulir.ts`. Jangan ubah koordinat tanpa memverifikasi ulang hasil cetak.

## 8. Setelah Instalasi (checklist)

1. Login admin → ganti password akun demo.
2. Pengaturan Sistem → identitas sekolah, kontak, format nomor pendaftaran, biaya tiap gelombang.
3. Pengaturan Sistem → jadwal gelombang (tanggal mulai/selesai, kuota per program, status aktif).
4. Uji pendaftaran publik dari perangkat nyata, lalu cek/ubah dengan PIN.
5. Uji cetak formulir PDF (harus 1 halaman F4, tanpa teks terpotong).
