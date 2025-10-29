import { Card } from '@/components/ui/Card';
import { Building2, Globe, Clock, AlertCircle } from 'lucide-react';

export function MarketInfoWidget() {
  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-white">
          <Globe className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-lg">Global Gold Markets</h3>
        </div>

        <div className="space-y-3">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">London LBMA</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Market</span>
                <span className="text-slate-200 font-medium">London Bullion Market</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Trading Hours</span>
                <span className="text-slate-200 font-medium">8:00 AM - 4:30 PM GMT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Price Fixing</span>
                <span className="text-slate-200 font-medium">10:30 AM & 3:00 PM</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-400 text-xs font-medium">Market Open</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">NYSE (COMEX)</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Market</span>
                <span className="text-slate-200 font-medium">New York Commodity Exchange</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Trading Hours</span>
                <span className="text-slate-200 font-medium">8:20 AM - 1:30 PM EST</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Electronic</span>
                <span className="text-slate-200 font-medium">6:00 PM - 5:00 PM EST</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-400 text-xs font-medium">Market Open</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-amber-900/20 rounded-lg p-3 border border-amber-700/50">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 space-y-1">
              <p className="font-semibold">Trading Information</p>
              <p className="text-amber-300/80">
                Prices are based on London AM Fix (LBMA) and COMEX futures.
                All transactions are settled within 2 business days (T+2).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-700">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400">
            Market data updates every 60 seconds
          </span>
        </div>
      </div>
    </Card>
  );
}
