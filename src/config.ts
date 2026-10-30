import 'dotenv/config';
import { readFileSync } from 'node:fs';

const isProd = process.env.NODE_ENV === 'production';

function hexKey(name: string): Buffer | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  if (!/^[0-9a-fA-F]{32}$/.test(value)) throw new Error(`${name} must be 32 hex characters (AES-128 key)`);
  return Buffer.from(value, 'hex');
}

function googleWalletConfig() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const keyFile = process.env.GOOGLE_WALLET_KEY_FILE?.trim();
  if (!issuerId || !keyFile) return null;
  const key = JSON.parse(readFileSync(keyFile, 'utf8')) as { client_email: string; private_key: string };
  return { issuerId, clientEmail: key.client_email, privateKey: key.private_key };
}

const sessionSecret = process.env.SESSION_SECRET || (isProd ? '' : 'dev-only-session-secret');
if (!sessionSecret) throw new Error('SESSION_SECRET is required in production');

const devLogin = process.env.DEV_LOGIN === 'true';
if (devLogin && isProd) throw new Error('DEV_LOGIN must not be enabled in production');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  isProd,
  sessionSecret,
  devLogin,
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? '',
  googleWallet: googleWalletConfig(),
  sun: { metaKey: hexKey('SUN_META_KEY'), masterKey: hexKey('SUN_MASTER_KEY') },
  // How long a tap keeps the reward menu unlocked.
  tapSessionMinutes: 5,
};
