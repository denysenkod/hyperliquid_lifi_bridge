import { getToken, getTokens, ChainType } from '@lifi/sdk';
import type { Token } from '@lifi/sdk';
import { TOP_TOKENS_BY_MARKETCAP, isTopToken, getTokenRank } from './topTokens.js';

export interface SearchableToken {
  symbol: string;
  name: string;
  address: string;
  chainId: number;
  decimals: number;
  logoURI?: string;
  priceUSD?: string;
}

// Patterns to identify LP/vault/receipt tokens (not real tradeable tokens)
const JUNK_TOKEN_PATTERNS = [
  /^UNI-V2$/i,
  /^SLP$/i,
  /^PENDLE-LPT$/i,
  /^SPT-PT/i,
  /^eqb/i,
  /^voted-/i,
  /^bb[a-z]/i, // Balancer boosted tokens
  /^LAMINAR-V2$/i,
  /Uniswap V2/i,
  /Liquidity Pool/i,
  /Receipt/i,
  /Vault/i,
  /LP Token/i,
  /^LP$/i,
];

function isTradeableToken(token: Token): boolean {
  // Filter out junk tokens
  if (JUNK_TOKEN_PATTERNS.some(pattern => pattern.test(token.symbol))) {
    return false;
  }
  
  if (JUNK_TOKEN_PATTERNS.some(pattern => pattern.test(token.name))) {
    return false;
  }
  
  return true;
}

/**
 * Sort tokens by: 1) Has logo first, 2) Market cap rank, 3) Alphabetically
 * Tokens without logos ALWAYS go to the end, even if they're top tokens
 */
function sortTokens(tokens: SearchableToken[]): SearchableToken[] {
  return tokens.sort((a, b) => {
    const aHasLogo = !!a.logoURI;
    const bHasLogo = !!b.logoURI;
    
    // 1. Tokens with logos ALWAYS come before tokens without
    if (aHasLogo !== bHasLogo) {
      return aHasLogo ? -1 : 1;
    }
    
    // 2. Sort by market cap rank (lower rank = higher market cap)
    const aRank = getTokenRank(a.symbol);
    const bRank = getTokenRank(b.symbol);
    
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    
    // 3. Alphabetically by symbol
    return a.symbol.toUpperCase().localeCompare(b.symbol.toUpperCase());
  });
}

export class TokenSearchService {
  private tokenCache: Map<number, Token[]> = new Map();
  private cacheTimestamp: Map<number, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all tradeable tokens for a specific chain
   */
  async getTokensForChain(chainId: number): Promise<SearchableToken[]> {
    // Check cache
    const cached = this.tokenCache.get(chainId);
    const cacheTime = this.cacheTimestamp.get(chainId);
    
    if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_DURATION) {
      const mapped = cached.map((t: Token) => this.mapToSearchableToken(t, chainId));
      return sortTokens(mapped);
    }

    // Fetch from LI.FI - include all chain types (EVM, SVM, UTXO, MVM)
    const allTokens = await getTokens({
      chainTypes: [ChainType.EVM, ChainType.SVM, ChainType.UTXO, ChainType.MVM],
    });
    const tokensData = (allTokens as any).tokens || allTokens;
    const chainTokens = tokensData[chainId] || [];

    // Filter tradeable tokens
    const tradeableTokens = chainTokens.filter((token: Token) => isTradeableToken(token));

    // Update cache
    this.tokenCache.set(chainId, tradeableTokens);
    this.cacheTimestamp.set(chainId, Date.now());

