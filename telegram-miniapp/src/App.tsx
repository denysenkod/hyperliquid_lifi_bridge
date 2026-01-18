import { useEffect, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect, useConnectorClient } from 'wagmi';
import { HyperliquidDeposit } from 'hyperliquid-deposit';

function App() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: connectorClient } = useConnectorClient();
  
  // Get the provider from the connected wallet (WalletConnect)
  const walletProvider = useMemo(() => {
    if (connectorClient?.transport) {
      // The transport contains the provider
      return (connectorClient.transport as any)?.value;
    }
    // Fallback: try to get provider from connector
    if (connector && (connector as any).getProvider) {
      return (connector as any).getProvider();
    }
    return null;
  }, [connectorClient, connector]);

  // Initialize Telegram WebApp
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      // Set theme
      document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams?.bg_color || '#0a0a0a');
      document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams?.text_color || '#ffffff');
    }
  }, []);

  const handleConnect = () => {
    // Prefer WalletConnect for mobile
    const walletConnectConnector = connectors.find(c => c.id === 'walletConnect');
    const injectedConnector = connectors.find(c => c.id === 'injected');
    
    if (walletConnectConnector) {
      connect({ connector: walletConnectConnector });
    } else if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  return (
    <div className="app">
      {/* Background gradient */}
      <div className="background-gradient" />
      
      {/* Main content */}
      <div className="container">
        {/* Logo */}
        <div className="logo-container">
          <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" stroke="#97FCE4" strokeWidth="3" fill="none" />
            <path
              d="M30 50L45 65L70 35"
              stroke="#97FCE4"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="title">HyperLiquid</h1>
        <p className="subtitle">Deposit from any chain</p>

        {/* Main action area */}
        <div className="action-area">
          {!isConnected ? (
            <>
              <button className="connect-button" onClick={handleConnect}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
                  <circle cx="16" cy="12" r="2" fill="currentColor" />
                </svg>
                Connect Wallet
              </button>
              <p className="hint">Connect your wallet to deposit funds</p>
            </>
          ) : (
            <>
              <div className="wallet-info">
                <span className="wallet-label">Connected</span>
                <span className="wallet-address">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <button className="disconnect-btn" onClick={() => disconnect()}>
                  ✕
                </button>
              </div>

              <HyperliquidDeposit
                walletAddress={address!}
                walletProvider={walletProvider}
                buttonText="Deposit to HyperLiquid"
                buttonStyle={{
                  width: '100%',
                  padding: '20px 32px',
                  fontSize: '18px',
                  fontWeight: '700',
                  borderRadius: '16px',
                }}
                onDepositComplete={(txHash, amount) => {
                  const tg = (window as any).Telegram?.WebApp;
                  if (tg) {
                    tg.showAlert(`Successfully deposited $${amount.toFixed(2)} USDC!\n\nTransaction: ${txHash.slice(0, 10)}...`);
                  } else {
                    alert(`Deposited $${amount.toFixed(2)} USDC!`);
                  }
                }}
                onDepositError={(error) => {
                  const tg = (window as any).Telegram?.WebApp;
                  if (tg) {
                    tg.showAlert(`Deposit failed: ${error}`);
                  } else {
                    alert(`Error: ${error}`);
                  }
                }}
              />
              
              <p className="hint">
                Bridge any token to your HyperLiquid trading account
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="footer">
          <span>Powered by</span>
          <strong>LI.FI</strong>
        </div>
      </div>
    </div>
  );
}

export default App;
