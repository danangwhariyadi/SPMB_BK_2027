import { useKontak } from './Home';

export default function Persyaratan() {
  useKontak();
  const wajib = [
    'Fotokopi Kartu Keluarga (KK)',
    'Akta Kelahiran',
    'Surat Keterangan Nilai/Transkrip Nilai',
    'Ijazah (bila sudah tersedia)',
    'Kartu NISN',
    'Foto hitam putih ukuran 3 x 4 sebanyak 6 lembar',
  ];
  const umum = [
    'Lulusan SMP/MTs/Paket B atau setara',
    'Mengisi formulir pendaftaran online secara benar',
    'Menyatakan kebenaran data pada formulir',
    'Dokumen yang belum tersedia dapat menyusul dengan status "Belum Ada" dan wajib dilengkapi saat verifikasi',
  ];
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl md:text-3xl font-extrabold text-primary-800 dark:text-primary-300 mb-6">Persyaratan Pendaftaran</h1>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="font-bold text-lg mb-3 text-primary-700 dark:text-primary-300">Dokumen Wajib</h2>
          <ul className="space-y-2">
            {wajib.map(d => <li key={d} className="flex gap-2 text-sm"><span className="text-accent-500 font-bold">•</span>{d}</li>)}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="font-bold text-lg mb-3 text-primary-700 dark:text-primary-300">Persyaratan Umum</h2>
          <ul className="space-y-2">
            {umum.map(d => <li key={d} className="flex gap-2 text-sm"><span className="text-primary-500 font-bold">•</span>{d}</li>)}
          </ul>
        </div>
      </div>
      <div className="card p-6 mt-5">
        <h2 className="font-bold text-lg mb-2 text-primary-700 dark:text-primary-300">Format Dokumen Unggahan</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">JPG, JPEG, PNG, atau PDF. Maksimal 5 MB per file. Foto dapat diambil langsung dengan kamera ponsel/webcam. Dokumen tersimpan secara privat dan hanya dapat diakses melalui tautan aman berbatas waktu.</p>
      </div>
    </div>
  );
}
