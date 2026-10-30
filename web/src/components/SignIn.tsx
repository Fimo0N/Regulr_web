import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type Config } from '../api';

declare global {
  interface Window {
    google?: any;
  }
}

let gsiScript: Promise<void> | null = null;
function loadGoogleScript() {
  gsiScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return gsiScript;
}

/** Google Sign-In button, plus the email-only dev login when DEV_LOGIN=true. */
export function SignIn({ config, onSignedIn }: { config: Config; onSignedIn: () => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!config.googleClientId) return;
    let cancelled = false;
    loadGoogleScript().then(() => {
      if (cancelled || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async ({ credential }: { credential: string }) => {
          try {
            await api('/api/auth/google', { method: 'POST', body: { credential } });
            onSignedIn();
          } catch {
            setError('Google sign-in failed. Please try again.');
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with' });
    });
    return () => {
      cancelled = true;
    };
  }, [config.googleClientId, onSignedIn]);

  async function devLogin(e: FormEvent) {
    e.preventDefault();
    await api('/api/auth/dev', { method: 'POST', body: { email } });
    onSignedIn();
  }

  return (
    <div className="signin">
      {config.googleClientId && <div ref={buttonRef} />}
      {config.devLogin && (
        <form className="dev-login" onSubmit={devLogin}>
          <p className="muted small">Dev login (local only)</p>
          <input type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn">Continue</button>
        </form>
      )}
      {!config.googleClientId && !config.devLogin && <p className="muted">Sign-in is not configured.</p>}
      {error && <p className="notice bad">{error}</p>}
    </div>
  );
}
