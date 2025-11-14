import { Edit, Trash2, Calendar, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { DailyProduction } from '@/services/dailyProductionService';
import { ProductionStatusBadge } from './ProductionStatusBadge';
import { ProductionStatus } from '@/constants/productionStatuses';
import { formatDateStandard } from '@/utils/dateUtils';

interface MiningCompany {
  id: string;
  name: string;
}

interface ProductionTableProps {
  productions: DailyProduction[];
  loading: boolean;
  onEdit: (production: DailyProduction) => void;
  onDelete: (id: string) => void;
  showMiningCompany?: boolean;
  miningCompanies?: MiningCompany[];
}

export function ProductionTable({
  productions,
  loading,
  onEdit,
  onDelete,
  showMiningCompany = false,
  miningCompanies = []
}: ProductionTableProps) {
  const navigate = useNavigate();

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return 'N/A';
    const company = miningCompanies.find(c => c.id === companyId);
    return company?.name || 'N/A';
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        <p className="text-gray-600 mt-4">Chargement des données...</p>
      </div>
    );
  }

  if (productions.length === 0) {
    return (
      <div className="p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Aucune production enregistrée
        </h3>
        <p className="text-gray-600 mb-6">
          Commencez par créer une nouvelle entrée de production journalière
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gradient-to-r from-amber-700 to-orange-700">
            <th className="px-3 py-2.5 text-left text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">DATE</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">BULLION (G)</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">OR (%)</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">AG (%)</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">OR PUR (G)</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">AG (G)</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">OZ ESTIMÉES</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">RÉFÉRENCE</th>
            {showMiningCompany && (
              <th className="px-3 py-2.5 text-left text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">SOCIÉTÉ</th>
            )}
            <th className="px-3 py-2.5 text-left text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">STATUT</th>
            <th className="px-3 py-2.5 text-center text-[10px] font-medium text-white uppercase tracking-wide whitespace-nowrap">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {productions.map((production) => (
            <tr
              key={production.id}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="px-3 py-3 whitespace-nowrap">
                <div className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 text-gray-400 mr-1.5" />
                  <span className="text-xs text-gray-900">
                    {formatDateStandard(production.production_date)}
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right">
                <span className="text-xs text-gray-900">
                  {production.bullion_grams.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800">
                  {(production.estimated_gold_pct || production.estimated_fineness_pct).toFixed(2)}%
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-800">
                  {(production.estimated_silver_pct || 0).toFixed(2)}%
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right">
                <span className="text-xs text-yellow-700">
                  {production.pure_gold_grams.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right">
                <span className="text-xs text-gray-700">
                  {(production.silver_content_grams || 0).toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right">
                <span className="text-xs font-medium text-emerald-700">
                  {production.estimated_oz.toLocaleString('fr-FR', {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4
                  })}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                <span className="text-xs text-gray-700 font-mono">
                  {production.bar_reference || '-'}
                </span>
              </td>
              {showMiningCompany && (
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-xs text-gray-700">
                    {getCompanyName(production.mining_company_id)}
                  </span>
                </td>
              )}
              <td className="px-3 py-3 whitespace-nowrap">
                <ProductionStatusBadge status={(production.status || 'prepared') as ProductionStatus} size="sm" showIcon />
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => navigate(`/production/${production.id}`)}
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Voir détails"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEdit(production)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(production.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gradient-to-r from-amber-700 to-orange-700">
          <tr>
            <td className="px-3 py-2.5 text-xs font-medium text-white uppercase">
              TOTAL
            </td>
            <td className="px-3 py-2.5 text-right text-xs text-white">
              {productions.reduce((sum, p) => sum + p.bullion_grams, 0).toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </td>
            <td className="px-3 py-2.5 text-right text-xs text-white">
              {(() => {
                const validValues = productions.filter(p => p.estimated_fineness_pct > 0);
                return validValues.length > 0 ? (validValues.reduce((sum, p) => sum + p.estimated_fineness_pct, 0) / validValues.length).toFixed(2) : '0.00';
              })()}%
            </td>
            <td className="px-3 py-2.5 text-right text-xs text-white">
              {(() => {
                const validValues = productions.filter(p => (p.estimated_silver_pct || 0) > 0);
                return validValues.length > 0 ? (validValues.reduce((sum, p) => sum + (p.estimated_silver_pct || 0), 0) / validValues.length).toFixed(2) : '0.00';
              })()}%
            </td>
            <td className="px-3 py-2.5 text-right text-xs text-white">
              {productions.reduce((sum, p) => sum + p.pure_gold_grams, 0).toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </td>
            <td className="px-3 py-2.5 text-right text-xs text-white">
              {productions.reduce((sum, p) => sum + (p.silver_content_grams || 0), 0).toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </td>
            <td className="px-3 py-2.5 text-right text-xs text-white">
              {productions.reduce((sum, p) => sum + p.estimated_oz, 0).toLocaleString('fr-FR', {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4
              })}
            </td>
            <td className="px-3 py-2.5 text-white"></td>
            {showMiningCompany && (
              <td className="px-3 py-2.5 text-white"></td>
            )}
            <td colSpan={2} className="px-3 py-2.5 text-xs text-white">
              {productions.length} barres · {productions.reduce((sum, p) => sum + p.estimated_oz, 0).toFixed(2)} oz total
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
