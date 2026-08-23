// Market catalogs shared by the Stocks/Crypto widgets, the config panel,
// and defaultConfig in types/widget.ts.

// Master stock catalog: { ticker: companyName }
export const STOCK_CATALOG: Record<string, string> = {
  // Major indices / ETFs
  SPY: 'S&P 500 ETF', QQQ: 'Nasdaq 100 ETF', DIA: 'Dow Jones ETF', IWM: 'Russell 2000 ETF',
  VTI: 'Total Stock Market', VOO: 'Vanguard S&P 500', ARKK: 'ARK Innovation', XLF: 'Financial Select',
  XLE: 'Energy Select', XLK: 'Technology Select', XLV: 'Health Care Select', XLI: 'Industrial Select',
  GLD: 'Gold ETF', SLV: 'Silver ETF', TLT: 'Treasury Bond 20Y', HYG: 'High Yield Bond',
  VNQ: 'Real Estate ETF', EEM: 'Emerging Markets', EFA: 'International Developed', USO: 'US Oil Fund',
  // Mega-cap tech
  AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet (Google)', AMZN: 'Amazon',
  NVDA: 'NVIDIA', META: 'Meta Platforms', TSLA: 'Tesla', TSM: 'Taiwan Semiconductor',
  AVGO: 'Broadcom', ORCL: 'Oracle', ADBE: 'Adobe', CRM: 'Salesforce',
  CSCO: 'Cisco', ACN: 'Accenture', IBM: 'IBM', INTC: 'Intel',
  AMD: 'Advanced Micro Devices', QCOM: 'Qualcomm', TXN: 'Texas Instruments',
  NOW: 'ServiceNow', INTU: 'Intuit', AMAT: 'Applied Materials', MU: 'Micron Technology',
  LRCX: 'Lam Research', KLAC: 'KLA Corp', SNPS: 'Synopsys', CDNS: 'Cadence Design',
  PANW: 'Palo Alto Networks', CRWD: 'CrowdStrike', FTNT: 'Fortinet', ZS: 'Zscaler',
  NET: 'Cloudflare', DDOG: 'Datadog', SNOW: 'Snowflake', PLTR: 'Palantir',
  UBER: 'Uber', ABNB: 'Airbnb', SQ: 'Block (Square)', SHOP: 'Shopify',
  SPOT: 'Spotify', SNAP: 'Snap', PINS: 'Pinterest', RBLX: 'Roblox',
  U: 'Unity Software', COIN: 'Coinbase', HOOD: 'Robinhood', SOFI: 'SoFi Technologies',
  MSTR: 'MicroStrategy',
  // Finance
  JPM: 'JPMorgan Chase', BAC: 'Bank of America', WFC: 'Wells Fargo', GS: 'Goldman Sachs',
  MS: 'Morgan Stanley', C: 'Citigroup', BLK: 'BlackRock', SCHW: 'Charles Schwab',
  AXP: 'American Express', V: 'Visa', MA: 'Mastercard', PYPL: 'PayPal',
  COF: 'Capital One', USB: 'US Bancorp', PNC: 'PNC Financial', TFC: 'Truist Financial',
  BX: 'Blackstone', KKR: 'KKR & Co', APO: 'Apollo Global',
  // Healthcare
  UNH: 'UnitedHealth', JNJ: 'Johnson & Johnson', LLY: 'Eli Lilly', ABBV: 'AbbVie',
  MRK: 'Merck', PFE: 'Pfizer', TMO: 'Thermo Fisher', ABT: 'Abbott Labs',
  DHR: 'Danaher', BMY: 'Bristol-Myers Squibb', AMGN: 'Amgen', GILD: 'Gilead Sciences',
  ISRG: 'Intuitive Surgical', VRTX: 'Vertex Pharma', REGN: 'Regeneron', MDT: 'Medtronic',
  SYK: 'Stryker', BSX: 'Boston Scientific', ZTS: 'Zoetis', CI: 'Cigna',
  ELV: 'Elevance Health', HUM: 'Humana', CVS: 'CVS Health', MCK: 'McKesson',
  MRNA: 'Moderna',
  // Consumer
  WMT: 'Walmart', COST: 'Costco', HD: 'Home Depot', LOW: "Lowe's",
  TGT: 'Target', DG: 'Dollar General', DLTR: 'Dollar Tree',
  NKE: 'Nike', LULU: 'Lululemon', TJX: 'TJX Companies', ROST: 'Ross Stores',
  SBUX: 'Starbucks', MCD: "McDonald's", CMG: 'Chipotle', YUM: 'Yum! Brands',
  DPZ: "Domino's Pizza", DASH: 'DoorDash',
  PG: 'Procter & Gamble', KO: 'Coca-Cola', PEP: 'PepsiCo', MNST: 'Monster Beverage',
  CL: 'Colgate-Palmolive', KMB: 'Kimberly-Clark', EL: 'Estee Lauder',
  DIS: 'Walt Disney', NFLX: 'Netflix', CMCSA: 'Comcast', WBD: 'Warner Bros Discovery',
  // Industrial / Energy / Auto
  CAT: 'Caterpillar', DE: 'Deere & Company', HON: 'Honeywell', GE: 'GE Aerospace',
  RTX: 'RTX (Raytheon)', LMT: 'Lockheed Martin', BA: 'Boeing', NOC: 'Northrop Grumman',
  UPS: 'United Parcel Service', FDX: 'FedEx', UNP: 'Union Pacific', CSX: 'CSX Corp',
  XOM: 'Exxon Mobil', CVX: 'Chevron', COP: 'ConocoPhillips', SLB: 'Schlumberger',
  EOG: 'EOG Resources', PXD: 'Pioneer Natural Resources', OXY: 'Occidental Petroleum',
  F: 'Ford Motor', GM: 'General Motors', RIVN: 'Rivian', LCID: 'Lucid Group',
  TM: 'Toyota', LI: 'Li Auto', NIO: 'NIO', XPEV: 'XPeng',
  DAL: 'Delta Air Lines', UAL: 'United Airlines', LUV: 'Southwest Airlines', AAL: 'American Airlines',
  // Real estate / Utilities
  AMT: 'American Tower', PLD: 'Prologis', CCI: 'Crown Castle', EQIX: 'Equinix',
  O: 'Realty Income', SPG: 'Simon Property Group',
  NEE: 'NextEra Energy', DUK: 'Duke Energy', SO: 'Southern Company', D: 'Dominion Energy',
  // Telecom
  T: 'AT&T', VZ: 'Verizon', TMUS: 'T-Mobile',
  // Other notable
  BRK_B: 'Berkshire Hathaway', MMM: '3M Company', GIS: 'General Mills',
  PM: 'Philip Morris', MO: 'Altria Group', BKNG: 'Booking Holdings', MAR: 'Marriott',
  HLT: 'Hilton', LVS: 'Las Vegas Sands', WYNN: 'Wynn Resorts',
  DELL: 'Dell Technologies', HPQ: 'HP Inc', WDC: 'Western Digital', STX: 'Seagate',
  SMCI: 'Super Micro Computer', ARM: 'Arm Holdings', ASML: 'ASML Holding',
};

