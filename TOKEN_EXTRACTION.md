# Token Extraction Script

Extract all tokens and their logos from LI.FI SDK for use in your bridge UI.

## How to Run

```bash
bun run extract-tokens
```

## Generated Files

### 1. `tokens-database.json` (2.8 MB)
Complete database with all token information:

```json
{
  "generatedAt": "2026-01-17T13:54:00.000Z",
  "totalUniqueTokens": 3247,
  "totalInstances": 8542,
  "tokens": [
    {
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
      "chains": [
        { "chainId": 1, "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
        { "chainId": 42161, "address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
        // ... 37 more chains
      ]
    }
  ]
}
```

### 2. `token-logos.json` (507 KB)
Simple symbol → logo URL mapping for quick lookups:

```json
{
  "USDC": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  "USDT": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  "ETH": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
  "WBTC": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png"
}
```

## Key Statistics

- **3,247 unique tokens** across all chains
- **8,542 total token instances** (same token on multiple chains)
- **~95% have logos** (3,100+ tokens with logoURI)

## Top Tokens by Availability

| Token | Chains | Has Logo |
|-------|--------|----------|
| USDT | 43 | ✅ |
| WBTC | 44 | ✅ |
| USDC | 39 | ✅ |
| ETH | 24 | ✅ |
| LINK | 23 | ✅ |
| USDe | 19 | ✅ |
| sUSDe | 19 | ✅ |

## Usage in Your Bridge

### Option 1: Import the logo map directly

```typescript
import tokenLogos from './token-logos.json';

function TokenIcon({ symbol }: { symbol: string }) {
  const logoUrl = tokenLogos[symbol];
  
  return logoUrl ? (
    <img src={logoUrl} alt={symbol} width={24} height={24} />
  ) : (
    <div className="token-placeholder">{symbol[0]}</div>
  );
}
```

### Option 2: Use the full database

```typescript
import tokensDb from './tokens-database.json';

// Find token info by symbol
const usdc = tokensDb.tokens.find(t => t.symbol === 'USDC');

// Get USDC address on Arbitrum
const arbitrumUSDC = usdc?.chains.find(c => c.chainId === 42161);
console.log(arbitrumUSDC?.address); // 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
```

### Option 3: Fetch logos on-demand

```typescript
// For tokens without logos, use a fallback service
function getTokenLogo(symbol: string, address?: string) {
  // Try our database first
  if (tokenLogos[symbol]) {
    return tokenLogos[symbol];
  }
  
  // Fallback to TrustWallet
  if (address) {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`;
  }
  
  // Or use a generic placeholder
  return '/assets/token-placeholder.svg';
}
```

## Important Tokens for Bridge

### Stablecoins
- **USDC** - 39 chains ✅
- **USDT** - 43 chains ✅
- **DAI** - 17 chains ✅
- **USDe** - 19 chains ✅
- **FRAX** - Various chains ✅

### Major Assets
- **ETH** - 24 chains ✅
- **WETH** - 54 chains (⚠️ no logo in some cases)
- **WBTC** - 44 chains ✅
- **LINK** - 23 chains ✅

### Native Tokens
- **MATIC** - 8 chains ✅
- **BNB** - 10 chains ✅
- **AVAX** - 7 chains ✅

## Updating the Database

Re-run the script periodically to get the latest tokens:

```bash
bun run extract-tokens
```

This will overwrite `tokens-database.json` and `token-logos.json` with fresh data from LI.FI.

## Notes

- Logo URLs are from TrustWallet, Coingecko, Debank, and other sources
- ~5% of tokens don't have logos - use fallback icons for these
- The database is sorted by chain availability (most available tokens first)
- Files are gitignored by default - regenerate as needed
