import { usePublicInfo, useKontak } from './Home';

export default function Info() {
  useKontak();
  const info = usePublicInfo();
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl md:text-3xl font-extrabold text-primary-800 dark:text-primary-300 mb-6">Informasi SPMB</h1>
      <div className="card p-6 mb-6">
        <p className="leading-relaxed whitespace-pre-line">{info?.settings.info_spmb || 'Memuat informasi…'}</p>
      </div>
      <div className="card p-6 mb-6">
        <h2 className="font-bold text-lg mb-3 text-primary-700 dark:text-primary-300">Jalur & Gelombang Pendaftaran</h2>
        <div className="space-y-3">
          {(info?.waves || []).map(w => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
              <div>
                <div className="font-semibold">{w.nama}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{w.start_date} s.d. {w.end_date}</div>
              </div>
              <span className={`badge ${w.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                {w.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-6">
        <h2 className="font-bold text-lg mb-3 text-primary-700 dark:text-primary-300">Kontak Sekolah</h2>
        <p className="text-sm leading-relaxed" data-kontak>Memuat kontak…</p>
      </div>
    </div>
  );
}
