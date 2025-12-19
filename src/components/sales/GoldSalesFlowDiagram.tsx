import { useTranslation } from 'react-i18next';
import { Building2, ArrowRight, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface FlowNode {
  id: string;
  name: string;
  type: 'mine' | 'company' | 'buyer';
  percentage?: number;
  color: string;
}

export function GoldSalesFlowDiagram() {
  const { t } = useTranslation();

  const mines: FlowNode[] = [
    { id: 'kgm', name: 'Kouroussa (KGM)', type: 'mine', percentage: 100, color: 'from-blue-500 to-blue-600' },
    { id: 'dgb', name: 'Dugbe (DGB)', type: 'mine', percentage: 100, color: 'from-purple-500 to-purple-600' },
    { id: 'smk', name: 'SMK (Komana)', type: 'mine', percentage: 100, color: 'from-green-500 to-green-600' },
  ];

  const buyers: FlowNode[] = [
    { id: 'aurion', name: 'Aurion', type: 'buyer', percentage: 5, color: 'from-orange-500 to-orange-600' },
    { id: 'cig', name: 'Coris Investment Group', type: 'buyer', percentage: 2, color: 'from-pink-500 to-pink-600' },
  ];

  return (
    <Card className="bg-gradient-to-br from-slate-50 via-white to-slate-50 border-2 border-slate-200">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg shadow-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('tradeSpace.salesFlowTitle', 'Gold Sales Flow')}</h2>
            <p className="text-xs text-gray-600">{t('tradeSpace.salesFlowSubtitle', 'Complete supply chain from mines to end buyers')}</p>
          </div>
        </div>

        {/* Flow Diagram */}
        <div className="relative space-y-6">
          {/* Line 1: Stage 1 → Stage 2 → Auramet (Primary Buyer) */}
          <div className="flex items-center gap-4">
            {/* Mines Column */}
            <div className="flex-1 space-y-2">
              <div className="text-center mb-2">
                <span className="inline-block px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
                  {t('tradeSpace.stage1', 'Stage 1: Mine Production')}
                </span>
              </div>
              {mines.map((mine, index) => (
                <div
                  key={mine.id}
                  className="group relative"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`relative overflow-hidden rounded-lg bg-gradient-to-r ${mine.color} p-2 shadow-md hover:shadow-lg transition-all duration-300`}>
                    <div className="relative z-10 flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-white/20 rounded backdrop-blur-sm">
                          <Building2 className="w-3 h-3" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{mine.name}</p>
                          <p className="text-[10px] text-white/80">{t('tradeSpace.mine', 'Mine')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{mine.percentage}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center px-3">
              <ArrowRight className="w-8 h-8 text-amber-600 animate-pulse" />
            </div>

            {/* Mansa Resources */}
            <div className="flex-shrink-0 w-48">
              <div className="text-center mb-2">
                <span className="inline-block px-3 py-1 bg-amber-100 rounded-full text-xs font-semibold text-amber-800">
                  {t('tradeSpace.stage2', 'Stage 2')}
                </span>
              </div>
              <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 p-3 shadow-lg">
                <div className="relative z-10 text-center text-white">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-white/20 rounded-lg backdrop-blur-sm mb-2">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold mb-1">Mansa Resources</h3>
                  <p className="text-[10px] text-white/90 mb-2">{t('tradeSpace.goldAggregator', 'Gold Aggregator')}</p>
                  <div className="bg-white/20 backdrop-blur-sm rounded p-2">
                    <p className="text-xl font-bold">100%</p>
                    <p className="text-[9px] text-white/80">{t('tradeSpace.consolidatedStock', 'Stock')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center px-3">
              <ArrowRight className="w-8 h-8 text-teal-600 animate-pulse" />
            </div>

            {/* Auramet (Primary Buyer) */}
            <div className="flex-shrink-0 w-48">
              <div className="text-center mb-2">
                <span className="inline-block px-3 py-1 bg-teal-100 rounded-full text-xs font-semibold text-teal-800">
                  {t('tradeSpace.primaryBuyer', 'Primary Buyer')}
                </span>
              </div>
              <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-600 p-3 shadow-lg">
                <div className="relative z-10 text-center text-white">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-white/20 rounded-lg backdrop-blur-sm mb-2">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold mb-1">Auramet</h3>
                  <p className="text-[10px] text-white/90 mb-2">{t('tradeSpace.primaryBuyer', 'Primary Buyer')}</p>
                  <div className="bg-white/20 backdrop-blur-sm rounded p-2">
                    <p className="text-xl font-bold">100%</p>
                    <p className="text-[9px] text-white/80">{t('tradeSpace.receives', 'Receives')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Line 2: Stage 3 → Stage 4 */}
          <div className="flex items-center gap-4">
            {/* Auramet Redistribution */}
            <div className="flex-shrink-0 w-48">
              <div className="text-center mb-2">
                <span className="inline-block px-3 py-1 bg-teal-100 rounded-full text-xs font-semibold text-teal-800">
                  {t('tradeSpace.stage3', 'Stage 3')}
                </span>
              </div>
              <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 p-3 shadow-lg">
                <div className="relative z-10 text-center text-white">
                  <Building2 className="w-5 h-5 mx-auto mb-2" />
                  <h4 className="text-sm font-bold">Auramet</h4>
                  <p className="text-[10px] text-white/80 mt-1">{t('tradeSpace.distributes', 'Distributes')}</p>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center px-3">
              <ArrowRight className="w-8 h-8 text-slate-600" />
            </div>

            {/* End Buyers Column */}
            <div className="flex-1 space-y-2">
              <div className="text-center mb-2">
                <span className="inline-block px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
                  {t('tradeSpace.stage4', 'Stage 4: End Buyers')}
                </span>
              </div>
              {buyers.map((buyer, index) => (
                <div
                  key={buyer.id}
                  className="group relative"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`relative overflow-hidden rounded-lg bg-gradient-to-r ${buyer.color} p-2 shadow-md hover:shadow-lg transition-all duration-300`}>
                    <div className="relative z-10 flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-white/20 rounded backdrop-blur-sm">
                          <Building2 className="w-3 h-3" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{buyer.name}</p>
                          <p className="text-[10px] text-white/80">{t('tradeSpace.endBuyer', 'End Buyer')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{buyer.percentage}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Footer */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold text-blue-700">3</p>
                <p className="text-[10px] text-blue-600 mt-0.5">{t('tradeSpace.minesCount', 'Mining Operations')}</p>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded-lg">
                <p className="text-lg font-bold text-amber-700">100%</p>
                <p className="text-[10px] text-amber-600 mt-0.5">{t('tradeSpace.consolidation', 'Consolidation Rate')}</p>
              </div>
              <div className="text-center p-2 bg-teal-50 rounded-lg">
                <p className="text-lg font-bold text-teal-700">1</p>
                <p className="text-[10px] text-teal-600 mt-0.5">{t('tradeSpace.primaryBuyerCount', 'Primary Buyer')}</p>
              </div>
              <div className="text-center p-2 bg-pink-50 rounded-lg">
                <p className="text-lg font-bold text-pink-700">2</p>
                <p className="text-[10px] text-pink-600 mt-0.5">{t('tradeSpace.endBuyersCount', 'End Buyers')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
