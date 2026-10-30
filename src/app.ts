import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth.js';
import { errorHandler } from './errors.js';
import { customerRouter } from './routes/customer.js';
import { portalRouter } from './routes/portal.js';
import { tapRouter } from './routes/tap.js';
import { UPLOADS_DIR } from './uploads.js';
import { artRouter } from './wallet/art.js';

// The API, NFC tap links and Wallet pictures. On Vercel this is the whole server
// (api/index.js); locally src/server.ts adds the React app and listens on a port.
export const app = express();
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
// Only used without Vercel Blob (local development): uploads are on disk.
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use(errorHandler);

export default app;
