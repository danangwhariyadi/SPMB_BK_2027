import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/charts';
import { Modal, Spinner, TableWrap, Td, Th, EmptyRow, fmtDateTime, rupiah } from './shared';

const DOC_LABELS: Record<string, string> = {
  kk: 'Fotokopi KK', akta: 'Akta Kelahiran', transkrip: 'Transkrip Nilai', ijazah: 'Ijazah',
  nisn: 'Kartu NISN', foto: 'Foto 3x4 (6 lembar)', tka: 'Surat Nilai TKA',
};
const TABS = ['Data Siswa', 'Orang Tua/Wali', 'Prestasi dan TKA', 'Program Keahlian', 'Dokumen', 'Kesehatan', 'Wawancara', 'Verifikasi', 'Riwayat Perubahan'];

const EDIT_FIELDS: { key: string; label: string; type?: string }[] = [
  { key: 'nama_lengkap', label: 'Nama Lengkap' },
  { key: 'nisn', label: 'NISN' },
  { key: 'tempat_lahir', label: 'Tempat Lahir' },
  { key: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
  { key: 'alamat', label: 'Alamat' },
  { key: 'desa', label: 'Desa/Kelurahan' },
  { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'kabupaten', label: 'Kabupaten/Kota' },
  { key: 'jarak_km', label: 'Jarak (km)', type: 'number' },
  { key: 'hp_siswa', label: 'No. HP Siswa' },
  { key: 'berat_badan', label: 'Berat Badan (kg)', type: 'number' },
  { key: 'tinggi_badan', label: 'Tinggi Badan (cm)', type: 'number' },
  { key: 'asal_sekolah', label: 'Asal Sekolah' },
  { key: 'no_seri_ijazah', label: 'No. Seri Ijazah' },
  { key: 'uniform_size', label: 'Ukuran Seragam' },
  { key: 'program_keahlian', label: 'Program Keahlian' },
];

export default function DetailPendaftar() {
  const { id } = useParams();
  const { can, user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [docs, setDocs] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [healthForm, setHealthForm] = useState<any>(null);
  const [interviewForm, setInterviewForm] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [verifyNote, setVerifyNote] = useState('');

  const load = useCallback(() => {
    api.get(`/api/applicants/${id}`).then(setData).catch(e => toast('error', e.message));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (tab !== 4) return;
    api.get(`/api/documents/applicant/${id}`).then(setDocs).catch(() => setDocs(null));
  }, [tab, id]);

  useEffect(() => {
    if (tab !== 6) return;
    api.get('/api/assessment/interview/questions').then(d => setQuestions(d.rows || [])).catch(() => undefined);
  }, [tab]);

  if (!data) return <Spinner />;
  const a = data.applicant;
  const canEdit = can('pendaftaran', 'can_edit');
  const canDelete = can('pendaftaran', 'can_delete');
  const canHealth = can('kesehatan', 'can_create');
  const canInterview = can('wawancara', 'can_create');
  const canVerify = can('verifikasi', 'can_create');

  const saveEdit = async () => {
    setBusy(true);
    try {
      await api.put(`/api/applicants/${a.id}`, editForm);
      toast('success', 'Perubahan tersimpan.');
      setEditOpen(false);
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const openEdit = () => {
    const f: any = {};
    for (const { key, type } of EDIT_FIELDS) f[key] = type === 'date' ? String(a[key] || '').slice(0, 10) : (a[key] ?? '');
    setEditForm(f);
    setEditOpen(true);
  };

  const delDoc = async (docId: number) => {
    if (!confirm('Hapus dokumen ini?')) return;
    try { await api.del(`/api/documents/${docId}`); toast('success', 'Dokumen dihapus.'); if (docs) { const d = await api.get(`/api/documents/applicant/${id}`); setDocs(d); } load(); }
    catch (e: any) { toast('error', e.message); }
  };

  const uploadDoc = async (docType: string, file: File | null, status: 'Ada' | 'Belum Ada', source = 'upload') => {
    if (status === 'Ada' && !file) return;
    const fd = new FormData();
    fd.append('doc_type', docType);
    fd.append('status', status);
    fd.append('applicant_id', String(a.id));
    fd.append('source', source);
    if (file) fd.append('file', file);
    try {
      await api.upload('/api/documents/upload', fd);
      toast('success', 'Dokumen diperbarui.');
      const d = await api.get(`/api/documents/applicant/${id}`);
      setDocs(d);
      load();
    } catch (e: any) { toast('error', e.message); }
  };

  const saveHealth = async () => {
    setBusy(true);
    try {
      await api.post('/api/assessment/health', { applicant_id: a.id, ...healthForm });
      toast('success', 'Data kesehatan tersimpan.');
      setHealthForm(null);
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const saveInterview = async () => {
    setBusy(true);
    try {
      await api.post('/api/assessment/interview', {
        applicant_id: a.id,
        answers: questions.map(q => ({ question_id: q.id, answer: interviewForm?.[`q${q.id}`] ?? '' })),
        catatan: interviewForm?.catatan || '', rekomendasi: interviewForm?.rekomendasi || '',
        status: interviewForm?.status || 'Sedang diproses', scheduled_at: interviewForm?.scheduled_at || null,
      });
      toast('success', 'Hasil wawancara tersimpan.');
      setInterviewForm(null);
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const verifyDoc = async (docType: string, status: 'valid' | 'tidak_valid') => {
    try {
      await api.post(`/api/assessment/verify/${a.id}/document`, { doc_type: docType, status, note: verifyNote });
      toast('success', `Dokumen ${docType} ditandai ${status}.`);
      load();
    } catch (e: any) { toast('error', e.message); }
  };

  const completeVerify = async (action: string) => {
    if (!confirm(`Yakin mengubah status verifikasi menjadi "${action}"?`)) return;
    try {
      await api.post(`/api/assessment/verify/${a.id}/complete`, { action, note: verifyNote });
      toast('success', 'Status verifikasi diperbarui.');
      load();
    } catch (e: any) { toast('error', e.message); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/panel/pendaftaran/data" className="btn-ghost px-2 py-1 text-xs">← Kembali</Link>
            <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300">{a.registration_number}</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 ml-1">
            {a.nama_lengkap} · {a.program_keahlian} · Gelombang {data.wave || '-'} · {fmtDateTime(a.registration_date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary" href={`/api/applicants/${a.id}/formulir.pdf`} target="_blank" rel="noreferrer">🖨 Cetak Formulir</a>
          {canEdit && <button className="btn-ghost" onClick={openEdit}>Edit Data</button>}
          {canDelete && <DeleteButton id={a.id} reg={a.registration_number} onDone={() => window.history.back()} />}
        </div>
      </div>

      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-400 uppercase mr-1">Status:</span>
        <span className="text-xs text-slate-500">Berkas</span><StatusBadge status={a.status_berkas} />
        <span className="text-xs text-slate-500">Kesehatan</span><StatusBadge status={a.status_kesehatan} />
        <span className="text-xs text-slate-500">Wawancara</span><StatusBadge status={a.status_wawancara} />
        <span className="text-xs text-slate-500">Verifikasi</span><StatusBadge status={a.status_verifikasi} />
        <span className="text-xs text-slate-500">Akhir</span><StatusBadge status={a.status_akhir} />
        {a.is_locked ? <span className="badge bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">Terkunci</span> : null}
      </div>

      <div className="flex gap-1 overflow-x-auto mb-4 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition ${tab === i ? 'border-primary-600 text-primary-700 dark:text-primary-400' : 'border-transparent text-slate-500 hover:text-primary-600'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div className="card p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <Info label="Nama Lengkap" value={a.nama_lengkap} />
          <Info label="NISN" value={a.nisn} />
          <Info label="Tempat/Tanggal Lahir" value={`${a.tempat_lahir || '-'}, ${fmtDateTime(a.tanggal_lahir)}`} />
          <Info label="Jenis Kelamin" value={a.jenis_kelamin} />
          <Info label="Agama" value={a.agama} />
          <Info label="Umur pada 10 Juli 2027" value={a.umur_10juli} />
          <Info label="Alamat" value={a.alamat} />
          <Info label="Desa/Kelurahan" value={a.desa} />
          <Info label="Kecamatan" value={a.kecamatan} />
          <Info label="Kabupaten/Kota" value={a.kabupaten} />
          <Info label="Jarak ke Sekolah" value={a.jarak_km ? `${a.jarak_km} km` : '-'} />
          <Info label="No. HP Siswa" value={a.hp_siswa} />
          <Info label="Berat/Tinggi Badan" value={`${a.berat_badan || '-'} kg / ${a.tinggi_badan || '-'} cm`} />
          <Info label="Jenjang Asal" value={a.jenjang_asal} />
          <Info label="Asal Sekolah" value={a.asal_sekolah} />
          <Info label="Kecamatan Asal" value={a.asal_kecamatan} />
          <Info label="Kabupaten Asal" value={a.asal_kabupaten} />
          <Info label="No. Seri Ijazah" value={a.no_seri_ijazah} />
          <Info label="Ukuran Seragam" value={a.uniform_size} />
          <Info label="Jalur" value={a.jalur} />
        </div>
      )}

      {tab === 1 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5 text-sm space-y-2">
            <h3 className="font-bold mb-2">Ayah Kandung</h3>
            <Info label="Nama" value={data.parents?.ayah_nama} />
            <Info label="Pekerjaan" value={data.parents?.ayah_pekerjaan} />
            <Info label="No. HP" value={data.parents?.ayah_hp} />
            <h3 className="font-bold mb-2 pt-3">Ibu Kandung</h3>
            <Info label="Nama" value={data.parents?.ibu_nama} />
            <Info label="Pekerjaan" value={data.parents?.ibu_pekerjaan} />
            <Info label="No. HP" value={data.parents?.ibu_hp} />
            <h3 className="font-bold mb-2 pt-3">Alamat Orang Tua</h3>
            <Info label="Alamat" value={data.parents?.alamat} />
            <Info label="RT/RW" value={`${data.parents?.rt || '-'} / ${data.parents?.rw || '-'}`} />
            <Info label="Desa/Kecamatan/Kabupaten" value={`${data.parents?.desa || '-'}, ${data.parents?.kecamatan || '-'}, ${data.parents?.kabupaten || '-'}`} />
          </div>
          <div className="card p-5 text-sm space-y-2">
            <h3 className="font-bold mb-2">Wali</h3>
            <Info label="Nama" value={data.guardian?.nama || '(tidak ada)'} />
            <Info label="Pekerjaan" value={data.guardian?.pekerjaan} />
            <Info label="No. HP" value={data.guardian?.hp} />
            <Info label="Alamat" value={data.guardian?.alamat} />
            <Info label="RT/RW" value={`${data.guardian?.rt || '-'} / ${data.guardian?.rw || '-'}`} />
            <Info label="Sama dengan orang tua" value={data.guardian?.sama_dengan_ortu ? 'Ya' : 'Tidak'} />
          </div>
        </div>
      )}

      {tab === 2 && (
        <div className="space-y-4">
          <div className="card p-5 text-sm">
            <h3 className="font-bold mb-2">Prestasi/Piagam Kejuaraan</h3>
            {data.achievements?.memiliki ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <Info label="Nama Prestasi" value={data.achievements.nama} />
                <Info label="Tingkat" value={data.achievements.tingkat} />
                <Info label="Tahun" value={data.achievements.tahun} />
                <Info label="Keterangan" value={data.achievements.keterangan} />
              </div>
            ) : <p className="text-slate-400">Tidak memiliki prestasi.</p>}
          </div>
          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Nilai TKA</h3>
            <TableWrap>
              <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><Th>Jenis</Th><Th>Mata Pelajaran</Th><Th>Nilai</Th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data.tka || []).length === 0 ? <EmptyRow span={3} /> : data.tka.map((t: any) => (
                  <tr key={t.id}><Td className="capitalize">{t.jenis}</Td><Td>{t.mapel}</Td><Td className="font-bold">{t.nilai ?? '-'}</Td></tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </div>
      )}

      {tab === 3 && (
        <div className="card p-5 text-sm space-y-2">
          <Info label="Program Keahlian Dipilih" value={a.program_keahlian} />
          <Info label="Riwayat Pendaftaran" value={a.riwayat_pendaftaran} />
          {a.riwayat_pendaftaran === 'Pernah' && (
            <>
              <Info label="Sekolah Sebelumnya" value={a.riwayat_sekolah} />
              <Info label="Program Keahlian Sebelumnya" value={a.riwayat_jurusan} />
              <Info label="Tahun" value={a.riwayat_tahun} />
              <Info label="Status" value={a.riwayat_status} />
            </>
          )}
          <div className="pt-2">
            <h3 className="font-bold mb-2">Pembayaran Terkait</h3>
            {(data.payments || []).length === 0 ? <p className="text-slate-400">Belum ada pembayaran.</p> : (
              <TableWrap>
                <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><Th>No. Bukti</Th><Th>Tanggal</Th><Th>Total</Th><Th>Status</Th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.payments.map((p: any) => (
                    <tr key={p.id}><Td>{`BP-${String(p.id).padStart(5, '0')}`}</Td><Td>{fmtDateTime(p.tanggal)}</Td><Td>{rupiah(p.total)}</Td><Td>{p.status}</Td></tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>
        </div>
      )}

      {tab === 4 && (
        <div className="card p-5">
          {!docs ? <p className="text-sm text-slate-400">Menu dokumen tidak tersedia untuk peran Anda.</p> : (
            <div className="space-y-2">
              {Object.entries(docs.types as Record<string, string>).map(([k, label]) => {
                const d = (docs.documents || []).find((x: any) => x.doc_type === k);
                return (
                  <div key={k} className="flex flex-wrap items-center gap-2 text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="font-medium flex-1 min-w-[180px]">{label}</span>
                    <span className={`badge ${d?.status === 'Ada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{d?.status || 'Belum Ada'}</span>
                    {d?.source && <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 capitalize">{d.source}</span>}
                    {d?.file_name && <span className="text-xs text-slate-400 truncate max-w-[160px]">{d.file_name}</span>}
                    {d?.url && <a className="text-primary-600 dark:text-primary-400 text-xs font-semibold" href={d.url} target="_blank" rel="noreferrer">Preview</a>}
                    {can('dokumen', 'can_create') && (
                      <label className="text-xs btn-ghost cursor-pointer">
                        {d ? 'Ganti' : 'Unggah'}
                        <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={e => uploadDoc(k, e.target.files?.[0] || null, 'Ada')} />
                      </label>
                    )}
                    {can('dokumen', 'can_delete') && d && <button className="text-xs btn-ghost px-2 py-1 text-accent-500" onClick={() => delDoc(d.id)}>Hapus</button>}
                  </div>
                );
              })}
              {docs.missing?.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 pt-2">Kekurangan: {docs.missing.map((m: string) => DOC_LABELS[m] || m).join(', ')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 5 && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Hasil Pemeriksaan Kesehatan</h3>
            {(data.health || []).length === 0 ? <p className="text-sm text-slate-400">Belum ada pemeriksaan.</p> : (
              <TableWrap>
                <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><Th>Tanggal</Th><Th>BB (kg)</Th><Th>TB (cm)</Th><Th>Lingkar Kepala</Th><Th>Buta Warna</Th><Th>Penglihatan</Th><Th>Penyakit Bawaan</Th><Th>Status</Th><Th>Pemeriksa</Th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.health.map((h: any) => (
                    <tr key={h.id}>
                      <Td>{fmtDateTime(h.examined_at)}</Td><Td>{h.berat_badan ?? '-'}</Td><Td>{h.tinggi_badan ?? '-'}</Td>
                      <Td>{h.lingkar_kepala ?? '-'}</Td><Td>{h.buta_warna || '-'}</Td><Td>{h.penglihatan || '-'}</Td>
                      <Td>{h.penyakit_bawaan || '-'}</Td><Td><StatusBadge status={h.status} /></Td><Td>{h.examiner_name || '-'}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>
          {canHealth && (
            <div className="card p-5">
              <h3 className="font-bold mb-3 text-sm">{(data.health || []).length ? 'Perbarui Data Kesehatan' : 'Input Data Kesehatan'}</h3>
              {healthForm === null ? (
                <button className="btn-primary" onClick={() => setHealthForm({ penglihatan: 'Normal', buta_warna: 'Tidak', status: 'Sedang diproses' })}>
                  {(data.health || []).length ? 'Edit Data Kesehatan' : 'Buka Form Kesehatan'}
                </button>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3">
                  <Num label="Berat Badan (kg)" value={healthForm.berat_badan} onChange={v => setHealthForm({ ...healthForm, berat_badan: v })} />
                  <Num label="Tinggi Badan (cm)" value={healthForm.tinggi_badan} onChange={v => setHealthForm({ ...healthForm, tinggi_badan: v })} />
                  <Num label="Lingkar Kepala (cm)" value={healthForm.lingkar_kepala} onChange={v => setHealthForm({ ...healthForm, lingkar_kepala: v })} />
                  <Sel label="Buta Warna" value={healthForm.buta_warna} onChange={v => setHealthForm({ ...healthForm, buta_warna: v })} options={['Tidak', 'Ya']} />
                  <Sel label="Penglihatan" value={healthForm.penglihatan} onChange={v => setHealthForm({ ...healthForm, penglihatan: v })} options={['Normal', 'Minus', 'Plus', 'Silindris']} />
                  <Text label="Penyakit Bawaan" value={healthForm.penyakit_bawaan} onChange={v => setHealthForm({ ...healthForm, penyakit_bawaan: v })} />
                  <Text label="Catatan" value={healthForm.catatan} onChange={v => setHealthForm({ ...healthForm, catatan: v })} />
                  <Sel label="Status Pemeriksaan" value={healthForm.status} onChange={v => setHealthForm({ ...healthForm, status: v })} options={['Belum diproses', 'Sedang diproses', 'Perlu perbaikan', 'Lengkap', 'Disetujui', 'Ditolak']} />
                  <div className="flex items-end gap-2">
                    <button className="btn-primary" disabled={busy} onClick={saveHealth}>Simpan</button>
                    <button className="btn-ghost" onClick={() => setHealthForm(null)}>Batal</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 6 && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Hasil Wawancara</h3>
            {(data.interviews || []).length === 0 ? <p className="text-sm text-slate-400">Belum ada wawancara.</p> : (
              data.interviews.map((iv: any) => (
                <div key={iv.id} className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-3 text-sm">
                  <div className="flex flex-wrap gap-2 items-center mb-1">
                    <StatusBadge status={iv.status} />
                    <span className="text-xs text-slate-400">{fmtDateTime(iv.created_at)} · Pewawancara: {iv.interviewer_name || '-'}</span>
                  </div>
                  <Info label="Rekomendasi" value={iv.rekomendasi} />
                  <Info label="Catatan" value={iv.catatan} />
                </div>
              ))
            )}
          </div>
          {canInterview && (
            <div className="card p-5">
              <h3 className="font-bold mb-3 text-sm">{(data.interviews || []).length ? 'Perbarui Hasil Wawancara' : 'Input Hasil Wawancara'}</h3>
              {interviewForm === null ? (
                <button className="btn-primary" onClick={() => setInterviewForm({ status: 'Sedang diproses' })}>Buka Form Wawancara</button>
              ) : (
                <div className="space-y-3">
                  {questions.map(q => (
                    <div key={q.id}>
                      <label className="label">{q.label}</label>
                      <input className="input" value={interviewForm[`q${q.id}`] || ''} onChange={e => setInterviewForm({ ...interviewForm, [`q${q.id}`]: e.target.value })} />
                    </div>
                  ))}
                  <Text label="Catatan" value={interviewForm.catatan || ''} onChange={v => setInterviewForm({ ...interviewForm, catatan: v })} />
                  <Text label="Rekomendasi" value={interviewForm.rekomendasi || ''} onChange={v => setInterviewForm({ ...interviewForm, rekomendasi: v })} />
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Sel label="Status" value={interviewForm.status} onChange={v => setInterviewForm({ ...interviewForm, status: v })} options={['Belum diproses', 'Sedang diproses', 'Perlu perbaikan', 'Lengkap', 'Disetujui', 'Ditolak']} />
                    <Text label="Jadwal Wawancara" type="datetime-local" value={interviewForm.scheduled_at || ''} onChange={v => setInterviewForm({ ...interviewForm, scheduled_at: v })} />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={busy} onClick={saveInterview}>Simpan</button>
                    <button className="btn-ghost" onClick={() => setInterviewForm(null)}>Batal</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 7 && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Riwayat Verifikasi Dokumen</h3>
            {(data.verifications || []).length === 0 ? <p className="text-sm text-slate-400">Belum ada verifikasi.</p> : (
              <TableWrap>
                <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><Th>Tanggal</Th><Th>Jenis Dokumen</Th><Th>Status</Th><Th>Catatan</Th><Th>Verifikator</Th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.verifications.map((v: any) => (
                    <tr key={v.id}>
                      <Td>{fmtDateTime(v.verified_at)}</Td><Td>{DOC_LABELS[v.doc_type] || v.doc_type || '-'}</Td>
                      <Td><span className={`badge ${v.status === 'valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{v.status}</span></Td>
                      <Td>{v.note || '-'}</Td><Td>{v.verifier_name || '-'}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>
          {canVerify && (
            <div className="card p-5">
              <h3 className="font-bold mb-3 text-sm">Tindakan Verifikasi</h3>
              <Text label="Catatan (opsional)" value={verifyNote} onChange={setVerifyNote} />
              <div className="flex flex-wrap gap-2 mt-3">
                {Object.keys(DOC_LABELS).map(t => (
                  <div key={t} className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5">
                    <span className="text-xs font-medium">{DOC_LABELS[t]}</span>
                    <button className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold" onClick={() => verifyDoc(t, 'valid')}>Valid</button>
                    <button className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold" onClick={() => verifyDoc(t, 'tidak_valid')}>Tidak Valid</button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button className="btn-ghost" onClick={() => completeVerify('lengkap')}>Dokumen Lengkap</button>
                <button className="btn-ghost" onClick={() => completeVerify('perbaikan')}>Minta Perbaikan</button>
                <button className="btn-primary" onClick={() => completeVerify('setujui')}>Setujui</button>
                <button className="btn-accent" onClick={() => completeVerify('tolak')}>Tolak</button>
              </div>
              <p className="text-xs text-slate-400 mt-2">Status akhir (Disetujui/Ditolak) mengunci data pendaftaran dan tidak berlaku otomatis.</p>
            </div>
          )}
        </div>
      )}

      {tab === 8 && (
        <div className="card p-5">
          <TableWrap>
            <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><Th>Waktu</Th><Th>Dari</Th><Th>Ke</Th><Th>Oleh</Th><Th>Catatan</Th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data.history || []).length === 0 ? <EmptyRow span={5} /> : data.history.map((h: any) => (
                <tr key={h.id}>
                  <Td className="whitespace-nowrap">{fmtDateTime(h.created_at)}</Td>
                  <Td>{h.status_from || '-'}</Td><Td className="font-semibold">{h.status_to}</Td>
                  <Td>{h.changed_by || '-'}</Td><Td className="max-w-[300px]">{h.note || '-'}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit Data — ${a.registration_number}`} wide>
        <div className="grid sm:grid-cols-2 gap-3">
          {EDIT_FIELDS.map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input className="input" type={f.type || 'text'} value={editForm[f.key] ?? ''} onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary" disabled={busy} onClick={saveEdit}>Simpan</button>
          <button className="btn-ghost" onClick={() => setEditOpen(false)}>Batal</button>
        </div>
      </Modal>
    </div>
  );
}

function DeleteButton({ id, reg, onDone }: { id: number; reg: string; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    try {
      await api.del(`/api/applicants/${id}`, { confirm: confirmText });
      toast('success', 'Pendaftar dihapus.');
      onDone();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button className="btn-ghost text-accent-500" onClick={() => setOpen(true)}>Hapus</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Hapus Pendaftar">
        <p className="text-sm mb-3">Hapus pendaftar <b>{reg}</b> beserta seluruh datanya? Tindakan ini permanen.</p>
        <label className="label">Ketik nomor pendaftaran untuk konfirmasi</label>
        <input className="input mb-3 uppercase" value={confirmText} onChange={e => setConfirmText(e.target.value.toUpperCase())} placeholder={reg} />
        <div className="flex gap-2">
          <button className="btn-accent" disabled={busy || confirmText !== reg} onClick={del}>Hapus Permanen</button>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
        </div>
      </Modal>
    </>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-medium">{value || '-'}</div>
    </div>
  );
}

function Text({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  return <Text label={label} type="number" value={value} onChange={onChange} />;
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}
