import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useToast } from '../components/Toast';

const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya'];
const JENJANG = ['SMP', 'MTs', 'Paket B', 'Lainnya'];
const UKURAN = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const TINGKAT = ['Sekolah', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Nasional', 'Internasional'];
const PROGRAMS = ['TEKNIK MESIN', 'TEKNIK OTOMOTIF', 'PPLG'];

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

const emptyForm = () => ({
  siswa: {
    nama_lengkap: '', nisn: '', tempat_lahir: '', tanggal_lahir: '', jenis_kelamin: '', agama: '',
    alamat: '', desa: '', kecamatan: '', kabupaten: '', jarak_km: '', hp_siswa: '',
    berat_badan: '', tinggi_badan: '', jenjang_asal: '', asal_sekolah: '', asal_kecamatan: '',
    asal_kabupaten: '', no_seri_ijazah: '', uniform_size: '',
    riwayat_sekolah: '', riwayat_jurusan: '', riwayat_tahun: '', riwayat_status: '',
  },
  ortu: { ayah_nama: '', ayah_pekerjaan: '', ayah_hp: '', ibu_nama: '', ibu_pekerjaan: '', ibu_hp: '', alamat: '', rt: '', rw: '', desa: '', kecamatan: '', kabupaten: '' },
  wali: { nama: '', alamat: '', rt: '', rw: '', pekerjaan: '', hp: '', sama_dengan_ortu: false },
  prestasi: { memiliki: 'Tidak', nama: '', tingkat: 'Sekolah', tahun: '', keterangan: '' },
  tka: [{ jenis: 'wajib', mapel: 'Matematika', nilai: '' }, { jenis: 'wajib', mapel: 'Bahasa Indonesia', nilai: '' }],
  pilihan: { program_keahlian: '' },
  riwayat: { pernah: false },
});

export default function InputPendaftaran() {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ id: number; registration_number: string; pin: string } | null>(null);

  const up = (section: string, field: string, value: any) =>
    setForm((f: any) => ({ ...f, [section]: { ...f[section], [field]: value } }));

  const validate = (): string[] => {
    const e: string[] = [];
    const S = form.siswa;
    if (!S.nama_lengkap || S.nama_lengkap.trim().length < 3) e.push('Nama lengkap wajib diisi (min. 3 karakter).');
    if (!/^[0-9]{10}$/.test(S.nisn)) e.push('NISN harus 10 digit angka.');
    if (!S.tempat_lahir || !S.tanggal_lahir) e.push('Tempat dan tanggal lahir wajib diisi.');
    if (!S.jenis_kelamin || !S.agama) e.push('Jenis kelamin dan agama wajib dipilih.');
    if (!S.alamat || !S.desa || !S.kecamatan || !S.kabupaten) e.push('Alamat lengkap siswa wajib diisi.');
    if (!validPhone(S.hp_siswa)) e.push('Nomor HP siswa tidak valid (contoh: 0812xxxxxxx).');
    if (!S.uniform_size) e.push('Ukuran seragam wajib dipilih.');
    if (!S.asal_sekolah) e.push('Nama asal sekolah wajib diisi.');
    const O = form.ortu;
    if (!O.ayah_nama && !O.ibu_nama) e.push('Minimal nama ayah atau ibu wajib diisi.');
    if (O.ayah_hp && !validPhone(O.ayah_hp)) e.push('Nomor HP ayah tidak valid.');
    if (O.ibu_hp && !validPhone(O.ibu_hp)) e.push('Nomor HP ibu tidak valid.');
    if (!O.alamat) e.push('Alamat orang tua wajib diisi.');
    if (form.wali.hp && !validPhone(form.wali.hp)) e.push('Nomor HP wali tidak valid.');
    if (form.prestasi.memiliki === 'Ya' && !form.prestasi.nama) e.push('Nama prestasi wajib diisi.');
    for (const t of form.tka) {
      if (t.mapel && (t.nilai === '' || isNaN(Number(t.nilai)) || Number(t.nilai) < 0 || Number(t.nilai) > 100)) {
        e.push(`Nilai TKA "${t.mapel}" harus angka 0–100.`);
      }
    }
    if (!form.pilihan.program_keahlian) e.push('Pilih satu program keahlian.');
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (e.length) { toast('error', 'Periksa kembali isian.'); return; }
    setBusy(true);
    try {
      const { riwayat, ...rest } = form;
      const d = await api.post('/api/applicants', {
        data: { ...rest, riwayat: { pernah: riwayat.pernah, sekolah: form.siswa.riwayat_sekolah, jurusan: form.siswa.riwayat_jurusan, tahun: form.siswa.riwayat_tahun, status: form.siswa.riwayat_status } },
      });
      setResult(d);
      toast('success', `Pendaftaran tersimpan: ${d.registration_number}`);
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      toast('error', err.message || 'Gagal menyimpan pendaftaran.');
    } finally { setBusy(false); }
  };

  const reset = () => { setResult(null); setForm(emptyForm()); setErrors([]); };

  if (result) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-xl font-extrabold text-primary-800 dark:text-primary-300">Pendaftaran Tersimpan</h1>
          <div className="my-4 space-y-1">
            <div className="text-sm text-slate-500">Nomor Pendaftaran</div>
            <div className="text-3xl font-extrabold tracking-wider text-accent-500">{result.registration_number}</div>
            <div className="text-sm text-slate-500 mt-3">PIN Calon Siswa</div>
            <div className="text-xl font-bold tracking-widest">{result.pin}</div>
          </div>
          <p className="text-xs text-slate-400 mb-4">Berikan nomor pendaftaran dan PIN ini kepada calon siswa untuk akses Cek/Ubah Pendaftaran.</p>
          <div className="flex gap-2 justify-center">
            <a className="btn-primary" href={`/api/applicants/${result.id}/formulir.pdf`} target="_blank" rel="noreferrer">Cetak Formulir</a>
            <Link className="btn-ghost" to={`/panel/pendaftaran/${result.id}`}>Lihat Detail</Link>
            <button className="btn-ghost" onClick={reset}>Input Baru</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300 mb-1">Input Pendaftaran Baru</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Nomor pendaftaran, tanggal, dan gelombang dibuat otomatis oleh sistem.</p>

      {errors.length > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-accent-500">
          <ul className="list-disc list-inside text-sm text-accent-600 dark:text-accent-400 space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <Section title="A. Data Diri Siswa">
          <Grid>
            <Text label="Nama Lengkap" value={form.siswa.nama_lengkap} onChange={v => up('siswa', 'nama_lengkap', v)} />
            <Text label="NISN" value={form.siswa.nisn} onChange={v => up('siswa', 'nisn', v.replace(/[^0-9]/g, '').slice(0, 10))} />
            <Text label="Tempat Lahir" value={form.siswa.tempat_lahir} onChange={v => up('siswa', 'tempat_lahir', v)} />
            <Text label="Tanggal Lahir" type="date" value={form.siswa.tanggal_lahir} onChange={v => up('siswa', 'tanggal_lahir', v)} />
            <Select label="Jenis Kelamin" value={form.siswa.jenis_kelamin} onChange={v => up('siswa', 'jenis_kelamin', v)} options={['Laki-laki', 'Perempuan']} />
            <Select label="Agama" value={form.siswa.agama} onChange={v => up('siswa', 'agama', v)} options={AGAMA} />
            <Text label="Umur pada 10 Juli 2027 (otomatis)" value={umur10Juli(form.siswa.tanggal_lahir) || '— isi tanggal lahir —'} readOnly />
            <Text label="Nomor HP Siswa" value={form.siswa.hp_siswa} onChange={v => up('siswa', 'hp_siswa', v)} />
            <Text label="Alamat Lengkap" value={form.siswa.alamat} onChange={v => up('siswa', 'alamat', v)} />
            <Text label="Desa/Kelurahan" value={form.siswa.desa} onChange={v => up('siswa', 'desa', v)} />
            <Text label="Kecamatan" value={form.siswa.kecamatan} onChange={v => up('siswa', 'kecamatan', v)} />
            <Text label="Kabupaten/Kota" value={form.siswa.kabupaten} onChange={v => up('siswa', 'kabupaten', v)} />
            <Text label="Jarak Rumah ke Sekolah (km)" type="number" value={form.siswa.jarak_km} onChange={v => up('siswa', 'jarak_km', v)} />
            <Text label="Berat Badan (kg)" type="number" value={form.siswa.berat_badan} onChange={v => up('siswa', 'berat_badan', v)} />
            <Text label="Tinggi Badan (cm)" type="number" value={form.siswa.tinggi_badan} onChange={v => up('siswa', 'tinggi_badan', v)} />
          </Grid>
          <div className="mt-3">
            <div className="label">Ukuran Seragam (data pengadaan seragam sekolah)</div>
            <div className="flex flex-wrap gap-2">
              {UKURAN.map(u => (
                <button key={u} onClick={() => up('siswa', 'uniform_size', u)}
                  className={`px-4 py-2 rounded-xl border text-sm font-bold transition ${form.siswa.uniform_size === u ? 'bg-primary-700 text-white border-primary-700' : 'border-slate-200 dark:border-slate-700 hover:border-primary-400'}`}>
                  {u}
                </button>
              ))}
            </div>
            {form.siswa.uniform_size && <p className="text-xs text-slate-400 mt-1">Ukuran dipilih: <b>{form.siswa.uniform_size}</b></p>}
          </div>
        </Section>

        <Section title="B. Asal Sekolah">
          <Grid>
            <Select label="Jenjang" value={form.siswa.jenjang_asal} onChange={v => up('siswa', 'jenjang_asal', v)} options={JENJANG} />
            <Text label="Nama Asal Sekolah" value={form.siswa.asal_sekolah} onChange={v => up('siswa', 'asal_sekolah', v)} />
            <Text label="Kecamatan" value={form.siswa.asal_kecamatan} onChange={v => up('siswa', 'asal_kecamatan', v)} />
            <Text label="Kabupaten/Kota" value={form.siswa.asal_kabupaten} onChange={v => up('siswa', 'asal_kabupaten', v)} />
            <Text label="Nomor Seri Ijazah (opsional)" value={form.siswa.no_seri_ijazah} onChange={v => up('siswa', 'no_seri_ijazah', v)} />
          </Grid>
        </Section>

        <Section title="C. Data Orang Tua">
          <Grid>
            <Text label="Nama Ayah" value={form.ortu.ayah_nama} onChange={v => up('ortu', 'ayah_nama', v)} />
            <Text label="Pekerjaan Ayah" value={form.ortu.ayah_pekerjaan} onChange={v => up('ortu', 'ayah_pekerjaan', v)} />
            <Text label="No. HP Ayah" value={form.ortu.ayah_hp} onChange={v => up('ortu', 'ayah_hp', v)} />
            <Text label="Nama Ibu" value={form.ortu.ibu_nama} onChange={v => up('ortu', 'ibu_nama', v)} />
            <Text label="Pekerjaan Ibu" value={form.ortu.ibu_pekerjaan} onChange={v => up('ortu', 'ibu_pekerjaan', v)} />
            <Text label="No. HP Ibu" value={form.ortu.ibu_hp} onChange={v => up('ortu', 'ibu_hp', v)} />
            <Text label="Alamat Orang Tua" value={form.ortu.alamat} onChange={v => up('ortu', 'alamat', v)} />
            <Text label="RT" value={form.ortu.rt} onChange={v => up('ortu', 'rt', v)} />
            <Text label="RW" value={form.ortu.rw} onChange={v => up('ortu', 'rw', v)} />
            <Text label="Desa/Kelurahan" value={form.ortu.desa} onChange={v => up('ortu', 'desa', v)} />
            <Text label="Kecamatan" value={form.ortu.kecamatan} onChange={v => up('ortu', 'kecamatan', v)} />
            <Text label="Kabupaten/Kota" value={form.ortu.kabupaten} onChange={v => up('ortu', 'kabupaten', v)} />
          </Grid>
        </Section>

        <Section title="D. Data Wali (Opsional)">
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" checked={form.wali.sama_dengan_ortu} onChange={e => {
              const c = e.target.checked;
              setForm((f: any) => ({
                ...f, wali: {
                  ...f.wali, sama_dengan_ortu: c,
                  ...(c ? { alamat: f.ortu.alamat, rt: f.ortu.rt, rw: f.ortu.rw, desa: f.ortu.desa, kecamatan: f.ortu.kecamatan, kabupaten: f.ortu.kabupaten } : {}),
                },
              }));
            }} />
            Alamat wali sama dengan alamat orang tua
          </label>
          <Grid>
            <Text label="Nama Wali" value={form.wali.nama} onChange={v => up('wali', 'nama', v)} />
            <Text label="Pekerjaan Wali" value={form.wali.pekerjaan} onChange={v => up('wali', 'pekerjaan', v)} />
            <Text label="No. HP Wali" value={form.wali.hp} onChange={v => up('wali', 'hp', v)} />
            <Text label="Alamat Wali" value={form.wali.alamat} onChange={v => up('wali', 'alamat', v)} disabled={form.wali.sama_dengan_ortu} />
            <Text label="RT" value={form.wali.rt} onChange={v => up('wali', 'rt', v)} disabled={form.wali.sama_dengan_ortu} />
            <Text label="RW" value={form.wali.rw} onChange={v => up('wali', 'rw', v)} disabled={form.wali.sama_dengan_ortu} />
          </Grid>
        </Section>

        <Section title="E. Prestasi dan Nilai TKA">
          <Grid>
            <Select label="Memiliki Prestasi" value={form.prestasi.memiliki} onChange={v => up('prestasi', 'memiliki', v)} options={['Tidak', 'Ya']} />
            {form.prestasi.memiliki === 'Ya' && (
              <>
                <Text label="Nama Prestasi/Kejuaraan" value={form.prestasi.nama} onChange={v => up('prestasi', 'nama', v)} />
                <Select label="Tingkat" value={form.prestasi.tingkat} onChange={v => up('prestasi', 'tingkat', v)} options={TINGKAT} />
                <Text label="Tahun" type="number" value={form.prestasi.tahun} onChange={v => up('prestasi', 'tahun', v)} />
                <Text label="Keterangan Tambahan" value={form.prestasi.keterangan} onChange={v => up('prestasi', 'keterangan', v)} />
              </>
            )}
          </Grid>
          <div className="mt-3">
            <div className="label">Nilai TKA (0–100)</div>
            <div className="space-y-2">
              {form.tka.map((t: any, i: number) => (
                <div key={i} className="flex gap-2 items-center">
                  <select className="input !w-36" value={t.jenis} onChange={e => setForm((f: any) => ({ ...f, tka: f.tka.map((x: any, j: number) => j === i ? { ...x, jenis: e.target.value } : x) }))}>
                    <option value="wajib">Wajib</option>
                    <option value="pilihan">Pilihan</option>
                  </select>
                  <input className="input flex-1" placeholder="Mata pelajaran" value={t.mapel} onChange={e => setForm((f: any) => ({ ...f, tka: f.tka.map((x: any, j: number) => j === i ? { ...x, mapel: e.target.value } : x) }))} />
                  <input className="input !w-24" type="number" min={0} max={100} placeholder="Nilai" value={t.nilai} onChange={e => setForm((f: any) => ({ ...f, tka: f.tka.map((x: any, j: number) => j === i ? { ...x, nilai: e.target.value } : x) }))} />
                  <button className="btn-ghost px-2 py-1 text-accent-500" onClick={() => setForm((f: any) => ({ ...f, tka: f.tka.filter((_: any, j: number) => j !== i) }))}>✕</button>
                </div>
              ))}
            </div>
            <button className="btn-ghost mt-2 text-xs" onClick={() => setForm((f: any) => ({ ...f, tka: [...f.tka, { jenis: 'pilihan', mapel: '', nilai: '' }] }))}>+ Tambah Mata Pelajaran</button>
          </div>
        </Section>

        <Section title="F. Pilihan Program Keahlian & Riwayat Pendaftaran">
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            {PROGRAMS.map(p => (
              <button key={p} onClick={() => up('pilihan', 'program_keahlian', p)}
                className={`p-4 rounded-2xl border-2 text-left transition ${form.pilihan.program_keahlian === p ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-primary-400'}`}>
                <div className="text-2xl mb-1">{p === 'TEKNIK MESIN' ? '⚙️' : p === 'TEKNIK OTOMOTIF' ? '🚗' : '💻'}</div>
                <div className="font-bold text-sm">{p}</div>
                {form.pilihan.program_keahlian === p && <div className="text-xs text-primary-600 font-semibold mt-1">✓ Dipilih</div>}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" checked={form.riwayat.pernah} onChange={e => up('riwayat', 'pernah', e.target.checked)} />
            Pernah mendaftar di SMK Bhina Karya Karanganyar sebelumnya
          </label>
          {form.riwayat.pernah && (
            <Grid>
              <Text label="Nama Sekolah" value={form.siswa.riwayat_sekolah} onChange={v => up('siswa', 'riwayat_sekolah', v)} />
              <Text label="Program Keahlian yang Dipilih" value={form.siswa.riwayat_jurusan} onChange={v => up('siswa', 'riwayat_jurusan', v)} />
              <Text label="Tahun Pendaftaran" type="number" value={form.siswa.riwayat_tahun} onChange={v => up('siswa', 'riwayat_tahun', v)} />
              <Select label="Status Diterima (opsional)" value={form.siswa.riwayat_status} onChange={v => up('siswa', 'riwayat_status', v)} options={['', 'Diterima', 'Tidak diterima']} />
            </Grid>
          )}
        </Section>
      </div>

      <div className="flex flex-wrap gap-2 mt-6">
        <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Menyimpan…' : 'Simpan Pendaftaran'}</button>
        <button className="btn-ghost" onClick={reset}>Kosongkan Formulir</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="font-bold text-sm uppercase tracking-wide text-primary-700 dark:text-primary-300 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>;
}

function Text({ label, value, onChange, type = 'text', readOnly, disabled }: { label: string; value: any; onChange?: (v: string) => void; type?: string; readOnly?: boolean; disabled?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value ?? ''} readOnly={readOnly} disabled={disabled} onChange={e => onChange?.(e.target.value)} />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— Pilih —</option>
        {options.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
