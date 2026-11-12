import React from 'react';

export function StatCard({ label, value, color = 'primary', icon }: { label: string; value: React.ReactNode; color?: string; icon?: string }) {
  const colors: Record<string, string> = {
    primary: 'from-primary-700 to-primary-500',
    accent: 'from-accent-500 to-red-400',
    green: 'from-emerald-600 to-emerald-400',
    amber: 'from-amber-500 to-amber-400',
    slate: 'from-slate-700 to-slate-500',
  };
  return (
    <div className={`card p-4 flex items-center gap-3`}>
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} text-white flex items-center justify-center text-lg font-bold shrink-0`}>
        {icon || value?.toString().slice(0, 2)}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold leading-none">{value}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

export function BarChart({ data, color = '#1d4ed8' }: { data: Array<{ label: string; value: number }>; color?: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  if (!data.length) return <div className="text-sm text-slate-400 py-8 text-center">Belum ada data</div>;
  return (
    <div className="flex items-end gap-3 h-44 px-1 overflow-x-auto">
      {data.map(d => (
        <div key={d.label} className="flex flex-col items-center gap-1 min-w-[52px] flex-1">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">{d.value}</div>
          <div className="w-full rounded-t-lg transition-all" style={{ height: `${(d.value / max) * 110}px`, minHeight: 4, backgroundColor: color }} title={`${d.label}: ${d.value}`} />
          <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center leading-tight h-8 overflow-hidden">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ data }: { data: Array<{ label: string; value: number }> }) {
  if (!data.length) return <div className="text-sm text-slate-400 py-8 text-center">Belum ada data</div>;
  const max = Math.max(1, ...data.map(d => d.value));
  const w = 100, h = 40;
  const pts = data.map((d, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - (d.value / max) * (h - 4) - 2}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32" preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="#1d4ed8" strokeWidth="0.8" />
        {data.map((d, i) => (
          <circle key={i} cx={(i / Math.max(1, data.length - 1)) * w} cy={h - (d.value / max) * (h - 4) - 2} r="0.9" fill="#dc2626" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 px-1">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function DonutChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="text-sm text-slate-400 py-8 text-center">Belum ada data</div>;
  const colors = ['#1d4ed8', '#dc2626', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6'];
  let acc = 0;
  const r = 15.915;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox="0 0 42 42" className="w-32 h-32 -rotate-90">
        <circle cx="21" cy="21" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        {data.map((d, i) => {
          const frac = d.value / total * 100;
          const el = (
            <circle key={i} cx="21" cy="21" r={r} fill="none" stroke={colors[i % colors.length]} strokeWidth="6"
              strokeDasharray={`${frac} ${100 - frac}`} strokeDashoffset={-acc} />
          );
          acc += frac;
          return el;
        })}
      </svg>
      <div className="space-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="font-medium">{d.label}</span>
            <span className="text-slate-500">{d.value} ({Math.round(d.value / total * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Peta sebaran sederhana (bubble map) berdasarkan koordinat desa/kecamatan. */
export function BubbleMap({ points, title }: { points: Array<{ name: string; lat: number; lng: number; count: number }>; title: string }) {
  if (!points.length) return <div className="text-sm text-slate-400 py-8 text-center">Belum ada data lokasi</div>;
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  const minLat = Math.min(...lats) - 0.05, maxLat = Math.max(...lats) + 0.05;
  const minLng = Math.min(...lngs) - 0.05, maxLng = Math.max(...lngs) + 0.05;
  const maxCount = Math.max(...points.map(p => p.count));
  const W = 400, H = 300;
  const x = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * (W - 60) + 30;
  const y = (lat: number) => H - (((lat - minLat) / (maxLat - minLat)) * (H - 50) + 25);
  return (
    <div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-gradient-to-br from-primary-50 to-sky-100 dark:from-slate-900 dark:to-slate-800 border border-slate-100 dark:border-slate-800">
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.lng)} cy={y(p.lat)} r={6 + (p.count / maxCount) * 16} fill="#1d4ed8" fillOpacity="0.55" stroke="#1e40af" strokeWidth="1.5" />
            <text x={x(p.lng)} y={y(p.lat) - (8 + (p.count / maxCount) * 16)} textAnchor="middle" fontSize="9" fill="#0f172a" className="dark:fill-white">{p.count > 1 ? `${p.name} (${p.count})` : p.name}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Belum diproses': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    'Sedang diproses': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    'Perlu perbaikan': 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    'Lengkap': 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    'Disetujui': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    'Ditolak': 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    'Pendaftaran Baru': 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300',
  };
  return <span className={`badge ${map[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{status}</span>;
}
