import React, { useState, useEffect, useRef } from 'react';
import { TokenSearchService, type SearchableToken } from '../tokenSearch';
import type { ChainInfo } from '../../types/index';

// Hyperliquid brand colors - must match BridgeModal
const COLORS = {
  aquamarine: '#97FCE4',
  firefly: '#0F3933',
  ebony: '#04060C',
  foam: '#F5FEFD',
};

interface ChainTokenSelectorProps {
  chains: ChainInfo[];
  onSelect: (chain: ChainInfo, token: SearchableToken) => void;
  onClose: () => void;
  initialChainId?: number; // Pre-select a chain when opening
  styles?: {
    modal?: React.CSSProperties;
    overlay?: React.CSSProperties;
  };
}

export const ChainTokenSelector: React.FC<ChainTokenSelectorProps> = ({
  chains,
  onSelect,
  onClose,
  initialChainId,
  styles = {},
}) => {
  const [chainSearch, setChainSearch] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<ChainInfo | null>(null);
  const [tokens, setTokens] = useState<SearchableToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [hoveredChain, setHoveredChain] = useState<number | null>(null);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const searchService = useRef(new TokenSearchService());

  // Initialize with the provided chain if available
  useEffect(() => {
    if (initialChainId && chains.length > 0 && !selectedChain) {
      const initialChain = chains.find(c => c.id === initialChainId);
      if (initialChain) {
        setSelectedChain(initialChain);
      }
    }
  }, [initialChainId, chains]);

  // Load tokens when chain is selected
  useEffect(() => {
    if (selectedChain) {
      loadTokens();
    }
  }, [selectedChain, tokenSearch]);

  const loadTokens = async () => {
    if (!selectedChain) return;
    
    setLoadingTokens(true);
    try {
      if (tokenSearch.trim()) {
        // When searching, search ALL tokens (not just popular ones)
        const results = await searchService.current.searchTokens(selectedChain.id, tokenSearch);
        setTokens(results);
      } else {
        // By default, show only popular/whitelisted tokens (top 200 by market cap)
        const popularTokens = await searchService.current.getPopularTokensForChain(selectedChain.id);
        setTokens(popularTokens);
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
      setTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleSelectToken = (token: SearchableToken) => {
    if (selectedChain) {
      onSelect(selectedChain, token);
    }
  };

  // Filter chains based on search
  const filteredChains = chainSearch.trim()
    ? chains.filter(chain =>
        chain.name.toLowerCase().includes(chainSearch.toLowerCase())
      )
    : chains; // Show all chains when no search

  const defaultStyles = {
    // Opaque overlay to completely hide BridgeModal content behind
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(4, 6, 12, 0.95)', // Same as BridgeModal overlay
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1001, // Above BridgeModal content
      ...styles.overlay,
    },
    // Match BridgeModal dimensions and styling exactly
    modal: {
      background: `linear-gradient(180deg, ${COLORS.ebony} 0%, ${COLORS.firefly}40 100%)`,
      borderRadius: '24px',
      padding: '0',
      maxWidth: '480px', // Same as BridgeModal
      width: '100%',
      height: 'auto',
      maxHeight: '85vh', // Match BridgeModal height
      minHeight: '500px', // Ensure consistent minimum height
      display: 'flex',
      flexDirection: 'column' as const,
      boxShadow: `0 0 60px ${COLORS.aquamarine}20, 0 25px 50px rgba(0,0,0,0.5)`,
      border: `3px solid ${COLORS.aquamarine}30`,
      overflow: 'hidden',
      ...styles.modal,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      padding: '24px 28px 20px',
      borderBottom: `3px solid ${COLORS.aquamarine}15`,
      gap: '16px',
    },
    backButton: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      border: `3px solid ${COLORS.aquamarine}30`,
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      fontSize: '18px',
      color: COLORS.foam,
      transition: 'all 0.2s',
    },
    title: {
      flex: 1,
      fontSize: '1.4rem',
      fontWeight: '600',
      color: COLORS.foam,
      margin: 0,
      letterSpacing: '-0.02em',
    },
    searchContainer: {
      display: 'flex',
      gap: '0',
      padding: '20px 0',
    },
    chainSearchWrapper: {
      width: '40%',
      padding: '0 16px 0 28px',
      boxSizing: 'border-box' as const,
    },
    tokenSearchWrapper: {
      width: '60%',
      padding: '0 28px 0 16px',
      boxSizing: 'border-box' as const,
    },
    searchInput: {
      width: '100%',
      boxSizing: 'border-box' as const,
      padding: '14px 20px 14px 48px',
      border: `3px solid ${COLORS.aquamarine}30`,
      borderRadius: '16px',
      fontSize: '15px',
      outline: 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      background: `${COLORS.ebony}80`,
      color: COLORS.foam,
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2397FCE4' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '16px center',
    },
    content: {
      display: 'flex',
      gap: '0', // No gap, use border instead
      flex: 1,
      overflow: 'hidden',
      padding: '0 0 28px 0',
    },
    chainColumn: {
      width: '40%',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
      padding: '0 16px 0 28px',
      borderRight: `3px solid ${COLORS.aquamarine}20`,
    },
    tokenColumn: {
      width: '60%',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
      padding: '0 28px 0 16px',
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 16px',
      background: `${COLORS.firefly}80`,
      borderRadius: '12px',
      marginBottom: '12px',
      fontSize: '13px',
      fontWeight: '600',
      color: COLORS.aquamarine,
      border: `3px solid ${COLORS.aquamarine}20`,
    },
    list: {
      flex: 1,
      overflowY: 'auto' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '4px',
    },
    chainItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 14px',
      borderRadius: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      border: '3px solid transparent',
    },
    chainLogo: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      flexShrink: 0,
      objectFit: 'cover' as const,
    },
    chainLogoFallback: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${COLORS.aquamarine}30 0%, ${COLORS.firefly} 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: COLORS.aquamarine,
      fontWeight: 'bold',
      fontSize: '14px',
      flexShrink: 0,
      border: `3px solid ${COLORS.aquamarine}30`,
    },
    chainName: {
      fontSize: '15px',
      fontWeight: '500',
      color: COLORS.foam,
    },
    tokenItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 14px',
      borderRadius: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      border: '3px solid transparent',
    },
    tokenLogoContainer: {
      position: 'relative' as const,
      width: '36px',
      height: '36px',
      flexShrink: 0,
    },
    tokenLogo: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      objectFit: 'cover' as const,
      border: `3px solid ${COLORS.aquamarine}30`,
    },
    tokenLogoFallback: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${COLORS.aquamarine}30 0%, ${COLORS.firefly} 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: COLORS.aquamarine,
      fontWeight: 'bold',
      fontSize: '12px',
      border: `3px solid ${COLORS.aquamarine}30`,
    },
    chainBadge: {
      position: 'absolute' as const,
      bottom: '-2px',
      right: '-4px',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      background: COLORS.ebony,
      border: `3px solid ${COLORS.firefly}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    chainBadgeFallback: {
      position: 'absolute' as const,
      bottom: '-2px',
      right: '-4px',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${COLORS.aquamarine}30 0%, ${COLORS.firefly} 100%)`,
      border: `3px solid ${COLORS.firefly}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: COLORS.aquamarine,
      fontSize: '7px',
      fontWeight: 'bold',
    },
    tokenInfo: {
      flex: 1,
    },
    tokenSymbol: {
      fontSize: '15px',
      fontWeight: '600',
      color: COLORS.foam,
      marginBottom: '2px',
    },
    tokenName: {
      fontSize: '12px',
      color: `${COLORS.aquamarine}80`,
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: '40px 20px',
      color: `${COLORS.aquamarine}60`,
      fontSize: '14px',
    },
  };

  return (
    <div style={defaultStyles.overlay} onClick={onClose}>
      <div style={defaultStyles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={defaultStyles.header}>
          <button
            style={defaultStyles.backButton}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${COLORS.aquamarine}20`;
              e.currentTarget.style.borderColor = COLORS.aquamarine;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = `${COLORS.aquamarine}30`;
            }}
          >
            ←
          </button>
          <h2 style={defaultStyles.title}>Select <span style={{ color: COLORS.aquamarine }}>Token</span></h2>
        </div>

        {/* Search Inputs - 40/60 split */}
        <div style={defaultStyles.searchContainer}>
          <div style={defaultStyles.chainSearchWrapper}>
            <input
              type="text"
              placeholder="Chain..."
              value={chainSearch}
              onChange={(e) => setChainSearch(e.target.value)}
              style={{
                ...defaultStyles.searchInput,
                borderColor: chainSearch ? COLORS.aquamarine : `${COLORS.aquamarine}30`,
                boxShadow: chainSearch ? `0 0 10px ${COLORS.aquamarine}20` : 'none',
              }}
            />
          </div>
          <div style={defaultStyles.tokenSearchWrapper}>
            <input
              type="text"
              placeholder="Token..."
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
              style={{
                ...defaultStyles.searchInput,
                borderColor: tokenSearch || selectedChain ? COLORS.aquamarine : `${COLORS.aquamarine}30`,
                boxShadow: tokenSearch || selectedChain ? `0 0 10px ${COLORS.aquamarine}20` : 'none',
              }}
            />
          </div>
        </div>

        {/* Two Column Layout */}
        <div style={defaultStyles.content}>
          {/* Left Column - Chains (40%) */}
          <div style={defaultStyles.chainColumn}>
            <div style={defaultStyles.sectionHeader}>
              <span>🔗</span>
              {chainSearch ? 'Search Results' : 'All Chains'}
            </div>
            <div style={defaultStyles.list}>
              {filteredChains.map((chain) => (
                <div
                  key={chain.id}
                  style={{
                    ...defaultStyles.chainItem,
                    background: selectedChain?.id === chain.id 
                      ? `${COLORS.aquamarine}15` 
                      : hoveredChain === chain.id 
                        ? `${COLORS.firefly}80` 
                        : 'transparent',
                    borderColor: selectedChain?.id === chain.id ? COLORS.aquamarine : 'transparent',
                  }}
                  onClick={() => setSelectedChain(chain)}
                  onMouseEnter={() => setHoveredChain(chain.id)}
                  onMouseLeave={() => setHoveredChain(null)}
                >
                  {chain.logoURI ? (
                    <img
                      src={chain.logoURI}
                      alt={chain.name}
                      style={defaultStyles.chainLogo}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={defaultStyles.chainLogoFallback}>
                      {chain.name[0]}
                    </div>
                  )}
                  <div style={defaultStyles.chainName}>{chain.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Tokens (60%) */}
          <div style={defaultStyles.tokenColumn}>
            <div style={defaultStyles.sectionHeader}>
              <span>🪙</span>
              {tokenSearch ? 'Search Results' : 'Popular tokens'}
            </div>
            <div style={defaultStyles.list}>
              {!selectedChain ? (
                <div style={defaultStyles.emptyState}>
                  Select a chain to view tokens
                </div>
              ) : loadingTokens ? (
                <div style={defaultStyles.emptyState}>
                  Loading tokens...
                </div>
              ) : tokens.length === 0 ? (
                <div style={defaultStyles.emptyState}>
                  No tokens found
                </div>
              ) : (
                tokens.map((token) => (
                  <div
                    key={token.address}
                    style={{
                      ...defaultStyles.tokenItem,
                      background: hoveredToken === token.address ? `${COLORS.aquamarine}15` : 'transparent',
                      borderColor: hoveredToken === token.address ? COLORS.aquamarine : 'transparent',
                    }}
                    onClick={() => handleSelectToken(token)}
                    onMouseEnter={() => setHoveredToken(token.address)}
                    onMouseLeave={() => setHoveredToken(null)}
                  >
                    <div style={defaultStyles.tokenLogoContainer}>
                      {token.logoURI ? (
                        <img
                          src={token.logoURI}
                          alt={token.symbol}
                          style={defaultStyles.tokenLogo}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={defaultStyles.tokenLogoFallback}>
                          {token.symbol[0]}
                        </div>
                      )}
                      {/* Chain badge */}
                      {selectedChain?.logoURI ? (
                        <img
                          src={selectedChain.logoURI}
                          alt={selectedChain.name}
                          style={defaultStyles.chainBadge}
                        />
                      ) : selectedChain ? (
                        <div style={defaultStyles.chainBadgeFallback}>
                          {selectedChain.name[0]}
                        </div>
                      ) : null}
                    </div>
                    <div style={defaultStyles.tokenInfo}>
                      <div style={defaultStyles.tokenSymbol}>{token.symbol}</div>
                      <div style={defaultStyles.tokenName}>{token.name}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
