import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { app } from './app.js';
import { config } from './config.js';
import { useBlob } from './uploads.js';

// Runs Regulr as one long-lived server: `npm run dev` locally, or `npm start` on any
// Node host. (Vercel doesn't use this file; it runs src/app.ts through api/index.js.)

const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const httpServer = createServer(app);

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
  console.log(`  Uploads: ${useBlob ? 'Vercel Blob' : 'local uploads/ folder'}`);
});
