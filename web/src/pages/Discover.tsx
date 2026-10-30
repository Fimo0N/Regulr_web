import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Marker, type MapRef } from 'react-map-gl/maplibre';
import { iconPreviewSvg, progressCaption, stampProgress } from '../../../shared/stampArt';
import { api, type HappyHourInfo, type PublicStore } from '../api';
import { DEFAULT_VIEW, MapView } from '../components/MapView';
import { directionsUrl, distance, formatDistance, openStatus } from '../lib/hours';

type MapStore = PublicStore & {
  latitude: number;
  longitude: number;
  member: boolean;
  balance: number | null;
  happyHourNow: HappyHourInfo | null;
};
type LatLng = { lat: number; lng: number };
type Filter = 'all' | 'open' | 'mine';

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['open', 'Open now'],
  ['mine', 'My cards'],
];

/** Shop pin: the shop's logo in its card colour, with the stamp count for shops the customer has joined. */
function Pin({ store, selected }: { store: MapStore; selected: boolean }) {
  return (
    <div className={`pin${selected ? ' selected' : ''}${store.member ? ' member' : ''}`} style={{ '--pin': store.bgColor } as CSSProperties}>
      <div className="pin-face" style={{ background: store.bgColor, color: store.textColor }}>
        {store.logoUrl ? <img src={store.logoUrl} alt="" /> : store.name.slice(0, 1).toUpperCase()}
      </div>
      {store.member && <span className="pin-badge">{store.balance}</span>}
    </div>
  );
}

