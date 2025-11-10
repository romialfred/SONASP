import { CheckCircle, X, Package, Calendar, Building2, FileText, Eye } from 'lucide-react';
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
  onViewDetails,
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-scaleIn">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10">
            <CheckCircle className="w-48 h-48" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Expédition Enregistrée!</h2>
                  <p className="text-green-100 text-sm">Préparation créée avec succès</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Expedition Number - Prominent Display */}
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-5 text-center">
            <p className="text-sm text-yellow-800 font-medium mb-2">Numéro d'Expédition / Lot</p>
            <div className="text-3xl font-bold text-yellow-900 font-mono tracking-wide">
              {expeditionNumber}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Date de Production</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(productionDate).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>

            {/* Total Boxes */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-gray-600">Nombre de Boîtes</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {totalBoxes} {totalBoxes > 1 ? 'boîtes' : 'boîte'}
              </p>
            </div>

            {/* Net Weight */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-600">Poids Net</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {totalNetWeight.toFixed(2)} g
              </p>
            </div>

            {/* Gross Weight */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Poids Brut</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {totalGrossWeight.toFixed(2)} g
              </p>
            </div>
          </div>

          {/* Destination Info */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-yellow-600 mt-1" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Raffinerie de Destination</p>
                <p className="text-base font-semibold text-gray-900">{refineryName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-blue-600 mt-1" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Compagnie de Fret</p>
                <p className="text-base font-semibold text-gray-900">{freightCompany}</p>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                ℹ
              </span>
              Prochaines Étapes
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 ml-8">
              <li>• Le Packing List a été généré automatiquement</li>
              <li>• Vous pouvez le télécharger depuis la page de détails</li>
              <li>• Les signataires peuvent signer le document</li>
              <li>• Préparez les documents de support pour l'expédition</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t">
          <Button
            onClick={onClose}
            variant="outline"
            className="gap-2"
          >
            Fermer
          </Button>
          <Button
            onClick={onViewDetails}
            className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white"
          >
            <Eye className="w-4 h-4" />
            Voir Détails
          </Button>
        </div>
      </div>
    </div>
  );
}
