import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { progressCaption, stampArtSvg, stampProgress, type ProgressReward } from '../../../shared/stampArt';

type Props = {
  name: string;
  logoUrl: string | null;
  coverUrl?: string | null;
  bgColor: string;
  textColor: string;
  balance: number;
  rewards: ProgressReward[];
  memberName?: string | null;
  compact?: boolean;
  balanceClassName?: string;
  /** Animate the "you are here" marker after a stamp. */
  pop?: boolean;
  children?: ReactNode;
};

/** The store's branded loyalty card, drawn like the Google Wallet card. */
export function StoreCard({ name, logoUrl, coverUrl, bgColor, textColor, balance, rewards, memberName, compact, balanceClassName, pop, children }: Props) {
  const style = { '--brand-bg': bgColor, '--brand-fg': textColor } as CSSProperties;
  const progress = stampProgress(rewards, balance);
  // The SVG holds only numbers, validated colours and an escaped photo URL (no shop-entered text), so it's safe to inject.
  const rewardKey = rewards.map((r) => `${r.cost}:${r.icon}`).join();
  const art = useMemo(
    () => progress && stampArtSvg({ bg: bgColor, fg: textColor, balance, rewards, photo: coverUrl, pop }),
    [bgColor, textColor, balance, rewardKey, coverUrl, pop, Boolean(progress)],
  );

  return (
    <div className={`wallet-card${compact ? ' compact' : ''}`} style={style}>
      <div className="top">
        {logoUrl ? <img className="logo" src={logoUrl} alt="" /> : <div className="logo" />}
        <div className="name">{name}</div>
        <div className="stat">
          <div className="label">Stamps</div>
          <div className={`balance ${balanceClassName ?? ''}`}>{balance}</div>
        </div>
      </div>

      {art && <div className="stamp-art" role="img" aria-label={progressCaption(progress)} dangerouslySetInnerHTML={{ __html: art }} />}

      {compact ? (
        progress && <div className="progress">{progressCaption(progress)}</div>
      ) : (
        <div className="fields">
          <div>
            <div className="label">Member</div>
            <div className="value">{memberName || '—'}</div>
          </div>
          {progress && (
            <div className="right">
              <div className="label">{progress.toGo > 0 ? 'Next reward' : 'Ready to claim'}</div>
              <div className="value">
                {progress.toGo > 0 ? `${progress.goal.name} · ${progress.toGo} to go` : progress.ready!.name}
              </div>
            </div>
          )}
        </div>
      )}

      {!compact && <div className="powered">Powered by Regulr</div>}
      {children}
    </div>
  );
}
