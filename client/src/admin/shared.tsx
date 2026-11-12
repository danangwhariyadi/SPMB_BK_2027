import React from 'react';
import { api } from '../api';

export async function downloadFile(url: string, filename: string) {
  const res = await api.get(url);
  const blob = res instanceof Response ? await res.blob() : res;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

export function openPdf(url: string) {
  window.open(url, '_blank');
}

export const rupiah = (n: number | string | null | undefined) =>
  'Rp ' + Number(n || 0).toLocaleString('id-ID');

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('id-ID') : '-';

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10" onClick={onClose}>
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} p-5`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Th({ children, onClick, active, dir }: { children: React.ReactNode; onClick?: () => void; active?: boolean; dir?: string }) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${onClick ? 'cursor-pointer select-none hover:text-primary-600' : ''} ${active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'}`}
    >
      {children}{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-sm align-top ${className}`}>{children}</td>;
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto print:shadow-none print:border-0">
      <table className="w-full min-w-[720px] print:min-w-0">{children}</table>
    </div>
  );
}

export function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-2 mt-4 text-sm">
      <button className="btn-ghost px-3 py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Sebelumnya</button>
      <span className="text-slate-500">Halaman {page} dari {pages} · {total} data</span>
      <button className="btn-ghost px-3 py-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya ›</button>
    </div>
  );
}

export function Spinner() {
  return <div className="py-16 text-center text-slate-400 text-sm">Memuat data…</div>;
}

export function EmptyRow({ span, text = 'Belum ada data' }: { span: number; text?: string }) {
  return <tr><td colSpan={span} className="px-3 py-10 text-center text-sm text-slate-400">{text}</td></tr>;
}

export async function useLoader<T>(fn: () => Promise<T>, deps: any[]): Promise<{ data: T | null; reload: () => void; set: (d: T) => void }> {
  const [data, setData] = React.useState<T | null>(null);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { let live = true; fn().then(d => { if (live) setData(d); }).catch(() => undefined); return () => { live = false; }; }, [...deps, tick]);
  return { data, reload: () => setTick(t => t + 1), set: setData };
}
