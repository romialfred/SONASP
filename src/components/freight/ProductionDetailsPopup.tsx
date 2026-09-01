import { formatDateShort } from '@/utils/dateUtils';

interface ProductionDetail {
  id: string;
  bar_reference: string;
  production_date: string;
  bullion_grams: number;
  pure_gold_grams: number;
  estimated_oz: number;
  estimated_fineness_pct: number;
  silver_content_grams: number | null;
}

interface ProductionDetailsPopupProps {
  expeditionLotNumber: string;
  productions: ProductionDetail[];
  visible: boolean;
  position: { x: number; y: number };
}

export function ProductionDetailsPopup({
  expeditionLotNumber,
  productions,
  visible,
  position
}: ProductionDetailsPopupProps) {
  if (!visible || productions.length === 0) return null;

  const totalBullion = productions.reduce((sum, p) => sum + p.bullion_grams, 0);
  const totalPure = productions.reduce((sum, p) => sum + p.pure_gold_grams, 0);
  const totalOz = productions.reduce((sum, p) => sum + p.estimated_oz, 0);

  return (
    <div
      className="fixed z-[9999] bg-white shadow-2xl rounded-lg border-2 border-blue-400 max-w-3xl"
      style={{
        top: Math.min(position.y, window.innerHeight - 400),
        left: Math.min(position.x + 20, window.innerWidth - 700),
        pointerEvents: 'none'
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-t-lg">
        <h3 className="font-bold text-lg">
          Production details — {expeditionLotNumber}
        </h3>
        <p className="text-xs text-blue-100 mt-1">
          {productions.length} production lot{productions.length === 1 ? '' : 's'} in this shipment
        </p>
      </div>

      {/* Table */}
      <div className="p-4 max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">#</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">Bar reference</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">Production date</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700">Bullion (g)</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700">Fine gold (g)</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700">Oz</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700">Fineness (%)</th>
            </tr>
          </thead>
          <tbody>
            {productions.map((prod, index) => (
              <tr key={prod.id} className="border-b border-gray-200 hover:bg-blue-50">
                <td className="px-2 py-2 text-gray-600">{index + 1}</td>
                <td className="px-2 py-2 font-mono text-blue-900 font-medium">
                  {prod.bar_reference}
                </td>
                <td className="px-2 py-2 text-gray-700">
                  {formatDateShort(prod.production_date)}
                </td>
                <td className="px-2 py-2 text-right font-medium text-gray-900">
                  {prod.bullion_grams.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-2 py-2 text-right font-medium text-green-700">
                  {prod.pure_gold_grams.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-2 py-2 text-right font-medium text-blue-700">
                  {prod.estimated_oz.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </td>
                <td className="px-2 py-2 text-right text-gray-700">
                  {prod.estimated_fineness_pct.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-blue-50 font-bold sticky bottom-0">
            <tr>
              <td colSpan={3} className="px-2 py-3 text-right text-gray-900">
                TOTAL:
              </td>
              <td className="px-2 py-3 text-right text-gray-900">
                {totalBullion.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g
              </td>
              <td className="px-2 py-3 text-right text-green-700">
                {totalPure.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g
              </td>
              <td className="px-2 py-3 text-right text-blue-700">
                {totalOz.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} oz
              </td>
              <td className="px-2 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer Info */}
      <div className="bg-gray-50 px-4 py-2 rounded-b-lg border-t border-gray-200">
        <p className="text-xs text-gray-600 italic">
          Select another lot to view its details
        </p>
      </div>
    </div>
  );
}
