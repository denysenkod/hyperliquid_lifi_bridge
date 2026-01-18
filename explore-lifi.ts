import { getChains, getTokens } from '@lifi/sdk';

async function exploreLiFi() {
  console.log('🔍 Fetching LI.FI supported chains...\n');
  
  // Get all supported chains
  const chains = await getChains();
  console.log(`📊 Total chains supported: ${chains.length}\n`);
  
  console.log('=== CHAINS ===');
  chains.forEach((chain) => {
    console.log(`\n🔗 ${chain.name} (ID: ${chain.id})`);
    console.log(`   Key: ${chain.key}`);
    console.log(`   Type: ${chain.chainType}`);
    console.log(`   Native Token: ${chain.nativeToken.symbol}`);
  });

  console.log('\n\n🔍 Fetching all tokens across all chains...\n');
  
  // Get all tokens across all chains
  const tokensData = await getTokens();
  console.log(`📊 Tokens data structure:`, typeof tokensData);
  console.log(`📊 Keys:`, Object.keys(tokensData));
  
  // The actual structure is { tokens: { [chainId]: Token[] } }
  const tokens = (tokensData as any).tokens || tokensData;
  
  console.log('=== TOKENS BY CHAIN ===');
  const tokenEntries = Object.entries(tokens);
  console.log(`Found ${tokenEntries.length} chains with tokens\n`);
  
  tokenEntries.forEach(([chainId, tokenList]: [string, any]) => {
    // Skip if not an array
    if (!Array.isArray(tokenList)) {
      return;
    }
    
    const chain = chains.find(c => c.id === parseInt(chainId));
    const chainName = chain?.name || `Chain ${chainId}`;
    console.log(`\n🔗 ${chainName} (ID: ${chainId})`);
    console.log(`   Total tokens: ${tokenList.length}`);
    
    // Show USDC if available
    const usdc = tokenList.find((t: any) => t.symbol === 'USDC');
    if (usdc) {
      console.log(`   ✅ USDC: ${usdc.address}`);
      console.log(`      Decimals: ${usdc.decimals}`);
    } else {
      console.log(`   ❌ No USDC token`);
    }
    
    // Show first 5 tokens as sample
    console.log(`   Sample tokens: ${tokenList.slice(0, 5).map((t: any) => t.symbol).join(', ')}`);
  });

  // Summary: Chains with USDC
  console.log('\n\n=== USDC AVAILABILITY ===');
  const chainsWithUSDC: any[] = [];
  tokenEntries.forEach(([chainId, tokenList]: [string, any]) => {
    if (!Array.isArray(tokenList)) return;
    
    const usdc = tokenList.find((t: any) => t.symbol === 'USDC');
    if (usdc) {
      const chain = chains.find(c => c.id === parseInt(chainId));
      chainsWithUSDC.push({
        chainId: parseInt(chainId),
        name: chain?.name || `Chain ${chainId}`,
        address: usdc.address,
      });
    }
  });

  console.log(`\n✅ ${chainsWithUSDC.length} chains support USDC:\n`);
  chainsWithUSDC.forEach(({ chainId, name, address }) => {
    console.log(`   ${name} (${chainId}): ${address}`);
  });
}

// Run the exploration
exploreLiFi()
  .then(() => {
    console.log('\n✅ Exploration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
