import { LiFiBridgeService } from './bridge';
import { WalletManager } from './wallet';
import { TokenSearchService } from './tokenSearch';
import type { ChainInfo, TokenInfo } from '../types/index';
import type { LiFiStep } from '@lifi/sdk';

// Arbitrum chain configuration (destination for all bridges)
const ARBITRUM_CHAIN_ID = 42161;

// USDC on Arbitrum (native USDC)
const ARBITRUM_USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

// HyperLiquid Bridge Contract on Arbitrum
export const HYPERLIQUID_BRIDGE_ADDRESS = '0x2df1c51e09aecf9cacb7bc98cb1742757f163df7';

// Minimum deposit to HyperLiquid (5 USDC)
export const MIN_HYPERLIQUID_DEPOSIT_USD = 5;

// Minimum balance to consider for bridging (in USD)
const MIN_BALANCE_USD = 1.0;

// Maximum number of tokens to check for quotes (performance)
const MAX_TOKENS_TO_CHECK = 20;

// Native token addresses (zero address or chain-specific)
const NATIVE_TOKEN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Common EVM native token placeholder
];

// Native token symbols - these are gas tokens on their respective chains
const NATIVE_TOKEN_SYMBOLS = [
  'ETH',    // Ethereum, Optimism, Base, Arbitrum, Linea, Scroll, zkSync
  'MATIC',  // Polygon
  'POL',    // Polygon (new symbol)
  'BNB',    // BSC
  'FTM',    // Fantom
  'AVAX',   // Avalanche
  'MON',    // Monad
  'HYPE',   // HyperEVM
  'CELO',   // Celo
  'GLMR',   // Moonbeam
  'MOVR',   // Moonriver
  'ONE',    // Harmony
  'KLAY',   // Klaytn
  'CRO',    // Cronos
  'METIS',  // Metis
  'BOBA',   // Boba
];

// Gas reserve amounts per chain (in native token units)
// These are conservative estimates to ensure enough gas for transactions
const GAS_RESERVE_BY_CHAIN: Record<number, number> = {
  1: 0.005,      // Ethereum - ~0.015 ETH
  10: 0.001,     // Optimism - ~0.003 ETH
  56: 0.0005,     // BSC - ~0.015 BNB
  137: 3,        // Polygon - ~3 MATIC
  250: 1.5,      // Fantom - ~1.5 FTM
  8453: 0.003,   // Base - ~0.003 ETH
  42161: 0.001,  // Arbitrum - ~0.003 ETH
  43114: 0.05,   // Avalanche - ~0.15 AVAX
  59144: 0.001,  // Linea - ~0.003 ETH
  324: 0.001,    // zkSync Era - ~0.003 ETH
  534352: 0.001, // Scroll - ~0.003 ETH
  999: 0.03,     // HyperEVM - ~0.03 HYPE
  143: 0.4,      // Monad - ~0.4 MON
};
const DEFAULT_GAS_RESERVE = 0.6; // Default for unknown chains - be conservative

/**
 * Check if a token is a native gas token (by address OR symbol)
 */
function isNativeToken(tokenAddress: string, tokenSymbol?: string): boolean {
  // Check by address
  if (NATIVE_TOKEN_ADDRESSES.includes(tokenAddress.toLowerCase())) {
    return true;
  }
  
  // Check by symbol - if it matches a known native token symbol
  if (tokenSymbol) {
    const upperSymbol = tokenSymbol.toUpperCase();
    return NATIVE_TOKEN_SYMBOLS.includes(upperSymbol);
  }
  
  return false;
}

/**
 * Get gas reserve amount for a chain
 */
function getGasReserve(chainId: number): number {
  return GAS_RESERVE_BY_CHAIN[chainId] ?? DEFAULT_GAS_RESERVE;
}

// Stablecoin symbols that should be rounded to whole units
const STABLECOIN_SYMBOLS = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'USDP', 'GUSD', 'FRAX', 'LUSD', 'SUSD', 'UST', 'MIM'];

/**
 * Check if a token is a stablecoin based on symbol
 */