// Master coin catalog: { coingeckoId: [ticker, displayName] }
export const COIN_CATALOG: Record<string, [string, string]> = {
  bitcoin: ['BTC', 'Bitcoin'], ethereum: ['ETH', 'Ethereum'], tether: ['USDT', 'Tether'],
  ripple: ['XRP', 'XRP'], binancecoin: ['BNB', 'BNB'], solana: ['SOL', 'Solana'],
  'usd-coin': ['USDC', 'USD Coin'], dogecoin: ['DOGE', 'Dogecoin'], cardano: ['ADA', 'Cardano'],
  tron: ['TRX', 'Tron'], toncoin: ['TON', 'Toncoin'], 'avalanche-2': ['AVAX', 'Avalanche'],
  'shiba-inu': ['SHIB', 'Shiba Inu'], chainlink: ['LINK', 'Chainlink'], polkadot: ['DOT', 'Polkadot'],
  'bitcoin-cash': ['BCH', 'Bitcoin Cash'], litecoin: ['LTC', 'Litecoin'], uniswap: ['UNI', 'Uniswap'],
  near: ['NEAR', 'NEAR Protocol'], dai: ['DAI', 'Dai'], stellar: ['XLM', 'Stellar'],
  'internet-computer': ['ICP', 'Internet Computer'], kaspa: ['KAS', 'Kaspa'], pepe: ['PEPE', 'Pepe'],
  'ethereum-classic': ['ETC', 'Ethereum Classic'], aptos: ['APT', 'Aptos'], monero: ['XMR', 'Monero'],
  'render-token': ['RNDR', 'Render'], hedera: ['HBAR', 'Hedera'], cosmos: ['ATOM', 'Cosmos'],
  arbitrum: ['ARB', 'Arbitrum'], filecoin: ['FIL', 'Filecoin'], mantle: ['MNT', 'Mantle'],
  'immutable-x': ['IMX', 'Immutable'], optimism: ['OP', 'Optimism'], sui: ['SUI', 'Sui'],
  'injective-protocol': ['INJ', 'Injective'], vechain: ['VET', 'VeChain'], celestia: ['TIA', 'Celestia'],
  'sei-network': ['SEI', 'Sei'], stacks: ['STX', 'Stacks'], 'the-graph': ['GRT', 'The Graph'],
  algorand: ['ALGO', 'Algorand'], aave: ['AAVE', 'Aave'], maker: ['MKR', 'Maker'],
  fantom: ['FTM', 'Fantom'], bonk: ['BONK', 'Bonk'], floki: ['FLOKI', 'Floki'],
  fetch: ['FET', 'Fetch.ai'], 'matic-network': ['MATIC', 'Polygon'],
  theta: ['THETA', 'Theta'], 'the-sandbox': ['SAND', 'The Sandbox'], decentraland: ['MANA', 'Decentraland'],
  'axie-infinity': ['AXS', 'Axie Infinity'], eos: ['EOS', 'EOS'], iota: ['IOTA', 'IOTA'],
  'neo-token': ['NEO', 'NEO'], tezos: ['XTZ', 'Tezos'], 'flow-token': ['FLOW', 'Flow'],
  kava: ['KAVA', 'Kava'], 'gala-2': ['GALA', 'Gala'], enjin: ['ENJ', 'Enjin Coin'],
  chiliz: ['CHZ', 'Chiliz'], 'curve-dao-token': ['CRV', 'Curve DAO'],
  '1inch': ['1INCH', '1inch'], 'compound-coin': ['COMP', 'Compound'], 'basic-attention-token': ['BAT', 'Basic Attention Token'],
  zcash: ['ZEC', 'Zcash'], dash: ['DASH', 'Dash'], waves: ['WAVES', 'Waves'],
  loopring: ['LRC', 'Loopring'], 'ens-domains': ['ENS', 'ENS'], 'lido-dao': ['LDO', 'Lido DAO'],
  'rocket-pool': ['RPL', 'Rocket Pool'], 'pendle-finance': ['PENDLE', 'Pendle'],
  worldcoin: ['WLD', 'Worldcoin'], 'blur-token': ['BLUR', 'Blur'], jupiter: ['JUP', 'Jupiter'],
  'jito-governance-token': ['JTO', 'Jito'], pyth: ['PYTH', 'Pyth Network'],
  wormhole: ['W', 'Wormhole'], 'ondo-finance': ['ONDO', 'Ondo Finance'],
  'ethena-usde': ['USDE', 'Ethena USDe'], 'first-digital-usd': ['FDUSD', 'First Digital USD'],
  'wrapped-bitcoin': ['WBTC', 'Wrapped Bitcoin'], 'leo-token': ['LEO', 'LEO Token'],
  'okb-token': ['OKB', 'OKB'], cronos: ['CRO', 'Cronos'], quant: ['QNT', 'Quant'],
  elrond: ['EGLD', 'MultiversX'], mina: ['MINA', 'Mina Protocol'],
  raydium: ['RAY', 'Raydium'], 'marinade-staked-sol': ['MSOL', 'Marinade Staked SOL'],
  bittensor: ['TAO', 'Bittensor'], arweave: ['AR', 'Arweave'],
  'thorchain-erc20': ['RUNE', 'THORChain'], 'akash-network': ['AKT', 'Akash Network'],
  osmosis: ['OSMO', 'Osmosis'], 'terra-luna-2': ['LUNA', 'Terra'],
  'synthetix-network-token': ['SNX', 'Synthetix'], 'gmx-token': ['GMX', 'GMX'],
  'dydx-chain': ['DYDX', 'dYdX'], helium: ['HNT', 'Helium'],
  'mask-network': ['MASK', 'Mask Network'], 'iotex-token': ['IOTX', 'IoTeX'],
  zilliqa: ['ZIL', 'Zilliqa'], harmony: ['ONE', 'Harmony'], celo: ['CELO', 'Celo'],
  ankr: ['ANKR', 'Ankr'], sushi: ['SUSHI', 'SushiSwap'], yearn: ['YFI', 'Yearn Finance'],
  'pancakeswap-token': ['CAKE', 'PancakeSwap'],
};

