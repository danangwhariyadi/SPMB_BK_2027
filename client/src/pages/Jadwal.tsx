import { usePublicInfo, useKontak } from './Home';

export default function Jadwal() {
  useKontak();
  const info = usePublicInfo();
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl md:text-3xl font-extrabold text-primary-800 dark:text-primary-300 mb-6">Jadwal Pendaftaran TA. 2027/2028</h1>
      <div className="grid md:grid-cols-3 gap-5">
        {(info?.waves || []).map((w, i) => (
          <div key={w.id} className={`card p-6 ${w.is_active ? 'ring-2 ring-primary-500' : ''}`}>
            <div className="text-xs font-bold text-accent-500 uppercase tracking-wide mb-1">Gelombang {i + 1}</div>
            <h3 className="font-bold text-lg mb-2">{w.nama}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{w.start_date} s.d. {w.end_date}</p>
            <table className="text-sm w-full">
              <tbody>
                <tr><td className="text-slate-500">Teknik Mesin</td><td className="text-right font-semibold">{w.quota_tm} kuota</td></tr>
                <tr><td className="text-slate-500">Teknik Otomotif</td><td className="text-right font-semibold">{w.quota_to} kuota</td></tr>
                <tr><td className="text-slate-500">PPLG</td><td className="text-right font-semibold">{w.quota_pplg} kuota</td></tr>
              </tbody>
            </table>
            <span className={`badge mt-3 ${w.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
              {w.is_active ? 'Sedang Aktif' : 'Belum/Nonaktif'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
