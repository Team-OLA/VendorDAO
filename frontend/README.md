# VendorDAO Frontend

A Next.js (App Router + TypeScript + Tailwind) dApp for **VendorDAO** — an open, transparent
citywide vendor-funding DAO on Polkadot. See the [repository root README](../README.md) for the
full project overview.

## Features

- **Wallet connect** via the [polkadot{.js} extension](https://polkadot.js.org/extension/) (or any
  compatible wallet like Talisman/SubWallet), using `@polkadot/extension-dapp`.
- **Live chain data**: treasury pot balance, lifetime received/disbursed totals, proposals, and the
  vendor registry, all read directly from chain storage via `@polkadot/api`.
- **Governance actions**: register as a vendor, submit proposals, vote aye/nay, tally votes, and
  retry disbursement — each a signed extrinsic sent through the connected wallet.
- **Multilingual UI**: English, Spanish, French, Arabic (RTL), Chinese, and Hindi via
  `react-i18next`, with automatic browser-language detection and a manual switcher.
- **On-demand translation** of arbitrary proposal text (which can't be pre-translated since it's
  user-submitted) through a server-side `/api/translate` route backed by the Google Cloud
  Translation API — the API key never reaches the browser.

## Getting Started

1. Copy the env template and fill in your values:

   ```sh
   cp .env.local.example .env.local
   ```

   - `NEXT_PUBLIC_CHAIN_WS_ENDPOINT` — WebSocket endpoint of your `vendor-dao-node` (defaults to
     `ws://127.0.0.1:9944` for a local `--dev` chain).
   - `GOOGLE_TRANSLATE_API_KEY` — a Google Cloud Translation API key (server-only; see
     [Cloud Translation docs](https://cloud.google.com/translate/docs/setup)). Translation is
     optional — the rest of the app works without it, the "Translate" button will just show an
     error until a key is configured.
   - `VENDOR_VERIFICATION_SECRET` — server-only HMAC signing secret for the vendor email
     verification flow (captcha + emailed code). Optional locally (an insecure fallback is used),
     required in production.
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` — optional
     SMTP config for actually emailing verification codes. If `SMTP_HOST` is left unset, the code
     is returned directly in the API response (shown in the UI as a "dev code") so the flow is
     testable without a real mail server.

2. Install dependencies and run the dev server:

   ```sh
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000). Start (or point at) a `vendor-dao-node
   --dev` chain (see [`../chain/README.md`](../chain/README.md)) so the dashboard has data to show.

## Project layout

```
src/
├── app/                # Routes: dashboard, proposals, vendors, api/translate
├── components/         # Navbar, WalletConnect, LanguageSwitcher, ProposalCard, ...
├── hooks/               # usePolkadotApi, useWallet, useProposals, useVendors, useTreasury
├── i18n/                # react-i18next config + locales/{en,es,fr,ar,zh,hi}.json
└── lib/                 # chain constants/helpers, tx signing, decode helpers, translate client
```

## Swapping the translation provider

`src/lib/server/translateProvider.ts` isolates the Google Translate call behind a single function.
To use Azure Translator, DeepL, or LibreTranslate instead, implement the same
`(text, target, source?) => Promise<{ translatedText }>` shape there — no client code changes
needed, since the browser only ever calls our own `/api/translate` route.

## Building for production

```sh
npm run build
npm run start
```
