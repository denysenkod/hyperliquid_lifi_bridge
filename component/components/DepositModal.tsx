import React, { useState, useRef } from 'react';
import { DepositOptimizer, DepositPlan, DepositStrategy, BridgeOption, HYPERLIQUID_BRIDGE_ADDRESS, MIN_HYPERLIQUID_DEPOSIT_USD } from '../depositOptimizer';
import { LiFiBridgeService, DetailedBridgeProgress } from '../bridge';
import type { ChainInfo } from '../../types/index';

// Hyperliquid brand colors
const COLORS = {
  aquamarine: '#97FCE4',
  firefly: '#0F3933',
  ebony: '#04060C',
  foam: '#F5FEFD',
};

// Arbitrum USDC contract address
const ARBITRUM_USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const ARBITRUM_CHAIN_ID = 42161;

// ERC-20 ABI (minimal for transfer and balanceOf)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

interface DepositModalProps {
  chains: ChainInfo[];
  walletAddress: string;
  onClose: () => void;
  embedded?: boolean; // When true, renders only content without modal wrapper
  styles?: {
    modal?: React.CSSProperties;
    overlay?: React.CSSProperties;
  };
}

type DepositStep = 'input' | 'scanning' | 'select' | 'executing' | 'depositing' | 'complete';

interface BridgeExecution {
  option: BridgeOption;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  progress?: DetailedBridgeProgress;
  error?: string;
}

