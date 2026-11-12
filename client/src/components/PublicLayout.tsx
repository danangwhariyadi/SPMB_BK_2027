import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useDarkMode } from './Toast';

const menu = [
  { to: '/', label: 'Beranda' },
  { to: '/informasi', label: 'Informasi SPMB' },
  { to: '/jadwal', label: 'Jadwal' },
  { to: '/program', label: 'Program Keahlian' },
  { to: '/persyaratan', label: 'Persyaratan' },
  { to: '/daftar', label: 'Formulir Pendaftaran' },
  { to: '/cek', label: 'Cek/Ubah Pendaftaran' },
  { to: '/login', label: 'Login Panitia' },
];

export default function PublicLayout() {
  const { dark, toggle } = useDarkMode();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <img src="/logobk.png" alt="Logo SMK Bhina Karya" className="w-10 h-10" />
            <div className="leading-tight">
              <div className="font-extrabold text-primary-800 dark:text-primary-300 text-sm md:text-base">SPMB ONLINE</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">SMK Bhina Karya Karanganyar • TA 2027/2028</div>
            </div>
          </Link>
          <nav className="hidden lg:flex items-center gap-1 ml-auto">
            {menu.slice(0, 7).map(m => (
              <NavLink key={m.to} to={m.to} className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                {m.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={toggle} aria-label="Ganti tema" className="ml-auto lg:ml-2 w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            {dark ? '☀️' : '🌙'}
          </button>
          <button onClick={() => navigate('/daftar')} className="hidden md:inline-flex btn-accent !py-2">DAFTAR SEKARANG</button>
        </div>
      </header>

      <main className="flex-1 pb-20 lg:pb-0">
        <Outlet />
      </main>

      <footer className="bg-primary-900 text-primary-100 py-8 mt-8">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src="/logobk.png" alt="Logo" className="w-8 h-8" />
              <span className="font-bold text-white">SMK BHINA KARYA KARANGANYAR</span>
            </div>
            <p className="opacity-80">SPMB Online Tahun Ajaran 2027/2028</p>
          </div>
          <div>
            <div className="font-semibold text-white mb-2">Kontak</div>
            <p className="opacity-80" data-kontak>Memuat kontak…</p>
          </div>
          <div>
            <div className="font-semibold text-white mb-2">Menu Cepat</div>
            <Link to="/daftar" className="block opacity-80 hover:opacity-100">Formulir Pendaftaran</Link>
            <Link to="/cek" className="block opacity-80 hover:opacity-100">Cek/Ubah Pendaftaran</Link>
            <Link to="/jadwal" className="block opacity-80 hover:opacity-100">Jadwal Pendaftaran</Link>
          </div>
        </div>
      </footer>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex">
        {[
          { to: '/', label: 'Beranda', icon: '🏠' },
          { to: '/informasi', label: 'Info', icon: 'ℹ️' },
          { to: '/daftar', label: 'Daftar', icon: '📝' },
          { to: '/cek', label: 'Cek', icon: '🔍' },
          { to: '/login', label: 'Panitia', icon: '🔐' },
        ].map(m => (
          <NavLink key={m.to} to={m.to} className={({ isActive }) =>
            `flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[10px] font-medium ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-slate-500 dark:text-slate-400'}`}>
            <span className="text-lg leading-none">{m.icon}</span>{m.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
