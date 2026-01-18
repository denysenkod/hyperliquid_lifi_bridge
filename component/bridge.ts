import { createConfig, getQuote, executeRoute, convertQuoteToRoute, EVM, Solana, getChains, getToken, ChainType, getTokens, getActiveRoutes, stopRouteExecution } from '@lifi/sdk';
import { createWalletClient, custom } from 'viem';
import type { ChainInfo, TokenInfo } from '../types/index.js';
import type { LiFiStep, Token } from '@lifi/sdk';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface BridgeProgress {
  status: 'idle' | 'approving' | 'pending' | 'completed' | 'failed';
  message: string;
  txHash?: string;
  txLink?: string;
}

// Detailed step info for status page
export interface StepInfo {
  id: string;
  tool: string;
  toolName: string;
  toolLogo: string;
  type: string;
  status: 'waiting' | 'action_required' | 'pending' | 'done' | 'failed';
  progress: number; // 0, 50, or 100
  txHash?: string;
  txLink?: string;
}

export interface DetailedBridgeProgress {
  overallStatus: 'idle' | 'approving' | 'pending' | 'completed' | 'failed';
  message: string;
  steps: StepInfo[];
  txHash?: string;
  txLink?: string;
}

// Module-level singleton flag to prevent multiple SDK initializations
let sdkInitialized = false;
// External wallet provider (for WalletConnect, etc.)
let externalWalletProvider: any = null;

/**
 * Set an external wallet provider (e.g., from WalletConnect)
 * This should be called before any bridge operations in environments without window.ethereum
 */
export function setWalletProvider(provider: any): void {
  externalWalletProvider = provider;
  // Reset SDK so it reinitializes with new provider
  sdkInitialized = false;
  console.log('🔌 External wallet provider set');
}

/**
 * Get the active wallet provider (external or window.ethereum)
 */
function getWalletProvider(): any {
  if (externalWalletProvider) {
    return externalWalletProvider;
  }
  if (typeof window !== 'undefined' && window.ethereum) {
    return window.ethereum;
  }
  return null;
}

export class LiFiBridgeService {
  private chains: ChainInfo[] = [];

  constructor() {
    this.initializeLiFi();
  }

