# My Ledger (Personal Finance Tracker)

My Ledger is a private, offline-first personal finance tracker for **macOS**, **Windows**, and **iPhone/iPad as an installable web app**. It records expenses and income, tracks real card or account balances, and can optionally sync the same ledger across your devices.

The interface supports English and Korean. US dollars are the default currency; Korean won is also available in Settings.

## Highlights

- Add, edit, and delete expenses, income, and card-payment records
- Monthly spending, income, budget, calendar, and category statistics
- Select multiple categories in Stats to see their combined total
- Search notes, categories, payment methods, and Korean initial consonants, including matches in the middle of a word
- Filter entries by category or payment method and open a card's complete history
- Tip calculator with presets or a custom tip/total
- Editable recurring-expense rules for rent, subscriptions, and other monthly charges
- Bilingual custom categories with editable names, icons, tip behavior, and drag-and-drop ordering
- Savings goals and progress tracking
- Credit-card, debit-card, cash, and other account balance tracking
- Optional import from the companion couple ledger with personal-share accounting
- Optional Supabase sync across your own devices
- CSV export, automatic light/dark mode, and offline support
- Optional app lock using a passcode and supported device biometrics

My Ledger is separate from the couple ledger. The apps use different application identities, local storage, and sync codes, so they can be installed side by side.

## Install the desktop app

