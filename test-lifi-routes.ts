import { createConfig, getQuote, getRoutes, getChains, ChainId, ChainType } from '@lifi/sdk';

// Initialize LI.FI SDK
createConfig({
  integrator: 'bridge-widget',
  apiKey: "281ba4ad-e3f3-4dc1-ad8f-d19e40722416.3c03ad3e-f891-419c-8d3d-51fb3e61737d",
});

async function testRoutes() {
  console.log('='.repeat(80));
  console.log('TEST 0: List All Available Chains by Type');
  console.log('='.repeat(80));
  
  try {
    const allChains = await getChains({
      chainTypes: [ChainType.EVM, ChainType.SVM, ChainType.UTXO, ChainType.MVM],
    });
    
    // Group by chain type
    const evmChains = allChains.filter(c => c.chainType === 'EVM');
    const svmChains = allChains.filter(c => c.chainType === 'SVM');
    const utxoChains = allChains.filter(c => c.chainType === 'UTXO');
    const mvmChains = allChains.filter(c => c.chainType === 'MVM');
    
    console.log(`\n📊 TOTAL CHAINS: ${allChains.length}`);
    
    console.log(`\n🔷 EVM Chains (${evmChains.length}):`);
    evmChains.slice(0, 10).forEach(c => console.log(`  - ${c.name} (ID: ${c.id})`));
    if (evmChains.length > 10) console.log(`  ... and ${evmChains.length - 10} more`);
    
    console.log(`\n☀️ SVM/Solana Chains (${svmChains.length}):`);
    svmChains.forEach(c => console.log(`  - ${c.name} (ID: ${c.id})`));
    
    console.log(`\n₿ UTXO/Bitcoin Chains (${utxoChains.length}):`);
    utxoChains.forEach(c => console.log(`  - ${c.name} (ID: ${c.id})`));
    
    console.log(`\n🌊 MVM/SUI Chains (${mvmChains.length}):`);
    mvmChains.forEach(c => console.log(`  - ${c.name} (ID: ${c.id})`));
    
  } catch (error) {
    console.error('❌ Error listing chains:', error);
  }

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('TEST 1: USDC on Base → ETH on HyperEVM (Cross-chain bridge)');
  console.log('='.repeat(80));
  
  try {
    const route1 = await getQuote({
      fromAddress: '0x1234567890123456789012345678901234567890', // Dummy address
      fromChain: ChainId.BAS, // Base
      toChain: ChainId.HYP, // HyperEVM
      fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
      toToken: '0x0000000000000000000000000000000000000000', // ETH (native) on HyperEVM
      fromAmount: '10000000', // 10 USDC (6 decimals)
      slippage: 0.005, // 0.5%
    });

    console.log('\n📊 ROUTE DETAILS:');
    console.log('Route ID:', route1.id);
    console.log('From Chain:', route1.action.fromChainId, '(Base)');
    console.log('To Chain:', route1.action.toChainId, '(HyperEVM)');
    console.log('From Amount:', route1.action.fromAmount, 'USDC');
    console.log('To Amount (estimated):', route1.estimate.toAmount, 'ETH');
    console.log('To Amount Min:', route1.estimate.toAmountMin, 'ETH');
    console.log('Execution Duration:', route1.estimate.executionDuration, 'seconds');
    console.log('From Amount USD:', route1.estimate.fromAmountUSD);
    console.log('To Amount USD:', route1.estimate.toAmountUSD);
    
    console.log('\n💰 COSTS:');
    console.log('Gas Costs:', JSON.stringify(route1.estimate.gasCosts, null, 2));
    console.log('Fee Costs:', JSON.stringify(route1.estimate.feeCosts, null, 2));
    
    console.log('\n🔧 TOOLS/STEPS:');
    console.log('Tool:', route1.toolDetails.name);
    console.log('Tool Key:', route1.toolDetails.key);
    
    console.log('\n📝 FULL ROUTE OBJECT:');
    console.log(JSON.stringify(route1, null, 2));
    
  } catch (error) {
    console.error('❌ Error in Test 1:', error);
  }

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('TEST 2: ETH on HyperEVM → USDC on HyperEVM (Same-chain swap)');
  console.log('='.repeat(80));
  
  try {
    const route2 = await getQuote({
      fromAddress: '0x1234567890123456789012345678901234567890', // Dummy address
      fromChain: ChainId.HYP, // HyperEVM
      toChain: ChainId.HYP, // HyperEVM (same chain)
      fromToken: '0x0000000000000000000000000000000000000000', // ETH (native)
      toToken: '0xb88339CB7199b77E23DB6E890353E22632Ba630f', // USDC on HyperEVM (placeholder address)
      fromAmount: '1000000000000000000', // 1 ETH (18 decimals)
      slippage: 0.005, // 0.5%
    });

    console.log('\n📊 ROUTE DETAILS:');
    console.log('Route ID:', route2.id);
    console.log('From Chain:', route2.action.fromChainId, '(HyperEVM)');
    console.log('To Chain:', route2.action.toChainId, '(HyperEVM)');
    console.log('From Amount:', route2.action.fromAmount, 'ETH');
    console.log('To Amount (estimated):', route2.estimate.toAmount, 'USDC');
    console.log('To Amount Min:', route2.estimate.toAmountMin, 'USDC');
    console.log('Execution Duration:', route2.estimate.executionDuration, 'seconds');
    console.log('From Amount USD:', route2.estimate.fromAmountUSD);
    console.log('To Amount USD:', route2.estimate.toAmountUSD);
    
    console.log('\n💰 COSTS:');
    console.log('Gas Costs:', JSON.stringify(route2.estimate.gasCosts, null, 2));
    console.log('Fee Costs:', JSON.stringify(route2.estimate.feeCosts, null, 2));
    
    console.log('\n🔧 TOOLS/STEPS:');
    console.log('Tool:', route2.toolDetails.name);
    console.log('Tool Key:', route2.toolDetails.key);
    
    console.log('\n📝 FULL ROUTE OBJECT:');
    console.log(JSON.stringify(route2, null, 2));
    
  } catch (error) {
    console.error('❌ Error in Test 2:', error);
  }

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('TEST 3: Using getRoutes (returns multiple route options)');
  console.log('='.repeat(80));
  
  try {
    const routesResult = await getRoutes({
      fromChainId: ChainId.BAS, // Base
      toChainId: ChainId.HYP, // HyperEVM
      fromTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
      toTokenAddress: '0x0000000000000000000000000000000000000000', // ETH on HyperEVM
      fromAmount: '10000000', // 10 USDC
      options: {
        slippage: 0.005,
      }
    });

    console.log('\n📊 ROUTES FOUND:', routesResult.routes.length);
    
    routesResult.routes.forEach((route, index) => {
      console.log(`\n--- Route ${index + 1} ---`);
      console.log('ID:', route.id);
      console.log('From Amount:', route.fromAmount);
      console.log('To Amount:', route.toAmount);
      console.log('To Amount Min:', route.toAmountMin);
      console.log('Steps:', route.steps.length);
      console.log('Tags:', route.tags);
      
      route.steps.forEach((step, stepIndex) => {
        console.log(`  Step ${stepIndex + 1}:`, step.tool, '-', step.action.fromChainId, '→', step.action.toChainId);
      });
    });
    
    console.log('\n📝 BEST ROUTE (Full Object):');
    console.log(JSON.stringify(routesResult.routes[0], null, 2));
    
  } catch (error) {
    console.error('❌ Error in Test 3:', error);
  }
}

// Run tests
testRoutes().then(() => {
  console.log('\n✅ Tests completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
