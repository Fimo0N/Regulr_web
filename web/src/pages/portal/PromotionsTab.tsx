import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { describeDays } from '../../../../shared/promotions';
import { api, errorText, type OwnerStore } from '../../api';

type Promotion = {
  id: string;
  name: string;
  multiplier: number;
  days: string;
  startTime: string;
  endTime: string;
  startsOn: string | null;
  endsOn: string | null;
  active: boolean;
};
type Msg = { kind: 'good' | 'bad'; text: string } | null;

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ERRORS = { ends_before_it_starts: 'The end has to be after the start.', too_many_promotions: 'You can have up to 20 happy hours.' };

function HappyHourForm({ store, onAdded }: { store: OwnerStore; onAdded: () => void }) {
  const [name, setName] = useState('Happy hour');
  const [multiplier, setMultiplier] = useState<2 | 3>(2);
  const [days, setDays] = useState('12345');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('16:00');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [msg, setMsg] = useState<Msg>(null);

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(String(d)) ? cur.replace(String(d), '') : cur + d));

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!days) return setMsg({ kind: 'bad', text: 'Pick at least one day.' });
    try {
      await api(`/api/portal/stores/${store.id}/promotions`, {
        method: 'POST',
        body: { name, multiplier, days, startTime, endTime, startsOn: startsOn || null, endsOn: endsOn || null },
      });
      setMsg({ kind: 'good', text: 'Happy hour added. Customers see it on their card while it runs.' });
      onAdded();
    } catch (err) {
      setMsg({ kind: 'bad', text: errorText(err, ERRORS) });
    }
  }

  return (
    <form className="form" onSubmit={add}>
      <label>
        Name customers see
        <input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div>
        <div className="field-label">Stamps per visit</div>
        <div className="segmented" role="group" aria-label="Multiplier">
          {([2, 3] as const).map((m) => (
            <button key={m} type="button" className={multiplier === m ? 'on' : ''} aria-pressed={multiplier === m} onClick={() => setMultiplier(m)}>
              {m === 2 ? 'Double (2×)' : 'Triple (3×)'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="field-label">Days</div>
        <div className="day-picker">
          {DAY_LETTERS.map((letter, i) => (
            <button
              key={i}
              type="button"
              className={days.includes(String(i + 1)) ? 'on' : ''}
              aria-pressed={days.includes(String(i + 1))}
              aria-label={DAY_NAMES[i]}
              onClick={() => toggleDay(i + 1)}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <label>
          From
          <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label>
          Until
          <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
      </div>
      <details className="small-details">
        <summary>Only for a few weeks? Set dates</summary>
        <div className="row">
          <label>
            First day
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </label>
          <label>
            Last day
            <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </label>
        </div>
      </details>
      {msg && <p className={`notice ${msg.kind}`}>{msg.text}</p>}
      <div>
        <button className="btn">Add happy hour</button>
      </div>
    </form>
  );
}

export function PromotionsTab({ store, onUpdated }: { store: OwnerStore; onUpdated: (s: OwnerStore) => void }) {
  const [promotions, setPromotions] = useState<Promotion[] | null>(null);
  const [birthday, setBirthday] = useState(store.birthdayStamps);
  const [birthdayMsg, setBirthdayMsg] = useState<Msg>(null);

  const load = useCallback(() => api<{ promotions: Promotion[] }>(`/api/portal/stores/${store.id}/promotions`).then((r) => setPromotions(r.promotions)), [store.id]);
  useEffect(() => {
    load();
  }, [load]);

  async function setActive(p: Promotion, active: boolean) {
    await api(`/api/portal/stores/${store.id}/promotions/${p.id}`, { method: 'PATCH', body: { active } });
    load();
  }

  async function remove(p: Promotion) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await api(`/api/portal/stores/${store.id}/promotions/${p.id}`, { method: 'DELETE' });
    load();
  }

  async function saveBirthday(e: FormEvent) {
    e.preventDefault();
    try {
      const { store: updated } = await api<{ store: OwnerStore }>(`/api/portal/stores/${store.id}`, { method: 'PATCH', body: { birthdayStamps: birthday } });
      onUpdated(updated);
      setBirthdayMsg({ kind: 'good', text: birthday ? `Saved. Customers get ${birthday} bonus stamps around their birthday.` : 'Birthday bonus turned off.' });
    } catch (err) {
      setBirthdayMsg({ kind: 'bad', text: errorText(err) });
    }
  }

  return (
    <div className="grid-2">
      <section className="panel">
        <h2>Happy hours</h2>
        <p className="small muted">
          Extra stamps at quiet times fill them up. Times use your shop's timezone ({store.timezone}),{' '}
          <Link to={`/portal?store=${store.id}&tab=profile`}>change it in Store profile</Link>.
        </p>
        {promotions === null ? (
          <p className="muted">Loading…</p>
        ) : promotions.length === 0 ? (
          <p className="muted">No happy hours yet.</p>
        ) : (
          <ul className="promo-list">
            {promotions.map((p) => (
              <li key={p.id} className={p.active ? '' : 'inactive'}>
                <div className="promo-badge">{p.multiplier}×</div>
                <div className="promo-body">
                  <strong>{p.name}</strong>
                  <span className="small muted">
                    {describeDays(p.days)} · {p.startTime}–{p.endTime}
                    {(p.startsOn || p.endsOn) && ` · ${p.startsOn ?? '…'} to ${p.endsOn ?? '…'}`}
                  </span>
                </div>
                <label className="switch-inline">
                  <input type="checkbox" role="switch" aria-label={`${p.name} on`} checked={p.active} onChange={(e) => setActive(p, e.target.checked)} />
                </label>
                <button className="link-btn small muted" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>Delete</button>
              </li>
            ))}
          </ul>
        )}
        <h2 className="spaced">Add a happy hour</h2>
        <HappyHourForm store={store} onAdded={load} />
      </section>

      <section className="panel">
        <h2>Birthday bonus 🎂</h2>
        <p className="small muted">
          Customers can add their birthday in the app. Their first visit within 3 days of it gets bonus stamps and a "Happy birthday!" notification,
          once a year.
        </p>
        <form className="form" onSubmit={saveBirthday}>
          <label>
            Bonus stamps
            <select value={birthday} onChange={(e) => setBirthday(Number(e.target.value))}>
              <option value={0}>Off</option>
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>{n} stamp{n === 1 ? '' : 's'}</option>
              ))}
            </select>
          </label>
          {birthdayMsg && <p className={`notice ${birthdayMsg.kind}`}>{birthdayMsg.text}</p>}
          <div>
            <button className="btn">Save</button>
          </div>
        </form>

        <h2 className="spaced">Bigger orders, more stamps</h2>
        <p className="small muted">
          Set an NFC card to give 2–5 stamps per tap, for example a "+2" card for big orders.{' '}
          <Link to={`/portal?store=${store.id}&tab=nfc`}>Set it in NFC &amp; QR</Link>.
        </p>
      </section>
    </div>
  );
}
