import React from 'react';
import { defaultStyles, BridgeWidgetStyles } from '../styles/defaultStyles';

interface BridgeButtonProps {
  address: string;
  targetChainName: string;
  onOpenModal: () => void;
  styles?: BridgeWidgetStyles;
}

export const BridgeButton: React.FC<BridgeButtonProps> = ({
  address,
  targetChainName,
  onOpenModal,
  styles = {},
}) => {
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const mergedStyles = {
    container: { ...defaultStyles.container, ...styles.container },
    walletInfo: { ...defaultStyles.walletInfo, ...styles.walletInfo },
    bridgeButton: { ...defaultStyles.bridgeButton, ...styles.bridgeButton },
  };

  return (
    <div style={mergedStyles.container}>
      <div style={mergedStyles.walletInfo}>
        Connected:{' '}
        <span
          style={{
            color: '#667eea',
            fontWeight: 600,
            fontFamily: 'monospace',
          }}
        >
          {shortAddress}
        </span>
      </div>
      <button
        style={mergedStyles.bridgeButton}
        onClick={onOpenModal}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 20px rgba(245, 87, 108, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        🌉 Bridge to {targetChainName}
      </button>
    </div>
  );
};
