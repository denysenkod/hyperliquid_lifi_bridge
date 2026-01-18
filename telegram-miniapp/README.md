# HyperLiquid Deposit - Telegram Mini App

A Telegram Mini App that allows users to deposit funds to their HyperLiquid trading account from any blockchain.

## Features

- 🔗 **WalletConnect Integration** - Connect mobile wallets via QR code
- 💰 **Multi-Chain Deposits** - Deposit from 60+ chains
- 🌉 **Auto-Bridging** - Automatically bridges to Arbitrum USDC
- 📱 **Mobile-First Design** - Optimized for Telegram's in-app browser
- 🎨 **HyperLiquid Branding** - Beautiful UI matching HyperLiquid's style

## Quick Start

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build
```

## Setup

### 1. Get a WalletConnect Project ID

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Create a new project
3. Copy the Project ID
4. Update `src/wagmi.ts`:

```typescript
const projectId = 'YOUR_WALLETCONNECT_PROJECT_ID';
```

### 2. Deploy to Hosting

Deploy the `dist` folder to any static hosting (Vercel, Netlify, etc.)

### 3. Create Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow prompts
3. Send `/newapp` to create a Mini App
4. Set your deployed URL as the Web App URL

## How It Works

1. User opens the Mini App in Telegram
2. Connects wallet via WalletConnect
3. Clicks "Deposit to HyperLiquid"
4. App bridges tokens to Arbitrum USDC
5. Deposits to HyperLiquid trading account

## License

MIT
