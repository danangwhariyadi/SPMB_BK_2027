# Scanner Bridge — Pemindaian Dokumen Langsung

Browser tidak memiliki akses langsung ke scanner TWAIN/WIA. Aplikasi ini menyediakan **scanner bridge**: service lokal ringan yang berjalan di komputer panitia, menjembatani scanner dengan website.

## Instalasi (komputer panitia)

```bash
cd scanner-bridge
npm install
SCANNER_BRIDGE_TOKEN=token-rahasia-yang-sama-dengan-server npm start
```

Bridge berjalan di `http://127.0.0.1:45454` — hanya menerima koneksi dari komputer itu sendiri (localhost), sehingga tidak dapat diakses dari luar.

- **Windows**: scanner via WIA (PowerShell) atau `scanimage` bila terpasang.
- **Linux/macOS**: SANE (`scanimage`). Uji dengan `scanimage -L`.

## Konfigurasi di Aplikasi

1. Login panitia → **Pengaturan Sistem** → bagian *Scanner & Notifikasi*:
   - URL Scanner Bridge: `http://127.0.0.1:45454`
   - Token Scanner Bridge: harus sama dengan `SCANNER_BRIDGE_TOKEN` di bridge.
2. Menu **Dokumen** → pilih pendaftar → panel *Scan Dokumen* otomatis memeriksa bridge (indikator "Bridge terhubung").
3. Pilih perangkat, resolusi (150/200/300 DPI), mode warna/grayscale → **Mulai Pindai**.
4. Preview tampil; dapat diputar 90°; simpan langsung ke jenis dokumen terpilih (sumber tercatat `scanner`).

## Keamanan

- Semua endpoint `/devices` dan `/scan` wajib header `x-bridge-token`.
- `/ping` (tanpa auth) hanya untuk cek ketersediaan.
- CORS dibatasi untuk origin development/produksi aplikasi.
- Token dikonfigurasi di server (Pengaturan Sistem) dan di bridge — harus cocok.

## Fallback Bila Scanner Tidak Tersedia

Menu Dokumen tetap menyediakan:
- **Upload komputer** (PDF/JPG/PNG, drag-drop dari file manager).
- **Kamera** perangkat (smartphone/webcam) — untuk foto dokumen atau foto 3×4.

Setiap dokumen menyimpan indikator sumber: `scanner`, `upload`, atau `kamera`.
