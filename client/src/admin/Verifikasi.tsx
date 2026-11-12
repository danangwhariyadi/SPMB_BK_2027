import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/charts';
import { Modal, Spinner, TableWrap, Td, Th, EmptyRow } from './shared';

const DOC_LABELS: Record<string, string> = {
  kk: 'Fotokopi KK', akta: 'Akta Kelahiran', transkrip: 'Transkrip Nilai', ijazah: 'Ijazah',
  nisn: 'Kartu NISN', foto: 'Foto 3x4 (6 lembar)', tka: 'Surat Nilai TKA',
};

export default function Verifikasi() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canCreate = can('verifikasi', 'can_create');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/assessment/verify')
      .then(d => setRows(d.rows || []))
      .catch(e => toast('error', e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const openDetail = async (id: number) => {
    try { setDetail(await api.get(`/api/assessment/verify/${id}`)); setNote(''); }
    catch (e: any) { toast('error', e.message); }
  };

  const verifyDoc = async (docType: string, status: 'valid' | 'tidak_valid') => {
    setBusy(true);
    try {
      await api.post(`/api/assessment/verify/${detail.applicant.id}/document`, { doc_type: docType, status, note });
      toast('success', `Dokumen ${DOC_LABELS[docType] || docType} ditandai ${status}.`);
      const d = await api.get(`/api/assessment/verify/${detail.applicant.id}`);
      setDetail(d);
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const complete = async (action: string) => {
    if (!confirm(`Ubah status verifikasi menjadi "${action}"?`)) return;
    setBusy(true);
    try {
      const d = await api.post(`/api/assessment/verify/${detail.applicant.id}/complete`, { action, note });
      toast('success', `Status: ${d.status}`);
      setDetail(null);
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const filtered = rows.filter(r =>
    (!statusFilter || r.status_verifikasi === statusFilter) &&
    (!q || r.nama_lengkap.toLowerCase().includes(q.toLowerCase()) || r.registration_number.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300 mb-4">Verifikasi Dokumen</h1>

      <div className="card p-3 mb-4 flex flex-wrap gap-2">
        <input className="input !w-auto flex-1 min-w-[180px]" placeholder="Cari nama / no. pendaftaran…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input !w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Semua Status Verifikasi</option>
          {['Belum diproses', 'Sedang diproses', 'Perlu perbaikan', 'Lengkap', 'Disetujui', 'Ditolak'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <TableWrap>
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr><Th>No. Pendaftaran</Th><Th>Nama</Th><Th>Program</Th><Th>Gelombang</Th><Th>Dokumen Ada</Th><Th>Status Berkas</Th><Th>Verifikasi</Th><Th>Aksi</Th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 ? <EmptyRow span={8} /> : filtered.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <Td className="font-bold">{r.registration_number}</Td>
                <Td className="font-medium">{r.nama_lengkap}</Td>
                <Td className="whitespace-nowrap">{r.program_keahlian}</Td>
                <Td>{r.wave_nama || '-'}</Td>
                <Td>{r.docs_ada}/7</Td>
                <Td><StatusBadge status={r.status_berkas} /></Td>
                <Td><StatusBadge status={r.status_verifikasi} /></Td>
                <Td><button className="text-xs btn-ghost px-2 py-1" onClick={() => openDetail(r.id)}>Periksa Berkas</button></Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Pemeriksaan Berkas" wide>
        {detail && (
          <div className="text-sm space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div><span className="text-xs text-slate-400">No. Pendaftaran</span><div className="font-bold">{detail.applicant.registration_number}</div></div>
              <div><span className="text-xs text-slate-400">Nama</span><div className="font-medium">{detail.applicant.nama_lengkap}</div></div>
              <div><span className="text-xs text-slate-400">Status</span><StatusBadge status={detail.applicant.status_verifikasi} /></div>
            </div>

            <div>
              <label className="label">Catatan Kekurangan Dokumen (untuk aksi berikutnya)</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Contoh: FC KK tidak terbaca, mohon unggah ulang" />
            </div>

            <div className="space-y-2">
              {Object.entries(DOC_LABELS).map(([k, label]) => {
                const d = (detail.documents || []).find((x: any) => x.doc_type === k);
                const lastVerif = (detail.verifications || []).find((v: any) => v.doc_type === k);
                return (
                  <div key={k} className="flex flex-wrap items-center gap-2 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2">
                    <span className="font-medium flex-1 min-w-[140px]">{label}</span>
                    <span className={`badge ${d?.status === 'Ada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{d?.status || 'Belum Ada'}</span>
                    {lastVerif && (
                      <span className={`badge ${lastVerif.status === 'valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {lastVerif.status === 'valid' ? '✓ Valid' : '✗ Tidak Valid'}
                      </span>
                    )}
                    {d?.url && <a className="text-primary-600 dark:text-primary-400 text-xs font-semibold" href={d.url} target="_blank" rel="noreferrer">Preview</a>}
                    {canCreate && d && (
                      <div className="flex gap-1">
                        <button className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold" disabled={busy} onClick={() => verifyDoc(k, 'valid')}>Valid</button>
                        <button className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold" disabled={busy} onClick={() => verifyDoc(k, 'tidak_valid')}>Tidak Valid</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {canCreate && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button className="btn-ghost" disabled={busy} onClick={() => complete('lengkap')}>Dokumen Lengkap</button>
                <button className="btn-ghost" disabled={busy} onClick={() => complete('perbaikan')}>Minta Perbaikan Dokumen</button>
                <button className="btn-primary" disabled={busy} onClick={() => complete('setujui')}>Setujui</button>
                <button className="btn-accent" disabled={busy} onClick={() => complete('tolak')}>Tolak</button>
              </div>
            )}
            <p className="text-xs text-slate-400">Status akhir tidak berubah otomatis — hanya petugas berwenang yang menetapkannya.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
