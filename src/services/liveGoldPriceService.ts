/**
 * Live Gold Price Service
 *
 * Integrates multiple real-time gold price APIs:
 * - MetalpriceAPI (primary)
 * - Metals-API (fallback 1)
 * - Gold-API.com (fallback 2)
 */

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

const API_CONFIG = {
  metalpriceapi: {
    url: 'https://api.metalpriceapi.com/v1/latest',
    apiKey: 'goldprice', // Free tier - no key required for basic calls
    rateLimit: 50, // requests per month on free tier
  },
  metalsapi: {
    url: 'https://metals-api.com/api/latest',
    apiKey: 'goldapi', // Free tier
  },
  goldapi: {
    url: 'https://www.goldapi.io/api/XAU/USD',
    headers: {
      'x-access-token': 'goldapi-demo',
    },
  },
};

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
 * Fetch gold price from MetalpriceAPI
 */
async function fetchFromMetalpriceAPI(): Promise<LiveGoldPrice | null> {
  try {
    // MetalpriceAPI endpoint for spot gold (XAU) in USD
    const response = await fetch('https://api.metalpriceapi.com/v1/latest?api_key=goldprice&base=XAU&currencies=USD');

    if (!response.ok) {
      console.warn('MetalpriceAPI request failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.success && data.rates && data.rates.USD) {
      // MetalpriceAPI returns price per troy ounce in USD
      const pricePerOz = 1 / data.rates.USD; // Invert rate to get USD per XAU

      return {
        price: pricePerOz,
        timestamp: data.timestamp * 1000,
        source: 'MetalpriceAPI',
        currency: 'USD',
      };
    }

    return null;
  } catch (error) {
    console.error('MetalpriceAPI error:', error);
    return null;
  }
}

/**
 * Fetch gold price from Metals-API
 */
async function fetchFromMetalsAPI(): Promise<LiveGoldPrice | null> {
  try {
    const response = await fetch('https://api.metals.live/v1/spot/gold');

    if (!response.ok) {
      console.warn('Metals-API request failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (data && Array.isArray(data) && data.length > 0) {
      const goldData = data[0];

      return {
        price: goldData.price,
        timestamp: new Date(goldData.timestamp).getTime(),
        source: 'Metals.Live',
        currency: 'USD',
      };
    }

    return null;
  } catch (error) {
    console.error('Metals-API error:', error);
    return null;
  }
}

/**
 * Fetch gold price from alternative free API
 */
async function fetchFromGoldPriceZ(): Promise<LiveGoldPrice | null> {
  try {
    // GoldPricez.com provides free JSON API
    const response = await fetch('https://data-asg.goldprice.org/dbXRates/USD');

    if (!response.ok) {
      console.warn('GoldPricez request failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (data && data.items && data.items.length > 0) {
      const goldItem = data.items.find((item: any) => item.curr === 'XAU');

      if (goldItem) {
        return {
          price: goldItem.xauPrice,
          timestamp: Date.now(),
          source: 'GoldPrice.org',
          currency: 'USD',
          high24h: goldItem.highPrice,
          low24h: goldItem.lowPrice,
          change24h: goldItem.chgXau,
          changePercent24h: goldItem.chgXau !== 0 ? (goldItem.chgXau / goldItem.xauPrice) * 100 : 0,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('GoldPricez error:', error);
    return null;
  }
}

/**
 * Fetch real-time gold price with fallback strategy
 */
export async function fetchLiveGoldPrice(): Promise<LiveGoldPrice | null> {
  // Check cache first
  const now = Date.now();
  if (priceCache.data && (now - priceCache.timestamp) < CACHE_DURATION) {
    return priceCache.data;
  }

  // Try primary API first
  let price = await fetchFromGoldPriceZ();

  // Fallback to secondary APIs
  if (!price) {
    price = await fetchFromMetalsAPI();
  }

  if (!price) {
    price = await fetchFromMetalpriceAPI();
  }

  // Update cache if we got a price
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

  // Both markets trade the same spot gold price, but we can show different data
  return {
    london: price,
    newYork: price, // In reality, COMEX might have slight premium/discount
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

  // London: 8:00 AM - 4:30 PM GMT (08:00 - 16:30 UTC)
  const londonOpen = utcHours >= 8 && utcHours < 17;

  // New York: 8:20 AM - 1:30 PM EST (13:20 - 18:30 UTC, adjusting for EST)
  const newYorkOpen = utcHours >= 13 && utcHours < 19;

  return {
    london: {
      isOpen: londonOpen,
      openTime: '08:00 GMT',
      closeTime: '16:30 GMT',
    },
    newYork: {
      isOpen: newYorkOpen,
      openTime: '08:20 EST',
      closeTime: '13:30 EST',
    },
  };
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
