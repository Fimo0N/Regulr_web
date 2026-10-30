import { NavLink, Outlet } from 'react-router-dom';

/** Customer side: page content with a bottom tab bar, like a phone app. */
export function CustomerLayout() {
  return (
    <div className="customer-shell">
      <main className="customer-main">
        <Outlet />
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
        <NavLink to="/account">
          <span aria-hidden>◐</span>
          Account
        </NavLink>
      </nav>
    </div>
  );
}
