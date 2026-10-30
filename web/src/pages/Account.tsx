import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api';
import { useSession } from '../session';
import { SignIn } from '../components/SignIn';

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
