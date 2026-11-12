import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';

/**
 * Generator Formulir Pendaftaran PDF — F4/Folio 215.94 x 330.05 mm
 * (612.12 x 935.58 pt), satu halaman, koordinat absolut hasil pengukuran
 * dokumen referensi "Formulir Pendaftaran 2027-2028.pdf".
 */

export const F4 = { width: 612.12, height: 935.58 };

export interface FormulirData {
  registration_number: string;
  uniform_size: string;
  gelombang: string;
  nama_lengkap: string;
  nisn: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  umur_10juli: string;
  jenis_kelamin: string;
  jenjang_asal: string;
  asal_sekolah: string;
  asal_kecamatan: string;
  asal_kabupaten: string;
  no_seri_ijazah: string;
  program_keahlian: string;
  agama: string;
  alamat: string;
  jarak_km: number | null;
  berat_badan: number | null;
  tinggi_badan: number | null;
  hp_siswa: string;
  ayah_nama: string;
  ayah_pekerjaan: string;
  ibu_nama: string;
  ibu_pekerjaan: string;
  ortu_alamat: string;
  ortu_desa: string;
  ortu_rt: string;
  ortu_rw: string;
  ortu_kelurahan: string;
  ortu_kecamatan: string;
  ortu_hp: string;
  wali_nama: string;
  wali_alamat: string;
  wali_rt: string;
  wali_rw: string;
  wali_kelurahan: string;
  wali_kecamatan: string;
  wali_pekerjaan: string;
  wali_hp: string;
  riwayat_pendaftaran: string;
  riwayat_sekolah: string;
  prestasi_text: string;
  tka_matematika: string;
  tka_bahasa: string;
  syarat: Record<string, 'Ada' | 'Belum Ada'>;
  print_date: Date;
  umur_label: string;
  photo?: Buffer | null;
}

const BLACK = rgb(0, 0, 0);

