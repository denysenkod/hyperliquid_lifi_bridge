// ============================================
// MAIN EXPORTS - HyperLiquid Deposit
// ============================================

// Primary component - one-click deposit button
export { HyperliquidDeposit, useHyperliquidDeposit } from './HyperliquidDeposit';
export type { HyperliquidDepositProps } from './HyperliquidDeposit';

// Standalone modal (for custom implementations)
export { DepositModal } from './components/DepositModal';

// Constants
export { HYPERLIQUID_BRIDGE_ADDRESS, MIN_HYPERLIQUID_DEPOSIT_USD } from './depositOptimizer';

// ============================================
// BRIDGE WIDGET EXPORTS (Legacy)
// ============================================

export { HyprBridgeWidget } from './HyprBridgeWidget';
export type { HyprBridgeWidgetProps } from './HyprBridgeWidget';
export type { BridgeWidgetStyles } from './styles/defaultStyles';
export type { WalletState, ChainBalance, ChainInfo } from '../types/index';

// Token search exports
export { TokenSearchService } from './tokenSearch';
export type { SearchableToken } from './tokenSearch';
export { ChainTokenSelector } from './components/ChainTokenSelector';
export type { BridgeParams } from './components/BridgeModal';

// Bridge progress types
export type { DetailedBridgeProgress, StepInfo, BridgeProgress } from './bridge';

// Bridge service (for advanced usage)
export { LiFiBridgeService } from './bridge';

// Top tokens whitelist exports
export { TOP_TOKENS_BY_MARKETCAP, isTopToken, getTokenRank, sortByMarketCap } from './topTokens';
