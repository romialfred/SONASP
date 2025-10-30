import { Package, CheckCircle, Warehouse, TrendingUp } from 'lucide-react';
import { BATCH_STATUSES } from '@/constants/batchStatuses';

interface Batch {
  id: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
}

interface BatchStatusMetricsProps {
  batches: Batch[];
}

export function BatchStatusMetrics({ batches }: BatchStatusMetricsProps) {
  const createdBatches = batches.filter(b => b.status === BATCH_STATUSES.PENDING_FACTORY_APPROVAL);
  const validatedForTransportBatches = batches.filter(b => b.status === BATCH_STATUSES.APPROVED_FOR_TRANSPORT);
  const validatedForRefineryBatches = batches.filter(b => b.status === BATCH_STATUSES.VALIDATED_FOR_REFINERY);
  const inInventoryBatches = batches.filter(b => b.status === BATCH_STATUSES.IN_INVENTORY);

  const calculateTotals = (batchList: Batch[]) => {
    const grams = batchList.reduce((sum, b) => sum + b.weight_grams, 0);
    const ounces = batchList.reduce((sum, b) => sum + (b.weight_ounces || 0), 0);
    return { count: batchList.length, grams, ounces };
  };

  const created = calculateTotals(createdBatches);
  const validated = calculateTotals(validatedForTransportBatches);
  const refinery = calculateTotals(validatedForRefineryBatches);
  const inventory = calculateTotals(inInventoryBatches);

  const metrics = [
    {
      title: 'Created',
      count: created.count,
      grams: created.grams,
      ounces: created.ounces,
      icon: Package,
      bgColor: 'bg-gray-50 border-gray-200',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-700',
      gradient: 'from-gray-500 to-gray-600',
    },
    {
      title: 'Validated for Transport',
      count: validated.count,
      grams: validated.grams,
      ounces: validated.ounces,
      icon: CheckCircle,
      bgColor: 'bg-blue-50 border-blue-200',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-700',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Validated for Refinery',
      count: refinery.count,
      grams: refinery.grams,
      ounces: refinery.ounces,
      icon: TrendingUp,
      bgColor: 'bg-purple-50 border-purple-200',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-700',
      gradient: 'from-purple-500 to-purple-600',
    },
    {
      title: 'In Inventory',
      count: inventory.count,
      grams: inventory.grams,
      ounces: inventory.ounces,
      icon: Warehouse,
      bgColor: 'bg-emerald-50 border-emerald-200',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-700',
      gradient: 'from-emerald-500 to-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <div
          key={metric.title}
          className={`rounded-xl border p-5 ${metric.bgColor} hover:shadow-lg transition-all duration-200`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2.5 rounded-lg ${metric.iconBg}`}>
              <metric.icon className={`w-5 h-5 ${metric.iconColor}`} />
            </div>
            <span className="text-3xl font-bold text-gray-900">{metric.count}</span>
          </div>

          {/* Title */}
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            {metric.title}
          </h4>

          {/* Weights */}
          <div className="space-y-1.5">
            {/* Grams */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Grammes</span>
              <span className="text-sm font-bold text-gray-900">
                {metric.grams.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} g
              </span>
            </div>

            {/* Ounces */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Onces</span>
              <span className="text-sm font-bold text-gray-900">
                {metric.ounces.toFixed(2)} oz
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3 pt-3 border-t border-gray-200/50">
            <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${metric.gradient} transition-all duration-300`}
                style={{ width: `${Math.min((metric.ounces / 10000) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
