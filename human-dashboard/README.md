# AAM Dashboard

Human-friendly interface for managing AI agent allowances on the Agent Allowance Manager contract.

## Features

- **Wallet Connect** — RainbowKit integration with auto-add for Arc Testnet
- **3 Cyberpunk Themes** — Terminal (emerald), Amber, Void (cyan)
- **Lookup Mode** — View any address via `?addr=0x...` URL param
- **Hierarchy Tree** — Real-time parent→child relationship visualization
- **Deposit/Withdraw** — Manage your USDC pool
- **Create Allowances** — Set type (CAP/STREAM), limit, and period
- **Allowance Controls** — Pause/Unpause/Revoke on each card

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

## Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Required for demo scripts only
PRIVATE_KEY=your_private_key_here
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run demo` | Run demo script (creates sub-agent allowances) |

## Demo Scripts

Located in the root of `human-dashboard/`:

- `check-status.js` — View balances and allowances (read-only)
- `create-subagent-allowances.js` — Claude creates allowances for sub-agents
- `create-gem-subagent-allowances.js` — Gem creates allowances for sub-agents

Run with:
```bash
node check-status.js
PRIVATE_KEY=0x... node create-subagent-allowances.js
```

## Project Structure

```
human-dashboard/
├── src/
│   ├── App.tsx           # Main app with all features
│   ├── main.tsx          # React entry point
│   └── index.css         # Tailwind base styles
├── public/               # Static assets
├── *.js                  # Demo scripts
└── package.json
```

## Tech Stack

- **React 19** + TypeScript
- **Vite** — Build tool
- **wagmi v2** — React hooks for Ethereum
- **RainbowKit** — Wallet connection
- **TailwindCSS v4** — Styling
- **viem** — TypeScript Ethereum library

## Contract Details

- **AAM Address:** `0x41c7e0eBf40Fe2d95C6ffd967cD210D4Bab30c72`
- **USDC Address:** `0x3600000000000000000000000000000000000000`
- **Network:** Arc Testnet (Chain ID: 5042002)
