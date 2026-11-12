import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/charts';
import { Modal, Spinner, TableWrap, Td, Th, EmptyRow, fmtDateTime } from './shared';

export default function Kesehatan() {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const isPetugas = user?.role_code === 'kesehatan';
  const canCreate = can('kesehatan', 'can_create');
  const canEdit = can('kesehatan', 'can_edit');
  const [tab, setTab] = useState<'input' | 'rekap'>('rekap');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [applicant, setApplicant] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState<any>({
    berat_badan: '', tinggi_badan: '', lingkar_kepala: '', buta_warna: 'Tidak',
    penglihatan: 'Normal', penyakit_bawaan: '', catatan: '', status: 'Sedang diproses',
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/assessment/health')
      .then(d => setRows(d.rows || []))
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
      await api.post('/api/assessment/health', { applicant_id: applicant.id, ...form });
      toast('success', 'Data kesehatan tersimpan.');
      setApplicant(null); setQ('');
      load();
      setTab('rekap');
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const openDetail = async (applicantId: number) => {
    try {
      const d = await api.get(`/api/assessment/health/${applicantId}/detail`);
      setDetail(d.examination);
    } catch (e: any) { toast('error', e.message); }
  };

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300 mb-4">Pemeriksaan Kesehatan</h1>
      <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-slate-800">
        {canCreate && (
          <button onClick={() => setTab('input')} className={`px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === 'input' ? 'border-primary-600 text-primary-700 dark:text-primary-400' : 'border-transparent text-slate-500'}`}>Input Kesehatan</button>
        )}
        <button onClick={() => setTab('rekap')} className={`px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === 'rekap' ? 'border-primary-600 text-primary-700 dark:text-primary-400' : 'border-transparent text-slate-500'}`}>Rekapitulasi Data Kesehatan</button>
      </div>

      {tab === 'input' && canCreate && (
        <div className="max-w-3xl space-y-4">
          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Pilih Pendaftar</h3>
            {applicant ? (
              <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-900/30 rounded-xl px-3 py-2 text-sm">
                <span><b>{applicant.registration_number}</b> — {applicant.nama_lengkap} · BB {applicant.berat_badan || '-'} kg / TB {applicant.tinggi_badan || '-'} cm</span>
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
                        <b>{r.registration_number}</b> — {r.nama_lengkap} · {r.program_keahlian}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Hasil Pemeriksaan</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Berat Badan (kg)" type="number" value={form.berat_badan} onChange={v => setForm({ ...form, berat_badan: v })} />
              <Field label="Tinggi Badan (cm)" type="number" value={form.tinggi_badan} onChange={v => setForm({ ...form, tinggi_badan: v })} />
              <Field label="Lingkar Kepala (cm)" type="number" value={form.lingkar_kepala} onChange={v => setForm({ ...form, lingkar_kepala: v })} />
              <div>
                <label className="label">Kesehatan Mata — Buta Warna</label>
                <select className="input" value={form.buta_warna} onChange={e => setForm({ ...form, buta_warna: e.target.value })}>
                  <option>Tidak</option><option>Ya</option>
                </select>
              </div>
              <div>
                <label className="label">Penglihatan</label>
                <select className="input" value={form.penglihatan} onChange={e => setForm({ ...form, penglihatan: e.target.value })}>
                  {['Normal', 'Minus', 'Plus', 'Silindris'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <Field label="Penyakit Bawaan" value={form.penyakit_bawaan} onChange={v => setForm({ ...form, penyakit_bawaan: v })} />
              <Field label="Catatan Kesehatan" value={form.catatan} onChange={v => setForm({ ...form, catatan: v })} />
              <div>
                <label className="label">Status Pemeriksaan</label>
                <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {['Belum diproses', 'Sedang diproses', 'Perlu perbaikan', 'Lengkap', 'Disetujui', 'Ditolak'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <button className="btn-primary mt-4" disabled={busy || !applicant} onClick={save}>Simpan</button>
          </div>
        </div>
      )}

      {tab === 'rekap' && (
        <>
          {loading ? <Spinner /> : (
            <TableWrap>
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr><Th>No. Pendaftaran</Th><Th>Nama</Th><Th>Program</Th><Th>Gelombang</Th><Th>BB (kg)</Th><Th>TB (cm)</Th><Th>Lingkar Kepala</Th><Th>Buta Warna</Th><Th>Penglihatan</Th><Th>Penyakit Bawaan</Th><Th>Status</Th><Th>Pemeriksa</Th><Th>Aksi</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? <EmptyRow span={13} text="Belum ada data kesehatan." /> : rows.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <Td className="font-bold">{h.registration_number}</Td>
                    <Td className="font-medium">{h.nama_lengkap}</Td>
                    <Td className="whitespace-nowrap">{h.program_keahlian}</Td>
                    <Td>{h.wave_nama || '-'}</Td>
                    <Td>{h.berat_badan ?? '-'}</Td><Td>{h.tinggi_badan ?? '-'}</Td><Td>{h.lingkar_kepala ?? '-'}</Td>
                    <Td>{h.buta_warna || '-'}</Td><Td>{h.penglihatan || '-'}</Td><Td>{h.penyakit_bawaan || '-'}</Td>
                    <Td><StatusBadge status={h.status} /></Td>
                    <Td>{h.examiner_name || '-'}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <button className="text-xs btn-ghost px-2 py-1" onClick={() => openDetail(h.applicant_id)}>Detail</button>
                        {isPetugas && canEdit && (
                          <button className="text-xs btn-ghost px-2 py-1" onClick={() => {
                            setApplicant({ id: h.applicant_id, registration_number: h.registration_number, nama_lengkap: h.nama_lengkap, berat_badan: h.berat_badan, tinggi_badan: h.tinggi_badan });
                            setForm({
                              berat_badan: h.berat_badan ?? '', tinggi_badan: h.tinggi_badan ?? '', lingkar_kepala: h.lingkar_kepala ?? '',
                              buta_warna: h.buta_warna || 'Tidak', penglihatan: h.penglihatan || 'Normal',
                              penyakit_bawaan: h.penyakit_bawaan || '', catatan: h.catatan || '', status: h.status,
                            });
                            setTab('input');
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

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Detail Data Kesehatan">
        {detail && (
          <div className="text-sm grid grid-cols-2 gap-3">
            <div><span className="text-xs text-slate-400">Berat Badan</span><div className="font-medium">{detail.berat_badan ?? '-'} kg</div></div>
            <div><span className="text-xs text-slate-400">Tinggi Badan</span><div className="font-medium">{detail.tinggi_badan ?? '-'} cm</div></div>
            <div><span className="text-xs text-slate-400">Lingkar Kepala</span><div className="font-medium">{detail.lingkar_kepala ?? '-'} cm</div></div>
            <div><span className="text-xs text-slate-400">Buta Warna</span><div className="font-medium">{detail.buta_warna || '-'}</div></div>
            <div><span className="text-xs text-slate-400">Penglihatan</span><div className="font-medium">{detail.penglihatan || '-'}</div></div>
            <div><span className="text-xs text-slate-400">Penyakit Bawaan</span><div className="font-medium">{detail.penyakit_bawaan || '-'}</div></div>
            <div className="col-span-2"><span className="text-xs text-slate-400">Catatan</span><div>{detail.catatan || '-'}</div></div>
            <div><span className="text-xs text-slate-400">Status</span><StatusBadge status={detail.status} /></div>
            <div><span className="text-xs text-slate-400">Pemeriksa</span><div>{detail.examiner_name || '-'}</div></div>
            <div className="col-span-2"><span className="text-xs text-slate-400">Waktu Pemeriksaan</span><div>{fmtDateTime(detail.examined_at)}</div></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
