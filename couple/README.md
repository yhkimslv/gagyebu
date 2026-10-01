# Our Ledger

Our Ledger is a shared expense tracker for two people. It runs as a desktop app on macOS and Windows and as an installable web app on iPhone. Both people can add entries from their own devices, sync one shared ledger, and see who owes whom.

The interface supports both English and Korean. Language and display currency are stored per device, so one person can use English and USD while the other uses Korean without overwriting the first person's display preferences. The app does not convert currencies; both people should record transactions in the same real-world currency.

## Features

- Shared and personal expenses in one ledger
- Automatic settlement calculation based on who paid and each person's share
- Custom split ratios, including 50/50, 60/40, 0/100, and other percentages
- Fixed monthly shares for rent, utilities, and other fixed costs
- Transfer and settlement records without duplicating spending
- Editable expense, income, settlement, and recurring-expense entries
- Recurring monthly expenses
- Tip calculator with presets or custom tip and total values
- Monthly budget, previous-month comparison, calendar, and statistics
- Category totals, daily totals, each person's spending, and payment-method totals
- Multi-category selection with a combined total in statistics
- Saving goals for money set aside together
- Payment-method management with card type, statement day, notes, and reward rates
- Optional starting balance and balance date for each payment method
- Card-specific history and payment-method filtering
- Search by note, category, person, payment method, text contained anywhere in a word, or Korean initial consonants
- Bilingual custom category names, editable built-in labels, and drag-and-drop category ordering
- CSV export
- Offline use with automatic synchronization after reconnecting
- Light and dark mode
- Update prompts for the desktop and Home Screen versions

## Download and install

