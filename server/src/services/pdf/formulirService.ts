import { db } from '../../db';
import { generateFormulir, FormulirData } from './formulir';
import fs from 'fs';
import path from 'path';
import { ageAt10July2027 } from '../../util/helpers';

export async function buildFormulirData(applicantId: number): Promise<FormulirData | null> {
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [applicantId]);
  if (!a) return null;
  const parents = await db.get('SELECT * FROM applicant_parents WHERE applicant_id=?', [applicantId]) || {};
  const guardian = await db.get('SELECT * FROM applicant_guardians WHERE applicant_id=?', [applicantId]) || {};
  const ach = await db.get('SELECT * FROM applicant_achievements WHERE applicant_id=?', [applicantId]) || {};
  const wave = a.wave_id ? await db.get('SELECT nama FROM registration_waves WHERE id=?', [a.wave_id]) : null;
  const tka = await db.all('SELECT * FROM applicant_tka_scores WHERE applicant_id=?', [applicantId]);
  const docs = await db.all('SELECT doc_type, status FROM applicant_documents WHERE applicant_id=?', [applicantId]);

  const tkaMapel = (jenis: string, keyword: string) => {
    const row = tka.find(r => r.jenis === jenis && String(r.mapel).toLowerCase().includes(keyword));
    return row ? String(row.nilai) : '';
  };

  const prestasiText = ach && Number(ach.memiliki) === 1
    ? [ach.nama, ach.tingkat, ach.tahun].filter(Boolean).join(' – ') + (ach.keterangan ? ` (${ach.keterangan})` : '')
    : '';

  const syarat: Record<string, 'Ada' | 'Belum Ada'> = {};
  const typeMap: Record<string, string> = {
    kk: 'kk', akta: 'akta', transkrip: 'transkrip', ijazah: 'ijazah',
    nisn: 'nisn', foto: 'foto', tka: 'tka',
  };
  for (const d of docs) {
    const key = typeMap[d.doc_type];
    if (key) syarat[key] = d.status === 'Ada' ? 'Ada' : 'Belum Ada';
  }

  const umurSetting = await db.get("SELECT svalue FROM school_settings WHERE skey='umur_ref_date'");
  const refDate = umurSetting?.svalue || '2027-07-10';
  const refLabel = refDate.split('-').reverse().join('/');

  return {
    registration_number: a.registration_number || '',
    uniform_size: a.uniform_size || '',
    gelombang: wave?.nama || '',
    nama_lengkap: a.nama_lengkap || '',
    nisn: a.nisn || '',
    tempat_lahir: a.tempat_lahir || '',
    tanggal_lahir: a.tanggal_lahir || '',
    umur_10juli: a.umur_10juli || ageAt10July2027(a.tanggal_lahir),
    jenis_kelamin: a.jenis_kelamin || '',
    jenjang_asal: a.jenjang_asal || '',
    asal_sekolah: a.asal_sekolah || '',
    asal_kecamatan: a.asal_kecamatan || '',
    asal_kabupaten: a.asal_kabupaten || '',
    no_seri_ijazah: a.no_seri_ijazah || '',
    program_keahlian: a.program_keahlian || '',
    agama: a.agama || '',
    alamat: a.alamat || '',
    jarak_km: a.jarak_km,
    berat_badan: a.berat_badan,
    tinggi_badan: a.tinggi_badan,
    hp_siswa: a.hp_siswa || '',
    ayah_nama: parents.ayah_nama || '',
    ayah_pekerjaan: parents.ayah_pekerjaan || '',
    ibu_nama: parents.ibu_nama || '',
    ibu_pekerjaan: parents.ibu_pekerjaan || '',
    ortu_alamat: parents.alamat || '',
    ortu_desa: parents.desa || '',
    ortu_rt: parents.rt || '',
    ortu_rw: parents.rw || '',
    ortu_kelurahan: parents.desa || '',
    ortu_kecamatan: parents.kecamatan || '',
    ortu_hp: parents.ayah_hp || parents.ibu_hp || '',
    wali_nama: guardian.nama || '',
    wali_alamat: guardian.alamat || '',
    wali_rt: guardian.rt || '',
    wali_rw: guardian.rw || '',
    wali_kelurahan: guardian.alamat || '',
    wali_kecamatan: '',
    wali_pekerjaan: guardian.pekerjaan || '',
    wali_hp: guardian.hp || '',
    riwayat_pendaftaran: a.riwayat_pendaftaran || 'Belum pernah',
    riwayat_sekolah: a.riwayat_sekolah || '',
    prestasi_text: prestasiText,
    tka_matematika: tkaMapel('wajib', 'matematika'),
    tka_bahasa: tkaMapel('wajib', 'bahasa indonesia'),
    syarat,
    print_date: new Date(),
    umur_label: refLabel,
    photo: null,
  };
}

export async function renderFormulirPdf(applicantId: number): Promise<Uint8Array | null> {
  const data = await buildFormulirData(applicantId);
  if (!data) return null;
  let logo: Buffer | null = null;
  const logoPath = path.resolve(__dirname, '../../../assets/logobk.png');
  if (fs.existsSync(logoPath)) logo = fs.readFileSync(logoPath);
  return generateFormulir(data, logo);
}
