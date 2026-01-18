import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BridgeWidgetStyles } from '../styles/defaultStyles';
import type { ChainBalance, ChainInfo } from '../../types/index';
import { ChainTokenSelector } from './ChainTokenSelector';
import type { SearchableToken } from '../tokenSearch';
import { LiFiBridgeService, type DetailedBridgeProgress, type StepInfo } from '../bridge';

// Quote data for display
interface QuoteData {
  receiveAmount: string;
  receiveAmountFormatted: string;
  estimatedTime: number; // in minutes (0 if < 60 seconds)
  estimatedSeconds: number; // raw seconds value
  fromAmountUSD: number | null; // USD value of source amount
  toAmountUSD: number | null; // USD value of destination amount
  costUSD: number | null; // Cost in USD (fees + slippage)
  isLoading: boolean;
  error: string | null;
}

// Hyperliquid Brand Colors
const COLORS = {
  aquamarine: '#97FCE4',
  firefly: '#0F3933',
  ebony: '#04060C',
  foam: '#F5FEFD',
};

// Transaction Status Page Component
interface TransactionStatusPageProps {
  progress: DetailedBridgeProgress;
  onClose: () => void;
  onBack: () => void;
}

// Helper function to translate SDK error messages into user-friendly messages
const getUserFriendlyErrorMessage = (errorMessage: string): string => {
  const lowerMessage = errorMessage.toLowerCase();
  
  // User rejected/denied signature - check this FIRST before other transaction errors
  if (lowerMessage.includes('user rejected') || lowerMessage.includes('user denied') || 
      lowerMessage.includes('denied transaction signature') || lowerMessage.includes('userrejectedrequesterror')) {
    return 'Signature denied. You cancelled the transaction in your wallet.';
  }
  
  // Bundle/batching errors (MetaMask smart transactions)
  if (lowerMessage.includes('bundle') || lowerMessage.includes('unknownbundleid') || lowerMessage.includes('no matching bundle')) {
    return 'Transaction tracking failed. This can happen with MetaMask Smart Transactions. Try disabling "Smart Transactions" in MetaMask settings (Settings → Advanced → Smart Transactions) and try again.';
  }
  
  // Transaction failed errors (slippage, price movement, etc.)
  if (lowerMessage.includes('transactionerror') || lowerMessage.includes('transaction failed')) {
    return 'The transaction failed on-chain. Try increasing the slippage tolerance or using a larger transaction amount.';
  }
  
  // Slippage errors
  if (lowerMessage.includes('slippage') || lowerMessage.includes('price impact')) {
    return 'Price moved too much during the transaction. Try increasing slippage tolerance in settings or wait for less volatile market conditions.';
  }
  
  // Stale quote error - fromAmount must be equal to constant
  if (lowerMessage.includes('must be equal to constant') || lowerMessage.includes('fromamount')) {
    return 'Quote expired. The price or amount changed since you got the quote. Please go back and try again with a fresh quote.';
  }
  
  // Validation errors (400 status)
  if (lowerMessage.includes('status code 400') || lowerMessage.includes('validationerror')) {
    return 'The quote is no longer valid. Please go back and get a new quote.';
  }
  
  // Insufficient funds
  if (lowerMessage.includes('insufficient') || lowerMessage.includes('not enough')) {
    return 'Insufficient funds to complete this transaction. Make sure you have enough tokens and gas fees.';
  }
  
  // Other user cancellations
  if (lowerMessage.includes('cancelled') || lowerMessage.includes('canceled')) {
    return 'Transaction was cancelled. You can try again when ready.';
  }
  
  // Gas estimation failed
  if (lowerMessage.includes('gas') || lowerMessage.includes('estimation')) {
    return 'Failed to estimate gas for this transaction. The route may not be available right now. Try a different amount or token pair.';
  }
  
  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('rpc') || lowerMessage.includes('timeout')) {
    return 'Network connection issue. Please check your internet connection and try again.';
  }
  
  // Allowance/approval errors
  if (lowerMessage.includes('allowance') || lowerMessage.includes('approval')) {
    return 'Token approval failed. Please try approving the token again.';
  }
  
  // Default: clean up the SDK error message
  // Remove SDK version info and technical prefixes
  let cleanMessage = errorMessage
    .replace(/\[.*?\]/g, '') // Remove [ErrorType] prefixes
    .replace(/LI\.FI SDK version:.*$/i, '') // Remove SDK version
    .replace(/SDKError:/gi, '')
    .replace(/Version:.*$/gim, '') // Remove viem version info
    .replace(/Details:.*$/gim, '') // Remove details line
    .replace(/Caused by:.*$/gim, '') // Remove caused by lines
    .trim();
  
  if (cleanMessage.length < 10) {
    return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
  }
  
  return cleanMessage;
};

