import { useEffect, useState } from 'react';
import { api, type OwnerStore } from '../../api';
import { BarChart } from '../../components/BarChart';
import { ActivityTab } from './ActivityTab';

type Stats = {
  days: number;
  totals: {
    visits: number;
    prevVisits: number;
    redemptions: number;
    prevRedemptions: number;
    stampsGiven: number;
    activeCustomers: number;
    returningCustomers: number;
    newMembers: number;
    prevNewMembers: number;
    members: number;
    inWallet: number;
    outstandingStamps: number;
  };
  daily: { day: string; visits: number; redemptions: number; joined: number }[];
  hours: number[];
  topRewards: { name: string; count: number }[];
};

const PERIODS = [7, 30, 90];
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "+25% vs previous 30 days", or nothing when there's no earlier period to compare with. */
function Change({ now, before, days }: { now: number; before: number; days: number }) {
  if (before === 0) return now > 0 ? <span className="change up">New this period</span> : null;
  const pct = Math.round(((now - before) / before) * 100);
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return (
    <span className={`change ${dir}`}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '='} {Math.abs(pct)}% <span className="muted">vs previous {days} days</span>
    </span>
  );
}

function Tile({ label, value, children }: { label: string; value: string | number; children?: React.ReactNode }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {children && <div className="stat-note">{children}</div>}
    </div>
  );
}

export function DashboardTab({ store }: { store: OwnerStore }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(false);
    api<Stats>(`/api/portal/stores/${store.id}/stats?days=${days}&tz=${encodeURIComponent(tz)}`)
      .then((s) => alive && setStats(s))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [store.id, days]);

  const t = stats?.totals;
  const returningPct = t && t.activeCustomers ? Math.round((t.returningCustomers / t.activeCustomers) * 100) : 0;
  const busiest = stats ? stats.hours.indexOf(Math.max(...stats.hours)) : -1;
  const hasHours = stats ? stats.hours.some((h) => h > 0) : false;
  const topMax = stats?.topRewards[0]?.count ?? 1;
  const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00`).toLocaleDateString([], opts);

  return (
    <>
      <div className="dash-head">
        <h2>How your rewards are doing</h2>
        <div className="segmented" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p} className={p === days ? 'on' : ''} aria-pressed={p === days} onClick={() => setDays(p)}>
              {p} days
            </button>
          ))}
        </div>
      </div>

      {error && <p className="notice bad">Couldn't load your stats. Please refresh.</p>}
      {!stats && !error && <p className="muted">Loading stats…</p>}

      {stats && t && (
        <>
          <div className="stat-grid">
            <Tile label="Visits" value={t.visits}>
              <Change now={t.visits} before={t.prevVisits} days={stats.days} />
            </Tile>
            <Tile label="New members" value={t.newMembers}>
              <Change now={t.newMembers} before={t.prevNewMembers} days={stats.days} />
            </Tile>
            <Tile label="Came back" value={`${returningPct}%`}>
              {t.activeCustomers
                ? `${t.returningCustomers} of ${plural(t.activeCustomers, 'customer')} visited twice or more`
                : 'No visits in this period'}
            </Tile>
            <Tile label="Rewards claimed" value={t.redemptions}>
              <Change now={t.redemptions} before={t.prevRedemptions} days={stats.days} />
            </Tile>
            <Tile label="Members" value={t.members}>
              {plural(t.inWallet, 'card')} saved in Google Wallet
            </Tile>
            <Tile label="Unspent stamps" value={t.outstandingStamps}>
              Stamps your customers can still spend
            </Tile>
          </div>

          <div className="grid-2 dash-charts">
            <section className="panel">
              <BarChart
                title={`Visits per day · last ${stats.days} days`}
                summary={`${t.visits} visits in the last ${stats.days} days.`}
                tickEvery={stats.days === 7 ? 1 : stats.days === 30 ? 7 : 30}
                bars={stats.daily.map((d) => ({
                  label: dayLabel(d.day, stats.days === 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' }),
                  value: d.visits,
                  tooltip: `${dayLabel(d.day, { weekday: 'short', day: 'numeric', month: 'short' })} · ${plural(d.visits, 'visit')}${d.joined ? ` · ${d.joined} joined` : ''}${d.redemptions ? ` · ${plural(d.redemptions, 'reward')}` : ''}`,
                }))}
              />
            </section>
            <section className="panel">
              <BarChart
                title="When customers come"
                summary={hasHours ? `Busiest hour: ${busiest}:00 to ${busiest + 1}:00.` : 'No visits yet.'}
                tickEvery={6}
                bars={stats.hours.map((v, h) => ({
                  label: `${h}:00`,
                  value: v,
                  tooltip: `${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00 · ${plural(v, 'visit')}`,
                }))}
              />
              {hasHours && (
                <p className="small muted">
                  Busiest hour: <strong>{String(busiest).padStart(2, '0')}:00–{String(busiest + 1).padStart(2, '0')}:00</strong>
                  {' '}(your local time).
                </p>
              )}
            </section>
          </div>

          <section className="panel">
            <h2>Most claimed rewards</h2>
            {stats.topRewards.length === 0 ? (
              <p className="muted">No rewards claimed in this period yet.</p>
            ) : (
              <ul className="rank-list">
                {stats.topRewards.map((r) => (
                  <li key={r.name}>
                    <span className="rank-name">{r.name}</span>
                    <span className="rank-bar"><span style={{ width: `${(r.count / topMax) * 100}%` }} /></span>
                    <span className="rank-count">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <ActivityTab store={store} />
    </>
  );
}
