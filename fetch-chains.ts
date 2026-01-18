import { getChains, ChainType, createConfig } from '@lifi/sdk';
import { writeFileSync } from 'fs';

// Initialize LI.FI SDK
createConfig({
  integrator: 'bridge-widget',
  apiKey: "281ba4ad-e3f3-4dc1-ad8f-d19e40722416.3c03ad3e-f891-419c-8d3d-51fb3e61737d",
});

async function fetchAndSaveChains() {
  console.log('Fetching all chains from LI.FI...\n');

  const chains = await getChains({
    chainTypes: [ChainType.EVM, ChainType.SVM, ChainType.UTXO, ChainType.MVM]
  });

  // Create a structured object
  const chainsData = {
    totalChains: chains.length,
    lastUpdated: new Date().toISOString(),
    chains: chains.map(chain => ({
      id: chain.id,
      name: chain.name,
      key: chain.key,
      chainType: chain.chainType,
      nativeToken: chain.nativeToken?.symbol || null,
      logoURI: chain.logoURI || null,
    }))
  };

  // Group by chain type
  const chainsByType = {
    EVM: chains.filter(c => c.chainType === 'EVM').map(c => ({ id: c.id, name: c.name, key: c.key })),
    SVM: chains.filter(c => c.chainType === 'SVM').map(c => ({ id: c.id, name: c.name, key: c.key })),
    UTXO: chains.filter(c => c.chainType === 'UTXO').map(c => ({ id: c.id, name: c.name, key: c.key })),
    MVM: chains.filter(c => c.chainType === 'MVM').map(c => ({ id: c.id, name: c.name, key: c.key })),
  };

  // Save full data
  writeFileSync(
    'chains-full.json',
    JSON.stringify(chainsData, null, 2),
    'utf-8'
  );

  // Save grouped by type
  writeFileSync(
    'chains-by-type.json',
    JSON.stringify(chainsByType, null, 2),
    'utf-8'
  );

  // Save simple id->name mapping
  const simpleMapping: Record<string, string> = {};
  chains.forEach(chain => {
    simpleMapping[chain.id.toString()] = chain.name;
  });

  writeFileSync(
    'chains-simple.json',
    JSON.stringify(simpleMapping, null, 2),
    'utf-8'
  );

  // Console output
  console.log('✅ Chains fetched successfully!\n');
  console.log(`Total chains: ${chains.length}`);
  console.log(`- EVM: ${chainsByType.EVM.length}`);
  console.log(`- SVM: ${chainsByType.SVM.length}`);
  console.log(`- UTXO: ${chainsByType.UTXO.length}`);
  console.log(`- MVM: ${chainsByType.MVM.length}`);
  console.log('\nFiles created:');
  console.log('- chains-full.json (complete chain data)');
  console.log('- chains-by-type.json (grouped by chain type)');
  console.log('- chains-simple.json (simple id->name mapping)');
  console.log('\nSample chains:');
  chains.slice(0, 10).forEach(chain => {
    console.log(`  ${chain.name}: ${chain.id} (${chain.key})`);
  });
}

fetchAndSaveChains().catch(console.error);
