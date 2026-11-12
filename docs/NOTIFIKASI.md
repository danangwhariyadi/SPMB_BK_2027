# Notifikasi WhatsApp & Email

> **Status bawaan: BELUM AKTIF.** Aplikasi tidak mengklaim integrasi WhatsApp/Email berjalan sebelum API key diisi. Selama belum dikonfigurasi, sistem tetap berfungsi normal dan status pengiriman dilaporkan apa adanya ("belum dikonfigurasi").

## WhatsApp (Meta WhatsApp Business Cloud API)

Isi di `server/.env`:

```
WA_PROVIDER=meta
WA_API_URL=https://graph.facebook.com/v19.0/<PHONE_NUMBER_ID>/messages
WA_API_TOKEN=<permanent access token>
```

Format pesan yang dikirim backend: template teks biasa ke nomor tujuan dalam format `62xxxxxxxxxx`.

## Email (SMTP)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=spmb@sekolah.sch.id
SMTP_PASS=<app password>
EMAIL_FROM=SPMB SMK Bhina Karya <spmb@sekolah.sch.id>
```

## Pemicu Notifikasi di Sistem

| Peristiwa | Template |
|---|---|
| Pendaftaran berhasil + nomor diterbitkan | `pendaftaranBerhasil` |
| Dokumen perlu diperbaiki | `dokumenPerluPerbaikan` |
| Dokumen dinyatakan lengkap | `dokumenLengkap` |
| Jadwal wawancara diterbitkan | `jadwalWawancara` |
| Hasil akhir diumumkan | `hasilAkhir` |

## OTP Cek/Ubah Pendaftaran

Bila WhatsApp aktif, login **Cek/Ubah Pendaftaran** otomatis meminta OTP 6 digit ke nomor HP pendaftar (berlaku 5 menit, maks 5 percobaan). Bila tidak aktif, PIN rahasia menjadi autentikasi utama.

Verifikasi: setelah mengisi env, restart server dan lakukan satu pendaftaran uji — log server akan menampilkan status pengiriman.
