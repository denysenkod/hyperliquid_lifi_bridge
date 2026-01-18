import React from 'react';
import { HyprBridgeWidget } from '../../component/index';

// Example custom styles (optional)
const customStyles = {
  container: {
    background: 'white',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.25)',
  },
  connectButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '18px 28px',
    fontSize: '1.15rem',
  },
  bridgeButton: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    padding: '18px 28px',
    fontSize: '1.15rem',
  },
};

function App() {
  return (
    <div className="app-container">
      <div className="app-header">
        <h1>🌉 HyprEVM Bridge</h1>
        <p>Bridge your tokens to HyprEVM with ease</p>
      </div>

      <div className="widget-wrapper">
        <HyprBridgeWidget styles={customStyles} />
      </div>

      <div className="info-section">
        <h3>About this Widget</h3>
        <p>
          This is a portable React component that allows users to bridge USDC from various chains
          to HyprEVM using the LI.FI protocol.
        </p>
        <ul>
          <li>✅ Fully customizable styling via props</li>
          <li>✅ TypeScript support</li>
          <li>✅ Easy to integrate into any React app</li>
          <li>✅ Automatic chain detection and balance loading</li>
        </ul>
      </div>
    </div>
  );
}

export default App;

