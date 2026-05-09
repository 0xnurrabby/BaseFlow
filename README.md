<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=2,8,15&height=180&section=header&text=BaseFlow&fontSize=52&fontColor=000000&fontAlignY=38&desc=Bulk+ERC-20+token+sender+with+CSV+upload+and+wallet+connect&descAlignY=58&descSize=14&animation=fadeIn" width="100%"/>

<div align="center">

[![Live](https://img.shields.io/badge/Live%20App-bbf7d0?style=for-the-badge&logoColor=000)](https://base-flow-zeta.vercel.app)
[![License](https://img.shields.io/badge/MIT-bfdbfe?style=for-the-badge&logoColor=000)](LICENSE)
[![Platform](https://img.shields.io/badge/Base%20Chain-fde68a?style=for-the-badge&logoColor=000)]()
[![Tech](https://img.shields.io/badge/TypeScript%20%2B%20Vite-fca5a5?style=for-the-badge&logoColor=000)]()

</div>

<div align="center">
<i>Send ERC-20 tokens to up to 10,000 addresses at once from a CSV upload or manual paste, with multi-wallet support and on-chain ERC-8021 builder attribution on Base.</i>
</div>

---

## ✦ Features

<div align="center">

| | Feature | What it does |
|:---:|---|---|
| 📤 | Bulk send | Send tokens to thousands of addresses in one session |
| 📄 | CSV upload | Upload a CSV file with addresses and amounts |
| ✍️ | Address paste | Paste a list of addresses directly into the UI |
| 🎲 | Random amount generator | Generate random min/max amounts per recipient |
| 👛 | Multi-wallet support | EIP-6963 wallet discovery for multiple installed extensions |
| 🔐 | Server-side config | Paymaster URL stays server-side, not exposed to browser |
| ⛓️ | ERC-8021 attribution | Correct builder code suffix order for Base attribution |
| 📱 | Mobile layout | Improved responsive layout for mobile devices |

</div>

---

## ✦ Download & Run

**Step 1** .... Clone and navigate to web folder

```bash
git clone https://github.com/0xnurrabby/BaseFlow
cd BaseFlow/web
```

**Step 2** .... Install and configure

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your config (no NEXT_PUBLIC_ vars needed)
```

**Step 3** .... Start dev server

```bash
npm run dev
# Open http://localhost:5173
```

---

## ✦ Setup

```
1. Clone the repo
2. cd into web/
3. Run npm install
4. Copy .env.example to .env.local
5. Fill in your RPC URL and any required keys
6. Run npm run dev
7. Connect your wallet and upload a CSV or paste addresses
8. Set token contract, amount, and click Send
```

---

## ✦ Project Structure

```
BaseFlow/
  web/
    src/               ->  React + TypeScript app source
    index.html         ->  entry point
    package.json
    vite.config.ts
    tailwind.config.cjs
    tsconfig.json
    vercel.json        ->  Vercel deployment config
  contracts/           ->  Solidity contracts for bulk send
```

---

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=2,8,15&height=100&section=footer&animation=fadeIn" width="100%"/>

<div align="center">MIT License .... built by <a href="https://github.com/0xnurrabby">0xnurrabby</a></div>