interface HyperLiquidDepositStatus {
  status: 'pending' | 'executing' | 'completed' | 'failed';
  amountUSDC: number;
  txHash?: string;
  error?: string;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  chains,
  walletAddress,
  onClose,
  embedded = false,
  styles = {},
}) => {
  const [step, setStep] = useState<DepositStep>('input');
  const [amount, setAmount] = useState('');
  const [scanProgress, setScanProgress] = useState({ message: '', progress: 0 });
  const [depositPlan, setDepositPlan] = useState<DepositPlan | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<'fastest' | 'cheapest' | null>(null);
  const [executions, setExecutions] = useState<BridgeExecution[]>([]);
  const [currentExecutionIndex, setCurrentExecutionIndex] = useState(0);
  const [overallComplete, setOverallComplete] = useState(false);
  const [hyperLiquidDeposit, setHyperLiquidDeposit] = useState<HyperLiquidDepositStatus | null>(null);
  
  const optimizer = useRef(new DepositOptimizer());
  const bridgeService = useRef(new LiFiBridgeService());

  // Handle amount input and start scanning
  const handleCalculate = async () => {
    const rawAmount = parseFloat(amount);
    if (isNaN(rawAmount) || rawAmount <= 0) return;
    
    // Round to 2 decimal places (USD precision) to avoid floating-point issues
    // e.g., 1.894 becomes 1.89, 962.567 becomes 962.56
    const targetAmount = Math.floor(rawAmount * 100) / 100;

    setStep('scanning');
    
    try {
      const plan = await optimizer.current.calculateDepositPlan(
        walletAddress,
        targetAmount,
        chains,
        (message, progress) => {
          setScanProgress({ message, progress });
        }
      );
      
      setDepositPlan(plan);
      setStep('select');
    } catch (error) {
      console.error('Failed to calculate deposit plan:', error);
      setScanProgress({ message: 'Failed to calculate. Please try again.', progress: 0 });
    }
  };

  // Execute the selected strategy
  const handleExecute = async () => {
    if (!depositPlan) return;
    
    // Determine which strategy to use
    let strategyToUse = selectedStrategy;
    
    // If no strategy selected, check if one dominates and use that
    if (!strategyToUse && depositPlan.fastest && depositPlan.cheapest) {
      const fastest = depositPlan.fastest;
      const cheapest = depositPlan.cheapest;
      
      const cheapestIsFasterOrEqual = cheapest.totalTimeSeconds <= fastest.totalTimeSeconds;
      const cheapestIsCheaperOrEqual = cheapest.totalFeesUSD <= fastest.totalFeesUSD;
      const cheapestHasSimilarOutput = cheapest.totalOutputUSD >= fastest.totalOutputUSD * 0.95;
      
      const fastestIsFasterOrEqual = fastest.totalTimeSeconds <= cheapest.totalTimeSeconds;
      const fastestIsCheaperOrEqual = fastest.totalFeesUSD <= cheapest.totalFeesUSD;
      const fastestHasSimilarOutput = fastest.totalOutputUSD >= cheapest.totalOutputUSD * 0.95;
      
      const cheapestDominates = cheapestIsFasterOrEqual && cheapestIsCheaperOrEqual && cheapestHasSimilarOutput;
      const fastestDominates = fastestIsFasterOrEqual && fastestIsCheaperOrEqual && fastestHasSimilarOutput;
      
      // Special case: if "cheapest" is actually FASTER and cheaper, use it
      const cheapestIsActuallyFaster = cheapest.totalTimeSeconds < fastest.totalTimeSeconds;
      const fastestIsActuallyFaster = fastest.totalTimeSeconds < cheapest.totalTimeSeconds;
      
      if ((cheapestDominates && !fastestDominates) || (cheapestIsActuallyFaster && cheapestIsCheaperOrEqual)) {
        strategyToUse = 'cheapest';
      } else if ((fastestDominates && !cheapestDominates) || (fastestIsActuallyFaster && fastestIsCheaperOrEqual)) {
        strategyToUse = 'fastest';
      }
    }
    
    // If still no strategy and only one exists, use that
    if (!strategyToUse) {
      if (depositPlan.fastest && !depositPlan.cheapest) strategyToUse = 'fastest';
      else if (depositPlan.cheapest && !depositPlan.fastest) strategyToUse = 'cheapest';
    }
    
    if (!strategyToUse) return;
    
    const strategy = strategyToUse === 'fastest' 
      ? depositPlan.fastest 
      : depositPlan.cheapest;
    
    if (!strategy) return;

    // Initialize executions
    const initialExecutions: BridgeExecution[] = strategy.bridges.map(option => ({
      option,
      status: 'pending',
    }));
    
    setExecutions(initialExecutions);
    setCurrentExecutionIndex(0);
    setStep('executing');

    // Track successful bridges locally (can't rely on async state updates)
    let successfulBridgeCount = 0;
    let userRejected = false;

    // Execute bridges sequentially
    for (let i = 0; i < strategy.bridges.length; i++) {
      setCurrentExecutionIndex(i);
      const bridge = strategy.bridges[i];
      
      // Update status to executing (getting quote)
      setExecutions(prev => prev.map((exec, idx) => 
        idx === i ? { ...exec, status: 'executing' } : exec
      ));

      try {
        // Get the EXACT amount to bridge (already calculated with precision in optimizer)
        // The usedInputAmount is pre-calculated with proper rounding to avoid SDK errors
        let amountToBridge = bridge.usedInputAmount;
        
        if (!amountToBridge) {
          // Fallback: calculate with precision-safe rounding
          const balance = parseFloat(bridge.from.balance);
          const symbol = bridge.from.tokenSymbol.toUpperCase();
          
          // Check if stablecoin - round to whole units
          const isStable = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD'].some(s => symbol.includes(s));
          
          if (isStable) {
            // Round to whole units for stablecoins (e.g., 12.05 → 12)
            const wholeUnits = Math.floor(balance);
            amountToBridge = Math.floor(wholeUnits * Math.pow(10, bridge.from.tokenDecimals)).toString();
          } else {
            // Limit to 4 decimals of precision for other tokens
            const effectiveDecimals = Math.min(bridge.from.tokenDecimals, 4);
            const scaleFactor = Math.pow(10, effectiveDecimals);
            const roundedBalance = Math.floor(balance * scaleFactor) / scaleFactor;
            amountToBridge = Math.floor(roundedBalance * Math.pow(10, bridge.from.tokenDecimals)).toString();
          }
        }
        
        console.log(`🔄 Bridging ${bridge.from.tokenSymbol} on ${bridge.from.chainName}:`, {
          amount: amountToBridge,
          token: bridge.from.tokenAddress,
          usedInputUSD: bridge.usedInputUSD,
        });
        
        // Fetch fresh quote for the exact amount - destination is Arbitrum USDC
        const freshQuote = await bridgeService.current.getBridgeRouteWithTokens(
          bridge.from.chainId,
          ARBITRUM_CHAIN_ID,
          bridge.from.tokenAddress,
          ARBITRUM_USDC_ADDRESS,
          amountToBridge,
          walletAddress
        );
        
        console.log(`📋 Got fresh quote, fromAmount:`, freshQuote.action.fromAmount);
        
        // Execute with the fresh quote
        await bridgeService.current.executeBridgeWithDetailedProgress(
          freshQuote,
          (progress) => {
            setExecutions(prev => prev.map((exec, idx) => 
              idx === i ? { ...exec, progress } : exec
            ));
          }
        );

        // Mark as completed and increment local counter
        successfulBridgeCount++;
        setExecutions(prev => prev.map((exec, idx) => 
          idx === i ? { ...exec, status: 'completed' } : exec
        ));
        
        console.log(`✅ Bridge ${i + 1} completed. Total successful: ${successfulBridgeCount}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Bridge failed';
        const friendlyError = getDepositErrorMessage(errorMessage);
        
        console.error(`❌ Bridge ${i + 1} failed:`, errorMessage);
        
        // Mark as failed
        setExecutions(prev => prev.map((exec, idx) => 
          idx === i ? { 
            ...exec, 
            status: 'failed',
            error: friendlyError
          } : exec
        ));
        
        // If user rejected, stop execution entirely
        if (isUserRejection(errorMessage)) {
          console.log('🛑 User rejected transaction, stopping execution');
          userRejected = true;
          break;
        }
        
        // Continue with next bridge for other errors
      }
    }

    console.log(`🏁 Bridge execution complete. Successful: ${successfulBridgeCount}, User rejected: ${userRejected}`);

    // Check if at least one bridge succeeded (use local counter, not stale state!)
    if (successfulBridgeCount > 0) {
      // Proceed to HyperLiquid deposit step
      console.log('➡️ Proceeding to HyperLiquid deposit...');
      setStep('depositing');
      await executeHyperLiquidDeposit();
    } else {
      // All bridges failed, go to complete with error state
      console.log('❌ All bridges failed, showing error state');
      setOverallComplete(true);
      setStep('complete');
    }
  };

  /**
   * Execute the final deposit to HyperLiquid bridge contract
   */
  const executeHyperLiquidDeposit = async () => {
    try {
      // Get USDC balance on Arbitrum
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error('No wallet found');
      }

      // Switch to Arbitrum if needed
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa4b1' }], // 42161 in hex
        });
      } catch (switchError: any) {
        // Chain not added, try to add it
        if (switchError.code === 4902) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xa4b1',
              chainName: 'Arbitrum One',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://arb1.arbitrum.io/rpc'],
              blockExplorerUrls: ['https://arbiscan.io'],
            }],
          });
        }
      }

      // Get USDC balance
      const { ethers } = await import('ethers');
      // Support both ethers v5 (Web3Provider) and v6 (BrowserProvider)
      const provider = 'BrowserProvider' in ethers 
        ? new (ethers as any).BrowserProvider(ethereum)
        : new (ethers as any).providers.Web3Provider(ethereum);
      const signer = await provider.getSigner();
      
      const usdcContract = new ethers.Contract(
        ARBITRUM_USDC_ADDRESS,
        ERC20_ABI,
        signer
      );

      const balance = await usdcContract.balanceOf(walletAddress);
      const balanceUSDC = Number(balance) / 1e6; // USDC has 6 decimals
      
      console.log(`💰 USDC balance on Arbitrum: $${balanceUSDC.toFixed(2)}`);
      
      // Calculate the amount to deposit - use the REQUESTED amount, not the full balance
      const requestedAmount = parseFloat(amount);
      const depositAmount = Math.min(requestedAmount, balanceUSDC);
      
      console.log(`📊 Requested: $${requestedAmount.toFixed(2)}, Available: $${balanceUSDC.toFixed(2)}, Depositing: $${depositAmount.toFixed(2)}`);

      // Check minimum deposit requirement
      if (depositAmount < MIN_HYPERLIQUID_DEPOSIT_USD) {
        setHyperLiquidDeposit({
          status: 'failed',
          amountUSDC: depositAmount,
          error: `Minimum deposit is $${MIN_HYPERLIQUID_DEPOSIT_USD} USDC. Deposit amount: $${depositAmount.toFixed(2)} USDC.`
        });
        setOverallComplete(true);
        setStep('complete');
        return;
      }

      setHyperLiquidDeposit({
        status: 'executing',
        amountUSDC: depositAmount,
      });

      // Transfer ONLY the requested amount to HyperLiquid bridge contract
      // Convert to smallest units (USDC has 6 decimals)
      const depositAmountSmallestUnits = BigInt(Math.floor(depositAmount * 1e6));
      
      console.log(`🚀 Depositing $${depositAmount.toFixed(2)} USDC to HyperLiquid bridge...`);
      
      const tx = await usdcContract.transfer(HYPERLIQUID_BRIDGE_ADDRESS, depositAmountSmallestUnits);
      console.log(`📝 Transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed: ${receipt.hash}`);

      setHyperLiquidDeposit({
        status: 'completed',
        amountUSDC: depositAmount,
        txHash: receipt.hash,
      });

      setOverallComplete(true);
      setStep('complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deposit failed';
      console.error('❌ HyperLiquid deposit failed:', errorMessage);
      
      setHyperLiquidDeposit(prev => ({
        status: 'failed',
        amountUSDC: prev?.amountUSDC || 0,
        error: isUserRejection(errorMessage) 
          ? 'Transaction cancelled. You rejected the deposit.'
          : errorMessage,
      }));

      setOverallComplete(true);
      setStep('complete');
    }
  };

  /**
   * Check if error is a user rejection
   */
  const isUserRejection = (errorMessage: string): boolean => {
    const lowerMessage = errorMessage.toLowerCase();
    return (
      lowerMessage.includes('user rejected') ||
      lowerMessage.includes('user denied') ||
      lowerMessage.includes('user cancelled') ||
      lowerMessage.includes('user canceled') ||
      lowerMessage.includes('rejected the request') ||
      lowerMessage.includes('bundle id is unknown') || // This is the viem error for rejection
      lowerMessage.includes('has not been submitted') ||
      lowerMessage.includes('no matching bundle') ||
      lowerMessage.includes('action_rejected')
    );
  };

  /**
   * Get user-friendly error message for deposit errors
   */
  const getDepositErrorMessage = (errorMessage: string): string => {
    const lowerMessage = errorMessage.toLowerCase();
    
    // User rejection errors
    if (isUserRejection(errorMessage)) {
      return 'Transaction cancelled. You rejected the transaction in your wallet.';
    }
    
    // Amount validation errors
    if (lowerMessage.includes('fromamount must be equal to constant') || 
        lowerMessage.includes('must be equal to constant')) {
      return 'Quote expired. The amount changed since the quote was fetched. Please try again.';
    }
    
    // Insufficient funds
    if (lowerMessage.includes('insufficient') || 
        lowerMessage.includes('not enough') ||
        lowerMessage.includes('exceeds balance')) {
      return 'Insufficient funds. You may not have enough tokens or gas to complete this transaction.';
    }
    
    // Network/RPC errors
    if (lowerMessage.includes('network') || 
        lowerMessage.includes('rpc') ||
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('connection')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    // Slippage errors
    if (lowerMessage.includes('slippage') || 
        lowerMessage.includes('price impact')) {
      return 'Price changed too much. Please try again with a smaller amount.';
    }
    
    // Generic validation error
    if (lowerMessage.includes('validationerror') || lowerMessage.includes('validation')) {
      return 'Validation failed. Please go back and try again with a fresh quote.';
    }
    
    // Return original if no match (truncated if too long)
    if (errorMessage.length > 100) {
      return errorMessage.substring(0, 100) + '...';
    }
    return errorMessage;
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `~${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes} min`;
  };

  // Format USD display
  const formatUSD = (value: number): string => {
    return `$${value.toFixed(2)}`;
  };

  // Render amount input step
  const renderInputStep = () => (
    <div style={{ padding: '24px' }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '32px',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '8px',
        }}>💰</div>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: COLORS.foam,
          marginBottom: '8px',
        }}>
          Deposit to HyperLiquid
        </h2>
        <p style={{
          fontSize: '14px',
          color: COLORS.foam + '80',
        }}>
          Enter the amount you want to deposit. We'll find the best routes from all your assets.
        </p>
      </div>

      <div style={{
        background: `linear-gradient(135deg, ${COLORS.firefly}80 0%, ${COLORS.ebony}90 100%)`,
        borderRadius: '20px',
        padding: '24px',
        border: `3px solid ${COLORS.aquamarine}30`,
        marginBottom: '24px',
      }}>
        <label style={{
          display: 'block',
          fontSize: '12px',
          color: COLORS.aquamarine + '80',
          marginBottom: '12px',
          fontWeight: '600',
        }}>
          AMOUNT TO DEPOSIT (USDC)
        </label>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{
            fontSize: '32px',
            fontWeight: '600',
            color: COLORS.aquamarine,
          }}>$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min={MIN_HYPERLIQUID_DEPOSIT_USD}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              fontSize: '32px',
              fontWeight: '600',
              color: COLORS.foam,
              outline: 'none',
            }}
            autoFocus
          />
        </div>
        
        <div style={{
          marginTop: '12px',
          fontSize: '12px',
          color: COLORS.foam + '60',
        }}>
          Minimum deposit: ${MIN_HYPERLIQUID_DEPOSIT_USD} USDC
        </div>
      </div>

      <button
        onClick={handleCalculate}
        disabled={!amount || parseFloat(amount) < MIN_HYPERLIQUID_DEPOSIT_USD}
        style={{
          width: '100%',
          padding: '18px',
          fontSize: '18px',
          fontWeight: '600',
          border: 'none',
          borderRadius: '16px',
          cursor: amount && parseFloat(amount) >= MIN_HYPERLIQUID_DEPOSIT_USD ? 'pointer' : 'not-allowed',
          background: amount && parseFloat(amount) >= MIN_HYPERLIQUID_DEPOSIT_USD
            ? `linear-gradient(135deg, ${COLORS.aquamarine} 0%, ${COLORS.firefly} 150%)`
            : COLORS.firefly + '60',
          color: amount && parseFloat(amount) >= MIN_HYPERLIQUID_DEPOSIT_USD ? COLORS.ebony : COLORS.foam + '50',
          transition: 'all 0.3s ease',
        }}
      >
        Find Best Routes
      </button>
    </div>
  );

  // Render scanning progress step
  const renderScanningStep = () => (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${COLORS.aquamarine}20 0%, ${COLORS.firefly} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        animation: 'pulse 2s infinite',
      }}>
        <span style={{ fontSize: '36px' }}>🔍</span>
      </div>
      
      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        color: COLORS.foam,
        marginBottom: '8px',
      }}>
        Scanning Your Assets
      </h3>
      
      <p style={{
        fontSize: '14px',
        color: COLORS.foam + '80',
        marginBottom: '24px',
      }}>
        {scanProgress.message || 'Checking balances across all chains...'}
      </p>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '8px',
        background: COLORS.firefly,
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${scanProgress.progress}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${COLORS.aquamarine} 0%, ${COLORS.firefly} 200%)`,
          borderRadius: '4px',
          transition: 'width 0.3s ease',
        }} />
      </div>
      
      <p style={{
        fontSize: '12px',
        color: COLORS.foam + '60',
        marginTop: '8px',
      }}>
        {Math.round(scanProgress.progress)}%
      </p>
    </div>
  );

  // Render strategy card
  const renderStrategyCard = (
    strategy: DepositStrategy | null,
    type: 'fastest' | 'cheapest',
    icon: string,
    title: string
  ) => {
    if (!strategy) return null;
    
    const isSelected = selectedStrategy === type;
    
    return (
      <button
        onClick={() => setSelectedStrategy(type)}
        style={{
          width: '100%',
          padding: '20px',
          background: isSelected 
            ? `linear-gradient(135deg, ${COLORS.aquamarine}30 0%, ${COLORS.firefly} 100%)`
            : `linear-gradient(135deg, ${COLORS.firefly}80 0%, ${COLORS.ebony}90 100%)`,
          border: `3px solid ${isSelected ? COLORS.aquamarine : COLORS.aquamarine + '30'}`,
          borderRadius: '16px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.3s ease',
          marginBottom: '16px',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <span style={{ fontSize: '24px' }}>{icon}</span>
          <div>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: COLORS.foam,
            }}>{title}</div>
            <div style={{
              fontSize: '12px',
              color: COLORS.foam + '70',
            }}>
              {strategy.bridges.length} bridge{strategy.bridges.length > 1 ? 's' : ''}
            </div>
          </div>
          {isSelected && (
            <div style={{
              marginLeft: 'auto',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: COLORS.aquamarine,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ color: COLORS.ebony, fontSize: '14px' }}>✓</span>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: COLORS.foam + '60', marginBottom: '4px' }}>
              You'll receive
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: COLORS.aquamarine }}>
              {formatUSD(strategy.totalOutputUSD)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: COLORS.foam + '60', marginBottom: '4px' }}>
              Est. Time
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: COLORS.foam }}>
              {formatTime(strategy.totalTimeSeconds)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: COLORS.foam + '60', marginBottom: '4px' }}>
              Total Fees
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#fbbf24' }}>
              {formatUSD(strategy.totalFeesUSD)}
            </div>
          </div>
        </div>

        {/* Bridges list */}
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: `1px solid ${COLORS.aquamarine}20`,
        }}>
          {strategy.bridges.map((bridge, idx) => (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 0',
              fontSize: '13px',
            }}>
              <span style={{ color: COLORS.foam + '80' }}>
                {bridge.from.tokenSymbol}
              </span>
              <span style={{ color: COLORS.foam + '50' }}>on</span>
              <span style={{ color: COLORS.foam }}>
                {bridge.from.chainName}
              </span>
              <span style={{ color: COLORS.aquamarine, marginLeft: 'auto' }}>
                {formatUSD(bridge.usedInputUSD ?? bridge.from.balanceUSD)} → {formatUSD(bridge.usedOutputUSD ?? bridge.estimatedOutputUSD)}
              </span>
            </div>
          ))}
        </div>
      </button>
    );
  };

  // Render strategy selection step
  const renderSelectStep = () => {
    if (!depositPlan) return null;

    if (depositPlan.insufficientFunds) {
      return (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😔</div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: COLORS.foam,
            marginBottom: '8px',
          }}>
            Insufficient Funds
          </h3>
          <p style={{
            fontSize: '14px',
            color: COLORS.foam + '80',
            marginBottom: '16px',
          }}>
            You have {formatUSD(depositPlan.availableBalanceUSD)} available across all chains,
            but you want to deposit {formatUSD(depositPlan.targetAmount)}.
          </p>
          <button
            onClick={() => setStep('input')}
            style={{
              padding: '12px 24px',
              background: COLORS.firefly,
              border: `2px solid ${COLORS.aquamarine}`,
              borderRadius: '12px',
              color: COLORS.aquamarine,
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Try a smaller amount
          </button>
        </div>
      );
    }

    if (!depositPlan.fastest && !depositPlan.cheapest) {
      return (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: COLORS.foam,
            marginBottom: '8px',
          }}>
            No Routes Available
          </h3>
          <p style={{
            fontSize: '14px',
            color: COLORS.foam + '80',
          }}>
            We couldn't find any bridge routes for your assets. Please try again later.
          </p>
        </div>
      );
    }

    // Determine which strategies to show
    // If one strategy dominates the other (better or equal in ALL metrics), show only that one
    const fastest = depositPlan.fastest;
    const cheapest = depositPlan.cheapest;
    
    let showFastest = !!fastest;
    let showCheapest = !!cheapest;
    let singleBestStrategy: 'fastest' | 'cheapest' | null = null;
    
    if (fastest && cheapest) {
      // First, check if strategies are essentially IDENTICAL (same bridges, just different order)
      const areSameBridges = () => {
        if (fastest.bridges.length !== cheapest.bridges.length) return false;
        
        // Create a set of bridge identifiers for each strategy
        const fastestBridgeIds = new Set(
          fastest.bridges.map(b => `${b.from.chainId}-${b.from.tokenSymbol}-${b.usedInputAmount || b.from.balance}`)
        );
        const cheapestBridgeIds = new Set(
          cheapest.bridges.map(b => `${b.from.chainId}-${b.from.tokenSymbol}-${b.usedInputAmount || b.from.balance}`)
        );
        
        // Check if all bridges in fastest are also in cheapest
        for (const id of fastestBridgeIds) {
          if (!cheapestBridgeIds.has(id)) return false;
        }
        return true;
      };
      
      // Check if metrics are essentially the same (within 1%)
      const sameTime = Math.abs(fastest.totalTimeSeconds - cheapest.totalTimeSeconds) <= 1;
      const sameFees = Math.abs(fastest.totalFeesUSD - cheapest.totalFeesUSD) < 0.01;
      const sameOutput = Math.abs(fastest.totalOutputUSD - cheapest.totalOutputUSD) < 0.10;
      
      const strategiesAreIdentical = areSameBridges() && sameTime && sameFees && sameOutput;
      
      if (strategiesAreIdentical) {
        // Strategies are identical - show only one as "Best Route"
        showCheapest = false;
        singleBestStrategy = 'fastest';
        console.log('🔄 Strategies are identical (same bridges, different order) - showing only one');
      } else {
        // Check if cheapest dominates fastest
        // Dominates = better or equal in time AND fees, with similar output (within 5%)
        const cheapestIsFasterOrEqual = cheapest.totalTimeSeconds <= fastest.totalTimeSeconds;
        const cheapestIsCheaperOrEqual = cheapest.totalFeesUSD <= fastest.totalFeesUSD;
        const cheapestHasSimilarOutput = cheapest.totalOutputUSD >= fastest.totalOutputUSD * 0.95;
        
        const fastestIsFasterOrEqual = fastest.totalTimeSeconds <= cheapest.totalTimeSeconds;
        const fastestIsCheaperOrEqual = fastest.totalFeesUSD <= cheapest.totalFeesUSD;
        const fastestHasSimilarOutput = fastest.totalOutputUSD >= cheapest.totalOutputUSD * 0.95;
        
        // Cheapest dominates if it's both faster AND cheaper (or equal), with acceptable output
        const cheapestDominates = cheapestIsFasterOrEqual && cheapestIsCheaperOrEqual && cheapestHasSimilarOutput;
        
        // Fastest dominates if it's both faster AND cheaper (or equal), with acceptable output
        const fastestDominates = fastestIsFasterOrEqual && fastestIsCheaperOrEqual && fastestHasSimilarOutput;
        
        // Special case: if "cheapest" is actually FASTER, it's clearly better - show only that
        const cheapestIsActuallyFaster = cheapest.totalTimeSeconds < fastest.totalTimeSeconds;
        const fastestIsActuallyFaster = fastest.totalTimeSeconds < cheapest.totalTimeSeconds;
        
        if ((cheapestDominates && !fastestDominates) || (cheapestIsActuallyFaster && cheapestIsCheaperOrEqual)) {
          // Cheapest is better in every way - only show cheapest
          showFastest = false;
          singleBestStrategy = 'cheapest';
          console.log('💎 Cheapest strategy dominates - showing only cheapest', {
            time: `${cheapest.totalTimeSeconds}s vs ${fastest.totalTimeSeconds}s`,
            fees: `$${cheapest.totalFeesUSD.toFixed(2)} vs $${fastest.totalFeesUSD.toFixed(2)}`,
            output: `$${cheapest.totalOutputUSD.toFixed(2)} vs $${fastest.totalOutputUSD.toFixed(2)}`
          });
        } else if ((fastestDominates && !cheapestDominates) || (fastestIsActuallyFaster && fastestIsCheaperOrEqual)) {
          // Fastest is better in every way - only show fastest
          showCheapest = false;
          singleBestStrategy = 'fastest';
          console.log('⚡ Fastest strategy dominates - showing only fastest');
        }
        // If neither dominates (real tradeoff exists), show both options
      }
    }
    
    // Auto-select if only one option
    const effectiveSelectedStrategy = singleBestStrategy || selectedStrategy;

    return (
      <div style={{ padding: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: COLORS.foam,
            marginBottom: '4px',
          }}>
            {singleBestStrategy ? 'Optimal Route Found' : 'Choose Your Strategy'}
          </h3>
          <p style={{
            fontSize: '14px',
            color: COLORS.foam + '80',
          }}>
            Depositing {formatUSD(depositPlan.targetAmount)} to HyperLiquid
          </p>
        </div>

        {showFastest && renderStrategyCard(fastest, 'fastest', '⚡', singleBestStrategy === 'fastest' ? 'Best Route' : 'Fastest')}
        {showCheapest && renderStrategyCard(cheapest, 'cheapest', '💎', singleBestStrategy === 'cheapest' ? 'Best Route' : 'Cheapest')}

        <button
          onClick={() => {
            // Auto-select the single best strategy if not already selected
            if (singleBestStrategy && !selectedStrategy) {
              setSelectedStrategy(singleBestStrategy);
            }
            handleExecute();
          }}
          disabled={!effectiveSelectedStrategy && !singleBestStrategy}
          style={{
            width: '100%',
            padding: '18px',
            fontSize: '18px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '16px',
            cursor: (effectiveSelectedStrategy || singleBestStrategy) ? 'pointer' : 'not-allowed',
            background: (effectiveSelectedStrategy || singleBestStrategy)
              ? `linear-gradient(135deg, ${COLORS.aquamarine} 0%, ${COLORS.firefly} 150%)`
              : COLORS.firefly + '60',
            color: (effectiveSelectedStrategy || singleBestStrategy) ? COLORS.ebony : COLORS.foam + '50',
            transition: 'all 0.3s ease',
            marginTop: '8px',
          }}
        >
          {singleBestStrategy 
            ? 'Execute Best Route' 
            : `Execute ${selectedStrategy === 'fastest' ? '⚡ Fastest' : selectedStrategy === 'cheapest' ? '💎 Cheapest' : ''} Strategy`}
        </button>
      </div>
    );
  };

  // Render execution step
  const renderExecutingStep = () => {
    const getHeaderText = () => {
      if (step === 'depositing') {
        return 'Depositing to HyperLiquid...';
      }
      if (overallComplete) {
        if (hyperLiquidDeposit?.status === 'completed') {
          return 'Deposit Complete!';
        }
        if (hyperLiquidDeposit?.status === 'failed') {
          return 'Deposit Failed';
        }
        if (executions.some(e => e.status === 'failed')) {
          return executions.some(e => e.status === 'completed') ? 'Partially Complete' : 'Bridges Failed';
        }
        return 'Deposit Complete!';
      }
      return 'Bridging to Arbitrum...';
    };

    const getSubText = () => {
      if (step === 'depositing') {
        return 'Transferring USDC to HyperLiquid trading account';
      }
      if (overallComplete) {
        if (hyperLiquidDeposit?.status === 'completed') {
          return `$${hyperLiquidDeposit.amountUSDC.toFixed(2)} USDC deposited to HyperLiquid`;
        }
        if (hyperLiquidDeposit?.status === 'failed') {
          return hyperLiquidDeposit.error || 'Failed to deposit to HyperLiquid';
        }
        if (executions.some(e => e.status === 'failed')) {
          return `${executions.filter(e => e.status === 'completed').length} of ${executions.length} bridges succeeded`;
        }
        return 'Your assets have been deposited to HyperLiquid';
      }
      return `Bridge ${currentExecutionIndex + 1} of ${executions.length}`;
    };

    return (
    <div style={{ padding: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: COLORS.foam,
          marginBottom: '4px',
        }}>
          {getHeaderText()}
        </h3>
        <p style={{
          fontSize: '14px',
          color: COLORS.foam + '80',
        }}>
          {getSubText()}
        </p>
      </div>

      {/* Execution list */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {executions.map((exec, idx) => (
          <div
            key={idx}
            style={{
              padding: '16px',
              background: `linear-gradient(135deg, ${COLORS.firefly}80 0%, ${COLORS.ebony}90 100%)`,
              border: `2px solid ${
                exec.status === 'completed' ? '#4ade80' :
                exec.status === 'failed' ? '#ef4444' :
                exec.status === 'executing' ? COLORS.aquamarine :
                COLORS.aquamarine + '30'
              }`,
              borderRadius: '12px',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              {/* Status icon */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: exec.status === 'completed' ? '#4ade80' :
                  exec.status === 'failed' ? '#ef4444' :
                  exec.status === 'executing' ? COLORS.aquamarine :
                  COLORS.firefly,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}>
                {exec.status === 'completed' ? '✓' :
                 exec.status === 'failed' ? '✗' :
                 exec.status === 'executing' ? '⏳' : '○'}
              </div>

              {/* Bridge info */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: COLORS.foam,
                }}>
                  {exec.option.from.tokenSymbol} on {exec.option.from.chainName}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: COLORS.foam + '70',
                }}>
                  {formatUSD(exec.option.usedInputUSD ?? exec.option.from.balanceUSD)} → {formatUSD(exec.option.usedOutputUSD ?? exec.option.estimatedOutputUSD)} USDC
                </div>
              </div>

              {/* Status text */}
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: exec.status === 'completed' ? '#4ade80' :
                  exec.status === 'failed' ? '#ef4444' :
                  exec.status === 'executing' ? COLORS.aquamarine :
                  COLORS.foam + '50',
              }}>
                {exec.status === 'completed' ? 'Done' :
                 exec.status === 'failed' ? 'Failed' :
                 exec.status === 'executing' ? 'In Progress' : 'Waiting'}
              </div>
            </div>

            {/* Progress details for executing bridge */}
            {exec.status === 'executing' && exec.progress && (
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: `1px solid ${COLORS.aquamarine}20`,
                fontSize: '13px',
                color: COLORS.foam + '80',
              }}>
                {exec.progress.message}
              </div>
            )}

            {/* Error message */}
            {exec.status === 'failed' && exec.error && (
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: `1px solid #ef444440`,
                fontSize: '13px',
                color: '#ef4444',
              }}>
                {exec.error}
              </div>
            )}
          </div>
        ))}

        {/* HyperLiquid Deposit Card */}
        {(step === 'depositing' || hyperLiquidDeposit) && (
          <div
            style={{
              padding: '16px',
              background: `linear-gradient(135deg, ${COLORS.firefly}80 0%, ${COLORS.ebony}90 100%)`,
              border: `2px solid ${
                hyperLiquidDeposit?.status === 'completed' ? '#4ade80' :
                hyperLiquidDeposit?.status === 'failed' ? '#ef4444' :
                COLORS.aquamarine
              }`,
              borderRadius: '12px',
              marginTop: '12px',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              {/* Status icon */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: hyperLiquidDeposit?.status === 'completed' ? '#4ade80' :
                  hyperLiquidDeposit?.status === 'failed' ? '#ef4444' :
                  COLORS.aquamarine,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}>
                {hyperLiquidDeposit?.status === 'completed' ? '✓' :
                 hyperLiquidDeposit?.status === 'failed' ? '✗' : '⏳'}
              </div>

              {/* Deposit info */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: COLORS.foam,
                }}>
                  Deposit to HyperLiquid
                </div>
                <div style={{
                  fontSize: '12px',
                  color: COLORS.foam + '70',
                }}>
                  {hyperLiquidDeposit?.amountUSDC 
                    ? `$${hyperLiquidDeposit.amountUSDC.toFixed(2)} USDC → Trading Account`
                    : 'Checking USDC balance...'}
                </div>
              </div>

              {/* Status text */}
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: hyperLiquidDeposit?.status === 'completed' ? '#4ade80' :
                  hyperLiquidDeposit?.status === 'failed' ? '#ef4444' :
                  COLORS.aquamarine,
              }}>
                {hyperLiquidDeposit?.status === 'completed' ? 'Done' :
                 hyperLiquidDeposit?.status === 'failed' ? 'Failed' : 'In Progress'}
              </div>
            </div>

            {/* Error message */}
            {hyperLiquidDeposit?.status === 'failed' && hyperLiquidDeposit.error && (
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: `1px solid #ef444440`,
                fontSize: '13px',
                color: '#ef4444',
              }}>
                {hyperLiquidDeposit.error}
              </div>
            )}

            {/* Transaction link */}
            {hyperLiquidDeposit?.txHash && (
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: `1px solid ${COLORS.aquamarine}20`,
              }}>
                <a
                  href={`https://arbiscan.io/tx/${hyperLiquidDeposit.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '12px',
                    color: COLORS.aquamarine,
                    textDecoration: 'none',
                  }}
                >
                  View on Arbiscan →
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Done button */}
      {overallComplete && (
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '18px',
            fontSize: '18px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '16px',
            cursor: 'pointer',
            background: `linear-gradient(135deg, ${COLORS.aquamarine} 0%, ${COLORS.firefly} 150%)`,
            color: COLORS.ebony,
            marginTop: '24px',
          }}
        >
          Done
        </button>
      )}
    </div>
    );
  };

  // Embedded content (for rendering inside BridgeModal)
  const embeddedContent = (
    <div>
      {/* Back button for embedded mode */}
      {step !== 'input' && step !== 'executing' && step !== 'depositing' && (
        <div style={{ padding: '0 24px 12px' }}>
          <button
            onClick={() => {
              if (step === 'select') setStep('input');
              if (step === 'complete') {
                setStep('select');
                setOverallComplete(false);
                setHyperLiquidDeposit(null);
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: COLORS.foam,
              fontSize: '14px',
              cursor: 'pointer',
              padding: '8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ← Back
          </button>
        </div>
      )}
      
      {/* Content */}
      {step === 'input' && renderInputStep()}
      {step === 'scanning' && renderScanningStep()}
      {step === 'select' && renderSelectStep()}
      {(step === 'executing' || step === 'depositing' || step === 'complete') && renderExecutingStep()}
      
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
      `}</style>
    </div>
  );

  // Return embedded content if embedded mode
  if (embedded) {
    return embeddedContent;
  }

  // Full modal mode
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...styles.overlay,
    }}>
      {/* Backdrop - fully opaque to hide background */}
      <div
        onClick={(step === 'executing' || step === 'depositing') ? undefined : onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: COLORS.ebony,
          cursor: (step === 'executing' || step === 'depositing') ? 'not-allowed' : 'pointer',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflow: 'auto',
        background: `linear-gradient(180deg, ${COLORS.ebony} 0%, ${COLORS.firefly}40 100%)`,
        borderRadius: '24px',
        border: `3px solid ${COLORS.aquamarine}30`,
        boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${COLORS.aquamarine}20`,
        ...styles.modal,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: `1px solid ${COLORS.aquamarine}20`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            {step !== 'input' && step !== 'executing' && (
              <button
                onClick={() => {
                  if (step === 'select') setStep('input');
                  if (step === 'complete') {
                    setStep('select');
                    setOverallComplete(false);
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: COLORS.foam,
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ←
              </button>
            )}
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: COLORS.foam,
              margin: 0,
            }}>
              Deposit to HyperLiquid
            </h2>
          </div>
          
          {step !== 'executing' && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: `2px solid ${COLORS.aquamarine}40`,
                borderRadius: '10px',
                width: '36px',
                height: '36px',
                color: COLORS.foam,
                fontSize: '18px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        {step === 'input' && renderInputStep()}
        {step === 'scanning' && renderScanningStep()}
        {step === 'select' && renderSelectStep()}
        {(step === 'executing' || step === 'complete') && renderExecutingStep()}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default DepositModal;
