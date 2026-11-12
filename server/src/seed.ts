import 'dotenv/config';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { ROLES, PERMISSIONS } from './middleware/rbac';

async function insertIfMissing(table: string, whereSql: string, whereParams: any[], cols: string[], vals: any[]) {
  const row = await db.get(`SELECT 1 AS one FROM ${table} WHERE ${whereSql}`, whereParams).catch(() => null);
  if (!row) {
    await db.write(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals, table);
  }
}

async function main() {
  await db.init();
  const nowIso = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Peran & izin
  for (const [code, r] of Object.entries(ROLES)) {
    await insertIfMissing('roles', 'code=?', [code], ['code', 'name', 'description', 'is_active'], [code, r.name, r.description, 1]);
    const perms = PERMISSIONS[code] || {};
    for (const [menu, p] of Object.entries(perms)) {
      const existing = await db.get('SELECT id FROM permissions WHERE role_code=? AND menu=?', [code, menu]);
      if (!existing) {
        await db.write('INSERT INTO permissions (role_code, menu, can_view, can_create, can_edit, can_delete) VALUES (?,?,?,?,?,?)',
          [code, menu, p.can_view, p.can_create, p.can_edit, p.can_delete], 'permissions');
      }
    }
  }

  // Akun demo setiap peran
  const demoUsers: Array<[string, string, string]> = [
    ['admin', 'Admin#2027', 'Administrator SPMB'],
    ['ketua', 'Ketua#2027', 'Ketua Panitia SPMB'],
    ['sekretaris', 'Sekre#2027', 'Sekretaris Panitia'],
    ['bendahara', 'Benda#2027', 'Bendahara Panitia'],
    ['pendaftaran', 'Pendaftar#2027', 'Panitia Pendaftaran'],
    ['kesehatan', 'Sehat#2027', 'Panitia Kesehatan'],
    ['wawancara', 'Wawancara#2027', 'Panitia Wawancara'],
    ['verifikasi', 'Verif#2027', 'Panitia Verifikasi'],
    ['presentasi', 'Present#2027', 'Panitia Presentasi'],
    ['publikasi', 'Publik#2027', 'Panitia Publikasi'],
    ['ketertiban', 'Tertib#2027', 'Panitia Ketertiban'],
    ['kepsek', 'Kepsek#2027', 'Kepala Sekolah'],
    ['yayasan', 'Yayasan#2027', 'Perwakilan Yayasan'],
  ];
  for (const [username, password, full_name] of demoUsers) {
    const role = username === 'kepsek' ? 'kepala_sekolah' : username;
    const exists = await db.get('SELECT id FROM users WHERE username=?', [username]);
    if (!exists) {
      const hash = await bcrypt.hash(password, 10);
      await db.write('INSERT INTO users (username, password_hash, full_name, role_code, created_at, updated_at) VALUES (?,?,?,?,?,?)',
        [username, hash, full_name, role, nowIso, nowIso], 'users');
    } else {
      await db.write('UPDATE users SET failed_attempts=0, locked_until=NULL, is_active=1 WHERE username=?', [username], 'users', username);
    }
  }

  // Pengaturan sekolah
  const settings: Array<[string, string]> = [
    ['school_name', 'SMK BHINA KARYA KARANGANYAR'],
    ['school_address', 'Karanganyar, Kabupaten Karanganyar, Jawa Tengah'],
    ['school_phone', '(0291) 000000'],
    ['school_email', 'info@smkbhinakarya-kar.sch.id'],
    ['school_website', 'https://smkbhinakarya-kar.sch.id'],
    ['ta', '2027/2028'],
    ['pendaftaran_dibuka', '1'],
    ['format_no_pendaftaran', 'A{seq:4}'],
    ['umur_ref_date', '2027-07-10'],
    ['scanner_bridge_token', 'ubah-token-bridge-ini'],
    ['scanner_bridge_url', 'http://127.0.0.1:45454'],
    ['info_spmb', 'Penerimaan Murid Baru SMK Bhina Karya Karanganyar Tahun Ajaran 2027/2028 dibuka untuk tiga program keahlian: Teknik Mesin, Teknik Otomotif, dan Pengembangan Perangkat Lunak dan Gim (PPLG).'],
    ['biaya_gelombang', 'INDEN: Rp 150.000; Gelombang 1: Rp 250.000; Gelombang 2: Rp 350.000'],
  ];
  for (const [k, v] of settings) {
    const exists = await db.get('SELECT skey FROM school_settings WHERE skey=?', [k]);
    if (!exists) await db.write('INSERT INTO school_settings (skey, svalue) VALUES (?,?)', [k, v], 'school_settings', k);
  }

  // Gelombang (jadwal contoh; dapat diubah admin)
  const waves = [
    ['Gelombang INDEN', '2026-11-01', '2026-12-31', 1, 40, 40, 40],
    ['Gelombang 1', '2027-01-05', '2027-03-31', 1, 72, 72, 36],
    ['Gelombang 2', '2027-04-01', '2027-06-30', 1, 24, 24, 24],
  ];
  for (const [nama, start, end, active, qtm, qto, qpplg] of waves) {
    const exists = await db.get('SELECT id FROM registration_waves WHERE nama=?', [nama as string]);
    if (!exists) {
      await db.write('INSERT INTO registration_waves (nama, start_date, end_date, is_active, quota_tm, quota_to, quota_pplg, ta, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [nama, start, end, active, qtm, qto, qpplg, '2027/2028', nowIso, nowIso], 'registration_waves');
    }
  }

  // Sekuens nomor pendaftaran
  const seq = await db.get('SELECT * FROM registration_sequences WHERE prefix=?', ['A']);
  if (!seq) await db.write('INSERT INTO registration_sequences (prefix, ta, last_number) VALUES (?,?,0)', ['A', '2027/2028'], 'registration_sequences');

  // Jenis biaya (dapat diatur Ketua)
  const fees = [['Biaya Pendaftaran', 150000], ['Seragam', 350000], ['DSP', 500000], ['ATS', 250000]];
  for (const [nama, nominal] of fees) {
    const exists = await db.get('SELECT id FROM fee_types WHERE nama=?', [nama as string]);
    if (!exists) await db.write('INSERT INTO fee_types (nama, nominal) VALUES (?,?)', [nama, nominal], 'fee_types');
  }

  // Pertanyaan wawancara default
  const questions = [
    ['Mengapa Anda memilih program keahlian tersebut?', 'textarea', 1],
    ['Apa rencana Anda setelah lulus dari SMK?', 'textarea', 2],
    ['Apakah Anda siap mengikuti seluruh kegiatan sekolah?', 'select', 3],
    ['Hobi/kegiatan yang paling Anda sukai?', 'text', 4],
  ];
  for (const [label, type, order] of questions) {
    const exists = await db.get('SELECT id FROM interview_questions WHERE label=?', [label as string]);
    if (!exists) await db.write('INSERT INTO interview_questions (label, type, sort_order) VALUES (?,?,?)', [label, type, order], 'interview_questions');
  }

  console.log('Seed selesai.');
  console.log('Akun demo:');
  for (const [u, p] of demoUsers) console.log(`  ${u} / ${p} (${u === 'kepsek' ? 'kepala_sekolah' : u})`);
  await db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
