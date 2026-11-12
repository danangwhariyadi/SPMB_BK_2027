import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { Spinner, TableWrap, Td, Th, EmptyRow } from './shared';

const DOC_LABELS: Record<string, string> = {
  kk: 'Fotokopi Kartu Keluarga (KK)', akta: 'Akta Kelahiran', transkrip: 'Surat Keterangan Nilai/Transkrip Nilai',
  ijazah: 'Ijazah', nisn: 'Kartu NISN', foto: 'Foto Hitam Putih 3x4 (6 lembar)', tka: 'Surat Keterangan Nilai TKA',
};

const SOURCE_LABELS: Record<string, string> = { scanner: '🖨 Scanner', upload: '💻 Upload Komputer', kamera: '📷 Kamera' };

interface BridgeDevice { name: string }

export default function Dokumen() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canCreate = can('dokumen', 'can_create');
  const canDelete = can('dokumen', 'can_delete');

  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [applicant, setApplicant] = useState<any>(null);
  const [docs, setDocs] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Scanner bridge state
  const [bridgeUrl, setBridgeUrl] = useState(() => localStorage.getItem('spmb_bridge_url') || 'http://127.0.0.1:45454');
  const [bridgeToken, setBridgeToken] = useState(() => localStorage.getItem('spmb_bridge_token') || '');
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<BridgeDevice[]>([]);
  const [device, setDevice] = useState('');
  const [dpi, setDpi] = useState('200');
  const [mode, setMode] = useState('color');
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanDocType, setScanDocType] = useState('kk');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraDocType, setCameraDocType] = useState('foto');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    api.get('/api/admin/settings').then(d => {
      if (d.settings?.scanner_bridge_url) setBridgeUrl(d.settings.scanner_bridge_url);
      if (d.settings?.scanner_bridge_token) setBridgeToken(d.settings.scanner_bridge_token);
    }).catch(() => undefined);
  }, []);

  useEffect(() => { localStorage.setItem('spmb_bridge_url', bridgeUrl); }, [bridgeUrl]);
  useEffect(() => { if (bridgeToken) localStorage.setItem('spmb_bridge_token', bridgeToken); }, [bridgeToken]);

  const pingBridge = useCallback(async () => {
    setBridgeOk(null);
    try {
      const r = await fetch(`${bridgeUrl}/ping`);
      setBridgeOk(r.ok);
      if (r.ok) {
        const dr = await fetch(`${bridgeUrl}/devices`, { headers: { 'x-bridge-token': bridgeToken } });
        if (dr.ok) {
          const d = await dr.json();
          setDevices(d.devices || []);
          if (d.devices?.[0]) setDevice((prev: string) => prev || d.devices[0].name);
        } else if (dr.status === 401) {
          toast('error', 'Token scanner bridge salah. Periksa Pengaturan Sistem.');
        }
      }
    } catch { setBridgeOk(false); }
  }, [bridgeUrl, bridgeToken]);

  useEffect(() => { if (applicant) pingBridge(); }, [applicant, pingBridge]);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/applicants?q=${encodeURIComponent(q)}&limit=8`).then(d => setResults(d.rows || [])).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const loadDocs = useCallback((applicantId: number) => {
    setLoading(true);
    api.get(`/api/documents/applicant/${applicantId}`)
      .then(setDocs)
      .catch(e => { toast('error', e.message); setDocs(null); })
      .finally(() => setLoading(false));
  }, []);

  const upload = async (docType: string, file: File | null, status: 'Ada' | 'Belum Ada', source: string) => {
    if (!applicant) return;
    if (status === 'Ada' && !file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('doc_type', docType);
    fd.append('status', status);
    fd.append('applicant_id', String(applicant.id));
    fd.append('source', source);
    if (file) fd.append('file', file);
    try {
      await api.upload('/api/documents/upload', fd);
      toast('success', `Dokumen ${DOC_LABELS[docType]} diperbarui (sumber: ${source}).`);
      loadDocs(applicant.id);
    } catch (e: any) { toast('error', e.message); }
    finally { setBusy(false); }
  };

  const delDoc = async (docId: number) => {
    if (!confirm('Hapus dokumen ini?')) return;
    try { await api.del(`/api/documents/${docId}`); toast('success', 'Dokumen dihapus.'); if (applicant) loadDocs(applicant.id); }
    catch (e: any) { toast('error', e.message); }
  };

  const doScan = async () => {
    if (!device) { toast('error', 'Pilih perangkat scanner terlebih dahulu.'); return; }
    setScanning(true);
    setScanPreview(null);
    try {
      const r = await fetch(`${bridgeUrl}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bridge-token': bridgeToken },
        body: JSON.stringify({ device, dpi: Number(dpi), mode }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Pemindaian gagal.');
      const d = await r.json();
      setScanPreview(`data:${d.mime || 'image/png'};base64,${d.image}`);
      toast('success', 'Pemindaian selesai. Periksa preview lalu simpan.');
    } catch (e: any) {
      toast('error', e.message || 'Scanner bridge tidak dapat dihubungi.');
    } finally { setScanning(false); }
  };

  const rotatePreview = () => {
    if (!scanPreview) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.height; c.height = img.width;
      const ctx = c.getContext('2d')!;
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      setScanPreview(c.toDataURL('image/png'));
    };
    img.src = scanPreview;
  };

  const saveScan = async (asPdf = false) => {
    if (!scanPreview) return;
    const blob = await (await fetch(scanPreview)).blob();
    const ext = asPdf ? 'pdf' : (mode === 'grayscale' ? 'jpg' : 'png');
    let file: File;
    if (asPdf || ext === 'jpg') {
      const img = new Image();
      await new Promise(res => { img.onload = res; img.src = scanPreview; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d')!.drawImage(img, 0, 0);
      const outBlob = await new Promise<Blob | null>(res => c.toBlob(res, ext === 'pdf' ? 'image/png' : 'image/jpeg', 0.92));
      file = new File([outBlob || blob], `scan-${Date.now()}.${ext === 'pdf' ? 'png' : 'jpg'}`, { type: ext === 'pdf' ? 'image/png' : 'image/jpeg' });
      if (asPdf) {
        toast('info', 'Hasil scan disimpan sebagai gambar (JPG). Gunakan opsi "Simpan JPG".');
      }
    } else {
      file = new File([blob], `scan-${Date.now()}.png`, { type: 'image/png' });
    }
    await upload(scanDocType, file, 'Ada', 'scanner');
    setScanPreview(null);
  };

  const openCamera = async () => {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch { toast('error', 'Kamera tidak dapat diakses.'); setCameraOpen(false); }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const capture = async () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) return;
    const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' });
    closeCamera();
    await upload(cameraDocType, file, 'Ada', 'kamera');
  };

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold text-primary-800 dark:text-primary-300 mb-1">Dokumen Pendaftar</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Upload manual, kamera, atau pindai langsung lewat scanner bridge.</p>

      <div className="card p-4 mb-4">
        {applicant ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm"><b>{applicant.registration_number}</b> — {applicant.nama_lengkap} · {applicant.program_keahlian}</span>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setApplicant(null); setDocs(null); }}>Ganti Pendaftar</button>
          </div>
        ) : (
          <>
            <input className="input" placeholder="Cari pendaftar (nomor / nama)…" value={q} onChange={e => setQ(e.target.value)} />
            {results.length > 0 && (
              <div className="mt-2 border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                {results.map(r => (
                  <button key={r.id} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => { setApplicant(r); setQ(''); setResults([]); loadDocs(r.id); }}>
                    <b>{r.registration_number}</b> — {r.nama_lengkap}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {applicant && loading ? <Spinner /> : applicant && docs && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold mb-3 text-sm">Daftar Dokumen</h3>
            <TableWrap>
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr><Th>Jenis Dokumen</Th><Th>Status</Th><Th>Sumber</Th><Th>File</Th><Th>Ukuran</Th><Th>Preview</Th><Th>Aksi</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {Object.entries(docs.types as Record<string, string>).map(([k, label]) => {
                  const d = (docs.documents || []).find((x: any) => x.doc_type === k);
                  return (
                    <tr key={k}>
                      <Td className="font-medium">{label}</Td>
                      <Td><span className={`badge ${d?.status === 'Ada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{d?.status || 'Belum Ada'}</span></Td>
                      <Td>{d?.source ? (SOURCE_LABELS[d.source] || d.source) : '-'}</Td>
                      <Td className="max-w-[160px] truncate text-xs text-slate-400">{d?.file_name || '-'}</Td>
                      <Td>{d?.file_size ? `${(d.file_size / 1024).toFixed(0)} KB` : '-'}</Td>
                      <Td>{d?.url ? <a className="text-primary-600 dark:text-primary-400 text-xs font-semibold" href={d.url} target="_blank" rel="noreferrer">Lihat</a> : '-'}</Td>
                      <Td>
                        {canCreate ? (
                          <div className="flex flex-wrap gap-1">
                            <label className="text-xs btn-ghost px-2 py-1 cursor-pointer">
                              💻 Upload
                              <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                                onChange={e => upload(k, e.target.files?.[0] || null, 'Ada', 'upload')} />
                            </label>
                            <button className="text-xs btn-ghost px-2 py-1" onClick={() => { setCameraDocType(k); openCamera(); }}>📷 Kamera</button>
                            {canDelete && d && <button className="text-xs btn-ghost px-2 py-1 text-accent-500" onClick={() => delDoc(d.id)}>Hapus</button>}
                          </div>
                        ) : '-'}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            {docs.missing?.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">Kekurangan: {docs.missing.map((m: string) => DOC_LABELS[m] || m).join(', ')}</p>
            )}
          </div>

          {canCreate && (
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="font-bold text-sm">🖨 Scan Dokumen (Scanner Bridge)</h3>
                <span className={`badge ${bridgeOk === null ? 'bg-slate-100 text-slate-500' : bridgeOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {bridgeOk === null ? 'Memeriksa bridge…' : bridgeOk ? 'Bridge terhubung' : 'Bridge tidak terjangkau'}
                </span>
              </div>
              {bridgeOk === false && (
                <div className="text-sm text-slate-500 dark:text-slate-400 space-y-2 mb-3">
                  <p>Scanner bridge tidak terdeteksi di <code className="text-xs">{bridgeUrl}</code>. Jalankan aplikasi bridge lokal di komputer panitia:</p>
                  <pre className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-xs overflow-x-auto">cd scanner-bridge &amp;&amp; npm install &amp;&amp; npm start</pre>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input className="input !w-64" value={bridgeUrl} onChange={e => setBridgeUrl(e.target.value)} placeholder="URL bridge" />
                    <input className="input !w-56" value={bridgeToken} onChange={e => setBridgeToken(e.target.value)} placeholder="Token bridge" type="password" />
                    <button className="btn-ghost text-xs" onClick={pingBridge}>Coba Lagi</button>
                  </div>
                  <p className="text-xs">Mode upload manual, kamera, dan drag-drop tetap dapat digunakan.</p>
                </div>
              )}
              {bridgeOk && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="label">Perangkat</label>
                    <select className="input" value={device} onChange={e => setDevice(e.target.value)}>
                      {devices.length === 0 ? <option value="">Tidak ada scanner terdeteksi</option> :
                        devices.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Resolusi</label>
                    <select className="input" value={dpi} onChange={e => setDpi(e.target.value)}>
                      <option value="150">150 DPI</option><option value="200">200 DPI</option><option value="300">300 DPI</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Mode Warna</label>
                    <select className="input" value={mode} onChange={e => setMode(e.target.value)}>
                      <option value="color">Warna</option><option value="grayscale">Grayscale</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Simpan Sebagai</label>
                    <select className="input" value={scanDocType} onChange={e => setScanDocType(e.target.value)}>
                      {Object.entries(DOC_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {bridgeOk && (
                <div className="flex gap-2 mt-3">
                  <button className="btn-primary" disabled={scanning} onClick={doScan}>{scanning ? 'Memindai…' : 'Mulai Pindai'}</button>
                  <button className="btn-ghost text-xs" onClick={pingBridge}>Deteksi Ulang Perangkat</button>
                </div>
              )}
              {scanPreview && (
                <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                  <img src={scanPreview} alt="Preview scan" className="max-h-80 rounded-lg mx-auto" />
                  <div className="flex flex-wrap gap-2 justify-center mt-3">
                    <button className="btn-ghost text-xs" onClick={rotatePreview}>↻ Putar 90°</button>
                    <button className="btn-primary text-xs" disabled={busy} onClick={() => saveScan(false)}>Simpan sebagai JPG/PNG</button>
                    <button className="btn-ghost text-xs" onClick={() => setScanPreview(null)}>Buang</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
          <video ref={videoRef} className="max-h-[70vh] rounded-xl" playsInline muted />
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={capture}>Ambil Foto</button>
            <button className="btn-ghost" onClick={closeCamera}>Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