Download a desktop build from the [GitHub Releases page](https://github.com/yhkimslv/gagyebu-releases/releases). Choose the release labeled for Our Ledger and the version announced by the app.

Choose the file for your computer:

- Windows installer: `setup-<version>-win.exe`
- Apple silicon Mac: `setup-<version>-mac-arm64.dmg`
- Intel Mac: `setup-<version>-mac-x64.dmg`

The desktop builds use ad-hoc signing rather than a paid Apple or Microsoft signing certificate. On first launch, your operating system may show a warning:

- On Windows, choose **More info**, then **Run anyway**.
- On macOS, Control-click the app, choose **Open**, and confirm.

Your existing data remains in place when you install a newer version.

## Install on iPhone as a Home Screen app

The iPhone version is a Progressive Web App (PWA), so it does not require the App Store.

If a hosted URL has already been provided to you:

1. Open the URL in **Safari**.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Open **Our Ledger** from the new Home Screen icon.

The Home Screen app works offline. Changes made while offline are stored on the device and sync after the connection returns. When a new web version is available, use the in-app **Update** button.

### Host the PWA yourself

One person only needs to publish it once; both people then use the same URL.

1. Create a free account at [Netlify](https://app.netlify.com/).
2. Deploy the complete `renderer` directory.
3. Open the resulting HTTPS URL in Safari and follow the Home Screen steps above.

For later updates, deploy the same `renderer` directory to the existing Netlify site. Increase the cache name in `renderer/sw.js` whenever the web assets change so installed devices fetch the new version.

## Shared and personal spending

Every expense is either **Shared** or **Personal**.

- Shared expenses take part in settlement calculations.
- Personal expenses remain in the ledger but do not affect the amount owed between the two people.

Each expense category has a default mode. For example, groceries can default to Shared while shopping can default to Personal. You can change the default in **Settings → Categories** or override it for a single entry while entering the expense.

### Split ratios

Shared spending defaults to 50/50. In **Settings → The two of us**, either person can set a different ratio. The ratio is stored together with the name of the person it belongs to, so both devices calculate complementary shares correctly.

Example: if Alex's share is 60%, a $100 shared expense assigns $60 to Alex and $40 to the partner. If one person paid the full charge, settlement includes only the other person's share owed to the payer.

### Fixed monthly shares

Fixed costs can use a flat monthly share instead of the regular ratio. This is useful when one person sends a set amount for rent and utilities while the other person pays the bills.

1. Enter the fixed amount in **Settings → The two of us**.
2. Record any advance payment with **Record a transfer** and select the month it covers.
3. Enter rent and utility charges as Shared expenses in the Fixed costs category.
4. The settlement view shows how much of the fixed amount has been used and whether anything remains.

The fixed amount is also tied to its owner, so it stays correct when viewed from the partner's device.

### Recording a settlement

When money actually changes hands, use **Mark as settled** or **Record a transfer**. The transfer reduces the settlement balance but is not counted again as a new purchase.

## Payment methods, balances, and card history

Add cards and accounts in **Settings → Payment methods**. Each payment method can include:

- Credit, debit, cash, or other type
- Monthly statement/payment day
- A free-form perks note
- Category-specific reward rates and a default reward rate
- An optional starting amount and balance start date

For a credit card, the app treats the starting amount as the outstanding balance and adds later charges while subtracting payments or refunds. For debit or cash, it adds income and subtracts expenses.

The start date represents the beginning of that day, so entries on the start date are included. You can also choose whether later additions, edits, or deletions of entries dated before the start date should adjust the current balance. The app stores a baseline snapshot so older entries are not counted twice.

Open a payment method from Statistics or use the payment-method filter in Entries to review that card's transaction history. Searching also matches payment-method names.

## Categories

Open **Settings → Categories** to:

- Add an expense or income category
- Supply both a Korean and an English display name
- Edit existing category names and icons
- Choose whether an expense category defaults to Shared or Personal
- Turn the tip calculator on or off for an expense category
- Drag the handle to reorder categories, or use the arrow keys from a keyboard

The app keeps a stable internal category key when a label is edited. Existing entries, recurring expenses, and payment-method reward rules therefore remain connected.

## Recurring expenses

Create a recurring rule in **Settings → Recurring expenses** with a day of the month, description, and amount. The app creates the entry for each applicable month. Editing a rule affects months that have not yet been generated; previously generated entries remain editable individually.

## Synchronization setup

Synchronization uses a Supabase project that you control.

1. Create a free project at [Supabase](https://supabase.com/).
2. Open **SQL Editor**, paste the contents of `supabase_setup.sql`, and run it.
3. In **Settings → API**, copy the **Project URL** and **anon public** key.
4. In Our Ledger, open **Settings → Sharing with your partner**.
5. Enter the Project URL and anon key, generate a couple code, and save.
6. Give the same Project URL, anon key, and couple code to your partner.

Entries and shared settings normally appear on the other device within one minute. Tap the sync status at the top of the app to sync immediately.

The following data is shared: entries, category configuration and order, budget, split rules, fixed-cost rules, saving goal, recurring expenses, payment methods, and the two member names. Language and display currency remain local to each device.

> Anyone who has the Project URL, anon key, and couple code can access that ledger. Keep all three values private and share them only with your partner.

## Local development

Requirements:

- A current Node.js release
- npm

Install dependencies and start the Electron app:

```bash
npm install
npm start
```

Build all desktop packages:

```bash
npm run build:all
```

Platform-specific builds are also available:

```bash
npm run build:mac
npm run build:win
```

`build/build.js` creates the macOS builds outside common cloud-synced folders, builds the two DMG architectures sequentially, and applies ad-hoc signing for local distribution. Building Windows packages on Windows is the most reliable option.

### Deployment configuration

Copy `deploy.config.example.json` to `deploy.config.json`, fill in your Netlify site and GitHub release repository, then run:

```bash
npm run deploy
```

The deployment script uploads desktop artifacts to GitHub Releases, updates `renderer/version.json`, writes the generated runtime configuration, and publishes the `renderer` directory to Netlify. Do not commit `deploy.config.json`, because it contains deployment-specific values.

## Data storage and privacy

- In the browser and iPhone PWA, data is stored in local browser storage.
- In the desktop app, data is stored as `gagyebu-data.json` in the operating system's application-data directory.
- With sharing enabled, synchronized data is also stored in the Supabase project configured by the users.
- Deleted entries are retained as deletion markers so that deletion can synchronize across devices; they are hidden from the normal interface.
- The app does not perform currency conversion and does not connect directly to banks or card issuers.
- The app has no developer-operated account service. Your Netlify and Supabase configuration determines where hosted files and synchronized data live.

Typical desktop data locations are:

- macOS: under `~/Library/Application Support/`, in the folder named for the installed app
- Windows: under `%APPDATA%`, in the folder named for the installed app

Back up the local data file and your Supabase project before making major infrastructure changes.

## Project structure

```text
.
├── main.js                  # Electron main process
├── preload.js               # Safe renderer/main bridge
├── renderer/                # Web and iPhone PWA
│   ├── app.js               # Ledger UI and calculations
│   ├── i18n.js              # Korean/English interface translations
│   ├── storage.js           # Local persistence
│   ├── sync.js              # Supabase synchronization
│   ├── sw.js                # Offline cache and PWA updates
│   └── version.json         # Update metadata
├── build/                   # Build and deployment scripts
├── supabase_setup.sql       # Supabase schema
└── package.json
```

## License

This project is released under the MIT License. See the `license` field in `package.json`.
