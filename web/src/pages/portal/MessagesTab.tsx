import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorText, type OwnerStore } from '../../api';
import { timeAgo } from '../../lib/time';

type Audience = 'all' | 'lapsed' | 'close' | 'ready' | 'new';
type Sent = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  audienceDays: number | null;
  recipients: number;
  walletSent: number;
  read: number;
  createdAt: string;
};

const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  { id: 'all', label: 'Everyone', hint: 'All your members' },
  { id: 'lapsed', label: "Haven't visited lately", hint: 'Bring regulars back' },
  { id: 'close', label: 'Close to a reward', hint: '1–2 stamps away' },
  { id: 'ready', label: 'Reward ready', hint: 'Can claim one now' },
  { id: 'new', label: 'New members', hint: 'Joined in the last 7 days' },
];

const TEMPLATES: { label: string; audience: Audience; title: string; body: (store: string) => string }[] = [
  { label: 'We miss you', audience: 'lapsed', title: 'We miss you ☕', body: (s) => `It's been a while! Pop in to ${s} this week, your stamps are waiting.` },
  { label: 'Reward waiting', audience: 'ready', title: 'Your reward is waiting 🎁', body: (s) => `You have enough stamps for a reward at ${s}. Show your card at the counter to claim it.` },
  { label: 'Almost there', audience: 'close', title: 'Almost there!', body: (s) => `You're a stamp or two away from your next reward at ${s}.` },
  { label: 'New on the menu', audience: 'all', title: 'Something new to try', body: (s) => `We've just added something new at ${s}. Come try it and collect a stamp while you're here.` },
  { label: 'Welcome', audience: 'new', title: 'Welcome to the club!', body: (s) => `Thanks for joining ${s} rewards. Every visit gets you closer to a treat.` },
];

const audienceText = (m: Pick<Sent, 'audience' | 'audienceDays'>) =>
  m.audience === 'lapsed' ? `No visit in ${m.audienceDays} days` : AUDIENCES.find((a) => a.id === m.audience)?.label ?? m.audience;

