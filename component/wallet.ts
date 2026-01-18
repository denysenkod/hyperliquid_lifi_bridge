import { createWalletClient, custom, formatUnits, type WalletClient } from 'viem';
import { mainnet } from 'viem/chains';
import { getTokenBalance } from '@lifi/sdk';
import type { WalletState, TokenBalance, TokenInfo } from '../types/index.js';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export class WalletManager {
  private walletClient: WalletClient | null = null;
  private listeners: Set<(state: WalletState) => void> = new Set();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        this.notifyListeners({
          address: accounts[0] || null,
          chainId: this.getCurrentChainId(),
          isConnected: accounts.length > 0,
        });
      });

      window.ethereum.on('chainChanged', (chainId: string) => {
        this.notifyListeners({
          address: this.getCurrentAddress(),
          chainId: parseInt(chainId, 16),
          isConnected: !!this.getCurrentAddress(),
        });
      });
    }
  }

  async connectWallet(): Promise<WalletState> {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      // Request accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const chainId = await window.ethereum.request({
        method: 'eth_chainId',
      });

      // Create wallet client
      this.walletClient = createWalletClient({
        chain: mainnet,
        transport: custom(window.ethereum),
      });

      const state: WalletState = {
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        isConnected: true,
      };

      this.notifyListeners(state);
      return state;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  async checkExistingConnection(): Promise<WalletState> {
    if (!window.ethereum) {
      return { address: null, chainId: null, isConnected: false };
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      });

      const chainId = await window.ethereum.request({
        method: 'eth_chainId',
      });

      if (accounts.length > 0) {
        this.walletClient = createWalletClient({
          chain: mainnet,
          transport: custom(window.ethereum),
        });
      }

      return {
        address: accounts[0] || null,
        chainId: parseInt(chainId, 16),
        isConnected: accounts.length > 0,
      };
    } catch (error) {
      console.error('Failed to check connection:', error);
      return { address: null, chainId: null, isConnected: false };
    }
  }

  async getTokenBalance(
    address: string,
    token: TokenInfo,
    chainName: string
  ): Promise<TokenBalance> {
    try {
      // Use LiFi SDK's getTokenBalance function
      const tokenAmount = await getTokenBalance(address, token);

      if (!tokenAmount) {
        throw new Error(`Failed to get balance for ${token.symbol} on ${chainName}`);
      }

      // tokenAmount.amount is a bigint string
      const balanceBigInt = BigInt(tokenAmount.amount);
      const formatted = formatUnits(balanceBigInt, token.decimals);
      const balanceNum = parseFloat(formatted);

      // Smart formatting: preserve significant digits for small amounts
      let formattedBalance: string;
      if (balanceNum === 0) {
        formattedBalance = '0';
      } else if (balanceNum < 0.01) {
        // For very small amounts, show up to 6 significant digits
        formattedBalance = balanceNum.toFixed(6).replace(/\.?0+$/, '');
      } else if (balanceNum < 1) {
        // For amounts < 1, show 4 decimals
        formattedBalance = balanceNum.toFixed(4).replace(/\.?0+$/, '');
      } else {
        // For amounts >= 1, show 2 decimals
        formattedBalance = balanceNum.toFixed(2);
      }

      return {
        chainId: token.chainId,
        chainName,
        balance: balanceBigInt.toString(),
        formattedBalance,
        symbol: token.symbol,
        tokenAddress: token.address,
      };
    } catch (error) {
      // Throw the error so the chain can be filtered out
      throw new Error(`Failed to get ${token.symbol} balance on ${chainName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async switchChain(chainId: number): Promise<void> {
    if (!window.ethereum) {
      throw new Error('MetaMask not available');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: any) {
      // Chain not added to MetaMask
      if (error.code === 4902) {
        await this.addChain(chainId);
      } else {
        throw error;
      }
    }
  }

  private async addChain(chainId: number, chainInfo?: any): Promise<void> {
    if (!chainInfo) {
      throw new Error(`Chain ${chainId} configuration not available`);
    }

    // Try to add the chain to MetaMask
    // Note: This requires proper RPC URLs which LiFi might not provide
    // For production, you'd need a mapping of chain IDs to RPC providers
    throw new Error(`Please add chain ${chainInfo.name} (${chainId}) to MetaMask manually`);
  }

  onStateChange(callback: (state: WalletState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(state: WalletState): void {
    this.listeners.forEach((listener) => listener(state));
  }

  private getCurrentAddress(): string | null {
    return this.walletClient?.account?.address || null;
  }

  private getCurrentChainId(): number | null {
    if (!window.ethereum) return null;
    try {
      const chainId = window.ethereum.chainId;
      return chainId ? parseInt(chainId, 16) : null;
    } catch {
      return null;
    }
  }

  getWalletClient(): WalletClient | null {
    return this.walletClient;
  }
}