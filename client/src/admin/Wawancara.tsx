import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/charts';
import { Spinner, TableWrap, Td, Th, EmptyRow, fmtDateTime, downloadFile } from './shared';

export default function Wawancara() {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const isPetugas = user?.role_code === 'wawancara';
  const canCreate = can('wawancara', 'can_create');
  const canEdit = can('wawancara', 'can_edit');
  const canDelete = can('wawancara', 'can_delete');
  const [tab, setTab] = useState<'form' | 'rekap' | 'laporan' | 'pengaturan'>(canCreate ? 'form' : 'rekap');
  const [questions, setQuestions] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [applicant, setApplicant] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [catatan, setCatatan] = useState('');
  const [rekomendasi, setRekomendasi] = useState('');
  const [status, setStatus] = useState('Sedang diproses');
  const [scheduledAt, setScheduledAt] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [newQ, setNewQ] = useState({ label: '', type: 'text', options: '', sort_order: '0' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/assessment/interview/questions'),
      api.get('/api/assessment/interview'),
    ])
      .then(([qd, id]) => { setQuestions(qd.rows || []); setRows(id.rows || []); })
      .catch(e => toast('error', e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/applicants?q=${encodeURIComponent(q)}&limit=8`).then(d => setResults(d.rows || [])).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const save = async () => {
    if (!applicant) { toast('error', 'Pilih pendaftar terlebih dahulu.'); return; }
    setBusy(true);
    try {
      await api.post('/api/assessment/interview', {
        applicant_id: applicant.id,
        answers: questions.map(qq => ({ question_id: qq.id, answer: answers[qq.id] ?? '' })),
        catatan, rekomendasi, status, scheduled_at: scheduledAt || null,
      });
      toast('success', 'Hasil wawancara tersimpan.');
      setApplicant(null); setAnswers({}); setCatatan(''); setRekomendasi(''); setStatus('Sedang diproses'); setScheduledAt('');
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const notifySchedule = async () => {
    if (!applicant) return;
    try {
      const d = await api.post('/api/assessment/interview/notify-schedule', { applicant_id: applicant.id, scheduled_at: scheduledAt });
      toast(d.sent ? 'success' : 'info', d.sent ? 'Jadwal wawancara terkirim via WhatsApp.' : 'Integrasi WhatsApp belum dikonfigurasi — jadwal tidak terkirim.');
    } catch (e: any) { toast('error', e.message); }
  };

  const addQuestion = async () => {
    if (!newQ.label) { toast('error', 'Pertanyaan wajib diisi.'); return; }
    try {
      await api.post('/api/assessment/interview/questions', { ...newQ, sort_order: Number(newQ.sort_order) });
      toast('success', 'Pertanyaan ditambahkan.');
      setNewQ({ label: '', type: 'text', options: '', sort_order: '0' });
      load();
    } catch (e: any) { toast('error', e.message); }
  };

  const delQuestion = async (id: number) => {
    if (!confirm('Hapus pertanyaan ini dari form wawancara?')) return;
    try { await api.del(`/api/assessment/interview/questions/${id}`); toast('success', 'Pertanyaan dihapus.'); load(); }
    catch (e: any) { toast('error', e.message); }
  };

  const exportLaporan = async () => {
    try {
      await downloadFile('/api/admin/reports/wawancara/excel', 'laporan-wawancara.xlsx');
      toast('success', 'Excel diunduh.');
    } catch { toast('error', 'Gagal mengekspor.'); }
  };

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300 mb-4">Wawancara</h1>
      <div className="flex gap-1 overflow-x-auto mb-4 border-b border-slate-200 dark:border-slate-800">
        {canCreate && <TabBtn active={tab === 'form'} onClick={() => setTab('form')}>Wawancara</TabBtn>}
        <TabBtn active={tab === 'rekap'} onClick={() => setTab('rekap')}>Rekapitulasi Hasil</TabBtn>
        <TabBtn active={tab === 'laporan'} onClick={() => setTab('laporan')}>Laporan Hasil</TabBtn>
        {canCreate && <TabBtn active={tab === 'pengaturan'} onClick={() => setTab('pengaturan')}>Pengaturan Form</TabBtn>}
      </div>

      {tab === 'form' && canCreate && (
        <div className="max-w-3xl space-y-4">
          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Pilih Pendaftar</h3>
            {applicant ? (
              <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-900/30 rounded-xl px-3 py-2 text-sm">
                <span><b>{applicant.registration_number}</b> — {applicant.nama_lengkap} · {applicant.program_keahlian}</span>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setApplicant(null)}>Ganti</button>
              </div>
            ) : (
              <>
                <input className="input" placeholder="Cari nomor pendaftaran / nama…" value={q} onChange={e => setQ(e.target.value)} />
                {results.length > 0 && (
                  <div className="mt-2 border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                    {results.map(r => (
                      <button key={r.id} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => { setApplicant(r); setQ(''); setResults([]); }}>
                        <b>{r.registration_number}</b> — {r.nama_lengkap}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-sm">Form Wawancara (sesuai Pengaturan Form)</h3>
            {questions.length === 0 && <p className="text-sm text-slate-400">Belum ada pertanyaan. Tambahkan pada menu Pengaturan Form.</p>}
            {questions.map(qq => (
              <div key={qq.id}>
                <label className="label">{qq.label}</label>
                {qq.type === 'textarea' ? (
                  <textarea className="input" rows={2} value={answers[qq.id] || ''} onChange={e => setAnswers(a => ({ ...a, [qq.id]: e.target.value }))} />
                ) : qq.type === 'select' && qq.options ? (
                  <select className="input" value={answers[qq.id] || ''} onChange={e => setAnswers(a => ({ ...a, [qq.id]: e.target.value }))}>
                    <option value="">— Pilih —</option>
                    {String(qq.options).split(',').map((o: string) => <option key={o} value={o.trim()}>{o.trim()}</option>)}
                  </select>
                ) : (
                  <input className="input" type={qq.type === 'number' ? 'number' : 'text'} value={answers[qq.id] || ''} onChange={e => setAnswers(a => ({ ...a, [qq.id]: e.target.value }))} />
                )}
              </div>
            ))}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Catatan</label>
                <textarea className="input" rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} />
              </div>
              <div>
                <label className="label">Rekomendasi</label>
                <textarea className="input" rows={2} value={rekomendasi} onChange={e => setRekomendasi(e.target.value)} />
              </div>
              <div>
                <label className="label">Status Wawancara</label>
                <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                  {['Belum diproses', 'Sedang diproses', 'Perlu perbaikan', 'Lengkap', 'Disetujui', 'Ditolak'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Jadwal Wawancara</label>
                <input className="input" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy || !applicant} onClick={save}>Simpan Hasil Wawancara</button>
              {applicant && <button className="btn-ghost" onClick={notifySchedule}>Kirim Jadwal via WhatsApp</button>}
            </div>
          </div>
        </div>
      )}

      {tab === 'rekap' && (
        <>
          {loading ? <Spinner /> : (
            <TableWrap>
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr><Th>No. Pendaftaran</Th><Th>Nama</Th><Th>Program</Th><Th>Jadwal</Th><Th>Rekomendasi</Th><Th>Status</Th><Th>Pewawancara</Th><Th>Aksi</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? <EmptyRow span={8} text="Belum ada hasil wawancara." /> : rows.map(iv => (
                  <tr key={iv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <Td className="font-bold">{iv.registration_number}</Td>
                    <Td className="font-medium">{iv.nama_lengkap}</Td>
                    <Td className="whitespace-nowrap">{iv.program_keahlian}</Td>
                    <Td className="whitespace-nowrap">{iv.scheduled_at ? fmtDateTime(iv.scheduled_at) : '-'}</Td>
                    <Td className="max-w-[200px] truncate">{iv.rekomendasi || '-'}</Td>
                    <Td><StatusBadge status={iv.status} /></Td>
                    <Td>{iv.interviewer_name || '-'}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <button className="text-xs btn-ghost px-2 py-1" onClick={() => setDetail(iv)}>Detail</button>
                        {isPetugas && canEdit && (
                          <button className="text-xs btn-ghost px-2 py-1" onClick={() => {
                            setApplicant({ id: iv.applicant_id, registration_number: iv.registration_number, nama_lengkap: iv.nama_lengkap });
                            const a: Record<number, string> = {};
                            for (const ans of iv.answers || []) a[ans.question_id] = ans.answer;
                            setAnswers(a); setCatatan(iv.catatan || ''); setRekomendasi(iv.rekomendasi || '');
                            setStatus(iv.status); setScheduledAt(iv.scheduled_at ? String(iv.scheduled_at).slice(0, 16) : '');
                            setTab('form');
                          }}>Edit</button>
                        )}
                        {isPetugas && <button className="text-xs btn-ghost px-2 py-1" onClick={() => window.print()}>Cetak</button>}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </>
      )}

      {tab === 'laporan' && (
        <div>
          <div className="flex gap-2 mb-3 print:hidden">
            <button className="btn-ghost" onClick={() => window.print()}>🖨 Cetak</button>
            <button className="btn-ghost" onClick={exportLaporan}>⬇ Export Excel</button>
          </div>
          <TableWrap>
            <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><Th>No. Pendaftaran</Th><Th>Nama</Th><Th>Rekomendasi</Th><Th>Status</Th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? <EmptyRow span={4} /> : rows.map(iv => (
                <tr key={iv.id}>
                  <Td className="font-bold">{iv.registration_number}</Td>
                  <Td>{iv.nama_lengkap}</Td>
                  <Td>{iv.rekomendasi || '-'}</Td>
                  <Td>{iv.status}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}

      {tab === 'pengaturan' && canCreate && (
        <div className="max-w-2xl space-y-4">
          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Tambah Pertanyaan Wawancara</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Pertanyaan</label>
                <input className="input" value={newQ.label} onChange={e => setNewQ({ ...newQ, label: e.target.value })} />
              </div>
              <div>
                <label className="label">Tipe</label>
                <select className="input" value={newQ.type} onChange={e => setNewQ({ ...newQ, type: e.target.value })}>
                  <option value="text">Teks Pendek</option>
                  <option value="textarea">Teks Panjang</option>
                  <option value="select">Pilihan</option>
                  <option value="number">Angka</option>
                </select>
              </div>
              {newQ.type === 'select' && (
                <div>
                  <label className="label">Opsi (pisahkan dengan koma)</label>
                  <input className="input" value={newQ.options} onChange={e => setNewQ({ ...newQ, options: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label">Urutan</label>
                <input className="input" type="number" value={newQ.sort_order} onChange={e => setNewQ({ ...newQ, sort_order: e.target.value })} />
              </div>
            </div>
            <button className="btn-primary mt-3" onClick={addQuestion}>Tambah Pertanyaan</button>
          </div>
          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Daftar Pertanyaan Aktif</h3>
            <div className="space-y-2">
              {questions.length === 0 ? <p className="text-sm text-slate-400">Belum ada pertanyaan.</p> : questions.map((qq, i) => (
                <div key={qq.id} className="flex items-center gap-3 text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-400 w-6">{i + 1}.</span>
                  <span className="flex-1">{qq.label} <span className="text-xs text-slate-400">({qq.type})</span></span>
                  {canDelete && <button className="text-xs btn-ghost px-2 py-1 text-accent-500" onClick={() => delQuestion(qq.id)}>Hapus</button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <DetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function DetailModal({ detail, onClose }: { detail: any; onClose: () => void }) {
  return (
    <div className={`fixed inset-0 z-50 ${detail ? '' : 'hidden'} flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10`} onClick={onClose}>
      <div className="card w-full max-w-xl p-5" onClick={e => e.stopPropagation()}>
        {detail && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">Hasil Wawancara — {detail.registration_number}</h3>
              <button className="btn-ghost px-2 py-1" onClick={onClose}>✕</button>
            </div>
            <div className="text-sm space-y-2">
              <div><span className="text-xs text-slate-400">Nama</span><div className="font-medium">{detail.nama_lengkap}</div></div>
              <div><span className="text-xs text-slate-400">Status</span><StatusBadge status={detail.status} /></div>
              <div><span className="text-xs text-slate-400">Jadwal</span><div>{detail.scheduled_at ? fmtDateTime(detail.scheduled_at) : '-'}</div></div>
              <div><span className="text-xs text-slate-400">Jawaban</span>
                <div className="space-y-1 mt-1">
                  {(detail.answers || []).map((a: any, i: number) => (
                    <div key={i} className="border-b border-slate-100 dark:border-slate-800 pb-1">
                      <span className="text-xs text-slate-400">{a.question_label}</span>
                      <div>{a.answer || '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div><span className="text-xs text-slate-400">Catatan</span><div>{detail.catatan || '-'}</div></div>
              <div><span className="text-xs text-slate-400">Rekomendasi</span><div>{detail.rekomendasi || '-'}</div></div>
              <div><span className="text-xs text-slate-400">Pewawancara</span><div>{detail.interviewer_name || '-'}</div></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition ${active ? 'border-primary-600 text-primary-700 dark:text-primary-400' : 'border-transparent text-slate-500 hover:text-primary-600'}`}>
      {children}
    </button>
  );
}
