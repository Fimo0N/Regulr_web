import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type Config, type PublicStore } from '../api';
import { useSession } from '../session';
import { SignIn } from '../components/SignIn';
import { StoreCard } from '../components/StoreCard';
import { StoreInfo } from '../components/StoreInfo';
import { RedeemScreen } from '../components/RedeemScreen';

type Notice = { kind: 'good' | 'info' | 'bad'; text: string } | null;
type WalletState = 'idle' | 'syncing' | 'updated';
type TapResult = { stamped?: boolean; reason?: string; nextStampAt?: string; expiresAt?: string; error?: string };
type OpenResponse = {
  config: Config;
  store: PublicStore;
  user: { name: string | null; email: string } | null;
  joined?: boolean;
  tap?: TapResult | null;
  membership?: { balance: number; inWallet: boolean };
};
type HistoryEvent = { id: string; kind: string; delta: number; rewardName: string | null; createdAt: string };

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

function readTipDismissed() {
  try {
    return Boolean(localStorage.getItem('regulr_tip_always'));
  } catch {
    return true;
  }
}

export function CardPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();

  // The tap id is read once and dropped from the URL, so reloading or the browser
  // history can't be used to come back to it later.
  const tapRef = useRef<string | null>(params.get('tap'));
  const tapErrorRef = useRef(params.has('tap_error'));
  const cameFromTap = useRef(Boolean(tapRef.current));
  const opened = useRef(false);

  const [data, setData] = useState<OpenResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [inWallet, setInWallet] = useState(false);
  const [tapExpiresAt, setTapExpiresAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [walletState, setWalletState] = useState<WalletState>('idle');
  const [burst, setBurst] = useState<number | null>(null);
  const [bump, setBump] = useState(false);
  const [pop, setPop] = useState(false);
  const [redemption, setRedemption] = useState<{ name: string; at: Date } | null>(null);
  const [tipDismissed, setTipDismissed] = useState(readTipDismissed);
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (params.has('tap') || params.has('tap_error')) navigate(`/s/${slug}`, { replace: true });
  }, [params, navigate, slug]);

  const syncWallet = useCallback(async () => {
    setWalletState('syncing');
    try {
      const { updated, saved } = await api<{ updated: boolean; saved: boolean }>(`/api/stores/${slug}/wallet/sync`, { method: 'POST' });
      setWalletState(updated ? 'updated' : 'idle');
      if (!saved) setInWallet(false);
    } catch {
      setWalletState('idle');
    }
  }, [slug]);

  // (No vibration: browsers block it on a page opened by an NFC tap, since there's been no touch yet.)
  const celebrate = useCallback((from: number, to: number) => {
    setBurst(to - from);
    setTimeout(() => setBurst(null), reducedMotion ? 1500 : 2200);
    if (reducedMotion) return;
    setBalance(from);
    setBump(true);
    setTimeout(() => {
      setBalance(to);
      setPop(true);
    }, 450);
    setTimeout(() => {
      setBump(false);
      setPop(false);
    }, 1400);
  }, []);

  const open = useCallback(async () => {
    let res: OpenResponse;
    try {
      res = await api<OpenResponse>(`/api/stores/${encodeURIComponent(slug)}/open`, {
        method: 'POST',
        body: { tapId: tapRef.current ?? undefined },
      });
    } catch {
      setMissing(true);
      return;
    }
    setData(res);
    if (!res.user || !res.membership) return;

    const finalBalance = res.membership.balance;
    setBalance(finalBalance);
    setInWallet(res.membership.inWallet);

    let next: Notice = null;
    if (res.joined) {
      const n = res.store.welcomeStamps;
      next = { kind: 'good', text: `Welcome to ${res.store.name} Rewards!${n ? ` You've got your first ${n === 1 ? 'stamp' : `${n} stamps`}.` : ''}` };
    }
    const tap = res.tap;
    if (tap?.error) {
      tapRef.current = null;
      next = { kind: 'bad', text: tap.error === 'tap_expired' ? 'That tap expired. Ask the cashier to tap again.' : 'That tap was already used.' };
    } else if (tap?.expiresAt) {
      const expires = new Date(tap.expiresAt);
      setTapExpiresAt(expires);
      // Re-render when the tap window closes so the Claim buttons lock again.
      setTimeout(() => forceTick((n) => n + 1), expires.getTime() - Date.now() + 500);
      if (!tap.stamped && !res.joined && tap.reason === 'cooldown' && tap.nextStampAt) {
        const at = new Date(tap.nextStampAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        next = { kind: 'info', text: `You got a stamp recently. The next one is available from ${at}.` };
      }
    }
    if (tapErrorRef.current) next = { kind: 'bad', text: "That tap couldn't be verified. Ask the cashier to tap again." };
    setNotice(next);

    if (tap?.stamped) {
      celebrate(finalBalance - 1, finalBalance);
      if (res.membership.inWallet && res.config.googleWallet) syncWallet();
    }
  }, [slug, celebrate, syncWallet]);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open();
  }, [open]);

  async function onSignedIn() {
    await session.refresh();
    await open();
  }

  async function addToWallet() {
    try {
      const { url } = await api<{ url: string }>(`/api/stores/${slug}/wallet/google`);
      location.href = url;
    } catch {
      setNotice({ kind: 'bad', text: 'Could not create your Google Wallet card. Please try again.' });
    }
  }

  async function claimReward(rewardId: string) {
    const reward = data!.store.rewards.find((r) => r.id === rewardId)!;
    if (!confirm(`Claim "${reward.name}" for ${reward.cost} stamps?\n\nOnly confirm in front of the cashier.`)) return;
    try {
      const result = await api<{ membership: { balance: number }; reward: { name: string }; redeemedAt: string }>(
        `/api/stores/${slug}/redeem`,
        { method: 'POST', body: { rewardId, tapId: tapRef.current } },
      );
      setBalance(result.membership.balance);
      tapRef.current = null; // one reward per tap
      setNotice(null);
      setHistory(null);
      setRedemption({ name: result.reward.name, at: new Date(result.redeemedAt) });
      if (inWallet) syncWallet();
    } catch (err: any) {
      const messages: Record<string, string> = {
        not_enough_stamps: "You don't have enough stamps for that yet.",
        tap_required: 'Ask the cashier to tap their card, then claim again.',
        tap_already_used_for_reward: 'That tap was already used for a reward. Ask for another tap.',
      };
      setNotice({ kind: 'bad', text: messages[err?.code] ?? 'Something went wrong. Please try again.' });
    }
  }

  async function loadHistory() {
    const { events } = await api<{ events: HistoryEvent[] }>(`/api/stores/${slug}/history`);
    setHistory(events);
  }

  if (missing) {
    return (
      <div className="page">
        <p className="muted">This rewards card doesn't exist.</p>
        <Link to="/discover">Find stores near you</Link>
      </div>
    );
  }
  if (!data) return <div className="page"><p className="muted">Loading…</p></div>;

  const { store, config } = data;
  const canRedeem = Boolean(tapRef.current && tapExpiresAt && tapExpiresAt > new Date());

  if (!data.user) {
    return (
      <div className="page">
        <StoreCard name={store.name} logoUrl={store.logoUrl} coverUrl={store.coverUrl} bgColor={store.bgColor} textColor={store.textColor} balance={0} rewards={store.rewards} compact />
        <h2 className="section-title big">Join {store.name} Rewards</h2>
        <p className="muted">Collect stamps every visit and spend them on the reward menu. No app needed.</p>
        <SignIn config={config} onSignedIn={onSignedIn} />
        <StoreInfo store={store} />
      </div>
    );
  }

  return (
    <div className="page">
      <StoreCard
        name={store.name}
        logoUrl={store.logoUrl}
        coverUrl={store.coverUrl}
        bgColor={store.bgColor}
        textColor={store.textColor}
        balance={balance}
        rewards={store.rewards}
        memberName={data.user.name || data.user.email}
        balanceClassName={bump ? 'bump' : ''}
        pop={pop}
      >
        {burst !== null && (
          <div className="stamp-burst">
            <span>+{burst} ⭑</span>
          </div>
        )}
      </StoreCard>

      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

      {config.googleWallet && (
        <>
          {walletState === 'syncing' && <div className="wallet-status">Updating your Google Wallet card…</div>}
          {walletState === 'updated' && <div className="wallet-status ok">✓ Google Wallet card updated. No need to open it.</div>}
          {/* Always offered: we only know a card was created, not that it's still in the wallet.
              Google's save link opens the card if it's there and adds it back if it was removed. */}
          <div className="actions">
            <button className={`btn${inWallet ? ' secondary' : ''}`} onClick={addToWallet}>
              {inWallet ? 'Open in Google Wallet' : 'Add to Google Wallet'}
            </button>
          </div>
        </>
      )}

      {cameFromTap.current && isAndroid && !tipDismissed && (
        <div className="notice info tip">
          <div>
            Tip: if your phone asked which app to open this with, pick your browser and tap <strong>Always</strong>. Next time the tap opens
            straight away.
          </div>
          <button
            className="btn secondary small-btn"
            onClick={() => {
              try {
                localStorage.setItem('regulr_tip_always', '1');
              } catch {}
              setTipDismissed(true);
            }}
          >
            Got it
          </button>
        </div>
      )}

      <h3 className="section-title">Reward menu</h3>
      <div className="rewards">
        {store.rewards.length === 0 && <p className="muted">No rewards yet.</p>}
        {store.rewards.map((r) => {
          const missingStamps = r.cost - balance;
          return (
            <div className="reward" key={r.id}>
              <div className="info">
                <div><strong>{r.name}</strong></div>
                {r.description && <div className="hint">{r.description}</div>}
              </div>
              <div className="cost">{r.cost} ⭑</div>
              {missingStamps > 0 ? (
                <span className="hint">Collect {missingStamps} more</span>
              ) : canRedeem ? (
                <button className="btn brand" style={{ background: store.bgColor, color: store.textColor }} onClick={() => claimReward(r.id)}>
                  Claim
                </button>
              ) : (
                <span className="hint">Tap the cashier's card to claim</span>
              )}
            </div>
          );
        })}
      </div>

      <StoreInfo store={store} />

      <h3 className="section-title">Your history</h3>
      {history === null ? (
        <button className="btn secondary" onClick={loadHistory}>Show history</button>
      ) : history.length === 0 ? (
        <p className="muted">Nothing yet.</p>
      ) : (
        <ul className="history">
          {history.map((e) => (
            <li key={e.id}>
              <span>{e.kind === 'redeem' ? `Claimed ${e.rewardName}` : e.kind === 'welcome' ? 'Joined' : e.kind === 'adjust' ? 'Adjusted by the shop' : 'Stamp'}</span>
              <span className="muted small">{new Date(e.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span className={e.delta >= 0 ? 'plus' : 'minus'}>
                {e.delta >= 0 ? '+' : ''}
                {e.delta}
              </span>
            </li>
          ))}
        </ul>
      )}

      {redemption && <RedeemScreen store={store} rewardName={redemption.name} redeemedAt={redemption.at} onDone={() => setRedemption(null)} />}
    </div>
  );
}
