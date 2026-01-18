/**
 * Top 200 tokens by market cap (CoinGecko ranking as of 2024)
 * These tokens are shown by default when a user selects a chain.
 * The list is ordered by market cap rank.
 * 
 * Format: Symbol -> Rank (lower = higher market cap)
 */

export const TOP_TOKENS_BY_MARKETCAP: Map<string, number> = new Map([
  // Top 10
  ['BTC', 1],
  ['ETH', 2],
  ['USDT', 3],
  ['XRP', 4],
  ['BNB', 5],
  ['SOL', 6],
  ['USDC', 7],
  ['DOGE', 8],
  ['ADA', 9],
  ['TRX', 10],
  
  // 11-20
  ['AVAX', 11],
  ['LINK', 12],
  ['TON', 13],
  ['SHIB', 14],
  ['SUI', 15],
  ['XLM', 16],
  ['DOT', 17],
  ['HBAR', 18],
  ['BCH', 19],
  ['LEO', 20],
  
  // 21-30
  ['LTC', 21],
  ['PEPE', 22],
  ['UNI', 23],
  ['NEAR', 24],
  ['APT', 25],
  ['DAI', 26],
  ['ICP', 27],
  ['AAVE', 28],
  ['ETC', 29],
  ['POL', 30], // Polygon
  ['MATIC', 30], // Polygon (old symbol)
  
  // 31-50
  ['CRO', 31],
  ['RENDER', 32],
  ['VET', 33],
  ['TAO', 34],
  ['FET', 35],
  ['OM', 36],
  ['MNT', 37],
  ['ARB', 38],
  ['FIL', 39],
  ['KAS', 40],
  ['ATOM', 41],
  ['OKB', 42],
  ['STX', 43],
  ['IMX', 44],
  ['WIF', 45],
  ['INJ', 46],
  ['OP', 47],
  ['GRT', 48],
  ['THETA', 49],
  ['FTM', 50],
  
  // 51-75
  ['BONK', 51],
  ['SEI', 52],
  ['FLOKI', 53],
  ['RUNE', 54],
  ['PYTH', 55],
  ['TIA', 56],
  ['LDO', 57],
  ['JUP', 58],
  ['ALGO', 59],
  ['JASMY', 60],
  ['GALA', 61],
  ['SAND', 62],
  ['BRETT', 63],
  ['BEAM', 64],
  ['CORE', 65],
  ['FLOW', 66],
  ['EOS', 67],
  ['BSV', 68],
  ['QNT', 69],
  ['EGLD', 70],
  ['AERO', 71],
  ['AXS', 72],
  ['NEO', 73],
  ['MANA', 74],
  ['XTZ', 75],
  
  // 76-100
  ['STRK', 76],
  ['KAIA', 77],
  ['IOTA', 78],
  ['AIOZ', 79],
  ['PENDLE', 80],
  ['VIRTUAL', 81],
  ['POPCAT', 82],
  ['WLD', 83],
  ['ENA', 84],
  ['DYDX', 85],
  ['CAKE', 86],
  ['CRV', 87],
  ['APE', 88],
  ['ORDI', 89],
  ['SUPER', 90],
  ['BTT', 91],
  ['CFX', 92],
  ['NOT', 93],
  ['MINA', 94],
  ['XDC', 95],
  ['ZEC', 96],
  ['NEXO', 97],
  ['1INCH', 98],
  ['COMP', 99],
  ['SNX', 100],
  
  // 101-125
  ['ENS', 101],
  ['MKR', 102],
  ['SUSHI', 103],
  ['RPL', 104],
  ['GMX', 105],
  ['ZRX', 106],
  ['BAT', 107],
  ['CELO', 108],
  ['ANKR', 109],
  ['SKL', 110],
  ['BLUR', 111],
  ['CHZ', 112],
  ['RNDR', 113],
  ['ROSE', 114],
  ['KAVA', 115],
  ['ZIL', 116],
  ['QTUM', 117],
  ['ONE', 118],
  ['ENJ', 119],
  ['AUDIO', 120],
  ['LRC', 121],
  ['MASK', 122],
  ['OCEAN', 123],
  ['GLM', 124],
  ['STORJ', 125],
  
  // 126-150
  ['YFI', 126],
  ['SPELL', 127],
  ['BICO', 128],
  ['API3', 129],
  ['CELR', 130],
  ['BAND', 131],
  ['RLC', 132],
  ['NMR', 133],
  ['PERP', 134],
  ['BADGER', 135],
  ['POND', 136],
  ['RAD', 137],
  ['LQTY', 138],
  ['POLS', 139],
  ['DODO', 140],
  ['ALPHA', 141],
  ['AUCTION', 142],
  ['ALCX', 143],
  ['FORTH', 144],
  ['TRIBE', 145],
  ['FARM', 146],
  ['QUICK', 147],
  ['GHST', 148],
  ['RARE', 149],
  ['HIGH', 150],
  
  // 151-175
  ['MAGIC', 151],
  ['RDNT', 152],
  ['VELO', 153],
  ['LOOM', 154],
  ['CTSI', 155],
  ['REQ', 156],
  ['POWR', 157],
  ['ARPA', 158],
  ['LEVER', 159],
  ['BOBA', 160],
  ['PUNDIX', 161],
  ['MTL', 162],
  ['DENT', 163],
  ['STMX', 164],
  ['OGN', 165],
  ['AERGO', 166],
  ['LINA', 167],
  ['CHESS', 168],
  ['BURGER', 169],
  ['TWT', 170],
  ['SFP', 171],
  ['ALPACA', 172],
  ['WING', 173],
  ['HARD', 174],
  ['FOR', 175],
  
  // 176-200
  ['UNFI', 176],
  ['REEF', 177],
  ['TORN', 178],
  ['BOND', 179],
  ['CREAM', 180],
  ['KP3R', 181],
  ['HEGIC', 182],
  ['ROOK', 183],
  ['COVER', 184],
  ['PICKLE', 185],
  ['SILO', 186],
  ['IDLE', 187],
  ['INDEX', 188],
  ['DPI', 189],
  ['MVI', 190],
  ['BED', 191],
  ['DATA', 192],
  ['GTC', 193],
  ['SAFE', 194],
  ['COW', 195],
  ['MPL', 196],
  ['FOLD', 197],
  ['FLOAT', 198],
  ['BANK', 199],
  ['FXS', 200],
  
  // Wrapped versions (same rank as underlying)
  ['WETH', 2],
  ['WBTC', 1],
  ['WBNB', 5],
  ['WAVAX', 11],
  ['WMATIC', 30],
  ['WPOL', 30],
  ['WFTM', 50],
  ['WSOL', 6],
  
  // Stablecoins (high priority)
  ['BUSD', 7],
  ['TUSD', 7],
  ['FRAX', 7],
  ['LUSD', 7],
  ['USDP', 7],
  ['GUSD', 7],
  ['USDD', 7],
  ['PYUSD', 7],
  ['FDUSD', 7],
  ['EURC', 7],
  ['EURT', 7],
  ['USDE', 7],
  ['CRVUSD', 7],
  ['GHO', 7],
  ['SUSD', 7],
  ['RAI', 7],
  ['MIM', 7],
  ['DOLA', 7],
  ['USDX', 7],
  
  // Liquid staking tokens
  ['STETH', 50],
  ['WSTETH', 50],
  ['RETH', 50],
  ['CBETH', 50],
  ['SFRXETH', 50],
  ['FRXETH', 50],
  ['METH', 50],
  ['EZETH', 50],
  ['WEETH', 50],
  ['RSETH', 50],
  ['MSOL', 50],
  ['JITOSOL', 50],
  ['BSOL', 50],
]);

/**
 * Set of top token symbols for O(1) lookup
 */
export const TOP_TOKENS_SET: Set<string> = new Set(TOP_TOKENS_BY_MARKETCAP.keys());

/**
 * Check if a token is in the top tokens list
 */
export function isTopToken(symbol: string): boolean {
  return TOP_TOKENS_SET.has(symbol.toUpperCase());
}

/**
 * Get the market cap rank of a token (lower = higher market cap)
 * Returns Infinity if not in the list
 */
export function getTokenRank(symbol: string): number {
  return TOP_TOKENS_BY_MARKETCAP.get(symbol.toUpperCase()) ?? Infinity;
}

/**
 * Sort tokens by market cap rank
 */
export function sortByMarketCap<T extends { symbol: string }>(tokens: T[]): T[] {
  return [...tokens].sort((a, b) => {
    const rankA = getTokenRank(a.symbol);
    const rankB = getTokenRank(b.symbol);
    return rankA - rankB;
  });
}
