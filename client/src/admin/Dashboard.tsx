import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { StatCard, BarChart, LineChart, DonutChart, BubbleMap } from '../components/charts';
import { Spinner } from './shared';

const PROGRAM_LABELS: Record<string, string> = {
  'TEKNIK MESIN': 'Teknik Mesin',
  'TEKNIK OTOMOTIF': 'Teknik Otomotif',
  PPLG: 'PPLG',
};

const KEC_COORDS: Record<string, { lat: number; lng: number }> = {
  'colomadu': { lat: -7.545, lng: 110.817 },
  'gondangrejo': { lat: -7.528, lng: 110.886 },
  'jaten': { lat: -7.533, lng: 110.928 },
  'karanganyar': { lat: -7.594, lng: 110.928 },
  'karangpandan': { lat: -7.639, lng: 111.024 },
  'kebakkramat': { lat: -7.523, lng: 110.768 },
  'kerjo': { lat: -7.663, lng: 111.057 },
  'matesih': { lat: -7.615, lng: 110.987 },
  'ngargoyoso': { lat: -7.655, lng: 111.100 },
  'jenawi': { lat: -7.650, lng: 111.055 },
  'tawangmangu': { lat: -7.655, lng: 111.133 },
  'jumapolo': { lat: -7.667, lng: 110.983 },
  'jumantono': { lat: -7.617, lng: 110.883 },
  'jatiyoso': { lat: -7.633, lng: 111.117 },
  'tasikmadu': { lat: -7.578, lng: 110.883 },
};

