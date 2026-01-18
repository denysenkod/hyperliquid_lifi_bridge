# @aspect-build/hyperliquid-deposit

One-click deposit to HyperLiquid trading account from any chain. Automatically bridges tokens to Arbitrum USDC and deposits to HyperLiquid.

[![npm version](https://img.shields.io/npm/v/@aspect-build/hyperliquid-deposit.svg)](https://www.npmjs.com/package/@aspect-build/hyperliquid-deposit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 **One-Click Deposits** - Deposit to HyperLiquid from any supported chain
- 🌉 **Auto-Bridging** - Automatically bridges tokens to Arbitrum USDC via LI.FI
- 💰 **Multi-Chain Support** - Supports 60+ chains including Ethereum, Arbitrum, Base, Monad, etc.
- 🎯 **Smart Routing** - Finds optimal routes considering fees, speed, and gas
- ⚛️ **React Component** - Drop-in React component with TypeScript support
- 🎨 **Customizable** - Custom button rendering, styles, and callbacks
- 📱 **Responsive** - Works on desktop and mobile

## Installation

```bash
# npm
npm install @aspect-build/hyperliquid-deposit

# yarn
yarn add @aspect-build/hyperliquid-deposit

# bun
bun add @aspect-build/hyperliquid-deposit

# pnpm
pnpm add @aspect-build/hyperliquid-deposit
```

## Quick Start

### Basic Usage

```tsx
import { HyperliquidDeposit } from '@aspect-build/hyperliquid-deposit';

function App() {
  return (
    <HyperliquidDeposit
      walletAddress="0x..." // Connected wallet address
      onDepositComplete={(txHash, amount) => {
        console.log(`Deposited $${amount} USDC! Tx: ${txHash}`);
      }}
    />
  );
}
```

### With Custom Button

```tsx
import { HyperliquidDeposit } from '@aspect-build/hyperliquid-deposit';

function App() {
  return (
    <HyperliquidDeposit
      walletAddress={address}
      renderButton={({ onClick, disabled }) => (
        <button 
          onClick={onClick} 
          disabled={disabled}
          className="my-custom-button"
        >
          💰 Fund Trading Account
        </button>
      )}
    />
  );
}
```

### Using the Hook

```tsx
import { useHyperliquidDeposit } from '@aspect-build/hyperliquid-deposit';

function App() {
  const { openDeposit, DepositModal } = useHyperliquidDeposit({
    walletAddress: '0x...',
  });

  return (
    <>
      <button onClick={openDeposit}>
        Open Deposit Modal
      </button>
      <DepositModal />
    </>
  );
}
```

### Standalone Modal

```tsx
import { DepositModal } from '@aspect-build/hyperliquid-deposit';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Deposit</button>
      
      {isOpen && (
        <DepositModal
          chains={chains}
          walletAddress="0x..."
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
```

## API Reference

### `<HyperliquidDeposit />`

Main component that renders a deposit button and modal.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `walletAddress` | `string` | ✅ | Connected wallet address |
| `chains` | `ChainInfo[]` | ❌ | Custom chains (auto-fetched if not provided) |
| `onDepositComplete` | `(txHash: string, amount: number) => void` | ❌ | Callback on successful deposit |
| `onDepositError` | `(error: string) => void` | ❌ | Callback on deposit error |
| `renderButton` | `(props: { onClick, disabled }) => ReactNode` | ❌ | Custom button renderer |
| `buttonText` | `string` | ❌ | Button text (default: "Deposit to HyperLiquid") |
| `buttonStyle` | `CSSProperties` | ❌ | Custom button styles |
| `buttonClassName` | `string` | ❌ | Custom button class name |
| `disabled` | `boolean` | ❌ | Disable the button |
| `modalStyles` | `{ modal?, overlay? }` | ❌ | Custom modal styles |

### `useHyperliquidDeposit()`

Hook for programmatic control.

```tsx
const {
  isOpen,        // boolean - modal open state
  openDeposit,   // () => void - open the modal
  closeDeposit,  // () => void - close the modal
  DepositModal,  // React component - the modal
} = useHyperliquidDeposit(props);
```

### Constants

```tsx
import { 
  HYPERLIQUID_BRIDGE_ADDRESS,  // HyperLiquid bridge contract on Arbitrum
  MIN_HYPERLIQUID_DEPOSIT_USD  // Minimum deposit ($5)
} from '@aspect-build/hyperliquid-deposit';
```

## How It Works

1. **User enters amount** - e.g., $50 USDC
2. **Scans balances** - Checks all chains for available tokens
3. **Calculates optimal route** - Finds best bridges considering fees & speed
4. **Executes bridges** - Bridges tokens to Arbitrum USDC
5. **Deposits to HyperLiquid** - Transfers USDC to HyperLiquid bridge contract

```
Your Wallet (any chain)
        ↓
   [LI.FI Bridge]
        ↓
  Arbitrum USDC
        ↓
 HyperLiquid Bridge Contract
        ↓
 HyperLiquid Trading Account
```

## Supported Chains

The component automatically fetches supported chains from LI.FI, including:

- Ethereum, Arbitrum, Base, Optimism, Polygon
- BSC, Avalanche, Fantom, Gnosis
- Monad, HyperEVM, Linea, zkSync, Scroll
- And 50+ more...

## Requirements

- React 18+
- MetaMask or compatible Web3 wallet
- Tokens on any supported chain

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Watch mode
bun run build:watch

# Run example
bun run dev:example
```

## License

MIT
