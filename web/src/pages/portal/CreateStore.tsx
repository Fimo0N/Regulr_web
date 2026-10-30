import { useState, type FormEvent } from 'react';
import { api, errorText, type OwnerStore } from '../../api';

const toSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export function CreateStore({ canCancel, onCancel, onCreated }: { canCancel: boolean; onCancel: () => void; onCreated: (s: OwnerStore) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const { store } = await api<{ store: OwnerStore }>('/api/portal/stores', { method: 'POST', body: { name, slug, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      onCreated(store);
    } catch (err) {
      setError(errorText(err, { slug_taken: 'That link name is already taken. Try another one.' }));
    }
  }

  return (
    <div className="panel narrow">
      <h2>Create your store</h2>
      <form className="form" onSubmit={submit}>
        <label>
          Store name
          <input
            required
            placeholder="Bean There Café"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(toSlug(e.target.value));
            }}
          />
        </label>
        <label>
          Link name
          <input
            required
            pattern="[a-z0-9-]{3,40}"
            placeholder="bean-there"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
          />
          <span className="muted small">Your customers' card lives at /s/{slug || 'link-name'}</span>
        </label>
        {error && <p className="notice bad">{error}</p>}
        <div className="row-inline">
          <button className="btn">Create store</button>
          {canCancel && (
            <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
          )}
        </div>
      </form>
    </div>
  );
}