function isStablecoin(tokenSymbol: string): boolean {
  const upperSymbol = tokenSymbol.toUpperCase();
  return STABLECOIN_SYMBOLS.some(stable => 
    upperSymbol === stable || 
    upperSymbol.includes(stable) ||
    upperSymbol.startsWith('USD') ||
    upperSymbol.endsWith('USD')
  );
}

/**
 * Round a token amount DOWN to avoid precision issues
 * For stablecoins: round to whole units (e.g., 12.05 USDC → 12 USDC)
 * For other tokens: limit to 6 significant decimals
 * This prevents floating-point precision errors when the SDK validates amounts
 */
function roundTokenAmount(amount: number, tokenDecimals: number, tokenSymbol: string): string {
  // For stablecoins, ALWAYS round down to whole units
  // This prevents the "fromAmount must be equal to constant" error
  if (isStablecoin(tokenSymbol)) {
    const wholeUnits = Math.floor(amount);
    if (wholeUnits <= 0) return '0';
    
    // Convert whole units to smallest unit (e.g., 12 USDC = 12000000)
    const decimalMultiplier = Math.pow(10, tokenDecimals);
    return Math.floor(wholeUnits * decimalMultiplier).toString();
  }
  
  // For non-stablecoins, limit precision to avoid floating point issues
  // Use at most 4 decimals of precision for safety
  const effectiveDecimals = Math.min(tokenDecimals, 4);
  
  // Round down to effective precision first
  const scaleFactor = Math.pow(10, effectiveDecimals);
  const roundedAmount = Math.floor(amount * scaleFactor) / scaleFactor;
  
  if (roundedAmount <= 0) return '0';
  
  // Now convert to smallest unit (wei, etc.)
  // Use BigInt-like approach to avoid floating point issues
  const wholePart = Math.floor(roundedAmount);
  const fractionalPart = roundedAmount - wholePart;
  
  // Calculate smallest unit amount
  const decimalMultiplier = Math.pow(10, tokenDecimals);
  const wholeInSmallest = wholePart * decimalMultiplier;
  const fractionalInSmallest = Math.floor(fractionalPart * decimalMultiplier);
  
  return Math.floor(wholeInSmallest + fractionalInSmallest).toString();
}

export interface TokenBalance {
  chainId: number;
  chainName: string;
  chainLogo?: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenLogo?: string;
  balance: string;
  balanceUSD: number;
}

export interface BridgeOption {
  from: TokenBalance;
  quote: LiFiStep;
  estimatedOutputUSD: number;
  estimatedTimeSeconds: number;
  estimatedFeesUSD: number;
  efficiency: number; // output/input ratio (0-1)
  // Partial usage fields (set when selecting bridges for a strategy)
  usedInputUSD?: number; // How much of the input to actually use
  usedOutputUSD?: number; // Expected output for the used amount
  usedInputAmount?: string; // Actual token amount to bridge (in smallest unit)
}

export interface DepositStrategy {
  type: 'fastest' | 'cheapest';
  bridges: BridgeOption[];
  totalInputUSD: number;
  totalOutputUSD: number;
  totalTimeSeconds: number;
  totalFeesUSD: number;
  efficiency: number;
}

export interface DepositPlan {
  targetAmount: number;
  availableBalanceUSD: number;
  fastest: DepositStrategy | null;
  cheapest: DepositStrategy | null;
  allBalances: TokenBalance[];
  insufficientFunds: boolean;
}

export class DepositOptimizer {
  private bridgeService: LiFiBridgeService;
  private walletManager: WalletManager;
  private tokenSearchService: TokenSearchService;

  constructor() {
    this.bridgeService = new LiFiBridgeService();
    this.walletManager = new WalletManager();
    this.tokenSearchService = new TokenSearchService();
  }

  /**
   * Get USDC address on Arbitrum (constant - native USDC)
   */
  private getArbitrumUSDCAddress(): string {
    return ARBITRUM_USDC_ADDRESS;
  }
  
  /**
   * Get destination chain ID (Arbitrum)
   */
  getDestinationChainId(): number {
    return ARBITRUM_CHAIN_ID;
  }

