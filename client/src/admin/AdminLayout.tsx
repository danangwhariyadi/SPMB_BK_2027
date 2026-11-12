import { useState } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { useDarkMode } from '../components/Toast';

interface MenuItem {
  to: string;
  label: string;
  icon: string;
  perm: string;
  children?: { to: string; label: string; perm?: string; action?: 'can_create' }[];
}

const MENUS: MenuItem[] = [
  { to: '/panel', label: 'Dashboard', icon: '📊', perm: 'dashboard', children: [] },
  {
    to: '/panel/pendaftaran/data', label: 'Pendaftaran', icon: '📝', perm: 'pendaftaran',
    children: [
      { to: '/panel/pendaftaran/input', label: 'Input Pendaftaran', action: 'can_create' },
      { to: '/panel/pendaftaran/data', label: 'Data Pendaftar' },
      { to: '/panel/pendaftaran/rekap', label: 'Rekapitulasi' },
    ],
  },
  { to: '/panel/pembayaran', label: 'Pembayaran', icon: '💰', perm: 'pembayaran' },
  { to: '/panel/kesehatan', label: 'Kesehatan', icon: '🩺', perm: 'kesehatan' },
  { to: '/panel/wawancara', label: 'Wawancara', icon: '🎤', perm: 'wawancara' },
  { to: '/panel/verifikasi', label: 'Verifikasi', icon: '✅', perm: 'verifikasi' },
  { to: '/panel/dokumen', label: 'Dokumen', icon: '📁', perm: 'dokumen' },
  { to: '/panel/laporan', label: 'Laporan', icon: '📑', perm: 'laporan' },
  { to: '/panel/pengguna', label: 'Manajemen Pengguna', icon: '👥', perm: 'pengguna' },
  { to: '/panel/pengaturan', label: 'Pengaturan Sistem', icon: '⚙️', perm: 'pengaturan' },
  { to: '/panel/audit', label: 'Audit Log', icon: '🛡️', perm: 'audit' },
];

export default function AdminLayout() {
  const { user, loading, logout, can } = useAuth();
  const { dark, toggle } = useDarkMode();
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-400">Memuat…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const visible = MENUS.filter(m => can(m.perm)).map(m => ({
    ...m,
    children: (m.children || []).filter(c => !c.action || can(m.perm, c.action)),
  })).filter(m => !m.children || m.children.length > 0 || true);

  const bottomItems = visible.slice(0, 4);

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1">
      {visible.map(m => (
        <div key={m.to + m.label}>
          <NavLink
            to={m.to}
            end={m.to === '/panel'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-primary-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <span className="text-base">{m.icon}</span>{m.label}
          </NavLink>
          {m.children && m.children.length > 0 && (
            <div className="ml-9 mt-1 space-y-0.5 border-l-2 border-slate-100 dark:border-slate-800 pl-3">
              {m.children.map(c => (
                <NavLink
                  key={c.to}
                  to={c.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `block rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${isActive ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-primary-600'}`}
                >
                  {c.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 px-4 h-16">
          <button className="md:hidden btn-ghost px-2.5 py-2" onClick={() => setDrawer(true)} aria-label="Menu">☰</button>
          <img src="/logobk.png" alt="Logo SMK Bhina Karya" className="w-9 h-9 rounded-lg object-contain" />
          <div className="min-w-0">
            <div className="font-extrabold text-sm leading-tight text-primary-800 dark:text-primary-300 truncate">SPMB SMK BHINA KARYA KARANGANYAR</div>
            <div className="text-[11px] text-slate-400">Panel Panitia · TA 2027/2028</div>
          </div>
          <div className="flex-1" />
          <button className="btn-ghost px-2.5 py-2" onClick={toggle} aria-label="Mode gelap">{dark ? '☀️' : '🌙'}</button>
          <div className="hidden sm:block text-right mr-1">
            <div className="text-sm font-semibold leading-tight">{user.full_name}</div>
            <div className="text-[11px] text-slate-400 uppercase">{user.role_code}</div>
          </div>
          <button className="btn-ghost text-xs" onClick={logout}>Keluar</button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden md:block w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-4 border-r border-slate-100 dark:border-slate-800">
          <NavItems />
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden" onClick={() => setDrawer(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold">Menu Panitia</span>
                <button className="btn-ghost px-2 py-1" onClick={() => setDrawer(false)}>✕</button>
              </div>
              <NavItems onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 p-4 md:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex">
        {bottomItems.map(m => (
          <NavLink
            key={m.to}
            to={m.to}
            end={m.to === '/panel'}
            className={({ isActive }) => `flex-1 flex flex-col items-center py-2 text-[10px] font-medium ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`}
          >
            <span className="text-lg">{m.icon}</span>{m.label.split(' ')[0]}
          </NavLink>
        ))}
        <button onClick={() => setDrawer(true)} className="flex-1 flex flex-col items-center py-2 text-[10px] font-medium text-slate-400">
          <span className="text-lg">☰</span>Lainnya
        </button>
      </nav>
    </div>
  );
}
