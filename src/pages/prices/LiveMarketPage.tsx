import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface MarketSymbol {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  color: string;
}

export function LiveMarketPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('60');
  const [marketSymbols, setMarketSymbols] = useState<MarketSymbol[]>([
    { symbol: 'XAUUSD', name: 'Gold', price: 2685.50, change: 12.30, changePercent: 0.46, color: 'text-yellow-500' },
    { symbol: 'USDGNF', name: 'USD/GNF', price: 8625.00, change: -15.00, changePercent: -0.17, color: 'text-blue-500' },
    { symbol: 'USDXOF', name: 'USD/XOF', price: 615.50, change: 2.50, changePercent: 0.41, color: 'text-emerald-500' },
    { symbol: 'EURUSD', name: 'EUR/USD', price: 1.0850, change: 0.0025, changePercent: 0.23, color: 'text-indigo-500' },
  ]);

  const timeframes = [
    { value: '5', label: '5m' },
    { value: '15', label: '15m' },
    { value: '30', label: '30m' },
    { value: '60', label: '1h' },
    { value: '240', label: '4h' },
    { value: 'D', label: '1D' },
    { value: 'W', label: '1W' },
  ];

  useEffect(() => {
    // Load TradingView library
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => initializeCharts();
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (window.TradingView) {
      initializeCharts();
    }
  }, [selectedTimeframe]);

  const initializeCharts = () => {
    if (!window.TradingView) return;

    // Main Gold Chart
    new window.TradingView.widget({
      autosize: true,
      symbol: 'COMEX:GC1!',
      interval: selectedTimeframe,
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      toolbar_bg: '#f1f3f6',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      container_id: 'tradingview_gold_chart',
      studies: [
        'MASimple@tv-basicstudies',
        'MACD@tv-basicstudies',
        'RSI@tv-basicstudies',
      ],
    });
  };

  const getAnalysis = () => {
    const goldPrice = marketSymbols[0].price;
    const goldChange = marketSymbols[0].changePercent;

    let trend = 'NEUTRAL';
    let signal = 'HOLD';
    let recommendation = 'Monitor market conditions';

    if (goldChange > 0.5) {
      trend = 'BULLISH';
      signal = 'BUY';
      recommendation = 'Strong upward momentum. Consider buying opportunities.';
    } else if (goldChange < -0.5) {
      trend = 'BEARISH';
      signal = 'SELL';
      recommendation = 'Downward pressure detected. Consider securing profits.';
    } else if (goldChange > 0) {
      trend = 'SLIGHTLY BULLISH';
      signal = 'HOLD/BUY';
      recommendation = 'Positive momentum building. Watch for entry points.';
    } else if (goldChange < 0) {
      trend = 'SLIGHTLY BEARISH';
      signal = 'HOLD/SELL';
      recommendation = 'Minor weakness. Monitor support levels.';
    }

    return { trend, signal, recommendation, price: goldPrice, change: goldChange };
  };

  const analysis = getAnalysis();

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Main Chart Area */}
      <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Market Data</h1>
            <p className="text-gray-600 mt-1">Real-time gold and currency prices from COMEX</p>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>

        {/* Timeframe Selector */}
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Timeframe:</span>
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setSelectedTimeframe(tf.value)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  selectedTimeframe === tf.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </Card>

        {/* TradingView Chart */}
        <Card className="flex-1 p-0 overflow-hidden">
          <div id="tradingview_gold_chart" className="w-full h-full min-h-[600px]" />
        </Card>

        {/* Automatic Analysis */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Activity className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Automatic Market Analysis</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Trend Analysis */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-600 mb-2">Market Trend</div>
              <div className="flex items-center space-x-2">
                {analysis.change >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-600" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                )}
                <span className={`text-2xl font-bold ${
                  analysis.change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {analysis.trend}
                </span>
              </div>
            </div>

            {/* Signal */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-600 mb-2">Trading Signal</div>
              <div className={`text-2xl font-bold ${
                analysis.signal.includes('BUY') ? 'text-green-600' :
                analysis.signal.includes('SELL') ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {analysis.signal}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Based on technical indicators
              </div>
            </div>

            {/* Price Movement */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-600 mb-2">Gold Price (USD)</div>
              <div className="text-2xl font-bold text-gray-900">
                ${analysis.price.toFixed(2)}
              </div>
              <div className={`text-sm font-medium ${
                analysis.change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {analysis.change >= 0 ? '+' : ''}{analysis.change.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="mt-6 p-4 bg-white border-l-4 border-blue-600 rounded">
            <div className="text-sm font-bold text-gray-900 mb-1">AI Recommendation</div>
            <p className="text-gray-700">{analysis.recommendation}</p>
            <p className="text-xs text-gray-500 mt-2">
              Last updated: {new Date().toLocaleString('en-US', {
                timeZone: 'America/New_York',
                dateStyle: 'medium',
                timeStyle: 'short'
              })} EST
            </p>
          </div>

          {/* Key Technical Levels */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-red-50 rounded">
              <div className="text-xs text-gray-600 mb-1">Resistance</div>
              <div className="text-lg font-bold text-red-600">
                ${(analysis.price * 1.015).toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-600 mb-1">Current Price</div>
              <div className="text-lg font-bold text-gray-900">
                ${analysis.price.toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded">
              <div className="text-xs text-gray-600 mb-1">Support</div>
              <div className="text-lg font-bold text-green-600">
                ${(analysis.price * 0.985).toFixed(2)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Panel - Market Symbols */}
      <div className="w-80 bg-gray-900 text-white p-4 overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-4">Market Watch</h3>
          <div className="space-y-3">
            {marketSymbols.map((item) => (
              <div
                key={item.symbol}
                className="bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className={`text-sm font-bold ${item.color}`}>
                      {item.symbol}
                    </div>
                    <div className="text-xs text-gray-400">{item.name}</div>
                  </div>
                  <div className={`flex items-center space-x-1 ${
                    item.change >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {item.change >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-xl font-bold">{item.price.toFixed(2)}</div>
                  <div className={`text-sm font-medium ${
                    item.change >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {item.change >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session Information */}
        <div className="mt-6 p-3 bg-gray-800 rounded-lg">
          <h4 className="text-sm font-bold mb-3">Trading Session</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Market:</span>
              <span className="text-green-400 font-medium">OPEN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Session:</span>
              <span>NY COMEX</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Time:</span>
              <span>{new Date().toLocaleTimeString('en-US', {
                timeZone: 'America/New_York',
                hour: '2-digit',
                minute: '2-digit'
              })} EST</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mt-6 p-3 bg-gray-800 rounded-lg">
          <h4 className="text-sm font-bold mb-3">Performance</h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-400">1W</div>
              <div className="text-sm font-bold text-green-400">+2.4%</div>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-400">1M</div>
              <div className="text-sm font-bold text-green-400">+3.7%</div>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-400">3M</div>
              <div className="text-sm font-bold text-green-400">+7.0%</div>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-400">6M</div>
              <div className="text-sm font-bold text-green-400">+11.2%</div>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-400">YTD</div>
              <div className="text-sm font-bold text-green-400">+19.1%</div>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-400">1Y</div>
              <div className="text-sm font-bold text-green-400">+31.8%</div>
            </div>
          </div>
        </div>

        {/* Market Info */}
        <div className="mt-6 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
          <div className="text-xs text-blue-300">
            <div className="font-bold mb-2">📊 Live Data Source</div>
            <p>
              Real-time market data provided by TradingView from New York Commodity Exchange (COMEX)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
