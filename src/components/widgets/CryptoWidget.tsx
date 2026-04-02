'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { CryptoConfig, WidgetStyle } from '@/types/widget';

interface CoinData {
  id: string;
  name: string;
  price: number;
  change24h: number;
}

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
  wormhole: ['W', 'Wormhole'],'ondo-finance': ['ONDO', 'Ondo Finance'],
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

const COIN_SYMBOLS: Record<string, string> = Object.fromEntries(
  Object.entries(COIN_CATALOG).map(([id, [sym]]) => [id, sym])
);
const COIN_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(COIN_CATALOG).map(([id, [, name]]) => [id, name])
);

interface CryptoWidgetProps {
  config: CryptoConfig;
  style: WidgetStyle;
}

function formatPrice(p: number): string {
  if (p >= 1000) return `$${Math.round(p).toLocaleString()}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(4)}`;
}

export function CryptoWidget({ config }: CryptoWidgetProps) {
  const [coins, setCoins] = useState<CoinData[]>([]);
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

  const fetchCrypto = useCallback(async () => {
    try {
      const coinIds = config.coins.join(',');
      const res = await fetch(`/api/crypto?coins=${coinIds}`);
      if (!res.ok) return;
      const data: CoinData[] = await res.json();
      if (Array.isArray(data)) setCoins(data);
    } catch (err) {
      console.error('[CryptoWidget] fetch error', err);
    }
  }, [config.coins]);

  useEffect(() => {
    fetchCrypto();
    const interval = setInterval(fetchCrypto, 60_000);
    return () => clearInterval(interval);
  }, [fetchCrypto]);

  if (coins.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  const scale = Math.min(dims.w / 220, dims.h / 160);
  const isCompact = dims.h < 160;
  const padding = Math.max(6, Math.min(16, 12 * scale));
  const rowPy = Math.max(3, Math.min(8, 7 * scale));

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col overflow-hidden" style={{ padding }}>
      {!isCompact && (
        <div
          className="font-bold text-white/30 uppercase shrink-0"
          style={{ letterSpacing: '4px', fontSize: `${Math.max(8, 10 * scale)}px`, marginBottom: `${Math.max(4, 8 * scale)}px` }}
        >
          Crypto
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
        <div className="flex flex-col">
          {coins.map((coin, i) => {
            const isUp = coin.change24h >= 0;
            const ArrowIcon = isUp ? ArrowUpRight : ArrowDownRight;
            const ticker = COIN_SYMBOLS[coin.id] || coin.id.toUpperCase().slice(0, 4);
            const name = COIN_NAMES[coin.id] || coin.name || coin.id.charAt(0).toUpperCase() + coin.id.slice(1);

            return (
              <div key={coin.id}>
                <div className="flex items-center gap-2" style={{ paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px` }}>
                  <span className="font-bold text-white/50" style={{ fontSize: `${Math.max(10, 12 * scale)}px`, width: `${Math.max(30, 36 * scale)}px` }}>
                    {ticker}
                  </span>
                  {dims.w > 180 && (
                    <span className="text-white/60 truncate" style={{ fontSize: `${Math.max(9, 11 * scale)}px` }}>
                      {name}
                    </span>
                  )}
                  <div className="flex-1" />
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-light text-white/85 tabular-nums" style={{ fontSize: `${Math.max(10, 13 * scale)}px` }}>
                      {formatPrice(coin.price)}
                    </span>
                    <div className={`flex items-center gap-0.5 ${isUp ? 'text-green-500/80' : 'text-red-500/80'}`}>
                      <ArrowIcon size={Math.max(7, 8 * scale)} strokeWidth={3} />
                      <span className="font-medium tabular-nums" style={{ fontSize: `${Math.max(8, 10 * scale)}px` }}>
                        {Math.abs(coin.change24h).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                {i < coins.length - 1 && <div className="h-px bg-white/[0.04]" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
