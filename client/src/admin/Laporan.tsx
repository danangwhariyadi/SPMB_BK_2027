import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { Spinner, TableWrap, Td, Th, EmptyRow, downloadFile, fmtDateTime } from './shared';

const REPORTS: { type: string; label: string }[] = [
  { type: 'keseluruhan', label: 'Rekap Pendaftar Keseluruhan' },
  { type: 'gelombang', label: 'Rekap Pendaftar per Gelombang' },
  { type: 'program', label: 'Rekap per Program Keahlian' },
  { type: 'asal-sekolah', label: 'Rekap Asal Sekolah' },
  { type: 'kecamatan', label: 'Rekap per Kecamatan' },
  { type: 'dokumen', label: 'Rekap Dokumen Belum Lengkap' },
  { type: 'kesehatan', label: 'Rekap Hasil Kesehatan' },
  { type: 'wawancara', label: 'Rekap Hasil Wawancara' },
  { type: 'verifikasi', label: 'Rekap Hasil Verifikasi' },
  { type: 'akhir', label: 'Rekap Hasil Akhir Penerimaan' },
  { type: 'seragam', label: 'Rekap Ukuran Seragam' },
];

export default function Laporan() {
  const { toast } = useToast();
  const [type, setType] = useState('keseluruhan');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [wave, setWave] = useState('');
  const [program, setProgram] = useState('');
  const [waves, setWaves] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/api/admin/waves').then(d => setWaves(d.rows || [])).catch(() => undefined); }, []);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ from, to, wave, program }).toString();
    api.get(`/api/admin/reports/${type}?${qs}`)
      .then(setData)
      .catch(e => { toast('error', e.message); setData(null); })
      .finally(() => setLoading(false));
  }, [type, from, to, wave, program]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const exportExcel = async () => {
    try {
      const qs = new URLSearchParams({ from, to, wave, program }).toString();
      await downloadFile(`/api/admin/reports/${type}/excel?${qs}`, `laporan-${type}.xlsx`);
      toast('success', 'Excel diunduh.');
    } catch { toast('error', 'Gagal mengekspor.'); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300">Laporan & Rekapitulasi</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => window.print()}>🖨 Cetak</button>
          <button className="btn-ghost" onClick={exportExcel}>⬇ Download Excel</button>
        </div>
      </div>

      <div className="card p-3 mb-4 flex flex-wrap gap-2 print:hidden">
        <select className="input !w-auto min-w-[240px]" value={type} onChange={e => setType(e.target.value)}>
          {REPORTS.map(r => <option key={r.type} value={r.type}>{r.label}</option>)}
        </select>
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <span>Periode</span>
          <input type="date" className="input !w-auto" value={from} onChange={e => setFrom(e.target.value)} />
          <span>s/d</span>
          <input type="date" className="input !w-auto" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <select className="input !w-auto" value={wave} onChange={e => setWave(e.target.value)}>
          <option value="">Semua Gelombang</option>
          {waves.map(w => <option key={w.id} value={w.id}>{w.nama}</option>)}
        </select>
        <select className="input !w-auto" value={program} onChange={e => setProgram(e.target.value)}>
          <option value="">Semua Program</option>
          {['TEKNIK MESIN', 'TEKNIK OTOMOTIF', 'PPLG'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {loading || !data ? <Spinner /> : (
        <div>
          <div className="mb-3 print:block">
            <h2 className="font-extrabold text-lg">{data.meta.title}</h2>
            <p className="text-xs text-slate-400">Dibuat {fmtDateTime(data.meta.generated_at)} · SPMB SMK BHINA KARYA KARANGANYAR TA 2027/2028</p>
          </div>
          <TableWrap>
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>{data.header.map((h: string, i: number) => <Th key={i}>{h}</Th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.rows.length === 0 ? <EmptyRow span={data.header.length} /> : data.rows.map((r: any[], i: number) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  {r.map((c: any, j: number) => <Td key={j}>{c ?? '-'}</Td>)}
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <p className="text-sm mt-3 font-semibold">{data.rows.length} baris data</p>
        </div>
      )}
    </div>
  );
}
