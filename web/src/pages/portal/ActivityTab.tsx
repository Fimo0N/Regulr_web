import { useEffect, useState } from 'react';
import { api, type OwnerStore } from '../../api';

type Event = { id: string; kind: string; delta: number; rewardName: string | null; tag: string | null; customer: string; createdAt: string };

const describe = (e: Event) =>
  ({ welcome: 'Joined', tap: 'Stamp', redeem: `Redeemed ${e.rewardName}`, adjust: 'Adjustment' })[e.kind] ?? e.kind;

export function ActivityTab({ store }: { store: OwnerStore }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [members, setMembers] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ events: Event[]; members: number }>(`/api/portal/stores/${store.id}/activity`).then((r) => {
        if (!alive) return;
        setEvents(r.events);
        setMembers(r.members);
      });
    load();
    const timer = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [store.id]);

  return (
    <section className="panel">
      <h2>
        Live activity <span className="muted small">· {members} customer{members === 1 ? '' : 's'} · refreshes every 10 s</span>
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>When</th><th>Customer</th><th>What</th><th>Stamps</th><th>Card</th></tr>
          </thead>
          <tbody>
            {events === null && <tr><td colSpan={5} className="muted">Loading…</td></tr>}
            {events?.length === 0 && <tr><td colSpan={5} className="muted">No activity yet.</td></tr>}
            {events?.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>{e.customer}</td>
                <td>{describe(e)}</td>
                <td className={e.delta >= 0 ? 'plus' : 'minus'}>{e.delta >= 0 ? '+' : ''}{e.delta}</td>
                <td className="muted">{e.tag ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