function ShopCard({ store, metres, selected, onSelect }: { store: MapStore; metres: number | null; selected: boolean; onSelect: () => void }) {
  const status = openStatus(store.hours);
  const progress = store.member ? stampProgress(store.rewards, store.balance ?? 0) : null;
  const cheapest = store.rewards.length ? Math.min(...store.rewards.map((r) => r.cost)) : null;
  return (
    <article className={`shop-card${selected ? ' selected' : ''}`} data-slug={store.slug} onClick={onSelect}>
      <div className="shop-cover" style={{ background: store.bgColor }}>
        {store.coverUrl && <img className="shop-cover-img" src={store.coverUrl} alt="" />}
        <div className="shop-cover-logo" style={{ background: store.bgColor, color: store.textColor }}>
          {store.logoUrl ? <img src={store.logoUrl} alt="" /> : store.name.slice(0, 1).toUpperCase()}
        </div>
        {store.member && <span className="shop-chip">{store.balance} ⭑</span>}
        {store.happyHourNow && (
          <span className="shop-chip happy" title={`${store.happyHourNow.name} until ${store.happyHourNow.endTime}`}>
            {store.happyHourNow.multiplier}× stamps now
          </span>
        )}
      </div>
      <div className="shop-card-body">
        <h3 className="shop-name">{store.name}</h3>
        <div className="shop-meta">
          {status && (
            <span>
              <span className={`dot ${status.open ? 'open' : 'closed'}`} /> {status.text}
            </span>
          )}
          {metres !== null && <span>{formatDistance(metres)}</span>}
        </div>
        <div className="shop-line">
          {progress ? progressCaption(progress) : cheapest !== null ? `Rewards from ${cheapest} stamps` : store.address}
        </div>
        {store.rewards.length > 0 && (
          <div className="shop-icons" aria-label="Rewards">
            {/* Icon SVGs are built from shapes only (no shop-entered text), so injecting them is safe. */}
            {store.rewards.slice(0, 6).map((r) => (
              <span key={r.id} title={`${r.name} · ${r.cost} stamps`} dangerouslySetInnerHTML={{ __html: iconPreviewSvg(r.icon) }} />
            ))}
          </div>
        )}
        <div className="shop-actions">
          <Link className="btn small-btn" to={`/s/${store.slug}`} onClick={(e) => e.stopPropagation()}>
            {store.member ? 'Open card' : 'Join'}
          </Link>
          <a className="btn secondary small-btn" href={directionsUrl(store)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            Directions
          </a>
        </div>
      </div>
    </article>
  );
}

export function Discover() {
  const mapRef = useRef<MapRef>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<number>();
  const fitted = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [stores, setStores] = useState<MapStore[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [me, setMe] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  useEffect(() => {
    api<{ stores: MapStore[] }>('/api/stores')
      .then((r) => setStores(r.stores))
      .catch(() => setStores([]));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (stores ?? [])
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.address ?? '').toLowerCase().includes(q))
      .filter((s) => filter !== 'open' || openStatus(s.hours)?.open)
      .filter((s) => filter !== 'mine' || s.member)
      .map((store) => ({ store, metres: me ? distance(me, { lat: store.latitude, lng: store.longitude }) : null }));
    return me ? list.sort((a, b) => a.metres! - b.metres!) : list;
  }, [stores, query, filter, me]);

  // Show every shop once the map and the list are both ready.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !stores?.length || fitted.current) return;
    fitted.current = true;
    if (stores.length === 1) {
      map.jumpTo({ center: [stores[0].longitude, stores[0].latitude], zoom: 15 });
      return;
    }
    const lngs = stores.map((s) => s.longitude);
    const lats = stores.map((s) => s.latitude);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: 130, bottom: 280, left: 40, right: 40 }, maxZoom: 15, duration: 0 },
    );
  }, [mapReady, stores]);

  const flyTo = useCallback((s: MapStore) => {
    const map = mapRef.current;
    if (!map) return;
    // Offset upwards so the pin isn't hidden behind the cards at the bottom.
    map.flyTo({ center: [s.longitude, s.latitude], zoom: Math.max(map.getZoom(), 15), offset: [0, -90], duration: 700 });
  }, []);

  function select(s: MapStore, scrollCard: boolean) {
    setSelected(s.slug);
    flyTo(s);
    if (scrollCard) {
      railRef.current?.querySelector(`[data-slug="${CSS.escape(s.slug)}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  // Swiping the cards moves the map to the card in the middle (phones, where the cards scroll sideways).
  function onRailScroll() {
    const rail = railRef.current;
    if (!rail || rail.scrollWidth <= rail.clientWidth + 1) return;
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const mid = rail.getBoundingClientRect().left + rail.clientWidth / 2;
      let best: { slug: string; dist: number } | null = null;
      for (const el of rail.querySelectorAll<HTMLElement>('[data-slug]')) {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.left + r.width / 2 - mid);
        if (!best || dist < best.dist) best = { slug: el.dataset.slug!, dist };
      }
      const store = best && stores?.find((s) => s.slug === best!.slug);
      if (store && store.slug !== selected) select(store, false);
    }, 140);
  }

  function locate() {
    if (!navigator.geolocation) return setLocError("Your browser can't share your location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(here);
        setLocating(false);
        setLocError('');
        mapRef.current?.flyTo({ center: [here.lng, here.lat], zoom: 14, offset: [0, -90], duration: 800 });
      },
      () => {
        setLocating(false);
        setLocError("Location is off, so shops aren't sorted by distance.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div className="discover">
      <MapView ref={mapRef} initialViewState={DEFAULT_VIEW} onLoad={() => setMapReady(true)} onClick={() => setSelected(null)}>
        {stores?.map((s) => (
          <Marker
            key={s.slug}
            longitude={s.longitude}
            latitude={s.latitude}
            anchor="bottom"
            style={{ zIndex: s.slug === selected ? 2 : 1 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              select(s, true);
            }}
          >
            <Pin store={s} selected={s.slug === selected} />
          </Marker>
        ))}
        {me && (
          <Marker longitude={me.lng} latitude={me.lat}>
            <div className="me-dot" />
          </Marker>
        )}
      </MapView>

      <div className="map-top">
        <label className="map-search">
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <input type="search" placeholder="Search shops or streets" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search shops" />
        </label>
        <div className="map-chips" role="group" aria-label="Filter shops">
          {FILTERS.map(([key, label]) => (
            <button key={key} className={`chip${filter === key ? ' on' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        {locError && <div className="map-toast">{locError}</div>}
      </div>

      <button className={`locate-fab${me ? ' on' : ''}`} onClick={locate} disabled={locating} aria-label="Show shops near me">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2.5l7.5 18-7.5-4-7.5 4z" fill="currentColor" transform="rotate(45 12 12)" />
        </svg>
      </button>

      <div className="shop-rail" ref={railRef} onScroll={onRailScroll}>
        {stores === null && <div className="shop-card placeholder">Finding shops…</div>}
        {stores?.length === 0 && <div className="shop-card placeholder">No Regulr shops on the map yet.</div>}
        {stores && stores.length > 0 && visible.length === 0 && (
          <div className="shop-card placeholder">
            No shops match.{' '}
            <button
              className="link-btn"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Show all
            </button>
          </div>
        )}
        {visible.map(({ store, metres }) => (
          <ShopCard key={store.slug} store={store} metres={metres} selected={store.slug === selected} onSelect={() => select(store, true)} />
        ))}
      </div>
    </div>
  );
}
