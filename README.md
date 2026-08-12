# Gagyebu — a household ledger for two, and for one

*[한국어 설명서](README.ko.md)*

Two ledger apps I built for my own use. They run as macOS / Windows desktop apps
and as an iPhone web app (add to Home Screen), sharing the same records.

- **우리 가계부 / Our Ledger** (`couple/`) — for two people. Built around settling up.
- **내 가계부 / My Ledger** (`personal/`) — for one person. Built around card balances
  and net worth.

There is no backend. Records live on your device, and travel between your own
devices only through a free [Supabase](https://supabase.com) project that **you**
create. **I cannot see your records.**

> The interface is in Korean only. The code and docs are in both languages.

---

## What it does

### Our Ledger (couple)

- **Settling up** — each category decides whether a purchase is shared or personal,
  and one line tells you who owes whom, right now.
- **Fixed costs, fixed share** — for when one person pays the rent and utilities while
  the other sends a set amount every month. You mark which month a prepayment is for,
  so the balance lands on zero at month's end.
- **Out-of-budget spending** — one-off costs (an appliance, a car repair) are kept out
  of the month's living budget, and the app works out how much extra each person owes.
- **Tip calculator** — enter a percentage, a tip amount, or the final total. Any of the three.
- **Name reconciliation** — if the two of you typed each other's names differently,
  they merge into one the moment your devices connect.

### My Ledger (personal)

- **Card balances and net worth** — give each credit card the balance you owe today,
  and each debit/cash account what you actually hold. Spending moves both automatically.
- **Paying cards off** — records which account the payment came from, so both sides move.
  Payments don't count as spending for the month (that would count the money twice).
- **App lock** — passcode plus Touch ID on macOS and Face ID on iPhone.
- **Import from the couple ledger** — pulls in only what actually left your own pocket:
  what you paid for, and settlements you sent or received.

### Both

Card reward rates with a "use this card" hint · recurring expenses · calendar ·
statistics · CSV export · budgets · savings goals · dark mode · phone notifications.

---

## Getting started

### 1. Run it

```bash
git clone <this repo>
cd couple          # or: cd personal
npm install
npm start
```

That's a complete, working app. Records stay on this computer. Everything below is
**only** needed if you want several devices to share them.

### 2. Connect your devices (Supabase, free)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in `supabase_setup.sql`, and Run.
3. Under **Settings → API**, copy the `Project URL` and the `anon public` key.
4. Put those two, plus any code you like (say `US-A1B2C3`), into the app's settings.
   Enter the **same three values** on every device that should share the ledger.

> Use the `anon public` key. Never put the `service_role` key in the app.
> These tables are readable and writable by anyone who knows the code — treat the
> code like a password.

### 3. Put it on the web (optional)

To use it on a phone you need it hosted somewhere. `renderer/` is a plain static
folder, so Netlify, Cloudflare Pages, GitHub Pages — anything will do.

To use the deploy script in this repo:

```bash
cp deploy.config.example.json deploy.config.json   # fill it in
npm run deploy
```

`deploy.config.json` is gitignored, so it won't be committed by accident.

| Key | Meaning |
|---|---|
| `site`, `siteId` | Netlify site name and ID |
| `releaseRepo` | GitHub repo to upload installers to. Leave empty to skip |
| `updateBase` | Where `version.json` lives. Leave empty to skip update checks |
| `vapidPublic` | Public key for push notifications. Leave empty to disable them |

On iPhone, open it in Safari and use **Share → Add to Home Screen**.

### 4. Build installers (optional)

```bash
npm run build:mac      # macOS (arm64 and x64 dmg)
npm run build:win      # Windows (installer and portable)
npm run build:all
```

These are not code-signed by Apple or Microsoft (it costs money yearly), so the first
launch shows an "unidentified developer" warning. On macOS, **right-click → Open**.

### 5. Phone notifications (optional)

Something has to send them. `notify/` holds a script that runs on GitHub Actions.

```bash
npx web-push generate-vapid-keys     # a public/private pair
```

- public key → `vapidPublic` in `deploy.config.json`
- private key → repo **Settings → Secrets** as `VAPID_PRIVATE`
- other secrets: `SUPABASE_URL` `SUPABASE_KEY` `COUPLE_CODE` `VAPID_PUBLIC`
  (`VAPID_EMAIL`, `UPDATE_URL` optional)

**Never put the private key in the app.** Anyone holding it can send notifications
to your users.

iPhone needs iOS 16.4 or later, and only delivers to apps **added to the Home Screen** —
not to a Safari tab.

---

## How it's built

- No framework. Browser APIs only. There is no build step: serve `renderer/` and it's
  a web app; wrap it in Electron and it's a desktop app.
- **Device first.** Everything works offline. Syncing catches up afterwards.
- Conflicts are resolved **per setting**, not per blob — adding a card on one device
  won't overwrite a budget set on the other.
- Deletions leave a tombstone rather than vanishing, so they don't come back to life
  on another device.
- Comments explain **why**, not what. The code already says what.

## Things worth knowing

- The app lock is a **screen lock, not encryption**. Anyone logged into the device can
  read the data file directly.
- Free Supabase projects pause after a stretch of inactivity. You can restore them
  from the dashboard.
- Currencies: US dollars and Korean won. No conversion between them.
- The interface is Korean only.

## License

MIT — see [LICENSE](LICENSE).
