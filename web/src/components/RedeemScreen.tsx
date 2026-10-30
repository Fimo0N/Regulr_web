import { useEffect, useState, type CSSProperties } from 'react';
import type { PublicStore } from '../api';

/** Live redemption screen: the ticking clock proves it isn't an old screenshot. */
export function RedeemScreen({ store, rewardName, redeemedAt, onDone }: { store: PublicStore; rewardName: string; redeemedAt: Date; onDone: () => void }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const secs = Math.max(0, Math.floor((now.getTime() - redeemedAt.getTime()) / 1000));
  const style = { '--brand-bg': store.bgColor, '--brand-fg': store.textColor } as CSSProperties;
  return (
    <div className="redeem-screen" style={style}>
      <div className="inner">
        <div className="check">✓</div>
        <div>Show this screen to the cashier</div>
        <div className="reward-name">{rewardName}</div>
        <div className="clock">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <div>
          Redeemed {secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`} ago at {store.name}
        </div>
        <div>
          <button className="btn" onClick={onDone}>Done</button>
        </div>
      </div>
    </div>
  );
}