export const COIN_SYMBOLS: Record<string, string> = Object.fromEntries(
  Object.entries(COIN_CATALOG).map(([id, [sym]]) => [id, sym])
);
export const COIN_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(COIN_CATALOG).map(([id, [, name]]) => [id, name])
);

// Default watchlists used by defaultConfig in types/widget.ts
export const DEFAULT_STOCK_SYMBOLS: string[] = [
  // Indices / ETFs
  'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'GLD',
  // Mega-cap tech
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'TSM', 'ORCL',
  'AMD', 'CRM', 'ADBE', 'NFLX', 'INTC', 'QCOM', 'CSCO', 'IBM', 'MU', 'ARM',
  'PLTR', 'SNOW', 'CRWD', 'PANW', 'NOW', 'UBER', 'SHOP', 'COIN', 'HOOD', 'MSTR',
  // Finance
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'AXP', 'BLK', 'SCHW',
  // Healthcare
  'UNH', 'LLY', 'JNJ', 'ABBV', 'MRK', 'PFE', 'TMO',
  // Consumer
  'WMT', 'COST', 'HD', 'NKE', 'MCD', 'SBUX', 'PG', 'KO', 'PEP', 'DIS',
  // Industrial / energy / auto
  'CAT', 'DE', 'GE', 'BA', 'HON', 'RTX', 'LMT', 'XOM', 'CVX', 'F', 'GM',
];

export const DEFAULT_COIN_IDS: string[] = [
  'bitcoin', 'ethereum', 'binancecoin', 'ripple', 'solana', 'cardano', 'dogecoin',
  'tron', 'avalanche-2', 'polkadot', 'chainlink', 'litecoin', 'uniswap', 'stellar',
  'near', 'bitcoin-cash', 'monero', 'cosmos', 'hedera', 'aptos', 'sui', 'arbitrum',
  'filecoin', 'kaspa', 'render-token',
];
