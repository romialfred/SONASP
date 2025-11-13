import { CheckCircle, X, Package, Calendar, Building2, Weight } from 'lucide-react';
import { Button } from './Button';

interface SuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDetails: () => void;
  expeditionNumber: string;
  totalBoxes: number;
  totalNetWeight: number;
  totalGrossWeight: number;
  refineryName: string;
  freightCompany: string;
  productionDate: string;
}

export function SuccessDialog({
  isOpen,
  onClose,
  expeditionNumber,
  totalBoxes,
  totalNetWeight,
  totalGrossWeight,
  refineryName,
  freightCompany,
  productionDate,
}: SuccessDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-scaleIn">
        {/* Header with gradient - More compact */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10">
            <CheckCircle className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Expédition Enregistrée!</h2>
                  <p className="text-green-100 text-sm">Préparation créée avec succès</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content - More compact */}
        <div className="p-5 space-y-4">
          {/* Expedition Number - Prominent Display */}
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-lg p-4 text-center">
            <p className="text-xs text-yellow-800 font-medium mb-1">Numéro d'Expédition / Lot</p>
            <div className="text-2xl font-bold text-yellow-900 font-mono tracking-wide">
              {expeditionNumber}
            </div>
          </div>

          {/* Details Grid - More compact */}
          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-600">Date de Production</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(productionDate).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>

            {/* Total Boxes */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-yellow-600" />
                <span className="text-xs font-medium text-gray-600">Nombre de Boîtes</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {totalBoxes} {totalBoxes > 1 ? 'boîtes' : 'boîte'}
              </p>
            </div>

            {/* Net Weight */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Weight className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-gray-600">Poids Net</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {(totalNetWeight || 0).toFixed(2)} g
              </p>
            </div>

            {/* Gross Weight */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Weight className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-600">Poids Brut</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {(totalGrossWeight || 0).toFixed(2)} g
              </p>
            </div>
          </div>

          {/* Destination Info - More compact */}
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600">Raffinerie de Destination</p>
                <p className="text-sm font-semibold text-gray-900">{refineryName}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Package className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600">Compagnie de Fret</p>
                <p className="text-sm font-semibold text-gray-900">{freightCompany}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions - Single button */}
        <div className="bg-gray-50 px-5 py-3 flex items-center justify-end border-t">
          <Button
            onClick={onClose}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
