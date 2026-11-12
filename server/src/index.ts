import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { config } from './config';
import { rateLimit } from './middleware/rateLimit';
import { notifyStatus } from './services/notify';
import { otpConfigured } from './services/otp';

async function main() {
  await db.init();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','), credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use((req: any, _res, next) => {
    req.cookies = {};
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const idx = part.indexOf('=');
      if (idx > 0) req.cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, app: 'SPMB SMK BHINA KARYA KARANGANYAR', ta: config.ta, db: db.primaryName, time: new Date().toISOString() });
  });

  app.use('/api/public', rateLimit({ windowMs: 60000, max: 300, key: 'public' }), require('./routes/public').default);
  app.use('/api/auth', require('./routes/auth').default);
  app.use('/api/applicants', require('./routes/applicants').default);
  app.use('/api/documents', require('./routes/documents').default);
  app.use('/api/assessment', require('./routes/assessment').default);
  app.use('/api/payments', require('./routes/payments').default);
  app.use('/api/dashboard', require('./routes/dashboard').default);
  app.use('/api/admin', require('./routes/admin').default);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

  // Penyajian build frontend produksi (client/dist) + fallback SPA
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1d', index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.includes('.')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[error]', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: `Ukuran file maksimal ${config.maxFileSizeMB} MB.` });
      return;
    }
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  });

  setInterval(() => {
    db.reconcile().then(r => { if (r.retried) console.log(`[sync] reconcile: ${r.success}/${r.retried} berhasil`); }).catch(() => undefined);
  }, 5 * 60000);

  const status = notifyStatus();
  console.log(`[notify] whatsapp=${status.whatsapp ? 'aktif' : 'belum dikonfigurasi'}, email=${status.email ? 'aktif' : 'belum dikonfigurasi'}, otp=${otpConfigured() ? 'aktif' : 'mode PIN'}`);

  app.listen(config.port, () => {
    console.log(`SPMB server berjalan di http://localhost:${config.port} (TA ${config.ta}, DB: ${db.primaryName})`);
  });
}

main().catch(e => {
  console.error('Gagal memulai server:', e);
  process.exit(1);
});
