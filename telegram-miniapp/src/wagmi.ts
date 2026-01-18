import { http, createConfig } from 'wagmi';
import { mainnet, arbitrum, base, optimism, polygon, bsc } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// Get a free project ID at https://cloud.walletconnect.com
const projectId = 'be94199a1c53104c879e7fb9150a0fc2';

export const config = createConfig({
  chains: [mainnet, arbitrum, base, optimism, polygon, bsc],
  connectors: [
    injected(),
    walletConnect({ 
      projectId,
      metadata: {
        name: 'HyperLiquid Deposit',
        description: 'Deposit to HyperLiquid from any chain',
        url: 'https://hyperliquid.xyz',
        icons: ['https://hyperliquid.xyz/favicon.ico'],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
