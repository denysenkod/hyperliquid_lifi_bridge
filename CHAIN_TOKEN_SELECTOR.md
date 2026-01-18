# Chain + Token Selector

A dual-pane selector interface that allows users to choose both a source chain and token in one unified modal.

## Features

✅ **Two-column layout** - Chains on left, tokens on right
✅ **Dual search** - Separate search for chains and tokens
✅ **Popular chains** - Shows top 10 chains first
✅ **Popular tokens** - Shows USDC, USDT, ETH, etc. by default
✅ **Real-time token search** - Filters as you type
✅ **Visual feedback** - Hover states and selection highlighting
✅ **Chain logos** - Gradient circles with first letter
✅ **Token logos** - Displays token icons from LI.FI

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│ ←  Select token to swap                                 │
├─────────────────────────────────────────────────────────┤
│ [🔍 Chain]                [🔍 Token]                    │
├──────────────────────┬──────────────────────────────────┤
│ 🔗 All Chains        │ 🪙 Popular tokens                │
│                      │                                  │
│ ⭐ Popular chains    │ [Select a chain to view tokens] │
│ [E] Ethereum         │                                  │
│ [B] Bitcoin          │ Or (when chain selected):       │
│ [S] Solana           │                                  │
│ [A] Arbitrum         │ [🪙] Ethereum                    │
│ [O] Optimism         │      ETH                         │
│ [B] Base             │                                  │
│ ...                  │ [🪙] Binance                     │
│                      │      BNB                         │
│ [E] Ethereum         │                                  │
│ [P] Polygon          │ [🪙] USD Coin                    │
│ ...                  │      USDC                        │
└──────────────────────┴──────────────────────────────────┘
```

## How It Works

### 1. User Flow

1. **Click "Select Source Chain & Token"** button
2. **Modal opens** with two columns
3. **Left column** shows all chains (popular first)
4. **Right column** shows "Select a chain" message
5. **User clicks a chain** (e.g., Ethereum)
6. **Right column** loads popular tokens for that chain
7. **User types in token search** (e.g., "USD")
8. **Tokens filter** to show USDC, USDT, etc.
9. **User clicks token** (e.g., USDC)
10. **Modal closes** and selection is saved

### 2. Search Behavior

**Chain Search:**
- Filters chains by name
- Case-insensitive
- Searches as you type
- Shows all matching chains

**Token Search:**
- Only active after chain selection
- Searches by symbol or name
- Shows popular tokens when empty
- Limits to 50 results

### 3. Visual States

**Chain Item:**
- Default: Transparent background
- Hover: Light gray (`#f9f9f9`)
- Selected: Light blue (`#f0f4ff`) with blue border

**Token Item:**
- Default: Transparent background
- Hover: Light blue (`#f0f4ff`) with blue border
- Clickable only when chain is selected

## Component API

```typescript
interface ChainTokenSelectorProps {
  chains: ChainInfo[];
  onSelect: (chain: ChainInfo, token: SearchableToken) => void;
  onClose: () => void;
  styles?: {
    modal?: React.CSSProperties;
    overlay?: React.CSSProperties;
  };
}
```

### Props

- **chains** - Array of available chains from LI.FI
- **onSelect** - Callback when user selects chain + token
- **onClose** - Callback to close the modal
- **styles** - Optional style overrides

## Integration Example

```typescript
import { ChainTokenSelector } from 'hyprliquid-bridge-widget';

function BridgeModal() {
  const [showSelector, setShowSelector] = useState(false);
  const [selectedChain, setSelectedChain] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);

  return (
    <>
      <button onClick={() => setShowSelector(true)}>
        {selectedChain && selectedToken
          ? `${selectedChain.name} • ${selectedToken.symbol}`
          : 'Select Source Chain & Token'}
      </button>

      {showSelector && (
        <ChainTokenSelector
          chains={availableChains}
          onSelect={(chain, token) => {
            setSelectedChain(chain);
            setSelectedToken(token);
            setShowSelector(false);
          }}
          onClose={() => setShowSelector(false)}
        />
      )}
    </>
  );
}
```

## Styling

### Colors

- **Primary Blue**: `#667eea`
- **Purple Gradient**: `#667eea → #764ba2`
- **Light Blue (selected)**: `#f0f4ff`
- **Light Gray (hover)**: `#f9f9f9`
- **Border**: `#e0e0e0`
- **Text**: `#333`
- **Secondary Text**: `#999`

### Dimensions

- **Modal Width**: `900px` (max)
- **Modal Height**: `85vh` (max)
- **Chain Logo**: `40px` circle
- **Token Logo**: `40px` circle
- **Border Radius**: `24px` (modal), `16px` (inputs), `12px` (items)

## Features in Detail

### Popular Chains

Shows the first 10 chains from the list:
- Ethereum
- Bitcoin
- Solana
- Arbitrum
- Optimism
- Base
- Polygon
- Avalanche
- BSC
- etc.

### Popular Tokens

When a chain is selected, shows:
- USDC
- USDT
- DAI
- ETH / Native token
- WETH
- WBTC
- USDCe (if available)
- USDe (if available)

### Search Optimization

- **5-minute cache** per chain
- **Debounced search** (via React state)
- **Limit 50 results** to prevent UI lag
- **Filters junk tokens** (LP, vault, receipt tokens)

## Benefits

1. **Single modal** - Select both chain and token in one place
2. **Better UX** - No need to navigate multiple screens
3. **Visual clarity** - Two-column layout is intuitive
4. **Fast search** - Real-time filtering with caching
5. **Mobile-friendly** - Responsive design (90% width)

## Comparison to Old Flow

### Old Flow (3 steps)
1. Click "Bridge to HyperEVM"
2. Select source chain from list
3. Token is hardcoded to USDC

### New Flow (2 steps)
1. Click "Select Source Chain & Token"
2. Pick chain + token in one modal

**Result**: Fewer clicks, more flexibility, better UX!

## Next Steps

To complete the bridge experience:

1. ✅ Chain + token selection
2. ⏳ Amount input validation
3. ⏳ Balance checking
4. ⏳ Quote fetching with selected token
5. ⏳ Bridge execution with any token
6. ⏳ Transaction status tracking

The selector now enables bridging **any token** from **any chain** to HyperEVM!