function kecCoord(name: string) {
  const key = String(name || '').toLowerCase().trim();
  return KEC_COORDS[key] || null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [waves, setWaves] = useState<any[]>([]);
  const [filters, setFilters] = useState({ wave: '', program: '', status: '', date: '' });

  useEffect(() => {
    api.get('/api/admin/waves').then(d => setWaves(d.rows || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    api.get('/api/dashboard/stats' + (qs ? `?${qs}` : '')).then(setStats).catch(() => undefined);
  }, [filters]);

  const waveOf = (nama: string) => (stats?.per_wave || []).find((w: any) => (w.nama || '').toLowerCase().includes(nama.toLowerCase()))?.total ?? 0;
  const progOf = (kode: string) => (stats?.per_program || []).find((p: any) => p.program_keahlian === kode)?.total ?? 0;

  const asalPoints = useMemo(() => {
    const agg: Record<string, number> = {};
    for (const r of stats?.per_asal_sekolah || []) {
      const c = kecCoord(r.kecamatan);
      if (!c) continue;
      agg[r.kecamatan] = (agg[r.kecamatan] || 0) + Number(r.total);
    }
    return Object.entries(agg).map(([name, count]) => ({ name, count, ...kecCoord(name) }));
  }, [stats]);

  const domisiliPoints = useMemo(() => {
    const agg: Record<string, { count: number; desa: string }> = {};
    for (const r of stats?.per_desa || []) {
      const c = kecCoord(r.kecamatan);
      if (!c) continue;
      if (!agg[r.kecamatan]) agg[r.kecamatan] = { count: 0, desa: r.desa };
      agg[r.kecamatan].count += Number(r.total);
    }
    return Object.entries(agg).map(([name, v]) => ({ name: v.desa !== '-' ? `${v.desa}` : name, count: v.count, ...kecCoord(name) }));
  }, [stats]);

  if (!stats) return <Spinner />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Selamat datang, {user?.full_name}. Statistik pendaftaran real-time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input !w-auto" value={filters.wave} onChange={e => setFilters(f => ({ ...f, wave: e.target.value }))}>
            <option value="">Semua Gelombang</option>
            {waves.map(w => <option key={w.id} value={w.id}>{w.nama}</option>)}
          </select>
          <select className="input !w-auto" value={filters.program} onChange={e => setFilters(f => ({ ...f, program: e.target.value }))}>
            <option value="">Semua Program</option>
            <option value="TEKNIK MESIN">Teknik Mesin</option>
            <option value="TEKNIK OTOMOTIF">Teknik Otomotif</option>
            <option value="PPLG">PPLG</option>
          </select>
          <select className="input !w-auto" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">Semua Status</option>
            {['Belum diproses', 'Sedang diproses', 'Perlu perbaikan', 'Lengkap', 'Disetujui', 'Ditolak'].map(s => <option key={s}>{s}</option>)}
          </select>
          <input type="date" className="input !w-auto" value={filters.date} onChange={e => setFilters(f => ({ ...f, date: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-5">
        <StatCard label="Total Pendaftar" value={stats.total} color="primary" icon="👥" />
        <StatCard label="Pendaftar Hari Ini" value={stats.today} color="green" icon="📅" />
        <StatCard label="Gelombang INDEN" value={waveOf('INDEN')} color="slate" icon="🗂" />
        <StatCard label="Gelombang 1" value={waveOf('1')} color="primary" icon="1️⃣" />
        <StatCard label="Gelombang 2" value={waveOf('2')} color="primary" icon="2️⃣" />
        <StatCard label="Teknik Mesin" value={progOf('TEKNIK MESIN')} color="amber" icon="⚙️" />
        <StatCard label="Teknik Otomotif" value={progOf('TEKNIK OTOMOTIF')} color="amber" icon="🚗" />
        <StatCard label="PPLG" value={progOf('PPLG')} color="amber" icon="💻" />
        <StatCard label="Dokumen Belum Lengkap" value={stats.docs_incomplete} color="accent" icon="📎" />
        <StatCard label="Menunggu Verifikasi" value={stats.waiting_verify} color="amber" icon="⏳" />
        <StatCard label="Sudah Terverifikasi" value={stats.verified} color="green" icon="✅" />
        {stats.payments !== null && (
          <StatCard label={`Pembayaran (${stats.payments.count}x)`} value={'Rp ' + Number(stats.payments.total).toLocaleString('id-ID')} color="green" icon="💰" />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-bold mb-3 text-sm">Pendaftaran 30 Hari Terakhir</h2>
          <LineChart data={(stats.per_day || []).map((d: any) => ({ label: String(d.tanggal).slice(5), value: d.total }))} />
        </div>
        <div className="card p-4">
          <h2 className="font-bold mb-3 text-sm">Pendaftaran per Bulan</h2>
          <BarChart data={(stats.per_month || []).map((d: any) => ({ label: d.bulan, value: d.total }))} />
        </div>
        <div className="card p-4">
          <h2 className="font-bold mb-3 text-sm">Pendaftar per Program Keahlian</h2>
          <BarChart data={(stats.per_program || []).map((d: any) => ({ label: PROGRAM_LABELS[d.program_keahlian] || d.program_keahlian || '-', value: d.total }))} color="#dc2626" />
        </div>
        <div className="card p-4">
          <h2 className="font-bold mb-3 text-sm">Pendaftar per Jalur</h2>
          <DonutChart data={(stats.per_jalur || []).map((d: any) => ({ label: d.jalur || '-', value: d.total }))} />
        </div>
        <div className="card p-4">
          <h2 className="font-bold mb-3 text-sm">Peta Sebaran Asal Sekolah (per Kecamatan)</h2>
          <BubbleMap title="Sebaran asal sekolah pendaftar" points={asalPoints} />
        </div>
        <div className="card p-4">
          <h2 className="font-bold mb-3 text-sm">Peta Sebaran Domisili Pendaftar (per Desa/Kelurahan)</h2>
          <BubbleMap title="Sebaran domisili pendaftar" points={domisiliPoints} />
        </div>
        <div className="card p-4">
          <h2 className="font-bold mb-3 text-sm">Asal Sekolah Terbanyak</h2>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {(stats.per_asal_sekolah || []).slice(0, 12).map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-800 pb-1">
                <span className="truncate pr-2">{r.sekolah} <span className="text-xs text-slate-400">· {r.kecamatan}</span></span>
                <span className="font-bold">{r.total}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-bold mb-3 text-sm">Sebaran Kecamatan Domisili</h2>
          <BarChart data={(stats.per_kecamatan || []).slice(0, 10).map((d: any) => ({ label: d.kecamatan, value: d.total }))} />
        </div>
      </div>
    </div>
  );
}
