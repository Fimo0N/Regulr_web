import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type PublicStore } from '../api';
import { useSession } from '../session';
import { SignIn } from '../components/SignIn';
import { StoreCard } from '../components/StoreCard';

type Card = { balance: number; lifetimeStamps: number; lastStampAt: string | null; store: PublicStore };

export function MyCards() {
  const { config, user, loading, refresh } = useSession();
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ cards: Card[] }>('/api/me/cards').then((r) => setCards(r.cards));
  }, [user]);

  if (loading || !config) return <div className="page"><p className="muted">Loading…</p></div>;

  if (!user) {
    return (
      <div className="page">
        <h1 className="page-title">Your loyalty cards</h1>
        <p className="muted">Sign in to see the cards you've collected at Regulr shops.</p>
        <SignIn config={config} onSignedIn={refresh} />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">My cards</h1>
      {cards === null && <p className="muted">Loading…</p>}
      {cards?.length === 0 && (
        <div className="empty">
          <p>You don't have any cards yet.</p>
          <p className="muted">Scan the QR code at the counter of a Regulr shop, or find one near you.</p>
          <Link className="btn" to="/discover">Find shops</Link>
        </div>
      )}
      <div className="card-list">
        {cards?.map((c) => (
          <Link key={c.store.slug} to={`/s/${c.store.slug}`} className="card-link">
            <StoreCard
              compact
              name={c.store.name}
              logoUrl={c.store.logoUrl}
              coverUrl={c.store.coverUrl}
              bgColor={c.store.bgColor}
              textColor={c.store.textColor}
              balance={c.balance}
              rewards={c.store.rewards}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
