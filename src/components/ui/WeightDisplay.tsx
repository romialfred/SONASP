import { formatWeightWithConversion, formatWeightCompact } from '@/utils/weightConversion';

interface WeightDisplayProps {
  /** Weight in grams (database value) */
  grams: number | null;
  /** Display format: 'full' shows "X oz (Y g)", 'compact' shows "X oz" */
  format?: 'full' | 'compact';
  /** Precision for oz display */
  ozPrecision?: number;
  /** Precision for grams display */
  gramsPrecision?: number;
  /** Custom className */
  className?: string;
}

/**
 * WeightDisplay component
 * Displays weight in oz by default with gram conversion
 * Always receives grams from database, displays as oz
 */
export function WeightDisplay({
  grams,
  format = 'full',
  ozPrecision = 3,
  gramsPrecision = 2,
  className = '',
}: WeightDisplayProps) {
  if (grams === null || grams === undefined || grams === 0) {
    return <span className={className}>—</span>;
  }

  // Convert grams to oz for display
  const oz = grams / 31.1034768;

  if (format === 'compact') {
    return (
      <span className={className}>
        {formatWeightCompact(oz)}
      </span>
    );
  }

  return (
    <span className={className}>
      {formatWeightWithConversion(oz, {
        ozPrecision,
        gramsPrecision,
        showUnit: true,
      })}
    </span>
  );
}

interface WeightBadgeProps extends WeightDisplayProps {
  /** Badge color variant */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

/**
 * WeightBadge component
 * Displays weight as a styled badge
 */
export function WeightBadge({
  grams,
  format = 'compact',
  ozPrecision = 3,
  gramsPrecision = 2,
  variant = 'default',
  className = '',
}: WeightBadgeProps) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      <WeightDisplay
        grams={grams}
        format={format}
        ozPrecision={ozPrecision}
        gramsPrecision={gramsPrecision}
      />
    </span>
  );
}

interface WeightComparisonProps {
  /** Expected weight in grams */
  expectedGrams: number;
  /** Actual weight in grams */
  actualGrams: number;
  /** Show variance percentage */
  showVariance?: boolean;
  /** Variance threshold for warning (percentage) */
  varianceThreshold?: number;
  className?: string;
}

/**
 * WeightComparison component
 * Displays comparison between expected and actual weights
 */
export function WeightComparison({
  expectedGrams,
  actualGrams,
  showVariance = true,
  varianceThreshold = 0.5,
  className = '',
}: WeightComparisonProps) {
  const expectedOz = expectedGrams / 31.1034768;
  const actualOz = actualGrams / 31.1034768;
  const differenceOz = actualOz - expectedOz;
  const variancePercentage = expectedOz !== 0
    ? ((differenceOz / expectedOz) * 100)
    : 0;

  const isOverThreshold = Math.abs(variancePercentage) > varianceThreshold;
  const varianceColor = isOverThreshold
    ? differenceOz > 0
      ? 'text-amber-600'
      : 'text-red-600'
    : 'text-green-600';

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Expected:</span>
        <WeightDisplay grams={expectedGrams} format="full" />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Actual:</span>
        <WeightDisplay grams={actualGrams} format="full" />
      </div>
      {showVariance && (
        <div className="flex items-center justify-between text-sm pt-1 border-t">
          <span className="text-gray-600 font-medium">Variance:</span>
          <span className={`font-medium ${varianceColor}`}>
            {differenceOz >= 0 ? '+' : ''}
            {differenceOz.toFixed(3)} oz ({variancePercentage.toFixed(2)}%)
          </span>
        </div>
      )}
    </div>
  );
}

interface WeightTableCellProps {
  grams: number | null;
  format?: 'full' | 'compact';
  className?: string;
}

/**
 * WeightTableCell component
 * Optimized for table display
 */
export function WeightTableCell({
  grams,
  format = 'compact',
  className = '',
}: WeightTableCellProps) {
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`}>
      <WeightDisplay grams={grams} format={format} />
    </td>
  );
}
