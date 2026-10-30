import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { authRouter } from './auth.js';
import { errorHandler } from './errors.js';
import { customerRouter } from './routes/customer.js';
import { portalRouter } from './routes/portal.js';
import { tapRouter } from './routes/tap.js';
import { UPLOADS_DIR } from './uploads.js';
import { artRouter } from './wallet/art.js';

const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');

const app = express();
const httpServer = createServer(app);
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use(tapRouter);
app.use(artRouter);
app.use('/api', authRouter);
app.use('/api', customerRouter);
app.use('/api/portal', portalRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use(errorHandler);

// The React app (web/). In development Vite runs inside this server, so the app,
// API and NFC links all share port 3000 (and the same tunnel URL).
if (config.isProd) {
  const dist = path.join(webDir, 'dist');
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    configFile: path.join(webDir, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

httpServer.listen(config.port, () => {
  console.log(`Regulr running on ${config.publicUrl} (port ${config.port})`);
  console.log(`  Google Sign-In: ${config.googleClientId ? 'on' : 'off'} | Dev login: ${config.devLogin ? 'on' : 'off'}`);
  console.log(`  Google Wallet: ${config.googleWallet ? 'on' : 'off (web card only)'} | NTAG 424 keys: ${config.sun.metaKey ? 'on' : 'off'}`);
});
