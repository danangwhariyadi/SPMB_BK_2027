import { usePublicInfo, useKontak, programIcons } from './Home';

const deskripsi: Record<string, string> = {
  'TEKNIK MESIN': 'Mempelajari gambar teknik, pemesinan CNC/bubut, fabrikasi logam, dan perawatan mesin industri. Lulusan siap bekerja di industri manufaktur atau melanjutkan studi.',
  'TEKNIK OTOMOTIF': 'Mempelajari perawatan dan perbaikan kendaraan bermotor (engine, sasis, kelistrikan, dan sistem injeksi). Dilengkapi bengkel praktik modern.',
  'PPLG': 'Mempelajari pemrograman aplikasi, pengembangan gim, basis data, dan desain antarmuka. Lulusan siap menjadi programmer, game developer, atau teknisi perangkat lunak.',
};

export default function Program() {
  useKontak();
  const info = usePublicInfo();
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl md:text-3xl font-extrabold text-primary-800 dark:text-primary-300 mb-6">Program Keahlian</h1>
      <div className="grid md:grid-cols-3 gap-5">
        {(info?.programs || []).map(p => {
          const quota = info?.waves.reduce((s, w) => s + (p.kode === 'TEKNIK MESIN' ? w.quota_tm : p.kode === 'TEKNIK OTOMOTIF' ? w.quota_to : w.quota_pplg), 0) || 0;
          const used = info?.quota_used[p.kode] || 0;
          return (
            <div key={p.kode} className="card overflow-hidden">
              <div className="h-28 bg-gradient-to-br from-primary-700 to-primary-500 flex items-center justify-center text-5xl">
                {programIcons[p.kode]}
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-primary-800 dark:text-primary-300">{p.nama}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{deskripsi[p.kode]}</p>
                <div className="mt-3 text-sm"><span className="font-semibold">Kuota:</span> {used}/{quota} terisi</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
