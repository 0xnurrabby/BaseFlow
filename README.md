# BaseFlow Secret Config

Updates in this build:
- no `NEXT_PUBLIC_*` variables required
- config is loaded from a server API route
- paymaster URL stays server-side and is not sent to the browser
- proper manual wallet connect modal
- CSV upload
- address-only paste supported
- random min/max amount generator for all pasted addresses
- improved mobile layout
- boxier corners / less curvy panels
- 10k address UI support

## Run
```bash
cd web
npm install
copy .env.example .env.local
npm run dev
```
