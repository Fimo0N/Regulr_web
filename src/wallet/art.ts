import { createHash } from 'node:crypto';
import type { Store } from '@prisma/client';
import { Resvg } from '@resvg/resvg-js';
import { Router } from 'express';
import { stampArtSvg } from '../../shared/stampArt.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { readUpload } from '../uploads.js';

// The Google Wallet hero image: the store's reward ladder at one balance.
//   /wallet-art/<storeId>/<balance>-<design>.png
// <design> is a hash of everything else the picture shows (photo, colours, reward icons
// and costs), so the URL changes whenever the picture would. Google caches images by URL.

type ArtReward = { cost: number; icon: string };

function designHash(store: Pick<Store, 'coverUrl' | 'bgColor' | 'textColor'>, rewards: ArtReward[]) {
  const key = JSON.stringify([store.coverUrl, store.bgColor, store.textColor, rewards.map((r) => [r.cost, r.icon])]);
  return createHash('sha1').update(key).digest('hex').slice(0, 10);
}

export function artUrl(store: Store, rewards: ArtReward[], balance: number) {
  return `${config.publicUrl}/wallet-art/${store.id}/${balance}-${designHash(store, rewards)}.png`;
}

/** The uploaded cover photo as a data: URI, since the PNG renderer can't fetch URLs. */
async function coverDataUri(coverUrl: string | null) {
  const image = await readUpload(coverUrl);
  return image && `data:${image.type};base64,${image.bytes.toString('base64')}`;
}

// Small in-memory cache: the same few pictures are requested over and over.
const cache = new Map<string, Buffer>();
const CACHE_SIZE = 100;

export const artRouter = Router();

artRouter.get('/wallet-art/:storeId/:file', async (req, res) => {
  const m = /^(\d{1,6})-[0-9a-f]{10}\.png$/.exec(String(req.params.file));
  const store = m ? await prisma.store.findUnique({ where: { id: String(req.params.storeId) } }) : null;
  if (!m || !store) {
    res.status(404).end();
    return;
  }
  const balance = Number(m[1]);
  const rewards = await prisma.reward.findMany({ where: { storeId: store.id, active: true }, select: { name: true, cost: true, icon: true } });
  // Always draw the current design; an old URL just gets the newest look.
  const key = `${store.id}/${balance}-${designHash(store, rewards)}`;
  let png = cache.get(key);
  if (!png) {
    const svg = stampArtSvg({ bg: store.bgColor, fg: store.textColor, balance, rewards, photo: await coverDataUri(store.coverUrl) });
    png = new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(key, png);
  }
  res.set('Cache-Control', 'public, max-age=86400').type('png').send(png);
});
