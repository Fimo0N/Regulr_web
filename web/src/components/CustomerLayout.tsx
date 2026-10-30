import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../session';

/** What customer pages get from the layout (via useOutletContext). */
export type CustomerOutlet = { refreshUnread: () => void };

/** Customer side: page content with a bottom tab bar, like a phone app. */
export function CustomerLayout() {
  const { user } = useSession();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(() => {
    if (!user) return setUnread(0);
    api<{ unread: number }>('/api/me/messages')
      .then((r) => setUnread(r.unread))
      .catch(() => {});
  }, [user]);

  // Recount on every page change, so a new message shows up as the customer moves around.
  useEffect(refreshUnread, [refreshUnread, pathname]);

  return (
    <div className="customer-shell">
      <main className="customer-main">
        <Outlet context={{ refreshUnread } satisfies CustomerOutlet} />
      </main>
      <nav className="tabbar">
        <NavLink to="/cards">
          <span aria-hidden>▤</span>
          My cards
        </NavLink>
        <NavLink to="/discover">
          <span aria-hidden>◎</span>
          Discover
        </NavLink>
        <NavLink to="/inbox" aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}>
          <span aria-hidden className="tab-icon">
            ✉{unread > 0 && <b className="tab-badge">{unread > 9 ? '9+' : unread}</b>}
          </span>
          Inbox
        </NavLink>
        <NavLink to="/account">
          <span aria-hidden>◐</span>
          Account
        </NavLink>
      </nav>
    </div>
  );
}
