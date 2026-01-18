import { getTokens } from '@lifi/sdk';
import { writeFileSync } from 'fs';

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chains: {
    chainId: number;
    address: string;
  }[];
}

async function extractAllTokens() {
  console.log('🔍 Fetching all tokens from LI.FI...\n');
  
  const tokensData = await getTokens();
  const tokens = (tokensData as any).tokens || tokensData;
  
  // Map to store unique tokens by symbol
  const uniqueTokens = new Map<string, TokenInfo>();
  
  // Track statistics
  let totalTokensAcrossChains = 0;
  
  Object.entries(tokens).forEach(([chainId, tokenList]: [string, any]) => {
    if (!Array.isArray(tokenList)) return;
    
    totalTokensAcrossChains += tokenList.length;
    
    tokenList.forEach((token: any) => {
      const existing = uniqueTokens.get(token.symbol);
      
      if (existing) {
        // Add this chain to the existing token
        existing.chains.push({
          chainId: parseInt(chainId),
          address: token.address,
        });
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
  console.log(`   Total unique tokens: ${tokenArray.length}`);
  console.log(`   Total token instances across chains: ${totalTokensAcrossChains}`);
  console.log(`   Tokens with logos: ${tokenArray.filter(t => t.logoURI).length}`);
  console.log(`   Tokens without logos: ${tokenArray.filter(t => !t.logoURI).length}\n`);
  
  // Top 20 most available tokens
  console.log('🏆 TOP 20 MOST AVAILABLE TOKENS (by chain count):\n');
  tokenArray.slice(0, 20).forEach((token, index) => {
    const hasLogo = token.logoURI ? '✅' : '❌';
    console.log(`${index + 1}. ${token.symbol.padEnd(12)} - ${token.chains.length} chains ${hasLogo}`);
    if (token.logoURI) {
      console.log(`   Logo: ${token.logoURI}`);
    }
  });
  
  // Save to JSON file
  const outputData = {
    generatedAt: new Date().toISOString(),
    totalUniqueTokens: tokenArray.length,
    totalInstances: totalTokensAcrossChains,
    tokens: tokenArray,
  };
  
  writeFileSync(
    'tokens-database.json',
    JSON.stringify(outputData, null, 2),
    'utf-8'
  );
  
  console.log('\n✅ Saved to tokens-database.json');
  
  // Create a simplified version with just logos
  const logoMap: Record<string, string> = {};
  tokenArray.forEach(token => {
    if (token.logoURI) {
      logoMap[token.symbol] = token.logoURI;
    }
  });
  
  writeFileSync(
    'token-logos.json',
    JSON.stringify(logoMap, null, 2),
    'utf-8'
  );
  
  console.log('✅ Saved logo map to token-logos.json');
  
  // Show tokens without logos that might need custom icons
  console.log('\n⚠️  TOKENS WITHOUT LOGOS (top 20 by availability):');
  const tokensWithoutLogos = tokenArray.filter(t => !t.logoURI);
  tokensWithoutLogos.slice(0, 20).forEach((token, index) => {
    console.log(`${index + 1}. ${token.symbol.padEnd(12)} - ${token.name} (${token.chains.length} chains)`);
  });
  
  // Show specific important tokens
  console.log('\n💎 KEY STABLECOINS & MAJOR TOKENS:\n');
  const importantTokens = ['USDC', 'USDT', 'DAI', 'ETH', 'WETH', 'WBTC', 'MATIC', 'BNB', 'AVAX'];
  importantTokens.forEach(symbol => {
    const token = uniqueTokens.get(symbol);
    if (token) {
      console.log(`${symbol.padEnd(8)} - ${token.chains.length} chains`);
      console.log(`   Name: ${token.name}`);
      console.log(`   Logo: ${token.logoURI || '❌ No logo'}`);
      console.log(`   Decimals: ${token.decimals}`);
      console.log('');
    }
  });
}

extractAllTokens()
  .then(() => {
    console.log('\n✅ Token extraction complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
