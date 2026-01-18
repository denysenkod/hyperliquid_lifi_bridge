// Chain information from LiFi
export interface ChainInfo {
  id: number;
  name: string;
  key: string;
  chainType: string;
  logoURI?: string;
  nativeToken: {
    symbol: string;
    decimals: number;
    address: string;
  };
}

// Token information
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  name: string;
  logoURI?: string;
}

export interface BridgeWidgetConfig {
  targetChainId: number;
  targetChainName: string;
  tokenAddress?: string; // USDC address, will be resolved per chain
  tokenSymbol?: string; // Default: 'USDC'
}

export interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
}

export interface TokenBalance {
  chainId: number;
  chainName: string;
  balance: string;
  formattedBalance: string;
  symbol: string;
  tokenAddress: string;
}

export interface ChainBalance extends TokenBalance {
  chain: ChainInfo;
}
