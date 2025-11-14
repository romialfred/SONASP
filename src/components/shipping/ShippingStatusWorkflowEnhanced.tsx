import { useState } from 'react';
import { Check, AlertTriangle, ChevronRight, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ShippingStatus, getShippingStatusConfig } from '@/constants/shippingStatuses';

interface ShippingStatusWorkflowEnhancedProps {
  shippingId: string;
  currentStatus: ShippingStatus;
  onStatusChanged: () => void;
  userEmail?: string;
}

export function ShippingStatusWorkflowEnhanced({
  shippingId,
  currentStatus,
  onStatusChanged,
  userEmail,
}: ShippingStatusWorkflowEnhancedProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ShippingStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentConfig = getShippingStatusConfig(currentStatus);
  const CurrentIcon = currentConfig.icon;

  // Workflow complet: waiting_for_customs_approval → approved_by_customs → ready_for_expedition
  const allStatuses: ShippingStatus[] = [
    'waiting_for_customs_approval',  // En attente approbation douane
    'approved_by_customs',            // Douane approuvée
    'ready_for_expedition',           // Prêt pour expédition
  ];

  const currentIndex = allStatuses.indexOf(currentStatus);

  const handleStatusClick = (newStatus: ShippingStatus) => {
    setSelectedStatus(newStatus);
    setShowModal(true);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selectedStatus) return;

    try {
      setLoading(true);
      setError(null);

      const { shippingStatusService } = await import('@/services/shippingStatusService');

      await shippingStatusService.changeStatus(
        shippingId,
        currentStatus,
        selectedStatus,
        userEmail || 'system',
        notes || undefined
      );

      setShowModal(false);
      setNotes('');
      setSelectedStatus(null);
      onStatusChanged();
    } catch (err) {
      console.error('Error changing status:', err);
      setError('Erreur lors du changement de statut. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className={`${currentConfig.bgColor} rounded-xl p-3 shadow-sm`}>
              <CurrentIcon className={`w-6 h-6 ${currentConfig.textColor}`} />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Statut Actuel
              </div>
              <div className={`text-xl font-bold ${currentConfig.textColor}`}>
                {currentConfig.label}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {currentConfig.description}
              </div>
            </div>
          </div>
        </div>

        {/* Bouton Action Rapide: Customs Approved */}
        {currentStatus === 'waiting_for_customs_approval' && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl p-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="bg-amber-500 rounded-full p-3">
                  <Check className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-amber-900 mb-1">
                  Approbation Douanière Reçue ?
                </div>
                <div className="text-xs text-amber-700">
                  Cliquez ci-dessous une fois que l'approbation de la douane a été obtenue
                </div>
              </div>
              <div className="flex-shrink-0">
                <Button
                  size="lg"
                  variant="primary"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg"
                  onClick={() => handleStatusClick('approved_by_customs')}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Customs Approved
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-4">
            Progression du Workflow
          </div>

          <div className="space-y-3">
            {allStatuses.map((status, index) => {
              const config = getShippingStatusConfig(status);
              const Icon = config.icon;
              const isPast = index < currentIndex;
              const isCurrent = status === currentStatus;
              const isNext = currentConfig.canTransitionTo.includes(status);
              const isFuture = index > currentIndex && !isNext;

              return (
                <div key={status} className="relative">
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      isCurrent
                        ? `${config.borderColor} bg-gradient-to-r ${config.bgColor} shadow-sm`
                        : isPast
                        ? 'border-gray-200 bg-gray-50'
                        : isNext
                        ? 'border-emerald-200 bg-emerald-50 hover:shadow-md cursor-pointer'
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                    onClick={() => isNext && handleStatusClick(status)}
                  >
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        isPast
                          ? 'bg-emerald-500'
                          : isCurrent
                          ? config.bgColor
                          : isNext
                          ? 'bg-emerald-100'
                          : 'bg-gray-200'
                      }`}
                    >
                      {isPast ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <Icon
                          className={`w-5 h-5 ${
                            isCurrent ? config.textColor : isNext ? 'text-emerald-700' : 'text-gray-400'
                          }`}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-semibold ${
                          isCurrent ? config.textColor : isPast ? 'text-gray-700' : 'text-gray-600'
                        }`}
                      >
                        {config.label}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {config.description}
                      </div>
                    </div>

                    {isCurrent && (
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                          EN COURS
                        </span>
                      </div>
                    )}
                    {isPast && (
                      <div className="flex-shrink-0">
                        <Check className="w-5 h-5 text-emerald-600" />
                      </div>
                    )}
                    {isNext && (
                      <div className="flex-shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusClick(status);
                          }}
                        >
                          <ChevronRight className="w-4 h-4" />
                          Passer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {currentStatus !== 'ready_for_expedition' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-red-900 mb-1">
                  Note Importante
                </div>
                <div className="text-xs text-red-700">
                  Assurez-vous d'avoir reçu l'approbation officielle de la douane avant de passer au statut suivant.
                  L'approbation peut prendre plusieurs jours.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => !loading && setShowModal(false)}
        title="Confirmer le Changement de Statut"
      >
        <div className="space-y-4 p-2">
          {selectedStatus && (() => {
            const config = getShippingStatusConfig(selectedStatus);
            const Icon = config.icon;
            return (
              <>
                <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${config.borderColor} ${config.bgColor}`}>
                  <div className={`rounded-lg p-3 bg-white shadow-sm`}>
                    <Icon className={`w-6 h-6 ${config.textColor}`} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Nouveau statut</div>
                    <div className={`text-lg font-bold ${config.textColor}`}>
                      {config.label}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {config.description}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes {selectedStatus === 'cancelled' ? '(requis)' : '(optionnel)'}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder={
                      selectedStatus === 'cancelled'
                        ? 'Veuillez expliquer la raison de l\'annulation...'
                        : 'Ajouter des notes sur ce changement de statut...'
                    }
                    required={selectedStatus === 'cancelled'}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowModal(false);
                      setNotes('');
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={loading || (selectedStatus === 'cancelled' && !notes.trim())}
                    className="min-w-[120px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Traitement...
                      </>
                    ) : (
                      'Confirmer'
                    )}
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      </Modal>
    </>
  );
}