const TransactionStatusPage: React.FC<TransactionStatusPageProps> = ({ progress, onClose, onBack }) => {
  const isCompleted = progress.overallStatus === 'completed';
  const isFailed = progress.overallStatus === 'failed';
  
  // Get user-friendly error message if failed
  const displayMessage = isFailed 
    ? getUserFriendlyErrorMessage(progress.message)
    : progress.message;

  return (
    <div style={{
      padding: '24px 28px 28px',
      minHeight: '400px',
      display: 'flex',
      flexDirection: 'column',
      background: `linear-gradient(180deg, ${COLORS.ebony} 0%, ${COLORS.firefly}40 100%)`,
      position: 'relative',
      zIndex: 2,
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '32px',
      }}>
        <h3 style={{
          margin: '0 0 8px',
          color: COLORS.foam,
          fontSize: '20px',
          fontWeight: '600',
        }}>
          {isCompleted ? '🎉 Transaction Complete!' : isFailed ? '❌ Transaction Failed' : '⏳ Processing Transaction'}
        </h3>
        <p style={{
          margin: 0,
          color: isFailed ? '#ef4444' + 'cc' : COLORS.aquamarine + '80',
          fontSize: '14px',
          lineHeight: '1.5',
          maxWidth: '400px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          {displayMessage}
        </p>
      </div>

      {/* Steps Progress - Group consecutive same-tool steps */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {(() => {
          // Filter out feeCollection steps
          const filteredSteps = progress.steps.filter(step => step.tool !== 'feeCollection');
          
          // Group consecutive steps with the same tool
          const groupedSteps: { tool: string; toolName: string; toolLogo: string; steps: typeof filteredSteps }[] = [];
          
          filteredSteps.forEach((step) => {
            const lastGroup = groupedSteps[groupedSteps.length - 1];
            if (lastGroup && lastGroup.tool === step.tool) {
              // Add to existing group
              lastGroup.steps.push(step);
            } else {
              // Create new group
              groupedSteps.push({
                tool: step.tool,
                toolName: step.toolName,
                toolLogo: step.toolLogo,
                steps: [step],
              });
            }
          });
          
          return groupedSteps.map((group, index) => (
            <GroupedStepProgressBar key={`${group.tool}-${index}`} group={group} index={index} />
          ));
        })()}
      </div>

      {/* Transaction Link */}
      {progress.txLink && (
        <a
          href={progress.txLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '24px',
            padding: '12px 20px',
            background: COLORS.aquamarine + '15',
            borderRadius: '12px',
            color: COLORS.aquamarine,
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '500',
            border: `3px solid ${COLORS.aquamarine}30`,
            transition: 'all 0.2s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15,3 21,3 21,9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          View on Explorer
        </a>
      )}

      {/* Action Buttons */}
      {(isCompleted || isFailed) && (
        <button
          onClick={onBack}
          style={{
            marginTop: '16px',
            padding: '16px',
            background: isCompleted 
              ? `linear-gradient(135deg, ${COLORS.aquamarine} 0%, #7EECD3 100%)`
              : `linear-gradient(135deg, #ef4444 0%, #dc2626 100%)`,
            border: 'none',
            borderRadius: '14px',
            color: isCompleted ? COLORS.ebony : '#fff',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {isCompleted ? 'Done' : 'Try Again'}
        </button>
      )}
    </div>
  );
};

// Grouped Step Progress Bar Component - handles multiple consecutive steps with same tool
interface GroupedStep {
  tool: string;
  toolName: string;
  toolLogo: string;
  steps: StepInfo[];
}

const GroupedStepProgressBar: React.FC<{ group: GroupedStep; index: number }> = ({ group, index }) => {
  // Calculate aggregate status from all steps in the group
  const getGroupStatus = (): StepInfo['status'] => {
    // If any step failed, group is failed
    if (group.steps.some(s => s.status === 'failed')) return 'failed';
    // If all steps are done, group is done
    if (group.steps.every(s => s.status === 'done')) return 'done';
    // If any step is pending, group is pending
    if (group.steps.some(s => s.status === 'pending')) return 'pending';
    // If any step requires action, group requires action
    if (group.steps.some(s => s.status === 'action_required')) return 'action_required';
    // Otherwise waiting
    return 'waiting';
  };

  // Calculate aggregate progress from all steps
  const getGroupProgress = (): number => {
    const totalSteps = group.steps.length;
    const completedSteps = group.steps.filter(s => s.status === 'done').length;
    const pendingSteps = group.steps.filter(s => s.status === 'pending').length;
    const actionRequiredSteps = group.steps.filter(s => s.status === 'action_required').length;
    
    // Each completed step contributes 100/totalSteps to progress
    // Pending steps contribute 50/totalSteps (halfway)
    // Action required steps contribute 25/totalSteps (just started)
    const progress = (completedSteps * 100 + pendingSteps * 50 + actionRequiredSteps * 25) / totalSteps;
    return Math.min(100, Math.round(progress));
  };

  const status = getGroupStatus();
  const progress = getGroupProgress();

  const getStatusColor = () => {
    switch (status) {
      case 'done': return '#4ade80';
      case 'failed': return '#ef4444';
      case 'pending': return COLORS.aquamarine;
      case 'action_required': return '#fbbf24';
      default: return COLORS.aquamarine + '40';
    }
  };

  return (
    <div style={{
      background: `linear-gradient(135deg, ${COLORS.firefly}80 0%, ${COLORS.ebony}90 100%)`,
      borderRadius: '16px',
      padding: '20px',
      border: `3px solid ${COLORS.aquamarine}20`,
    }}>
      {/* Tool Name & Status */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: COLORS.aquamarine + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '600',
            color: COLORS.aquamarine,
          }}>
            {index + 1}
          </span>
          <span style={{ color: COLORS.foam, fontSize: '15px', fontWeight: '500' }}>
            {group.toolName}
          </span>

        </div>
      </div>

      {/* Progress Bar Container - removed overflow:hidden so logo is visible */}
      <div style={{
        position: 'relative',
        height: '8px',
        background: COLORS.ebony,
        borderRadius: '4px',
      }}>
        {/* Progress Fill */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${progress}%`,
          background: status === 'failed' 
            ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
            : `linear-gradient(90deg, ${COLORS.aquamarine}60 0%, ${COLORS.aquamarine} 100%)`,
          borderRadius: '4px',
          transition: 'width 0.5s ease-out',
          boxShadow: progress > 0 ? `0 0 10px ${getStatusColor()}40` : 'none',
          overflow: 'hidden',
        }}>
          {/* Animated shimmer effect */}
          {status === 'pending' && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
              animation: 'shimmer 1.5s infinite',
            }} />
          )}
        </div>

        {/* Tool Logo in the middle - positioned above the bar */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '45px',
          height: '46px',
          borderRadius: '50%',
          background: COLORS.ebony,
          border: `8px solid ${
            status === 'failed' ? '#ef4444' : 
            status === 'done' ? '#4ade80' : 
            '#fbbf24'
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          transition: 'border-color 0.3s',
          boxShadow: status === 'done' ? `0 0 12px #4ade8040` : 
                     status === 'failed' ? `0 0 12px #ef444440` : 
                     `0 0 12px #fbbf2440`,
        }}>
          {group.toolLogo ? (
            <img 
              src={group.toolLogo} 
              alt={group.toolName}
              style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span style={{ fontSize: '14px', color: COLORS.aquamarine }}>
              {group.toolName.charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* Progress Markers */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '20px',
        fontSize: '11px',
        color: COLORS.aquamarine + '60',
      }}>
        <span style={{ color: progress >= 0 ? getStatusColor() : undefined }}>Start</span>
        <span style={{ color: progress >= 50 ? getStatusColor() : undefined, marginLeft: '24px' }}>Confirmed</span>
        <span style={{ color: progress >= 100 ? getStatusColor() : undefined }}>Complete</span>
      </div>

      {/* Shimmer animation keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export interface BridgeParams {
  fromChainId: number;
  toChainId: number;
  fromToken: SearchableToken;
  toToken: SearchableToken;
  amount: string;
}

interface BridgeModalProps {
  targetChainName: string;
  balances: ChainBalance[];
  chains: ChainInfo[];
  walletAddress: string; // Required for fetching quotes
  onClose: () => void;
  onBridge: (params: BridgeParams) => void;
  onBridgeWithProgress?: (params: BridgeParams, onProgress: (progress: DetailedBridgeProgress) => void) => Promise<void>;
  onError?: (error: string) => void; // Optional error callback
  styles?: BridgeWidgetStyles;
}

// Animated Orbs Component - Two large galaxy-like orbs
const FloatingOrbs: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    // Set canvas size with device pixel ratio for crisp rendering
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    resizeCanvas();

    // Two galaxy orbs with smooth orbital motion
    const orbs = [
      {
        x: width * 0.3,
        y: height * 0.4,
        radius: 120,
        baseX: width * 0.35,
        baseY: height * 0.45,
        orbitRadius: 80,
        angle: 0,
        speed: 0.003,
        color: COLORS.aquamarine,
        opacity: 0.25,
      },
      {
        x: width * 0.7,
        y: height * 0.6,
        radius: 150,
        baseX: width * 0.65,
        baseY: height * 0.55,
        orbitRadius: 100,
        angle: Math.PI,
        speed: 0.002,
        color: COLORS.aquamarine,
        opacity: 0.2,
      },
    ];

    // Animation loop
    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Update orb positions with smooth orbital motion
      orbs.forEach(orb => {
        orb.angle += orb.speed;
        orb.x = orb.baseX + Math.cos(orb.angle) * orb.orbitRadius;
        orb.y = orb.baseY + Math.sin(orb.angle * 0.7) * orb.orbitRadius * 0.6;
      });

      // Check for collision and create interaction effect
      const dx = orbs[0].x - orbs[1].x;
      const dy = orbs[0].y - orbs[1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = orbs[0].radius + orbs[1].radius;
      const isColliding = dist < minDist * 0.8;

      // Draw orbs with soft glow
      orbs.forEach(orb => {
        // Outer glow
        const outerGlow = ctx.createRadialGradient(
          orb.x, orb.y, orb.radius * 0.3,
          orb.x, orb.y, orb.radius * 1.5
        );
        outerGlow.addColorStop(0, orb.color + '15');
        outerGlow.addColorStop(0.5, orb.color + '08');
        outerGlow.addColorStop(1, orb.color + '00');

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = outerGlow;
        ctx.fill();

        // Main orb gradient
        const gradient = ctx.createRadialGradient(
          orb.x - orb.radius * 0.2, orb.y - orb.radius * 0.2, 0,
          orb.x, orb.y, orb.radius
        );
        const opacityHex = Math.floor(orb.opacity * 255).toString(16).padStart(2, '0');
        gradient.addColorStop(0, orb.color + opacityHex);
        gradient.addColorStop(0.6, orb.color + Math.floor(orb.opacity * 0.5 * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, orb.color + '00');

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // Draw collision glow when orbs are close
      if (isColliding) {
        const midX = (orbs[0].x + orbs[1].x) / 2;
        const midY = (orbs[0].y + orbs[1].y) / 2;
        const intensity = 1 - (dist / (minDist * 0.8));
        const glowRadius = 60 + intensity * 40;

        const collisionGlow = ctx.createRadialGradient(
          midX, midY, 0,
          midX, midY, glowRadius
        );
        const glowOpacity = Math.floor(intensity * 80).toString(16).padStart(2, '0');
        collisionGlow.addColorStop(0, COLORS.aquamarine + glowOpacity);
        collisionGlow.addColorStop(0.5, COLORS.aquamarine + Math.floor(intensity * 30).toString(16).padStart(2, '0'));
        collisionGlow.addColorStop(1, COLORS.aquamarine + '00');

        ctx.beginPath();
        ctx.arc(midX, midY, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = collisionGlow;
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      resizeCanvas();
      // Update orb base positions on resize
      orbs[0].baseX = width * 0.35;
      orbs[0].baseY = height * 0.45;
      orbs[1].baseX = width * 0.65;
      orbs[1].baseY = height * 0.55;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};

export const BridgeModal: React.FC<BridgeModalProps> = ({
  targetChainName,
  balances,
  chains,
  walletAddress,
  onClose,
  onBridge,
  onBridgeWithProgress,
  onError,
  styles = {},
}) => {
  // Source (FROM)
  const [selectedChain, setSelectedChain] = useState<ChainBalance | null>(null);
  const [selectedToken, setSelectedToken] = useState<SearchableToken | null>(null);
  const [showChainTokenSelector, setShowChainTokenSelector] = useState(false);
  const [amount, setAmount] = useState('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  // Destination (TO)
  const [destChain, setDestChain] = useState<ChainInfo | null>(null);
  const [destToken, setDestToken] = useState<SearchableToken | null>(null);
  const [showDestSelector, setShowDestSelector] = useState(false);
  const [selectorMode, setSelectorMode] = useState<'source' | 'destination'>('source');

  // Error notification
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transaction status page
  const [showStatusPage, setShowStatusPage] = useState(false);
  const [transactionProgress, setTransactionProgress] = useState<DetailedBridgeProgress | null>(null);
  const [isTransactionActive, setIsTransactionActive] = useState(false);
  
  // Use a ref for immediate synchronous checking (React state updates are async)
  const isTransactionActiveRef = useRef(false);
  
  // Balance refresh trigger - increment to force fresh balance fetch
  const [balanceRefreshTrigger, setBalanceRefreshTrigger] = useState(0);
  
  // Safe close handler - only allows closing when no transaction is active
  // Uses ref for immediate check since React state updates are batched/async
  const handleSafeClose = () => {
    if (isTransactionActiveRef.current) {
      console.log('🚫 Cannot close modal: transaction in progress');
      return;
    }
    onClose();
  };

  // Quote state for live updates
  const [quote, setQuote] = useState<QuoteData>({
    receiveAmount: '0',
    receiveAmountFormatted: '0.00',
    estimatedTime: 0,
    estimatedSeconds: 0,
    fromAmountUSD: null,
    toAmountUSD: null,
    costUSD: null,
    isLoading: false,
    error: null,
  });
  
  // Bridge service for fetching quotes
  const bridgeService = useRef(new LiFiBridgeService());
  const quoteDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Track if defaults have been initialized
  const defaultsInitialized = useRef(false);
  
  // Handle escape key - prevent closing during active transaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Use ref for synchronous check to prevent race conditions
        if (isTransactionActiveRef.current) {
          console.log('🚫 Cannot close modal with Escape: transaction in progress');
          e.preventDefault();
          e.stopPropagation();
        } else {
          onClose();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]); // Remove isTransactionActive from deps since we use ref

  // Set defaults ONCE: Source = USDC on Ethereum, Dest = USDC on HyperEVM
  useEffect(() => {
    // Only initialize once when chains are available
    if (defaultsInitialized.current || chains.length === 0) {
      return;
    }

    const initializeDefaults = () => {
      // SOURCE: Find Ethereum chain (chain ID 1)
      const ethereumChain = chains.find(c => c.id === 1 || (c.name.toLowerCase() === 'ethereum' && c.chainType === 'EVM'));
      if (ethereumChain) {
        const ethereumBalance = balances.find(b => b.chainId === ethereumChain.id);
        
        const usdcToken: SearchableToken = {
          symbol: 'USDC',
          name: 'USD Coin',
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: ethereumChain.id,
          decimals: 6,
          logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
        };

        if (ethereumBalance) {
          setSelectedChain(ethereumBalance);
        } else {
          setSelectedChain({
            chainId: ethereumChain.id,
            chainName: ethereumChain.name,
            balance: '0',
            formattedBalance: '0',
            symbol: 'USDC',
            tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chain: ethereumChain,
          });
        }
        
        setSelectedToken(usdcToken);
      }

      // DESTINATION: Find HyperEVM chain (or Hyperliquid)
      const hyperevmChain = chains.find(c => 
        c.name.toLowerCase().includes('hyperevm') || 
        c.name.toLowerCase().includes('hyper evm') ||
        c.name.toLowerCase().includes('hyperliquid') ||
        c.id === 999 // HyperEVM chain ID
      );
      if (hyperevmChain) {
        setDestChain(hyperevmChain);
        
        // Set USDC as default destination token
        const usdcToken: SearchableToken = {
          symbol: 'USDC',
          name: 'USD Coin',
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Placeholder, will be chain-specific
          chainId: hyperevmChain.id,
          decimals: 6,
          logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
        };
        
        setDestToken(usdcToken);
      }

      defaultsInitialized.current = true;
    };

    initializeDefaults();
  }, [chains]); // Only depend on chains, not balances - balances change shouldn't reset selections

  // Fetch balance when token or chain changes, or when refresh is triggered
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (!selectedToken || !selectedChain?.chain) return;

      setIsLoadingBalance(true);
      try {
        // If balanceRefreshTrigger > 0, always fetch fresh from wallet
        // This ensures we get updated balance after a transaction
        const shouldFetchFresh = balanceRefreshTrigger > 0;
        
        if (!shouldFetchFresh) {
          // Check if we have this balance in the balances array (for pre-loaded tokens)
          const existingBalance = balances.find(
            b => b.chainId === selectedChain.chainId && 
            b.tokenAddress?.toLowerCase() === selectedToken.address?.toLowerCase()
          );

          if (existingBalance) {
            setTokenBalance(existingBalance.formattedBalance);
            setIsLoadingBalance(false);
            return;
          }
        }
        
        // Fetch balance directly from wallet
        const { WalletManager } = await import('../wallet');
        const walletManager = new WalletManager();
        
        const tokenInfo = {
          address: selectedToken.address,
          symbol: selectedToken.symbol,
          decimals: selectedToken.decimals,
          chainId: selectedToken.chainId,
          name: selectedToken.name,
          logoURI: selectedToken.logoURI,
        };
        
        const balance = await walletManager.getTokenBalance(
          walletAddress,
          tokenInfo,
          selectedChain.chain.name
        );
        
        console.log(`💰 Fetched fresh balance for ${selectedToken.symbol}: ${balance.formattedBalance}`);
        setTokenBalance(balance.formattedBalance);
      } catch (error) {
        console.error('Failed to fetch token balance:', error);
        setTokenBalance('0');
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchTokenBalance();
  }, [selectedToken, selectedChain, balances, walletAddress, balanceRefreshTrigger]);

  // Fetch quote when amount, source, or destination changes (debounced)
  useEffect(() => {
    // Clear any existing timer
    if (quoteDebounceTimer.current) {
      clearTimeout(quoteDebounceTimer.current);
    }

    // Reset quote if missing required data
    if (!selectedChain || !selectedToken || !destChain || !destToken || !amount || parseFloat(amount) <= 0) {
      setQuote({
        receiveAmount: '0',
        receiveAmountFormatted: '0.00',
        estimatedTime: 0,
        estimatedSeconds: 0,
        fromAmountUSD: null,
        toAmountUSD: null,
        costUSD: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    // Set loading state immediately
    setQuote(prev => ({ ...prev, isLoading: true, error: null }));

    // Debounce the quote fetch (500ms delay)
    quoteDebounceTimer.current = setTimeout(async () => {
      try {
        // Convert amount to smallest unit using string manipulation to avoid floating point errors
        const [intPart, decPart = ''] = amount.split('.');
        const paddedDecimal = decPart.padEnd(selectedToken.decimals, '0').slice(0, selectedToken.decimals);
        const amountInSmallestUnit = (intPart + paddedDecimal).replace(/^0+/, '') || '0';
        
        // Fetch quote and token prices in parallel
        const [quoteResult, fromTokenPrice, toTokenPrice] = await Promise.all([
          bridgeService.current.getBridgeRouteWithTokens(
            selectedChain.chainId,
            destChain.id,
            selectedToken.address,
            destToken.address,
            amountInSmallestUnit,
            walletAddress
          ),
          bridgeService.current.getTokenPrice(selectedChain.chainId, selectedToken.address),
          bridgeService.current.getTokenPrice(destChain.id, destToken.address),
        ]);

        console.log('📊 QUOTE RESPONSE:', {
          route: {
            fromChain: selectedChain.chainName,
            toChain: destChain.name,
            fromToken: selectedToken.symbol,
            toToken: destToken.symbol,
            fromAmount: amount,
          },
          estimate: {
            toAmount: quoteResult.estimate.toAmount,
            toAmountHumanReadable: parseInt(quoteResult.estimate.toAmount) / Math.pow(10, destToken.decimals),
            executionDuration: quoteResult.estimate.executionDuration,
            executionDurationMinutes: Math.ceil(quoteResult.estimate.executionDuration / 60),
            gasCosts: quoteResult.estimate.gasCosts,
            feeCosts: quoteResult.estimate.feeCosts,
          },
          prices: {
            fromTokenPrice,
            toTokenPrice,
          },
          fullQuoteObject: quoteResult,
        });

        const receiveAmountRaw = parseInt(quoteResult.estimate.toAmount) / Math.pow(10, destToken.decimals);
        // Handle ETA: 0 = immediate, < 60 = show seconds, >= 60 = show minutes
        const estimatedSeconds = quoteResult.estimate.executionDuration || 0;
        const estimatedMinutes = estimatedSeconds >= 60 ? Math.ceil(estimatedSeconds / 60) : 0;

        // Calculate USD values
        const fromAmountUSD = fromTokenPrice ? parseFloat(amount) * fromTokenPrice : null;
        const toAmountUSD = toTokenPrice ? receiveAmountRaw * toTokenPrice : null;
        // Positive = gain (receiving more), Negative = loss (receiving less)
        const costUSD = fromAmountUSD && toAmountUSD ? toAmountUSD - fromAmountUSD : null;

        console.log('💰 USD CALCULATIONS:', {
          fromAmountUSD: fromAmountUSD?.toFixed(2),
          toAmountUSD: toAmountUSD?.toFixed(2),
          costUSD: costUSD?.toFixed(2),
          interpretation: costUSD && costUSD > 0 ? 'GAIN' : costUSD && costUSD < 0 ? 'LOSS' : 'NEUTRAL',
          estimatedSeconds,
          estimatedMinutes,
          note: estimatedSeconds < 60 ? 'ETA less than 1 minute' : null,
        });

        setQuote({
          receiveAmount: quoteResult.estimate.toAmount,
          receiveAmountFormatted: receiveAmountRaw.toFixed(destToken.decimals > 6 ? 6 : destToken.decimals),
          estimatedTime: estimatedMinutes,
          estimatedSeconds,
          fromAmountUSD,
          toAmountUSD,
          costUSD,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error('Failed to fetch quote:', error);
        setQuote({
          receiveAmount: '0',
          receiveAmountFormatted: '0.00',
          estimatedTime: 0,
          estimatedSeconds: 0,
          fromAmountUSD: null,
          toAmountUSD: null,
          costUSD: null,
          isLoading: false,
          error: 'Failed to get quote',
        });
      }
    }, 500);

    // Cleanup on unmount or dependency change
    return () => {
      if (quoteDebounceTimer.current) {
        clearTimeout(quoteDebounceTimer.current);
      }
    };
  }, [amount, selectedChain, selectedToken, destChain, destToken, walletAddress]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(4, 6, 12, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(10px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
    >
      {/* Modal Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          background: `linear-gradient(180deg, ${COLORS.ebony} 0%, ${COLORS.firefly}40 100%)`,
          borderRadius: '24px',
          border: `3px solid ${COLORS.aquamarine}30`,
          overflow: 'hidden',
          boxShadow: `0 0 60px ${COLORS.aquamarine}20, 0 25px 50px rgba(0,0,0,0.5)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Background Orbs */}
        <FloatingOrbs />

        {/* Content Layer */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 28px 20px',
            borderBottom: `3px solid ${COLORS.aquamarine}15`,
          }}>
            <h2 style={{
              margin: 0,
              color: COLORS.foam,
              fontSize: '1.4rem',
              fontWeight: '600',
              letterSpacing: '-0.02em',
            }}>
              Bridge <span style={{ color: COLORS.aquamarine }}>&</span> Swap
            </h2>
            <button
              onClick={handleSafeClose}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: `3px solid ${COLORS.aquamarine}30`,
                background: 'transparent',
                color: COLORS.foam,
                fontSize: '18px',
                cursor: isTransactionActive ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                opacity: isTransactionActive ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isTransactionActive) {
                  e.currentTarget.style.background = COLORS.aquamarine + '20';
                  e.currentTarget.style.borderColor = COLORS.aquamarine;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = COLORS.aquamarine + '30';
              }}
            >
              ✕
            </button>
          </div>

          {/* Floating Error Toast - Above Modal */}
          {errorMessage && (
            <div style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10000,
              maxWidth: '420px',
              width: 'calc(100% - 40px)',
              padding: '16px 20px',
              background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.95) 0%, rgba(185, 28, 28, 0.95) 100%)',
              backdropFilter: 'blur(12px)',
              borderRadius: '16px',
              border: '3px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(220, 38, 38, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              animation: 'slideInFromTop 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <style>{`
                @keyframes slideInFromTop {
                  from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                  }
                }
              `}</style>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div style={{ flex: 1, color: '#fff' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', letterSpacing: '-0.01em' }}>
                  Transaction Error
                </div>
                <div style={{ fontSize: '13px', opacity: 0.95, lineHeight: '1.4' }}>
                  {errorMessage}
                </div>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )}

          {/* Body - Show status page or main form */}
          {showStatusPage && transactionProgress ? (
            <TransactionStatusPage
              progress={transactionProgress}
              onClose={onClose}
              onBack={() => {
                // If transaction was successful, trigger balance refresh
                if (transactionProgress.overallStatus === 'completed') {
                  setBalanceRefreshTrigger(prev => prev + 1);
                  // Also clear the amount since it was used
                  setAmount('');
                }
                setShowStatusPage(false);
                setTransactionProgress(null);
              }}
            />
          ) : (
          <div style={{ padding: '24px 28px 28px' }}>
            {/* Source Token Input Card */}
            <div style={{
              background: `linear-gradient(135deg, ${COLORS.firefly}80 0%, ${COLORS.ebony}90 100%)`,
              borderRadius: '20px',
              padding: '20px',
              border: `3px solid ${COLORS.aquamarine}20`,
              marginBottom: '20px',
            }}>
              <div style={{ fontSize: '12px', color: COLORS.aquamarine + '80', marginBottom: '12px', fontWeight: '600' }}>
                FROM
              </div>
              
              {/* Token Selector Button */}
              <button
                onClick={() => setShowChainTokenSelector(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px 10px 10px',
                  background: `linear-gradient(135deg, ${COLORS.aquamarine}20 0%, ${COLORS.firefly} 100%)`,
                  border: `3px solid ${COLORS.aquamarine}40`,
                  borderRadius: '50px',
                  cursor: 'pointer',
                  marginBottom: '20px',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = COLORS.aquamarine;
                  e.currentTarget.style.boxShadow = `0 0 20px ${COLORS.aquamarine}30`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = COLORS.aquamarine + '40';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Token Logo with Chain Badge */}
                <div style={{ position: 'relative', width: '38px', height: '38px' }}>
                  {selectedToken?.logoURI ? (
                    <img
                      src={selectedToken.logoURI}
                      alt={selectedToken.symbol}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        border: `3px solid ${COLORS.aquamarine}50`,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${COLORS.aquamarine}30 0%, ${COLORS.firefly} 100%)`,
                      border: `3px solid ${COLORS.aquamarine}50`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: COLORS.aquamarine,
                      fontSize: '16px',
                      fontWeight: 'bold',
                    }}>
                      {selectedToken?.symbol?.[0] || '?'}
                    </div>
                  )}
                  
                  {/* Chain Badge */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-4px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: COLORS.ebony,
                    border: `3px solid ${COLORS.firefly}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {selectedChain?.chain?.logoURI ? (
                      <img
                        src={selectedChain.chain.logoURI}
                        alt={selectedChain.chainName}
                        style={{ width: '14px', height: '14px', borderRadius: '50%' }}
                      />
                    ) : (
                      <span style={{ fontSize: '8px', fontWeight: 'bold', color: COLORS.aquamarine }}>
                        {selectedChain?.chainName?.[0] || '?'}
                      </span>
                    )}
                  </div>
                </div>

                <span style={{
                  color: COLORS.foam,
                  fontSize: '17px',
                  fontWeight: '600',
                }}>
                  {selectedToken?.symbol || 'Select Token'}
                </span>

                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto' }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke={COLORS.aquamarine} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Amount Input */}
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  fontSize: '42px',
                  fontWeight: '300',
                  border: 'none',
                  background: 'transparent',
                  color: COLORS.foam,
                  outline: 'none',
                  fontFamily: 'inherit',
                  letterSpacing: '-0.02em',
                  MozAppearance: 'textfield', // Firefox
                }}
                onWheel={(e) => e.currentTarget.blur()} // Prevent scroll wheel changes
              />
              <style>{`
                input[type="number"]::-webkit-inner-spin-button,
                input[type="number"]::-webkit-outer-spin-button {
                  -webkit-appearance: none;
                  margin: 0;
                }
              `}</style>

              {/* USD Value & Balance */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px',
              }}>
                <span style={{ color: COLORS.aquamarine + '80', fontSize: '14px' }}>
                  ≈ ${quote.fromAmountUSD !== null ? quote.fromAmountUSD.toFixed(2) : 
                      (selectedToken?.priceUSD ? (parseFloat(amount || '0') * parseFloat(selectedToken.priceUSD)).toFixed(2) : '0.00')}
                </span>
                <button
                  onClick={() => setAmount(tokenBalance)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: COLORS.aquamarine,
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = COLORS.aquamarine + '20'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  Balance: {isLoadingBalance ? '...' : tokenBalance} <span style={{ opacity: 0.7 }}>MAX</span>
                </button>
              </div>
            </div>

            {/* Swap Arrow - Click to swap source and destination */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '16px 0',
            }}>
              <button
                onClick={(e) => {
                  // Only swap if both source and destination are selected
                  if (selectedToken && destToken && selectedChain && destChain) {
                    // Rotate the button on click
                    const btn = e.currentTarget;
                    const currentRotation = btn.dataset.rotation === '180' ? 0 : 180;
                    btn.dataset.rotation = currentRotation.toString();
                    btn.style.transform = `rotate(${currentRotation}deg)`;
                    
                    // Store current values
                    const prevSourceChain = selectedChain;
                    const prevSourceToken = selectedToken;
                    const prevDestChain = destChain;
                    const prevDestToken = destToken;
                    
                    // Swap source with destination
                    // Set new source (previous destination)
                    setSelectedChain({
                      chainId: prevDestChain.id,
                      chainName: prevDestChain.name,
                      balance: '0',
                      formattedBalance: '0',
                      symbol: prevDestToken.symbol,
                      tokenAddress: prevDestToken.address,
                      chain: prevDestChain,
                    });
                    setSelectedToken(prevDestToken);
                    
                    // Set new destination (previous source)
                    setDestChain(prevSourceChain.chain || chains.find(c => c.id === prevSourceChain.chainId) || null);
                    setDestToken(prevSourceToken);
                    
                    // Clear amount and trigger balance refresh for new source token
                    setAmount('');
                    setBalanceRefreshTrigger(prev => prev + 1);
                    
                    console.log(`🔄 Swapped: ${prevSourceToken.symbol} on ${prevSourceChain.chainName} ↔ ${prevDestToken.symbol} on ${prevDestChain.name}`);
                  }
                }}
                disabled={!selectedToken || !destToken}
                data-rotation="0"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: COLORS.firefly,
                  border: `3px solid ${COLORS.aquamarine}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.aquamarine,
                  fontSize: '18px',
                  cursor: selectedToken && destToken ? 'pointer' : 'not-allowed',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: selectedToken && destToken ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (selectedToken && destToken) {
                    e.currentTarget.style.background = COLORS.aquamarine + '30';
                    e.currentTarget.style.borderColor = COLORS.aquamarine;
                    e.currentTarget.style.boxShadow = `0 0 15px ${COLORS.aquamarine}40`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = COLORS.firefly;
                  e.currentTarget.style.borderColor = COLORS.aquamarine + '30';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                title="Swap source and destination"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 16V4M7 4L3 8M7 4L11 8"/>
                  <path d="M17 8V20M17 20L21 16M17 20L13 16"/>
                </svg>
              </button>
            </div>

            {/* Destination Token Card */}
            <div style={{
              background: `linear-gradient(135deg, ${COLORS.firefly}80 0%, ${COLORS.ebony}90 100%)`,
              borderRadius: '20px',
              padding: '20px',
              border: `3px solid ${COLORS.aquamarine}20`,
              marginBottom: '20px',
            }}>
              <div style={{ fontSize: '12px', color: COLORS.aquamarine + '80', marginBottom: '12px', fontWeight: '600' }}>
                TO
              </div>
              
              {/* Destination Token Selector Button */}
              <button
                onClick={() => {
                  setSelectorMode('destination');
                  setShowDestSelector(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px 10px 10px',
                  background: `linear-gradient(135deg, ${COLORS.aquamarine}20 0%, ${COLORS.firefly} 100%)`,
                  border: `3px solid ${COLORS.aquamarine}40`,
                  borderRadius: '50px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = COLORS.aquamarine;
                  e.currentTarget.style.boxShadow = `0 0 20px ${COLORS.aquamarine}30`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = COLORS.aquamarine + '40';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Token Logo with Chain Badge */}
                <div style={{ position: 'relative', width: '38px', height: '38px' }}>
                  {destToken?.logoURI ? (
                    <img
                      src={destToken.logoURI}
                      alt={destToken.symbol}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        border: `3px solid ${COLORS.aquamarine}50`,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${COLORS.aquamarine}30 0%, ${COLORS.firefly} 100%)`,
                      border: `3px solid ${COLORS.aquamarine}50`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: COLORS.aquamarine,
                      fontSize: '16px',
                      fontWeight: 'bold',
                    }}>
                      {destToken?.symbol?.[0] || '?'}
                    </div>
                  )}
                  
                  {/* Chain Badge */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-4px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: COLORS.ebony,
                    border: `3px solid ${COLORS.firefly}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {destChain?.logoURI ? (
                      <img
                        src={destChain.logoURI}
                        alt={destChain.name}
                        style={{ width: '14px', height: '14px', borderRadius: '50%' }}
                      />
                    ) : (
                      <span style={{ fontSize: '8px', fontWeight: 'bold', color: COLORS.aquamarine }}>
                        {destChain?.name?.[0] || '?'}
                      </span>
                    )}
                  </div>
                </div>

                <span style={{
                  color: COLORS.foam,
                  fontSize: '17px',
                  fontWeight: '600',
                }}>
                  {destToken?.symbol || 'Select Token'}
                </span>

                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto' }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke={COLORS.aquamarine} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Estimated Receive Amount */}
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: COLORS.ebony + '40',
                borderRadius: '12px',
                border: `3px solid ${COLORS.aquamarine}15`,
              }}>
                <div style={{ fontSize: '12px', color: COLORS.aquamarine + '60', marginBottom: '4px' }}>
                  You'll receive (estimated)
                </div>
                <div style={{ 
                  fontSize: '24px', 
                  color: quote.error ? '#ff6b6b' : COLORS.foam, 
                  fontWeight: '300',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  {quote.isLoading ? (
                    <span style={{ color: COLORS.aquamarine + '80' }}>Loading...</span>
                  ) : quote.error ? (
                    <span style={{ fontSize: '14px' }}>{quote.error}</span>
                  ) : (
                    <>~{quote.receiveAmountFormatted} {destToken?.symbol || ''}</>
                  )}
                </div>
                
                {/* USD Value for destination */}
                {quote.toAmountUSD !== null && !quote.isLoading && !quote.error && (
                  <div style={{ 
                    marginTop: '6px',
                    fontSize: '14px',
                    color: COLORS.aquamarine + '80',
                  }}>
                    ≈ ${quote.toAmountUSD.toFixed(2)}
                  </div>
                )}
                
                {/* Estimated Time & Cost */}
                {!quote.isLoading && !quote.error && (quote.estimatedSeconds >= 0 || (quote.costUSD !== null && Math.abs(quote.costUSD) > 0.01)) && (
                  <div style={{ 
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: `3px solid ${COLORS.aquamarine}10`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: COLORS.aquamarine + '80',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                      <span>
                        {quote.estimatedSeconds === 0 
                          ? 'Immediate' 
                          : quote.estimatedSeconds < 60 
                            ? `~${quote.estimatedSeconds}s` 
                            : `~${quote.estimatedTime} min`}
                      </span>
                    </div>
                    {quote.costUSD !== null && Math.abs(quote.costUSD) > 0.01 && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        color: quote.costUSD > 0 ? '#4ade80' : '#ff6b6b', // Green for gain, red for loss
                        marginLeft: 'auto',
                      }}>
                        <span>{quote.costUSD > 0 ? '+' : ''}${quote.costUSD.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bridge Button */}
            <button
              onClick={async () => {
                if (selectedChain && selectedToken && destChain && destToken && amount) {
                  // Validate balance
                  const amountNum = parseFloat(amount);
                  const balanceNum = parseFloat(tokenBalance);
                  
                  if (amountNum > balanceNum) {
                    setErrorMessage(`Insufficient ${selectedToken.symbol} balance. You have ${tokenBalance} but trying to bridge ${amount}.`);
                    setTimeout(() => setErrorMessage(null), 5000); // Auto-dismiss after 5s
                    return;
                  }
                  
                  // Clear any previous errors
                  setErrorMessage(null);
                  
                  const params = {
                    fromChainId: selectedChain.chainId,
                    toChainId: destChain.id,
                    fromToken: selectedToken,
                    toToken: destToken,
                    amount: amount,
                  };
                  
                  // If detailed progress callback is provided, show status page
                  if (onBridgeWithProgress) {
                    // Set ref immediately (synchronous) to prevent race conditions
                    isTransactionActiveRef.current = true;
                    setShowStatusPage(true);
                    setIsTransactionActive(true);
                    try {
                      await onBridgeWithProgress(params, (progress) => {
                        setTransactionProgress(progress);
                        // Allow closing once transaction is completed or failed
                        if (progress.overallStatus === 'completed' || progress.overallStatus === 'failed') {
                          isTransactionActiveRef.current = false;
                          setIsTransactionActive(false);
                        }
                      });
                    } catch (error) {
                      // Error is handled in the progress callback
                      isTransactionActiveRef.current = false;
                      setIsTransactionActive(false);
                    }
                  } else {
                    // Fallback to simple bridge
                    onBridge(params);
                  }
                }
              }}
              disabled={!selectedChain || !selectedToken || !destChain || !destToken || !amount || parseFloat(amount) <= 0}
              style={{
                width: '100%',
                padding: '18px',
                fontSize: '18px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '16px',
                cursor: selectedChain && amount && parseFloat(amount) > 0 ? 'pointer' : 'not-allowed',
                background: selectedChain && amount && parseFloat(amount) > 0
                  ? `linear-gradient(135deg, ${COLORS.aquamarine} 0%, ${COLORS.firefly} 150%)`
                  : COLORS.firefly + '60',
                color: selectedChain && amount && parseFloat(amount) > 0 ? COLORS.ebony : COLORS.foam + '50',
                transition: 'all 0.3s ease',
                boxShadow: selectedChain && amount && parseFloat(amount) > 0
                  ? `0 4px 20px ${COLORS.aquamarine}40`
                  : 'none',
              }}
              onMouseEnter={(e) => {
                if (selectedChain && amount && parseFloat(amount) > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `0 8px 30px ${COLORS.aquamarine}50`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                if (selectedChain && amount && parseFloat(amount) > 0) {
                  e.currentTarget.style.boxShadow = `0 4px 20px ${COLORS.aquamarine}40`;
                }
              }}
            >
              {!selectedChain ? 'Select Token' : !amount || parseFloat(amount) <= 0 ? 'Enter Amount' : 'Bridge'}
            </button>
          </div>
          )}
        </div>

        {/* Source Chain + Token Selector Modal */}
        {showChainTokenSelector && (
          <ChainTokenSelector
            chains={chains}
            initialChainId={selectedChain?.chainId || 1} // Default to Ethereum
            onSelect={(chain, token) => {
              const chainBalance = balances.find(b => b.chainId === chain.id);
              if (chainBalance) {
                setSelectedChain(chainBalance);
              } else {
                setSelectedChain({
                  chainId: chain.id,
                  chainName: chain.name,
                  balance: '0',
                  formattedBalance: '0',
                  symbol: token.symbol,
                  tokenAddress: token.address,
                  chain: chain,
                });
              }
              setSelectedToken(token);
              setShowChainTokenSelector(false);
            }}
            onClose={() => setShowChainTokenSelector(false)}
          />
        )}

        {/* Destination Chain + Token Selector Modal */}
        {showDestSelector && (
          <ChainTokenSelector
            chains={chains}
            initialChainId={destChain?.id} // Use currently selected dest chain
            onSelect={(chain, token) => {
              setDestChain(chain);
              setDestToken(token);
              setShowDestSelector(false);
            }}
            onClose={() => setShowDestSelector(false)}
          />
        )}
      </div>
    </div>
  );
};
