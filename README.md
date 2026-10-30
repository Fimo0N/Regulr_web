# Regulr

NFC + Google Wallet loyalty cards for independent shops. Customers join by scanning a counter QR code, the cashier taps an NFC card on their phone for each stamp, and stamps are spent on the shop's reward menu. No app download.

The **web card** (`/s/<store>`) is the source of truth and works on any phone, iPhone included. Google Wallet mirrors the balance; Apple Wallet can be added later as a second provider in `src/wallet/`.

## Deploy to Vercel

The app runs on Vercel as a static React app plus one serverless function (`api/index.js`) for the API, NFC tap links and Wallet pictures. Data lives in **Neon Postgres** and uploaded images in **Vercel Blob**, both added from the Vercel dashboard.

1. **Import the repo:** Vercel → Add New → Project → pick this GitHub repo. Leave the build settings alone (`vercel.json` sets them). Don't deploy yet if it offers; if it does, the first build fails until step 2 is done.
2. **Database:** Project → Storage → Create Database → **Neon** → connect it to the project. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. **Uploads:** Project → Storage → Create → **Blob** → connect it. This sets `BLOB_STORE_ID` (or `BLOB_READ_WRITE_TOKEN` on older stores). Choose **Public** access.
4. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Value |
   | --- | --- |
   | `PUBLIC_URL` | `https://<your-domain>` (no trailing slash) |
   | `SESSION_SECRET` | a long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `GOOGLE_CLIENT_ID` | the OAuth client ID |
   | `GOOGLE_WALLET_ISSUER_ID` | the Wallet issuer ID |
   | `GOOGLE_WALLET_KEY_JSON` | the whole contents of `secrets/regulr.json` |
   | `VITE_WEBSITE_URL` | the marketing website, for the privacy link |

   Never set `DEV_LOGIN` on Vercel (the server refuses to start with it in production).
5. **Deploy.** The build runs `prisma migrate deploy` (creates/updates the tables), builds the React app and bundles the server.
6. **Domain:** Project → Settings → Domains → add yours (e.g. `app.regulr.app`) and follow the DNS steps.
7. **Google:** add `https://<your-domain>` to the OAuth client's *Authorized JavaScript origins*.
8. **NFC cards:** write the card URLs from the portal's NFC & QR tab onto your cards. They never change again.

## Run it locally

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL + DATABASE_URL_UNPOOLED
npx prisma migrate deploy # creates the tables
npm run dev               # http://localhost:3000
```

For a local database, create a **`dev` branch** of the Neon database (Neon console → Branches) and use its connection strings, so testing never touches real customers. Without a Blob store, uploads are saved to `uploads/`. `DEV_LOGIN=true` lets you sign in with just an email.

1. Open `http://localhost:3000/portal`, sign in, create a store, add rewards.
2. Under **Store profile**, set the address and drop the map pin so the store shows in Discover.
3. Under **NFC & QR**, add a *Basic* card and copy its URL.
4. Open that URL in another browser (or a phone). That's what a cashier tap does.

`npm run dev` runs the API and the React app together on port 3000 (Vite runs inside Express). Frontend edits reload instantly.

`npm test` checks the NTAG 424 DNA crypto and the Wallet card logic. `npm run typecheck` checks both the server and the React app.

**Changing the database:** edit `prisma/schema.prisma`, stop the server (on Windows it locks Prisma's engine file), then `npm run db:migrate -- --name <what-changed>`. Commit the new folder in `prisma/migrations/`; Vercel applies it on the next deploy.

### Testing on a real phone

NFC tags need a URL your phone can reach, so `localhost` won't work. Either use the Vercel deployment, or run a tunnel (`cloudflared tunnel --url http://localhost:3000`), set `PUBLIC_URL` to it and restart.

### Other Node hosts

`npm start` runs everything as one long-lived server (needs `npm run build` first and `NODE_ENV=production`).

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
| `/inbox` | Customer | Messages from joined shops (also sent as Wallet notifications) |
| `/account` | Customer | Birthday (for birthday bonuses), sign out, delete account and data |
| `/portal` | Shop owner | Dashboard (stats), customers (adjust stamps), messages, card design + cover photo, store profile (map pin, hours, timezone), rewards (limited-time, per-customer limits), promotions (happy hours, birthday bonus), NFC cards (1–5 stamps per tap) + QR |

## Code map

```
api/index.js             Vercel serverless function (loads the bundled src/app.ts)
vercel.json              Vercel build settings and URL routing
src/                     Server (Express + Prisma)
  app.ts                 Routes and middleware (what Vercel runs)
  server.ts              Local/long-lived server: app.ts + Vite in dev, web/dist in production
  uploads.ts             Image storage: Vercel Blob, or uploads/ locally
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
shared/stampArt.ts       Card picture (reward ladder), used by server and web app
prisma/schema.prisma     Database (Postgres)
prisma/migrations/       Database changes, applied on deploy
```

Maps use OpenStreetMap tiles and Nominatim address search, both free. Before heavy production traffic, switch tiles to a hosted provider (MapTiler, Stadia, Carto) as OSM's usage policy asks.

## Google setup

**Sign-In:** Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Add your `PUBLIC_URL` to *Authorized JavaScript origins*. Put the client ID in `GOOGLE_CLIENT_ID`.

**Wallet:**
1. Create an issuer account at the [Google Pay & Wallet Console](https://pay.google.com/business/console) and copy the Issuer ID.
2. In Google Cloud, enable the **Google Wallet API**, create a service account, and download its JSON key into `secrets/`.
3. In the Wallet console, add the service account's email as a user on the issuer account.
4. Set `GOOGLE_WALLET_ISSUER_ID`, plus `GOOGLE_WALLET_KEY_FILE` locally or `GOOGLE_WALLET_KEY_JSON` on Vercel.
5. Each store needs a logo before its Wallet card can be created. `PUBLIC_URL` must be public `https://` (your domain or a tunnel), because Google downloads the pictures from it.
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

- Long random `SESSION_SECRET`, no `DEV_LOGIN` (covered by the Vercel steps above).
- Replace Basic NFC cards with NTAG 424 DNA cards.
- Request Google Wallet publishing access.
- Not built yet: win-back campaigns, rate limiting, Apple Wallet.
