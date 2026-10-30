import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api';
import { useSession } from '../session';
import { SignIn } from '../components/SignIn';

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString([], { month: 'long' }));

/** Optional birthday (month and day, no year) for shops' birthday bonus. */
function Birthday({ month, day, onSaved }: { month: number | null; day: number | null; onSaved: () => Promise<void> }) {
  const [m, setM] = useState(month ?? 0);
  const [d, setD] = useState(day ?? 0);
  const [msg, setMsg] = useState('');
  const daysInMonth = m ? new Date(2024, m, 0).getDate() : 31;

  async function save(clear = false) {
    try {
      await api('/api/me', { method: 'PATCH', body: clear ? { birthMonth: null, birthDay: null } : { birthMonth: m, birthDay: d } });
      if (clear) {
        setM(0);
        setD(0);
      }
      setMsg(clear ? 'Birthday removed.' : 'Saved. Shops with a birthday bonus will treat you around your birthday.');
      await onSaved();
    } catch (err) {
      setMsg(errorText(err));
    }
  }

  return (
    <div className="panel">
      <h2>Your birthday 🎂</h2>
      <p className="muted small">Optional. Some shops give bonus stamps around your birthday. We only store the day and month, never the year.</p>
      <div className="row-inline birthday-row">
        <select value={m} onChange={(e) => setM(Number(e.target.value))} aria-label="Month">
          <option value={0}>Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select value={d} onChange={(e) => setD(Number(e.target.value))} aria-label="Day">
          <option value={0}>Day</option>
          {Array.from({ length: daysInMonth }, (_, i) => (
            <option key={i} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        <button className="btn secondary" disabled={!m || !d || d > daysInMonth} onClick={() => save()}>Save</button>
        {month && <button className="link-btn small muted" onClick={() => save(true)}>Remove</button>}
      </div>
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}

// Public marketing site (privacy policy, terms), from VITE_WEBSITE_URL in .env.
const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL as string | undefined)?.replace(/\/$/, '');

export function Account() {
  const { config, user, loading, refresh, signOut } = useSession();
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (loading || !config) return <div className="page"><p className="muted">Loading…</p></div>;

  if (!user) {
    return (
      <div className="page">
        <h1 className="page-title">Account</h1>
        <SignIn config={config} onSignedIn={refresh} />
      </div>
    );
  }

  async function deleteAccount() {
    if (!confirm('Delete your Regulr account?\n\nAll your cards and stamps at every shop will be permanently removed. This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api('/api/me', { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorText(err, { owns_stores: 'You own a store on Regulr. Contact support to close your store before deleting your account.' }));
      setDeleting(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Account</h1>
      <div className="panel">
        <div className="account-row">
          <div className="avatar">{(user.name || user.email).slice(0, 1).toUpperCase()}</div>
          <div>
            <div><strong>{user.name || user.email}</strong></div>
            <div className="muted small">{user.email}</div>
          </div>
        </div>
        <div className="actions">
          <button className="btn secondary" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <Birthday month={user.birthMonth ?? null} day={user.birthDay ?? null} onSaved={refresh} />

      <div className="panel">
        <h2>Own a shop?</h2>
        <p className="muted">Manage your loyalty card, rewards and NFC cards in the store portal.</p>
        <Link className="btn secondary" to="/portal">Open store portal</Link>
      </div>

      <div className="panel">
        <h2>Your data</h2>
        <p className="muted">
          Deleting your account removes all your cards, stamps and history.
          {WEBSITE_URL && (
            <>
              {' '}Read our{' '}
              <a href={`${WEBSITE_URL}/privacy`} target="_blank" rel="noreferrer">privacy policy</a>.
            </>
          )}
        </p>
        {error && <p className="notice bad">{error}</p>}
        <button className="btn danger" onClick={deleteAccount} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </div>
  );
}
