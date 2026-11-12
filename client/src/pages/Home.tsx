import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export interface PublicInfo {
  settings: Record<string, string>;
  waves: Array<{ id: number; nama: string; start_date: string; end_date: string; quota_tm: number; quota_to: number; quota_pplg: number; is_active: number }>;
  quota_used: Record<string, number>;
  programs: Array<{ kode: string; nama: string }>;
}

export function usePublicInfo() {
  const [info, setInfo] = useState<PublicInfo | null>(null);
  useEffect(() => {
    api.get('/api/public/info').then(setInfo).catch(() => undefined);
  }, []);
  return info;
}

export function useKontak() {
  const info = usePublicInfo();
  useEffect(() => {
    const el = document.querySelector('[data-kontak]');
    if (el && info) {
      el.innerHTML = `${info.settings.school_address || ''}<br/>Telp: ${info.settings.school_phone || '-'}<br/>Email: ${info.settings.school_email || '-'}`;
    }
  }, [info]);
}

const programIcons: Record<string, string> = {
  'TEKNIK MESIN': '⚙️',
  'TEKNIK OTOMOTIF': '🏍️',
  'PPLG': '💻',
};

export { programIcons };

export default function Home() {
  useKontak();
  const info = usePublicInfo();
  const activeWave = info?.waves.find(w => w.is_active);
  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 relative">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-block bg-accent-500 rounded-full px-4 py-1 text-xs font-bold tracking-wide mb-4">PENDAFTARAN MURID BARU</span>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4">
                SPMB ONLINE<br />SMK BHINA KARYA<br />KARANGANYAR
              </h1>
              <p className="text-primary-100 text-lg mb-6">Tahun Ajaran 2027/2028 — Teknik Mesin, Teknik Otomotif, dan Pengembangan Perangkat Lunak dan Gim (PPLG).</p>
              <div className="flex flex-wrap gap-3">
                <Link to="/daftar" className="btn bg-white text-primary-800 hover:bg-primary-50 !px-6 !py-3 text-base">DAFTAR SEKARANG →</Link>
                <Link to="/cek" className="btn border border-white/40 text-white hover:bg-white/10 !px-6 !py-3 text-base">Cek Pendaftaran</Link>
              </div>
              {info && (
                <p className="mt-4 text-sm text-primary-200">
                  {activeWave ? `Pendaftaran DIBUKA — ${activeWave.nama} (s.d. ${activeWave.end_date})` : 'Pendaftaran sedang tidak dibuka.'}
                </p>
              )}
            </div>
            <div className="hidden md:flex justify-center">
              <div className="bg-white/10 backdrop-blur rounded-3xl p-8 border border-white/20">
                <img src="/logobk.png" alt="Logo SMK Bhina Karya Karanganyar" className="w-48 h-48" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-5">
        {(info?.programs || []).map(p => (
          <Link to="/program" key={p.kode} className="card p-6 hover:shadow-md transition group">
            <div className="text-4xl mb-3">{programIcons[p.kode]}</div>
            <h3 className="font-bold text-lg text-primary-800 dark:text-primary-300 group-hover:underline">{p.nama}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Kuota: {info?.waves.reduce((s, w) => s + (p.kode === 'TEKNIK MESIN' ? w.quota_tm : p.kode === 'TEKNIK OTOMOTIF' ? w.quota_to : w.quota_pplg), 0) || 0} siswa
              {info?.quota_used[p.kode] !== undefined && ` • Terisi ${info.quota_used[p.kode]}`}
            </p>
          </Link>
        ))}
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-12 grid md:grid-cols-4 gap-4">
        {[
          ['1. Isi Formulir', 'Lima tahap, tanpa akun, draft tersimpan otomatis.'],
          ['2. Kirim & Simpan PIN', 'Nomor pendaftaran otomatis + PIN rahasia.'],
          ['3. Lengkapi Berkas', 'Unggah/foto dokumen persyaratan.'],
          ['4. Verifikasi', 'Pantau status hingga pengumuman hasil.'],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <div className="font-bold text-primary-700 dark:text-primary-300 mb-1">{t}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
