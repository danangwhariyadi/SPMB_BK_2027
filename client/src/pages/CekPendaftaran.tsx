import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/charts';

const DOC_LABELS: Record<string, string> = {
  kk: 'Fotokopi Kartu Keluarga (KK)',
  akta: 'Akta Kelahiran',
  transkrip: 'Surat Keterangan Nilai/Transkrip Nilai',
  ijazah: 'Ijazah',
  nisn: 'Kartu NISN',
  foto: 'Foto Hitam Putih 3x4 (6 lembar)',
  tka: 'Surat Keterangan Nilai TKA',
};

function applicantHeaders() {
  const t = sessionStorage.getItem('spmb_applicant_token');
  return t ? { 'x-applicant-token': t } : {};
}

export default function CekPendaftaran() {
  const { toast } = useToast();
  const [regNumber, setRegNumber] = useState('');
  const [pin, setPin] = useState('');
  const [otpStage, setOtpStage] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (sessionStorage.getItem('spmb_applicant_token')) load();
  }, []);

  const load = () => {
    api.get('/api/public/application', applicantHeaders())
      .then(d => { setData(d); setForm(toForm(d)); })
      .catch(() => sessionStorage.removeItem('spmb_applicant_token'));
  };

  const start = async () => {
    setBusy(true);
    try {
      const d = await api.post('/api/public/check/start', { registration_number: regNumber, pin });
      if (d.otp_required) {
        sessionStorage.setItem('spmb_applicant_token', d.session_token);
        setOtpStage(true);
        if (d.dev_otp) toast('info', `Mode pengembangan — kode OTP: ${d.dev_otp}`);
        else toast('info', `Kode OTP dikirim ke WhatsApp ${d.otp_target}`);
      } else {
        sessionStorage.setItem('spmb_applicant_token', d.session_token);
        load();
        toast('success', 'Berhasil masuk. Sesi berlaku 30 menit.');
      }
    } catch (e: any) {
      toast('error', e.message || 'Gagal masuk.');
    } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      const d = await api.post('/api/public/check/verify-otp', { registration_number: regNumber, code: otp });
      sessionStorage.setItem('spmb_applicant_token', d.session_token);
      setOtpStage(false);
      load();
      toast('success', 'OTP terverifikasi.');
    } catch (e: any) { toast('error', e.message || 'OTP salah.'); }
    finally { setBusy(false); }
  };

  const logout = () => {
    sessionStorage.removeItem('spmb_applicant_token');
    setData(null); setForm(null); setEdit(false);
    setRegNumber(''); setPin('');
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/api/public/application', { data: form }, applicantHeaders());
      toast('success', 'Perubahan tersimpan dan tercatat dalam riwayat.');
      setEdit(false);
      load();
    } catch (e: any) { toast('error', e.message || 'Gagal menyimpan.'); }
    finally { setBusy(false); }
  };

  const replaceDoc = async (docType: string, file: File | null, status: 'Ada' | 'Belum Ada') => {
    if (status === 'Ada' && !file) return;
    const fd = new FormData();
    fd.append('doc_type', docType);
    fd.append('status', status);
    if (file) fd.append('file', file);
    try {
      await api.upload('/api/documents/public/upload', fd, applicantHeaders());
      toast('success', 'Dokumen diperbarui.');
      load();
    } catch (e: any) { toast('error', e.message || 'Gagal mengunggah dokumen.'); }
  };

  const cetakPdf = async () => {
    try {
      const res = await api.get('/api/public/application/pdf', applicantHeaders());
      const blob = res instanceof Response ? await res.blob() : res;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) { toast('error', 'Gagal membuat PDF.'); }
  };

  if (otpStage) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="card p-6">
          <h1 className="text-xl font-extrabold text-primary-800 dark:text-primary-300 mb-1">Verifikasi OTP</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Masukkan 6 digit kode yang dikirim ke nomor HP pendaftar.</p>
          <input className="input mb-3 tracking-[0.4em] text-center text-lg" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))} placeholder="______" />
          <button className="btn-primary w-full" disabled={busy || otp.length !== 6} onClick={verifyOtp}>Verifikasi</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="card p-6">
          <h1 className="text-xl font-extrabold text-primary-800 dark:text-primary-300 mb-1">Cek / Ubah Pendaftaran</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Masukkan nomor pendaftaran dan PIN rahasia yang diberikan saat pendaftaran.</p>
          <label className="label">Nomor Pendaftaran</label>
          <input className="input mb-3 uppercase" value={regNumber} onChange={e => setRegNumber(e.target.value.toUpperCase())} placeholder="A0001" />
          <label className="label">PIN Rahasia</label>
          <input className="input mb-4" type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN 8 karakter" />
          <button className="btn-primary w-full" disabled={busy || !regNumber || !pin} onClick={start}>Masuk</button>
          <p className="text-xs text-slate-400 mt-3">Batas percobaan login berlaku. Sesi otomatis berakhir setelah 30 menit.</p>
        </div>
      </div>
    );
  }

  const a = data.applicant;
  const canEdit = data.editable;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-primary-800 dark:text-primary-300">Data Pendaftaran</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">No. <span className="font-bold">{a.registration_number}</span> · {new Date(a.registration_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · Gelombang {data.wave || '-'}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={cetakPdf}>Cetak Formulir PDF</button>
          <button className="btn-ghost" onClick={logout}>Keluar</button>
        </div>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-2 items-center">
        <span className="text-sm font-semibold mr-2">Status:</span>
        <StatusBadge status={a.status_berkas} />
        <StatusBadge status={a.status_kesehatan} />
        <StatusBadge status={a.status_wawancara} />
        <StatusBadge status={a.status_verifikasi} />
        <StatusBadge status={a.status_akhir} />
        {a.is_locked ? <span className="badge bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">Terkunci</span> : null}
      </div>

      {data.missing_documents.length > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-amber-400">
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-1">Dokumen yang masih harus dilengkapi:</p>
          <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300">
            {data.missing_documents.map((m: string) => <li key={m}>{DOC_LABELS[m] || m}</li>)}
          </ul>
        </div>
      )}

      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Data Siswa</h2>
          {canEdit && !edit && <button className="btn-ghost" onClick={() => setEdit(true)}>Ubah Data</button>}
          {edit && (
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy} onClick={save}>Simpan</button>
              <button className="btn-ghost" onClick={() => { setEdit(false); setForm(toForm(data)); }}>Batal</button>
            </div>
          )}
        </div>
        {!canEdit && <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">Pendaftaran sudah diverifikasi/dikunci — perubahan memerlukan persetujuan panitia.</p>}
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Field label="Nama Lengkap" value={edit ? form.siswa.nama_lengkap : a.nama_lengkap} edit={edit} onChange={(v: string) => setForm({ ...form, siswa: { ...form.siswa, nama_lengkap: v } })} />
          <Field label="NISN" value={edit ? form.siswa.nisn : a.nisn} edit={edit} onChange={(v: string) => setForm({ ...form, siswa: { ...form.siswa, nisn: v } })} />
          <Field label="Tempat Lahir" value={edit ? form.siswa.tempat_lahir : a.tempat_lahir} edit={edit} onChange={(v: string) => setForm({ ...form, siswa: { ...form.siswa, tempat_lahir: v } })} />
          <Field label="Tanggal Lahir" type="date" value={edit ? form.siswa.tanggal_lahir : String(a.tanggal_lahir || '').slice(0, 10)} edit={edit} onChange={(v: string) => setForm({ ...form, siswa: { ...form.siswa, tanggal_lahir: v } })} />
          <Field label="Jenis Kelamin" value={a.jenis_kelamin} />
          <Field label="Agama" value={a.agama} />
          <Field label="Umur pada 10 Juli 2027" value={a.umur_10juli || '-'} />
          <Field label="No. HP Siswa" value={edit ? form.siswa.hp_siswa : a.hp_siswa} edit={edit} onChange={(v: string) => setForm({ ...form, siswa: { ...form.siswa, hp_siswa: v } })} />
          <Field label="Alamat" value={edit ? form.siswa.alamat : a.alamat} edit={edit} onChange={(v: string) => setForm({ ...form, siswa: { ...form.siswa, alamat: v } })} />
          <Field label="Desa/Kelurahan" value={edit ? form.siswa.desa : a.desa} edit={edit} onChange={(v: string) => setForm({ ...form, siswa: { ...form.siswa, desa: v } })} />
          <Field label="Kecamatan" value={edit ? form.siswa.kecamatan : a.kecamatan} edit={edit} onChange={(v: string) => setForm({ ...form, siswa: { ...form.siswa, kecamatan: v } })} />
          <Field label="Kabupaten/Kota" value={edit ? form.siswa.kabupaten : a.kabupaten} edit={edit} onChange={(v: string) => setForm({ ...form, siswa: { ...form.siswa, kabupaten: v } })} />
          <Field label="Asal Sekolah" value={`${a.jenjang_asal || ''} ${a.asal_sekolah || ''}`.trim()} />
          <Field label="Program Keahlian" value={a.program_keahlian} />
          <Field label="Ukuran Seragam" value={a.uniform_size} />
        </div>
      </div>

      <div className="card p-5 mb-4">
        <h2 className="font-bold mb-3">Dokumen Persyaratan</h2>
        <div className="space-y-2">
          {(data.documents || []).map((d: any) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-medium flex-1 min-w-[200px]">{DOC_LABELS[d.doc_type] || d.doc_type}</span>
              <span className={`badge ${d.status === 'Ada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{d.status}</span>
              {d.file_name && <span className="text-xs text-slate-400 truncate max-w-[180px]">{d.file_name}</span>}
              {d.url && <a className="text-primary-600 dark:text-primary-400 text-xs font-semibold" href={d.url} target="_blank" rel="noreferrer">Lihat</a>}
              {canEdit && (
                <label className="text-xs btn-ghost cursor-pointer">
                  Ganti
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={e => replaceDoc(d.doc_type, e.target.files?.[0] || null, 'Ada')} />
                </label>
              )}
            </div>
          ))}
          {canEdit && data.missing_documents.map((m: string) => (
            <div key={'add-' + m} className="flex flex-wrap items-center gap-2 text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-medium flex-1 min-w-[200px]">{DOC_LABELS[m]}</span>
              <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Belum Ada</span>
              <label className="text-xs btn-primary cursor-pointer">
                Unggah
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={e => replaceDoc(m, e.target.files?.[0] || null, 'Ada')} />
              </label>
              <button className="text-xs btn-ghost" onClick={() => replaceDoc(m, null, 'Belum Ada')}>Tandai Belum Ada</button>
            </div>
          ))}
        </div>
      </div>

      {data.history?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-bold mb-3">Riwayat</h2>
          <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {data.history.map((h: any) => (
              <div key={h.id}>{new Date(h.created_at).toLocaleString('id-ID')} — {h.status_to} {h.note ? `(${h.note})` : ''}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function toForm(d: any) {
  return {
    siswa: {
      nama_lengkap: d.applicant.nama_lengkap || '', nisn: d.applicant.nisn || '',
      tempat_lahir: d.applicant.tempat_lahir || '', tanggal_lahir: String(d.applicant.tanggal_lahir || '').slice(0, 10),
      hp_siswa: d.applicant.hp_siswa || '', alamat: d.applicant.alamat || '',
      desa: d.applicant.desa || '', kecamatan: d.applicant.kecamatan || '', kabupaten: d.applicant.kabupaten || '',
    },
    ortu: {
      ayah_nama: d.parents?.ayah_nama || '', ayah_pekerjaan: d.parents?.ayah_pekerjaan || '', ayah_hp: d.parents?.ayah_hp || '',
      ibu_nama: d.parents?.ibu_nama || '', ibu_pekerjaan: d.parents?.ibu_pekerjaan || '', ibu_hp: d.parents?.ibu_hp || '',
      alamat: d.parents?.alamat || '', rt: d.parents?.rt || '', rw: d.parents?.rw || '',
      desa: d.parents?.desa || '', kecamatan: d.parents?.kecamatan || '', kabupaten: d.parents?.kabupaten || '',
    },
    wali: {
      nama: d.guardian?.nama || '', alamat: d.guardian?.alamat || '', rt: d.guardian?.rt || '', rw: d.guardian?.rw || '',
      pekerjaan: d.guardian?.pekerjaan || '', hp: d.guardian?.hp || '', sama_dengan_ortu: Boolean(d.guardian?.sama_dengan_ortu),
    },
  };
}

function Field({ label, value, edit, onChange, type = 'text' }: { label: string; value: any; edit?: boolean; onChange?: (v: string) => void; type?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      {edit && onChange ? (
        <input className="input mt-0.5" type={type} value={value || ''} onChange={e => onChange(e.target.value)} />
      ) : (
        <div className="font-medium">{value || '-'}</div>
      )}
    </div>
  );
}
