import React, { useState, useEffect, useRef } from 'react';
import { WalletManager } from './wallet';
import { LiFiBridgeService, type DetailedBridgeProgress } from './bridge';
import { ConnectView } from './components/ConnectView';
import { BridgeButton } from './components/BridgeButton';
import { BridgeModal, type BridgeParams } from './components/BridgeModal';
import type { WalletState, ChainBalance, ChainInfo } from '../types/index';
import type { BridgeWidgetStyles } from './styles/defaultStyles';
import type { LiFiStep } from '@lifi/sdk';

export interface HyprBridgeWidgetProps {
  styles?: BridgeWidgetStyles;
}

export const HyprBridgeWidget: React.FC<HyprBridgeWidgetProps> = ({ styles }) => {
  const [walletManager] = useState(() => new WalletManager());
  const [bridgeService] = useState(() => new LiFiBridgeService());
  const [walletState, setWalletState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
  });
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [balancesLoaded, setBalancesLoaded] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  
  // Persist wallet address to survive temporary disconnects during chain switching
  const lastKnownAddressRef = useRef<string | null>(null);

  // Track wallet address changes - persist last known address
  useEffect(() => {
    if (walletState.address) {
      lastKnownAddressRef.current = walletState.address;
    }
  }, [walletState.address]);

  // Initialize wallet and load chains
  useEffect(() => {
    const initialize = async () => {
      const state = await walletManager.checkExistingConnection();
      setWalletState(state);
      if (state.address) {
        lastKnownAddressRef.current = state.address;
      }

      // Set up wallet state change listener
      walletManager.onStateChange(async (newState) => {
        // Update last known address if we have a valid one
        if (newState.address) {
          lastKnownAddressRef.current = newState.address;
        }
        setWalletState(newState);
        if (newState.isConnected && newState.address) {
          const chainList = chains.length === 0 ? await loadChains() : chains;
          await loadBalances(newState.address, chainList);
        }
      });

      // Load chains
      const chainList = await loadChains();

      // Load balances if already connected
      if (state.isConnected && state.address) {
        await loadBalances(state.address, chainList);
      }
    };

    initialize();
  }, []);

  const loadChains = async (): Promise<ChainInfo[]> => {
    try {
      const allChains = await bridgeService.getAllChains();
      // Show all chains - LI.FI handles both bridges and swaps
      console.log(`Loaded ${allChains.length} chains from LI.FI`);
      setChains(allChains);
      return allChains;
    } catch (error) {
      console.error('Failed to load chains:', error);
      return [];
    }
  };

  const loadBalances = async (address: string, chainList?: ChainInfo[]) => {
    if (balancesLoaded) {
      return;
    }

    let chainsToUse = chainList && chainList.length > 0 ? chainList : chains;
    if (chainsToUse.length === 0) {
      chainsToUse = await loadChains();
      if (chainsToUse.length === 0) {
        return;
      }
    }

    const newBalances: ChainBalance[] = [];

    // Only check balances for major EVM chains to avoid rate limiting
    // Other chains are still available for selection, just without pre-loaded balance
    const majorChainIds = [1, 42161, 10, 137, 8453, 43114, 56, 250, 324, 59144, 534352, 1337, 999];
    const chainsToCheck = chainsToUse.filter(c => 
      majorChainIds.includes(c.id) || c.chainType === 'EVM'
    ).slice(0, 15); // Limit to 15 chains to avoid rate limiting

    for (const chain of chainsToCheck) {
      try {
        const tokenInfo = await bridgeService.getTokenInfo(chain.id, 'USDC');
        if (!tokenInfo) {
          // Token lookup already logged in bridge service
          continue;
        }

        const balance = await walletManager.getTokenBalance(
          address,
          tokenInfo,
          chain.name
        );

        newBalances.push({
          ...balance,
          chain,
        });
      } catch (error) {
        // Concise error message without dumping full error object
        console.warn(`⚠️ Failed to get USDC balance on ${chain.name} (chain ${chain.id})`);
      }
    }

    // Keep ALL chains available for selection, not just ones with USDC
    // setChains is not called here - chains remain as loaded from loadChains()
    setBalances(newBalances);
    setBalancesLoaded(true);
  };

  const handleConnect = async () => {
    try {
      await walletManager.connectWallet();
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect wallet. Please make sure MetaMask is installed.');
    }
  };

  const handleBridge = async (params: BridgeParams) => {
    if (!walletState.address) {
      setBridgeError('Please connect your wallet first');
      return;
    }

    const { fromChainId, toChainId, fromToken, toToken, amount } = params;

    // Calculate amount in smallest unit based on token decimals
    const amountInSmallestUnit = (parseFloat(amount) * Math.pow(10, fromToken.decimals)).toString();

    try {
      // Clear any previous errors
      setBridgeError(null);

      // Get fresh quote with actual user address for execution
      const route = await bridgeService.getBridgeRouteWithTokens(
        fromChainId,
        toChainId,
        fromToken.address,
        toToken.address,
        amountInSmallestUnit,
        walletState.address
      );

      // Log detailed route information
      console.log('🌉 BRIDGE ROUTE DETAILS:', {
        id: route.id,
        type: route.type,
        tool: route.tool,
        toolDetails: route.toolDetails?.name || 'N/A',
        fromChain: route.action.fromChainId,
        toChain: route.action.toChainId,
        fromToken: route.action.fromToken.symbol,
        toToken: route.action.toToken.symbol,
        fromAmount: route.action.fromAmount,
        toAmount: route.estimate.toAmount,
        executionTime: `${Math.ceil(route.estimate.executionDuration / 60)} minutes`,
        gasCosts: route.estimate.gasCosts,
        feeCosts: route.estimate.feeCosts,
        fullRoute: route,
      });

      // Check if this is a multi-step route
      const includedSteps = route.includedSteps || [];
      if (includedSteps.length > 0) {
        console.log(`📊 Route uses ${includedSteps.length + 1} step(s) (including intermediate swaps/bridges):`);
        console.log(`  Main Step: ${route.toolDetails?.name || route.tool} (${route.type})`);
        includedSteps.forEach((step: any, index: number) => {
          console.log(`  Intermediate Step ${index + 1}: ${step.toolDetails?.name || step.tool} (${step.type})`);
        });
      } else {
        console.log(`📊 Direct route using: ${route.toolDetails?.name || route.tool} (${route.type})`);
      }

      // Execute bridge directly - user already saw quote info in the modal
      await bridgeService.executeBridge(route, (progress) => {
        console.log('Bridge progress:', progress);
        
        if (progress.status === 'completed') {
          // Refresh balances after successful bridge
          setBalancesLoaded(false);
          if (walletState.address) {
            loadBalances(walletState.address);
          }
        }
      });
    } catch (error) {
      console.error('Bridge failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setBridgeError(`Bridge failed: ${errorMsg}`);
    }
  };

  // Handle bridge with detailed progress for status page
  const handleBridgeWithProgress = async (
    params: BridgeParams,
    onProgress: (progress: DetailedBridgeProgress) => void
  ) => {
    if (!walletState.address) {
      throw new Error('Please connect your wallet first');
    }

    const { fromChainId, toChainId, fromToken, toToken, amount } = params;
    
    // Convert amount to smallest unit using string manipulation to avoid floating point errors
    // Split the amount into integer and decimal parts
    const [intPart, decPart = ''] = amount.split('.');
    const paddedDecimal = decPart.padEnd(fromToken.decimals, '0').slice(0, fromToken.decimals);
    const amountInSmallestUnit = (intPart + paddedDecimal).replace(/^0+/, '') || '0';

    // Get fresh quote for execution - this quote will be used immediately
    const route = await bridgeService.getBridgeRouteWithTokens(
      fromChainId,
      toChainId,
      fromToken.address,
      toToken.address,
      amountInSmallestUnit,
      walletState.address
    );

    // Log route details
    console.log('🌉 BRIDGE ROUTE DETAILS:', {
      id: route.id,
      type: route.type,
      tool: route.tool,
      toolDetails: route.toolDetails?.name || 'N/A',
      fromChain: route.action.fromChainId,
      toChain: route.action.toChainId,
      fromToken: route.action.fromToken.symbol,
      toToken: route.action.toToken.symbol,
    });

    const includedSteps = (route as any).includedSteps || [];
    if (includedSteps.length > 0) {
      console.log(`📊 Route uses ${includedSteps.length + 1} step(s):`);
      console.log(`  Main: ${route.toolDetails?.name || route.tool} (${route.type})`);
      includedSteps.forEach((step: any, index: number) => {
        console.log(`  Step ${index + 1}: ${step.toolDetails?.name || step.tool} (${step.type})`);
      });
    } else {
      console.log(`📊 Direct route: ${route.toolDetails?.name || route.tool} (${route.type})`);
    }

    // Execute with detailed progress
    await bridgeService.executeBridgeWithDetailedProgress(route, (progress) => {
      onProgress(progress);
      
      if (progress.overallStatus === 'completed') {
        // Refresh balances after successful bridge
        setBalancesLoaded(false);
        if (walletState.address) {
          loadBalances(walletState.address);
        }
      }
    });
  };

  // Show connect view only if wallet is disconnected AND modal is not open
  // This prevents the modal from being unmounted during chain switching or transaction signing
  // when MetaMask might temporarily emit disconnect events
  if (!walletState.isConnected && !isModalOpen) {
    return (
      <ConnectView
        targetChainName="Any Chain"
        onConnect={handleConnect}
        styles={styles}
      />
    );
  }

  // Store the wallet address - use the current one or the last known one for the modal
  // This ensures the modal stays functional even during temporary wallet disconnects
  const effectiveWalletAddress = walletState.address || lastKnownAddressRef.current || '';

  return (
    <>
      {/* Only show bridge button if wallet is connected */}
      {walletState.isConnected && (
        <BridgeButton
          address={walletState.address!}
          targetChainName="Bridge & Swap"
          onOpenModal={() => setIsModalOpen(true)}
          styles={styles}
        />
      )}
      {/* Modal persists even during temporary wallet disconnects */}
      {isModalOpen && effectiveWalletAddress && (
        <BridgeModal
          targetChainName="Bridge & Swap"
          balances={balances}
          chains={chains}
          walletAddress={effectiveWalletAddress}
          onClose={() => setIsModalOpen(false)}
          onBridge={handleBridge}
          onBridgeWithProgress={handleBridgeWithProgress}
          styles={styles}
        />
      )}
    </>
  );
};