export function MessagesTab({ store }: { store: OwnerStore }) {
  const [audience, setAudience] = useState<Audience>('all');
  const [days, setDays] = useState<14 | 30 | 60>(30);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [reach, setReach] = useState<{ count: number; inWallet: number } | null>(null);
  const [history, setHistory] = useState<{ messages: Sent[]; remainingToday: number; dailyLimit: number; optedOut: number } | null>(null);
  const [msg, setMsg] = useState<{ kind: 'good' | 'bad'; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const loadHistory = useCallback(() => api<NonNullable<typeof history>>(`/api/portal/stores/${store.id}/messages`).then(setHistory), [store.id]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let alive = true;
    setReach(null);
    api<{ count: number; inWallet: number }>(`/api/portal/stores/${store.id}/messages/audience`, {
      method: 'POST',
      body: { audience, ...(audience === 'lapsed' && { days }) },
    }).then((r) => alive && setReach(r));
    return () => {
      alive = false;
    };
  }, [store.id, audience, days]);

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setAudience(t.audience);
    setTitle(t.title);
    setBody(t.body(store.name));
    setMsg(null);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!reach?.count) return;
    if (!confirm(`Send "${title}" to ${reach.count} customer${reach.count === 1 ? '' : 's'}? This can't be undone.`)) return;
    setSending(true);
    try {
      await api(`/api/portal/stores/${store.id}/messages`, {
        method: 'POST',
        body: { title, body, audience, ...(audience === 'lapsed' && { days }) },
      });
      setMsg({ kind: 'good', text: `Sent to ${reach.count} customer${reach.count === 1 ? '' : 's'}.` });
      setTitle('');
      setBody('');
      loadHistory();
    } catch (err) {
      setMsg({
        kind: 'bad',
        text: errorText(err, {
          daily_limit: "You've sent today's 3 messages. You can send more tomorrow.",
          no_recipients: 'Nobody is in this group right now.',
        }),
      });
    }
    setSending(false);
  }

  const outOfSends = history?.remainingToday === 0;

  return (
    <>
      <div className="grid-2">
        <section className="panel">
          <div className="dash-head">
            <h2>New message</h2>
            {history && (
              <span className={`small ${outOfSends ? 'minus' : 'muted'}`}>
                {history.remainingToday} of {history.dailyLimit} left today
              </span>
            )}
          </div>

          <div className="field-label">Start from a template</div>
          <div className="template-row">
            {TEMPLATES.map((t) => (
              <button key={t.label} type="button" className="chip" onClick={() => applyTemplate(t)}>
                {t.label}
              </button>
            ))}
          </div>

          <form className="form" onSubmit={send}>
            <div>
              <div className="field-label">Who gets it</div>
              <div className="audience-grid" role="radiogroup" aria-label="Who gets it">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={audience === a.id}
                    className={`audience${audience === a.id ? ' on' : ''}`}
                    onClick={() => setAudience(a.id)}
                  >
                    <strong>{a.label}</strong>
                    <span>{a.hint}</span>
                  </button>
                ))}
              </div>
              {audience === 'lapsed' && (
                <label className="inline-field">
                  No visit in the last
                  <select value={days} onChange={(e) => setDays(Number(e.target.value) as 14 | 30 | 60)}>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                  </select>
                </label>
              )}
              <p className="reach">
                {reach === null
                  ? 'Counting…'
                  : reach.count === 0
                    ? 'Nobody is in this group right now.'
                    : `Reaches ${reach.count} customer${reach.count === 1 ? '' : 's'} · ${reach.inWallet} get${reach.inWallet === 1 ? 's' : ''} a Google Wallet notification, everyone sees it in the app`}
              </p>
            </div>

            <label>
              <span className="label-row">
                Title <span className="muted small">{title.length}/40</span>
              </span>
              <input required maxLength={40} placeholder="We miss you ☕" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              <span className="label-row">
                Message <span className="muted small">{body.length}/200</span>
              </span>
              <textarea required rows={3} maxLength={200} placeholder="Pop in this week, your stamps are waiting." value={body} onChange={(e) => setBody(e.target.value)} />
            </label>

            {msg && <p className={`notice ${msg.kind}`}>{msg.text}</p>}
            <div>
              <button className="btn" disabled={sending || !reach?.count || outOfSends || !title.trim() || !body.trim()}>
                {sending ? 'Sending…' : reach?.count ? `Send to ${reach.count}` : 'Send'}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>Preview</h2>
          <p className="small muted">How it appears on a customer's lock screen.</p>
          <div className="phone-preview">
            <div className="phone-time">9:41</div>
            <div className="notif">
              <div className="notif-icon" style={{ background: store.bgColor, color: store.textColor }}>
                {store.logoUrl ? <img src={store.logoUrl} alt="" /> : store.name.slice(0, 1)}
              </div>
              <div className="notif-text">
                <div className="notif-top">
                  <span>{store.name}</span>
                  <span>now</span>
                </div>
                <strong>{title || 'Your title'}</strong>
                <p>{body || 'Your message to customers appears here.'}</p>
              </div>
            </div>
          </div>
          <p className="small muted">
            Customers can turn off messages from you on their card.
            {history && history.optedOut > 0 && ` ${history.optedOut} ${history.optedOut === 1 ? 'has' : 'have'} so far.`}
          </p>
        </section>
      </div>

      <section className="panel">
        <h2>Sent messages</h2>
        {!history ? (
          <p className="muted">Loading…</p>
        ) : history.messages.length === 0 ? (
          <p className="muted">Nothing sent yet. Try the "We miss you" template to bring back customers who haven't visited lately.</p>
        ) : (
          <ul className="sent-list">
            {history.messages.map((m) => (
              <li key={m.id}>
                <div className="sent-main">
                  <strong>{m.title}</strong>
                  <p>{m.body}</p>
                  <span className="muted small">
                    {audienceText(m)} · {timeAgo(m.createdAt)}
                  </span>
                </div>
                <div className="sent-stats">
                  <div><strong>{m.recipients}</strong><span>sent</span></div>
                  <div><strong>{m.walletSent}</strong><span>to Wallet</span></div>
                  <div><strong>{m.recipients ? Math.round((m.read / m.recipients) * 100) : 0}%</strong><span>read in app</span></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
