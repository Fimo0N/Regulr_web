import { useState } from 'react';
import type { PublicStore } from '../api';
import { DAYS, directionsUrl, openStatus } from '../lib/hours';

/** Address, opening hours and directions for a store, when the owner has filled them in. */
export function StoreInfo({ store }: { store: PublicStore }) {
  const [showWeek, setShowWeek] = useState(false);
  const status = openStatus(store.hours);
  const hasLocation = store.latitude !== null && store.longitude !== null;
  if (!store.description && !store.address && !store.hours && !store.phone) return null;

  return (
    <section className="store-info">
      <h3 className="section-title">About {store.name}</h3>
      {store.description && <p>{store.description}</p>}
      {status && (
        <button className="link-btn" onClick={() => setShowWeek((v) => !v)}>
          <span className={`dot ${status.open ? 'open' : 'closed'}`} /> {status.text} <span className="muted">{showWeek ? '▴' : '▾'}</span>
        </button>
      )}
      {showWeek && store.hours && (
        <table className="hours-table">
          <tbody>
            {store.hours.map((d, i) => (
              <tr key={DAYS[i]}>
                <td>{DAYS[i]}</td>
                <td>{d.closed ? 'Closed' : `${d.open} – ${d.close}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {store.address && <p className="muted">{store.address}</p>}
      <div className="actions">
        {hasLocation && (
          <a className="btn secondary" href={directionsUrl(store)} target="_blank" rel="noreferrer">
            Directions
          </a>
        )}
        {store.phone && (
          <a className="btn secondary" href={`tel:${store.phone.replace(/\s/g, '')}`}>
            Call
          </a>
        )}
      </div>
    </section>
  );
}
