# HyprEVM Bridge Widget

A portable React component that allows users to bridge USDC from any supported chain to HyprEVM using LI.FI's cross-chain infrastructure.

## Features

- **⚛️ React Component** - Modern React component with TypeScript support
- **🎨 Customizable Styling** - Fully customizable via props (no CSS imports required)
- **🔗 Wallet Integration** - Seamless MetaMask connection
- **🌐 Dynamic Chain Support** - Automatically fetches all supported chains from LI.FI
- **💰 USDC Balances** - Displays USDC balances across all supported chains
- **🌉 One-Click Bridging** - Simple interface to bridge from any chain to HyprEVM
- **📱 Responsive Design** - Works on desktop and mobile
- **📦 Easy to Publish** - Ready to publish to npm

## Project Structure

```
HyprTrader/
├── component/              # React component source code
│   ├── index.tsx          # Main exports
│   ├── HyprBridgeWidget.tsx  # Main React component
│   ├── components/        # Sub-components
│   │   ├── ConnectView.tsx
│   │   ├── BridgeButton.tsx
│   │   └── BridgeModal.tsx
│   ├── styles/            # Default styles
│   │   └── defaultStyles.ts
│   ├── bridge.ts          # LI.FI bridge service integration
│   └── wallet.ts          # Wallet management (MetaMask)
├── types/                 # TypeScript type definitions
├── example/               # Example Vite + React app
├── dist/                  # Compiled output (generated)
└── package.json           # Project dependencies
```

## Installation (For Component Library Development)

This project uses [Bun](https://bun.sh/) as the package manager and runtime. Install Bun first:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then install dependencies:

```bash
bun install
```

## Building the Component

Build the component library:

```bash
bun run build
```

This will generate the distributable files in the `dist/` directory.

## Running the Example App

1. First, build the component:
```bash
bun run build
```

2. Install example app dependencies:
```bash
cd example && bun install
```

3. Run the example app:
```bash
bun run dev:example
```

This will start the Vite dev server at `http://localhost:5173`

## Usage in Your React App

### 1. Install the component (once published to npm)

```bash
npm install hyprliquid-bridge-widget
# or
bun add hyprliquid-bridge-widget
```

### 2. Use in your React component

```tsx
import { HyprBridgeWidget } from 'hyprliquid-bridge-widget';
import type { BridgeWidgetConfig } from 'hyprliquid-bridge-widget';

const config: BridgeWidgetConfig = {
  targetChainId: 998899,     // Your target chain ID
  targetChainName: 'HyprEVM', // Your target chain name
  tokenSymbol: 'USDC'         // Token to bridge (default: USDC)
};

function App() {
  return (
    <div>
      <HyprBridgeWidget config={config} />
    </div>
  );
}
```

### 3. Customize styling (optional)

```tsx
import { HyprBridgeWidget } from 'hyprliquid-bridge-widget';
import type { BridgeWidgetStyles } from 'hyprliquid-bridge-widget';

const customStyles: BridgeWidgetStyles = {
  container: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
  },
  connectButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontSize: '1.2rem',
  },
  bridgeButton: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
};

function App() {
  return <HyprBridgeWidget config={config} styles={customStyles} />;
}
```

## Configuration

```typescript
interface BridgeWidgetConfig {
  targetChainId: number;        // Chain ID to bridge to
  targetChainName: string;      // Display name of target chain
  tokenSymbol?: string;         // Token symbol (default: 'USDC')
}

interface BridgeWidgetStyles {
  container?: CSSProperties;
  connectButton?: CSSProperties;
  bridgeButton?: CSSProperties;
  walletInfo?: CSSProperties;
  modal?: {
    overlay?: CSSProperties;
    content?: CSSProperties;
    header?: CSSProperties;
    closeButton?: CSSProperties;
    body?: CSSProperties;
  };
  balanceItem?: CSSProperties;
  chainInfo?: CSSProperties;
  bridgeFromButton?: CSSProperties;
  infoBox?: CSSProperties;
}
```

## Development

### Watch Mode

```bash
bun run build:watch
```

### Clean Build

```bash
bun run clean && bun run build
```

## Technical Details

- **LI.FI SDK** - Uses LI.FI for cross-chain bridging and chain discovery
- **Viem** - Ethereum library for wallet interactions and contract calls
- **TypeScript** - Fully typed for better developer experience
- **No Framework Dependencies** - Pure TypeScript/JavaScript, works with any framework

## Requirements

- MetaMask or compatible Web3 wallet
- USDC balance on source chain
- Modern browser with ES2022 support

## License

MIT
