import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, type InboxMessage } from '../api';
import { useSession } from '../session';
import { SignIn } from '../components/SignIn';
import { timeAgo } from '../lib/time';
import type { CustomerOutlet } from '../components/CustomerLayout';

/** Messages from the shops the customer has joined. Opening the page marks them read. */
export function Inbox() {
  const { config, user, loading, refresh } = useSession();
  const { refreshUnread } = useOutletContext<CustomerOutlet>();
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  // What was unread when the page opened stays highlighted during this visit, even after
  // it's marked read (and if the page loads twice, as React does in development).
  const newOnOpen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ messages: InboxMessage[] }>('/api/me/messages').then((r) => {
      const unread = r.messages.filter((m) => !m.read).map((m) => m.id);
      newOnOpen.current ??= new Set(unread);
      setMessages(r.messages);
      if (unread.length) api('/api/me/messages/read', { method: 'POST', body: { ids: unread } }).then(refreshUnread);
    });
  }, [user, refreshUnread]);

  if (loading || !config) return <div className="page"><p className="muted">Loading…</p></div>;

  if (!user) {
    return (
      <div className="page">
        <h1 className="page-title">Inbox</h1>
        <p className="muted">Sign in to see news and offers from the shops you've joined.</p>
        <SignIn config={config} onSignedIn={refresh} />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Inbox</h1>
      {messages === null && <p className="muted">Loading…</p>}
      {messages?.length === 0 && (
        <div className="empty">
          <p>No messages yet.</p>
          <p className="muted">Shops you've joined can send you news and offers here.</p>
        </div>
      )}
      <ul className="inbox">
        {messages?.map((m) => (
          <li key={m.id} className={!m.read || newOnOpen.current?.has(m.id) ? 'unread' : ''}>
            <Link to={`/s/${m.store.slug}`} className="inbox-item">
              <div className="inbox-logo" style={{ background: m.store.bgColor, color: m.store.textColor }}>
                {m.store.logoUrl ? <img src={m.store.logoUrl} alt="" /> : m.store.name.slice(0, 1)}
              </div>
              <div className="inbox-body">
                <div className="inbox-top">
                  <span>{m.store.name}</span>
                  <span className="muted small">{timeAgo(m.createdAt)}</span>
                </div>
                <strong>{m.title}</strong>
                <p>{m.body}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
