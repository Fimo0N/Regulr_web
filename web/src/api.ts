export class ApiError extends Error {
  constructor(public status: number, public code: string, public data: any) {
    super(code);
  }
}

type Options = { method?: string; body?: unknown; raw?: Blob };

export async function api<T = any>(path: string, { method = 'GET', body, raw }: Options = {}): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: raw ? { 'Content-Type': raw.type } : body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'request_failed', data);
  return data as T;
}

/** Turns a validation error from the API into one readable line. */
export function errorText(err: unknown, messages: Record<string, string> = {}) {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  const issue = err.data?.issues?.[0];
  if (issue) return `${issue.path.join('.')}: ${issue.message}`;
  const text = messages[err.code] ?? err.code.replace(/_/g, ' ');
  return err.data?.detail ? `${text}: ${err.data.detail}` : text;
}

// --- Shapes returned by the API ---

export type Config = { googleClientId: string; devLogin: boolean; googleWallet: boolean };
export type User = { id?: string; name: string | null; email: string };
export type DayHours = { closed: boolean; open: string; close: string };
export type Reward = { id: string; name: string; description: string | null; cost: number; icon: string; active?: boolean };

export type PublicStore = {
  name: string;
  slug: string;
  logoUrl: string | null;
  coverUrl: string | null;
  bgColor: string;
  textColor: string;
  welcomeStamps: number;
  description: string | null;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  hours: DayHours[] | null;
  rewards: Reward[];
};

export type OwnerStore = Omit<PublicStore, 'rewards'> & {
  id: string;
  stampCooldownMinutes: number;
};
