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
      <ModalBody className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Status Transition - Compact */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <ProductionStatusBadge status={currentStatus} size="sm" showIcon />
              <p className="text-[10px] text-gray-600 mt-1 font-medium">{currentStatusConfig.label}</p>
            </div>

            <ArrowRight className="w-6 h-6 text-blue-600 flex-shrink-0" />

            <div className="text-center">
              <ProductionStatusBadge status={nextStatus} size="sm" showIcon />
              <p className="text-[10px] text-gray-600 mt-1 font-medium">{nextStatusConfig.label}</p>
            </div>
          </div>

          <div className={`mt-2 p-2 rounded ${nextStatusConfig.bgColor} border ${nextStatusConfig.borderColor}`}>
            <p className={`text-xs ${nextStatusConfig.color} text-center font-medium`}>
              {nextStatusConfig.description}
            </p>
          </div>
        </div>

        {/* Production Details - Compact */}
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            Détails de la Production
          </h3>

          {/* Info Grid - Compact */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="flex items-start gap-1.5">
              <Package className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500">Référence</p>
                <p className="text-xs font-mono font-medium text-gray-900 truncate">
                  {production.bar_reference || `HUMSM-1204`}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              <Calendar className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500">Date</p>
                <p className="text-xs font-medium text-gray-900 truncate">
                  {formatDate(production.production_date)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              <TrendingUp className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500">Finesse</p>
                <p className="text-xs font-medium text-gray-900">
                  {production.estimated_fineness_pct.toFixed(2)}%
                </p>
              </div>
            </div>

            {production.mining_company_name && (
              <div className="flex items-start gap-1.5 col-span-2">
                <Building className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500">Société Minière</p>
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {production.mining_company_name}
                  </p>
                </div>
              </div>
            )}

            {production.site_country && (
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500">Pays</p>
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {production.site_country}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Weight Summary - Compact */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded p-2 text-center">
              <p className="text-[10px] text-gray-600 mb-0.5 font-medium">Bullion</p>
              <p className="text-sm font-bold text-gray-900">
                {production.bullion_grams.toFixed(2)}
              </p>
              <p className="text-[9px] text-gray-500">grammes</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded p-2 text-center">
              <p className="text-[10px] text-blue-700 mb-0.5 font-medium">Or Pur</p>
              <p className="text-sm font-bold text-blue-900">
                {production.pure_gold_grams.toFixed(2)}
              </p>
              <p className="text-[9px] text-blue-600">grammes</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded p-2 text-center">
              <p className="text-[10px] text-emerald-700 mb-0.5 font-medium">Onces</p>
              <p className="text-sm font-bold text-emerald-900">
                {production.estimated_oz.toFixed(4)}
              </p>
              <p className="text-[9px] text-emerald-600">oz troy</p>
            </div>
          </div>
        </div>

        {/* User Info - Compact */}
        {userEmail && (
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded p-2">
            <User className="w-3 h-3 text-blue-600 flex-shrink-0" />
            <span className="truncate">Par: <span className="font-semibold text-gray-900">{userEmail}</span></span>
          </div>
        )}

        {/* Notes Input - Compact */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700">
            Notes additionnelles (optionnel)
          </label>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ajouter des détails ou commentaires..."
            rows={2}
            disabled={confirming}
            className="resize-none text-xs"
          />
          <p className="text-[10px] text-gray-500">
            Ces notes seront enregistrées dans l'historique.
          </p>
        </div>
      </ModalBody>

      <ModalFooter className="py-3">
        <Button
          onClick={handleClose}
          variant="outline"
          disabled={confirming}
          className="flex-1 text-sm py-2"
        >
          Annuler
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={confirming}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-sm py-2"
        >
          {confirming ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Confirmation...
            </>
          ) : (
            <>
              <ArrowRight className="w-3.5 h-3.5 mr-2" />
              Confirmer
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
