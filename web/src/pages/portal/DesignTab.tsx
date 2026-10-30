import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorText, type OwnerStore, type Reward } from '../../api';
import { StoreCard } from '../../components/StoreCard';

// Sample menu for the live preview until the store adds its own rewards.
const sampleRewards = [
  { name: 'Espresso', cost: 5, icon: 'coffee' },
  { name: 'Croissant', cost: 10, icon: 'cake' },
  { name: 'Lunch', cost: 20, icon: 'food' },
];

type Msg = { kind: 'good' | 'bad'; text: string } | null;

export function DesignTab({ store, onUpdated }: { store: OwnerStore; onUpdated: (s: OwnerStore) => void }) {
  const [form, setForm] = useState({
    name: store.name,
    bgColor: store.bgColor,
    textColor: store.textColor,
    welcomeStamps: store.welcomeStamps,
    stampCooldownMinutes: store.stampCooldownMinutes,
  });
  const [msg, setMsg] = useState<Msg>(null);
  const [logoMsg, setLogoMsg] = useState<Msg>(null);
  const [uploading, setUploading] = useState(false);
  const [logoLink, setLogoLink] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverMsg, setCoverMsg] = useState<Msg>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    api<{ rewards: Reward[] }>(`/api/portal/stores/${store.id}/rewards`).then((r) => setRewards(r.rewards.filter((x) => x.active)));
  }, [store.id]);
  const previewRewards = rewards.length ? rewards : sampleRewards;
  // Halfway to the second reward, so the preview shows lit and unlit icons.
  const previewBalance = previewRewards.length > 1 ? Math.ceil((previewRewards[0].cost + previewRewards[1].cost) / 2) : 1;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      const { store: updated } = await api<{ store: OwnerStore }>(`/api/portal/stores/${store.id}`, { method: 'PATCH', body: form });
      onUpdated(updated);
      setMsg({ kind: 'good', text: 'Saved.' });
    } catch (err) {
      setMsg({ kind: 'bad', text: errorText(err) });
    }
  }

  async function upload(kind: 'logo' | 'cover', file: File) {
    const say = kind === 'logo' ? setLogoMsg : setCoverMsg;
    const maxMb = kind === 'logo' ? 2 : 3;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return say({ kind: 'bad', text: 'Use a PNG or JPG image.' });
    if (file.size > maxMb * 1024 * 1024) return say({ kind: 'bad', text: `That image is over ${maxMb} MB. Use a smaller one.` });
    setUploading(true);
    try {
      const { store: updated } = await api<{ store: OwnerStore }>(`/api/portal/stores/${store.id}/${kind}`, { method: 'PUT', raw: file });
      onUpdated(updated);
      say({ kind: 'good', text: kind === 'logo' ? 'Logo updated.' : 'Cover photo updated. Customers see it from their next stamp.' });
    } catch (err) {
      say({ kind: 'bad', text: errorText(err) });
    }
    setUploading(false);
  }

  async function removeCover() {
    const { store: updated } = await api<{ store: OwnerStore }>(`/api/portal/stores/${store.id}/cover`, { method: 'DELETE' });
    onUpdated(updated);
    setCoverMsg({ kind: 'good', text: 'Cover photo removed.' });
  }

  async function useLink() {
    try {
      const { store: updated } = await api<{ store: OwnerStore }>(`/api/portal/stores/${store.id}`, { method: 'PATCH', body: { logoUrl: logoLink } });
      onUpdated(updated);
      setLogoLink('');
      setLogoMsg({ kind: 'good', text: 'Logo updated.' });
    } catch (err) {
      setLogoMsg({ kind: 'bad', text: errorText(err) });
    }
  }

  return (
    <div className="grid-2">
      <section className="panel">
        <h2>Wallet card design</h2>
        <form className="form" onSubmit={save}>
          <label>
            Store name
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <div className="row">
            <label>
              Background
              <input type="color" value={form.bgColor} onChange={(e) => set('bgColor', e.target.value)} />
            </label>
            <label>
              Text
              <input type="color" value={form.textColor} onChange={(e) => set('textColor', e.target.value)} />
            </label>
          </div>
          <div className="row">
            <label>
              Welcome stamps
              <input type="number" min={0} max={10} value={form.welcomeStamps} onChange={(e) => set('welcomeStamps', Number(e.target.value))} />
            </label>
            <label>
              Minutes between stamps
              <input
                type="number"
                min={0}
                max={1440}
                value={form.stampCooldownMinutes}
                onChange={(e) => set('stampCooldownMinutes', Number(e.target.value))}
              />
            </label>
          </div>
          <p className="small muted">Stops the same customer getting several stamps in a row. Set it to 0 to turn the limit off while testing.</p>
          {msg && <p className={`notice ${msg.kind}`}>{msg.text}</p>}
          <div>
            <button className="btn">Save card</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Live preview</h2>
        <StoreCard
          name={form.name} logoUrl={store.logoUrl} coverUrl={store.coverUrl} bgColor={form.bgColor} textColor={form.textColor} balance={previewBalance}
          rewards={previewRewards}
          memberName="Alex"
        />

        <h2 className="spaced">Logo</h2>
        <p className="small muted">Square PNG or JPG, at least 660 × 660 px, under 2 MB. Google Wallet shows it in a circle.</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload('logo', file);
            e.target.value = '';
          }}
        />
        <div className="row-inline">
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : store.logoUrl ? 'Replace logo' : 'Upload logo'}
          </button>
        </div>
        <details className="small-details">
          <summary>Or use a link to an image</summary>
          <div className="row-inline">
            <input placeholder="https://…/logo.png" value={logoLink} onChange={(e) => setLogoLink(e.target.value)} />
            <button className="btn secondary" onClick={useLink} disabled={!logoLink}>Use link</button>
          </div>
        </details>
        {logoMsg && <p className={`notice ${logoMsg.kind}`}>{logoMsg.text}</p>}

        <h2 className="spaced">Cover photo</h2>
        <p className="small muted">
          A wide photo of your food, drinks or shop, shown behind the reward line. Landscape JPG or PNG, at least 1032 × 336 px, under 3 MB.
          It's tinted with your card colour so the icons stay readable.
        </p>
        <input
          ref={coverRef}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload('cover', file);
            e.target.value = '';
          }}
        />
        {store.coverUrl && <img className="cover-preview" src={store.coverUrl} alt="Current cover photo" />}
        <div className="row-inline spaced-sm">
          <button className="btn" onClick={() => coverRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : store.coverUrl ? 'Replace photo' : 'Upload photo'}
          </button>
          {store.coverUrl && (
            <button className="btn secondary" onClick={removeCover}>Remove</button>
          )}
        </div>
        {coverMsg && <p className={`notice ${coverMsg.kind}`}>{coverMsg.text}</p>}
      </section>
    </div>
  );
}
