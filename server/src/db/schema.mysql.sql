-- SPMB SMK BHINA KARYA KARANGANYAR - Schema (MariaDB / MySQL)
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS roles (
  code VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(255) DEFAULT '',
  is_active INTEGER DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_code VARCHAR(255) NOT NULL,
  menu VARCHAR(255) NOT NULL,
  can_view INTEGER DEFAULT 0,
  can_create INTEGER DEFAULT 0,
  can_edit INTEGER DEFAULT 0,
  can_delete INTEGER DEFAULT 0,
  UNIQUE(role_code, menu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role_code VARCHAR(255) NOT NULL,
  is_active INTEGER DEFAULT 1,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at VARCHAR(255) NOT NULL,
  updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS registration_waves (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nama VARCHAR(255) NOT NULL,
  start_date VARCHAR(255) NOT NULL,
  end_date VARCHAR(255) NOT NULL,
  is_active INTEGER DEFAULT 1,
  quota_tm INTEGER DEFAULT 0,
  quota_to INTEGER DEFAULT 0,
  quota_pplg INTEGER DEFAULT 0,
  ta VARCHAR(255) NOT NULL DEFAULT '2027/2028',
  created_at VARCHAR(255) NOT NULL,
  updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS registration_sequences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  prefix VARCHAR(255) NOT NULL DEFAULT 'A',
  ta VARCHAR(255) NOT NULL DEFAULT '2027/2028',
  last_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE(prefix, ta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS applicants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  registration_number VARCHAR(191) UNIQUE,
  pin_hash TEXT,
  registration_date TEXT,
  wave_id INTEGER,
  ta VARCHAR(255) DEFAULT '2027/2028',
  jalur VARCHAR(255) DEFAULT 'Reguler',
  nama_lengkap VARCHAR(255) NOT NULL,
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
  riwayat_pendaftaran VARCHAR(255) DEFAULT 'Belum pernah',
  riwayat_sekolah TEXT,
  riwayat_jurusan TEXT,
  riwayat_tahun TEXT,
  riwayat_status TEXT,
  pernyataan INTEGER DEFAULT 0,
  status_admin VARCHAR(255) DEFAULT 'Pendaftaran Baru',
  status_berkas VARCHAR(255) DEFAULT 'Belum diproses',
  status_kesehatan VARCHAR(255) DEFAULT 'Belum diproses',
  status_wawancara VARCHAR(255) DEFAULT 'Belum diproses',
  status_verifikasi VARCHAR(255) DEFAULT 'Belum diproses',
  status_akhir VARCHAR(255) DEFAULT 'Belum diproses',
  is_locked INTEGER DEFAULT 0,
  submitted_at TEXT,
  created_at VARCHAR(255) NOT NULL,
  updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX IF NOT EXISTS idx_applicants_reg ON applicants(registration_number) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX IF NOT EXISTS idx_applicants_nama ON applicants(nama_lengkap) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX IF NOT EXISTS idx_applicants_wave ON applicants(wave_id) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX IF NOT EXISTS idx_applicants_program ON applicants(program_keahlian) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX IF NOT EXISTS idx_applicants_kec ON applicants(kecamatan) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS applicant_drafts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  draft_token VARCHAR(191) NOT NULL UNIQUE,
  step INTEGER DEFAULT 1,
  nama_lengkap TEXT,
  nisn TEXT,
  hp_siswa TEXT,
  detail TEXT,
  created_at VARCHAR(255) NOT NULL,
  updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS applicant_parents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  ayah_nama TEXT, ayah_pekerjaan TEXT, ayah_hp TEXT,
  ibu_nama TEXT, ibu_pekerjaan TEXT, ibu_hp TEXT,
  alamat TEXT, rt TEXT, rw TEXT, desa TEXT, kecamatan TEXT, kabupaten TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS applicant_guardians (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  nama TEXT, alamat TEXT, rt TEXT, rw TEXT, pekerjaan TEXT, hp TEXT,
  sama_dengan_ortu INTEGER DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS applicant_achievements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  memiliki INTEGER DEFAULT 0,
  nama TEXT, tingkat TEXT, tahun TEXT, keterangan TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS applicant_tka_scores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  jenis VARCHAR(255) NOT NULL,
  mapel VARCHAR(255) NOT NULL,
  nilai REAL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS applicant_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  pilihan INTEGER DEFAULT 1,
  program_keahlian VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS applicant_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  doc_type VARCHAR(255) NOT NULL,
  status VARCHAR(255) DEFAULT 'Belum Ada',
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime TEXT,
  source TEXT,
  note TEXT,
  uploaded_at TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX IF NOT EXISTS idx_docs_app ON applicant_documents(applicant_id) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS health_examinations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  berat_badan REAL, tinggi_badan REAL, lingkar_kepala REAL,
  buta_warna TEXT, penglihatan TEXT, penyakit_bawaan TEXT,
  catatan TEXT, status VARCHAR(255) DEFAULT 'Belum diproses',
  examiner_id INTEGER, examiner_name TEXT, examined_at TEXT,
  created_at VARCHAR(255) NOT NULL, updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS interview_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  label VARCHAR(255) NOT NULL,
  type VARCHAR(255) DEFAULT 'text',
  options TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS interviews (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  interviewer_id INTEGER, interviewer_name TEXT,
  catatan TEXT, rekomendasi TEXT,
  status VARCHAR(255) DEFAULT 'Belum diproses',
  scheduled_at TEXT,
  created_at VARCHAR(255) NOT NULL, updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS interview_answers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  interview_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  question_label VARCHAR(255) NOT NULL,
  answer TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS document_verifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  document_id INTEGER,
  doc_type TEXT,
  status TEXT,
  note TEXT,
  verifier_id INTEGER, verifier_name TEXT,
  verified_at TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fee_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nama VARCHAR(255) NOT NULL,
  nominal REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  registration_number TEXT,
  nama_lengkap TEXT,
  wave_id INTEGER,
  program_keahlian TEXT,
  tanggal VARCHAR(255) NOT NULL,
  total REAL DEFAULT 0,
  metode VARCHAR(255) DEFAULT 'Tunai',
  keterangan TEXT,
  status VARCHAR(255) DEFAULT 'Lunas',
  receiver_name TEXT,
  created_by TEXT, updated_by TEXT,
  created_at VARCHAR(255) NOT NULL, updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS payment_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  payment_id INTEGER NOT NULL,
  fee_type_id INTEGER,
  nama VARCHAR(255) NOT NULL,
  nominal REAL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS registration_status_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  applicant_id INTEGER NOT NULL,
  status_from TEXT, status_to TEXT,
  changed_by TEXT, note TEXT, created_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INTEGER, username TEXT, role_code TEXT,
  action VARCHAR(255) NOT NULL, entity TEXT, entity_id TEXT,
  detail TEXT, ip TEXT, created_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_settings (
  skey VARCHAR(64) PRIMARY KEY,
  svalue TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS otp_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  target VARCHAR(255) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  applicant_id INTEGER,
  purpose VARCHAR(255) DEFAULT 'cek-pendaftaran',
  attempts INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  expires_at VARCHAR(255) NOT NULL,
  created_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS public_login_attempts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_key VARCHAR(255) NOT NULL,
  attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sync_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  target VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  op VARCHAR(255) NOT NULL,
  row_id TEXT,
  payload TEXT,
  status VARCHAR(255) DEFAULT 'pending',
  error TEXT,
  created_at VARCHAR(255) NOT NULL,
  retried_at TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
