/**
 * SPMB Scanner Bridge — aplikasi lokal ringan yang menjembatani scanner
 * (TWAIN/WIA/SANE) dengan website SPMB.
 *
 * Cara kerja:
 * - Berjalan di komputer panitia, mendengar HANYA di 127.0.0.1:45454.
 * - Autentikasi token (SCANNER_BRIDGE_TOKEN, harus sama dengan Pengaturan
 *   Scanner di dashboard admin).
 * - Linux/macOS: memakai SANE via `scanimage`.
 * - Windows: memakai WIA melalui PowerShell (Windows Image Acquisition).
 * - Hasil scan dikembalikan sebagai base64 (JPG/PDF) lalu diunggah panitia
 *   melalui endpoint dokumen resmi website.
 */
const http = require('http');
const { execFile, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.BRIDGE_PORT || '45454', 10);
const TOKEN = process.env.SCANNER_BRIDGE_TOKEN || 'ubah-token-bridge-ini';
const IS_WINDOWS = os.platform() === 'win32';

function send(res, code, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Headers': 'Content-Type, X-Bridge-Token', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', ...headers });
  res.end(data);
}

function auth(req) {
  return req.headers['x-bridge-token'] === TOKEN;
}

function listDevicesLinux() {
  return new Promise((resolve, reject) => {
    execFile('scanimage', ['-L'], { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(new Error('scanimage tidak tersedia. Instal SANE (sane-utils).'));
      const devices = [];
      for (const line of String(stdout).split('\n')) {
        const m = line.match(/^device `([^']+)' is (\S+) (.*)/);
        if (m) devices.push({ id: m[1], name: m[3] || m[2] });
      }
      resolve(devices);
    });
  });
}

function scanLinux(device, dpi, mode, outFile) {
  return new Promise((resolve, reject) => {
    const args = ['-d', device, '--resolution', String(dpi), '--mode', mode === 'color' ? 'Color' : 'Gray', '--format', 'png', outFile];
    execFile('scanimage', args, { timeout: 120000 }, (err) => {
      if (err) return reject(new Error('Pemindaian gagal: ' + err.message));
      resolve();
    });
  });
}

function listDevicesWindows() {
  return new Promise((resolve, reject) => {
    const ps = `Get-WmiObject -Class Win32_PnPEntity | Where-Object { $_.Name -match 'scanner|scan' -and $_.PNPClass -eq 'Image' } | Select-Object -ExpandProperty Name`;
    spawn('powershell', ['-NoProfile', '-Command', ps], { timeout: 20000 })
      .on('close', (code) => code === 0 ? resolve([{ id: 'wia-default', name: 'Scanner WIA default' }]) : reject(new Error('Tidak dapat meng enumerasi scanner WIA')))
      .on('error', reject);
  });
}

function scanWindows(dpi, mode, outFile) {
  return new Promise((resolve, reject) => {
    // Memakai WIA melalui PowerShell COM
    const ps = `
$deviceManager = New-Object -ComObject WIA.DeviceManager;
$device = $deviceManager.DeviceInfos.Item(1).Connect();
$item = $device.Items.Item(1);
$item.Properties("6146").Value = ${mode === 'color' ? 1 : 2};
$item.Properties("6147").Value = ${dpi};
$item.Properties("6148").Value = ${dpi};
$image = $item.Transfer();
$jpg = New-Object -ComObject WIA.ImageFile;
$image.SaveFile("${outFile.replace(/\\/g, '\\\\')}");
Write-Output "OK"`;
    spawn('powershell', ['-NoProfile', '-Command', ps], { timeout: 120000 })
      .on('close', (code) => (code === 0 && fs.existsSync(outFile)) ? resolve() : reject(new Error('Pemindaian WIA gagal')))
      .on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const url = new URL(req.url, 'http://127.0.0.1');

  if (url.pathname === '/ping') {
    return send(res, 200, { ok: true, app: 'spmb-scanner-bridge', version: '1.0.0' });
  }
  if (!auth(req)) return send(res, 401, { error: 'Token bridge tidak valid.' });

  if (url.pathname === '/devices' && req.method === 'GET') {
    try {
      const devices = IS_WINDOWS ? await listDevicesWindows() : await listDevicesLinux();
      return send(res, 200, { devices });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  if (url.pathname === '/scan' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { device, dpi = 200, mode = 'color' } = JSON.parse(body || '{}');
        const tmp = path.join(os.tmpdir(), `spmb-scan-${Date.now()}.png`);
        if (IS_WINDOWS) await scanWindows(dpi, mode, tmp);
        else await scanLinux(device, dpi, mode, tmp);
        const b64 = fs.readFileSync(tmp).toString('base64');
        fs.unlinkSync(tmp);
        return send(res, 200, { ok: true, mime: 'image/png', data: b64 });
      } catch (e) {
        return send(res, 500, { error: e.message });
      }
    });
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SPMB Scanner Bridge berjalan di http://127.0.0.1:${PORT} (token wajib dikonfigurasi)`);
});
