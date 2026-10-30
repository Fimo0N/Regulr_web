import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';

// Uploaded images (logos, cover photos).
// - On Vercel: Vercel Blob (set BLOB_READ_WRITE_TOKEN by connecting a Blob store). The
//   server's own disk is wiped between requests there, so files can't live on it.
// - Locally without a token: the uploads/ folder, served at /uploads.
export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Stores an image and returns the URL to save on the store: https://… (Blob) or /uploads/… (disk). */
export async function saveUpload(folder: 'logos' | 'covers', name: string, body: Buffer, contentType: string) {
  if (useBlob) {
    const blob = await put(`${folder}/${name}`, body, { access: 'public', contentType, addRandomSuffix: false });
    return blob.url;
  }
  await mkdir(path.join(UPLOADS_DIR, folder), { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, folder, name), body);
  return `/uploads/${folder}/${name}`;
}

/** Reads back an image saved by saveUpload, e.g. to draw it into the Wallet picture. */
export async function readUpload(url: string | null): Promise<{ bytes: Buffer; type: string } | null> {
  if (!url) return null;
  const type = url.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  try {
    if (url.startsWith('/uploads/')) {
      const [, , folder, file] = url.split('/');
      return { bytes: await readFile(path.join(UPLOADS_DIR, path.basename(folder), path.basename(file))), type };
    }
    if (url.startsWith('https://')) {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      return { bytes: Buffer.from(await res.arrayBuffer()), type };
    }
  } catch {
    // Missing file or slow storage: draw the card without the photo.
  }
  return null;
}
