import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { ProductionStatusBadge } from './ProductionStatusBadge';
import { ProductionStatus, PRODUCTION_STATUSES } from '@/constants/productionStatuses';
import { ArrowRight, Calendar, Building, Package, TrendingUp, MapPin, User } from 'lucide-react';
import { useState } from 'react';

interface ProductionDetails {
  id: string;
  bar_reference: string | null;
  production_date: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  pure_gold_grams: number;
  estimated_oz: number;
  mining_company_name?: string;
  site_country?: string;
}

interface ProductionStatusConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes?: string) => Promise<void>;
  currentStatus: ProductionStatus;
  nextStatus: ProductionStatus;
  production: ProductionDetails;
  userEmail?: string;
}

export function ProductionStatusConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  nextStatus,
  production,
  userEmail
}: ProductionStatusConfirmationModalProps) {
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      await onConfirm(notes || undefined);
      setNotes('');
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    if (!confirming) {
      setNotes('');
      onClose();
    }
  };

  const currentStatusConfig = PRODUCTION_STATUSES[currentStatus];
  const nextStatusConfig = PRODUCTION_STATUSES[nextStatus];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Confirmer le Changement de Statut"
      size="lg"
    >
      <ModalBody className="space-y-5">
        {/* Status Transition */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <ProductionStatusBadge status={currentStatus} size="lg" showIcon />
              <p className="text-xs text-gray-600 mt-2 font-medium">{currentStatusConfig.label}</p>
            </div>

            <div className="flex-shrink-0">
              <div className="relative">
                <ArrowRight className="w-8 h-8 text-blue-600 animate-pulse" />
                <div className="absolute inset-0 bg-blue-400 blur-sm opacity-30 rounded-full" />
              </div>
            </div>

            <div className="text-center">
              <ProductionStatusBadge status={nextStatus} size="lg" showIcon />
              <p className="text-xs text-gray-600 mt-2 font-medium">{nextStatusConfig.label}</p>
            </div>
          </div>

          <div className={`mt-4 p-3 rounded-lg ${nextStatusConfig.bgColor} border-2 ${nextStatusConfig.borderColor}`}>
            <p className={`text-sm ${nextStatusConfig.color} text-center font-medium`}>
              {nextStatusConfig.description}
            </p>
          </div>
        </div>

        {/* Production Details */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Détails de la Production
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-600">Référence</p>
                <p className="text-sm font-mono font-medium text-gray-900 truncate">
                  {production.bar_reference || `HUMSM-1204`}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-600">Date</p>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {formatDate(production.production_date)}
                </p>
              </div>
            </div>

            {production.mining_company_name && (
              <div className="flex items-start gap-2">
                <Building className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-600">Société Minière</p>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {production.mining_company_name}
                  </p>
                </div>
              </div>
            )}

            {production.site_country && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-600">Pays</p>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {production.site_country}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-600">Finesse</p>
                <p className="text-sm font-medium text-gray-900">
                  {production.estimated_fineness_pct.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Weight Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 mb-1 font-medium">Bullion</p>
                <p className="text-base font-bold text-gray-900">
                  {production.bullion_grams.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">grammes</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-700 mb-1 font-medium">Or Pur</p>
                <p className="text-base font-bold text-blue-900">
                  {production.pure_gold_grams.toFixed(2)}
                </p>
                <p className="text-xs text-blue-600">grammes</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg p-3 text-center">
                <p className="text-xs text-emerald-700 mb-1 font-medium">Onces</p>
                <p className="text-base font-bold text-emerald-900">
                  {production.estimated_oz.toFixed(4)}
                </p>
                <p className="text-xs text-emerald-600">oz troy</p>
              </div>
            </div>
          </div>
        </div>

        {/* User Info */}
        {userEmail && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-3">
            <User className="w-4 h-4 text-blue-600" />
            <span>Changement effectué par: <span className="font-semibold text-gray-900">{userEmail}</span></span>
          </div>
        )}

        {/* Notes Input */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Notes additionnelles (optionnel)
          </label>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ajouter des détails ou commentaires sur ce changement de statut..."
            rows={3}
            disabled={confirming}
            className="resize-none"
          />
          <p className="text-xs text-gray-500">
            Ces notes seront enregistrées dans l'historique des changements.
          </p>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button
          onClick={handleClose}
          variant="outline"
          disabled={confirming}
          className="flex-1"
        >
          Annuler
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={confirming}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {confirming ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Confirmation...
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              Confirmer le Changement
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
