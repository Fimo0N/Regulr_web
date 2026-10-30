import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { iconPreviewSvg, REWARD_ICONS } from '../../../../shared/stampArt';
import { api, errorText, type OwnerStore, type Reward } from '../../api';

const ICON_LABELS: Record<string, string> = {
  gift: 'Gift', coffee: 'Coffee', drink: 'Drink', food: 'Meal', pizza: 'Pizza', cake: 'Cake', percent: 'Discount', star: 'Special',
};

// Icon SVGs are built from shapes only (no user text), so injecting them is safe.
function Icon({ name }: { name: string }) {
  return <span className="reward-icon" dangerouslySetInnerHTML={{ __html: iconPreviewSvg(name) }} />;
}

/** Row of icon buttons; the chosen icon shows on the reward ladder of the card. */
function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div className="icon-picker" role="radiogroup" aria-label="Icon">
      {REWARD_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={value === icon}
          title={ICON_LABELS[icon]}
          className={value === icon ? 'selected' : ''}
          onClick={() => onChange(icon)}
        >
          <Icon name={icon} />
        </button>
      ))}
    </div>
  );
}

export function RewardsTab({ store }: { store: OwnerStore }) {
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(5);
  const [icon, setIcon] = useState<string>('gift');
  const [editingIcon, setEditingIcon] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await api<{ rewards: Reward[] }>(`/api/portal/stores/${store.id}/rewards`);
    setRewards(r.rewards);
  }, [store.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/portal/stores/${store.id}/rewards`, { method: 'POST', body: { name, description: description || null, cost, icon } });
      setName('');
      setDescription('');
      setIcon('gift');
      setError('');
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function update(r: Reward, patch: Partial<Pick<Reward, 'active' | 'icon'>>) {
    await api(`/api/portal/stores/${store.id}/rewards/${r.id}`, { method: 'PATCH', body: patch });
    setEditingIcon(null);
    load();
  }

  return (
    <section className="panel">
      <h2>Reward menu</h2>
      <p className="small muted">
        Customers spend their stamps on these. Mix small treats with bigger rewards worth saving up for. Each reward's icon appears on the
        progress line of the customer's card.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Icon</th><th>Reward</th><th>Stamps</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {rewards?.length === 0 && <tr><td colSpan={5} className="muted">No rewards yet. Add your first one below.</td></tr>}
            {rewards?.map((r) => (
              <tr key={r.id}>
                <td>
                  {editingIcon === r.id ? (
                    <IconPicker value={r.icon} onChange={(i) => update(r, { icon: i })} />
                  ) : (
                    <button type="button" className="icon-btn" title="Change icon" onClick={() => setEditingIcon(r.id)}>
                      <Icon name={r.icon} />
                    </button>
                  )}
                </td>
                <td>
                  <strong>{r.name}</strong>
                  {r.description && <div className="small muted">{r.description}</div>}
                </td>
                <td>{r.cost}</td>
                <td>{r.active ? 'Active' : <span className="muted">Hidden</span>}</td>
                <td>
                  <button className="btn secondary small-btn" onClick={() => update(r, { active: !r.active })}>{r.active ? 'Hide' : 'Show'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="spaced" onSubmit={add}>
        <div className="row">
          <label>
            Name
            <input required placeholder="Fresh croissant" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Description
            <input placeholder="Optional" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="narrow-field">
            Stamps
            <input type="number" min={1} max={500} required value={cost} onChange={(e) => setCost(Number(e.target.value))} />
          </label>
        </div>
        <div className="field-label">Icon</div>
        <div className="row-inline">
          <IconPicker value={icon} onChange={setIcon} />
          <button className="btn">Add reward</button>
        </div>
      </form>
      {error && <p className="notice bad">{error}</p>}
    </section>
  );
}
