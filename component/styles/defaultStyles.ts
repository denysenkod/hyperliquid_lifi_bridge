import { CSSProperties } from 'react';

export interface BridgeWidgetStyles {
  container?: CSSProperties;
  connectButton?: CSSProperties;
  bridgeButton?: CSSProperties;
  walletInfo?: CSSProperties;
  modal?: {
    overlay?: CSSProperties;
    content?: CSSProperties;
    header?: CSSProperties;
    closeButton?: CSSProperties;
    body?: CSSProperties;
  };
  balanceItem?: CSSProperties;
  chainInfo?: CSSProperties;
  bridgeFromButton?: CSSProperties;
  infoBox?: CSSProperties;
}

export const defaultStyles: Required<BridgeWidgetStyles> = {
  container: {
    background: 'white',
    borderRadius: '20px',
    padding: '30px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
  },
  connectButton: {
    width: '100%',
    padding: '16px 24px',
    fontSize: '1.1rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    transition: 'all 0.3s ease',
  },
  bridgeButton: {
    width: '100%',
    padding: '16px 24px',
    fontSize: '1.1rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: 'white',
    transition: 'all 0.3s ease',
  },
  walletInfo: {
    background: '#f7f7f7',
    padding: '12px 20px',
    borderRadius: '12px',
    fontSize: '0.9rem',
    marginBottom: '20px',
    textAlign: 'center',
  },
  modal: {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000,
      padding: '20px',
    },
    content: {
      background: 'white',
      borderRadius: '20px',
      maxWidth: '600px',
      width: '100%',
      maxHeight: '80vh',
      overflowY: 'auto',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '25px 30px',
      borderBottom: '3px solid #e0e0e0',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '1.5rem',
      cursor: 'pointer',
      color: '#666',
      padding: 0,
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      transition: 'all 0.2s',
    },
    body: {
      padding: '30px',
    },
  },
  balanceItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: '#f9f9f9',
    borderRadius: '12px',
    marginBottom: '12px',
    transition: 'all 0.2s',
  },
  chainInfo: {
    flex: 1,
  },
  bridgeFromButton: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  infoBox: {
    background: '#fff3cd',
    borderLeft: '4px solid #ffc107',
    padding: '15px',
    marginBottom: '20px',
    borderRadius: '4px',
    fontSize: '0.9rem',
    color: '#856404',
  },
};