    const mapped = tradeableTokens.map((t: Token) => this.mapToSearchableToken(t, chainId));
    return sortTokens(mapped);
  }

  /**
   * Get only popular/whitelisted tokens for a chain (for default display)
   * These are the top 200 tokens by market cap that exist on this chain
   * Tokens with logos appear first, sorted by market cap rank
   * Tokens without logos appear at the end
   */
  async getPopularTokensForChain(chainId: number): Promise<SearchableToken[]> {
    const allTokens = await this.getTokensForChain(chainId);
    
    // Filter to only include tokens in our whitelist
    const popularTokens = allTokens.filter(token => isTopToken(token.symbol));
    
    // Sort: 1) Has logo first, 2) By market cap rank
    return popularTokens.sort((a, b) => {
      const aHasLogo = !!a.logoURI;
      const bHasLogo = !!b.logoURI;
      
      // Tokens with logos come first
      if (aHasLogo !== bHasLogo) {
        return aHasLogo ? -1 : 1;
      }
      
      // Then sort by market cap rank
      const aRank = getTokenRank(a.symbol);
      const bRank = getTokenRank(b.symbol);
      return aRank - bRank;
    });
  }

  /**
   * Search tokens by name or symbol on a specific chain
   * This searches ALL tokens, not just popular ones
   */
  async searchTokens(chainId: number, query: string): Promise<SearchableToken[]> {
    const tokens = await this.getTokensForChain(chainId);
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
      // Return popular tokens if no query (use whitelist)
      return this.getPopularTokensForChain(chainId);
    }

    // Search by symbol or name
    const results = tokens.filter(token => 
      token.symbol.toLowerCase().includes(lowerQuery) ||
      token.name.toLowerCase().includes(lowerQuery)
    );

    // Sort: exact symbol match first, then symbol starts with, then by market cap rank
    return results.sort((a, b) => {
      const aSymbol = a.symbol.toLowerCase();
      const bSymbol = b.symbol.toLowerCase();
      
      // Exact match comes first
      if (aSymbol === lowerQuery) return -1;
      if (bSymbol === lowerQuery) return 1;
      
      // Starts with query comes next
      if (aSymbol.startsWith(lowerQuery) && !bSymbol.startsWith(lowerQuery)) return -1;
      if (!aSymbol.startsWith(lowerQuery) && bSymbol.startsWith(lowerQuery)) return 1;
      
      // Then by market cap rank
      const aRank = getTokenRank(a.symbol);
      const bRank = getTokenRank(b.symbol);
      if (aRank !== bRank) return aRank - bRank;
      
      // Then by logo presence
      const aHasLogo = a.logoURI ? 1 : 0;
      const bHasLogo = b.logoURI ? 1 : 0;
      if (aHasLogo !== bHasLogo) return bHasLogo - aHasLogo;
      
      return 0;
    });
  }

  /**
   * Get token by exact address on a specific chain
   */
  async getTokenByAddress(chainId: number, address: string): Promise<SearchableToken | null> {
    try {
      // First try to get from cache
      const tokens = await this.getTokensForChain(chainId);
      const found = tokens.find(t => t.address.toLowerCase() === address.toLowerCase());
      
      if (found) {
        return found;
      }

      // If not in cache, try fetching directly from LI.FI
      // Note: LI.FI SDK doesn't have a direct getTokenByAddress method,
      // so we search through all tokens
      return null;
    } catch (error) {
      console.error(`Failed to get token by address ${address} on chain ${chainId}:`, error);
      return null;
    }
  }

  /**
   * Get token by symbol on a specific chain
   */
  async getTokenBySymbol(chainId: number, symbol: string): Promise<SearchableToken | null> {
    try {
      const token = await getToken(chainId, symbol);
      
      if (token && isTradeableToken(token)) {
        return this.mapToSearchableToken(token, chainId);
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to get token ${symbol} on chain ${chainId}:`, error);
      return null;
    }
  }

  /**
   * Get popular tokens for a chain (USDC, USDT, ETH, WBTC, etc.)
   */
  async getPopularTokens(chainId: number): Promise<SearchableToken[]> {
    const popularSymbols = ['USDC', 'USDT', 'DAI', 'ETH', 'WETH', 'WBTC', 'USDC.e', 'USDCe'];
    const tokens: SearchableToken[] = [];

    for (const symbol of popularSymbols) {
      try {
        const token = await this.getTokenBySymbol(chainId, symbol);
        if (token) {
          tokens.push(token);
        }
      } catch (error) {
        // Skip if token not found
      }
    }

    return tokens;
  }

  /**
   * Clear cache for a specific chain or all chains
   */
  clearCache(chainId?: number): void {
    if (chainId !== undefined) {
      this.tokenCache.delete(chainId);
      this.cacheTimestamp.delete(chainId);
    } else {
      this.tokenCache.clear();
      this.cacheTimestamp.clear();
    }
  }

  private mapToSearchableToken(token: Token, chainId: number): SearchableToken {
    return {
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      chainId,
      decimals: token.decimals,
      logoURI: token.logoURI,
      priceUSD: token.priceUSD,
    };
  }
}
