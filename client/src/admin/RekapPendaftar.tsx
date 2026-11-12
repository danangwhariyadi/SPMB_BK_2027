import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { TableWrap, Td, Th, Spinner, EmptyRow, downloadFile, fmtDateTime } from './shared';

const PROGRAMS = ['TEKNIK MESIN', 'TEKNIK OTOMOTIF', 'PPLG'];

export default function RekapPendaftar() {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const canDetail = ['admin', 'ketua', 'pendaftaran'].includes(user?.role_code || '') && can('pendaftaran', 'can_view');

  const [filter, setFilter] = useState<'semua' | 'hari' | 'gelombang' | 'program'>('semua');
  const [wave, setWave] = useState('');
  const [program, setProgram] = useState('');
  const [date, setDate] = useState('');
  const [waves, setWaves] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/api/admin/waves').then(d => setWaves(d.rows || [])).catch(() => undefined); }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({
      ...(filter === 'gelombang' && wave ? { wave } : {}),
      ...(filter === 'program' && program ? { program } : {}),
      ...(filter === 'hari' && date ? { date } : {}),
    }).toString();
    api.get(`/api/applicants/rekap${qs ? `?${qs}` : ''}`)
      .then(d => setRows(d.rows || []))
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
      await downloadFile(`/api/admin/applicants/export?${qs}`, 'rekap-pendaftar.xlsx');
      toast('success', 'Excel diunduh.');
    } catch { toast('error', 'Gagal mengekspor.'); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300">Rekapitulasi Data Pendaftar</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => window.print()}>🖨 Cetak</button>
          <button className="btn-ghost" onClick={exportExcel}>⬇ Export Excel</button>
        </div>
      </div>

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
        <span className="ml-auto text-sm text-slate-500 self-center">{rows.length} pendaftar</span>
      </div>

      {loading ? <Spinner /> : (
        <TableWrap>
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <Th>No. Pendaftaran</Th>
              <Th>Tanggal</Th>
              <Th>Nama Lengkap</Th>
              <Th>NISN</Th>
              <Th>JK</Th>
              <Th>Asal Sekolah</Th>
              <Th>Kecamatan</Th>
              <Th>No. HP</Th>
              <Th>Program</Th>
              <Th>Gelombang</Th>
              <Th>Status Berkas</Th>
              <Th>Status Akhir</Th>
              {canDetail && <Th>Aksi</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? <EmptyRow span={canDetail ? 13 : 12} /> : rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <Td className="font-bold">{r.registration_number}</Td>
                <Td className="whitespace-nowrap">{fmtDateTime(r.registration_date)}</Td>
                <Td className="font-medium">{r.nama_lengkap}</Td>
                <Td>{r.nisn || '-'}</Td>
                <Td>{r.jenis_kelamin || '-'}</Td>
                <Td className="max-w-[150px] truncate">{r.asal_sekolah || '-'}</Td>
                <Td>{r.kecamatan || '-'}</Td>
                <Td>{r.hp_siswa || '-'}</Td>
                <Td className="whitespace-nowrap">{r.program_keahlian}</Td>
                <Td>{r.wave_nama || '-'}</Td>
                <Td>{r.status_berkas}</Td>
                <Td>{r.status_akhir}</Td>
                {canDetail && (
                  <Td>
                    <Link className="text-xs btn-ghost px-2 py-1" to={`/panel/pendaftaran/${r.id}`}>Detail</Link>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
