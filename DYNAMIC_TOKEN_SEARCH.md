# Dynamic Token Search

Instead of storing 2.5MB of token data locally, use the dynamic token search service that fetches from LI.FI on-demand.

## Features

✅ **Search by name or symbol** - "USDC", "Ethereum", etc.
✅ **Search by address** - Paste `0x...` address to find exact token
✅ **Auto-complete dropdown** - Shows matching tokens as you type
✅ **Filters junk tokens** - Removes LP tokens, vault tokens, receipt tokens
✅ **5-minute cache** - Reduces API calls while staying fresh
✅ **Popular tokens** - Shows USDC, USDT, ETH, WBTC when no search query

## Usage

### 1. Token Search Service (Backend)

```typescript
import { TokenSearchService } from './component/tokenSearch';

const searchService = new TokenSearchService();

// Get popular tokens for a chain
const popular = await searchService.getPopularTokens(1); // Ethereum
// Returns: USDC, USDT, DAI, ETH, WETH, WBTC

// Search by name/symbol
const results = await searchService.searchTokens(1, 'USD');
// Returns: USDC, USDT, USDe, sUSDe, etc.

// Get token by exact symbol
const usdc = await searchService.getTokenBySymbol(1, 'USDC');
// Returns: { symbol: 'USDC', name: 'USD Coin', address: '0x...', ... }

// Get token by address
const token = await searchService.getTokenByAddress(
  1, 
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
);
// Returns: USDC token info

// Clear cache when needed
searchService.clearCache(1); // Clear for specific chain
searchService.clearCache();  // Clear all
```

### 2. Token Search Modal (UI Component)

```typescript
import { TokenSearchModal } from './component/components/TokenSearchModal';

function MyBridgeComponent() {
  const [showTokenSearch, setShowTokenSearch] = useState(false);

  const handleSelectToken = (token: SearchableToken) => {
    console.log('Selected:', token.symbol, token.address);
    // Use the selected token for bridging
  };

  return (
    <>
      <button onClick={() => setShowTokenSearch(true)}>
        Select Token
      </button>

      {showTokenSearch && (
        <TokenSearchModal
          chainId={1}
          chainName="Ethereum"
          onSelectToken={handleSelectToken}
          onClose={() => setShowTokenSearch(false)}
        />
      )}
    </>
  );
}
```

## How It Works

### Search Flow

1. **User opens modal** → Shows popular tokens (USDC, USDT, etc.)
2. **User types "eth"** → Shows ETH, WETH, weETH, etc.
3. **User types "0xA0b8..."** → Shows exact token by address
4. **User selects token** → Returns full token info with logo

### Caching Strategy

- **First request**: Fetches from LI.FI API (~500ms)
- **Subsequent requests**: Returns from cache (~1ms)
- **Cache expires**: After 5 minutes
- **Per-chain caching**: Each chain cached separately

### Filtering

Automatically filters out:
- ❌ Uniswap V2 LP tokens (`UNI-V2`)
- ❌ SushiSwap LP tokens (`SLP`)
- ❌ Pendle LP tokens (`PENDLE-LPT`)
- ❌ Vault tokens (`voted-`, `bb*`)
- ❌ Receipt tokens (staking, voting)

Only shows:
- ✅ Real tradeable tokens (USDC, ETH, WBTC)
- ✅ Wrapped tokens (WETH, wstETH)
- ✅ Stablecoins (USDT, DAI, FRAX)

## API Reference

### TokenSearchService

```typescript
class TokenSearchService {
  // Get all tradeable tokens for a chain
  getTokensForChain(chainId: number): Promise<SearchableToken[]>
  
  // Search tokens by query
  searchTokens(chainId: number, query: string): Promise<SearchableToken[]>
  
  // Get token by address
  getTokenByAddress(chainId: number, address: string): Promise<SearchableToken | null>
  
  // Get token by symbol
  getTokenBySymbol(chainId: number, symbol: string): Promise<SearchableToken | null>
  
  // Get popular tokens
  getPopularTokens(chainId: number): Promise<SearchableToken[]>
  
  // Clear cache
  clearCache(chainId?: number): void
}
```

### SearchableToken

```typescript
interface SearchableToken {
  symbol: string;        // "USDC"
  name: string;          // "USD Coin"
  address: string;       // "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  chainId: number;       // 1
  decimals: number;      // 6
  logoURI?: string;      // "https://..."
  priceUSD?: string;     // "1.00"
}
```

## Integration with Bridge

### Example: Update BridgeModal to use dynamic search

```typescript
// Instead of loading all balances upfront
const loadBalances = async () => {
  // OLD: Load USDC balance for every chain
  for (const chain of chains) {
    const usdc = await getUSDCToken(chain.id);
    const balance = await getBalance(usdc.address);
  }
};

// NEW: Let user search for token they want to bridge
const handleSelectSourceToken = async (token: SearchableToken) => {
  // Get balance for this specific token
  const balance = await walletManager.getTokenBalance(
    userAddress,
    token,
    chainName
  );
  
  // Get bridge quote from this token to USDC on HyperEVM
  const quote = await bridgeService.getBridgeQuote(
    token.chainId,
    HYPEREVM_CHAIN_ID,
    amount,
    userAddress,
    token.symbol // Can be ETH, WBTC, anything!
  );
};
```

## Benefits

1. **No large JSON files** - No 2.5MB downloads
2. **Always up-to-date** - Fetches latest tokens from LI.FI
3. **Faster initial load** - Only loads what user needs
4. **Better UX** - Search/autocomplete instead of scrolling
5. **Flexible** - Support any token, not just USDC

## Performance

- **Initial modal open**: ~500ms (fetch popular tokens)
- **Search query**: ~50ms (cached) or ~500ms (first time)
- **Address lookup**: ~50ms (cached) or ~500ms (first time)
- **Memory usage**: ~100KB (vs 2.5MB for static JSON)

## Next Steps

To integrate into your bridge widget:

1. Replace static USDC-only balance loading
2. Add token search modal to chain selection
3. Let users pick any token to bridge from
4. LI.FI will handle swap + bridge automatically