Download the current installers from the [official GitHub Releases page](https://github.com/yhkimslv/gagyebu-releases/releases).

- **macOS on Apple silicon:** choose the arm64 DMG.
- **macOS on Intel:** choose the x64 DMG.
- **Windows:** choose the installer, or the portable executable if you do not want to install it.

The distributed builds are not notarized or code-signed with a paid developer certificate. Your operating system may therefore show a warning on first launch. On macOS, Control-click the app and choose **Open**. On Windows, choose **More info**, then **Run anyway**, only after confirming that the file came from this repository's Releases page.

## Install on iPhone or iPad

The `renderer/` directory is a Progressive Web App (PWA). The current hosted build is available at [piggybox.netlify.app](https://piggybox.netlify.app/).

1. Open the site in **Safari**.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Launch My Ledger from the new Home Screen icon.

The PWA works offline after its files have been cached. When a newer web build is available, the app displays an update button. Web storage belongs to the exact site address, so do not move an existing ledger to a different origin without first enabling sync or exporting a backup.

### Self-host the PWA

Deploy the contents of `renderer/` to any static HTTPS host. Use a different site or path from the couple ledger so that one app does not replace the other's files or service worker. Copy `deploy.config.example.json` to the untracked `deploy.config.json`, fill in your own deployment values, and run:

```bash
npm run deploy
```

## Everyday use

### Entries, editing, and search

An entry needs an amount, category, date, and optional note, time, and payment method. Tap or click an existing entry to edit it. The list keeps its scroll position after an edit, and common form actions work with the Enter key.

Search matches notes, category names in either language, payment methods, linked payer names, and Korean initial consonants. Category and payment-method filters can be combined with the text search.

### Tips

Categories can opt in to the tip calculator. For those categories, enter the bill before tip and choose a preset percentage, enter a custom tip or final total, or record no tip. The ledger stores the final charged amount while Stats also reports the tip portion.

### Recurring expenses

Create a recurring rule in **Settings → Recurring expenses** for charges such as rent or subscriptions. The app generates each month's entry automatically. You can edit a generated entry independently, or edit the recurring rule to change future, not-yet-generated months.

### Categories

Each custom category stores a Korean name and an English name. The app displays the name matching the selected interface language without changing the stable category identity used by old entries and reward settings. Existing categories can be edited, and their order can be changed by dragging the handle or using arrow keys while the handle is focused.

## Payment methods, balances, and card history

Manage cards and accounts under **Settings → Payment methods**. A payment method may include:

- Type: credit card, debit card, cash, or other
- Statement/payment day
- Benefits notes
- Category-specific reward rates
- A starting amount and balance date
- Whether later changes to older entries should adjust the balance

The Balances view uses actual cash flow. Credit-card purchases increase the amount owed; card-payment records reduce it. Debit, cash, and other tracked accounts use their actual debits, credits, and card-payment withdrawals. Paying a card does not count as a new monthly expense because the purchase was already counted when it occurred.

Click a card or payment method to see its entries for the selected month. That card-detail list deliberately uses actual charged amounts even when the general ledger and monthly reports use a smaller personal share from a linked shared purchase.

### Starting amount and balance date

The starting amount is the balance at the **end of the selected balance date**:

- For a credit card, enter the amount owed at the end of that day.
- For debit, cash, or another asset account, enter the amount available at the end of that day.

By default, only entries after the balance date change the current balance. This prevents transactions already included in the starting amount from being counted twice.

Enable **Include later changes to entries on or before the balance date** if you may add, edit, or delete older transactions after saving the baseline. The app records the historical total at the baseline and applies only the later difference. When device sync is enabled but the initial history has not finished downloading, baseline finalization waits for a successful sync so late-arriving old records do not unexpectedly change the balance.

A starting amount is not an expense and never appears in the budget, calendar, or spending statistics. `0` is a valid baseline; leaving the field blank turns balance tracking off for that payment method.

## Import shared expenses from the couple ledger

The optional couple-ledger link is separate from device sync. Configure it with the couple ledger's Supabase URL, anon public key, couple code, and your exact member name.

Imported entries preserve two amounts when necessary:

- **Actual amount:** the amount charged to the card or transferred between people; used for card balances and card history.
- **My share:** your final share under the couple ledger's percentage or fixed-share rule; used for monthly spending, budgets, calendar totals, and statistics.

This distinction produces the expected results:

- If you paid $100 for a 50:50 shared purchase, your personal reports count $50 while your card balance and card history keep the full $100 charge.
- If your partner paid the same purchase, your reports still count your $50 share, but none of your cards is charged.
- Your personal purchases from the couple ledger are imported at 100%; your partner's personal purchases are not imported.
- Settlement transfers remain visible but are excluded from spending reports, because the shared purchase already contains your final share.

The importer updates linked copies when their source changes and does not create duplicates. Editing an imported entry in My Ledger detaches that copy and turns it into a normal personal entry so future imports do not overwrite your edit.

For old asymmetric split or fixed-share data that predates ownership metadata, open the couple ledger's split setting and save it once to establish which member the value belongs to.

## Sync across your devices

Sync is optional. Local-only use requires no account or server.

1. Create a project at [Supabase](https://supabase.com/).
2. Open **SQL Editor** and run `supabase_setup.sql` from this repository.
3. Copy the **Project URL** and **anon public** key from the Supabase project settings.
4. In My Ledger, open **Settings → Sync between my devices**, enter those values, generate a personal code, and save.
5. Enter the same three values on each of your devices.

Use a **different code** from the couple ledger. Both apps may use the same Supabase project, but reusing a code would merge records that are intended to remain separate.

Sync credentials act as access credentials for the ledger. Keep the URL, anon key, and personal code private. Resolve any Supabase security requirements appropriate to your deployment before sharing the hosted app with others.

## Build from source

Requirements:

- A current Node.js and npm installation
- macOS to produce DMG files
- The platform support required by Electron Builder for the target you select

Install dependencies and run the development app:

```bash
npm install
npm start
```

Create desktop packages:

```bash
npm run build:mac
npm run build:win
npm run build:all
```

Build output is copied to `dist/`. `build/build.js` uses a temporary directory outside synced Desktop/iCloud folders to avoid macOS extended-attribute signing failures and builds the two DMGs sequentially to avoid `hdiutil` conflicts.

For a release, update the version in `package.json` and `renderer/version.json`, update the service-worker cache name in `renderer/sw.js`, build the installers, and run `npm run deploy`. The deploy script publishes the PWA and uploads consistently named desktop assets to the configured GitHub Release.

## Data storage and privacy

My Ledger has no advertising or analytics code. It does not send ledger data anywhere unless you explicitly configure Supabase sync or the couple-ledger import.

- **macOS/Windows desktop app:** Electron's per-user application-data directory, in `gagyebu-data.json`
- **iPhone/iPad/browser PWA:** the site's local browser storage
- **With sync enabled:** your configured Supabase project

Passcode verification data stays on the current device. Face ID, Touch ID, or other biometric verification is performed by the operating system or browser; the app neither receives nor stores biometric data.

CSV exports contain financial records, so store and share them with the same care as the ledger itself.

## Project layout

```text
.
├── main.js                 # Electron main process and local file storage
├── preload.js              # Isolated renderer bridge
├── renderer/               # PWA and desktop renderer
│   ├── app.js
│   ├── i18n.js
│   ├── index.html
│   ├── link.js             # Optional couple-ledger import
│   ├── storage.js
│   ├── sync.js
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── version.json
│   └── icons/
├── build/                  # Build, signing, configuration, and deploy scripts
├── supabase_setup.sql
└── package.json
```

## License

Released under the [MIT License](LICENSE).
