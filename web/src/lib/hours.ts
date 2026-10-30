import type { DayHours, PublicStore } from '../api';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DEFAULT_HOURS: DayHours[] = DAYS.map((_, i) => ({ closed: i === 6, open: '08:00', close: i >= 5 ? '16:00' : '18:00' }));

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Index into a Monday-first week for a JS date (getDay() is Sunday-first). */
const weekday = (d: Date) => (d.getDay() + 6) % 7;

/** "Open · closes 18:00" / "Closed · opens Mon 08:00", in the viewer's local time. */
export function openStatus(hours: DayHours[] | null, now = new Date()): { open: boolean; text: string } | null {
  if (!hours) return null;
  const today = hours[weekday(now)];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (!today.closed && nowMin >= minutes(today.open) && nowMin < minutes(today.close)) {
    return { open: true, text: `Open · closes ${today.close}` };
  }
  for (let i = 0; i < 7; i++) {
    const idx = (weekday(now) + i) % 7;
    const day = hours[idx];
    if (day.closed) continue;
    if (i === 0 && nowMin >= minutes(day.open)) continue;
    return { open: false, text: `Closed · opens ${i === 0 ? '' : `${DAYS[idx].slice(0, 3)} `}${day.open}` };
  }
  return { open: false, text: 'Closed' };
}

export function directionsUrl(store: Pick<PublicStore, 'latitude' | 'longitude'>) {
  return `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;
}

/** Straight-line distance in metres. */
export function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}