  /**
   * Scan all balances across all supported chains
   */
  async scanAllBalances(
    walletAddress: string,
    chains: ChainInfo[],
    onProgress?: (message: string, progress: number) => void
  ): Promise<TokenBalance[]> {
    const allBalances: TokenBalance[] = [];
    
    onProgress?.('Scanning chains for balances...', 0);
    
    console.log(`🔍 Scanning ${chains.length} chains:`, chains.map(c => `${c.name} (${c.id})`).join(', '));

    // For each chain, get the user's token balances
    for (let i = 0; i < chains.length; i++) {
      const chain = chains[i];
      onProgress?.(`Scanning ${chain.name}...`, (i / chains.length) * 50);

      try {
        // Get native token balance
        const nativeBalance = await this.walletManager.getTokenBalance(
          walletAddress,
          {
            address: '0x0000000000000000000000000000000000000000',
            symbol: chain.nativeToken?.symbol || 'ETH',
            decimals: chain.nativeToken?.decimals || 18,
            chainId: chain.id,
            name: chain.nativeToken?.symbol || 'Native Token',
          },
          chain.name
        );

        const nativeBalanceNum = parseFloat(nativeBalance.formattedBalance);
        if (nativeBalanceNum > 0) {
          // Get price for native token
          const price = await this.bridgeService.getTokenPrice(
            chain.id,
            '0x0000000000000000000000000000000000000000'
          );
          
          const balanceUSD = price ? nativeBalanceNum * price : 0;
          
          if (balanceUSD >= MIN_BALANCE_USD) {
            allBalances.push({
              chainId: chain.id,
              chainName: chain.name,
              chainLogo: chain.logoURI,
              tokenAddress: '0x0000000000000000000000000000000000000000',
              tokenSymbol: chain.nativeToken?.symbol || 'ETH',
              tokenDecimals: chain.nativeToken?.decimals || 18,
              tokenLogo: chain.logoURI,
              balance: nativeBalance.formattedBalance,
              balanceUSD,
            });
          }
        }

        // Also check for common stablecoins (USDC, USDT, DAI)
        const stablecoins = await this.getStablecoinBalances(walletAddress, chain);
        allBalances.push(...stablecoins.filter(b => b.balanceUSD >= MIN_BALANCE_USD));

      } catch (error) {
        console.warn(`Failed to scan ${chain.name}:`, error);
      }
    }

    onProgress?.('Balance scan complete', 50);

    // Sort by USD value descending
    return allBalances.sort((a, b) => b.balanceUSD - a.balanceUSD);
  }

