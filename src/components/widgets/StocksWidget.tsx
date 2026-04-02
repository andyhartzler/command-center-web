'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { StocksConfig, WidgetStyle } from '@/types/widget';

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

interface StockData {
  symbol: string;
  price: number;
  changePercent: number;
}

interface StocksWidgetProps {
  config: StocksConfig;
  style: WidgetStyle;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${Math.round(price).toLocaleString()}`;
  return `$${price.toFixed(2)}`;
}

export function StocksWidget({ config }: StocksWidgetProps) {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 200, h: 160 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fetchStocks = useCallback(async () => {
    try {
      const validSymbols = config.symbols.filter(s => s.trim().length > 0);
      if (validSymbols.length === 0) return;
      const res = await fetch(`/api/stocks?symbols=${validSymbols.join(',')}`);
      if (!res.ok) return;
      const data: StockData[] = await res.json();
      if (Array.isArray(data)) setStocks(data);
    } catch (err) {
      console.error('[StocksWidget] fetch error', err);
    }
  }, [config.symbols]);

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, 60_000);
    return () => clearInterval(interval);
  }, [fetchStocks]);

  if (stocks.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  // Compute scale factor and layout mode
  const isCompact = dims.h < 160;
  const isWide = dims.w > 350;
  const scale = Math.min(dims.w / 220, dims.h / 160);
  const fontSize = Math.max(9, Math.min(14, 12 * scale));
  const symbolSize = Math.max(10, Math.min(14, 13 * scale));
  const padding = Math.max(6, Math.min(16, 12 * scale));
  const rowPy = Math.max(2, Math.min(8, 6 * scale));

  // In wide mode, use 2-column grid
  const useGrid = isWide && stocks.length > 4;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col overflow-hidden" style={{ padding }}>
      {/* Header */}
      {!isCompact && (
        <div
          className="font-bold text-white/30 uppercase shrink-0"
          style={{ letterSpacing: '4px', fontSize: `${Math.max(8, 10 * scale)}px`, marginBottom: `${Math.max(4, 8 * scale)}px` }}
        >
          Markets
        </div>
      )}

      {/* Stock list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
        <div className={useGrid ? 'grid grid-cols-2 gap-x-4' : 'flex flex-col'}>
          {stocks.map((stock, i) => {
            const isUp = stock.changePercent >= 0;
            const ArrowIcon = isUp ? ArrowUpRight : ArrowDownRight;

            return (
              <div key={stock.symbol}>
                <div className="flex items-center" style={{ paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px` }}>
                  <span className="font-medium text-white/70" style={{ fontSize: `${symbolSize}px`, width: `${Math.max(36, 50 * scale)}px` }}>
                    {stock.symbol}
                  </span>
                  <div className="flex-1" />
                  {stock.price > 0 ? (
                    <>
                      <span className="font-light text-white/60 tabular-nums" style={{ fontSize: `${fontSize}px` }}>
                        {formatPrice(stock.price)}
                      </span>
                      <div
                        className={`flex items-center gap-0.5 justify-end ${
                          isUp ? 'text-green-500/80' : 'text-red-500/80'
                        }`}
                        style={{ width: `${Math.max(46, 60 * scale)}px` }}
                      >
                        <ArrowIcon size={Math.max(7, 8 * scale)} strokeWidth={3} />
                        <span className="font-medium tabular-nums" style={{ fontSize: `${Math.max(9, 11 * scale)}px` }}>
                          {Math.abs(stock.changePercent).toFixed(1)}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-white/20 tabular-nums" style={{ fontSize: `${fontSize}px` }}>--</span>
                  )}
                </div>
                {!useGrid && i < stocks.length - 1 && (
                  <div className="h-px bg-white/[0.04]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
