# LI.FI Route Analysis Results

## Test Results Summary

### Test 1: USDC on Base → ETH on HyperEVM (Cross-chain Bridge)
**Status**: ✅ Success

**Key Data Points**:
- **Tool Used**: Relay Bridge (`relaydepository`)
- **From Amount**: 10 USDC (10,000,000 with 6 decimals)
- **To Amount**: ~0.38 ETH (380861260888114187 with 18 decimals)
- **Execution Duration**: 3 seconds
- **Gas Costs**: ~$0.0013 (paid in ETH on Base)
- **Fee Costs**: 
  - Relayer Gas Fee: $0.0034 (0.03%)
  - Relayer Service Fee: $0.0776 (0.78%)
  - Total Fees: ~$0.08 or 0.8%

**Route Structure**:
```typescript
{
  id: string,
  action: {
    fromChainId: 8453, // Base
    toChainId: 998899, // HyperEVM
    fromToken: { symbol: 'USDC', decimals: 6, ... },
    toToken: { symbol: 'ETH', decimals: 18, ... },
    fromAmount: '10000000',
  },
  estimate: {
    toAmount: '380861260888114187',
    toAmountMin: '378956954583673616',
    executionDuration: 3,
    fromAmountUSD: '9.99',
    toAmountUSD: '9.73',
    gasCosts: [...],
    feeCosts: [...],
  },
  tool: 'relaydepository',
  toolDetails: {
    key: 'relaydepository',
    name: 'Relay',
    logoURI: '...'
  }
}
```

### Test 2: ETH on HyperEVM → USDC on HyperEVM (Same-chain Swap)
**Status**: ❌ Failed - No liquidity/DEX available on HyperEVM yet

This test failed because HyperEVM likely doesn't have DEX liquidity set up yet in LI.FI's routing system.

### Test 3: getRoutes() - Multiple Route Options
**Status**: ✅ Success

**Routes Found**: 1 route
**Tags**: `["RECOMMENDED", "CHEAPEST", "FASTEST"]`

The route returned was the same as Test 1 (using Relay Bridge).

## Important Fields for UI

### For Display:
1. **estimate.toAmount** - Expected output amount (show this prominently)
2. **estimate.toAmountMin** - Minimum guaranteed output (for slippage protection)
3. **estimate.executionDuration** - Time in seconds (convert to minutes for display)
4. **estimate.fromAmountUSD** / **estimate.toAmountUSD** - USD values for comparison
5. **toolDetails.name** - Bridge/DEX name to show user (e.g., "Relay")
6. **toolDetails.logoURI** - Logo to display

### For Costs Breakdown:
1. **estimate.gasCosts[]** - Gas fees (usually paid in native token)
   - `amount` - Raw amount
   - `amountUSD` - USD value
   - `token` - Which token pays gas
2. **estimate.feeCosts[]** - Protocol/service fees
   - `name` - Fee name
   - `amount` - Raw amount
   - `amountUSD` - USD value
   - `percentage` - Fee as % of transaction

### For Execution:
1. **id** - Route ID (needed for execution)
2. **steps[]** - Array of steps (multi-hop routes have multiple steps)
3. **estimate.approvalAddress** - Address to approve tokens to

## Recommendations for Widget

### 1. Show Estimated Receive Amount
```typescript
const estimatedReceive = (parseInt(route.estimate.toAmount) / 10**destToken.decimals).toFixed(4);
```

### 2. Show Total Costs
```typescript
const totalFeesUSD = route.estimate.feeCosts.reduce((sum, fee) => sum + parseFloat(fee.amountUSD), 0);
const totalGasUSD = route.estimate.gasCosts.reduce((sum, gas) => sum + parseFloat(gas.amountUSD), 0);
const totalCostUSD = totalFeesUSD + totalGasUSD;
```

### 3. Show Execution Time
```typescript
const estimatedMinutes = Math.ceil(route.estimate.executionDuration / 60);
```

### 4. Show Route Details
```typescript
const bridgeName = route.toolDetails.name; // "Relay"
const bridgeLogo = route.toolDetails.logoURI;
```

## Code Integration Example

```typescript
// In BridgeModal.tsx
const [routeQuote, setRouteQuote] = useState<LiFiStep | null>(null);

// Fetch quote when source/dest/amount changes
useEffect(() => {
  const fetchQuote = async () => {
    if (!selectedToken || !destToken || !amount) return;
    
    try {
      const quote = await getQuote({
        fromAddress: walletAddress,
        fromChain: selectedChain.chainId,
        toChain: destChain.id,
        fromToken: selectedToken.address,
        toToken: destToken.address,
        fromAmount: (parseFloat(amount) * 10**selectedToken.decimals).toString(),
        slippage: 0.005,
      });
      
      setRouteQuote(quote);
    } catch (error) {
      console.error('Failed to get quote:', error);
    }
  };
  
  fetchQuote();
}, [selectedToken, destToken, amount]);

// Display in UI
{routeQuote && (
  <div>
    <div>Estimated: {(parseInt(routeQuote.estimate.toAmount) / 10**destToken.decimals).toFixed(4)} {destToken.symbol}</div>
    <div>Time: ~{Math.ceil(routeQuote.estimate.executionDuration / 60)} min</div>
    <div>Via: {routeQuote.toolDetails.name}</div>
  </div>
)}
```

## Next Steps

1. ✅ Integrate `getQuote` into BridgeModal
2. ✅ Display estimated receive amount
3. ✅ Show execution time and fees
4. ✅ Update bridge button to use the quote for execution
5. ⚠️ Handle errors (no routes found, insufficient liquidity, etc.)
