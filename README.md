# Regulr

NFC + Google Wallet loyalty cards for independent shops. Customers join by scanning a counter QR code, the cashier taps an NFC card on their phone for each stamp, and stamps are spent on the shop's reward menu. No app download.

The **web card** (`/s/<store>`) is the source of truth and works on any phone, iPhone included. Google Wallet mirrors the balance; Apple Wallet can be added later as a second provider in `src/wallet/`.

## Run it locally

```bash
npm install
cp .env.example .env      # DEV_LOGIN=true lets you sign in with just an email
npx prisma db push        # creates the SQLite database
npm run dev               # http://localhost:3000
```

1. Open `http://localhost:3000/portal`, sign in, create a store, add rewards.
2. Under **Store profile**, set the address and drop the map pin so the store shows in Discover.
3. Under **NFC & QR**, add a *Basic* card and copy its URL.
4. Open that URL in another browser (or a phone). That's what a cashier tap does.

`npm run dev` runs the API and the React app together on port 3000 (Vite runs inside Express), so the tunnel and NFC links work unchanged. Frontend edits reload instantly.

`npm test` checks the NTAG 424 DNA crypto against NXP's published example.
`npm run typecheck` checks both the server and the React app.

After changing `prisma/schema.prisma`, stop the server first, then run `npx prisma db push`. On Windows the running server locks Prisma's engine file.

### Production

```bash
npm run build                      # builds the React app into web/dist
NODE_ENV=production npm start      # or set NODE_ENV=production in .env
```

### Testing on a real phone

NFC tags need a URL your phone can reach, so `localhost` won't work. Run a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000` or ngrok), set `PUBLIC_URL` to the tunnel URL, restart, and write the card URL from the portal onto your NFC card with the **NFC Tools** app (Write → Add a record → URL).

## How it works

| Step | URL | What happens |
| --- | --- | --- |
| Join | `/s/<store>` (counter QR) | Google sign-in, welcome stamp, optional "Add to Google Wallet" |
| Tap | `/t/<store>?…` (NFC card) | Tap is verified, a 5-minute *tap session* is created, browser goes to the card page |
| Stamp | card page | Tap session becomes +1 stamp (once per tap, respecting the store's cooldown) |
| Redeem | card page | Only allowed during a fresh tap session, one reward per tap, then a live ticking-clock screen for the cashier |

Anti-cheat built in:
- A tap can be claimed by one customer only, and gives at most one stamp.
- Rewards can only be claimed within 5 minutes of a real tap, so nobody can redeem from home.
- Per-store cooldown between stamps (default 2 hours).
- Every stamp and redemption appears in the merchant's live activity feed.

## App pages

| URL | Who | What |
| --- | --- | --- |
| `/cards` | Customer | All their loyalty cards with balances and progress |
| `/discover` | Customer | Map of Regulr shops (OpenStreetMap), "near me", open/closed, directions |
| `/s/<store>` | Customer | One card: stamps, reward menu, store info, history |
| `/account` | Customer | Sign out, delete account and data |
| `/portal` | Shop owner | Activity, card design + logo upload, store profile (map pin, hours), rewards, NFC cards + QR |

## Code map

```
src/                     Server (Express + Prisma)
  server.ts              App setup; runs Vite in dev, serves web/dist in production
  config.ts              Environment variables
  auth.ts                Google Sign-In, dev login, session cookie
  loyalty.ts             Join, stamp, redeem (all the business rules)
  stores.ts              Store profile shapes and opening-hours validation
  nfc/                   Tap verification (basic secret or NTAG 424 DNA)
  wallet/                Wallet providers (Google now, Apple later)
  routes/                Customer API, store portal API, NFC tap URL
web/                     React app (Vite)
  src/pages/             Customer pages
  src/pages/portal/      Store portal tabs
  src/components/        Shared UI (card, sign-in, store info)
prisma/schema.prisma     Database
uploads/                 Uploaded logos (local disk; move to object storage for production)
```

Maps use OpenStreetMap tiles and Nominatim address search, both free. Before heavy production traffic, switch tiles to a hosted provider (MapTiler, Stadia, Carto) as OSM's usage policy asks.

## Google setup

**Sign-In:** Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Add your `PUBLIC_URL` to *Authorized JavaScript origins*. Put the client ID in `GOOGLE_CLIENT_ID`.

**Wallet:**
1. Create an issuer account at the [Google Pay & Wallet Console](https://pay.google.com/business/console) and copy the Issuer ID.
2. In Google Cloud, enable the **Google Wallet API**, create a service account, and download its JSON key into `secrets/`.
3. In the Wallet console, add the service account's email as a user on the issuer account.
4. Set `GOOGLE_WALLET_ISSUER_ID` and `GOOGLE_WALLET_KEY_FILE`.
5. Each store needs a logo before its Wallet card can be created. Uploaded logos are served from `PUBLIC_URL`, so it must be public `https://` (your tunnel or production domain).
6. Each customer's card shows a picture of the reward ladder (the store's cover photo with one icon per reward) drawn by `src/wallet/art.ts` from `shared/stampArt.ts`, the same drawing the web card uses. Its URL changes with the balance and design, because Google caches images by URL.
7. Stamps and claimed rewards send a Wallet notification ("Croissant is ready!"). Google shows about 3 per card per day; the rest only appear in the card's details.

New issuer accounts are in **demo mode**: only test accounts you add in the console can save passes. Request publishing access early, as Google reviews it (mention you issue cards on behalf of several merchants).

## NTAG 424 DNA (production cards)

Basic cards hold a fixed URL that anyone who reads it could copy, so they're for testing only. NTAG 424 DNA cards sign every tap.

1. Generate two random keys and set them in `.env`:
   `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"` → `SUN_META_KEY`, again → `SUN_MASTER_KEY`.
2. Read the card's UID, then run `npm run tag:key -- <UID>` to get its keys.
3. With **NXP TagWriter** (or a similar SDM tool), set up Secure Dynamic Messaging on the NDEF file:
   URL `https://<your-domain>/t/<store>?picc=<32 zeros>&cmac=<16 zeros>`, encrypted PICC data (UID + counter) mirrored into `picc` with the meta read key, SDM MAC mirrored into `cmac` with the file read key, MAC input = empty (MAC input offset = MAC offset).
4. Register the card in the portal (*NTAG 424 DNA*, with its UID).

## Before real customers

- Switch Prisma to Postgres (`provider = "postgresql"` in `prisma/schema.prisma`) and set `DATABASE_URL`.
- Set `NODE_ENV=production`, a long `SESSION_SECRET`, and `DEV_LOGIN=false`.
- Add a privacy policy and data deletion (GDPR if you operate in the EU).
- Not built yet: win-back campaigns, rate limiting, Apple Wallet.
