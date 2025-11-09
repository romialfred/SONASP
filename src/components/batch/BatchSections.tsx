import { Package, Clock, CheckCircle, TrendingUp, Scale, Calendar, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { getBatchStatusLabel, getBatchStatusVariant, BATCH_STATUSES } from '@/constants/batchStatuses';
import { formatWeight } from '@/utils/batchUtils';
import Button from '@/components/ui/Button';

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  metal_type?: string;
  shipping_date?: string;
  created_at: string;
  mining_company?: {
    name: string;
    country?: string;
  };
  license?: {
    license_number: string;
    status: string;
  };
  sale_id?: string;
}

interface BatchSectionsProps {
  batches: Batch[];
  onBatchClick?: (batchId: string) => void;
  onValidateTransport?: (batchId: string) => void;
  validatingBatchId?: string | null;
}

const ACTIVE_STATUSES = [
  'pending_factory_approval',
];

const PIPELINE_STATUSES = [
  'approved_for_transport',
  'waiting_airport_receipt',
  'received_at_airport',
  'validated_at_airport',
  'validated_for_refinery',
  'waiting_refinery_receipt',
  'received_at_refinery',
  'validated_for_processing',
  'processing',
  'in_inventory',
  'processed',
];

export function BatchSections({ batches, onBatchClick, onValidateTransport, validatingBatchId }: BatchSectionsProps) {
  const [expandedSections, setExpandedSections] = useState({
    active: true,
    pipeline: true,
    sold: false,
  });

  const activeBatches = batches.filter((b) => ACTIVE_STATUSES.includes(b.status));
  const pipelineBatches = batches.filter((b) => PIPELINE_STATUSES.includes(b.status) && !b.sale_id);
  const soldBatches = batches.filter((b) => b.sale_id);

  const toggleSection = (section: 'active' | 'pipeline' | 'sold') => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getTotalWeight = (batchList: Batch[]) => {
    const grams = batchList.reduce((sum, b) => sum + b.weight_grams, 0);
    const ounces = batchList.reduce((sum, b) => sum + (b.weight_ounces || 0), 0);
    return { grams, ounces };
  };

  const renderBatchRow = (batch: Batch, showActions: boolean = false) => (
    <tr
      key={batch.id}
      className="hover:bg-gray-50 transition-colors"
    >
      <td
        className="px-4 py-3 whitespace-nowrap cursor-pointer"
        onClick={() => onBatchClick?.(batch.id)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Package className="w-4 h-4 text-blue-700" />
          </div>
          <span className="text-sm font-semibold text-gray-900">{batch.batch_number}</span>
        </div>
      </td>
      <td
        className="px-4 py-3 whitespace-nowrap cursor-pointer"
        onClick={() => onBatchClick?.(batch.id)}
      >
        <StatusBadge
          label={getBatchStatusLabel(batch.status)}
          variant={getBatchStatusVariant(batch.status)}
        />
      </td>
      <td
        className="px-4 py-3 whitespace-nowrap cursor-pointer"
        onClick={() => onBatchClick?.(batch.id)}
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{formatWeight(batch.weight_grams)}</span>
          <span className="text-xs text-gray-500">{batch.weight_ounces?.toFixed(2)} oz</span>
        </div>
      </td>
      <td
        className="px-4 py-3 whitespace-nowrap cursor-pointer"
        onClick={() => onBatchClick?.(batch.id)}
      >
        <span className="text-sm text-gray-600 capitalize">{batch.metal_type || 'Gold'}</span>
      </td>
      <td
        className="px-4 py-3 whitespace-nowrap cursor-pointer"
        onClick={() => onBatchClick?.(batch.id)}
      >
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Calendar className="w-3.5 h-3.5" />
          {batch.shipping_date
            ? new Date(batch.shipping_date).toLocaleDateString('fr-FR')
            : new Date(batch.created_at).toLocaleDateString('fr-FR')}
        </div>
      </td>
      <td
        className="px-4 py-3 whitespace-nowrap cursor-pointer"
        onClick={() => onBatchClick?.(batch.id)}
      >
        {batch.mining_company ? (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm text-gray-900">{batch.mining_company.name}</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">N/A</span>
        )}
      </td>
      <td
        className="px-4 py-3 whitespace-nowrap cursor-pointer"
        onClick={() => onBatchClick?.(batch.id)}
      >
        {batch.license ? (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-blue-900">{batch.license.license_number}</span>
            <span className="text-xs text-gray-500">{batch.license.status}</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">No License</span>
        )}
      </td>
      {showActions && (
        <td className="px-4 py-3 whitespace-nowrap text-right">
          {batch.status === BATCH_STATUSES.PENDING_FACTORY_APPROVAL && onValidateTransport && (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onValidateTransport(batch.id);
              }}
              disabled={validatingBatchId === batch.id}
              className="gap-1"
            >
              <CheckCircle className="h-3 w-3" />
              Validate for Transport
            </Button>
          )}
        </td>
      )}
    </tr>
  );

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    batchList: Batch[],
    sectionKey: 'active' | 'pipeline' | 'sold',
    colorClass: string,
    textColorClass: string = 'text-white',
    showActions: boolean = false
  ) => {
    const isExpanded = expandedSections[sectionKey];
    const totals = getTotalWeight(batchList);

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Section Header */}
        <button
          onClick={() => toggleSection(sectionKey)}
          className={`w-full px-6 py-2.5 flex items-center justify-between ${colorClass} hover:opacity-90 transition-opacity`}
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-white/90 rounded-lg">{icon}</div>
            <div className="text-left">
              <h3 className={`text-base font-bold ${textColorClass}`}>{title}</h3>
              <p className={`text-xs ${textColorClass} opacity-90`}>
                {batchList.length} batch{batchList.length !== 1 ? 'es' : ''} • {formatWeight(totals.grams)} • {totals.ounces.toFixed(2)} oz
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold ${textColorClass}`}>{batchList.length}</span>
            {isExpanded ? (
              <ChevronUp className={`w-5 h-5 ${textColorClass}`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${textColorClass}`} />
            )}
          </div>
        </button>

        {/* Section Content */}
        {isExpanded && (
          <div className="overflow-x-auto">
            {batchList.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro de Lot
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Poids
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Métal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Société Minière
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Licence d'Export
                    </th>
                    {showActions && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batchList.map((batch) => renderBatchRow(batch, showActions))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500 text-sm">Aucun batch dans cette section</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Active Batches Section */}
      {renderSection(
        'Batches Actifs',
        <TrendingUp className="w-4 h-4 text-blue-600" />,
        activeBatches,
        'active',
        'bg-gradient-to-r from-blue-500/80 to-blue-600/80 backdrop-blur-sm',
        'text-white',
        true
      )}

      {/* In Pipeline Batches Section */}
      {renderSection(
        'Batches en Pipeline',
        <Clock className="w-4 h-4 text-gray-700" />,
        pipelineBatches,
        'pipeline',
        'bg-gradient-to-r from-amber-500/80 to-amber-600/80 backdrop-blur-sm',
        'text-gray-900',
        false
      )}

      {/* Sold Batches Section */}
      {soldBatches.length > 0 &&
        renderSection(
          'Batches Vendus',
          <CheckCircle className="w-5 h-5 text-emerald-600" />,
          soldBatches,
          'sold',
          'bg-gradient-to-r from-emerald-600 to-emerald-700'
        )}
    </div>
  );
}
