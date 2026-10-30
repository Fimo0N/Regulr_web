import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { api, type PublicStore } from '../api';
import { directionsUrl, distance, formatDistance, openStatus } from '../lib/hours';

type MapStore = PublicStore & { latitude: number; longitude: number; member: boolean; balance: number | null };
type LatLng = { lat: number; lng: number };

// Fallback view before any store or location is known.
const DEFAULT_CENTER: [number, number] = [47.4979, 19.0402];

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function storeIcon(store: MapStore, selected: boolean) {
  // Leaflet pins are raw HTML, so owner-entered values must be escaped.
  const inner = store.logoUrl
    ? `<img src="${escapeHtml(store.logoUrl)}" alt="" />`
    : `<span style="color:${store.textColor}">${escapeHtml(store.name.slice(0, 1).toUpperCase())}</span>`;
  return L.divIcon({
    className: '',
    html: `<div class="map-pin${selected ? ' selected' : ''}${store.member ? ' member' : ''}" style="background:${store.bgColor}">${inner}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/** Fits the map to all stores once, then follows whichever store is selected. */
function MapController({ stores, focus }: { stores: MapStore[]; focus: LatLng | null }) {
  const map = useMap();
  const [fitted, setFitted] = useState(false);
  useEffect(() => {
    if (fitted || !stores.length) return;
    if (stores.length === 1) map.setView([stores[0].latitude, stores[0].longitude], 15);
    else map.fitBounds(L.latLngBounds(stores.map((s) => [s.latitude, s.longitude])), { padding: [40, 40] });
    setFitted(true);
  }, [stores, fitted, map]);
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [focus, map]);
  return null;
}

export function Discover() {
  const [stores, setStores] = useState<MapStore[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  useEffect(() => {
    api<{ stores: MapStore[] }>('/api/stores').then((r) => setStores(r.stores));
  }, []);

  const sorted = useMemo(() => {
    if (!stores) return [];
    const withDistance = stores.map((s) => ({ store: s, metres: me ? distance(me, { lat: s.latitude, lng: s.longitude }) : null }));
    return me ? withDistance.sort((a, b) => a.metres! - b.metres!) : withDistance;
  }, [stores, me]);

  function locate() {
    if (!navigator.geolocation) return setLocError("Your browser can't share your location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(here);
        setFocus(here);
        setLocating(false);
        setLocError('');
      },
      () => {
        setLocating(false);
        setLocError('Location is off, so stores are listed by name.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  function select(store: MapStore) {
    setSelected(store.slug);
    setFocus({ lat: store.latitude, lng: store.longitude });
  }

  return (
    <div className="discover">
      <div className="map-wrap">
        <MapContainer center={DEFAULT_CENTER} zoom={12} className="map" zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {stores?.map((s) => (
            <Marker key={s.slug} position={[s.latitude, s.longitude]} icon={storeIcon(s, s.slug === selected)} eventHandlers={{ click: () => select(s) }} />
          ))}
          {me && (
            <Marker
              position={[me.lat, me.lng]}
              icon={L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })}
            />
          )}
          <MapController stores={stores ?? []} focus={focus} />
        </MapContainer>
        <button className="btn locate-btn" onClick={locate} disabled={locating}>
          {locating ? 'Locating…' : '◎ Near me'}
        </button>
      </div>

      <div className="page discover-list">
        <h1 className="page-title">Discover</h1>
        {locError && <p className="muted small">{locError}</p>}
        {stores === null && <p className="muted">Loading shops…</p>}
        {stores?.length === 0 && <p className="muted">No Regulr shops on the map yet.</p>}
        {sorted.map(({ store, metres }) => {
          const status = openStatus(store.hours);
          const isSelected = store.slug === selected;
          return (
            <div key={store.slug} className={`shop${isSelected ? ' selected' : ''}`} onClick={() => select(store)}>
              <div className="shop-logo" style={{ background: store.bgColor, color: store.textColor }}>
                {store.logoUrl ? <img src={store.logoUrl} alt="" /> : store.name.slice(0, 1)}
              </div>
              <div className="shop-body">
                <div className="shop-name">
                  {store.name}
                  {store.member && <span className="badge">{store.balance} ⭑</span>}
                </div>
                <div className="small muted">
                  {[metres !== null && formatDistance(metres), store.address].filter(Boolean).join(' · ')}
                </div>
                {status && (
                  <div className="small">
                    <span className={`dot ${status.open ? 'open' : 'closed'}`} /> {status.text}
                  </div>
                )}
                {isSelected && (
                  <>
                    {store.rewards.length > 0 && (
                      <div className="small muted shop-rewards">
                        Rewards: {store.rewards.slice(0, 3).map((r) => `${r.name} (${r.cost} ⭑)`).join(', ')}
                      </div>
                    )}
                    <div className="actions">
                      <Link className="btn" to={`/s/${store.slug}`}>{store.member ? 'Open my card' : 'Join'}</Link>
                      <a className="btn secondary" href={directionsUrl(store)} target="_blank" rel="noreferrer">
                        Directions
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
