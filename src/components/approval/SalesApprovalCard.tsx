import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Package, User, Calendar, TrendingUp } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import TextArea from '@/components/ui/TextArea';
import { approveRequest, rejectRequest, type ApprovalRequest } from '@/services/approvalService';
import { useAlert } from '@/hooks/useAlert';
import { supabase } from '@/lib/supabase';
import { SalesApprovalWorkflowPanel } from '@/components/sales/SalesApprovalWorkflowPanel';
import type { Tables } from '@/types/database';

type SaleDetails = Tables<'sales'> & {
  customer: Pick<Tables<'customers'>, 'id' | 'name' | 'email' | 'country'> | null;
  seller: Pick<Tables<'mining_companies'>, 'id' | 'name'> | null;
};

interface SalesApprovalCardProps {
  approval: ApprovalRequest;
  onApproved?: () => void;
  onRejected?: () => void;
}

export function SalesApprovalCard({ approval, onApproved, onRejected }: SalesApprovalCardProps) {
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saleDetails, setSaleDetails] = useState<SaleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const alert = useAlert();

  useEffect(() => {
    let active = true;
    const loadSaleDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('sales')
          .select(`
            *,
            customer:customers(id, name, email, country),
            seller:mining_companies(id, name)
          `)
          .eq('id', approval.entity_id)
          .maybeSingle();

        if (error) throw error;
        if (active) setSaleDetails(data as unknown as SaleDetails | null);
      } catch (error) {
        console.error('Error loading sale details:', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadSaleDetails();
    return () => {
      active = false;
    };
  }, [approval.entity_id]);

  const getMechanismLabel = (mechanism: string | null) => {
    const labels: Record<string, string> = {
      spot: 'Spot (2 days)',
      forward_7: 'Forward 7 days',
      forward_7_days: 'Forward 7 days',
      forward_14: 'Forward 14 days',
      forward_14_days: 'Forward 14 days',
    };
    return labels[mechanism?.toLowerCase()] || mechanism || 'Spot';
  };

  const getMechanismDays = (mechanism: string | null) => {
    const days: Record<string, number> = {
      spot: 2,
      forward_7: 7,
      forward_7_days: 7,
      forward_14: 14,
      forward_14_days: 14,
    };
    return days[mechanism?.toLowerCase()] || 2;
  };

  const handleApprove = async () => {
    setProcessing(true);

    try {
      const result = await approveRequest(approval.id);

      if (result.success) {
        alert.success('La vente est approuvée et la notification client a été mise en file.');
        onApproved?.();
      } else {
        alert.error(result.error || "La vente n'a pas pu être approuvée.");
      }
    } catch {
      alert.error("La vente n'a pas pu être approuvée.");
    } finally {
      setProcessing(false);
      setShowApproveModal(false);
    }
  };

  const handleReject = async () => {
    if (rejectionReason.trim().length < 5) {
      alert.warning('Précisez un motif de rejet comportant au moins 5 caractères.');
      return;
    }

    setProcessing(true);

    try {
      const result = await rejectRequest(approval.id, undefined, rejectionReason);

      if (result.success) {
        alert.success('Le rejet de la vente a été enregistré.');
        onRejected?.();
      } else {
        alert.error(result.error || "La vente n'a pas pu être rejetée.");
      }
    } catch {
      alert.error("La vente n'a pas pu être rejetée.");
    } finally {
      setProcessing(false);
      setShowRejectModal(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 mt-2">Chargement de la vente…</p>
        </CardContent>
      </Card>
    );
  }

  if (!saleDetails) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-600">Vente introuvable</p>
        </CardContent>
      </Card>
    );
  }

  const mechanismDays = getMechanismDays(saleDetails.mechanism_type);
  const dueDate = new Date(saleDetails.created_at);
  dueDate.setDate(dueDate.getDate() + mechanismDays);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 text-xs font-semibold rounded-md bg-green-100 text-green-800 border border-green-200">
                  Validation de vente
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  {approval.requested_at ? new Date(approval.requested_at).toLocaleDateString('fr-FR', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) : '—'}
                </span>
              </div>
              <CardTitle className="text-lg">
                Vente nº {saleDetails.sale_number}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                En attente de validation de la direction
              </p>
            </div>
            {approval.status === 'pending' && (
              <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                <Clock className="w-3.5 h-3.5" />
                À examiner
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Customer & Seller Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Client</p>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{saleDetails.customer?.name}</p>
                  <p className="text-xs text-gray-600 truncate">{saleDetails.customer?.country}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vendeur</p>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Package className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{saleDetails.seller?.name || 'N/A'}</p>
                  <p className="text-xs text-gray-600">SONASP</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sale Details */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Quantité</p>
                <p className="text-lg font-bold text-gray-900">
                  {saleDetails.quantity_oz?.toFixed(3)} oz
                </p>
                <p className="text-xs text-gray-500">
                  ({(saleDetails.quantity_oz * 31.1034768).toFixed(2)} g)
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Prix de l’or</p>
                <p className="text-lg font-bold text-gray-900">
                  ${saleDetails.london_am_rate?.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">par once</p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Produit brut</p>
                <p className="text-lg font-semibold text-blue-600">
                  ${saleDetails.gross_proceeds?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Produit net</p>
                <p className="text-lg font-semibold text-emerald-600">
                  ${saleDetails.net_proceeds?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-blue-900 text-sm">Conditions de règlement</p>
                <p className="text-sm text-blue-800 mt-1">
                  <span className="font-medium">{getMechanismLabel(saleDetails.mechanism_type)}</span>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Échéance : {dueDate.toLocaleDateString('fr-FR', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })} ({mechanismDays} jours après la création)
                </p>
              </div>
            </div>
          </div>

          {/* Additional Costs */}
          {(Number(saleDetails.freight_cost || 0) > 0 || Number(saleDetails.other_costs || 0) > 0) && (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-700">Frais complémentaires :</p>
              <div className="grid grid-cols-2 gap-2">
                {Number(saleDetails.freight_cost || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transport :</span>
                    <span className="font-medium">${Number(saleDetails.freight_cost).toFixed(2)}</span>
                  </div>
                )}
                {Number(saleDetails.other_costs || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Autres frais :</span>
                    <span className="font-medium">${Number(saleDetails.other_costs).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {approval.status === 'pending' && (
            <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={() => setShowApproveModal(true)}
                  className="flex-1 gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approuver la vente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowRejectModal(true)}
                  className="flex-1 gap-2 text-red-600 hover:bg-red-50 border-red-200"
                >
                  <XCircle className="w-4 h-4" />
                  Rejeter
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => setShowWorkflowPanel(true)}
                size="sm"
                className="w-full"
              >
                Voir le circuit de validation
              </Button>
            </div>
          )}

          {approval.status === 'approved' && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-lg border border-green-200">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">
                Approuvée le {approval.approved_at ? new Date(approval.approved_at).toLocaleDateString('fr-FR') : '—'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Modal */}
      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} size="lg">
        <ModalHeader onClose={() => setShowApproveModal(false)}>
          Confirmer l’approbation de la vente
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Vous êtes sur le point d’approuver :
              </p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Vente nº {saleDetails.sale_number}</li>
                <li>• Client : {saleDetails.customer?.name}</li>
                <li>• Quantité : {saleDetails.quantity_oz?.toFixed(3)} oz</li>
                <li>• Produit net : ${saleDetails.net_proceeds?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</li>
                <li>• Règlement : {getMechanismLabel(saleDetails.mechanism_type || '')}</li>
              </ul>
            </div>

            <p className="text-sm text-gray-700">
              Après approbation :
            </p>
            <ul className="text-sm text-gray-600 space-y-1 pl-4">
              <li>La vente sera transmise au client pour confirmation.</li>
              <li>Une notification sera mise en file pour son compte.</li>
              <li>Le règlement ne sera créé qu’après sa confirmation authentifiée.</li>
            </ul>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowApproveModal(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleApprove} loading={processing}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Approuver la vente
          </Button>
        </ModalFooter>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)}>
        <ModalHeader onClose={() => setShowRejectModal(false)}>
          Rejeter la vente
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Indiquez le motif précis du rejet de cette vente :
            </p>
            <TextArea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="Motif du rejet…"
            />
            <p className="text-xs text-gray-600">
              La décision sera journalisée et l’équipe commerciale en sera informée.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowRejectModal(false)}>
            Annuler
          </Button>
          <Button
            variant="outline"
            onClick={handleReject}
            loading={processing}
            className="text-red-600 hover:bg-red-50 border-red-200"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Rejeter la vente
          </Button>
        </ModalFooter>
      </Modal>

      {/* Workflow Panel Modal */}
      <Modal isOpen={showWorkflowPanel} onClose={() => setShowWorkflowPanel(false)} size="lg">
        <ModalHeader onClose={() => setShowWorkflowPanel(false)}>
          Circuit de validation de la vente
        </ModalHeader>
        <ModalBody>
          <SalesApprovalWorkflowPanel currentStatus={saleDetails.status} />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowWorkflowPanel(false)}>
            Fermer
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
