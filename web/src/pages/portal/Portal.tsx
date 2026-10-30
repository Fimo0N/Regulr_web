import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type OwnerStore } from '../../api';
import { useSession } from '../../session';
import { SignIn } from '../../components/SignIn';
import { CreateStore } from './CreateStore';
import { CustomersTab } from './CustomersTab';
import { DashboardTab } from './DashboardTab';
import { MessagesTab } from './MessagesTab';
import { DesignTab } from './DesignTab';
import { ProfileTab } from './ProfileTab';
import { RewardsTab } from './RewardsTab';
import { NfcTab } from './NfcTab';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'customers', label: 'Customers' },
  { id: 'messages', label: 'Messages' },
  { id: 'design', label: 'Card design' },
  { id: 'profile', label: 'Store profile' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'nfc', label: 'NFC & QR' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function Portal() {
  const { config, user, loading, refresh, signOut } = useSession();
  const [params, setParams] = useSearchParams();
  const [stores, setStores] = useState<OwnerStore[] | null>(null);
  const [creating, setCreating] = useState(false);

  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'dashboard') as TabId;
  const storeId = params.get('store');
  const store = stores?.find((s) => s.id === storeId) ?? stores?.[0] ?? null;

  const loadStores = useCallback(async () => {
    const r = await api<{ stores: OwnerStore[] }>('/api/portal/stores');
    setStores(r.stores);
  }, []);

  useEffect(() => {
    if (user) loadStores();
    else setStores(null);
  }, [user, loadStores]);

  useEffect(() => {
    document.title = 'Regulr Store Portal';
  }, []);

  function go(next: { store?: string; tab?: TabId }) {
    const p = new URLSearchParams(params);
    if (next.store) p.set('store', next.store);
    if (next.tab) p.set('tab', next.tab);
    setParams(p);
  }

  function onStoreUpdated(updated: OwnerStore) {
    setStores((list) => list?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
  }

  return (
    <div className="portal">
      <header className="portal-header">
        <Link to="/portal" className="brand-mark">
          REGULR<span>.</span> <small>Store Portal</small>
        </Link>
        {user && (
          <div className="row-inline">
            <span className="muted small">{user.email}</span>
            <button className="btn secondary" onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>

      {loading || !config ? (
        <p className="muted">Loading…</p>
      ) : !user ? (
        <div className="panel narrow">
          <h2>Sign in to manage your store</h2>
          <SignIn config={config} onSignedIn={refresh} />
        </div>
      ) : stores === null ? (
        <p className="muted">Loading…</p>
      ) : creating || stores.length === 0 ? (
        <CreateStore
          canCancel={stores.length > 0}
          onCancel={() => setCreating(false)}
          onCreated={async (created) => {
            await loadStores();
            setCreating(false);
            go({ store: created.id, tab: 'design' });
          }}
        />
      ) : (
        store && (
          <>
            <div className="store-bar">
              <select value={store.id} onChange={(e) => go({ store: e.target.value })}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <a className="btn secondary" href={`/s/${store.slug}`} target="_blank" rel="noreferrer">View customer card</a>
              <button className="btn secondary" onClick={() => setCreating(true)}>+ New store</button>
            </div>

            <nav className="tabs">
              {TABS.map((t) => (
                <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => go({ tab: t.id })}>
                  {t.label}
                </button>
              ))}
            </nav>

            {tab === 'dashboard' && <DashboardTab key={store.id} store={store} />}
            {tab === 'customers' && <CustomersTab key={store.id} store={store} />}
            {tab === 'messages' && <MessagesTab key={store.id} store={store} />}
            {tab === 'design' && <DesignTab key={store.id} store={store} onUpdated={onStoreUpdated} />}
            {tab === 'profile' && <ProfileTab key={store.id} store={store} onUpdated={onStoreUpdated} />}
            {tab === 'rewards' && <RewardsTab key={store.id} store={store} />}
            {tab === 'nfc' && <NfcTab key={store.id} store={store} />}
          </>
        )
      )}
    </div>
  );
}
