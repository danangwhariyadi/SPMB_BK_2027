import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useToast } from '../components/Toast';
import { programIcons } from './Home';

const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya'];
const JENJANG = ['SMP', 'MTs', 'Paket B', 'Lainnya'];
const UKURAN = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const TINGKAT = ['Sekolah', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Nasional', 'Internasional'];
const PROGRAM = [
  { kode: 'TEKNIK MESIN', nama: 'Teknik Mesin' },
  { kode: 'TEKNIK OTOMOTIF', nama: 'Teknik Otomotif' },
  { kode: 'PPLG', nama: 'Pengembangan Perangkat Lunak dan Gim (PPLG)' },
];

const emptyForm = () => ({
  siswa: {
    nama_lengkap: '', nisn: '', tempat_lahir: '', tanggal_lahir: '', jenis_kelamin: '', agama: '',
    alamat: '', desa: '', kecamatan: '', kabupaten: '', jarak_km: '', hp_siswa: '',
    berat_badan: '', tinggi_badan: '', jenjang_asal: '', asal_sekolah: '', asal_kecamatan: '',
    asal_kabupaten: '', no_seri_ijazah: '', uniform_size: '',
  },
  ortu: { ayah_nama: '', ayah_pekerjaan: '', ayah_hp: '', ibu_nama: '', ibu_pekerjaan: '', ibu_hp: '', alamat: '', rt: '', rw: '', desa: '', kecamatan: '', kabupaten: '' },
  wali: { nama: '', alamat: '', rt: '', rw: '', pekerjaan: '', hp: '', sama_dengan_ortu: false },
  prestasi: { memiliki: 'Tidak', nama: '', tingkat: 'Sekolah', tahun: '', keterangan: '' },
  tka: [{ jenis: 'wajib', mapel: 'Matematika', nilai: '' }, { jenis: 'wajib', mapel: 'Bahasa Indonesia', nilai: '' }],
  pilihan: { program_keahlian: '' },
  riwayat: { pernah: false, sekolah: '', jurusan: '', tahun: '', status: '' },
  pernyataan: false,
});

type Form = ReturnType<typeof emptyForm>;

const STEP_LABELS = ['Data Diri Siswa', 'Orang Tua/Wali', 'Prestasi & Nilai TKA', 'Program Keahlian', 'Berkas & Pernyataan'];

function umur10Juli(tanggalLahir: string): string {
  if (!tanggalLahir) return '';
  const ref = new Date(2027, 6, 10);
  const d = new Date(tanggalLahir);
  if (isNaN(d.getTime()) || d > ref) return '';
  let years = ref.getFullYear() - d.getFullYear();
  let months = ref.getMonth() - d.getMonth();
  let days = ref.getDate() - d.getDate();
  if (days < 0) { months--; days += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  return `${years ? years + ' tahun ' : ''}${months} bulan ${days} hari`.trim();
}

function validPhone(p: string): boolean {
  const digits = p.replace(/[^0-9]/g, '');
  return /^(62|0)8[0-9]{7,12}$/.test(digits);
}

export default function Daftar() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(emptyForm);
  const [draftToken, setDraftToken] = useState<string | null>(localStorage.getItem('spmb_draft'));
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ registration_number: string; pin: string; gelombang: string } | null>(null);
  const [docs, setDocs] = useState<Record<string, { status: 'Ada' | 'Belum Ada'; file?: File }>>({});
  const { toast } = useToast();
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!draftToken) return;
    api.get(`/api/public/draft/${draftToken}`).then(d => {
      const saved = emptyForm();
      const data = d.data || {};
      setForm({ ...saved, ...data, siswa: { ...saved.siswa, ...(data.siswa || {}) }, ortu: { ...saved.ortu, ...(data.ortu || {}) }, wali: { ...saved.wali, ...(data.wali || {}) }, prestasi: { ...saved.prestasi, ...(data.prestasi || {}) }, pilihan: { ...saved.pilihan, ...(data.pilihan || {}) }, riwayat: { ...saved.riwayat, ...(data.riwayat || {}) } });
      setStep(Math.min(5, d.step || 1));
      toast('info', 'Draft pendaftaran sebelumnya dimuat ulang.');
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (result) return;
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      api.post('/api/public/draft', { draft_token: draftToken, step, data: form })
        .then(d => {
          setDraftToken(d.draft_token);
          localStorage.setItem('spmb_draft', d.draft_token);
          setSavedAt(new Date().toLocaleTimeString('id-ID'));
        })
        .catch(() => undefined);
    }, 1200);
    return () => clearTimeout(autosaveTimer.current);
  }, [form, step, result]);

  const update = (section: keyof Form, field: string, value: any) => {
    setForm(f => ({ ...f, [section]: { ...(f as any)[section], [field]: value } }));
  };

  const umur = useMemo(() => umur10Juli(form.siswa.tanggal_lahir), [form.siswa.tanggal_lahir]);

  const validateStep = (s: number): string[] => {
    const e: string[] = [];
    const S = form.siswa;
    if (s === 1) {
      if (!S.nama_lengkap || S.nama_lengkap.trim().length < 3) e.push('Nama lengkap wajib diisi (min. 3 karakter).');
      if (!/^[0-9]{10}$/.test(S.nisn)) e.push('NISN harus 10 digit angka.');
      if (!S.tempat_lahir) e.push('Tempat lahir wajib diisi.');
      if (!S.tanggal_lahir) e.push('Tanggal lahir wajib diisi.');
      if (!S.jenis_kelamin) e.push('Jenis kelamin wajib dipilih.');
      if (!S.agama) e.push('Agama wajib dipilih.');
      if (!S.alamat) e.push('Alamat lengkap wajib diisi.');
      if (!S.desa || !S.kecamatan || !S.kabupaten) e.push('Desa, Kecamatan, dan Kabupaten/Kota wajib diisi.');
      if (!validPhone(S.hp_siswa)) e.push('Nomor HP siswa tidak valid (contoh: 0812xxxxxxx).');
      if (!S.uniform_size) e.push('Ukuran seragam wajib dipilih.');
    }
    if (s === 2) {
      const O = form.ortu;
      if (!O.ayah_nama && !O.ibu_nama) e.push('Minimal nama ayah atau ibu wajib diisi.');
      if (O.ayah_hp && !validPhone(O.ayah_hp)) e.push('Nomor HP ayah tidak valid.');
      if (O.ibu_hp && !validPhone(O.ibu_hp)) e.push('Nomor HP ibu tidak valid.');
      if (!O.alamat) e.push('Alamat orang tua wajib diisi.');
      if (form.wali.hp && !validPhone(form.wali.hp)) e.push('Nomor HP wali tidak valid.');
    }
    if (s === 3) {
      if (form.prestasi.memiliki === 'Ya' && !form.prestasi.nama) e.push('Nama prestasi wajib diisi.');
      for (const t of form.tka) {
        if (t.mapel && (t.nilai === '' || isNaN(Number(t.nilai)) || Number(t.nilai) < 0 || Number(t.nilai) > 100)) {
          e.push(`Nilai TKA "${t.mapel}" harus angka 0–100.`);
        }
      }
    }
    if (s === 4) {
      if (!form.pilihan.program_keahlian) e.push('Pilih satu program keahlian.');
    }
    return e;
  };

  const next = () => {
    const e = validateStep(step);
    setErrors(e);
    if (e.length) { toast('error', 'Periksa kembali isian Anda.'); return; }
    setStep(s => Math.min(5, s + 1));
    window.scrollTo({ top: 0 });
  };
  const back = () => { setErrors([]); setStep(s => Math.max(1, s - 1)); };

  const submit = async () => {
    for (let s = 1; s <= 4; s++) {
      const e = validateStep(s);
      if (e.length) { setErrors(e); setStep(s); toast('error', 'Ada isian yang belum lengkap pada tahap ' + s); return; }
    }
    if (!form.pernyataan) { toast('error', 'Centang pernyataan kebenaran data terlebih dahulu.'); return; }
    setBusy(true);
    try {
      const d = await api.post('/api/public/register', { draft_token: draftToken, data: form });
      setResult(d);
      localStorage.removeItem('spmb_draft');
      toast('success', 'Pendaftaran berhasil dikirim!');
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      toast('error', err.message || 'Pendaftaran gagal.');
    } finally {
      setBusy(false);
    }
  };

  if (result) return <Berhasil regNumber={result.registration_number} pin={result.pin} gelombang={result.gelombang} />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl md:text-3xl font-extrabold text-primary-800 dark:text-primary-300 mb-2">Formulir Pendaftaran</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Isi lima tahap berikut. Data tersimpan otomatis sebagai draft {savedAt && <span className="text-emerald-600 dark:text-emerald-400">• tersimpan {savedAt}</span>}
      </p>

      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {STEP_LABELS.map((l, i) => (
            <div key={l} className={`flex-1 text-center text-[10px] md:text-xs font-semibold ${step >= i + 1 ? 'text-primary-700 dark:text-primary-300' : 'text-slate-400'}`}>
              {i + 1}. {l}
            </div>
          ))}
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-700 to-primary-400 transition-all duration-300" style={{ width: `${(step / 5) * 100}%` }} />
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mb-5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          <div className="font-bold mb-1">Periksa isian berikut:</div>
          <ul className="list-disc pl-5 space-y-0.5">{errors.map(e => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <div className="card p-6">
        {step === 1 && <Step1 form={form} update={update} umur={umur} />}
        {step === 2 && <Step2 form={form} update={update} />}
        {step === 3 && <Step3 form={form} update={update} />}
        {step === 4 && <Step4 form={form} update={update} />}
        {step === 5 && <Step5 form={form} docs={docs} setDocs={setDocs} update={update} />}
      </div>

      <div className="flex flex-wrap gap-3 mt-6">
        {step > 1 && <button onClick={back} className="btn-ghost">← Kembali</button>}
        {step < 5 && <button onClick={next} className="btn-primary ml-auto">Selanjutnya →</button>}
        {step === 5 && (
          <>
            <button onClick={() => setStep(4)} className="btn-ghost">← Kembali</button>
            <button onClick={submit} className="btn-accent ml-auto !px-6" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim Pendaftaran'}</button>
          </>
        )}
      </div>
    </div>
  );
}