  /**
   * Get stablecoin balances for a chain
   */
  private async getStablecoinBalances(
    walletAddress: string,
    chain: ChainInfo
  ): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    
    // Common stablecoin addresses per chain (simplified - in production, use token list)
    const stablecoins: Record<number, Array<{ address: string; symbol: string; decimals: number }>> = {
      1: [ // Ethereum
        { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
        { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
      ],
      137: [ // Polygon
        { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', decimals: 6 },
        { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6 },
      ],
      42161: [ // Arbitrum
        { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 },
        { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6 },
      ],
      8453: [ // Base
        { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
      ],
      10: [ // Optimism
        { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6 },
        { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', decimals: 6 },
      ],
      43114: [ // Avalanche
        { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', decimals: 6 },
        { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', symbol: 'USDT', decimals: 6 },
      ],
      56: [ // BSC
        { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18 },
        { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
      ],
      143: [ // Monad
        { address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', symbol: 'USDC', decimals: 6 },
      ],
      999: [ // HyperEVM
        { address: '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7', symbol: 'USDC', decimals: 6 },
      ],
    };

    const chainStables = stablecoins[chain.id] || [];
    
    for (const stable of chainStables) {
      try {
        const balance = await this.walletManager.getTokenBalance(
          walletAddress,
          {
            address: stable.address,
            symbol: stable.symbol,
            decimals: stable.decimals,
            chainId: chain.id,
            name: stable.symbol,
          },
          chain.name
        );

        const balanceNum = parseFloat(balance.formattedBalance);
        if (balanceNum > 0) {
          // Stablecoins are ~$1
          const balanceUSD = balanceNum;
          
          balances.push({
            chainId: chain.id,
            chainName: chain.name,
            chainLogo: chain.logoURI,
            tokenAddress: stable.address,
            tokenSymbol: stable.symbol,
            tokenDecimals: stable.decimals,
            balance: balance.formattedBalance,
            balanceUSD,
          });
        }
      } catch (error) {
        // Skip failed balance fetches
      }
    }

    return balances;
  }

  /**
   * Get bridge quotes for all balances to HyperEVM USDC
   */
  async getBridgeQuotes(
    walletAddress: string,
    balances: TokenBalance[],
    onProgress?: (message: string, progress: number) => void
  ): Promise<BridgeOption[]> {
    const options: BridgeOption[] = [];
    
    // Limit number of quotes to fetch
    const balancesToQuote = balances.slice(0, MAX_TOKENS_TO_CHECK);
    
    onProgress?.('Getting bridge quotes...', 50);
    
    console.log(`💰 Found ${balances.length} balances to check:`, 
      balances.map(b => `${b.tokenSymbol} on ${b.chainName} (chain ${b.chainId}): $${b.balanceUSD.toFixed(2)}`).join(', ')
    );

    // Get Arbitrum USDC address (destination for all bridges)
    const arbitrumUSDCAddress = this.getArbitrumUSDCAddress();

    for (let i = 0; i < balancesToQuote.length; i++) {
      const balance = balancesToQuote[i];
      onProgress?.(
        `Getting quote for ${balance.tokenSymbol} on ${balance.chainName}...`,
        50 + (i / balancesToQuote.length) * 40
      );

      try {
        // Skip if already USDC on Arbitrum (no need to bridge)
        if (balance.chainId === ARBITRUM_CHAIN_ID && 
            balance.tokenAddress.toLowerCase() === arbitrumUSDCAddress.toLowerCase()) {
          console.log('⏭️ Skipping USDC on Arbitrum - already at destination');
          continue;
        }

        // Convert balance to smallest unit
        const balanceNum = parseFloat(balance.balance);
        const amountInSmallestUnit = Math.floor(
          balanceNum * Math.pow(10, balance.tokenDecimals)
        ).toString();

        // Skip if amount is too small
        if (amountInSmallestUnit === '0') continue;

        // Get quote to Arbitrum USDC
        const quote = await this.bridgeService.getBridgeRouteWithTokens(
          balance.chainId,
          ARBITRUM_CHAIN_ID,
          balance.tokenAddress,
          arbitrumUSDCAddress,
          amountInSmallestUnit,
          walletAddress
        );

        // Calculate output in USD (USDC has 6 decimals)
        const outputAmount = parseInt(quote.estimate.toAmount) / 1e6;
        const estimatedFeesUSD = balance.balanceUSD - outputAmount;
        const efficiency = outputAmount / balance.balanceUSD;

        options.push({
          from: balance,
          quote,
          estimatedOutputUSD: outputAmount,
          estimatedTimeSeconds: quote.estimate.executionDuration || 60,
          estimatedFeesUSD: Math.max(0, estimatedFeesUSD),
          efficiency,
        });
      } catch (error) {
        console.warn(
          `Failed to get quote for ${balance.tokenSymbol} on ${balance.chainName}:`,
          error
        );
      }
    }

    onProgress?.('Quotes complete', 90);
    return options;
  }

  /**
   * Calculate optimal deposit strategies (fastest and cheapest)
   */
  calculateStrategies(
    targetAmount: number,
    options: BridgeOption[]
  ): { fastest: DepositStrategy | null; cheapest: DepositStrategy | null } {
    if (options.length === 0) {
      return { fastest: null, cheapest: null };
    }

    // Calculate FASTEST strategy (minimize total time)
    const fastest = this.selectOptimalBridges(
      targetAmount,
      options,
      'fastest'
    );

    // Calculate CHEAPEST strategy (maximize efficiency / minimize fees)
    const cheapest = this.selectOptimalBridges(
      targetAmount,
      options,
      'cheapest'
    );

    return { fastest, cheapest };
  }

  /**
   * Select optimal bridges to reach target amount (exactly)
   */
  private selectOptimalBridges(
    targetAmount: number,
    options: BridgeOption[],
    strategy: 'fastest' | 'cheapest'
  ): DepositStrategy | null {
    // Sort options based on strategy
    const sortedOptions = [...options].sort((a, b) => {
      if (strategy === 'fastest') {
        // Sort by time ascending, then by output descending
        if (a.estimatedTimeSeconds !== b.estimatedTimeSeconds) {
          return a.estimatedTimeSeconds - b.estimatedTimeSeconds;
        }
        return b.estimatedOutputUSD - a.estimatedOutputUSD;
      } else {
        // Sort by efficiency descending (best value first)
        if (a.efficiency !== b.efficiency) {
          return b.efficiency - a.efficiency;
        }
        return b.estimatedOutputUSD - a.estimatedOutputUSD;
      }
    });

    // Greedily select bridges until we reach target
    const selectedBridges: BridgeOption[] = [];
    let totalOutput = 0;
    let totalInput = 0;
    let totalTime = 0;
    let totalFees = 0;
    
    // Tolerance: we're done if within 5% of target (no need for tiny dust amounts)
    const COMPLETION_TOLERANCE = 0.95; // 95% of target is good enough
    const MIN_BRIDGE_USD = 1.0; // Skip bridges worth less than $1

    for (const option of sortedOptions) {
      // Stop if we've reached target
      if (totalOutput >= targetAmount) break;
      
      // Stop if we're within 5% of target - no need for tiny dust bridges
      if (totalOutput >= targetAmount * COMPLETION_TOLERANCE) {
        console.log(`✅ Reached ${((totalOutput / targetAmount) * 100).toFixed(1)}% of target, stopping (within tolerance)`);
        break;
      }

      // Calculate available balance, accounting for gas reserves on native tokens
      let availableBalance = parseFloat(option.from.balance);
      const isNative = isNativeToken(option.from.tokenAddress, option.from.tokenSymbol);
      
      if (isNative) {
        // Reserve gas for the transaction
        const gasReserve = getGasReserve(option.from.chainId);
        availableBalance = Math.max(0, availableBalance - gasReserve);
        
        console.log(`⛽ ${option.from.tokenSymbol} is native token on chain ${option.from.chainId}, reserving ${gasReserve} for gas. Available: ${availableBalance.toFixed(4)}`);
        
        // Skip if not enough balance after gas reserve
        if (availableBalance <= 0) {
          console.log(`⏭️ Skipping ${option.from.tokenSymbol}: not enough balance after gas reserve`);
          continue;
        }
      }
      
      // Calculate the max output we can get from this option (accounting for gas reserve)
      const originalBalance = parseFloat(option.from.balance);
      const availableFractionOfOriginal = availableBalance / originalBalance;
      const maxAvailableOutputUSD = availableFractionOfOriginal * option.estimatedOutputUSD;

      // Calculate how much more output we need
      const neededOutput = targetAmount - totalOutput;
      
      // Check if this is a stablecoin (needed for rounding decisions)
      const tokenSymbol = option.from.tokenSymbol.toUpperCase();
      const isStablecoin = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD'].some(s => tokenSymbol.includes(s));
      
      let usedInputAmount: string;
      let usedTokenAmount: number;
      
      if (isStablecoin) {
        // SIMPLE LOGIC FOR STABLECOINS:
        // Stablecoins are ~$1 each, so just take the number of units we need
        // Account for ~1-2% bridge fees by adding 1 extra unit
        const unitsNeeded = Math.ceil(neededOutput) + 1; // +1 for fees
        const unitsToUse = Math.min(unitsNeeded, Math.floor(availableBalance));
        
        if (unitsToUse < 1) continue;
        
        usedTokenAmount = unitsToUse;
        usedInputAmount = Math.floor(unitsToUse * Math.pow(10, option.from.tokenDecimals)).toString();
        
        console.log(`� Stablecoin: need $${neededOutput.toFixed(2)}, using ${unitsToUse} ${option.from.tokenSymbol} (available: ${Math.floor(availableBalance)})`);
      } else {
        // For non-stablecoins: use fraction-based calculation
        if (maxAvailableOutputUSD <= neededOutput) {
          // This token alone won't reach target - use ALL of it
          usedTokenAmount = availableBalance;
          console.log(`💯 Using 100% of ${option.from.tokenSymbol} ($${maxAvailableOutputUSD.toFixed(2)}) - need $${neededOutput.toFixed(2)} more`);
        } else {
          // This token would exceed target - take only what we need
          const fractionNeeded = neededOutput / maxAvailableOutputUSD;
          usedTokenAmount = availableBalance * fractionNeeded;
          console.log(`📊 Using ${(fractionNeeded * 100).toFixed(1)}% of ${option.from.tokenSymbol} ($${(fractionNeeded * maxAvailableOutputUSD).toFixed(2)} of $${maxAvailableOutputUSD.toFixed(2)})`);
        }
        
        usedInputAmount = roundTokenAmount(usedTokenAmount, option.from.tokenDecimals, option.from.tokenSymbol);
      }
      
      // Skip if the amount is 0
      if (usedInputAmount === '0') continue;
      
      // Calculate the ACTUAL token amount after rounding (for accurate USD display)
      const actualTokenAmount = parseInt(usedInputAmount) / Math.pow(10, option.from.tokenDecimals);
      const actualFraction = actualTokenAmount / parseFloat(option.from.balance);
      
      // Calculate USD values based on the ACTUAL rounded amount, not the original fraction
      // This ensures display shows $12.00 not $12.05 for stablecoins
      const usedInputUSD = actualFraction * option.from.balanceUSD;
      const usedOutputUSD = actualFraction * option.estimatedOutputUSD;
      const usedFees = actualFraction * option.estimatedFeesUSD;
      
      // Skip if this bridge output is too small (less than $1)
      // This prevents adding tiny dust amounts like $0.02
      if (usedOutputUSD < MIN_BRIDGE_USD) {
        console.log(`⏭️ Skipping ${option.from.tokenSymbol} on ${option.from.chainName}: output $${usedOutputUSD.toFixed(2)} < $${MIN_BRIDGE_USD} minimum`);
        continue;
      }
      
      // Create a copy of the option with the used amounts
      const bridgeWithUsage: BridgeOption = {
        ...option,
        usedInputUSD,
        usedOutputUSD,
        usedInputAmount,
      };
      
      selectedBridges.push(bridgeWithUsage);
      totalOutput += usedOutputUSD;
      totalInput += usedInputUSD;
      totalFees += usedFees;
      totalTime += option.estimatedTimeSeconds;
    }

    if (selectedBridges.length === 0) {
      return null;
    }

    return {
      type: strategy,
      bridges: selectedBridges,
      totalInputUSD: totalInput,
      totalOutputUSD: totalOutput,
      totalTimeSeconds: totalTime,
      totalFeesUSD: totalFees,
      efficiency: totalInput > 0 ? totalOutput / totalInput : 0,
    };
  }

  /**
   * Main function: Calculate full deposit plan
   */
  async calculateDepositPlan(
    walletAddress: string,
    targetAmount: number,
    chains: ChainInfo[],
    onProgress?: (message: string, progress: number) => void
  ): Promise<DepositPlan> {
    onProgress?.('Starting deposit optimization...', 0);

    // Step 1: Scan all balances
    const allBalances = await this.scanAllBalances(walletAddress, chains, onProgress);
    
    const availableBalanceUSD = allBalances.reduce((sum, b) => sum + b.balanceUSD, 0);
    
    if (availableBalanceUSD < targetAmount) {
      onProgress?.('Insufficient funds across all chains', 100);
      return {
        targetAmount,
        availableBalanceUSD,
        fastest: null,
        cheapest: null,
        allBalances,
        insufficientFunds: true,
      };
    }

    // Step 2: Get bridge quotes
    const bridgeOptions = await this.getBridgeQuotes(walletAddress, allBalances, onProgress);

    if (bridgeOptions.length === 0) {
      onProgress?.('No bridge routes available', 100);
      return {
        targetAmount,
        availableBalanceUSD,
        fastest: null,
        cheapest: null,
        allBalances,
        insufficientFunds: false,
      };
    }

    // Step 3: Calculate strategies
    onProgress?.('Calculating optimal strategies...', 95);
    const { fastest, cheapest } = this.calculateStrategies(targetAmount, bridgeOptions);

    onProgress?.('Optimization complete!', 100);

    return {
      targetAmount,
      availableBalanceUSD,
      fastest,
      cheapest,
      allBalances,
      insufficientFunds: false,
    };
  }
}
