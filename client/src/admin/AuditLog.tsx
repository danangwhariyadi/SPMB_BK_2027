import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { Spinner, TableWrap, Td, Th, Pagination, EmptyRow, fmtDateTime } from './shared';

export default function AuditLog() {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/api/admin/audit?page=${page}&limit=50&q=${encodeURIComponent(q)}`)
      .then(setData)
      .catch(e => toast('error', e.message))
      .finally(() => setLoading(false));
  }, [q, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300 mb-1">Audit Log</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Rekam jejak seluruh aktivitas penting di sistem.</p>

      <div className="card p-3 mb-4">
        <input className="input" placeholder="Cari pengguna / aksi / entitas…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
      </div>

      {loading && !data ? <Spinner /> : (
        <>
          <TableWrap>
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr><Th>Waktu</Th><Th>Pengguna</Th><Th>Aksi</Th><Th>Entitas</Th><Th>Detail</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!data || data.rows.length === 0 ? <EmptyRow span={5} /> : data.rows.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <Td className="whitespace-nowrap">{fmtDateTime(l.created_at)}</Td>
                  <Td className="font-semibold">{l.username || '-'}</Td>
                  <Td><span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{l.action}</span></Td>
                  <Td>{l.entity}{l.entity_id ? ` #${l.entity_id}` : ''}</Td>
                  <Td className="max-w-[420px] text-xs text-slate-500 dark:text-slate-400">{l.detail || '-'}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {data && <Pagination page={data.page} total={data.total} limit={50} onPage={setPage} />}
        </>
      )}
    </div>
  );
}
