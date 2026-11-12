export const ROLES: Record<string, { name: string; description: string }> = {
  admin: { name: 'Administrator', description: 'Akses seluruh menu dan konfigurasi sistem' },
  ketua: { name: 'Ketua Panitia', description: 'Pengelolaan panitia, gelombang, kuota, konfigurasi biaya' },
  sekretaris: { name: 'Sekretaris', description: 'Administrasi pendaftaran, arsip, laporan, cetak formulir' },
  bendahara: { name: 'Bendahara', description: 'Input dan kelola pembayaran, cetak bukti, laporan keuangan' },
  pendaftaran: { name: 'Panitia Pendaftaran', description: 'Input pendaftaran, upload/scan dokumen, cetak formulir' },
  kesehatan: { name: 'Panitia Kesehatan', description: 'Pemeriksaan dan catatan kesehatan calon siswa' },
  wawancara: { name: 'Panitia Wawancara', description: 'Pertanyaan, hasil, dan rekomendasi wawancara' },
  verifikasi: { name: 'Panitia Verifikasi', description: 'Pemeriksaan berkas dan validasi dokumen' },
  presentasi: { name: 'Panitia Presentasi', description: 'Dukungan presentasi dan input pendaftaran' },
  publikasi: { name: 'Panitia Publikasi', description: 'Dokumentasi dan publikasi (view-only)' },
  ketertiban: { name: 'Panitia Ketertiban', description: 'Ketertiban lokasi (view-only)' },
  kepala_sekolah: { name: 'Kepala Sekolah', description: 'Monitoring seluruh kegiatan (view-only)' },
  yayasan: { name: 'Yayasan', description: 'Monitoring yayasan (view-only)' },
};

export interface Perm {
  can_view: number;
  can_create: number;
  can_edit: number;
  can_delete: number;
}

type Matrix = Record<string, Perm>;

const V: Perm = { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0 };
const VC: Perm = { can_view: 1, can_create: 1, can_edit: 0, can_delete: 0 };
const VCE: Perm = { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0 };
const FULL: Perm = { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 };
const NONE: Perm = { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0 };

export const PERMISSIONS: Record<string, Matrix> = {
  admin: {
    dashboard: FULL, pendaftaran: FULL, pembayaran: FULL, kesehatan: FULL,
    wawancara: FULL, verifikasi: FULL, dokumen: FULL, laporan: FULL,
    pengguna: FULL, pengaturan: FULL, audit: FULL, backup: FULL,
  },
  ketua: {
    dashboard: VCE, pendaftaran: FULL, pembayaran: V, kesehatan: V,
    wawancara: V, verifikasi: V, dokumen: VCE, laporan: V,
    pengguna: VCE, pengaturan: VCE, audit: V, backup: NONE,
  },
  sekretaris: {
    dashboard: V, pendaftaran: V, pembayaran: NONE, kesehatan: NONE,
    wawancara: NONE, verifikasi: NONE, dokumen: VCE, laporan: VCE,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
  bendahara: {
    dashboard: VCE, pendaftaran: V, pembayaran: FULL, kesehatan: NONE,
    wawancara: NONE, verifikasi: NONE, dokumen: NONE, laporan: V,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
  pendaftaran: {
    dashboard: V, pendaftaran: FULL, pembayaran: V, kesehatan: NONE,
    wawancara: NONE, verifikasi: NONE, dokumen: VCE, laporan: V,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
  kesehatan: {
    dashboard: V, pendaftaran: NONE, pembayaran: NONE, kesehatan: FULL,
    wawancara: NONE, verifikasi: NONE, dokumen: V, laporan: NONE,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
  wawancara: {
    dashboard: V, pendaftaran: NONE, pembayaran: NONE, kesehatan: NONE,
    wawancara: FULL, verifikasi: NONE, dokumen: V, laporan: NONE,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
  verifikasi: {
    dashboard: V, pendaftaran: NONE, pembayaran: NONE, kesehatan: NONE,
    wawancara: NONE, verifikasi: FULL, dokumen: VCE, laporan: NONE,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
  presentasi: {
    dashboard: V, pendaftaran: VC, pembayaran: NONE, kesehatan: NONE,
    wawancara: NONE, verifikasi: NONE, dokumen: V, laporan: NONE,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
  publikasi: {
    dashboard: V, pendaftaran: V, pembayaran: NONE, kesehatan: NONE,
    wawancara: NONE, verifikasi: NONE, dokumen: NONE, laporan: NONE,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
  ketertiban: {
    dashboard: V, pendaftaran: V, pembayaran: NONE, kesehatan: NONE,
    wawancara: NONE, verifikasi: NONE, dokumen: NONE, laporan: NONE,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
  kepala_sekolah: {
    dashboard: V, pendaftaran: V, pembayaran: V, kesehatan: V,
    wawancara: V, verifikasi: V, dokumen: V, laporan: V,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
  yayasan: {
    dashboard: V, pendaftaran: V, pembayaran: V, kesehatan: V,
    wawancara: V, verifikasi: V, dokumen: V, laporan: V,
    pengguna: NONE, pengaturan: NONE, audit: NONE, backup: NONE,
  },
};

export function getPerm(role: string, menu: string): Perm {
  return PERMISSIONS[role]?.[menu] ?? NONE;
}
