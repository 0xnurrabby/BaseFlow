# BaseFlow Wallet Detect + Builder Fix

Updates in this build:
- EIP-6963 wallet discovery for multiple installed extension wallets
- Trust Wallet detection fallback
- correct ERC-8021 Builder Code suffix order for Base attribution
- no `NEXT_PUBLIC_*` variables required
- config loaded from a server API route
- paymaster URL stays server-side and is not sent to the browser
- proper manual wallet connect modal
- CSV upload
- address-only paste supported
- random min/max amount generator
- improved mobile layout
- boxier panels
- 10k address UI support

## Run
```bash
cd web
npm install
copy .env.example .env.local
npm run dev
```
