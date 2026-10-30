import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorText, type OwnerStore } from '../../api';

type Tag = { id: string; label: string; mode: 'static' | 'sun'; uid: string | null; active: boolean; url: string };

export function NfcTab({ store }: { store: OwnerStore }) {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<'static' | 'sun'>('static');
  const [uid, setUid] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ tags: Tag[] }>(`/api/portal/stores/${store.id}/tags`);
    setTags(r.tags);
  }, [store.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ fileKey?: string }>(`/api/portal/stores/${store.id}/tags`, {
        method: 'POST',
        body: mode === 'sun' ? { mode, label, uid } : { mode, label },
      });
      setFileKey(r.fileKey ?? '');
      setLabel('');
      setUid('');
      setError('');
      load();
    } catch (err) {
      setError(errorText(err, { sun_keys_not_configured: 'Set SUN_META_KEY and SUN_MASTER_KEY in .env first.' }));
    }
  }

  async function toggle(t: Tag) {
    await api(`/api/portal/stores/${store.id}/tags/${t.id}`, { method: 'PATCH', body: { active: !t.active } });
    load();
  }

  async function copy(t: Tag) {
    await navigator.clipboard.writeText(t.url);
    setCopied(t.id);
    setTimeout(() => setCopied(null), 1500);
  }

  const joinUrl = `${location.origin}/s/${store.slug}`;

  return (
    <>
      <section className="panel">
        <h2>Cashier NFC cards</h2>
        <p className="small muted">
          Write the URL onto an NFC card (e.g. with the NFC Tools app). Keep the card behind the counter and tap it on the customer's phone at checkout.
          If a card is lost, disable it here and it stops working at once.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Card</th><th>Type</th><th>URL to write</th><th></th></tr>
            </thead>
            <tbody>
              {tags?.length === 0 && <tr><td colSpan={4} className="muted">No cards yet.</td></tr>}
              {tags?.map((t) => (
                <tr key={t.id} className={t.active ? '' : 'inactive'}>
                  <td>
                    <strong>{t.label}</strong>
                    {t.uid && <div className="small muted">UID {t.uid}</div>}
                    {!t.active && <div className="small minus">Disabled</div>}
                  </td>
                  <td>{t.mode === 'sun' ? 'NTAG 424 DNA' : 'Basic'}</td>
                  <td>
                    <code className="url">{t.url}</code>
                    <button className="link-btn small" onClick={() => copy(t)}>{copied === t.id ? 'Copied ✓' : 'Copy'}</button>
                  </td>
                  <td>
                    <button className="btn secondary small-btn" onClick={() => toggle(t)}>{t.active ? 'Disable' : 'Enable'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="row spaced" onSubmit={add}>
          <label>
            Label
            <input required placeholder="Front counter" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label>
            Type
            <select value={mode} onChange={(e) => setMode(e.target.value as 'static' | 'sun')}>
              <option value="static">Basic NFC card (prototype)</option>
              <option value="sun">NTAG 424 DNA (secure)</option>
            </select>
          </label>
          {mode === 'sun' && (
            <label>
              Card UID (14 hex)
              <input required placeholder="04A1B2C3D4E5F6" value={uid} onChange={(e) => setUid(e.target.value)} />
            </label>
          )}
          <button className="btn">Add card</button>
        </form>
        {error && <p className="notice bad">{error}</p>}
        {fileKey && (
          <p className="notice info">
            Write this SDM file read key onto the card: <code>{fileKey}</code>. Configure SUN mirroring so <code>picc</code> and <code>cmac</code> are filled
            in on each tap.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Counter QR stand</h2>
        <div className="qr-row">
          <img className="qr" src={`/api/portal/stores/${store.id}/qr.svg`} alt="QR code for the sign-up page" />
          <div>
            <p className="small muted">Print this for the counter. New customers scan it to join.</p>
            <code className="url">{joinUrl}</code>
            <p>
              <a className="small" href={`/api/portal/stores/${store.id}/qr.svg`} download={`${store.slug}-qr.svg`}>Download QR (SVG)</a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
