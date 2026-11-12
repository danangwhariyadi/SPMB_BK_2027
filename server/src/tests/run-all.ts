/**
 * Pengujian menyeluruh SPMB — menjalankan server pada port test,
 * menguji alur pendaftaran, keamanan, dan PDF.
 * Jalankan: npm run test  (dari folder server)
 */
import 'dotenv/config';
import { spawn } from 'child_process';
import path from 'path';

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✘ ${name} ${extra}`); }
}

async function api(method: string, url: string, body?: any, headers: any = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* biner */ }
  return { status: res.status, json, res };
}

async function main() {
  console.log('Memulai server uji...');
  const server = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  await new Promise(r => setTimeout(r, 6000));

  try {
    // ===== Kesehatan & info publik =====
    console.log('[Pengujian Publik]');
    const health = await api('GET', '/api/health');
    ok('Server berjalan', health.status === 200);
    const info = await api('GET', '/api/public/info');
    ok('Info publik tersedia', info.status === 200 && info.json.waves.length >= 1);
    const waveStatus = await api('GET', '/api/public/wave-status');
    ok('Gelombang otomatis aktif', waveStatus.json.open === true && !!waveStatus.json.wave?.nama);

    // ===== Draft autosave =====
    const draft = await api('POST', '/api/public/draft', {
      step: 2,
      data: { siswa: { nama_lengkap: 'Uji Draft', nisn: '0061234567', hp_siswa: '081234567890' } },
    });
    ok('Draft tersimpan', draft.status === 200 && !!draft.json.draft_token);
    const draftGet = await api('GET', `/api/public/draft/${draft.json.draft_token}`);
    ok('Draft dapat dimuat ulang', draftGet.status === 200 && draftGet.json.data?.siswa?.nama_lengkap === 'Uji Draft');

    // ===== Pendaftaran lengkap =====
    const payload = {
      draft_token: draft.json.draft_token,
      data: {
        siswa: {
          nama_lengkap: 'Siswa Uji Otomatis', nisn: '0067788990', tempat_lahir: 'Karanganyar',
          tanggal_lahir: '2010-05-15', jenis_kelamin: 'Laki-laki', agama: 'Islam',
          alamat: 'Jl. Uji No. 1', desa: 'Peled', kecamatan: 'Karanganyar', kabupaten: 'Karanganyar',
          jarak_km: 5, hp_siswa: '081234567890', berat_badan: 55, tinggi_badan: 165,
          jenjang_asal: 'SMP', asal_sekolah: 'SMP Negeri 1 Karanganyar', asal_kecamatan: 'Karanganyar',
          asal_kabupaten: 'Karanganyar', no_seri_ijazah: '', uniform_size: 'L',
        },
        ortu: {
          ayah_nama: 'Ayah Uji', ayah_pekerjaan: 'Petani', ayah_hp: '081234567891',
          ibu_nama: 'Ibu Uji', ibu_pekerjaan: 'Ibu Rumah Tangga', ibu_hp: '081234567892',
          alamat: 'Jl. Uji No. 1', rt: '01', rw: '02', desa: 'Peled', kecamatan: 'Karanganyar', kabupaten: 'Karanganyar',
        },
        wali: { nama: '', sama_dengan_ortu: true },
        prestasi: { memiliki: 'Ya', nama: 'Juara LKS', tingkat: 'Kabupaten', tahun: '2026', keterangan: '' },
        tka: [
          { jenis: 'wajib', mapel: 'Matematika', nilai: 85 },
          { jenis: 'wajib', mapel: 'Bahasa Indonesia', nilai: 88 },
          { jenis: 'pilihan', mapel: 'Bahasa Inggris', nilai: 90 },
        ],
        pilihan: { program_keahlian: 'PPLG' },
        riwayat: { pernah: false },
        pernyataan: true,
      },
    };

    // Validasi: pernyataan wajib
    const bad = await api('POST', '/api/public/register', { ...payload, data: { ...payload.data, pernyataan: false } });
    ok('Validasi pernyataan bekerja', bad.status === 400);

    // Validasi: NISN salah
    const badNisn = await api('POST', '/api/public/register', { ...payload, data: { ...payload.data, siswa: { ...payload.data.siswa, nisn: '123' } } });
    ok('Validasi NISN bekerja', badNisn.status === 400);

    const reg = await api('POST', '/api/public/register', payload);
    ok('Pendaftaran berhasil', reg.status === 200 && !!reg.json.registration_number, JSON.stringify(reg.json));
    ok('Format nomor pendaftaran A0001', /^A\d{4}$/.test(reg.json.registration_number || ''), reg.json.registration_number);

    const reg2 = await api('POST', '/api/public/register', {
      ...payload, data: { ...payload.data, siswa: { ...payload.data.siswa, nama_lengkap: 'Siswa Kedua', nisn: '0067788991' } },
    });
    ok('Nomor pendaftaran unik bertambah', reg2.json.registration_number !== reg.json.registration_number);

    // Umur pada 10 Juli 2027 (lahir 2010-05-15 => 17 tahun 1 bulan 25 hari)
    console.log('[Pengujian Umur]');
    const age = await api('GET', '/api/public/info'); // smoke
    ok('Server tetap responsif', age.status === 200);

    // ===== Cek/ubah pendaftaran =====
    console.log('[Pengujian Cek/Ubah]');
    const wrongPin = await api('POST', '/api/public/check/start', { registration_number: reg.json.registration_number, pin: 'SALAH123' });
    ok('PIN salah ditolak', wrongPin.status === 401);
    const checkOk = await api('POST', '/api/public/check/start', { registration_number: reg.json.registration_number, pin: reg.json.pin });
    ok('PIN benar diterima', checkOk.status === 200 && !!checkOk.json.session_token);
    const appToken = { 'x-applicant-token': checkOk.json.session_token };
    const app = await api('GET', '/api/public/application', undefined, appToken);
    ok('Data pendaftaran dapat dilihat', app.status === 200 && app.json.applicant.nama_lengkap === 'Siswa Uji Otomatis');
    ok('Umur dihitung dari 10 Juli 2027', /17 tahun/.test(app.json.applicant.umur_10juli || ''), app.json.applicant.umur_10juli);
    ok('Gelombang otomatis terisi', !!app.json.wave);
    ok('Dokumen terdeteksi belum lengkap', Array.isArray(app.json.missing_documents) && app.json.missing_documents.length === 6);

    const upd = await api('PUT', '/api/public/application', {
      data: { siswa: { ...payload.data.siswa, jarak_km: 7 }, ortu: payload.data.ortu, wali: payload.data.wali },
    }, appToken);
    ok('Perubahan data calon siswa tersimpan', upd.status === 200);
    const app2 = await api('GET', '/api/public/application', undefined, appToken);
    ok('Perubahan tersimpan (jarak 7 km)', app2.json.applicant.jarak_km === 7);

    // PDF formulir
    const pdf = await fetch(BASE + '/api/public/application/pdf', { headers: appToken });
    const buf = Buffer.from(await pdf.arrayBuffer());
    ok('PDF formulir terbit', pdf.status === 200 && buf.slice(0, 5).toString() === '%PDF-');
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(buf);
    ok('PDF satu halaman', pdfDoc.getPageCount() === 1, `halaman=${pdfDoc.getPageCount()}`);
    const size = pdfDoc.getPage(0).getSize();
    ok('PDF ukuran F4 (612.12 x 935.58 pt)', Math.abs(size.width - 612.12) < 0.5 && Math.abs(size.height - 935.58) < 0.5, `${size.width}x${size.height}`);
    require('fs').writeFileSync(path.resolve(__dirname, '../../../ref/hasil-formulir.pdf'), buf);

    // ===== Keamanan: akses antar pendaftar =====
    console.log('[Pengujian Keamanan]');
    const check2 = await api('POST', '/api/public/check/start', { registration_number: reg2.json.registration_number, pin: reg2.json.pin });
    const token2 = { 'x-applicant-token': check2.json.session_token };
    const crossDoc = await fetch(BASE + `/api/public/application`, { headers: token2 });
    const crossJson = await crossDoc.json();
    ok('Pendaftar lain tidak terlihat', crossJson.applicant.registration_number === reg2.json.registration_number);
    const noToken = await api('GET', '/api/public/application');
    ok('Tanpa sesi ditolak', noToken.status === 401);

    // ===== Auth panitia & RBAC =====
    console.log('[Pengujian Auth & RBAC]');
    const badLogin = await api('POST', '/api/auth/login', { username: 'admin', password: 'salah' });
    ok('Login admin salah ditolak', badLogin.status === 401);
    const login = await api('POST', '/api/auth/login', { username: 'admin', password: 'Admin#2027' });
    ok('Login admin berhasil', login.status === 200 && !!login.json.access_token);
    const adminH = { Authorization: `Bearer ${login.json.access_token}` };

    const list = await api('GET', '/api/applicants', undefined, adminH);
    ok('Daftar pendaftar (admin)', list.status === 200 && list.json.total >= 2);
    const stats = await api('GET', '/api/dashboard/stats', undefined, adminH);
    ok('Statistik dashboard', stats.status === 200 && stats.json.total >= 2);
    ok('Statistik pembayaran tampil untuk admin', stats.json.payments !== null);

    // RBAC: kesehatan tidak boleh akses pengguna
    const loginKesehatan = await api('POST', '/api/auth/login', { username: 'kesehatan', password: 'Sehat#2027' });
    const kesehatanH = { Authorization: `Bearer ${loginKesehatan.json.access_token}` };
    const forbidden = await api('GET', '/api/admin/users', undefined, kesehatanH);
    ok('RBAC: kesehatan ditolak di menu pengguna', forbidden.status === 403);
    const allowed = await api('GET', '/api/assessment/health', undefined, kesehatanH);
    ok('RBAC: kesehatan dapat akses modul kesehatan', allowed.status === 200);

    // Ketua tidak melihat admin
    const loginKetua = await api('POST', '/api/auth/login', { username: 'ketua', password: 'Ketua#2027' });
    const ketuaH = { Authorization: `Bearer ${loginKetua.json.access_token}` };
    const usersKetua = await api('GET', '/api/admin/users', undefined, ketuaH);
    ok('Ketua tidak melihat akun admin', usersKetua.json.rows.every((u: any) => u.role_code !== 'admin'));

    // Bendahara input pembayaran
    const loginBenda = await api('POST', '/api/auth/login', { username: 'bendahara', password: 'Benda#2027' });
    const bendaH = { Authorization: `Bearer ${loginBenda.json.access_token}` };
    const fees = await api('GET', '/api/payments/fee-types', undefined, bendaH);
    ok('Jenis biaya tersedia', fees.status === 200 && fees.json.rows.length >= 3);
    const pay = await api('POST', '/api/payments', {
      applicant_id: app.json.applicant.id,
      items: [{ fee_type_id: fees.json.rows[0].id, nama: fees.json.rows[0].nama, nominal: fees.json.rows[0].nominal }, { nama: 'Biaya Custom', nominal: 50000 }],
    }, bendaH);
    ok('Input pembayaran berhasil', pay.status === 200, JSON.stringify(pay.json));
    const payDetail = await api('GET', `/api/payments/${pay.json.id}`, undefined, adminH);
    ok('Admin melihat detail + audit pembayaran', payDetail.status === 200 && Array.isArray(payDetail.json.audit_logs));
    const receipt = await fetch(BASE + `/api/payments/${pay.json.id}/receipt.pdf`, { headers: bendaH });
    ok('Bukti pembayaran PDF terbit', receipt.status === 200);

    // Verifikasi dokumen
    const loginVerif = await api('POST', '/api/auth/login', { username: 'verifikasi', password: 'Verif#2027' });
    const verifH = { Authorization: `Bearer ${loginVerif.json.access_token}` };
    const vdocs = await api('GET', `/api/assessment/verify/${app.json.applicant.id}`, undefined, verifH);
    ok('Verifikasi dapat melihat dokumen', vdocs.status === 200);
    const vmark = await api('POST', `/api/assessment/verify/${app.json.applicant.id}/document`, { doc_type: 'kk', status: 'valid', note: '' }, verifH);
    ok('Penandaan dokumen valid tersimpan', vmark.status === 200);
    const vcomplete = await api('POST', `/api/assessment/verify/${app.json.applicant.id}/complete`, { action: 'setujui', note: 'Berkas lengkap' }, verifH);
    ok('Verifikasi disetujui', vcomplete.status === 200 && vcomplete.json.status === 'Disetujui');
    const locked = await api('PUT', '/api/public/application', { data: { siswa: payload.data.siswa } }, appToken);
    ok('Pendaftaran terkunci setelah disetujui', locked.status === 403);

    // Dokumen privat: signed URL wajib
    const docNoAuth = await api('GET', '/api/documents/1/file');
    ok('Dokumen privat ditolak tanpa signature', docNoAuth.status === 403);

    // Laporan
    const rep = await api('GET', '/api/admin/reports/program', undefined, adminH);
    ok('Laporan per program', rep.status === 200 && rep.json.rows.length >= 1);
    const excel = await fetch(BASE + '/api/admin/reports/program/excel', { headers: adminH });
    ok('Export Excel laporan', excel.status === 200 && (await excel.arrayBuffer()).byteLength > 100);
    const excelApp = await fetch(BASE + '/api/admin/applicants/export?program=PPLG', { headers: adminH });
    ok('Export Excel data pendaftar', excelApp.status === 200);

    // Rate limiting
    let rateLimited = false;
    for (let i = 0; i < 25; i++) {
      const r = await api('POST', '/api/auth/login', { username: 'admin', password: 'x' });
      if (r.status === 429) { rateLimited = true; break; }
    }
    ok('Rate limiting login aktif', rateLimited);

    // Backup
    const backup = await api('GET', '/api/admin/backup', undefined, adminH);
    ok('Backup database', backup.status === 200 && backup.json.meta?.tables > 15);

    // Audit log
    const logs = await api('GET', '/api/admin/audit', undefined, adminH);
    ok('Audit log tercatat', logs.status === 200 && logs.json.total >= 5);
  } catch (e: any) {
    failed++;
    console.error('  ✘ Exception:', e.message);
  } finally {
    server.kill();
  }

  console.log(`\nHasil: ${passed} lulus, ${failed} gagal`);
  process.exit(failed ? 1 : 0);
}

main();
