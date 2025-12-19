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
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('tradeSpace.salesFlowTitle', 'Gold Sales Flow')}</h2>
            <p className="text-sm text-gray-600">{t('tradeSpace.salesFlowSubtitle', 'Complete supply chain from mines to end buyers')}</p>
          </div>
        </div>

        {/* Flow Diagram */}
        <div className="relative">
          {/* Stage 1: Mines to Mansa Resources */}
          <div className="flex items-center justify-between mb-12">
            {/* Mines Column */}
            <div className="flex-1 space-y-4">
              <div className="text-center mb-4">
                <span className="inline-block px-4 py-2 bg-slate-100 rounded-full text-sm font-semibold text-slate-700">
                  {t('tradeSpace.stage1', 'Stage 1: Mine Production')}
                </span>
              </div>
              {mines.map((mine, index) => (
                <div
                  key={mine.id}
                  className="group relative"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${mine.color} p-4 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105`}>
                    <div className="relative z-10 flex items-center justify-between text-white">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{mine.name}</p>
                          <p className="text-xs text-white/80">{t('tradeSpace.mine', 'Mine')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{mine.percentage}%</p>
                        <p className="text-xs text-white/80">{t('tradeSpace.toMansa', 'to Mansa')}</p>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center px-8">
              <div className="flex flex-col items-center gap-2">
                <ArrowRight className="w-12 h-12 text-amber-600 animate-pulse" />
                <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">100% Stock</span>
              </div>
            </div>

            {/* Mansa Resources */}
            <div className="flex-1">
              <div className="text-center mb-4">
                <span className="inline-block px-4 py-2 bg-amber-100 rounded-full text-sm font-semibold text-amber-800">
                  {t('tradeSpace.stage2', 'Stage 2: Consolidation')}
                </span>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 p-6 shadow-2xl">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative z-10 text-center text-white">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-sm mb-4">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Mansa Resources</h3>
                  <p className="text-sm text-white/90 mb-4">{t('tradeSpace.goldAggregator', 'Gold Aggregator')}</p>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                    <p className="text-3xl font-bold">100%</p>
                    <p className="text-xs text-white/80">{t('tradeSpace.consolidatedStock', 'Consolidated Stock')}</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-orange-400/20 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>

          {/* Stage 2: Mansa Resources to Auramet */}
          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-700 mb-1">{t('tradeSpace.mansaSells', 'Mansa Resources sells')}</p>
                <p className="text-3xl font-bold text-amber-600">100%</p>
              </div>
              <ArrowRight className="w-12 h-12 text-teal-600 animate-pulse" />
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-600 p-6 shadow-2xl min-w-[280px]">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative z-10 text-center text-white">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-sm mb-4">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Auramet</h3>
                  <p className="text-sm text-white/90 mb-4">{t('tradeSpace.primaryBuyer', 'Primary Buyer')}</p>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                    <p className="text-3xl font-bold">100%</p>
                    <p className="text-xs text-white/80">{t('tradeSpace.receives', 'Receives')}</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>

          {/* Stage 3: Auramet to End Buyers */}
          <div className="flex items-center justify-between">
            {/* Auramet Redistribution */}
            <div className="flex-1">
              <div className="text-center mb-4">
                <span className="inline-block px-4 py-2 bg-teal-100 rounded-full text-sm font-semibold text-teal-800">
                  {t('tradeSpace.stage3', 'Stage 3: Redistribution')}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 p-5 shadow-xl w-64">
                  <div className="relative z-10 text-center text-white">
                    <Building2 className="w-8 h-8 mx-auto mb-2" />
                    <h4 className="text-xl font-bold">Auramet</h4>
                    <p className="text-xs text-white/80 mt-1">{t('tradeSpace.distributes', 'Distributes')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrows */}
            <div className="flex flex-col items-center justify-center px-8 gap-8">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-10 h-10 text-orange-600" />
                <span className="text-xs font-semibold text-orange-700">5%</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-10 h-10 text-pink-600" />
                <span className="text-xs font-semibold text-pink-700">2%</span>
              </div>
            </div>

            {/* End Buyers Column */}
            <div className="flex-1 space-y-4">
              <div className="text-center mb-4">
                <span className="inline-block px-4 py-2 bg-slate-100 rounded-full text-sm font-semibold text-slate-700">
                  {t('tradeSpace.stage4', 'Stage 4: End Buyers')}
                </span>
              </div>
              {buyers.map((buyer, index) => (
                <div
                  key={buyer.id}
                  className="group relative"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${buyer.color} p-4 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105`}>
                    <div className="relative z-10 flex items-center justify-between text-white">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{buyer.name}</p>
                          <p className="text-xs text-white/80">{t('tradeSpace.endBuyer', 'End Buyer')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{buyer.percentage}%</p>
                        <p className="text-xs text-white/80">{t('tradeSpace.fromAuramet', 'from Auramet')}</p>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Footer */}
          <div className="mt-12 pt-8 border-t-2 border-slate-200">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">3</p>
                <p className="text-xs text-blue-600 mt-1">{t('tradeSpace.minesCount', 'Mining Operations')}</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-700">100%</p>
                <p className="text-xs text-amber-600 mt-1">{t('tradeSpace.consolidation', 'Consolidation Rate')}</p>
              </div>
              <div className="text-center p-4 bg-teal-50 rounded-lg">
                <p className="text-2xl font-bold text-teal-700">1</p>
                <p className="text-xs text-teal-600 mt-1">{t('tradeSpace.primaryBuyerCount', 'Primary Buyer')}</p>
              </div>
              <div className="text-center p-4 bg-pink-50 rounded-lg">
                <p className="text-2xl font-bold text-pink-700">2</p>
                <p className="text-xs text-pink-600 mt-1">{t('tradeSpace.endBuyersCount', 'End Buyers')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
