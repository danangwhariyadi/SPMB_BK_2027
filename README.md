# SPMB ONLINE SMK BHINA KARYA KARANGANYAR — TA. 2027/2028

Aplikasi web **Sistem Penerimaan Murid Baru (SPMB)** SMK Bhina Karya Karanganyar yang lengkap dan siap operasional: pendaftaran publik tanpa akun, formulir 5 tahap dengan draft otomatis, nomor pendaftaran & gelombang otomatis, cetak formulir PDF F4 presisi sesuai template asli, cek/ubah pendaftaran dengan PIN + OTP, dashboard panitia dengan RBAC 13 peran, verifikasi dokumen, kesehatan, wawancara, pembayaran, laporan & export, scanner bridge, audit log, dan multi-database (MariaDB → Cloudflare D1 → SQLite) dengan sinkronisasi real-time.

## Struktur Proyek

```
spmb-bhina-karya/
├── server/            Backend Node.js + Express + TypeScript (API, PDF, RBAC, multi-DB)
│   ├── src/db/        Schema SQLite & MariaDB, adapter (SQLite/MariaDB/D1), DatabaseManager
│   ├── src/routes/    public, auth, applicants, documents, assessment, payments, dashboard, admin
│   ├── src/services/  PDF formulir (koordinat absolut), bukti bayar, Excel, storage privat, OTP, notifikasi
│   ├── src/middleware/ auth JWT, RBAC 13 peran, rate limit, audit
│   ├── assets/        logobk.png (logo resmi sekolah)
│   └── src/tests/     Test suite 47 pengujian
├── client/            Frontend React + TypeScript + Tailwind (Vite)
│   ├── src/pages/     Halaman publik (Beranda, Info, Jadwal, Program, Persyaratan, Daftar, Cek, Login)
│   └── src/admin/     Panel panitia (Dashboard, Pendaftaran, Pembayaran, Kesehatan, Wawancara, Verifikasi, Dokumen, Laporan, Pengguna, Pengaturan, Audit)
├── scanner-bridge/    Aplikasi lokal penghubung scanner (SANE/WIA) → website, dengan token auth
├── docs/              Dokumentasi instalasi, deployment, scanner, notifikasi
└── ref/               File referensi (formulir asli & logo)
```

## Menjalankan Cepat (Development)

```bash
npm install
npm run seed        # buat skema + akun demo + data contoh
npm run dev         # server :3001 + client :5173
```

Buka http://localhost:5173 — halaman publik; panel panitia di http://localhost:5173/panel.

### Build produksi

```bash
npm run build       # build client (dist) + server (dist)
npm start           # server menyajikan API + client dist sekaligus (default :3001)
```

## Akun Demo (hasil `npm run seed`)

| Peran | Username | Password |
|---|---|---|
| Administrator | `admin` | `Admin#2027` |
| Ketua Panitia | `ketua` | `Ketua#2027` |
| Sekretaris | `sekretaris` | `Sekre#2027` |
| Bendahara | `bendahara` | `Bendahara#2027` |
| Panitia Pendaftaran | `pendaftaran` | `Daftar#2027` |
| Panitia Kesehatan | `kesehatan` | `Sehat#2027` |
| Panitia Wawancara | `wawancara` | `Wawancara#2027` |
| Panitia Verifikasi | `verifikasi` | `Verif#2027` |
| Panitia Presentasi | `presentasi` | `Present#2027` |
| Panitia Publikasi | `publikasi` | `Publik#2027` |
| Panitia Ketertiban | `ketertiban` | `Tertib#2027` |
| Kepala Sekolah | `kepsek` | `Kepsek#2027` |
| Yayasan | `yayasan` | `Yayasan#2027` |

> Ganti seluruh password demo sebelum dipakai operasional.

## Database (MariaDB → D1 → SQLite)

- **Utama**: MariaDB di server aaPanel — isi `MARIADB_*` di `server/.env` (lihat `server/.env.example` dan `docs/INSTALL.md`).
- **Fallback 1**: Cloudflare D1 — isi `D1_ACCOUNT_ID`, `D1_DATABASE_ID`, `D1_API_TOKEN`.
- **Fallback terakhir**: SQLite lokal di `server/data/spmb.db` (dipakai otomatis bila MariaDB/D1 tidak dikonfigurasi).
- Semua penulisan dieksekusi ke database utama lalu *fan-out* ke database kedua/ketiga; kegagalan dicatat di `sync_log` dan diulang otomatis oleh job rekonsiliasi tiap 5 menit.
- Skema: `server/src/db/schema.sqlite.sql` dan `server/src/db/schema.mysql.sql` (19+ tabel inti: users, roles, permissions, applicants, applicant_parents, applicant_guardians, applicant_achievements, applicant_tka_scores, applicant_preferences, applicant_documents, registration_waves, registration_sequences, health_examinations, interviews, document_verifications, payments, registration_status_history, audit_logs, school_settings, dst).

## Keamanan

- Password bcrypt (10 rounds), JWT access 15 menit + refresh cookie httpOnly 7 hari.
- RBAC 13 peran dengan matriks izin per menu (server-side `requirePerm`); Ketua tidak dapat melihat/membuat akun admin.
- Nomor pendaftaran dari atomic sequence di server (format `A{seq:4}`, dapat diubah di Pengaturan Sistem, khusus Admin/Ketua).
- Validasi server-side, prepared statements, helmet, rate limiting, lockout brute-force (5× → 15 menit).
- Dokumen privat: nama file acak, di luar root publik, akses hanya via **signed URL** berkedaluwarsa (HMAC), validasi MIME/ekstensi, maks 5 MB, tanpa Base64 di database.
- Audit log seluruh aksi penting, sesi calon siswa 30 menit, backup JSON dari menu Pengaturan.

## Dokumentasi Lanjutan

- [docs/INSTALL.md](docs/INSTALL.md) — instalasi lengkap termasuk MariaDB di aaPanel.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deployment produksi (build, nginx/aaPanel, systemd).
- [docs/SCANNER.md](docs/SCANNER.md) — instalasi & penggunaan scanner bridge.
- [docs/NOTIFIKASI.md](docs/NOTIFIKASI.md) — cara mengaktifkan WhatsApp/Email (belum aktif tanpa API key).
- [docs/PANDUAN.md](docs/PANDUAN.md) — panduan penggunaan panitia & alur verifikasi.

## Pengujian

```bash
npm run test        # 47 pengujian: pendaftaran, umur 10 Juli 2027, PDF F4 1 halaman, RBAC, keamanan, export
```
