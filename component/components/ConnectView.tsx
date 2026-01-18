import React from 'react';
import { defaultStyles, BridgeWidgetStyles } from '../styles/defaultStyles';

interface ConnectViewProps {
  targetChainName: string;
  onConnect: () => void;
  styles?: BridgeWidgetStyles;
}

export const ConnectView: React.FC<ConnectViewProps> = ({
  targetChainName,
  onConnect,
  styles = {},
}) => {
  const mergedStyles = {
    container: { ...defaultStyles.container, ...styles.container },
    infoBox: { ...defaultStyles.infoBox, ...styles.infoBox },
    connectButton: { ...defaultStyles.connectButton, ...styles.connectButton },
  };

  return (
    <div style={mergedStyles.container}>
      <div style={mergedStyles.infoBox}>
        <strong style={{ display: 'block', marginBottom: '8px', fontSize: '1rem' }}>
          👋 Welcome to HyprEVM Bridge
        </strong>
        <p style={{ margin: 0 }}>
          Connect your wallet to start bridging USDC to {targetChainName}
        </p>
      </div>
      <button
        style={mergedStyles.connectButton}
        onClick={onConnect}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        Connect Wallet
      </button>
    </div>
  );
};
