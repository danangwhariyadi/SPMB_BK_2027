import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { Modal, Spinner, TableWrap, Td, Th, EmptyRow, fmtDateTime } from './shared';

export default function Pengguna() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role_code === 'admin';
  const [rows, setRows] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, { name: string }>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role_code: '' });
  const [editRow, setEditRow] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [delRow, setDelRow] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/admin/users')
      .then(d => { setRows(d.rows || []); setRoles(d.roles || {}); })
      .catch(e => toast('error', e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const roleOptions = Object.entries(roles).filter(([code]) => isAdmin || code !== 'admin');

  const addUser = async () => {
    setBusy(true);
    try {
      await api.post('/api/admin/users', form);
      toast('success', `Akun ${form.username} dibuat.`);
      setAddOpen(false);
      setForm({ username: '', password: '', full_name: '', role_code: '' });
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await api.put(`/api/admin/users/${editRow.id}`, editForm);
      toast('success', 'Perubahan akun tersimpan.');
      setEditRow(null);
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const toggleActive = async (u: any) => {
    try {
      await api.put(`/api/admin/users/${u.id}`, { is_active: !u.is_active });
      toast('success', `Akun ${u.username} ${u.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`);
      load();
    } catch (e: any) { toast('error', e.message); }
  };

  const delUser = async () => {
    setBusy(true);
    try {
      await api.del(`/api/admin/users/${delRow.id}`);
      toast('success', 'Akun dihapus.');
      setDelRow(null);
      load();
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300">Manajemen Pengguna</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Kelola akun panitia dan hak aksesnya.</p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>+ Tambah Akun</button>
      </div>

      {loading ? <Spinner /> : (
        <TableWrap>
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr><Th>Username</Th><Th>Nama Lengkap</Th><Th>Peran</Th><Th>Status</Th><Th>Login Terakhir</Th><Th>Dibuat</Th><Th>Aksi</Th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? <EmptyRow span={7} /> : rows.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <Td className="font-bold">{u.username}</Td>
                <Td>{u.full_name}</Td>
                <Td><span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{roles[u.role_code]?.name || u.role_code}</span></Td>
                <Td>
                  <span className={`badge ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                    {u.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">{u.last_login_at ? fmtDateTime(u.last_login_at) : '-'}</Td>
                <Td className="whitespace-nowrap">{fmtDateTime(u.created_at)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <button className="text-xs btn-ghost px-2 py-1" onClick={() => { setEditRow(u); setEditForm({ full_name: u.full_name, role_code: u.role_code, is_active: Boolean(u.is_active), password: '' }); }}>Edit</button>
                    <button className="text-xs btn-ghost px-2 py-1" onClick={() => toggleActive(u)}>{u.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    {u.role_code !== 'admin' && u.id !== user?.id && (
                      <button className="text-xs btn-ghost px-2 py-1 text-accent-500" onClick={() => setDelRow(u)}>Hapus</button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Tambah Akun Panitia">
        <div className="space-y-3">
          <div>
            <label className="label">Username</label>
            <input className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className="label">Nama Lengkap</label>
            <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Peran</label>
            <select className="input" value={form.role_code} onChange={e => setForm({ ...form, role_code: e.target.value })}>
              <option value="">— Pilih Peran —</option>
              {roleOptions.map(([code, r]) => <option key={code} value={code}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Password (min. 8 karakter)</label>
            <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || !form.username || !form.password || !form.full_name || !form.role_code} onClick={addUser}>Simpan</button>
            <button className="btn-ghost" onClick={() => setAddOpen(false)}>Batal</button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(editRow)} onClose={() => setEditRow(null)} title={`Edit Akun — ${editRow?.username || ''}`}>
        <div className="space-y-3">
          <div>
            <label className="label">Nama Lengkap</label>
            <input className="input" value={editForm.full_name || ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Peran</label>
            <select className="input" value={editForm.role_code || ''} onChange={e => setEditForm({ ...editForm, role_code: e.target.value })}>
              {roleOptions.map(([code, r]) => <option key={code} value={code}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Password Baru (kosongkan bila tidak diubah)</label>
            <input className="input" type="password" value={editForm.password || ''} onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(editForm.is_active)} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} />
            Akun aktif
          </label>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={saveEdit}>Simpan</button>
            <button className="btn-ghost" onClick={() => setEditRow(null)}>Batal</button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(delRow)} onClose={() => setDelRow(null)} title="Hapus Akun">
        <p className="text-sm mb-3">Hapus akun <b>{delRow?.username}</b>? Tindakan ini permanen.</p>
        <div className="flex gap-2">
          <button className="btn-accent" disabled={busy} onClick={delUser}>Hapus</button>
          <button className="btn-ghost" onClick={() => setDelRow(null)}>Batal</button>
        </div>
      </Modal>
    </div>
  );
}
