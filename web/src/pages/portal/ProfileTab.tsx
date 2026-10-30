import { useRef, useState, type FormEvent } from 'react';
import { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import { api, errorText, type DayHours, type OwnerStore } from '../../api';
import { DEFAULT_VIEW, MapView } from '../../components/MapView';
import { DAYS, DEFAULT_HOURS } from '../../lib/hours';

type Msg = { kind: 'good' | 'bad' | 'info'; text: string } | null;
type Pin = { lat: number; lng: number } | null;

const TIMEZONES = Intl.supportedValuesOf('timeZone');

export function ProfileTab({ store, onUpdated }: { store: OwnerStore; onUpdated: (s: OwnerStore) => void }) {
  const [description, setDescription] = useState(store.description ?? '');
  const [address, setAddress] = useState(store.address ?? '');
  const [phone, setPhone] = useState(store.phone ?? '');
  const [timezone, setTimezone] = useState(store.timezone);
  const [pin, setPin] = useState<Pin>(store.latitude !== null && store.longitude !== null ? { lat: store.latitude, lng: store.longitude } : null);
  const mapRef = useRef<MapRef>(null);
  const [hasHours, setHasHours] = useState(Boolean(store.hours));
  const [hours, setHours] = useState<DayHours[]>(store.hours ?? DEFAULT_HOURS);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  function setDay(i: number, patch: Partial<DayHours>) {
    setHours((h) => h.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  // Free address search from OpenStreetMap (Nominatim). Their policy allows light,
  // user-triggered use like this one; don't call it automatically on every keystroke.
  async function findOnMap() {
    if (!address.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`);
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (!hit) {
        setMsg({ kind: 'info', text: "Couldn't find that address. Click on the map to place the pin yourself." });
      } else {
        const found = { lat: Number(hit.lat), lng: Number(hit.lon) };
        setPin(found);
        mapRef.current?.flyTo({ center: [found.lng, found.lat], zoom: 17, duration: 700 });
        setMsg({ kind: 'info', text: 'Pin placed. Drag it if it is not exactly on your door, then save.' });
      }
    } catch {
      setMsg({ kind: 'bad', text: 'Address search is unavailable right now. Click on the map to place the pin.' });
    }
    setSearching(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      const { store: updated } = await api<{ store: OwnerStore }>(`/api/portal/stores/${store.id}`, {
        method: 'PATCH',
        body: {
          description,
          address,
          phone,
          latitude: pin?.lat ?? null,
          longitude: pin?.lng ?? null,
          hours: hasHours ? hours : null,
          timezone,
        },
      });
      onUpdated(updated);
      setMsg({ kind: 'good', text: pin ? 'Saved. Your store is on the customer map.' : 'Saved. Place a pin on the map to appear in Discover.' });
    } catch (err) {
      setMsg({ kind: 'bad', text: errorText(err) });
    }
  }

  return (
    <form className="grid-2" onSubmit={save}>
      <section className="panel">
        <h2>About your store</h2>
        <div className="form">
          <label>
            Short description
            <textarea rows={3} maxLength={300} placeholder="Specialty coffee and fresh pastries since 2019." value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Phone
            <input placeholder="+36 30 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            Address
            <div className="row-inline">
              <input placeholder="Street, number, city" value={address} onChange={(e) => setAddress(e.target.value)} />
              <button type="button" className="btn secondary" onClick={findOnMap} disabled={searching || !address.trim()}>
                {searching ? 'Searching…' : 'Find on map'}
              </button>
            </div>
          </label>
        </div>

        <label className="spaced-sm">
          Timezone
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <span className="small muted">Opening hours, happy hours and birthdays use this clock.</span>
        </label>

        <h2 className="spaced">Opening hours</h2>
        <label className="check">
          <input type="checkbox" checked={hasHours} onChange={(e) => setHasHours(e.target.checked)} /> Show opening hours to customers
        </label>
        {hasHours && (
          <div className="hours-editor">
            {hours.map((d, i) => (
              <div className="hours-row" key={DAYS[i]}>
                <span className="day">{DAYS[i].slice(0, 3)}</span>
                <label className="check">
                  <input type="checkbox" checked={!d.closed} onChange={(e) => setDay(i, { closed: !e.target.checked })} /> Open
                </label>
                {!d.closed ? (
                  <>
                    <input type="time" value={d.open} onChange={(e) => setDay(i, { open: e.target.value })} />
                    <span className="muted">–</span>
                    <input type="time" value={d.close} onChange={(e) => setDay(i, { close: e.target.value })} />
                  </>
                ) : (
                  <span className="muted small">Closed</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Location on the map</h2>
        <p className="small muted">Customers find you in Discover. Use "Find on map", or click the map to drop the pin, then drag it onto your door.</p>
        <div className="picker-map">
          {/* Click anywhere to place the pin; drag it to fine-tune. */}
          <MapView
            ref={mapRef}
            initialViewState={pin ? { longitude: pin.lng, latitude: pin.lat, zoom: 17 } : DEFAULT_VIEW}
            onClick={(e) => setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
            cursor="crosshair"
          >
            <NavigationControl position="top-right" showCompass={false} />
            {pin && (
              <Marker
                longitude={pin.lng}
                latitude={pin.lat}
                anchor="bottom"
                draggable
                onDragEnd={(e) => setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
              >
                <div className="drop-pin" />
              </Marker>
            )}
          </MapView>
        </div>
        <div className="row-inline spaced-sm">
          <span className="small muted">{pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : 'No pin yet: your store is hidden from Discover.'}</span>
          {pin && (
            <button type="button" className="btn secondary small-btn" onClick={() => setPin(null)}>Remove pin</button>
          )}
        </div>
        {msg && <p className={`notice ${msg.kind}`}>{msg.text}</p>}
        <button className="btn">Save profile</button>
      </section>
    </form>
  );
}