export async function generateFormulir(data: FormulirData, logoPng?: Buffer | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([F4.width, F4.height]);
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const t = (text: string, x: number, y: number, size = 10.5, f: PDFFont = font) => {
    if (text) page.drawText(text, { x, y, size, font: f, color: BLACK });
  };
  // Teks dengan penskalaan otomatis agar tidak melewati batas kanan.
  const fit = (text: string, x: number, y: number, maxW: number, size = 10.5, f: PDFFont = font, minSize = 7.5) => {
    if (!text) return;
    let s = size;
    while (s > minSize && f.widthOfTextAtSize(text, s) > maxW) s -= 0.25;
    if (f.widthOfTextAtSize(text, s) > maxW) {
      let out = text;
      while (out.length > 3 && f.widthOfTextAtSize(out + '…', s) > maxW) out = out.slice(0, -1);
      text = out + '…';
    }
    page.drawText(text, { x, y, size: s, font: f, color: BLACK });
  };
  // Garis isian (menggantikan titik-titik formulir asli); bila ada nilai,
  // nilai dicetak di atas garis.
  const line = (x0: number, x1: number, y: number) => {
    page.drawLine({ start: { x: x0, y: y - 2.5 }, end: { x: x1, y: y - 2.5 }, thickness: 0.7, color: BLACK });
  };
  const field = (value: string, x0: number, x1: number, y: number, maxW = x1 - x0 - 4, size = 10.5) => {
    line(x0, x1, y);
    if (value) fit(value, x0 + 2, y, maxW, size);
  };
  const circleText = (text: string, x: number, y: number, size = 10.5, f: PDFFont = font) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawEllipse({
      x: x + w / 2, y: y + size * 0.32,
      xScale: w / 2 + 5, yScale: size * 0.85,
      borderWidth: 1, borderColor: BLACK,
    });
    t(text, x, y, size, f);
  };

  // ===== Bagian atas =====
  page.drawRectangle({ x: 28, y: F4.height - 143, width: 85, height: 113, borderWidth: 1, borderColor: BLACK });
  t('Foto 3 x 4', 44, F4.height - 90, 8, italic);

  if (logoPng) {
    try {
      const img = await doc.embedPng(logoPng);
      page.drawImage(img, { x: F4.width / 2 - 26, y: F4.height - 88, width: 52, height: 52 });
    } catch { /* logo tidak valid: abaikan */ }
  }

  t('No. Pendaftaran :', 397, F4.height - 58, 11);
  t(data.registration_number, 490, F4.height - 58, 11, bold);
  t('Ukuran Seragam :', 397, F4.height - 71, 11);
  t(data.uniform_size, 490, F4.height - 71, 11, bold);
  t('Gelombang :', 397, F4.height - 84, 11);
  t(data.gelombang, 490, F4.height - 84, 11, bold);

  const center = (text: string, y: number, size: number, f: PDFFont) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (F4.width - w) / 2, y, size, font: f, color: BLACK });
  };
  center('FORMULIR PENDAFTARAN', F4.height - 110, 13, bold);
  center('CALON PESERTA DIDIK BARU KELAS X (SEPULUH)', F4.height - 121.5, 11.5, bold);
  center('SMK BHINA KARYA KARANGANYAR TA. 2027/2028', F4.height - 134, 11.5, bold);

  // ===== 1-5 =====
  t('1.', 53, F4.height - 161.5); t('Nama Lengkap', 67.4, F4.height - 161.5); t(':', 253.8, F4.height - 161.5);
  field(data.nama_lengkap, 261.8, 545, F4.height - 161.5);

  t('2.', 53, F4.height - 177.5); t('Nomor Induk Siswa Nasional (NISN)', 66.5, F4.height - 177.5); t(':', 253.8, F4.height - 177.5);
  field(data.nisn, 261.8, 545, F4.height - 177.5);

  t('3.', 53, F4.height - 192.5); t('Tempat dan Tanggal Lahir', 66.7, F4.height - 192.5); t(':', 253.8, F4.height - 192.5);
  const tgl = data.tanggal_lahir ? formatDateLong(data.tanggal_lahir) : '';
  field([data.tempat_lahir, tgl].filter(Boolean).join(', '), 259, 545, F4.height - 192.5);

  t('4.', 53, F4.height - 208.5); t('Jenis Kelamin', 67.1, F4.height - 208.5); t(':', 253.8, F4.height - 208.5);
  const lk = 'Laki –laki', pr = 'Perempuan';
  t(lk + ' /', 264.6, F4.height - 208.5);
  const lkW = font.widthOfTextAtSize(lk + ' / ', 10.5);
  t(pr, 264.6 + lkW + 6, F4.height - 208.5);
  if (data.jenis_kelamin === 'Laki-laki') circleText(lk, 264.6, F4.height - 208.5);
  if (data.jenis_kelamin === 'Perempuan') circleText(pr, 264.6 + lkW + 6, F4.height - 208.5);

  t('5.', 53, F4.height - 224.5); t(`Umur pada tanggal ${data.umur_label}`, 66.8, F4.height - 224.5); t(':', 253.8, F4.height - 224.5);
  field(data.umur_10juli, 261.8, 545, F4.height - 224.5);

  // ===== 6 =====
  t('6.', 53, F4.height - 239.5); t('Asal Sekolah', 66.5, F4.height - 239.5);
  t('a.', 67.1, F4.height - 255.5); t('SMP / MTs / Paket', 83.6, F4.height - 255.5); t(':', 250.9, F4.height - 255.5);
  field([data.jenjang_asal, data.asal_sekolah].filter(Boolean).join(' – '), 259, 545, F4.height - 255.5);
  t('b.', 68, F4.height - 270.5); t('Kecamatan, Kabupaten / Kota', 84.5, F4.height - 270.5); t(':', 250.9, F4.height - 270.5);
  field([data.asal_kecamatan, data.asal_kabupaten].filter(Boolean).join(', '), 259, 545, F4.height - 270.5);

  // ===== 7 =====
  t('7.', 53, F4.height - 286.5); t('Pilihan Program Keahlian', 66.4, F4.height - 286.5); t(':', 250.9, F4.height - 286.5);
  const optA = 'A.  TEKNIK MESIN';
  const optB = 'B.  TEKNIK  OTOMOTIF';
  const optC = 'C.  PENGEMBANGAN PERANGKAT LUNAK DAN GIM (PPLG)';
  t(optA, 258.6, F4.height - 286.5);
  t('(Lingkari Jurusan yang dipilih)', 64.3, F4.height - 305.5, 10.5, italic);
  t(optB, 259.4, F4.height - 305.5);
  t(optC, 259.4, F4.height - 324.5);
  if (data.program_keahlian === 'TEKNIK MESIN') circleText(optA, 258.6, F4.height - 286.5);
  if (data.program_keahlian === 'TEKNIK OTOMOTIF') circleText(optB, 259.4, F4.height - 305.5);
  if (data.program_keahlian === 'PPLG') circleText(optC, 259.4, F4.height - 324.5);

  // ===== 8 =====
  t('8.', 52.8, F4.height - 343.5); t('Data Khusus Siswa', 66.7, F4.height - 343.5);
  t('a.', 66.5, F4.height - 358.5); t('Agama', 80.1, F4.height - 358.5); t(':', 250.9, F4.height - 358.5);
  field(data.agama, 259, 545, F4.height - 358.5);
  t('b.', 65.9, F4.height - 374.5); t('Alamat Calon Siswa', 79.7, F4.height - 374.5); t(':', 250.9, F4.height - 374.5);
  field(data.alamat, 259, 545, F4.height - 374.5);
  t('c.', 68, F4.height - 390.5); t('Nama Orang Tua', 80.7, F4.height - 390.5); t(':', 250.9, F4.height - 390.5);
  t('Ayah Kandung', 259.4, F4.height - 390.5); t(':', 329.3, F4.height - 390.5);
  field(data.ayah_nama, 334.6, 545, F4.height - 390.5);
  t('Ibu Kandung', 259.4, F4.height - 408.5); t(':', 332, F4.height - 408.5);
  field(data.ibu_nama, 337.2, 545, F4.height - 408.5);
  t('d.', 68.8, F4.height - 427.5); t('Pekerjaan Orang Tua', 82.4, F4.height - 427.5); t(':', 250.9, F4.height - 427.5);
  t('Ayah', 259, F4.height - 427.5); t(':', 290.6, F4.height - 427.5);
  field(data.ayah_pekerjaan, 295.9, 545, F4.height - 427.5);
  t('Ibu', 258.6, F4.height - 445.5); t(':', 289.7, F4.height - 445.5);
  field(data.ibu_pekerjaan, 297.4, 545, F4.height - 445.5);
  t('e.', 65.9, F4.height - 464.5); t('Alamat Orang Tua Calon Siswa', 79.6, F4.height - 464.5); t(':', 250.9, F4.height - 464.5);
  t('Desa', 259, F4.height - 464.5);
  field(data.ortu_desa, 285.4, 372, F4.height - 464.5, 84);
  t('RT.', 425.4, F4.height - 464.5);
  field(data.ortu_rt, 442.4, 478, F4.height - 464.5, 32);
  t('RW.', 481.9, F4.height - 464.5);
  field(data.ortu_rw, 502.9, 545, F4.height - 464.5, 38);
  t('Kelurahan', 259.4, F4.height - 483.5);
  field(data.ortu_kelurahan, 306.4, 404, F4.height - 483.5, 94);
  t('Kecamatan', 408.1, F4.height - 483.5);
  field(data.ortu_kecamatan, 454.4, 545, F4.height - 483.5, 86);
  t('f.', 65.9, F4.height - 501.5); t('No. HP Siswa', 76.8, F4.height - 501.5); t(':', 250.9, F4.height - 501.5);
  field(data.hp_siswa, 259, 545, F4.height - 501.5);
  t('g.', 63.1, F4.height - 520.5); t('No. HP Orang Tua', 76.8, F4.height - 520.5); t(':', 250.9, F4.height - 520.5);
  field(data.ortu_hp, 259, 545, F4.height - 520.5);
  t('h.', 65.9, F4.height - 538.5); t('Nama Wali', 79.4, F4.height - 538.5); t(':', 250.9, F4.height - 538.5);
  field(data.wali_nama, 259, 545, F4.height - 538.5);
  t('i.', 65.9, F4.height - 557.5); t('Alamat Wali', 79.4, F4.height - 557.5); t(':', 250.9, F4.height - 557.5);
  field(data.wali_alamat, 259, 364, F4.height - 557.5, 100);
  t('RT.', 417.2, F4.height - 557.5);
  field(data.wali_rt, 433.5, 474, F4.height - 557.5, 36);
  t('RW.', 478.3, F4.height - 557.5);
  field(data.wali_rw, 498.9, 545, F4.height - 557.5, 42);
  t('Kelurahan', 259.4, F4.height - 576.5);
  field(data.wali_kelurahan, 306.4, 400, F4.height - 576.5, 90);
  t('Kecamatan', 402.9, F4.height - 576.5);
  field(data.wali_kecamatan, 454.1, 545, F4.height - 576.5, 86);
  t('j.', 65.9, F4.height - 594.5); t('Pekerjaan Wali', 79.6, F4.height - 594.5); t(':', 250.9, F4.height - 594.5);
  field(data.wali_pekerjaan, 259, 545, F4.height - 594.5);
  t('k.', 65.9, F4.height - 613.5); t('No. HP Wali', 79.6, F4.height - 613.5); t(':', 250.9, F4.height - 613.5);
  field(data.wali_hp, 259, 545, F4.height - 613.5);

  // ===== 9 =====
  t('9.', 52.4, F4.height - 631.5); t('Prestasi / Piagam Kejuaraan', 65.8, F4.height - 631.5); t(':', 250.9, F4.height - 631.5);
  field(data.prestasi_text, 259, 545, F4.height - 631.5);

  // ===== 10 =====
  t('10.', 46.2, F4.height - 650.5); t('Nilai TKA', 66.4, F4.height - 650.5); t(':', 250.9, F4.height - 650.5);
  t('a.', 67.9, F4.height - 666.5); t('Mata Matematika', 81.5, F4.height - 666.5); t(':', 250.9, F4.height - 666.5);
  field(data.tka_matematika, 259, 350, F4.height - 666.5, 85);
  t('b.', 67.9, F4.height - 681.5); t('Mata Bahasa Indonesia', 81, F4.height - 681.5); t(':', 250.9, F4.height - 681.5);
  field(data.tka_bahasa, 259, 350, F4.height - 681.5, 85);

  // ===== 11 =====
  t('11.', 48.1, F4.height - 697.5); t('Syarat Pendaftaran', 66.3, F4.height - 697.5); t(':', 152.8, F4.height - 697.5);
  const syaratItems: Array<[string, string, number]> = [
    ['1.', 'FC Ijazah', F4.height - 712.5],
    ['2.', 'FC Kartu Keluarga', F4.height - 725.5],
    ['3.', 'FC Akte Kelahiran', F4.height - 738.5],
    ['4.', 'FC Nilai TKA', F4.height - 750.5],
    ['5.', 'FC Transkrip Nilai', F4.height - 763.5],
    ['6.', 'FC Kartu NISN', F4.height - 775.5],
    ['7.', 'Foto Hitam Putih 3 x 4  ( 6 lembar )', F4.height - 788.5],
  ];
  const syaratKeyMap: Record<string, string> = {
    '1.': 'ijazah', '2.': 'kk', '3.': 'akta', '4.': 'tka',
    '5.': 'transkrip', '6.': 'nisn', '7.': 'foto',
  };
  for (const [no, label, y] of syaratItems) {
    t(no, 63.8, y); t(label, 76.6, y); t(':', 250.9, y);
    const status = data.syarat[syaratKeyMap[no]] || 'Belum Ada';
    const ada = '(Ada', slash = '/', belum = 'Belum Ada)';
    let x = 258.6;
    t(ada, x, y); x += font.widthOfTextAtSize(ada + ' ', 10.5);
    t(slash, x, y); x += font.widthOfTextAtSize(slash + ' ', 10.5);
    t(belum, x, y);
    if (status === 'Ada') circleText(ada, 258.6, y);
    else circleText(belum, 258.6 + font.widthOfTextAtSize(ada + ' ' + slash + ' ', 10.5), y);
  }

  // ===== Bagian bawah =====
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const d = data.print_date;
  const tanggalCetak = `${d.getDate()} ${bulan[d.getMonth()]}`;
  t(`Karanganyar, ${tanggalCetak} 2027`, 359, F4.height - 813.5);
  t('Petugas Pendaftar,', 108.3, F4.height - 826.5);
  t('Calon Siswa Baru,', 359, F4.height - 826.5);
  line(105.4, 240, F4.height - 876);
  line(359, 500, F4.height - 876);
  if (data.nama_lengkap) {
    const w = bold.widthOfTextAtSize(data.nama_lengkap, 10.5);
    t(data.nama_lengkap, 359 + (141 - w) / 2, F4.height - 889, 10.5, bold);
  }

  return doc.save();
}

function formatDateLong(iso: string): string {
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}
