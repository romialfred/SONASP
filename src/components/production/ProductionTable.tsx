import { Edit, Trash2, Calendar, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { DailyProduction } from '@/services/dailyProductionService';
import { ProductionStatusBadge } from './ProductionStatusBadge';
import { ProductionStatus } from '@/constants/productionStatuses';

interface ProductionTableProps {
  productions: DailyProduction[];
  loading: boolean;
  onEdit: (production: DailyProduction) => void;
  onDelete: (id: string) => void;
}

export function ProductionTable({ productions, loading, onEdit, onDelete }: ProductionTableProps) {
  const navigate = useNavigate();
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Bullion (g)
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Fineness (%)
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Pure Gold (g)
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Est. Oz
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Bar Reference
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Statut
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {productions.map((production) => (
            <tr
              key={production.id}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-900">
                    {formatDate(production.production_date)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm text-gray-900 font-medium">
                  {production.bullion_grams.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {production.estimated_fineness_pct.toFixed(2)}%
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm font-semibold text-yellow-700">
                  {production.pure_gold_grams.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm font-bold text-emerald-700">
                  {production.estimated_oz.toLocaleString('fr-FR', {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4
                  })}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-700 font-mono">
                  {production.bar_reference || '-'}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <ProductionStatusBadge status={(production.status || 'prepared') as ProductionStatus} size="sm" showIcon />
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-center">
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
        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
          <tr>
            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
              TOTAL
            </td>
            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
              {productions.reduce((sum, p) => sum + p.bullion_grams, 0).toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </td>
            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
              {(productions.reduce((sum, p) => sum + p.estimated_fineness_pct, 0) / productions.length).toFixed(2)}%
              <span className="text-xs text-gray-500 ml-1">(avg)</span>
            </td>
            <td className="px-4 py-3 text-right text-sm font-bold text-yellow-700">
              {productions.reduce((sum, p) => sum + p.pure_gold_grams, 0).toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </td>
            <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">
              {productions.reduce((sum, p) => sum + p.estimated_oz, 0).toLocaleString('fr-FR', {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4
              })}
            </td>
            <td colSpan={3} className="px-4 py-3 text-sm text-gray-600">
              {productions.length} enregistrement(s)
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
