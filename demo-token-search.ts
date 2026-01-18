import { TokenSearchService } from './component/tokenSearch';

async function demo() {
  const searchService = new TokenSearchService();
  
  console.log('🔍 Dynamic Token Search Demo\n');
  
  // 1. Get popular tokens on Ethereum
  console.log('1️⃣ Popular tokens on Ethereum (chain 1):');
  const popular = await searchService.getPopularTokens(1);
  popular.forEach(token => {
    console.log(`   ${token.symbol.padEnd(8)} - ${token.name}`);
    console.log(`   Address: ${token.address}`);
    console.log(`   Logo: ${token.logoURI ? '✅' : '❌'}\n`);
  });
  
  // 2. Search for tokens by name
  console.log('\n2️⃣ Search for "USD" on Ethereum:');
  const usdTokens = await searchService.searchTokens(1, 'USD');
  usdTokens.slice(0, 5).forEach(token => {
    console.log(`   ${token.symbol.padEnd(10)} - ${token.name}`);
  });
  
  // 3. Get specific token by symbol
  console.log('\n3️⃣ Get USDC on Arbitrum (chain 42161):');
  const arbUSDC = await searchService.getTokenBySymbol(42161, 'USDC');
  if (arbUSDC) {
    console.log(`   Symbol: ${arbUSDC.symbol}`);
    console.log(`   Name: ${arbUSDC.name}`);
    console.log(`   Address: ${arbUSDC.address}`);
    console.log(`   Decimals: ${arbUSDC.decimals}`);
    console.log(`   Logo: ${arbUSDC.logoURI}`);
  }
  
  // 4. Get token by address
  console.log('\n4️⃣ Get token by address on Ethereum:');
  const tokenByAddress = await searchService.getTokenByAddress(
    1,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  );
  if (tokenByAddress) {
    console.log(`   Found: ${tokenByAddress.symbol} (${tokenByAddress.name})`);
  }
  
  // 5. Search on Base
  console.log('\n5️⃣ Popular tokens on Base (chain 8453):');
  const baseTokens = await searchService.getPopularTokens(8453);
  baseTokens.forEach(token => {
    console.log(`   ${token.symbol.padEnd(8)} - ${token.name}`);
  });
  
  // 6. Search on HyperEVM
  console.log('\n6️⃣ Get USDC on HyperEVM (chain 999):');
  const hyperUSDC = await searchService.getTokenBySymbol(999, 'USDC');
  if (hyperUSDC) {
    console.log(`   Symbol: ${hyperUSDC.symbol}`);
    console.log(`   Address: ${hyperUSDC.address}`);
    console.log(`   ✅ HyperEVM supports USDC!`);
  }
  
  console.log('\n✅ Demo complete!');
  console.log('\n💡 Key benefits:');
  console.log('   - No 2.5MB JSON files to download');
  console.log('   - Fetches only what you need');
  console.log('   - 5-minute cache for performance');
  console.log('   - Filters out LP/vault tokens automatically');
  console.log('   - Search by name, symbol, or address');
}

demo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
