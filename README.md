# Gagyebu: Couple and Personal Finance Trackers

Gagyebu is a pair of local-first finance apps for macOS, Windows, and iPhone:

- **Our Ledger** (`couple/`) helps two people track shared and personal spending, split costs, and settle up.
- **My Ledger** (`personal/`) tracks one person's spending, income, budgets, payment methods, card balances, and net worth.

Both apps work offline, support English and Korean, and can optionally sync through a Supabase project that you control. There is no developer-operated data backend, and the developer cannot see your financial records.

## Try or download

- Our Ledger web app: [piggyduo.netlify.app](https://piggyduo.netlify.app)
- My Ledger web app: [piggybox.netlify.app](https://piggybox.netlify.app)
- macOS and Windows installers: [Gagyebu Releases](https://github.com/yhkimslv/gagyebu-releases/releases)

For iPhone, open either web app in Safari, tap **Share**, and choose **Add to Home Screen**.

## Highlights

### Our Ledger

- Shared and personal expenses in one ledger
- Live settlement balance showing who owes whom
- Configurable split ratios, including 0/100 and asymmetric splits
- Fixed monthly shares for rent, utilities, and other recurring household costs
- Per-person spending totals and selectable transaction sums
- Recurring expenses, savings goals, budgets, tips, calendar views, and statistics
- Search and transaction history by payment method
- Editable, bilingual categories with drag-and-drop ordering

### My Ledger

- Expenses, income, budgets, calendar views, and detailed statistics
- Credit-card, debit-account, cash, and other payment-method balances
- Balance baselines with an as-of date and optional backdated adjustment tracking
- Credit-card payment records without double-counting monthly spending
- Search and transaction history by payment method
- Recurring expenses, savings goals, tips, and CSV export
- Optional passcode and biometric screen lock where supported
- Import from Our Ledger with personal-share accounting

When a shared expense is imported from Our Ledger, My Ledger uses only your share for monthly spending, budgets, and statistics. If you paid, the full charge remains in your card balance and card history. If your partner paid, your share appears in spending reports without affecting your cards. Settlement records are excluded from spending totals to prevent double-counting.

### Both apps

- English and Korean interfaces
- USD and KRW display options, stored per device
- Offline-first storage
- Optional cross-device sync through your own Supabase project
- Editable transactions and recurring rules
- Keyboard-friendly forms and search
- Light and dark modes
- Installable Progressive Web App for iPhone
- Electron desktop apps for Apple silicon, Intel Mac, and Windows x64

## Run locally

Requirements:

- Node.js 20 or later
- npm

```bash
git clone https://github.com/yhkimslv/gagyebu.git
cd gagyebu/couple       # or: cd gagyebu/personal
npm install
npm start
```

The app is fully usable without sync. Data remains on that device unless you configure Supabase.

## Optional device sync

Each app includes a `supabase_setup.sql` file.

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the relevant `supabase_setup.sql`, and run it.
3. Under **Settings > API**, copy the project URL and `anon public` key.
4. Enter those values and a private sync code in the app's settings.
5. Enter the same three values on every device that should share that ledger.

Use different sync codes for Our Ledger and My Ledger, even if they share one Supabase project. Never place a `service_role` key in the app. Anyone who knows the project details and sync code can access that ledger, so treat the code like a password.

## Host the iPhone web app

Each app's `renderer/` directory is a complete static web app. It can be hosted on Netlify, Cloudflare Pages, GitHub Pages, or any static host.

To use the included Netlify deployment script:

```bash
cd couple                    # or: cd personal
cp deploy.config.example.json deploy.config.json
# Fill in deploy.config.json.
npm run deploy
```

`deploy.config.json` and generated `renderer/config.js` files are ignored by Git. Do not commit credentials or private deployment configuration.

## Build desktop installers

From either app directory:

```bash
npm run build:mac
npm run build:win
npm run build:all
```

The build creates DMGs for Apple silicon and Intel Macs plus installer and portable executables for Windows x64.

The public builds are ad-hoc signed on macOS and are not notarized by Apple or signed by Microsoft. The first launch may show an unidentified-developer warning. On macOS, use **right-click > Open**. On Windows, review the warning and choose **More info > Run anyway** only if you downloaded the file from the official Releases page.

## Repository layout

```text
gagyebu/
├── couple/                 # Our Ledger
│   ├── renderer/           # Static PWA and shared UI logic
│   ├── build/              # Electron build and deployment scripts
│   └── supabase_setup.sql
├── personal/               # My Ledger
│   ├── renderer/
│   ├── build/
│   └── supabase_setup.sql
├── notify/                 # Optional scheduled web-push sender
└── .github/workflows/      # Notification workflow
```

The renderer uses browser APIs without a front-end framework. Electron packages the same renderer for desktop. Data writes are local first; synchronization catches up when a connection is available. Deletions use tombstones so removed records do not reappear on another device.

## Privacy and security

- Financial records are stored locally and, if enabled, in your own Supabase project.
- The app lock is a screen lock, not full database encryption.
- Supabase free projects may pause after inactivity and can be restored from the Supabase dashboard.
- The apps display USD or KRW but do not perform currency conversion.
- Do not commit `deploy.config.json`, generated configuration, private keys, or real sync codes.

## Detailed guides

- [Our Ledger documentation](couple/README.md)
- [My Ledger documentation](personal/README.md)

## License

MIT. See [LICENSE](LICENSE).
