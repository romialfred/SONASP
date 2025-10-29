import { X, Package, Scale, Calendar, Building2, Truck, MapPin } from 'lucide-react';
import Button from '@/components/ui/Button';
import { formatWeight } from '@/utils/batchUtils';
import { getBatchStatusLabel } from '@/constants/batchStatuses';

interface BatchTransportApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  batch: {
    id: string;
    batch_number: string;
    status: string;
    weight_grams: number;
    weight_ounces: number;
    shipping_date: string;
    metal_type: string;
    mining_company_name?: string;
    origin_site?: string;
    destination?: string;
    created_at: string;
  };
  isLoading?: boolean;
}

export function BatchTransportApprovalModal({
  isOpen,
  onClose,
  onConfirm,
  batch,
  isLoading = false
}: BatchTransportApprovalModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-2 rounded-lg">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Validation du Transport</h2>
              <p className="text-amber-100 text-sm">Confirmation d'approbation pour le transport</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Batch Number Highlight */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Numéro de Lot</p>
                <p className="text-2xl font-bold text-gray-900">{batch.batch_number}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {getBatchStatusLabel(batch.status)}
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Weight Information */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <Scale className="h-5 w-5 text-emerald-700" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Poids</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {formatWeight(batch.weight_grams)}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {batch.weight_ounces.toFixed(3)} oz
                  </p>
                </div>
              </div>
            </div>

            {/* Shipping Date */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-700" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Date d'Expédition</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {new Date(batch.shipping_date).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Mining Company */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <Building2 className="h-5 w-5 text-amber-700" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Société Minière</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    {batch.mining_company_name || 'Non spécifié'}
                  </p>
                </div>
              </div>
            </div>

            {/* Metal Type */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <MapPin className="h-5 w-5 text-purple-700" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Type de Métal</p>
                  <p className="text-base font-semibold text-gray-900 mt-1 capitalize">
                    {batch.metal_type || 'Or'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-800">Confirmation requise</h3>
                <p className="text-sm text-amber-700 mt-1">
                  En validant ce lot pour le transport, vous confirmez que toutes les informations sont correctes
                  et que le lot est prêt à être expédié. Cette action ne peut pas être annulée.
                </p>
              </div>
            </div>
          </div>

          {/* Question */}
          <div className="text-center pt-2">
            <p className="text-lg font-semibold text-gray-900">
              Êtes-vous sûr de vouloir valider ce lot pour le transport ?
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="px-6"
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-6 bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Validation en cours...
              </>
            ) : (
              'Valider le Transport'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
