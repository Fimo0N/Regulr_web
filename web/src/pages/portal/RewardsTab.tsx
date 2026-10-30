import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { iconPreviewSvg, REWARD_ICONS } from '../../../../shared/stampArt';
import { api, errorText, type OwnerStore } from '../../api';

type OwnerReward = {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  icon: string;
  active: boolean;
  startsOn: string | null;
  endsOn: string | null;
  perCustomerLimit: number | null;
};
type Draft = Omit<OwnerReward, 'id' | 'active'>;

const ICON_LABELS: Record<string, string> = {
  gift: 'Gift', coffee: 'Coffee', drink: 'Drink', food: 'Meal', pizza: 'Pizza', cake: 'Cake', percent: 'Discount', star: 'Special',
};
const EMPTY: Draft = { name: '', description: '', cost: 5, icon: 'gift', startsOn: null, endsOn: null, perCustomerLimit: null };

// Icon SVGs are built from shapes only (no user text), so injecting them is safe.
function Icon({ name }: { name: string }) {
  return <span className="reward-icon" dangerouslySetInnerHTML={{ __html: iconPreviewSvg(name) }} />;
}

/** Row of icon buttons; the chosen icon shows on the reward ladder of the card. */
function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div className="icon-picker" role="radiogroup" aria-label="Icon">
      {REWARD_ICONS.map((icon) => (
        <button key={icon} type="button" role="radio" aria-checked={value === icon} title={ICON_LABELS[icon]} aria-label={ICON_LABELS[icon]} className={value === icon ? 'selected' : ''} onClick={() => onChange(icon)}>
          <Icon name={icon} />
        </button>
      ))}
    </div>
  );
}

const today = () => new Date().toLocaleDateString('en-CA');
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });

/** Badges for a reward's limits: when it's available and how often one customer can claim it. */
function Limits({ r }: { r: OwnerReward }) {
  const badges: { text: string; tone?: string }[] = [];
  if (r.endsOn && r.endsOn < today()) badges.push({ text: 'Ended', tone: 'off' });
  else if (r.startsOn && r.startsOn > today()) badges.push({ text: `Starts ${shortDate(r.startsOn)}`, tone: 'soon' });
  else if (r.endsOn) badges.push({ text: `Until ${shortDate(r.endsOn)}`, tone: 'soon' });
  if (r.perCustomerLimit) badges.push({ text: `${r.perCustomerLimit} per customer` });
  return <>{badges.map((b) => <span key={b.text} className={`pill ${b.tone ?? ''}`}>{b.text}</span>)}</>;
}

/** Add or edit form: name, stamps, icon, and optional limited-time window and per-customer limit. */
function RewardForm({ initial, submitLabel, onSubmit, onCancel }: { initial: Draft; submitLabel: string; onSubmit: (d: Draft) => Promise<void>; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((cur) => ({ ...cur, [key]: value }));
  const hasLimits = Boolean(initial.startsOn || initial.endsOn || initial.perCustomerLimit);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ ...d, description: d.description?.trim() || null });
      setError('');
    } catch (err) {
      setError(errorText(err, { ends_before_it_starts: 'The last day has to be after the first day.' }));
    }
    setSaving(false);
  }

  return (
    <form className="form reward-form" onSubmit={submit}>
      <div className="row">
        <label>
          Name
          <input required maxLength={60} placeholder="Fresh croissant" value={d.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="narrow-field">
          Stamps
          <input type="number" min={1} max={500} required value={d.cost} onChange={(e) => set('cost', Number(e.target.value))} />
        </label>
      </div>
      <label>
        Description
        <input maxLength={140} placeholder="Optional" value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} />
      </label>
      <div>
        <div className="field-label">Icon</div>
        <IconPicker value={d.icon} onChange={(icon) => set('icon', icon)} />
      </div>
      <details className="small-details" open={hasLimits}>
        <summary>Limited time &amp; limits</summary>
        <div className="row">
          <label>
            Available from
            <input type="date" value={d.startsOn ?? ''} onChange={(e) => set('startsOn', e.target.value || null)} />
          </label>
          <label>
            Last day
            <input type="date" value={d.endsOn ?? ''} onChange={(e) => set('endsOn', e.target.value || null)} />
          </label>
        </div>
        <label>
          Times one customer can claim it
          <select value={d.perCustomerLimit ?? ''} onChange={(e) => set('perCustomerLimit', e.target.value ? Number(e.target.value) : null)}>
            <option value="">No limit</option>
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>{n === 1 ? 'Once' : `${n} times`}</option>
            ))}
          </select>
        </label>
      </details>
      {error && <p className="notice bad">{error}</p>}
      <div className="row-inline">
        <button className="btn" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export function RewardsTab({ store }: { store: OwnerStore }) {
  const [rewards, setRewards] = useState<OwnerReward[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    const r = await api<{ rewards: OwnerReward[] }>(`/api/portal/stores/${store.id}/rewards`);
    setRewards(r.rewards);
  }, [store.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(d: Draft) {
    await api(`/api/portal/stores/${store.id}/rewards`, { method: 'POST', body: d });
    setFormKey((k) => k + 1); // fresh, empty form
    load();
  }

  async function save(id: string, d: Draft) {
    await api(`/api/portal/stores/${store.id}/rewards/${id}`, { method: 'PATCH', body: d });
    setEditing(null);
    load();
  }

  async function toggle(r: OwnerReward) {
    await api(`/api/portal/stores/${store.id}/rewards/${r.id}`, { method: 'PATCH', body: { active: !r.active } });
    load();
  }

  return (
    <section className="panel">
      <h2>Reward menu</h2>
      <p className="small muted">
        Customers spend their stamps on these. Mix small treats with bigger rewards worth saving up for. Make a reward limited-time (a seasonal
        drink) or once per customer (a welcome gift) under "Limited time &amp; limits".
      </p>
      <ul className="reward-admin">
        {rewards?.length === 0 && <li className="muted">No rewards yet. Add your first one below.</li>}
        {rewards?.map((r) =>
          editing === r.id ? (
            <li key={r.id} className="editing">
              <RewardForm
                initial={{ name: r.name, description: r.description, cost: r.cost, icon: r.icon, startsOn: r.startsOn, endsOn: r.endsOn, perCustomerLimit: r.perCustomerLimit }}
                submitLabel="Save changes"
                onSubmit={(d) => save(r.id, d)}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={r.id} className={r.active ? '' : 'inactive'}>
              <span className="reward-admin-icon"><Icon name={r.icon} /></span>
              <div className="reward-admin-body">
                <strong>{r.name}</strong> <span className="muted">· {r.cost} stamps</span>
                {r.description && <div className="small muted">{r.description}</div>}
                <div className="pills">
                  {!r.active && <span className="pill off">Hidden</span>}
                  <Limits r={r} />
                </div>
              </div>
              <div className="row-inline">
                <button className="btn secondary small-btn" onClick={() => setEditing(r.id)}>Edit</button>
                <button className="btn secondary small-btn" onClick={() => toggle(r)}>{r.active ? 'Hide' : 'Show'}</button>
              </div>
            </li>
          ),
        )}
      </ul>
      <h2 className="spaced">Add a reward</h2>
      <RewardForm key={formKey} initial={EMPTY} submitLabel="Add reward" onSubmit={add} />
    </section>
  );
}