function Berhasil({ regNumber, pin, gelombang }: { regNumber: string; pin: string; gelombang: string }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="card p-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4">✔</div>
        <h1 className="text-2xl font-extrabold text-primary-800 dark:text-primary-300 mb-2">Pendaftaran Berhasil!</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Simpan nomor pendaftaran dan PIN rahasia berikut untuk cek/ubah pendaftaran.</p>
        <div className="bg-primary-50 dark:bg-primary-500/10 rounded-xl p-5 mb-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Nomor Pendaftaran</div>
          <div className="text-3xl font-extrabold text-primary-800 dark:text-primary-300 tracking-wider">{regNumber}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">PIN Rahasia</div>
          <div className="text-2xl font-extrabold tracking-[0.3em] text-accent-500">{pin}</div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Gelombang: <b>{gelombang}</b></p>
        <Link to="/cek" className="btn-primary w-full">Cek / Ubah Pendaftaran & Cetak Formulir</Link>
      </div>
    </div>
  );
}

function Step1({ form, update, umur }: any) {
  const S = form.siswa;
  return (
    <div className="space-y-5">
      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2">A. Identitas Pribadi</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><label className="label">1. Nama Lengkap *</label><input className="input" value={S.nama_lengkap} onChange={e => update('siswa', 'nama_lengkap', e.target.value)} placeholder="Sesuai ijazah/akta" /></div>
        <div><label className="label">2. NISN *</label><input className="input" value={S.nisn} onChange={e => update('siswa', 'nisn', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} placeholder="10 digit" inputMode="numeric" /></div>
        <div><label className="label">3. Tempat Lahir *</label><input className="input" value={S.tempat_lahir} onChange={e => update('siswa', 'tempat_lahir', e.target.value)} /></div>
        <div><label className="label">4. Tanggal Lahir *</label><input className="input" type="date" value={S.tanggal_lahir} onChange={e => update('siswa', 'tanggal_lahir', e.target.value)} /></div>
        <div>
          <label className="label">5. Jenis Kelamin *</label>
          <div className="flex gap-4 pt-1">
            {['Laki-laki', 'Perempuan'].map(j => (
              <label key={j} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="jk" checked={S.jenis_kelamin === j} onChange={() => update('siswa', 'jenis_kelamin', j)} /> {j}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label">6. Agama *</label>
          <select className="input" value={S.agama} onChange={e => update('siswa', 'agama', e.target.value)}>
            <option value="">— Pilih Agama —</option>
            {AGAMA.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2 pt-2">B. Alamat dan Informasi Siswa</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><label className="label">7. Alamat Lengkap *</label><textarea className="input" rows={2} value={S.alamat} onChange={e => update('siswa', 'alamat', e.target.value)} /></div>
        <div><label className="label">8. Desa/Kelurahan *</label><input className="input" value={S.desa} onChange={e => update('siswa', 'desa', e.target.value)} /></div>
        <div><label className="label">9. Kecamatan *</label><input className="input" value={S.kecamatan} onChange={e => update('siswa', 'kecamatan', e.target.value)} /></div>
        <div><label className="label">10. Kabupaten/Kota *</label><input className="input" value={S.kabupaten} onChange={e => update('siswa', 'kabupaten', e.target.value)} /></div>
        <div><label className="label">11. Jarak Rumah ke Sekolah (km)</label><input className="input" type="number" min="0" step="0.1" value={S.jarak_km} onChange={e => update('siswa', 'jarak_km', e.target.value)} /></div>
        <div><label className="label">12. Nomor HP Siswa *</label><input className="input" value={S.hp_siswa} onChange={e => update('siswa', 'hp_siswa', e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></div>
        <div><label className="label">13. Berat Badan (kg)</label><input className="input" type="number" min="0" value={S.berat_badan} onChange={e => update('siswa', 'berat_badan', e.target.value)} /></div>
        <div><label className="label">14. Tinggi Badan (cm)</label><input className="input" type="number" min="0" value={S.tinggi_badan} onChange={e => update('siswa', 'tinggi_badan', e.target.value)} /></div>
        <div className="md:col-span-2">
          <label className="label">15. Umur pada 10 Juli 2027 (otomatis)</label>
          <div className="input bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{umur || '— dihitung dari tanggal lahir —'}</div>
        </div>
      </div>

      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2 pt-2">C. Asal Sekolah</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">16. Jenjang Asal Sekolah *</label>
          <select className="input" value={S.jenjang_asal} onChange={e => update('siswa', 'jenjang_asal', e.target.value)}>
            <option value="">— Pilih Jenjang —</option>
            {JENJANG.map(j => <option key={j}>{j}</option>)}
          </select>
        </div>
        <div><label className="label">17. Nama Asal Sekolah *</label><input className="input" value={S.asal_sekolah} onChange={e => update('siswa', 'asal_sekolah', e.target.value)} /></div>
        <div><label className="label">18. Kecamatan *</label><input className="input" value={S.asal_kecamatan} onChange={e => update('siswa', 'asal_kecamatan', e.target.value)} /></div>
        <div><label className="label">19. Kabupaten/Kota *</label><input className="input" value={S.asal_kabupaten} onChange={e => update('siswa', 'asal_kabupaten', e.target.value)} /></div>
        <div className="md:col-span-2"><label className="label">20. Nomor Seri Ijazah (jika sudah tersedia)</label><input className="input" value={S.no_seri_ijazah} onChange={e => update('siswa', 'no_seri_ijazah', e.target.value)} /></div>
      </div>

      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2 pt-2">D. Ukuran Seragam</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-3">Ukuran seragam akan digunakan sebagai data pengadaan seragam sekolah.</p>
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        {UKURAN.map(u => (
          <button key={u} type="button" onClick={() => update('siswa', 'uniform_size', u)}
            className={`rounded-xl border-2 py-3 text-sm font-bold transition ${S.uniform_size === u ? 'border-primary-600 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300' : 'border-slate-200 dark:border-slate-700 hover:border-primary-300'}`}>
            {u}
          </button>
        ))}
      </div>
      {S.uniform_size && (
        <div className="rounded-xl bg-primary-50 dark:bg-primary-500/10 p-3 text-sm">
          Ringkasan: Ukuran seragam yang dipilih = <b>{S.uniform_size}</b>
        </div>
      )}
    </div>
  );
}

function Step2({ form, update }: any) {
  const O = form.ortu;
  const W = form.wali;
  return (
    <div className="space-y-5">
      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2">A. Data Ayah Kandung</h3>
      <div className="grid md:grid-cols-3 gap-4">
        <div><label className="label">1. Nama Lengkap Ayah</label><input className="input" value={O.ayah_nama} onChange={e => update('ortu', 'ayah_nama', e.target.value)} /></div>
        <div><label className="label">2. Pekerjaan Ayah</label><input className="input" value={O.ayah_pekerjaan} onChange={e => update('ortu', 'ayah_pekerjaan', e.target.value)} /></div>
        <div><label className="label">3. Nomor HP Ayah</label><input className="input" value={O.ayah_hp} onChange={e => update('ortu', 'ayah_hp', e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></div>
      </div>
      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2">B. Data Ibu Kandung</h3>
      <div className="grid md:grid-cols-3 gap-4">
        <div><label className="label">4. Nama Lengkap Ibu</label><input className="input" value={O.ibu_nama} onChange={e => update('ortu', 'ibu_nama', e.target.value)} /></div>
        <div><label className="label">5. Pekerjaan Ibu</label><input className="input" value={O.ibu_pekerjaan} onChange={e => update('ortu', 'ibu_pekerjaan', e.target.value)} /></div>
        <div><label className="label">6. Nomor HP Ibu</label><input className="input" value={O.ibu_hp} onChange={e => update('ortu', 'ibu_hp', e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></div>
      </div>
      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2">C. Data Orang Tua</h3>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-3"><label className="label">7. Alamat Lengkap Orang Tua *</label><input className="input" value={O.alamat} onChange={e => update('ortu', 'alamat', e.target.value)} /></div>
        <div><label className="label">8. RT</label><input className="input" value={O.rt} onChange={e => update('ortu', 'rt', e.target.value)} /></div>
        <div><label className="label">9. RW</label><input className="input" value={O.rw} onChange={e => update('ortu', 'rw', e.target.value)} /></div>
        <div><label className="label">10. Desa/Kelurahan</label><input className="input" value={O.desa} onChange={e => update('ortu', 'desa', e.target.value)} /></div>
        <div><label className="label">11. Kecamatan</label><input className="input" value={O.kecamatan} onChange={e => update('ortu', 'kecamatan', e.target.value)} /></div>
        <div className="md:col-span-2"><label className="label">12. Kabupaten/Kota</label><input className="input" value={O.kabupaten} onChange={e => update('ortu', 'kabupaten', e.target.value)} /></div>
      </div>
      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2">D. Data Wali (Opsional)</h3>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={W.sama_dengan_ortu} onChange={e => {
          const checked = e.target.checked;
          update('wali', 'sama_dengan_ortu', checked);
          if (checked) {
            update('wali', 'alamat', form.ortu.alamat);
            update('wali', 'rt', form.ortu.rt);
            update('wali', 'rw', form.ortu.rw);
          }
        }} />
        Alamat wali sama dengan alamat orang tua.
      </label>
      <div className="grid md:grid-cols-3 gap-4">
        <div><label className="label">13. Nama Wali</label><input className="input" value={W.nama} onChange={e => update('wali', 'nama', e.target.value)} /></div>
        <div className="md:col-span-2"><label className="label">14. Alamat Wali</label><input className="input" value={W.alamat} onChange={e => update('wali', 'alamat', e.target.value)} readOnly={W.sama_dengan_ortu} /></div>
        <div><label className="label">15. RT</label><input className="input" value={W.rt} onChange={e => update('wali', 'rt', e.target.value)} readOnly={W.sama_dengan_ortu} /></div>
        <div><label className="label">16. RW</label><input className="input" value={W.rw} onChange={e => update('wali', 'rw', e.target.value)} readOnly={W.sama_dengan_ortu} /></div>
        <div><label className="label">17. Pekerjaan Wali</label><input className="input" value={W.pekerjaan} onChange={e => update('wali', 'pekerjaan', e.target.value)} /></div>
        <div><label className="label">18. Nomor HP Wali</label><input className="input" value={W.hp} onChange={e => update('wali', 'hp', e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></div>
      </div>
    </div>
  );
}

function Step3({ form, update }: any) {
  const P = form.prestasi;
  const addPilihan = () => update('tka', form.tka.push({ jenis: 'pilihan', mapel: '', nilai: '' }));
  return (
    <div className="space-y-5">
      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2">A. Prestasi/Piagam Kejuaraan</h3>
      <div className="flex gap-4">
        {['Ya', 'Tidak'].map(v => (
          <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="prestasi" checked={P.memiliki === v} onChange={() => update('prestasi', 'memiliki', v)} /> {v}
          </label>
        ))}
      </div>
      {P.memiliki === 'Ya' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><label className="label">2. Nama Prestasi/Kejuaraan *</label><input className="input" value={P.nama} onChange={e => update('prestasi', 'nama', e.target.value)} /></div>
          <div>
            <label className="label">3. Tingkat Prestasi *</label>
            <select className="input" value={P.tingkat} onChange={e => update('prestasi', 'tingkat', e.target.value)}>
              {TINGKAT.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="label">4. Tahun Prestasi *</label><input className="input" value={P.tahun} onChange={e => update('prestasi', 'tahun', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="2026" /></div>
          <div className="md:col-span-2"><label className="label">5. Keterangan Tambahan</label><textarea className="input" rows={2} value={P.keterangan} onChange={e => update('prestasi', 'keterangan', e.target.value)} /></div>
        </div>
      )}
      {P.memiliki === 'Tidak' && <p className="text-sm text-slate-500 dark:text-slate-400">Bagian prestasi boleh dikosongkan.</p>}

      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2 pt-2">B. Nilai TKA</h3>
      <div className="space-y-3">
        {form.tka.map((t: any, i: number) => (
          <div key={i} className="grid grid-cols-[100px_1fr_120px] gap-3 items-end">
            <div>
              <label className="label">{i === 0 ? '1. Wajib' : 'Jenis'}</label>
              <select className="input" value={t.jenis} onChange={e => { const tka = [...form.tka]; tka[i].jenis = e.target.value; update('tka', tka); }}>
                <option value="wajib">Wajib</option>
                <option value="pilihan">Pilihan</option>
              </select>
            </div>
            <div>
              <label className="label">{i === 0 ? 'Mata Pelajaran Wajib' : i === 1 ? 'Mata Pelajaran Wajib' : 'Mata Pelajaran Pilihan'}</label>
              <input className="input" value={t.mapel} onChange={e => { const tka = [...form.tka]; tka[i].mapel = e.target.value; update('tka', tka); }} placeholder="cth. Matematika" />
            </div>
            <div>
              <label className="label">Nilai (0–100)</label>
              <input className="input" type="number" min="0" max="100" value={t.nilai} onChange={e => { const tka = [...form.tka]; tka[i].nilai = e.target.value; update('tka', tka); }} />
            </div>
          </div>
        ))}
        <button type="button" onClick={addPilihan} className="btn-ghost !py-2 text-sm">+ Tambah Mata Pelajaran Pilihan</button>
      </div>
    </div>
  );
}

function Step4({ form, update }: any) {
  const R = form.riwayat;
  return (
    <div className="space-y-6">
      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2">A. Pilihan Program Keahlian (wajib pilih satu)</h3>
      <div className="grid md:grid-cols-3 gap-4">
        {PROGRAM.map(p => (
          <button key={p.kode} type="button" onClick={() => update('pilihan', 'program_keahlian', p.kode)}
            className={`card p-5 text-left border-2 transition ${form.pilihan.program_keahlian === p.kode ? 'border-primary-600 ring-2 ring-primary-500/30' : 'border-transparent hover:border-primary-200'}`}>
            <div className="text-4xl mb-2">{programIcons[p.kode]}</div>
            <div className="font-bold text-primary-800 dark:text-primary-300">{p.nama}</div>
            {form.pilihan.program_keahlian === p.kode && <div className="text-xs font-bold text-emerald-600 mt-1">✔ Dipilih</div>}
          </button>
        ))}
      </div>

      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2">B. Riwayat Pendaftaran</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 -mt-3">Sebelum mendaftar di SMK Bhina Karya Karanganyar, pernah mendaftar di sekolah mana?</p>
      <div className="flex gap-4">
        {[['Belum pernah', false], ['Pernah', true]].map(([label, val]) => (
          <label key={String(label)} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="riwayat" checked={R.pernah === val} onChange={() => update('riwayat', 'pernah', val)} /> {label}
          </label>
        ))}
      </div>
      {R.pernah && (
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="label">Nama Sekolah</label><input className="input" value={R.sekolah} onChange={e => update('riwayat', 'sekolah', e.target.value)} /></div>
          <div><label className="label">Program Keahlian yang Dipilih</label><input className="input" value={R.jurusan} onChange={e => update('riwayat', 'jurusan', e.target.value)} /></div>
          <div><label className="label">Tahun Pendaftaran</label><input className="input" value={R.tahun} onChange={e => update('riwayat', 'tahun', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} /></div>
          <div>
            <label className="label">Status (opsional)</label>
            <select className="input" value={R.status} onChange={e => update('riwayat', 'status', e.target.value)}>
              <option value="">— Pilih —</option>
              <option>Diterima</option>
              <option>Tidak diterima</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

const DOC_LIST = [
  { key: 'kk', label: 'Fotokopi Kartu Keluarga (KK)' },
  { key: 'akta', label: 'Akta Kelahiran' },
  { key: 'transkrip', label: 'Surat Keterangan Nilai/Transkrip Nilai' },
  { key: 'ijazah', label: 'Ijazah' },
  { key: 'nisn', label: 'Kartu NISN' },
  { key: 'foto', label: 'Foto Hitam Putih 3 x 4 (6 lembar)' },
];

function Step5({ form, update, docs, setDocs }: any) {
  const { toast } = useToast();
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busyDoc, setBusyDoc] = useState<string | null>(null);

  const pick = (key: string, file: File | null) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      toast('error', 'Format harus JPG, PNG, atau PDF.'); return;
    }
    if (file.size > 5 * 1024 * 1024) { toast('error', 'Ukuran maksimal 5 MB.'); return; }
    if (previews[key]) URL.revokeObjectURL(previews[key]);
    setPreviews(p => ({ ...p, [key]: URL.createObjectURL(file) }));
    setDocs((d: any) => ({ ...d, [key]: { status: 'Ada', file } }));
  };

  const uploadDoc = async (key: string) => {
    const doc = docs[key];
    if (!doc) return;
    setBusyDoc(key);
    try {
      if (doc.status === 'Belum Ada') {
        const fd = new FormData();
        fd.append('doc_type', key);
        fd.append('status', 'Belum Ada');
        await api.upload('/api/documents/public/upload', fd);
        toast('success', 'Status dokumen disimpan: Belum Ada.');
      } else if (doc.file) {
        const fd = new FormData();
        fd.append('doc_type', key);
        fd.append('status', 'Ada');
        fd.append('source', 'kamera');
        fd.append('file', doc.file);
        await api.upload('/api/documents/public/upload', fd);
        toast('success', 'Dokumen berhasil diunggah.');
      }
    } catch (e: any) {
      toast('error', e.message || 'Gagal mengunggah dokumen.');
    } finally {
      setBusyDoc(null);
    }
  };

  const removeDoc = (key: string) => {
    if (previews[key]) URL.revokeObjectURL(previews[key]);
    setPreviews((p: any) => ({ ...p, [key]: undefined }));
    setDocs((d: any) => { const n = { ...d }; delete n[key]; return n; });
  };

  const S = form.siswa;
  return (
    <div className="space-y-6">
      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2">Berkas Persyaratan</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-3">Format: JPG, JPEG, PNG, PDF (maks. 5 MB). Foto dapat menggunakan kamera smartphone atau webcam komputer. Dokumen yang belum tersedia dapat diberi status "Belum Ada" namun wajib dilengkapi kemudian.</p>
      <div className="space-y-3">
        {DOC_LIST.map(d => {
          const doc = docs[d.key];
          return (
            <div key={d.key} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="font-semibold text-sm">{d.label}</div>
                <span className={`badge ${doc?.status === 'Ada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {doc?.status === 'Ada' ? '✔ Ada' : 'Belum Ada'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="btn-ghost !py-2 text-sm cursor-pointer">
                  📎 Pilih File
                  <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    onChange={e => pick(d.key, e.target.files?.[0] || null)} />
                </label>
                <label className="btn-ghost !py-2 text-sm cursor-pointer">
                  📷 Kamera
                  <input type="file" className="hidden" accept="image/*" capture="environment"
                    onChange={e => pick(d.key, e.target.files?.[0] || null)} />
                </label>
                <button type="button" className="btn-ghost !py-2 text-sm" onClick={() => { setDocs((x: any) => ({ ...x, [d.key]: { status: 'Belum Ada' } })); }}>Dokumen Belum Ada</button>
                {doc && <button type="button" className="btn-ghost !py-2 text-sm" onClick={() => uploadDoc(d.key)} disabled={busyDoc === d.key}>{busyDoc === d.key ? 'Mengunggah…' : '⬆ Simpan ke Server'}</button>}
                {doc?.file && <button type="button" className="btn-ghost !py-2 text-sm" onClick={() => removeDoc(d.key)}>🗑 Hapus</button>}
              </div>
              {doc?.file && (
                <div className="mt-3 flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  {previews[d.key] && (doc.file.type.startsWith('image/')
                    ? <img src={previews[d.key]} alt="preview" className="w-16 h-16 object-cover rounded" />
                    : <div className="w-16 h-16 rounded bg-accent-500/10 text-accent-500 flex items-center justify-center text-2xl">📄</div>)}
                  <div className="text-xs">
                    <div className="font-semibold">{doc.file.name}</div>
                    <div className="text-slate-500">{(doc.file.size / 1024).toFixed(0)} KB • {doc.file.type}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2 pt-2">Pernyataan Kebenaran Data</h3>
      <label className="flex gap-3 items-start text-sm cursor-pointer bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
        <input type="checkbox" className="mt-0.5" checked={form.pernyataan} onChange={e => update('pernyataan', e.target.checked)} />
        <span>Saya menyatakan bahwa seluruh data yang saya isikan dalam formulir pendaftaran ini adalah benar dan dapat dipertanggungjawabkan. Apabila terdapat data yang tidak benar, saya bersedia menerima konsekuensi sesuai ketentuan sekolah.</span>
      </label>

      <PreviewData form={form} />
    </div>
  );
}

function PreviewData({ form }: { form: Form }) {
  const S = form.siswa;
  const rows: Array<[string, string]> = [
    ['Nama Lengkap', S.nama_lengkap], ['NISN', S.nisn],
    ['Tempat/Tanggal Lahir', `${S.tempat_lahir}, ${S.tanggal_lahir}`],
    ['Jenis Kelamin', S.jenis_kelamin], ['Agama', S.agama],
    ['Alamat', `${S.alamat}, Desa ${S.desa}, Kec. ${S.kecamatan}, ${S.kabupaten}`],
    ['No. HP Siswa', S.hp_siswa], ['Ukuran Seragam', S.uniform_size],
    ['Asal Sekolah', `${S.jenjang_asal} - ${S.asal_sekolah}`],
    ['Program Keahlian', form.pilihan.program_keahlian],
    ['Ayah / Ibu', `${form.ortu.ayah_nama || '-'} / ${form.ortu.ibu_nama || '-'}`],
    ['Prestasi', form.prestasi.memiliki === 'Ya' ? `${form.prestasi.nama} (${form.prestasi.tingkat}, ${form.prestasi.tahun})` : 'Tidak ada'],
    ['Nilai TKA', form.tka.filter(t => t.mapel).map(t => `${t.mapel}: ${t.nilai}`).join(', ')],
  ];
  return (
    <div>
      <h3 className="font-bold text-primary-700 dark:text-primary-300 border-l-4 border-primary-500 pl-2 mb-3">Preview Data</h3>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex gap-3 px-4 py-2 ${i % 2 ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}>
            <div className="w-44 shrink-0 text-slate-500 dark:text-slate-400">{k}</div>
            <div className="font-medium break-all">{v || '-'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
