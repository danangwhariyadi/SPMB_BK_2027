import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { Modal, Spinner, TableWrap, Td, Th, EmptyRow, downloadFile } from './shared';

const SETTING_SECTIONS: { title: string; fields: { key: string; label: string; type?: string; hint?: string }[] }[] = [
  {
    title: 'Identitas Sekolah',
    fields: [
      { key: 'school_name', label: 'Nama Sekolah' },
      { key: 'school_address', label: 'Alamat Sekolah' },
      { key: 'school_phone', label: 'Telepon' },
      { key: 'school_email', label: 'Email' },
      { key: 'school_website', label: 'Website' },
      { key: 'ta', label: 'Tahun Ajaran' },
    ],
  },
  {
    title: 'Pendaftaran',
    fields: [
      { key: 'pendaftaran_dibuka', label: 'Status Pendaftaran', type: 'select', hint: 'buka / tutup' },
      { key: 'format_no_pendaftaran', label: 'Format No. Pendaftaran', hint: 'contoh: A{seq:4}' },
      { key: 'umur_ref_date', label: 'Tanggal Referensi Umur', hint: 'format YYYY-MM-DD (default 2027-07-10)' },
      { key: 'biaya_gelombang', label: 'Biaya Tiap Gelombang', hint: 'teks bebas, mis. INDEN=150000;Gel1=200000' },
    ],
  },
  {
    title: 'Scanner & Notifikasi',
    fields: [
      { key: 'scanner_bridge_url', label: 'URL Scanner Bridge', hint: 'default http://127.0.0.1:45454' },
      { key: 'scanner_bridge_token', label: 'Token Scanner Bridge', type: 'password' },
      { key: 'info_spmb', label: 'Info Tambahan SPMB', hint: 'tampil di halaman informasi publik' },
    ],
  },
];

