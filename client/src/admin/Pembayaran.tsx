import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { Modal, Spinner, TableWrap, Td, Th, EmptyRow, Pagination, downloadFile, rupiah, fmtDateTime } from './shared';

const PROGRAMS = ['TEKNIK MESIN', 'TEKNIK OTOMOTIF', 'PPLG'];
type Tab = 'input' | 'rekap' | 'laporan';

export default function Pembayaran() {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const isBendahara = user?.role_code === 'bendahara';
  const canSeeAudit = ['admin', 'ketua'].includes(user?.role_code || '');
  const canCreate = can('pembayaran', 'can_create');
  const canEdit = can('pembayaran', 'can_edit');

  const [tab, setTab] = useState<Tab>(canCreate ? 'input' : 'rekap');
  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300 mb-4">Pembayaran</h1>
      <div className="flex gap-1 overflow-x-auto mb-4 border-b border-slate-200 dark:border-slate-800">
        {canCreate && <TabBtn active={tab === 'input'} onClick={() => setTab('input')}>Input Pembayaran</TabBtn>}
        <TabBtn active={tab === 'rekap'} onClick={() => setTab('rekap')}>Rekapitulasi Pembayaran</TabBtn>
        {isBendahara && <TabBtn active={tab === 'laporan'} onClick={() => setTab('laporan')}>Laporan Pembiayaan</TabBtn>}
      </div>
      {tab === 'input' && canCreate && <InputPembayaran onSaved={() => setTab('rekap')} />}
      {tab === 'rekap' && <RekapPembayaran canEdit={canEdit} canSeeAudit={canSeeAudit} />}
      {tab === 'laporan' && isBendahara && <LaporanKeuangan />}
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

function InputPembayaran({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [applicant, setApplicant] = useState<any>(null);
  const [feeTypes, setFeeTypes] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [customItems, setCustomItems] = useState<{ nama: string; nominal: string }[]>([]);
  const [metode, setMetode] = useState('Tunai');
  const [keterangan, setKeterangan] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/payments/fee-types').then(d => setFeeTypes(d.rows || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/applicants?q=${encodeURIComponent(q)}&limit=8`).then(d => setResults(d.rows || [])).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const toggleFee = (id: number) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const total =
    feeTypes.filter(f => selected[f.id]).reduce((s, f) => s + Number(f.nominal || 0), 0) +
    customItems.reduce((s, i) => s + (Number(i.nominal) || 0), 0);

  const submit = async () => {
    const items = [
      ...feeTypes.filter(f => selected[f.id]).map(f => ({ fee_type_id: f.id, nama: f.nama, nominal: Number(f.nominal) })),
      ...customItems.filter(i => i.nama).map(i => ({ fee_type_id: null, nama: i.nama, nominal: Number(i.nominal) || 0 })),
    ];
    if (!applicant) { toast('error', 'Pilih data calon siswa terlebih dahulu.'); return; }
    if (!items.length) { toast('error', 'Minimal satu jenis biaya dipilih.'); return; }
    setBusy(true);
    try {
      const d = await api.post('/api/payments', { applicant_id: applicant.id, items, metode, keterangan });
      toast('success', `Pembayaran tersimpan. No. bukti: ${d.receipt_no}`);
      setApplicant(null); setQ(''); setSelected({}); setCustomItems([]); setKeterangan('');
      onSaved();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5">
        <h3 className="font-bold mb-3 text-sm">1. Pilih Data Calon Siswa</h3>
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
                    <b>{r.registration_number}</b> — {r.nama_lengkap} · {r.program_keahlian}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-3 text-sm">2. Pilih Jenis Biaya (bisa lebih dari satu / custom)</h3>
        <div className="space-y-2">
          {feeTypes.map(f => (
            <label key={f.id} className="flex items-center gap-3 text-sm cursor-pointer">
              <input type="checkbox" checked={Boolean(selected[f.id])} onChange={() => toggleFee(f.id)} />
              <span className="flex-1">{f.nama}</span>
              <span className="font-semibold">{rupiah(f.nominal)}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {customItems.map((it, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" placeholder="Nama biaya custom" value={it.nama}
                onChange={e => setCustomItems(a => a.map((x, j) => j === i ? { ...x, nama: e.target.value } : x))} />
              <input className="input !w-44" type="number" placeholder="Nominal" value={it.nominal}
                onChange={e => setCustomItems(a => a.map((x, j) => j === i ? { ...x, nominal: e.target.value } : x))} />
              <button className="btn-ghost px-2 text-accent-500" onClick={() => setCustomItems(a => a.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn-ghost text-xs" onClick={() => setCustomItems(a => [...a, { nama: '', nominal: '' }])}>+ Tambah Biaya Custom</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-3 text-sm">3. Metode & Ringkasan</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Metode Pembayaran</label>
            <select className="input" value={metode} onChange={e => setMetode(e.target.value)}>
              {['Tunai', 'Transfer Bank', 'QRIS', 'Lainnya'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Keterangan</label>
            <input className="input" value={keterangan} onChange={e => setKeterangan(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3">
          <span className="font-semibold text-sm">Total Pembayaran</span>
          <span className="text-xl font-extrabold text-primary-700 dark:text-primary-300">{rupiah(total)}</span>
        </div>
        <button className="btn-primary mt-4" disabled={busy || !applicant} onClick={submit}>{busy ? 'Menyimpan…' : 'Simpan Pembayaran'}</button>
      </div>
    </div>
  );
}

function RekapPembayaran({ canEdit, canSeeAudit }: { canEdit: boolean; canSeeAudit: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [wave, setWave] = useState('');
  const [program, setProgram] = useState('');
  const [date, setDate] = useState('');
  const [waves, setWaves] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [editRow, setEditRow] = useState<any>(null);
  const [editItems, setEditItems] = useState<{ nama: string; nominal: string }[]>([]);
  const [editMetode, setEditMetode] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/api/admin/waves').then(d => setWaves(d.rows || [])).catch(() => undefined); }, []);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ q, wave, program, date }).toString();
    api.get(`/api/payments?${qs}`)
      .then(d => { setRows(d.rows || []); setTotal(d.total); })
      .catch(e => toast('error', e.message))
      .finally(() => setLoading(false));
  }, [q, wave, program, date]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openDetail = async (id: number) => {
    try { setDetail(await api.get(`/api/payments/${id}`)); }
    catch (e: any) { toast('error', e.message); }
  };

  const openEdit = async (id: number) => {
    try {
      const d = await api.get(`/api/payments/${id}`);
      setEditItems((d.items || []).map((i: any) => ({ nama: i.nama, nominal: String(i.nominal) })));
      setEditMetode(d.payment.metode); setEditStatus(d.payment.status);
      setEditRow(d.payment);
    } catch (e: any) { toast('error', e.message); }
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await api.put(`/api/payments/${editRow.id}`, {
        items: editItems.map(i => ({ nama: i.nama, nominal: Number(i.nominal) || 0 })),
        metode: editMetode, status: editStatus,
      });
      toast('success', 'Pembayaran diperbarui.');
      setEditRow(null);
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const cetakBukti = async (id: number) => {
    try {
      await downloadFile(`/api/payments/${id}/receipt.pdf`, `bukti-bayar-${id}.pdf`);
      toast('success', 'Bukti pembayaran diunduh.');
    } catch { toast('error', 'Gagal membuat bukti.'); }
  };

  return (
    <div>
      <div className="card p-3 mb-4 flex flex-wrap gap-2">
        <input className="input !w-auto flex-1 min-w-[180px]" placeholder="Cari nama / no. pendaftaran…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input !w-auto" value={wave} onChange={e => setWave(e.target.value)}>
          <option value="">Semua Gelombang</option>
          {waves.map(w => <option key={w.id} value={w.id}>{w.nama}</option>)}
        </select>
        <select className="input !w-auto" value={program} onChange={e => setProgram(e.target.value)}>
          <option value="">Semua Program</option>
          {PROGRAMS.map(p => <option key={p}>{p}</option>)}
        </select>
        <input type="date" className="input !w-auto" value={date} onChange={e => setDate(e.target.value)} />
        <div className="ml-auto self-center text-sm font-semibold text-primary-700 dark:text-primary-300">Total: {rupiah(total)}</div>
      </div>

      {loading ? <Spinner /> : (
        <TableWrap>
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr><Th>No. Bukti</Th><Th>Tanggal</Th><Th>No. Pendaftaran</Th><Th>Nama</Th><Th>Program</Th><Th>Gelombang</Th><Th>Metode</Th><Th>Total</Th><Th>Status</Th><Th>Penerima</Th><Th>Aksi</Th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? <EmptyRow span={11} text="Belum ada pembayaran." /> : rows.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <Td className="font-bold">{`BP-${String(p.id).padStart(5, '0')}`}</Td>
                <Td className="whitespace-nowrap">{fmtDateTime(p.tanggal)}</Td>
                <Td>{p.registration_number}</Td>
                <Td className="font-medium">{p.nama_lengkap}</Td>
                <Td className="whitespace-nowrap">{p.program_keahlian}</Td>
                <Td>{p.wave_nama || '-'}</Td>
                <Td>{p.metode}</Td>
                <Td className="font-semibold">{rupiah(p.total)}</Td>
                <Td>{p.status}</Td>
                <Td>{p.receiver_name || '-'}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <button className="text-xs btn-ghost px-2 py-1" onClick={() => openDetail(p.id)}>Detail</button>
                    {canEdit && <button className="text-xs btn-ghost px-2 py-1" onClick={() => openEdit(p.id)}>Edit</button>}
                    {canEdit && <button className="text-xs btn-ghost px-2 py-1" onClick={() => cetakBukti(p.id)}>Cetak Bukti</button>}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Detail Pembayaran" wide>
        {detail && (
          <div className="text-sm space-y-3">
            <div className="grid sm:grid-cols-2 gap-2">
              <div><span className="text-xs text-slate-400">No. Bukti</span><div className="font-bold">{`BP-${String(detail.payment.id).padStart(5, '0')}`}</div></div>
              <div><span className="text-xs text-slate-400">Tanggal</span><div>{fmtDateTime(detail.payment.tanggal)}</div></div>
              <div><span className="text-xs text-slate-400">Pendaftar</span><div>{detail.payment.registration_number} — {detail.payment.nama_lengkap}</div></div>
              <div><span className="text-xs text-slate-400">Metode / Status</span><div>{detail.payment.metode} / {detail.payment.status}</div></div>
              <div><span className="text-xs text-slate-400">Penerima</span><div>{detail.payment.receiver_name || '-'}</div></div>
              <div><span className="text-xs text-slate-400">Total</span><div className="font-bold">{rupiah(detail.payment.total)}</div></div>
            </div>
            <TableWrap>
              <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><Th>Jenis Biaya</Th><Th>Nominal</Th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(detail.items || []).map((i: any, x: number) => <tr key={x}><Td>{i.nama}</Td><Td>{rupiah(i.nominal)}</Td></tr>)}
              </tbody>
            </TableWrap>
            {canSeeAudit && detail.audit_logs && (
              <div>
                <h4 className="font-bold text-xs uppercase text-slate-400 mb-1">Audit Log Pembayaran</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                  {detail.audit_logs.length === 0 ? <p className="text-slate-400">Tidak ada perubahan.</p> : detail.audit_logs.map((l: any) => (
                    <div key={l.id} className="border-b border-slate-100 dark:border-slate-800 pb-1">
                      <b>{l.username}</b> — {l.action} · {fmtDateTime(l.created_at)}<br />
                      <span className="text-slate-500">{l.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={Boolean(editRow)} onClose={() => setEditRow(null)} title={`Edit Pembayaran — ${editRow ? `BP-${String(editRow.id).padStart(5, '0')}` : ''}`} wide>
        <div className="space-y-2">
          {editItems.map((it, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" value={it.nama} onChange={e => setEditItems(a => a.map((x, j) => j === i ? { ...x, nama: e.target.value } : x))} />
              <input className="input !w-44" type="number" value={it.nominal} onChange={e => setEditItems(a => a.map((x, j) => j === i ? { ...x, nominal: e.target.value } : x))} />
              <button className="btn-ghost px-2 text-accent-500" onClick={() => setEditItems(a => a.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn-ghost text-xs" onClick={() => setEditItems(a => [...a, { nama: '', nominal: '' }])}>+ Tambah Item</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="label">Metode</label>
            <select className="input" value={editMetode} onChange={e => setEditMetode(e.target.value)}>
              {['Tunai', 'Transfer Bank', 'QRIS', 'Lainnya'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
              {['Lunas', 'Belum Lunas', 'Dibatalkan'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary" disabled={busy} onClick={saveEdit}>Simpan</button>
          <button className="btn-ghost" onClick={() => setEditRow(null)}>Batal</button>
        </div>
      </Modal>
    </div>
  );
}

function LaporanKeuangan() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<'semua' | 'hari' | 'gelombang' | 'program'>('semua');
  const [wave, setWave] = useState('');
  const [program, setProgram] = useState('');
  const [date, setDate] = useState('');
  const [waves, setWaves] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [perType, setPerType] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/api/admin/waves').then(d => setWaves(d.rows || [])).catch(() => undefined); }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({
      ...(filter === 'gelombang' && wave ? { wave } : {}),
      ...(filter === 'program' && program ? { program } : {}),
      ...(filter === 'hari' && date ? { date } : {}),
    }).toString();
    api.get(`/api/payments/report/finance?${qs}`)
      .then(d => { setRows(d.rows || []); setPerType(d.per_type || []); setTotal(d.total); })
      .catch(e => toast('error', e.message))
      .finally(() => setLoading(false));
  }, [filter, wave, program, date]);

  const exportExcel = async () => {
    try {
      const qs = new URLSearchParams({
        ...(filter === 'gelombang' && wave ? { wave } : {}),
        ...(filter === 'program' && program ? { program } : {}),
        ...(filter === 'hari' && date ? { date } : {}),
      }).toString();
      await downloadFile(`/api/payments/report/finance/excel?${qs}`, 'laporan-keuangan.xlsx');
      toast('success', 'Excel diunduh.');
    } catch { toast('error', 'Gagal mengekspor.'); }
  };

  return (
    <div>
      <div className="card p-3 mb-4 flex flex-wrap gap-2 print:hidden">
        <select className="input !w-auto" value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="semua">Semua</option>
          <option value="hari">Per Hari</option>
          <option value="gelombang">Per Gelombang</option>
          <option value="program">Per Program Keahlian</option>
        </select>
        {filter === 'hari' && <input type="date" className="input !w-auto" value={date} onChange={e => setDate(e.target.value)} />}
        {filter === 'gelombang' && (
          <select className="input !w-auto" value={wave} onChange={e => setWave(e.target.value)}>
            <option value="">— Pilih Gelombang —</option>
            {waves.map(w => <option key={w.id} value={w.id}>{w.nama}</option>)}
          </select>
        )}
        {filter === 'program' && (
          <select className="input !w-auto" value={program} onChange={e => setProgram(e.target.value)}>
            <option value="">— Pilih Program —</option>
            {PROGRAMS.map(p => <option key={p}>{p}</option>)}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost" onClick={() => window.print()}>🖨 Cetak Laporan</button>
          <button className="btn-ghost" onClick={exportExcel}>⬇ Export Excel</button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="card p-4 mb-4 text-sm">
            <b>Total pemasukan sesuai filter:</b> <span className="text-primary-700 dark:text-primary-300 font-extrabold text-lg">{rupiah(total)}</span>
          </div>
          <TableWrap>
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr><Th>No. Bukti</Th><Th>Tanggal</Th><Th>No. Pendaftaran</Th><Th>Nama</Th><Th>Program</Th><Th>Gelombang</Th><Th>Metode</Th><Th>Total</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? <EmptyRow span={8} /> : rows.map(p => (
                <tr key={p.id}>
                  <Td className="font-bold">{`BP-${String(p.id).padStart(5, '0')}`}</Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(p.tanggal)}</Td>
                  <Td>{p.registration_number}</Td><Td>{p.nama_lengkap}</Td>
                  <Td className="whitespace-nowrap">{p.program_keahlian}</Td><Td>{p.wave_nama || '-'}</Td>
                  <Td>{p.metode}</Td><Td>{rupiah(p.total)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {perType.length > 0 && (
            <div className="card p-5 mt-4">
              <h3 className="font-bold mb-3 text-sm">Rekap per Jenis Biaya</h3>
              <TableWrap>
                <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><Th>Jenis Biaya</Th><Th>Jumlah Transaksi</Th><Th>Total</Th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {perType.map((t, i) => <tr key={i}><Td>{t.nama}</Td><Td>{t.jumlah}</Td><Td>{rupiah(t.total)}</Td></tr>)}
                </tbody>
              </TableWrap>
            </div>
          )}
        </>
      )}
    </div>
  );
}
