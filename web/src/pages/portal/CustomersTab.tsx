import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorText, type OwnerStore } from '../../api';
import { timeAgo } from '../../lib/time';

type Customer = {
  id: string;
  name: string;
  email: string;
  balance: number;
  lifetimeStamps: number;
  visits: number;
  redemptions: number;
  inWallet: boolean;
  joinedAt: string;
  lastVisitAt: string | null;
};
type Detail = Omit<Customer, 'visits' | 'redemptions'>;
type Event = { id: string; kind: string; delta: number; rewardName: string | null; note: string | null; createdAt: string };

const SORTS = [
  ['recent', 'Last visit'],
  ['visits', 'Most visits'],
  ['stamps', 'Most stamps'],
  ['new', 'Newest'],
] as const;

const describe = (e: Event) =>
  ({ welcome: 'Joined', tap: 'Visit', redeem: `Claimed ${e.rewardName}`, adjust: e.delta > 0 ? 'Added by you' : 'Removed by you' })[e.kind] ?? e.kind;

/** One customer: totals, a stamp adjuster and their full history. */
function CustomerPanel({ store, id, onClose, onChanged }: { store: OwnerStore; id: string; onClose: () => void; onChanged: (balance: number) => void }) {
  const [data, setData] = useState<{ customer: Detail; events: Event[] } | null>(null);
  const [delta, setDelta] = useState(1);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ kind: 'good' | 'bad'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api<{ customer: Detail; events: Event[] }>(`/api/portal/stores/${store.id}/customers/${id}`).then(setData), [store.id, id]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function apply(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api<{ balance: number }>(`/api/portal/stores/${store.id}/customers/${id}/adjust`, {
        method: 'POST',
        body: { delta, note: note.trim() || null },
      });
      setMsg({ kind: 'good', text: `Done. ${data?.customer.name} now has ${r.balance} stamps${data?.customer.inWallet ? ' and gets a Wallet notification' : ''}.` });
      setNote('');
      setDelta(1);
      onChanged(r.balance);
      load();
    } catch (err) {
      setMsg({ kind: 'bad', text: errorText(err, { balance_below_zero: "They don't have that many stamps to remove." }) });
    }
    setSaving(false);
  }

  const c = data?.customer;
  const after = c ? c.balance + delta : 0;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Customer" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        {!c ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <h2 className="drawer-title">{c.name}</h2>
            <p className="muted small">
              {c.email} · joined {new Date(c.joinedAt).toLocaleDateString()} {c.inWallet && '· card in Google Wallet'}
            </p>
            <div className="mini-stats">
              <div><strong>{c.balance}</strong><span>stamps now</span></div>
              <div><strong>{c.lifetimeStamps}</strong><span>stamps ever</span></div>
              <div><strong>{c.lastVisitAt ? timeAgo(c.lastVisitAt) : '—'}</strong><span>last visit</span></div>
            </div>

            <form className="adjust" onSubmit={apply}>
              <h3>Adjust stamps</h3>
              <p className="small muted">For a forgotten tap, a mistake, or a thank-you. The customer sees it in their history.</p>
              <div className="stepper">
                <button type="button" onClick={() => setDelta((d) => (d - 1 === 0 ? -1 : Math.max(-100, d - 1)))} aria-label="Fewer">−</button>
                <output aria-live="polite">{delta > 0 ? `+${delta}` : delta}</output>
                <button type="button" onClick={() => setDelta((d) => (d + 1 === 0 ? 1 : Math.min(100, d + 1)))} aria-label="More">+</button>
                <span className="muted small">
                  {c.balance} → <strong className={after < 0 ? 'minus' : ''}>{after}</strong>
                </span>
              </div>
              <input maxLength={120} placeholder="Reason (optional, shown to the customer)" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn" disabled={saving || after < 0}>{saving ? 'Saving…' : delta > 0 ? `Add ${delta} stamp${delta === 1 ? '' : 's'}` : `Remove ${-delta} stamp${delta === -1 ? '' : 's'}`}</button>
              {msg && <p className={`notice ${msg.kind}`}>{msg.text}</p>}
            </form>

            <h3>History</h3>
            <ul className="history">
              {data.events.map((e) => (
                <li key={e.id}>
                  <span>
                    {describe(e)}
                    {e.note && <span className="muted small"> · {e.note}</span>}
                  </span>
                  <span className="muted small">{new Date(e.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span className={e.delta >= 0 ? 'plus' : 'minus'}>{e.delta >= 0 ? '+' : ''}{e.delta}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}

export function CustomersTab({ store }: { store: OwnerStore }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>('recent');
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    (offset: number) =>
      api<{ customers: Customer[]; total: number; nextOffset: number | null }>(
        `/api/portal/stores/${store.id}/customers?sort=${sort}&q=${encodeURIComponent(debounced)}&offset=${offset}`,
      ),
    [store.id, sort, debounced],
  );

  useEffect(() => {
    let alive = true;
    fetchPage(0).then((r) => {
      if (!alive) return;
      setCustomers(r.customers);
      setTotal(r.total);
      setNextOffset(r.nextOffset);
    });
    return () => {
      alive = false;
    };
  }, [fetchPage]);

  async function more() {
    if (nextOffset === null) return;
    const r = await fetchPage(nextOffset);
    setCustomers((list) => [...(list ?? []), ...r.customers]);
    setNextOffset(r.nextOffset);
  }

  return (
    <section className="panel">
      <div className="dash-head">
        <h2>
          Customers <span className="muted small">· {total}</span>
        </h2>
        <div className="row-inline">
          <input className="search-input" type="search" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort by">
            {SORTS.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="table-wrap">
        <table className="clickable">
          <thead>
            <tr><th>Customer</th><th>Stamps</th><th>Visits</th><th>Rewards</th><th>Last visit</th><th>Wallet</th></tr>
          </thead>
          <tbody>
            {customers === null && <tr><td colSpan={6} className="muted">Loading…</td></tr>}
            {customers?.length === 0 && (
              <tr><td colSpan={6} className="muted">{debounced ? 'No customers match.' : 'No customers yet. They appear here after their first scan.'}</td></tr>
            )}
            {customers?.map((c) => (
              <tr key={c.id} onClick={() => setOpen(c.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(c.id)}>
                <td>
                  <strong>{c.name}</strong>
                  <div className="small muted">{c.email}</div>
                </td>
                <td>{c.balance}</td>
                <td>{c.visits}</td>
                <td>{c.redemptions}</td>
                <td>{c.lastVisitAt ? timeAgo(c.lastVisitAt) : '—'}</td>
                <td>{c.inWallet ? '✓' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextOffset !== null && (
        <button className="btn secondary spaced-sm" onClick={more}>Show more</button>
      )}
      {open && (
        <CustomerPanel
          store={store}
          id={open}
          onClose={() => setOpen(null)}
          onChanged={(balance) => setCustomers((list) => list?.map((c) => (c.id === open ? { ...c, balance } : c)) ?? null)}
        />
      )}
    </section>
  );
}
