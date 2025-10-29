import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface GoldPriceData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  lastUpdate: string;
}

export function GoldPriceLive() {
  const [priceData, setPriceData] = useState<GoldPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGoldPrice = async () => {
    try {
      const { data, error } = await supabase
        .from('gold_prices_daily')
        .select('price_date, london_am_rate')
        .order('price_date', { ascending: false })
        .limit(2);

      if (error) throw error;

      if (data && data.length >= 2) {
        const current = data[0].london_am_rate;
        const previous = data[1].london_am_rate;
        const change = current - previous;
        const changePercent = (change / previous) * 100;

        setPriceData({
          current,
          previous,
          change,
          changePercent,
          lastUpdate: data[0].price_date,
        });
      } else if (data && data.length === 1) {
        const current = data[0].london_am_rate;
        setPriceData({
          current,
          previous: current,
          change: 0,
          changePercent: 0,
          lastUpdate: data[0].price_date,
        });
      }
    } catch (error) {
      console.error('Error fetching gold price:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGoldPrice();

    // Refresh every 5 minutes
    const interval = setInterval(fetchGoldPrice, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGoldPrice();
  };

  if (loading) {
    return (
      <div className="relative bg-white/40 backdrop-blur-sm rounded-xl border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
          <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    );
  }

  if (!priceData) {
    return (
      <div className="relative bg-white/40 backdrop-blur-sm rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-600">Gold Price</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">N/A</p>
        <p className="text-xs text-gray-500 mt-1">No data available</p>
      </div>
    );
  }

  const getTrendIcon = () => {
    if (priceData.change > 0) {
      return <TrendingUp className="w-5 h-5 text-green-600" />;
    } else if (priceData.change < 0) {
      return <TrendingDown className="w-5 h-5 text-red-600" />;
    }
    return <Minus className="w-5 h-5 text-gray-600" />;
  };

  const getTrendColor = () => {
    if (priceData.change > 0) return 'text-green-600';
    if (priceData.change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getBgColor = () => {
    if (priceData.change > 0) return 'bg-green-100';
    if (priceData.change < 0) return 'bg-red-100';
    return 'bg-gray-100';
  };

  const getIconBgColor = () => {
    if (priceData.change > 0) return 'bg-green-50';
    if (priceData.change < 0) return 'bg-red-50';
    return 'bg-gray-50';
  };

  return (
    <div className="relative bg-white/40 backdrop-blur-sm rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
      {/* Icon in top-left corner */}
      <div className={`absolute top-4 left-4 w-10 h-10 rounded-lg flex items-center justify-center ${getIconBgColor()}`}>
        {getTrendIcon()}
      </div>

      {/* Content with left padding to avoid icon overlap */}
      <div className="pl-16">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-medium text-gray-600">Gold Price (London AM)</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Refresh price"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-1">
          {/* Current Price */}
          <div className="text-2xl font-bold text-gray-900">
            ${priceData.current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-sm font-normal text-gray-500 ml-1">/oz</span>
          </div>

          {/* Variance */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${getBgColor()}`}>
              <span className={`text-xs font-semibold ${getTrendColor()}`}>
                {priceData.change >= 0 ? '+' : ''}
                ${Math.abs(priceData.change).toFixed(2)}
              </span>
            </div>

            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${getIconBgColor()}`}>
              <span className={`text-xs font-semibold ${getTrendColor()}`}>
                {priceData.changePercent >= 0 ? '+' : ''}
                {priceData.changePercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Last Update */}
          <p className="text-xs text-gray-500">
            Last updated: {new Date(priceData.lastUpdate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
        </div>
      </div>

      {/* Previous Price Reference */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Previous:</span>
          <span className="font-medium text-gray-700">
            ${priceData.previous.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
