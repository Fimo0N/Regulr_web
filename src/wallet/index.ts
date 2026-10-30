import type { Membership, Store } from '@prisma/client';
import { progressCaption, stampProgress, type ProgressReward } from '../../shared/stampArt.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { GoogleWalletProvider } from './google.js';
import type { WalletProvider } from './types.js';

export const googleWallet = config.googleWallet ? new GoogleWalletProvider(config.googleWallet) : null;
// When Apple Wallet is added, append its provider here.
const providers: WalletProvider[] = [googleWallet].filter((p): p is GoogleWalletProvider => p !== null);

export function syncStoreCard(store: Store) {
  for (const provider of providers) {
    provider.upsertStoreCard(store).catch((err) => console.error(`[${provider.name}-wallet] card sync failed`, err));
  }
}

export async function removeCards(memberships: Membership[]) {
  for (const m of memberships) {
    if (googleWallet && m.googleObjectId) {
      await googleWallet.removeCard(m).catch((err) => console.error('[google-wallet] card removal failed', err));
    }
  }
}

/** What just happened, so the card can tell the customer about it. */
export type BalanceEvent =
  | { kind: 'stamp'; added: number }
  | { kind: 'redeem'; rewardName: string; cost: number }
  | { kind: 'adjust'; added: number; note: string | null };

/** The phone notification for a stamp, a claimed reward or a manual adjustment by the shop. */
export function notificationFor(storeName: string, rewards: ProgressReward[], balance: number, event: BalanceEvent) {
  const next = progressCaption(stampProgress(rewards, balance));
  if (event.kind === 'redeem') {
    return { header: `Enjoy your ${event.rewardName}!`, body: `You used ${event.cost} stamps at ${storeName}. ${balance} left.` };
  }
  if (event.kind === 'adjust' && event.added < 0) {
    const n = -event.added;
    return { header: `${storeName} updated your card`, body: `${n} stamp${n === 1 ? '' : 's'} removed${event.note ? `: ${event.note}` : ''}. ${balance} left.` };
  }
  // A reward the customer couldn't afford before this stamp, but can now.
  const before = balance - event.added;
  const unlocked = rewards.filter((r) => r.cost > before && r.cost <= balance).sort((a, b) => b.cost - a.cost)[0];
  if (unlocked) {
    return { header: `${unlocked.name} is ready!`, body: `Show your ${storeName} card at the counter to claim it.` };
  }
  const plural = event.added === 1 ? 'stamp' : 'stamps';
  if (event.kind === 'adjust') {
    return { header: `+${event.added} ${plural} from ${storeName}`, body: event.note || (next ? `${next}.` : `You have ${balance} stamps.`) };
  }
  return { header: `+${event.added} ${plural} at ${storeName}`, body: next ? `${next}.` : `You have ${balance} stamps.` };
}

// Fire-and-forget: a wallet outage must never block stamping at the counter.
export function syncBalance(membershipId: string, event?: BalanceEvent) {
  void (async () => {
    const membership = await prisma.membership.findUnique({ where: { id: membershipId }, include: { store: true } });
    if (!membership) return;
    if (googleWallet && membership.googleObjectId) {
      const saved = await googleWallet.updateBalance(membership.store, membership);
      // Only cards actually in a wallet can show a notification.
      if (saved && event) {
        const rewards = await prisma.reward.findMany({ where: { storeId: membership.storeId, active: true }, select: { name: true, cost: true } });
        const { header, body } = notificationFor(membership.store.name, rewards, membership.balance, event);
        await googleWallet.notify(membership, header, body);
      }
    }
  })().catch((err) => console.error('[wallet] balance sync failed', err));
}
