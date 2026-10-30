import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Uploaded files live on local disk for now. For production hosting, move these to
// object storage (S3, Cloudflare R2, Supabase Storage) so they survive redeploys.
export const UPLOADS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
export const LOGO_DIR = path.join(UPLOADS_DIR, 'logos');
export const COVER_DIR = path.join(UPLOADS_DIR, 'covers');
