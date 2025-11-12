import { useState, useEffect } from 'react';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  User,
  Calendar,
  MessageSquare,
  RefreshCw,
  Package,
  Truck,
  Factory,
  ShoppingCart,
  CheckCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextArea } from '@/components/ui/TextArea';
import { Loading } from '@/components/ui/Loading';
import {
  getStatusHistory,
  getNextStatuses,
  getStatusLabel,
  getStatusColor,
  changeProductionStatus,
  changeShippingStatus,
  ProductionStatus,
  ShippingStatus,
  StatusChangeContext,
  EntityType,
  StatusHistoryEntry,
} from '@/services/unifiedStatusService';
import { useAlert } from '@/hooks/useAlert';

interface UnifiedStatusFlowProps {
  entityType: EntityType;
  entityId: string;
  currentStatus: string;
  context: StatusChangeContext;
  canEdit?: boolean; // Can user edit status in this context
  onStatusChanged?: () => void;
}

export function UnifiedStatusFlow({
  entityType,
  entityId,
  currentStatus,
  context,
  canEdit = false,
  onStatusChanged,
}: UnifiedStatusFlowProps) {
  const alert = useAlert();
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [entityId, entityType]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const result = await getStatusHistory(entityType, entityId);
      if (result.success && result.data) {
        setHistory(result.data);
      } else {
        console.error('Error loading history:', result.error);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedNewStatus) return;

    setChanging(true);
    try {
      let result;
      if (entityType === 'production') {
        result = await changeProductionStatus(
          entityId,
          selectedNewStatus as ProductionStatus,
          context,
          notes
        );
      } else {
        result = await changeShippingStatus(
          entityId,
          selectedNewStatus as ShippingStatus,
          context,
          notes
        );
      }

      if (result.success) {
        alert.showAlert('Statut modifié avec succès', 'success');
        setShowChangeModal(false);
        setNotes('');
        setSelectedNewStatus('');
        loadHistory();
        onStatusChanged?.();
      } else {
        alert.showAlert(result.error || 'Erreur lors du changement de statut', 'error');
      }
    } catch (error: any) {
      alert.showAlert(error.message, 'error');
    } finally {
      setChanging(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const iconClass = 'w-4 h-4';

    switch (status) {
      case 'prepared':
        return <Package className={iconClass} />;
      case 'shipped':
      case 'validated_for_refinery':
        return <Truck className={iconClass} />;
      case 'in_refining':
      case 'refined':
        return <Factory className={iconClass} />;
      case 'in_sale':
        return <ShoppingCart className={iconClass} />;
      case 'sold':
        return <CheckCheck className={iconClass} />;
      case 'cancelled':
        return <AlertCircle className={iconClass} />;
      default:
        return <Clock className={iconClass} />;
    }
  };

  const nextStatuses = canEdit ? getNextStatuses(entityType, currentStatus, context) : [];

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loading />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="card-title">Suivi des Statuts</h3>
            <p className="card-subtitle">
              Historique complet des changements de statut
            </p>
          </div>
          {canEdit && nextStatuses.length > 0 && (
            <Button
              size="sm"
              onClick={() => setShowChangeModal(true)}
              className="btn-text-base"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Modifier Statut
            </Button>
          )}
        </div>

        {/* Current Status Badge */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                {getStatusIcon(currentStatus)}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
                  Statut Actuel
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {getStatusLabel(entityType, currentStatus)}
                </p>
              </div>
            </div>
            <div className={`
              px-4 py-2 rounded-full text-xs font-medium border-2
              ${getStatusColor(entityType, currentStatus)}
            `}>
              {getStatusLabel(entityType, currentStatus)}
            </div>
          </div>
        </div>

        {/* Status History Timeline */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Historique des Changements
          </h4>

          {history.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-4 text-center">
              Aucun historique disponible
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((entry, index) => {
                const isLatest = index === history.length - 1;
                const colorClass = getStatusColor(entityType, entry.new_status);

                return (
                  <div
                    key={entry.id}
                    className={`
                      relative pl-8 pb-4 border-l-2 transition-colors
                      ${isLatest ? 'border-blue-500' : 'border-gray-300'}
                    `}
                  >
                    {/* Timeline dot */}
                    <div className={`
                      absolute left-0 top-0 -ml-[9px] w-4 h-4 rounded-full border-2
                      ${isLatest
                        ? 'bg-blue-500 border-blue-200'
                        : 'bg-white border-gray-300'
                      }
                    `}>
                      {isLatest && (
                        <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-75" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          {/* Status transition */}
                          <div className="flex items-center gap-2 mb-2">
                            {entry.old_status && (
                              <>
                                <span className={`
                                  px-2 py-0.5 rounded-full text-xs font-medium border
                                  ${getStatusColor(entityType, entry.old_status)}
                                `}>
                                  {getStatusLabel(entityType, entry.old_status)}
                                </span>
                                <ChevronRight className="w-3 h-3 text-gray-400" />
                              </>
                            )}
                            <span className={`
                              px-2 py-0.5 rounded-full text-xs font-medium border
                              ${colorClass}
                            `}>
                              {getStatusLabel(entityType, entry.new_status)}
                            </span>
                          </div>

                          {/* Action description */}
                          {entry.action_description && (
                            <p className="text-sm text-gray-700 mb-2">
                              {entry.action_description}
                            </p>
                          )}

                          {/* Notes */}
                          {entry.notes && (
                            <div className="flex items-start gap-2 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                              <MessageSquare className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-gray-600 italic">
                                {entry.notes}
                              </p>
                            </div>
                          )}

                          {/* Meta info */}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                            {entry.user_name && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>{entry.user_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {new Date(entry.changed_at).toLocaleString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-600">
                              {entry.change_context.replace(/_/g, ' ')}
                            </div>
                          </div>
                        </div>

                        {/* Status icon */}
                        <div className="flex-shrink-0">
                          <div className={`p-2 rounded-lg ${colorClass.replace('text-', 'text-').split(' ')[0].replace('text-', 'bg-').replace('-800', '-100')}`}>
                            {getStatusIcon(entry.new_status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Context Info */}
        {!canEdit && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-800">
                Le statut ne peut pas être modifié depuis ce module.
                {entityType === 'production' && currentStatus === 'shipped' && (
                  <span> Utilisez le module <strong>Shipping Management</strong> pour modifier le statut.</span>
                )}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Change Status Modal */}
      {showChangeModal && (
        <Modal
          isOpen={showChangeModal}
          onClose={() => setShowChangeModal(false)}
          title="Modifier le Statut"
        >
          <div className="space-y-4">
            <div>
              <label className="form-label">Statut Actuel</label>
              <div className={`
                px-4 py-2 rounded-lg border-2 text-sm font-medium
                ${getStatusColor(entityType, currentStatus)}
              `}>
                {getStatusLabel(entityType, currentStatus)}
              </div>
            </div>

            <div>
              <label className="form-label">Nouveau Statut</label>
              <div className="grid grid-cols-1 gap-2">
                {nextStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedNewStatus(status)}
                    className={`
                      px-4 py-3 rounded-lg border-2 text-sm font-medium text-left
                      transition-all hover:shadow-md
                      ${selectedNewStatus === status
                        ? `${getStatusColor(entityType, status)} ring-2 ring-blue-500`
                        : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <span>{getStatusLabel(entityType, status)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Notes (Optionnel)</label>
              <TextArea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajouter une note sur ce changement de statut..."
                rows={3}
              />
              <p className="form-helper">
                Ces notes seront visibles dans l'historique
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowChangeModal(false)}
                disabled={changing}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleStatusChange}
                disabled={!selectedNewStatus || changing}
                className="flex-1"
              >
                {changing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Modification...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmer
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
