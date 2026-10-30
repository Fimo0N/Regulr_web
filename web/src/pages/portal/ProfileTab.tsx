import { useEffect, useState, type FormEvent } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { api, errorText, type DayHours, type OwnerStore } from '../../api';
import { DAYS, DEFAULT_HOURS } from '../../lib/hours';

type Msg = { kind: 'good' | 'bad' | 'info'; text: string } | null;
type Pin = { lat: number; lng: number } | null;

const pinIcon = L.divIcon({ className: '', html: '<div class="drop-pin"></div>', iconSize: [28, 28], iconAnchor: [14, 28] });

/** Click anywhere to place the pin; the pin can also be dragged. */
function PinPicker({ pin, onChange }: { pin: Pin; onChange: (p: Pin) => void }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  if (!pin) return null;
  return (
    <Marker
      position={[pin.lat, pin.lng]}
      icon={pinIcon}
      draggable
      eventHandlers={{ dragend: (e) => onChange({ lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng }) }}
    />
  );
}

function FlyTo({ target }: { target: Pin }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 17, { duration: 0.6 });
  }, [target, map]);
  return null;
}

export function ProfileTab({ store, onUpdated }: { store: OwnerStore; onUpdated: (s: OwnerStore) => void }) {
  const [description, setDescription] = useState(store.description ?? '');
  const [address, setAddress] = useState(store.address ?? '');
  const [phone, setPhone] = useState(store.phone ?? '');
  const [pin, setPin] = useState<Pin>(store.latitude !== null && store.longitude !== null ? { lat: store.latitude, lng: store.longitude } : null);
  const [flyTarget, setFlyTarget] = useState<Pin>(null);
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
        setFlyTarget(found);
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
          <MapContainer center={pin ? [pin.lat, pin.lng] : [47.4979, 19.0402]} zoom={pin ? 17 : 12} className="map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <PinPicker pin={pin} onChange={setPin} />
            <FlyTo target={flyTarget} />
          </MapContainer>
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