  private initializeLiFi(): void {
    if (sdkInitialized) return;

    try {
      createConfig({
        integrator: 'bridge-widget',
        providers: [
          // EVM chains (Ethereum, Arbitrum, Base, Polygon, etc.)
          EVM({
            getWalletClient: async () => {
              const provider = getWalletProvider();
              if (!provider) {
                throw new Error('No wallet provider found. Please connect a wallet first.');
              }
              
              // Get the current account
              const accounts = await provider.request({ 
                method: 'eth_requestAccounts' 
              });
              
              // Get the current chain ID
              const chainIdHex = await provider.request({ 
                method: 'eth_chainId' 
              });
              const currentChainId = parseInt(chainIdHex, 16);
              
              return createWalletClient({
                account: accounts[0],
                chain: { id: currentChainId } as any,
                transport: custom(provider),
              }) as any;
            },
            switchChain: async (chainId) => {
              const provider = getWalletProvider();
              if (!provider) {
                throw new Error('No wallet provider found. Please connect a wallet first.');
              }

              await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${chainId.toString(16)}` }],
              });

              // Get the current account after chain switch
              const accounts = await provider.request({ 
                method: 'eth_requestAccounts' 
              });

              return createWalletClient({
                account: accounts[0],
                chain: { id: chainId } as any,
                transport: custom(provider),
              }) as any;
            },
          }),
          // Solana (SVM)
          Solana({
            getWalletAdapter: async () => {
              // Check for Phantom or other Solana wallets
              const solana = (window as any).solana || (window as any).phantom?.solana;
              if (!solana) {
                throw new Error('No Solana wallet found. Please install Phantom or another Solana wallet.');
              }
              return solana;
            },
          }),
        ],
        apiKey: "281ba4ad-e3f3-4dc1-ad8f-d19e40722416.3c03ad3e-f891-419c-8d3d-51fb3e61737d",
      });

      sdkInitialized = true;
      console.log('LI.FI SDK initialized');
    } catch (error) {
      console.error('Failed to initialize LI.FI:', error);
    }
  }

  async getAllChains(): Promise<ChainInfo[]> {
    if (!sdkInitialized) {
      this.initializeLiFi();
    }

    try {
      // Fetch all chain types: EVM, SVM (Solana), UTXO (Bitcoin), MVM (SUI)
      const lifiChains = await getChains({
        chainTypes: [ChainType.EVM, ChainType.SVM, ChainType.UTXO, ChainType.MVM],
      });
      
      this.chains = lifiChains.map((chain: any) => ({
        id: chain.id,
        name: chain.name,
        key: chain.key,
        chainType: chain.chainType,
        logoURI: chain.logoURI,
        nativeToken: {
          symbol: chain.nativeToken?.symbol || 'NATIVE',
          decimals: chain.nativeToken?.decimals || 18,
          address: chain.nativeToken?.address || '0x0000000000000000000000000000000000000000',
        },
      }));
      
      console.log(`Loaded ${this.chains.length} chains across all types (EVM, SVM, UTXO, MVM)`);
      return this.chains;
    } catch (error) {
      console.error('Failed to fetch chains:', error);
      return [];
    }
  }

  async getTokenInfo(chainId: number, tokenSymbol: string = 'USDC'): Promise<TokenInfo | null> {
    try {
      const token = await getToken(chainId, tokenSymbol);
      if (token) {
        return {
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          chainId: token.chainId,
          name: token.name,
          logoURI: token.logoURI,
        };
      }
      return null;
    } catch (error) {
      // Concise error message without dumping full error object
      console.warn(`⚠️ ${tokenSymbol} not available on chain ${chainId}`);
      return null;
    }
  }

  async getBridgeRoute(
    fromChainId: number,
    toChainId: number,
    tokenAmount: string,
    userAddress: string,
    tokenSymbol: string = 'USDC'
  ): Promise<LiFiStep> {
    if (!sdkInitialized) {
      this.initializeLiFi();
    }

    try {
      // Get token addresses for both chains
      console.log("Getting token info for chain", fromChainId, "and", toChainId, "with token", tokenSymbol);
      const fromToken = await this.getTokenInfo(fromChainId, tokenSymbol);
      const toToken = await this.getTokenInfo(toChainId, tokenSymbol);

      if (!fromToken || !toToken) {
        throw new Error(`${tokenSymbol} not available on selected chains`);
      }

      // getQuote returns a LiFiStep object directly
      const route = await getQuote({
        fromAddress: userAddress,
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken: fromToken.address,
        toToken: toToken.address,
        fromAmount: tokenAmount,
        slippage: 0.005, // 0.5%
      });

      return route;
    } catch (error) {
      console.error('Failed to get quote:', error);
      throw new Error('Failed to get bridge quote. Please try again.');
    }
  }

  /**
   * Get bridge route with specific token addresses (for dynamic source/destination)
   */
  async getBridgeRouteWithTokens(
    fromChainId: number,
    toChainId: number,
    fromTokenAddress: string,
    toTokenAddress: string,
    tokenAmount: string,
    userAddress: string
  ): Promise<LiFiStep> {
    if (!sdkInitialized) {
      this.initializeLiFi();
    }

    try {
      console.log(`Getting quote: ${fromChainId} -> ${toChainId}, tokens: ${fromTokenAddress} -> ${toTokenAddress}`);
      
      // getQuote returns a LiFiStep object directly
      const route = await getQuote({
        fromAddress: userAddress,
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        fromAmount: tokenAmount,
        slippage: 0.005, // 0.5%
      });

      return route;
    } catch (error) {
      console.error('Failed to get quote:', error);
      throw new Error('Failed to get bridge quote. Please try again.');
    }
  }

  async executeBridge(
    quote: LiFiStep,
    onProgress: (progress: BridgeProgress) => void
  ): Promise<void> {
    console.log("Executing bridge with quote:", quote);
    try {
      onProgress({
        status: 'approving',
        message: 'Waiting for approval...',
      });

      // Convert quote to route before execution (required by LiFi SDK)
      const route = convertQuoteToRoute(quote);

      // Execute the route
      await executeRoute(route, {
        updateRouteHook: (updatedRoute) => {
          // Safely access the route steps
          if (!updatedRoute?.steps || !Array.isArray(updatedRoute.steps) || updatedRoute.steps.length === 0) {
            return;
          }

          const step = updatedRoute.steps[0];
          if (!step?.execution?.process || !Array.isArray(step.execution.process)) {
            return;
          }

          // Get the latest process status
          const process = step.execution.process[step.execution.process.length - 1];

          if (process) {
            const statusMap: Record<string, BridgeProgress['status']> = {
              NOT_STARTED: 'idle',
              ACTION_REQUIRED: 'approving',
              PENDING: 'pending',
              DONE: 'completed',
              FAILED: 'failed',
            };

            const status = statusMap[process.status] || 'pending';
            const message = this.getStatusMessage(process.status, process.type);

            onProgress({
              status,
              message,
              txHash: process.txHash,
              txLink: process.txLink,
            });
          }
        },
      });

      onProgress({
        status: 'completed',
        message: 'Bridge completed successfully!',
      });
    } catch (error) {
      console.error('Bridge execution failed:', error);
      onProgress({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Bridge failed',
      });
      throw error;
    }
  }

  private getStatusMessage(status: string, type?: string): string {
    const messages: Record<string, string> = {
      NOT_STARTED: 'Preparing transaction...',
      ACTION_REQUIRED: 'Please confirm in your wallet...',
      PENDING: 'Transaction in progress...',
      DONE: 'Completed!',
      FAILED: 'Transaction failed',
    };

    if (type === 'TOKEN_ALLOWANCE' && status === 'ACTION_REQUIRED') {
      return 'Approving token spending...';
    }

    return messages[status] || 'Processing...';
  }

  /**
   * Execute bridge with detailed step-by-step progress for status page
   */
  async executeBridgeWithDetailedProgress(
    quote: LiFiStep,
    onDetailedProgress: (progress: DetailedBridgeProgress) => void
  ): Promise<void> {
    // Extract steps from the quote - these are the sub-steps within the main step
    const includedSteps = (quote as any).includedSteps || [];
    const allSteps = includedSteps.length > 0 ? includedSteps : [quote];
    
    // Initialize step info from includedSteps for UI display
    const stepsInfo: StepInfo[] = allSteps.map((step: any, index: number) => ({
      id: step.id || `step-${index}`,
      tool: step.tool || 'unknown',
      toolName: step.toolDetails?.name || step.tool || 'Unknown',
      toolLogo: step.toolDetails?.logoURI || '',
      type: step.type || 'unknown',
      status: 'waiting' as const,
      progress: 0,
    }));

    // Send initial state
    onDetailedProgress({
      overallStatus: 'approving',
      message: 'Waiting for wallet confirmation...',
      steps: stepsInfo,
    });

    try {
      // Stop any active routes from previous executions to prevent stale route interference
      const activeRoutes = getActiveRoutes();
      if (activeRoutes.length > 0) {
        console.log(`🛑 Stopping ${activeRoutes.length} active route(s) before new execution`);
        activeRoutes.forEach(r => {
          try {
            stopRouteExecution(r);
          } catch (e) {
            // Ignore errors when stopping routes
          }
        });
      }

      const route = convertQuoteToRoute(quote);

      await executeRoute(route, {
        updateRouteHook: (updatedRoute) => {
          if (!updatedRoute?.steps || !Array.isArray(updatedRoute.steps)) {
            return;
          }

          const mainStep = updatedRoute.steps[0];
          if (!mainStep) return;

          const processes = mainStep.execution?.process || [];

          let overallStatus: DetailedBridgeProgress['overallStatus'] = 'pending';
          let message = 'Processing...';
          let latestTxHash: string | undefined;
          let latestTxLink: string | undefined;

          // The SDK tracks progress via processes array, not via includedSteps
          // Processes: TOKEN_ALLOWANCE -> CROSS_CHAIN -> RECEIVING_CHAIN
          // We need to map these to our UI steps
          
          // Calculate overall progress based on processes
          const totalProcesses = Math.max(processes.length, 1);
          let completedProcesses = 0;
          let currentProcessIndex = -1;
          let currentProcessStatus: string | null = null;

          processes.forEach((process: any, idx: number) => {
            if (process.status === 'DONE') {
              completedProcesses++;
            } else if (process.status === 'PENDING' || process.status === 'ACTION_REQUIRED' || process.status === 'STARTED') {
              if (currentProcessIndex === -1) {
                currentProcessIndex = idx;
                currentProcessStatus = process.status;
              }
            }
            
            if (process.txHash) {
              latestTxHash = process.txHash;
              latestTxLink = process.txLink;
            }
          });

          // If no current process found but not all done, we're waiting
          if (currentProcessIndex === -1 && completedProcesses < totalProcesses) {
            currentProcessIndex = completedProcesses;
          }

          // Map processes to UI steps proportionally
          // If we have 3 UI steps and 3 processes, map 1:1
          // If different counts, distribute proportionally
          const numUISteps = stepsInfo.length;
          
          stepsInfo.forEach((step, idx) => {
            // Calculate which process this UI step corresponds to
            const processIndex = Math.floor((idx / numUISteps) * totalProcesses);
            const process = processes[processIndex];
            
            let status: StepInfo['status'] = 'waiting';
            let progress = 0;

            if (process) {
              const processStatus = process.status;
              
              if (processStatus === 'DONE') {
                status = 'done';
                progress = 100;
              } else if (processStatus === 'PENDING') {
                status = 'pending';
                progress = 50;
              } else if (processStatus === 'ACTION_REQUIRED') {
                status = 'action_required';
                progress = 25;
              } else if (processStatus === 'STARTED') {
                status = 'pending';
                progress = 25;
              }
            } else {
              // No process yet for this step
              // Check if earlier processes are done
              const earlierProcessIndex = Math.max(0, processIndex - 1);
              if (processes[earlierProcessIndex]?.status === 'DONE') {
                // Previous process done, this one is waiting to start
                status = 'waiting';
                progress = 0;
              }
            }

            // Special handling: if all processes are done, mark all steps done
            if (mainStep.execution?.status === 'DONE') {
              status = 'done';
              progress = 100;
            }

            stepsInfo[idx] = {
              ...stepsInfo[idx],
              status,
              progress,
              txHash: latestTxHash,
              txLink: latestTxLink,
            };
          });

          // Determine overall status from latest process
          const latestProcess = processes[processes.length - 1];
          if (latestProcess) {
            if (latestProcess.status === 'ACTION_REQUIRED') {
              overallStatus = 'approving';
              message = latestProcess.message || 'Please confirm in your wallet...';
            } else if (latestProcess.status === 'PENDING' || latestProcess.status === 'STARTED') {
              overallStatus = 'pending';
              message = latestProcess.message || 'Transaction in progress...';
            } else if (latestProcess.status === 'DONE') {
              // Check if this is the final process
              if (mainStep.execution?.status === 'DONE') {
                overallStatus = 'completed';
                message = 'Transaction completed successfully!';
              } else {
                overallStatus = 'pending';
                message = 'Processing next step...';
              }
            } else if (latestProcess.status === 'FAILED') {
              overallStatus = 'failed';
              message = latestProcess.message || 'Transaction failed';
            }
          }

          onDetailedProgress({
            overallStatus,
            message,
            steps: [...stepsInfo],
            txHash: latestTxHash,
            txLink: latestTxLink,
          });
        },
      });

      // Mark all steps as done
      stepsInfo.forEach(step => {
        step.status = 'done';
        step.progress = 100;
      });

      onDetailedProgress({
        overallStatus: 'completed',
        message: 'Bridge completed successfully!',
        steps: [...stepsInfo],
      });
    } catch (error) {
      console.error('Bridge execution failed:', error);
      
      // Mark current step as failed
      const failedStepIndex = stepsInfo.findIndex(s => s.status === 'pending' || s.status === 'action_required');
      if (failedStepIndex >= 0) {
        stepsInfo[failedStepIndex].status = 'failed';
        stepsInfo[failedStepIndex].progress = 0;
      }

      onDetailedProgress({
        overallStatus: 'failed',
        message: error instanceof Error ? error.message : 'Bridge failed',
        steps: [...stepsInfo],
      });
      throw error;
    }
  }

  /**
   * Get token price in USD
   * Returns the current USD price for a token on a specific chain
   */
  async getTokenPrice(chainId: number, tokenAddress: string): Promise<number | null> {
    try {
      const tokens = await getTokens({ chains: [chainId] });
      const token = tokens.tokens[chainId]?.find(
        t => t.address.toLowerCase() === tokenAddress.toLowerCase()
      );
      
      return token?.priceUSD ? parseFloat(token.priceUSD) : null;
    } catch (error) {
      console.warn(`Failed to get price for token ${tokenAddress} on chain ${chainId}:`, error);
      return null;
    }
  }
}