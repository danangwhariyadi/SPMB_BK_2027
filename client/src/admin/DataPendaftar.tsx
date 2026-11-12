import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/charts';
import { Modal, Pagination, Spinner, TableWrap, Td, Th, downloadFile, EmptyRow, fmtDateTime } from './shared';

const PROGRAMS = ['TEKNIK MESIN', 'TEKNIK OTOMOTIF', 'PPLG'];
const STATUSES = ['Belum diproses', 'Sedang diproses', 'Perlu perbaikan', 'Lengkap', 'Disetujui', 'Ditolak'];

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
];

export default function DataPendaftar() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canEdit = can('pendaftaran', 'can_edit');
  const canDelete = can('pendaftaran', 'can_delete');

  const [q, setQ] = useState('');
  const [wave, setWave] = useState('');
  const [program, setProgram] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [sort, setSort] = useState('id');
  const [dir, setDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [waves, setWaves] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [delRow, setDelRow] = useState<any>(null);
  const [delConfirm, setDelConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/api/admin/waves').then(d => setWaves(d.rows || [])).catch(() => undefined); }, []);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ q, wave, program, status, date, sort, dir, page: String(page), limit: '20' }).toString();
    api.get(`/api/applicants?${qs}`)
      .then(setData)
      .catch(e => toast('error', e.message))
      .finally(() => setLoading(false));
  }, [q, wave, program, status, date, sort, dir, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const setSorting = (col: string) => {
    if (sort === col) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(col); setDir('asc'); }
  };

  const openEdit = (r: any) => {
    const f: any = {};
    for (const { key, type } of EDIT_FIELDS) f[key] = type === 'date' ? String(r[key] || '').slice(0, 10) : (r[key] ?? '');
    setEditForm(f);
    setEditRow(r);
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await api.put(`/api/applicants/${editRow.id}`, editForm);
      toast('success', 'Perubahan tersimpan dan tercatat di riwayat.');
      setEditRow(null);
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.del(`/api/applicants/${delRow.id}`, { confirm: delConfirm });
      toast('success', 'Pendaftar dihapus.');
      setDelRow(null); setDelConfirm('');
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const exportExcel = async () => {
    try {
      const qs = new URLSearchParams({ q, wave, program, date }).toString();
      await downloadFile(`/api/admin/applicants/export?${qs}`, 'data-pendaftar.xlsx');
      toast('success', 'Excel diunduh.');
    } catch (e: any) { toast('error', 'Gagal mengekspor.'); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300">Data Pendaftar</h1>
        <button className="btn-ghost" onClick={exportExcel}>⬇ Export Excel</button>
      </div>

      <div className="card p-3 mb-4 flex flex-wrap gap-2">
        <input className="input !w-auto flex-1 min-w-[180px]" placeholder="Cari nama / no. pendaftaran / NISN / sekolah…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        <select className="input !w-auto" value={wave} onChange={e => { setWave(e.target.value); setPage(1); }}>
          <option value="">Semua Gelombang</option>
          {waves.map(w => <option key={w.id} value={w.id}>{w.nama}</option>)}
        </select>
        <select className="input !w-auto" value={program} onChange={e => { setProgram(e.target.value); setPage(1); }}>
          <option value="">Semua Program</option>
          {PROGRAMS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="input !w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua Status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <input type="date" className="input !w-auto" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} />
      </div>

      {loading && !data ? <Spinner /> : (
        <>
          <TableWrap>
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <Th onClick={() => setSorting('registration_number')} active={sort === 'registration_number'} dir={dir}>No. Pendaftaran</Th>
                <Th onClick={() => setSorting('registration_date')} active={sort === 'registration_date'} dir={dir}>Tanggal</Th>
                <Th onClick={() => setSorting('nama_lengkap')} active={sort === 'nama_lengkap'} dir={dir}>Nama Lengkap</Th>
                <Th>NISN</Th>
                <Th>JK</Th>
                <Th>Asal Sekolah</Th>
                <Th>Kecamatan</Th>
                <Th>No. HP</Th>
                <Th onClick={() => setSorting('program_keahlian')} active={sort === 'program_keahlian'} dir={dir}>Program</Th>
                <Th>Gelombang</Th>
                <Th>Berkas</Th>
                <Th>Kesehatan</Th>
                <Th>Wawancara</Th>
                <Th>Verifikasi</Th>
                <Th>Akhir</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!data || data.rows.length === 0 ? <EmptyRow span={16} text="Tidak ada pendaftar yang cocok dengan filter." /> :
                data.rows.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <Td><Link to={`/panel/pendaftaran/${r.id}`} className="font-bold text-primary-600 dark:text-primary-400 hover:underline">{r.registration_number}</Link></Td>
                    <Td className="whitespace-nowrap">{fmtDateTime(r.registration_date)}</Td>
                    <Td className="font-medium">{r.nama_lengkap}</Td>
                    <Td>{r.nisn || '-'}</Td>
                    <Td>{r.jenis_kelamin || '-'}</Td>
                    <Td className="max-w-[160px] truncate" >{r.asal_sekolah || '-'}</Td>
                    <Td>{r.kecamatan || '-'}</Td>
                    <Td>{r.hp_siswa || '-'}</Td>
                    <Td className="whitespace-nowrap">{r.program_keahlian}</Td>
                    <Td>{r.wave_nama || '-'}</Td>
                    <Td><StatusBadge status={r.status_berkas} /></Td>
                    <Td><StatusBadge status={r.status_kesehatan} /></Td>
                    <Td><StatusBadge status={r.status_wawancara} /></Td>
                    <Td><StatusBadge status={r.status_verifikasi} /></Td>
                    <Td><StatusBadge status={r.status_akhir} /></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Link className="text-xs btn-ghost px-2 py-1" to={`/panel/pendaftaran/${r.id}`}>Detail</Link>
                        {canEdit && <button className="text-xs btn-ghost px-2 py-1" onClick={() => openEdit(r)}>Edit</button>}
                        <a className="text-xs btn-ghost px-2 py-1" href={`/api/applicants/${r.id}/formulir.pdf`} target="_blank" rel="noreferrer">Cetak</a>
                        {canDelete && <button className="text-xs btn-ghost px-2 py-1 text-accent-500" onClick={() => { setDelRow(r); setDelConfirm(''); }}>Hapus</button>}
                      </div>
                    </Td>
                  </tr>
                ))}
            </tbody>
          </TableWrap>
          {data && <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />}
        </>
      )}

      <Modal open={Boolean(editRow)} onClose={() => setEditRow(null)} title={`Edit Data — ${editRow?.registration_number || ''}`} wide>
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
          <button className="btn-ghost" onClick={() => setEditRow(null)}>Batal</button>
        </div>
      </Modal>

      <Modal open={Boolean(delRow)} onClose={() => setDelRow(null)} title="Hapus Pendaftar">
        <p className="text-sm mb-3">Hapus pendaftar <b>{delRow?.nama_lengkap}</b> ({delRow?.registration_number}) beserta seluruh dokumen dan datanya? Tindakan ini tidak dapat dibatalkan.</p>
        <label className="label">Ketik nomor pendaftaran untuk konfirmasi</label>
        <input className="input mb-3 uppercase" value={delConfirm} onChange={e => setDelConfirm(e.target.value.toUpperCase())} placeholder={delRow?.registration_number} />
        <div className="flex gap-2">
          <button className="btn-accent" disabled={busy || delConfirm !== delRow?.registration_number} onClick={doDelete}>Hapus Permanen</button>
          <button className="btn-ghost" onClick={() => setDelRow(null)}>Batal</button>
        </div>
      </Modal>
    </div>
  );
}
