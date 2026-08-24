/**
 * Live Gold Price Service
 *
 * Integrates multiple real-time gold price APIs with proper fallback strategy
 */
import { supabase } from '@/lib/supabase';

export interface LiveGoldPrice {
  price: number;
  timestamp: number;
  source: string;
  currency: string;
  change24h?: number;
  changePercent24h?: number;
  high24h?: number;
  low24h?: number;
  openPrice?: number;
}

export interface MarketData {
  london: LiveGoldPrice | null;
  newYork: LiveGoldPrice | null;
  lastUpdated: Date;
}

// Cache to avoid hitting API limits
let priceCache: {
  data: LiveGoldPrice | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

const CACHE_DURATION = 60 * 1000; // 1 minute cache

/**
 * Source prioritaire : le référentiel SONASP alimenté côté serveur.
 *
 * L'ancienne implémentation appelait GoldPrice.org directement depuis le
 * navigateur. Cette origine n'autorise pas sonasp.data-univers.com en CORS et
 * produisait donc une erreur à chaque chargement. La donnée officielle déjà
 * stockée dans Supabase évite cette dépendance navigateur fragile.
 */
async function fetchFromSonaspReferential(): Promise<LiveGoldPrice | null> {
  try {
    const { data, error } = await supabase
      .from('gold_prices_daily')
      .select('price_date, spot_price, london_pm_rate, london_am_rate, average_price, high_price, low_price, source, currency, updated_at')
      .order('price_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const price = Number(
      data.spot_price
        ?? data.london_pm_rate
        ?? data.london_am_rate
        ?? data.average_price,
    );
    if (!Number.isFinite(price) || price <= 0) return null;

    const parsedTimestamp = Date.parse(data.updated_at ?? data.price_date);
    const high = data.high_price === null ? undefined : Number(data.high_price);
    const low = data.low_price === null ? undefined : Number(data.low_price);
    return {
      price,
      timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now(),
      source: data.source ? `Référentiel SONASP · ${data.source}` : 'Référentiel SONASP',
      currency: data.currency || 'USD',
      high24h: Number.isFinite(high) ? high : undefined,
      low24h: Number.isFinite(low) ? low : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch from Coinbase Commerce (Alternative cryptocurrency-based gold price)
 */
async function fetchFromCoinbaseCommerce(): Promise<LiveGoldPrice | null> {
  try {
    // Using public Coinbase API for PAXG (tokenized gold)
    const response = await fetch('https://api.coinbase.com/v2/prices/PAXG-USD/spot');

    if (!response.ok) return null;

    const data = await response.json();

    if (data && data.data && data.data.amount) {
      const price = parseFloat(data.data.amount);

      return {
        price: price,
        timestamp: Date.now(),
        source: 'Coinbase (PAXG)',
        currency: 'USD',
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch real-time gold price with comprehensive fallback strategy
 */
export async function fetchLiveGoldPrice(): Promise<LiveGoldPrice | null> {
  // Check cache first
  const now = Date.now();
  if (priceCache.data && (now - priceCache.timestamp) < CACHE_DURATION) {
    return priceCache.data;
  }

  // Le référentiel interne est la source autoritative et ne dépend pas du CORS
  // d'un fournisseur public tiers.
  let price = await fetchFromSonaspReferential();

  // Fallback to Coinbase (PAXG tokenized gold)
  if (!price) {
    price = await fetchFromCoinbaseCommerce();
  }

  // Aucune valeur de repli n'est fabriquee. Une indisponibilite doit rester
  // visible : un cours invente peut contaminer une vente ou un rapprochement.
  if (!price) {
    return null;
  }

  // Update cache
  if (price) {
    priceCache = {
      data: price,
      timestamp: now,
    };
  }

  return price;
}

/**
 * Get market data for both London and New York
 */
export async function getGlobalMarketData(): Promise<MarketData> {
  const price = await fetchLiveGoldPrice();

  return {
    london: price,
    newYork: price,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate 24h performance metrics
 */
export function calculate24hMetrics(current: number, open: number) {
  const change = current - open;
  const changePercent = (change / open) * 100;

  return {
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
  };
}

/**
 * Format price for display
 */
export function formatGoldPrice(price: number, decimals: number = 2): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Check if markets are open (approximate times)
 */
export function getMarketStatus(): {
  london: { isOpen: boolean; openTime: string; closeTime: string };
  newYork: { isOpen: boolean; openTime: string; closeTime: string };
} {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

  // Markets closed on weekends
  const isWeekend = utcDay === 0 || utcDay === 6;

  // London: 8:00 AM - 4:30 PM GMT (08:00 - 16:30 UTC)
  const londonOpen = !isWeekend && utcHours >= 8 && utcHours < 17;

  // New York: 8:20 AM - 1:30 PM EST (13:20 - 18:30 UTC, adjusting for EST)
  const newYorkOpen = !isWeekend && utcHours >= 13 && utcHours < 19;

  return {
    london: {
      isOpen: londonOpen,
      openTime: '8:00 AM GMT',
      closeTime: '4:30 PM GMT',
    },
    newYork: {
      isOpen: newYorkOpen,
      openTime: '8:20 AM EST',
      closeTime: '1:30 PM EST',
    },
  };
}

/**
 * Calculate time until market opens or closes
 */
export function getTimeUntilMarketChange(): {
  isOpen: boolean;
  timeUntil: string;
  nextEvent: 'opening' | 'closing';
  marketName: string;
} {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcDay = now.getUTCDay();

  const isWeekend = utcDay === 0 || utcDay === 6;

  // Current time in minutes from midnight UTC
  const currentMinutes = utcHours * 60 + utcMinutes;

  // London market: 8:00 AM - 4:30 PM GMT (480 - 990 minutes)
  const londonOpen = 8 * 60; // 480
  const londonClose = 16 * 60 + 30; // 990

  // Check if weekend
  if (isWeekend) {
    // Calculate minutes until Monday 8:00 AM GMT
    const daysUntilMonday = utcDay === 0 ? 1 : 2; // Sunday = 1 day, Saturday = 2 days
    const minutesUntilMonday = (daysUntilMonday * 24 * 60) + londonOpen - currentMinutes;

    return {
      isOpen: false,
      timeUntil: formatTimeUntil(minutesUntilMonday),
      nextEvent: 'opening',
      marketName: 'London'
    };
  }

  // During London hours
  if (currentMinutes >= londonOpen && currentMinutes < londonClose) {
    const minutesUntilClose = londonClose - currentMinutes;
    return {
      isOpen: true,
      timeUntil: formatTimeUntil(minutesUntilClose),
      nextEvent: 'closing',
      marketName: 'London'
    };
  }

  // Before London opens
  if (currentMinutes < londonOpen) {
    const minutesUntilOpen = londonOpen - currentMinutes;
    return {
      isOpen: false,
      timeUntil: formatTimeUntil(minutesUntilOpen),
      nextEvent: 'opening',
      marketName: 'London'
    };
  }

  // After London closes
  const minutesUntilNextDay = (24 * 60) - currentMinutes + londonOpen;
  return {
    isOpen: false,
    timeUntil: formatTimeUntil(minutesUntilNextDay),
    nextEvent: 'opening',
    marketName: 'London'
  };
}

/**
 * Format minutes into human-readable time string
 */
function formatTimeUntil(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = Math.floor(totalMinutes % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Clear price cache (useful for manual refresh)
 */
export function clearPriceCache(): void {
  priceCache = {
    data: null,
    timestamp: 0,
  };
}
