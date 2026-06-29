import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './lib/env.js';
import { telegramRouter } from './routes/telegram.js';
import { quotesRouter } from './routes/quotes.js';
import { contractorsRouter } from './routes/contractors.js';
import { testRouter } from './routes/test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api', telegramRouter);
app.use('/api', quotesRouter);
app.use('/api', contractorsRouter);
app.use('/api', testRouter);

// 404 for unknown /api/*
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// Static frontend (built into ../../web/dist)
const frontendDist = path.join(__dirname, '../../web/dist');
app.use(express.static(frontendDist));

// SPA fallback: any non-API GET returns index.html so React handles routing.
app.get(/^(?!\/api\/).*/, (_req, res, next) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next(err);
  });
});

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[error]', err);
  if (err && !res.headersSent) {
    res.status(500).json({ error: err?.message || 'internal_error' });
  }
});

app.listen(env.PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT}`);
  console.log(`[backend] webhook:    POST /api/webhooks/telegram`);
  console.log(`[backend] simulate:   POST /api/test/simulate-voice`);
  console.log(`[backend] health:     GET  /api/health`);
  console.log(`[backend] serving frontend from ${frontendDist}`);
  console.log(`[backend] public URL: ${env.WEB_BASE_URL}`);
});
