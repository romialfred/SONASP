import { useState, useEffect, useCallback } from 'react';
import { getCurrentGoldPrice, type GoldPrice } from '@/services/goldPriceService';

export interface UseLiveGoldPriceOptions {
  refreshInterval?: number;
  autoRefresh?: boolean;
}

export interface UseLiveGoldPriceResult {
  goldPrice: GoldPrice | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
}

export function useLiveGoldPrice(
  options: UseLiveGoldPriceOptions = {}
): UseLiveGoldPriceResult {
  const { refreshInterval = 60000, autoRefresh = true } = options;

  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (loading) return;

    setRefreshing(true);
    setError(null);

    try {
      const result = await getCurrentGoldPrice();

      if (result.success && result.data) {
        setGoldPrice(result.data);
        setLastUpdate(new Date());
      } else {
        setError(result.error || 'Failed to fetch gold price');
      }
    } catch (err) {
      console.error('Error fetching gold price:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    refresh();

    if (!autoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    goldPrice,
    loading,
    refreshing,
    error,
    lastUpdate,
    refresh,
  };
}
