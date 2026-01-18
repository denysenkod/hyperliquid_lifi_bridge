import { getTokens } from '@lifi/sdk';
import { writeFileSync } from 'fs';

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chains: {
    chainId: number;
    chainName?: string;
    address: string;
  }[];
}

// Patterns to identify LP/vault/receipt tokens (not real tradeable tokens)
const JUNK_TOKEN_PATTERNS = [
  /^UNI-V2$/i,
  /^SLP$/i,
  /^PENDLE-LPT$/i,
  /^SPT-PT/i,
  /^eqb/i,
  /^voted-/i,
  /^bb[a-z]/i, // Balancer boosted tokens
  /^LAMINAR-V2$/i,
  /Uniswap V2/i,
  /Liquidity Pool/i,
  /Receipt/i,
  /Vault/i,
  /LP Token/i,
  /^LP$/i,
];

function isJunkToken(token: any): boolean {
  // Check symbol patterns
  if (JUNK_TOKEN_PATTERNS.some(pattern => pattern.test(token.symbol))) {
    return true;
  }
  
  // Check name patterns
  if (JUNK_TOKEN_PATTERNS.some(pattern => pattern.test(token.name))) {
    return true;
  }
  
  // If a token has 50+ addresses on a single chain, it's likely LP tokens
  // (real tokens should have 1 address per chain)
  return false;
}

async function extractTradeableTokens() {
  console.log('🔍 Fetching all tokens from LI.FI...\n');
  
  const tokensData = await getTokens();
  const tokens = (tokensData as any).tokens || tokensData;
  
  // Map to store unique tokens by symbol
  const uniqueTokens = new Map<string, TokenInfo>();
  
  // Track statistics
  let totalTokensAcrossChains = 0;
  let filteredOutCount = 0;
  
  Object.entries(tokens).forEach(([chainId, tokenList]: [string, any]) => {
    if (!Array.isArray(tokenList)) return;
    
    totalTokensAcrossChains += tokenList.length;
    
    tokenList.forEach((token: any) => {
      // Filter out junk tokens
      if (isJunkToken(token)) {
        filteredOutCount++;
        return;
      }
      
      const existing = uniqueTokens.get(token.symbol);
      
      if (existing) {
        // Check if this chain already exists
        const chainExists = existing.chains.some(c => c.chainId === parseInt(chainId));
        if (!chainExists) {
          existing.chains.push({
            chainId: parseInt(chainId),
            address: token.address,
          });
        }
      } else {
        // Create new token entry
        uniqueTokens.set(token.symbol, {
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
          chains: [{
            chainId: parseInt(chainId),
            address: token.address,
          }],
        });
      }
    });
  });
  
  // Convert to array and sort by number of chains (most popular first)
  const tokenArray = Array.from(uniqueTokens.values())
    .sort((a, b) => b.chains.length - a.chains.length);
  
  // Statistics
  console.log('📊 STATISTICS:');
  console.log(`   Total token instances: ${totalTokensAcrossChains}`);
  console.log(`   Filtered out (LP/vault tokens): ${filteredOutCount}`);
  console.log(`   Unique tradeable tokens: ${tokenArray.length}`);
  console.log(`   Tokens with logos: ${tokenArray.filter(t => t.logoURI).length}`);
  console.log(`   Tokens without logos: ${tokenArray.filter(t => !t.logoURI).length}\n`);
  
  // Top 30 most available tokens
  console.log('🏆 TOP 30 MOST AVAILABLE TRADEABLE TOKENS:\n');
  tokenArray.slice(0, 30).forEach((token, index) => {
    const hasLogo = token.logoURI ? '✅' : '❌';
    console.log(`${(index + 1).toString().padStart(2)}. ${token.symbol.padEnd(12)} - ${token.chains.length.toString().padStart(2)} chains ${hasLogo} - ${token.name}`);
  });
  
  // Save to JSON file
  const outputData = {
    generatedAt: new Date().toISOString(),
    totalUniqueTokens: tokenArray.length,
    totalInstances: totalTokensAcrossChains - filteredOutCount,
    tokens: tokenArray,
  };
  
  writeFileSync(
    'tradeable-tokens.json',
    JSON.stringify(outputData, null, 2),
    'utf-8'
  );
  
  console.log('\n✅ Saved to tradeable-tokens.json');
  
  // Create a simplified version with just logos
  const logoMap: Record<string, string> = {};
  tokenArray.forEach(token => {
    if (token.logoURI) {
      logoMap[token.symbol] = token.logoURI;
    }
  });
  
  writeFileSync(
    'tradeable-token-logos.json',
    JSON.stringify(logoMap, null, 2),
    'utf-8'
  );
  
  console.log('✅ Saved logo map to tradeable-token-logos.json');
  
  // Show key stablecoins and major tokens
  console.log('\n💎 KEY TOKENS FOR BRIDGE:\n');
  const importantTokens = [
    'USDC', 'USDT', 'DAI', 'USDC.e', 'USDCe',
    'ETH', 'WETH', 'WBTC', 
    'MATIC', 'BNB', 'AVAX', 'SOL',
    'USDe', 'sUSDe', 'FRAX', 'LUSD',
    'wstETH', 'rETH', 'stETH',
  ];
  
  importantTokens.forEach(symbol => {
    const token = uniqueTokens.get(symbol);
    if (token) {
      const logo = token.logoURI ? '✅' : '❌';
      console.log(`${symbol.padEnd(10)} - ${token.chains.length.toString().padStart(2)} chains ${logo}`);
    }
  });
}

extractTradeableTokens()
  .then(() => {
    console.log('\n✅ Extraction complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
