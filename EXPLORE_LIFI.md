# LI.FI Explorer Script

This script helps you explore all chains and tokens supported by LI.FI SDK.

## How to Run

```bash
# From the root directory
bun run explore
```

## What It Shows

1. **All Supported Chains**
   - Chain name and ID
   - Chain key (identifier)
   - Chain type (EVM, Solana, etc.)
   - Native token symbol

2. **All Tokens Across All Chains**
   - Total number of tokens per chain
   - USDC availability and address
   - Sample of available tokens

3. **USDC Summary**
   - List of all chains that support USDC
   - USDC contract addresses for each chain

## Example Output

```
🔍 Fetching LI.FI supported chains...

📊 Total chains supported: 58

=== CHAINS ===

🔗 Ethereum (ID: 1)
   Key: eth
   Type: EVM
   Native Token: ETH

🔗 Arbitrum (ID: 42161)
   Key: arb
   Type: EVM
   Native Token: ETH

...

=== USDC AVAILABILITY ===

✅ 45 chains support USDC:

   Ethereum (1): 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
   Arbitrum (42161): 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
   ...
```

## Use Cases

- Find which chains support USDC
- Get USDC contract addresses for different chains
- Discover what tokens are available on each chain
- Verify chain IDs and names for your bridge implementation