export default function Pengaturan() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canEdit = can('pengaturan', 'can_edit');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [waves, setWaves] = useState<any[]>([]);
  const [waveForm, setWaveForm] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.get('/api/admin/settings'), api.get('/api/admin/waves')])
      .then(([s, w]) => { setSettings(s.settings || {}); setWaves(w.rows || []); })
      .catch(e => toast('error', e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/api/admin/settings', settings);
      toast('success', 'Pengaturan tersimpan.');
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const backup = async () => {
    try {
      await downloadFile('/api/admin/backup', 'backup-spmb.json');
      toast('success', 'Backup diunduh.');
    } catch { toast('error', 'Gagal membuat backup.'); }
  };

  const saveWave = async () => {
    setBusy(true);
    try {
      if (waveForm.id) await api.put(`/api/admin/waves/${waveForm.id}`, waveForm);
      else await api.post('/api/admin/waves', waveForm);
      toast('success', 'Gelombang tersimpan.');
      setWaveForm(null);
      const d = await api.get('/api/admin/waves');
      setWaves(d.rows || []);
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const delWave = async (w: any) => {
    if (!confirm(`Hapus gelombang ${w.nama}?`)) return;
    try {
      await api.del(`/api/admin/waves/${w.id}`);
      toast('success', 'Gelombang dihapus.');
      const d = await api.get('/api/admin/waves');
      setWaves(d.rows || []);
    } catch (e: any) { toast('error', e.message); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300">Pengaturan Sistem</h1>

      {SETTING_SECTIONS.map(sec => (
        <div key={sec.title} className="card p-5">
          <h2 className="font-bold text-sm uppercase tracking-wide text-primary-700 dark:text-primary-300 mb-4">{sec.title}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {sec.fields.map(f => (
              <div key={f.key} className={f.type === 'select' ? '' : 'sm:col-span-2'}>
                <label className="label">{f.label}</label>
                {f.type === 'select' ? (
                  <select className="input" value={settings[f.key] || ''} disabled={!canEdit} onChange={e => setSettings({ ...settings, [f.key]: e.target.value })}>
                    <option value="buka">buka</option>
                    <option value="tutup">tutup</option>
                  </select>
                ) : (
                  <input
                    className="input"
                    type={f.type === 'password' ? 'password' : 'text'}
                    value={settings[f.key] || ''}
                    disabled={!canEdit}
                    onChange={e => setSettings({ ...settings, [f.key]: e.target.value })}
                  />
                )}
                {f.hint && <p className="text-xs text-slate-400 mt-1">{f.hint}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {canEdit && (
        <button className="btn-primary" disabled={busy} onClick={save}>Simpan Pengaturan</button>
      )}

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-sm uppercase tracking-wide text-primary-700 dark:text-primary-300">Jadwal Gelombang & Kuota Program</h2>
          {canEdit && (
            <button className="btn-ghost text-xs" onClick={() => setWaveForm({ nama: '', start_date: '', end_date: '', is_active: true, quota_tm: 0, quota_to: 0, quota_pplg: 0 })}>
              + Tambah Gelombang
            </button>
          )}
        </div>
        <TableWrap>
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr><Th>Nama</Th><Th>Mulai</Th><Th>Selesai</Th><Th>Kuota TM</Th><Th>Kuota TO</Th><Th>Kuota PPLG</Th><Th>Terisi</Th><Th>Aktif</Th><Th>Aksi</Th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {waves.length === 0 ? <EmptyRow span={9} /> : waves.map(w => (
              <tr key={w.id}>
                <Td className="font-bold">{w.nama}</Td>
                <Td>{w.start_date}</Td><Td>{w.end_date}</Td>
                <Td>{w.quota_tm}</Td><Td>{w.quota_to}</Td><Td>{w.quota_pplg}</Td>
                <Td>{w.used}</Td>
                <Td><span className={`badge ${w.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{w.is_active ? 'Aktif' : 'Nonaktif'}</span></Td>
                <Td>
                  {canEdit ? (
                    <div className="flex gap-1">
                      <button className="text-xs btn-ghost px-2 py-1" onClick={() => setWaveForm({ ...w, is_active: Boolean(w.is_active) })}>Edit</button>
                      <button className="text-xs btn-ghost px-2 py-1 text-accent-500" onClick={() => delWave(w)}>Hapus</button>
                    </div>
                  ) : '-'}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      <div className="card p-5">
        <h2 className="font-bold text-sm uppercase tracking-wide text-primary-700 dark:text-primary-300 mb-3">Backup Database</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Unduh salinan seluruh data (JSON) untuk arsip atau pemulihan.</p>
        <button className="btn-ghost" onClick={backup}>⬇ Unduh Backup</button>
      </div>

      <div className="card p-5">
        <h2 className="font-bold text-sm uppercase tracking-wide text-primary-700 dark:text-primary-300 mb-3">Integrasi Notifikasi (WhatsApp/Email)</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Notifikasi WhatsApp dan Email diaktifkan lewat environment variable server (<code className="text-xs">WA_API_URL</code>, <code className="text-xs">WA_API_TOKEN</code>, <code className="text-xs">SMTP_HOST</code>, dst — lihat <code className="text-xs">server/.env.example</code>).
          Selama variabel tersebut belum diisi, sistem berjalan tanpa pengiriman pesan dan status pengiriman dilaporkan jujur di antarmuka.
        </p>
      </div>

      <Modal open={Boolean(waveForm)} onClose={() => setWaveForm(null)} title={waveForm?.id ? `Edit Gelombang — ${waveForm.nama}` : 'Tambah Gelombang'}>
        {waveForm && (
          <div className="space-y-3">
            <div>
              <label className="label">Nama Gelombang</label>
              <input className="input" value={waveForm.nama} onChange={e => setWaveForm({ ...waveForm, nama: e.target.value })} placeholder="Gelombang 1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tanggal Mulai</label>
                <input className="input" type="date" value={waveForm.start_date || ''} onChange={e => setWaveForm({ ...waveForm, start_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Tanggal Berakhir</label>
                <input className="input" type="date" value={waveForm.end_date || ''} onChange={e => setWaveForm({ ...waveForm, end_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Kuota Teknik Mesin</label>
                <input className="input" type="number" value={waveForm.quota_tm} onChange={e => setWaveForm({ ...waveForm, quota_tm: e.target.value })} />
              </div>
              <div>
                <label className="label">Kuota Teknik Otomotif</label>
                <input className="input" type="number" value={waveForm.quota_to} onChange={e => setWaveForm({ ...waveForm, quota_to: e.target.value })} />
              </div>
              <div>
                <label className="label">Kuota PPLG</label>
                <input className="input" type="number" value={waveForm.quota_pplg} onChange={e => setWaveForm({ ...waveForm, quota_pplg: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm self-end pb-2.5">
                <input type="checkbox" checked={Boolean(waveForm.is_active)} onChange={e => setWaveForm({ ...waveForm, is_active: e.target.checked })} />
                Gelombang aktif
              </label>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy || !waveForm.nama || !waveForm.start_date || !waveForm.end_date} onClick={saveWave}>Simpan</button>
              <button className="btn-ghost" onClick={() => setWaveForm(null)}>Batal</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
