import React, { useState, useEffect, useCallback } from 'react';
import { DepositModal } from './components/DepositModal';
import { LiFiBridgeService, setWalletProvider } from './bridge';
import type { ChainInfo } from '../types/index';

// Hyperliquid brand colors
const COLORS = {
  aquamarine: '#97FCE4',
  firefly: '#0F3933',
  ebony: '#04060C',
  foam: '#F5FEFD',
};

export interface HyperliquidDepositProps {
  /**
   * Wallet address to deposit from
   */
  walletAddress: string;
  
  /**
   * Optional: Custom chains to support. If not provided, uses LI.FI supported chains.
   */
  chains?: ChainInfo[];
  
  /**
   * Optional: Callback when deposit is completed
   */
  onDepositComplete?: (txHash: string, amountUSDC: number) => void;
  
  /**
   * Optional: Callback when deposit fails
   */
  onDepositError?: (error: string) => void;
  
  /**
   * Optional: Custom button render function. If not provided, uses default button.
   */
  renderButton?: (props: { onClick: () => void; disabled: boolean }) => React.ReactNode;
  
  /**
   * Optional: Button text (only used with default button)
   */
  buttonText?: string;
  
  /**
   * Optional: Custom styles for the button (only used with default button)
   */
  buttonStyle?: React.CSSProperties;
  
  /**
   * Optional: Custom class name for the button (only used with default button)
   */
  buttonClassName?: string;
  
  /**
   * Optional: Disable the button
   */
  disabled?: boolean;
  
  /**
   * Optional: Custom modal styles
   */
  modalStyles?: {
    modal?: React.CSSProperties;
    overlay?: React.CSSProperties;
  };
  
  /**
   * Optional: External wallet provider (e.g., from WalletConnect)
   * Required for environments without window.ethereum (like Telegram mini apps)
   */
  walletProvider?: any;
}

/**
 * HyperliquidDeposit - A one-click deposit button for HyperLiquid
 * 
 * This component provides a button that opens a modal to deposit funds
 * from any supported chain to your HyperLiquid trading account.
 * 
 * @example
 * ```tsx
 * import { HyperliquidDeposit } from '@aspect-build/hyperliquid-deposit';
 * 
 * function App() {
 *   return (
 *     <HyperliquidDeposit
 *       walletAddress="0x..."
 *       onDepositComplete={(txHash, amount) => {
 *         console.log(`Deposited $${amount} USDC. Tx: ${txHash}`);
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export const HyperliquidDeposit: React.FC<HyperliquidDepositProps> = ({
  walletAddress,
  chains: customChains,
  onDepositComplete,
  onDepositError,
  renderButton,
  buttonText = 'Deposit to HyperLiquid',
  buttonStyle,
  buttonClassName,
  disabled = false,
  modalStyles,
  walletProvider,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [chains, setChains] = useState<ChainInfo[]>(customChains || []);
  const [isLoading, setIsLoading] = useState(!customChains);

  // Set external wallet provider if provided
  useEffect(() => {
    if (walletProvider) {
      setWalletProvider(walletProvider);
    }
  }, [walletProvider]);

  // Fetch chains if not provided
  useEffect(() => {
    if (customChains) {
      setChains(customChains);
      setIsLoading(false);
      return;
    }

    const fetchChains = async () => {
      try {
        const bridgeService = new LiFiBridgeService();
        const fetchedChains = await bridgeService.getAllChains();
        setChains(fetchedChains);
      } catch (error) {
        console.error('Failed to fetch chains:', error);
        // Use empty array, modal will show error
        setChains([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChains();
  }, [customChains]);

  const handleOpen = useCallback(() => {
    if (!disabled && !isLoading && walletAddress) {
      // Ensure provider is set before opening
      if (walletProvider) {
        setWalletProvider(walletProvider);
      }
      setIsOpen(true);
    }
  }, [disabled, isLoading, walletAddress, walletProvider]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Default button styles
  const defaultButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '12px',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    background: disabled || isLoading
      ? '#333'
      : `linear-gradient(135deg, ${COLORS.aquamarine} 0%, ${COLORS.firefly} 150%)`,
    color: disabled || isLoading ? '#666' : COLORS.ebony,
    transition: 'all 0.3s ease',
    boxShadow: disabled || isLoading ? 'none' : `0 4px 20px ${COLORS.aquamarine}40`,
    opacity: disabled || isLoading ? 0.6 : 1,
    ...buttonStyle,
  };

  // Render custom button if provided
  if (renderButton) {
    return (
      <>
        {renderButton({ onClick: handleOpen, disabled: disabled || isLoading })}
        {isOpen && (
          <DepositModal
            chains={chains}
            walletAddress={walletAddress}
            onClose={handleClose}
            styles={modalStyles}
          />
        )}
      </>
    );
  }

  // Render default button
  return (
    <>
      <button
        onClick={handleOpen}
        disabled={disabled || isLoading}
        className={buttonClassName}
        style={defaultButtonStyle}
        onMouseEnter={(e) => {
          if (!disabled && !isLoading) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 8px 30px ${COLORS.aquamarine}50`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          if (!disabled && !isLoading) {
            e.currentTarget.style.boxShadow = `0 4px 20px ${COLORS.aquamarine}40`;
          }
        }}
      >
        {/* HyperLiquid-style icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2L2 7L12 12L22 7L12 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 17L12 22L22 17"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 12L12 17L22 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {isLoading ? 'Loading...' : buttonText}
      </button>

      {isOpen && (
        <DepositModal
          chains={chains}
          walletAddress={walletAddress}
          onClose={handleClose}
          styles={modalStyles}
        />
      )}
    </>
  );
};

/**
 * useHyperliquidDeposit - Hook for programmatic control
 * 
 * @example
 * ```tsx
 * const { openDeposit, DepositModal } = useHyperliquidDeposit({
 *   walletAddress: '0x...',
 * });
 * 
 * return (
 *   <>
 *     <button onClick={openDeposit}>Custom Button</button>
 *     <DepositModal />
 *   </>
 * );
 * ```
 */
export const useHyperliquidDeposit = (props: Omit<HyperliquidDepositProps, 'renderButton' | 'buttonText' | 'buttonStyle' | 'buttonClassName'>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [chains, setChains] = useState<ChainInfo[]>(props.chains || []);

  useEffect(() => {
    if (props.chains) {
      setChains(props.chains);
      return;
    }

    const fetchChains = async () => {
      try {
        const bridgeService = new LiFiBridgeService();
        const fetchedChains = await bridgeService.getAllChains();
        setChains(fetchedChains);
      } catch (error) {
        console.error('Failed to fetch chains:', error);
      }
    };

    fetchChains();
  }, [props.chains]);

  const openDeposit = useCallback(() => {
    if (!props.disabled && props.walletAddress) {
      setIsOpen(true);
    }
  }, [props.disabled, props.walletAddress]);

  const closeDeposit = useCallback(() => {
    setIsOpen(false);
  }, []);

  const DepositModalComponent = useCallback(() => {
    if (!isOpen) return null;
    
    return (
      <DepositModal
        chains={chains}
        walletAddress={props.walletAddress}
        onClose={closeDeposit}
        styles={props.modalStyles}
      />
    );
  }, [isOpen, chains, props.walletAddress, props.modalStyles, closeDeposit]);

  return {
    isOpen,
    openDeposit,
    closeDeposit,
    DepositModal: DepositModalComponent,
  };
};

export default HyperliquidDeposit;
