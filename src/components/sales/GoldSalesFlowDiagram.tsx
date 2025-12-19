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

  // Flow 1: KGM → MMME → Multiple End Buyers
  const kgmFlow = {
    mine: { id: 'kgm', name: 'KGM', fullName: 'Kourousa Guinea Mining', type: 'mine', percentage: 100, color: 'from-blue-500 to-blue-600' },
    intermediary: { id: 'mmme', name: 'MMME', fullName: 'Mansa Management Middle East', type: 'company', percentage: 100, color: 'from-amber-500 to-amber-600' },
    endBuyers: [
      { id: 'auranet', name: 'Auranet', type: 'buyer', percentage: 93, color: 'from-teal-500 to-teal-600' },
      { id: 'aurion', name: 'Aurion', type: 'buyer', percentage: 5, color: 'from-orange-500 to-orange-600' },
      { id: 'cig', name: 'CIG', fullName: 'Coris Investment Group', type: 'buyer', percentage: 2, color: 'from-pink-500 to-pink-600' },
    ]
  };

  // Flow 2: SMK → HBR → Auramet
  const smkFlow = {
    mine: { id: 'smk', name: 'SMK', fullName: 'Société des Mines Komana', type: 'mine', percentage: 100, color: 'from-green-500 to-green-600' },
    intermediary: { id: 'hbr', name: 'HBR', fullName: 'Hummingbird Resources', type: 'company', percentage: 100, color: 'from-purple-500 to-purple-600' },
    endBuyers: [
      { id: 'auramet', name: 'Auramet', type: 'buyer', percentage: 100, color: 'from-cyan-500 to-cyan-600' },
    ]
  };

  const renderFlowNode = (node: any, label: string) => (
    <div className="flex-shrink-0 w-40">
      <div className="text-center mb-2">
        <span className="inline-block px-2 py-1 bg-slate-100 rounded-full text-[10px] font-semibold text-slate-700">
          {label}
        </span>
      </div>
      <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${node.color} p-2.5 shadow-md`}>
        <div className="relative z-10 text-center text-white">
          <div className="inline-flex items-center justify-center w-8 h-8 bg-white/20 rounded-lg backdrop-blur-sm mb-1.5">
            <Building2 className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold mb-0.5">{node.name}</h3>
          {node.fullName && <p className="text-[9px] text-white/80 mb-1.5">{node.fullName}</p>}
          <div className="bg-white/20 backdrop-blur-sm rounded px-2 py-1">
            <p className="text-lg font-bold">{node.percentage}%</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEndBuyer = (buyer: any) => (
    <div key={buyer.id} className="group relative">
      <div className={`relative overflow-hidden rounded-lg bg-gradient-to-r ${buyer.color} p-2 shadow-md hover:shadow-lg transition-all duration-300`}>
        <div className="relative z-10 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-white/20 rounded backdrop-blur-sm">
              <Building2 className="w-3 h-3" />
            </div>
            <div>
              <p className="font-bold text-xs">{buyer.name}</p>
              {buyer.fullName && <p className="text-[9px] text-white/70">{buyer.fullName}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-bold">{buyer.percentage}%</p>
          </div>
        </div>
      </div>
    </div>
  );

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

        {/* Flow Diagrams */}
        <div className="relative space-y-8">
          {/* Flow 1: KGM → MMME → Multiple End Buyers */}
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
            <h3 className="text-sm font-bold text-blue-900 mb-3">Flow 1: KGM Production</h3>
            <div className="flex items-center gap-3">
              {renderFlowNode(kgmFlow.mine, 'Mine')}

              <ArrowRight className="w-6 h-6 text-blue-600 flex-shrink-0" />

              {renderFlowNode(kgmFlow.intermediary, 'Intermediary')}

              <ArrowRight className="w-6 h-6 text-teal-600 flex-shrink-0" />

              <div className="flex-1 space-y-2">
                <div className="text-center mb-2">
                  <span className="inline-block px-2 py-1 bg-slate-100 rounded-full text-[10px] font-semibold text-slate-700">
                    {t('tradeSpace.endBuyers', 'End Buyers')}
                  </span>
                </div>
                {kgmFlow.endBuyers.map(renderEndBuyer)}
              </div>
            </div>
          </div>

          {/* Flow 2: SMK → HBR → Auramet */}
          <div className="border border-green-200 rounded-lg p-4 bg-green-50/30">
            <h3 className="text-sm font-bold text-green-900 mb-3">Flow 2: SMK Production</h3>
            <div className="flex items-center gap-3">
              {renderFlowNode(smkFlow.mine, 'Mine')}

              <ArrowRight className="w-6 h-6 text-green-600 flex-shrink-0" />

              {renderFlowNode(smkFlow.intermediary, 'Intermediary')}

              <ArrowRight className="w-6 h-6 text-purple-600 flex-shrink-0" />

              <div className="flex-1 space-y-2">
                <div className="text-center mb-2">
                  <span className="inline-block px-2 py-1 bg-slate-100 rounded-full text-[10px] font-semibold text-slate-700">
                    {t('tradeSpace.endBuyer', 'End Buyer')}
                  </span>
                </div>
                {smkFlow.endBuyers.map(renderEndBuyer)}
              </div>
            </div>
          </div>

          {/* Summary Footer */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold text-blue-700">2</p>
                <p className="text-[10px] text-blue-600 mt-0.5">{t('tradeSpace.minesCount', 'Mining Operations')}</p>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded-lg">
                <p className="text-lg font-bold text-amber-700">2</p>
                <p className="text-[10px] text-amber-600 mt-0.5">{t('tradeSpace.intermediaries', 'Intermediaries')}</p>
              </div>
              <div className="text-center p-2 bg-teal-50 rounded-lg">
                <p className="text-lg font-bold text-teal-700">4</p>
                <p className="text-[10px] text-teal-600 mt-0.5">{t('tradeSpace.endBuyersCount', 'End Buyers')}</p>
              </div>
              <div className="text-center p-2 bg-pink-50 rounded-lg">
                <p className="text-lg font-bold text-pink-700">100%</p>
                <p className="text-[10px] text-pink-600 mt-0.5">{t('tradeSpace.distribution', 'Distribution')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
