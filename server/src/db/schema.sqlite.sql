-- SPMB SMK BHINA KARYA KARANGANYAR - Schema (SQLite / Cloudflare D1)
CREATE TABLE IF NOT EXISTS roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_code TEXT NOT NULL,
  menu TEXT NOT NULL,
  can_view INTEGER DEFAULT 0,
  can_create INTEGER DEFAULT 0,
  can_edit INTEGER DEFAULT 0,
  can_delete INTEGER DEFAULT 0,
  UNIQUE(role_code, menu)
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_code TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS registration_waves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  quota_tm INTEGER DEFAULT 0,
  quota_to INTEGER DEFAULT 0,
  quota_pplg INTEGER DEFAULT 0,
  ta TEXT NOT NULL DEFAULT '2027/2028',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS registration_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prefix TEXT NOT NULL DEFAULT 'A',
  ta TEXT NOT NULL DEFAULT '2027/2028',
  last_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE(prefix, ta)
);
CREATE TABLE IF NOT EXISTS applicants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_number TEXT UNIQUE,
  pin_hash TEXT,
  registration_date TEXT,
  wave_id INTEGER,
  ta TEXT DEFAULT '2027/2028',
  jalur TEXT DEFAULT 'Reguler',
  nama_lengkap TEXT NOT NULL,
  nisn TEXT,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  jenis_kelamin TEXT,
  agama TEXT,
  alamat TEXT,
  desa TEXT,
  kecamatan TEXT,
  kabupaten TEXT,
  jarak_km REAL,
  hp_siswa TEXT,
  berat_badan REAL,
  tinggi_badan REAL,
  umur_10juli TEXT,
  jenjang_asal TEXT,
  asal_sekolah TEXT,
  asal_kecamatan TEXT,
  asal_kabupaten TEXT,
  no_seri_ijazah TEXT,
  uniform_size TEXT,
  program_keahlian TEXT,
  riwayat_pendaftaran TEXT DEFAULT 'Belum pernah',
  riwayat_sekolah TEXT,
  riwayat_jurusan TEXT,
  riwayat_tahun TEXT,
  riwayat_status TEXT,
  pernyataan INTEGER DEFAULT 0,
  status_admin TEXT DEFAULT 'Pendaftaran Baru',
  status_berkas TEXT DEFAULT 'Belum diproses',
  status_kesehatan TEXT DEFAULT 'Belum diproses',
  status_wawancara TEXT DEFAULT 'Belum diproses',
  status_verifikasi TEXT DEFAULT 'Belum diproses',
  status_akhir TEXT DEFAULT 'Belum diproses',
  is_locked INTEGER DEFAULT 0,
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_applicants_reg ON applicants(registration_number);
CREATE INDEX IF NOT EXISTS idx_applicants_nama ON applicants(nama_lengkap);
CREATE INDEX IF NOT EXISTS idx_applicants_wave ON applicants(wave_id);
CREATE INDEX IF NOT EXISTS idx_applicants_program ON applicants(program_keahlian);
CREATE INDEX IF NOT EXISTS idx_applicants_kec ON applicants(kecamatan);
CREATE TABLE IF NOT EXISTS applicant_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_token TEXT NOT NULL UNIQUE,
  step INTEGER DEFAULT 1,
  nama_lengkap TEXT,
  nisn TEXT,
  hp_siswa TEXT,
  detail TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS applicant_parents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  ayah_nama TEXT, ayah_pekerjaan TEXT, ayah_hp TEXT,
  ibu_nama TEXT, ibu_pekerjaan TEXT, ibu_hp TEXT,
  alamat TEXT, rt TEXT, rw TEXT, desa TEXT, kecamatan TEXT, kabupaten TEXT
);
CREATE TABLE IF NOT EXISTS applicant_guardians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  nama TEXT, alamat TEXT, rt TEXT, rw TEXT, pekerjaan TEXT, hp TEXT,
  sama_dengan_ortu INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS applicant_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  memiliki INTEGER DEFAULT 0,
  nama TEXT, tingkat TEXT, tahun TEXT, keterangan TEXT
);
CREATE TABLE IF NOT EXISTS applicant_tka_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  jenis TEXT NOT NULL,
  mapel TEXT NOT NULL,
  nilai REAL
);
CREATE TABLE IF NOT EXISTS applicant_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  pilihan INTEGER DEFAULT 1,
  program_keahlian TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS applicant_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  doc_type TEXT NOT NULL,
  status TEXT DEFAULT 'Belum Ada',
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime TEXT,
  source TEXT,
  note TEXT,
  uploaded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_docs_app ON applicant_documents(applicant_id);
CREATE TABLE IF NOT EXISTS health_examinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  berat_badan REAL, tinggi_badan REAL, lingkar_kepala REAL,
  buta_warna TEXT, penglihatan TEXT, penyakit_bawaan TEXT,
  catatan TEXT, status TEXT DEFAULT 'Belum diproses',
  examiner_id INTEGER, examiner_name TEXT, examined_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS interview_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  options TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  interviewer_id INTEGER, interviewer_name TEXT,
  catatan TEXT, rekomendasi TEXT,
  status TEXT DEFAULT 'Belum diproses',
  scheduled_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS interview_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  interview_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  question_label TEXT NOT NULL,
  answer TEXT
);
CREATE TABLE IF NOT EXISTS document_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  document_id INTEGER,
  doc_type TEXT,
  status TEXT,
  note TEXT,
  verifier_id INTEGER, verifier_name TEXT,
  verified_at TEXT
);
CREATE TABLE IF NOT EXISTS fee_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  nominal REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  registration_number TEXT,
  nama_lengkap TEXT,
  wave_id INTEGER,
  program_keahlian TEXT,
  tanggal TEXT NOT NULL,
  total REAL DEFAULT 0,
  metode TEXT DEFAULT 'Tunai',
  keterangan TEXT,
  status TEXT DEFAULT 'Lunas',
  receiver_name TEXT,
  created_by TEXT, updated_by TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payment_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  fee_type_id INTEGER,
  nama TEXT NOT NULL,
  nominal REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS registration_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  status_from TEXT, status_to TEXT,
  changed_by TEXT, note TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, username TEXT, role_code TEXT,
  action TEXT NOT NULL, entity TEXT, entity_id TEXT,
  detail TEXT, ip TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE TABLE IF NOT EXISTS school_settings (
  skey TEXT PRIMARY KEY,
  svalue TEXT
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  applicant_id INTEGER,
  purpose TEXT DEFAULT 'cek-pendaftaran',
  attempts INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS public_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_key TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target TEXT NOT NULL,
  table_name TEXT NOT NULL,
  op TEXT NOT NULL,
  row_id TEXT,
  payload TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TEXT NOT NULL,
  retried_at TEXT
);
