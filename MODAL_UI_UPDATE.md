# Bridge Modal UI Update

Updated the bridge modal to include a modern token selector interface at the top.

## New UI Components

### 1. Token Selector Section
Located at the top of the modal with a light gray background (`#f8f9fa`).

**Components:**
- **Chain Logo** (48px circle) - Shows first letter of chain name with gradient background
- **Token Selector Button** (rounded pill) - Blue gradient button with token logo + symbol + dropdown arrow
- **Amount Input** (large text field) - 32px font size for entering bridge amount
- **USD Value Display** - Shows equivalent USD value based on token price
- **Balance Display** - Shows available balance on the right

### 2. Visual Design

```
┌─────────────────────────────────────────────────┐
│  [Chain Logo]  [🪙 ETH ▼]                      │
│                                                 │
│  0                                              │
│                                                 │
│  🪙 $0                          Balance: 0      │
└─────────────────────────────────────────────────┘
```

### 3. Interactive Features

✅ **Click token button** → Opens `TokenSearchModal`
✅ **Search tokens** → Type name, symbol, or paste address
✅ **Select token** → Updates button with logo + symbol
✅ **Enter amount** → Shows USD value in real-time
✅ **Shows balance** → Displays available balance for selected token

## Styling Details

### Token Selector Button
- **Background**: `#667eea` (blue)
- **Border Radius**: `24px` (pill shape)
- **Padding**: `12px 20px`
- **Font Size**: `18px`
- **Font Weight**: `600` (semi-bold)
- **Hover Effect**: Lifts up 2px with shadow

### Chain Logo
- **Size**: `48px × 48px`
- **Background**: Linear gradient `#667eea → #764ba2`
- **Border Radius**: `50%` (circle)
- **Content**: First letter of chain name

### Amount Input
- **Font Size**: `32px`
- **Font Weight**: `300` (light)
- **Color**: `#333`
- **Background**: Transparent
- **Placeholder**: "0"

### Balance Display
- **Font Size**: `14px`
- **Color**: `#999` (gray)
- **Position**: Right-aligned

## Integration

The modal now works with the dynamic token search:

1. **User clicks "Bridge to HyperEVM"** → Modal opens
2. **Default state**: Shows "Select Token" button
3. **User clicks token button** → `TokenSearchModal` opens
4. **User searches/selects token** → Button updates with token info
5. **User enters amount** → USD value calculates automatically
6. **User sees balance** → Can verify available funds

## Code Structure

```typescript
// State management
const [selectedChain, setSelectedChain] = useState<ChainBalance | null>(balances[0]);
const [selectedToken, setSelectedToken] = useState<SearchableToken | null>(null);
const [showTokenSearch, setShowTokenSearch] = useState(false);
const [amount, setAmount] = useState('');

// Token selection handler
const handleSelectToken = (token: SearchableToken) => {
  setSelectedToken(token);
  setShowTokenSearch(false);
};
```

## Benefits

1. **Modern UI** - Matches contemporary DEX/bridge interfaces
2. **Clear visual hierarchy** - Token selector stands out at top
3. **Real-time feedback** - USD value updates as user types
4. **Easy token switching** - One click to change tokens
5. **Balance visibility** - Always shows available funds

## Next Steps

To complete the bridge flow:

1. Add chain selector (to switch source chain)
2. Wire up amount + token to bridge execution
3. Add "Bridge" button below the selector
4. Show destination (HyperEVM) preview
5. Display estimated fees and time

## Example Usage

```typescript
<BridgeModal
  targetChainName="HyperEVM"
  balances={chainBalances}
  onClose={() => setShowModal(false)}
  onBridge={(chainId) => executeBridge(chainId, selectedToken, amount)}
/>
```

The modal now provides a complete token selection experience with search, filtering, and visual feedback!
