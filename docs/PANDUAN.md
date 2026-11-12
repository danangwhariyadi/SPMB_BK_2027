# Panduan Penggunaan

## Alur Calon Siswa (Publik)

1. **Beranda** → tombol **DAFTAR SEKARANG**.
2. **Formulir 5 tahap** (draft tersimpan otomatis; aman bila browser tertutup):
   - Tahap 1 Data Diri Siswa — umur dihitung otomatis pada **10 Juli 2027**.
   - Tahap 2 Orang Tua/Wali — checkbox salin alamat wali, validasi nomor HP Indonesia.
   - Tahap 3 Prestasi & Nilai TKA — prestasi boleh dikosongkan.
   - Tahap 4 Program Keahlian (Teknik Mesin / Teknik Otomotif / PPLG) + riwayat pendaftaran.
   - Tahap 5 Upload berkas (JPG/PNG/PDF, kamera, status *Ada/Belum Ada*) + pernyataan kebenaran data + preview sebelum kirim.
3. Setelah kirim: **nomor pendaftaran** (mis. A0001) dan **PIN rahasia** tampil — catat keduanya. Gelombang & tanggal ditetapkan otomatis server.
4. **Cek/Ubah Pendaftaran**: nomor pendaftaran + PIN (OTP WhatsApp bila aktif). Bisa melihat status, mengubah data yang diizinkan, mengganti dokumen, melihat kekurangan dokumen, dan mencetak ulang formulir PDF. Setelah diverifikasi/dikunci, perubahan butuh persetujuan panitia.

## Alur Panitia (Verifikasi)

```
Pendaftaran Baru → Pemeriksaan Administrasi → Verifikasi Dokumen
→ Pemeriksaan Kesehatan → Wawancara → Hasil Akhir
```

Indikator status: Belum diproses · Sedang diproses · Perlu perbaikan · Lengkap · Disetujui · Ditolak.

**Status akhir tidak pernah berubah otomatis** — hanya petugas berwenang melalui menu Verifikasi (Setujui/Tolak). Menyetujui/menolak mengunci data pendaftaran.

## Menu per Peran (ringkas)

| Menu | Akses |
|---|---|
| Dashboard | Semua peran (statistik pembayaran hanya Admin/Ketua/Bendahara) |
| Pendaftaran — Input | Admin, Ketua, Pendaftaran, Presentasi |
| Pendaftaran — Data (edit) | Admin, Ketua, Pendaftaran; peran lain lihat detail |
| Pendaftaran — Rekap | Semua; kolom aksi hanya Admin/Ketua/Pendaftaran |
| Pembayaran | Bendahara (penuh); Admin/Ketua/Pendaftaran/Kepsek/Yayasan view-only; audit log pembayaran untuk Admin/Ketua |
| Kesehatan | Kesehatan (penuh); Admin/Ketua/Kepsek/Yayasan view-only |
| Wawancara | Wawancara (penuh); Admin/Ketua/Kepsek/Yayasan view-only |
| Verifikasi | Verifikasi (penuh); Admin/Ketua view |
| Dokumen | Admin, Ketua, Sekretaris, Pendaftaran, Kesehatan |
| Laporan | Admin, Ketua, Sekretaris, Bendahara, Pendaftaran |
| Manajemen Pengguna | Admin (semua akun); Ketua (semua **kecuali** admin — tidak bisa lihat/buat akun admin) |
| Pengaturan Sistem | Admin, Ketua (termasuk Biaya Tiap Gelombang & Format No. Pendaftaran) |
| Audit Log | Admin, Ketua |

## Dashboard

11 kartu statistik (total, hari ini, per gelombang, per program, dokumen belum lengkap, menunggu verifikasi, terverifikasi, pembayaran bila berwenang), grafik per hari/bulan/gelombang/program/jalur, peta sebaran asal sekolah & domisili, dan filter gelombang/program/status/tanggal.

## Cetak PDF

- Formulir pendaftaran: F4 215×330 mm, tepat 1 halaman, tata letak mengikuti formulir asli (foto kiri atas, nomor/seragam/gelombang kanan atas, bagian 1–11, syarat dengan lingkaran Ada/Belum Ada, blok tanda tangan bawah).
- Tombol tersedia di: Detail Pendaftar (panitia), Input Pendaftaran (setelah simpan), dan Cek/Ubah Pendaftaran (calon siswa).
- Bukti pembayaran PDF oleh Bendahara; laporan dapat dicetak/diekspor Excel.

## Laporan (11 jenis)

Keseluruhan, per gelombang, per program, asal sekolah, per kecamatan, dokumen belum lengkap, hasil kesehatan, hasil wawancara, hasil verifikasi, hasil akhir, ukuran seragam — semuanya dengan filter periode/gelombang/program, cetak, dan export Excel.
