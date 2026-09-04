import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Loading } from '@/components/ui/Loading';
import { TextArea } from '@/components/ui/TextArea';
import {
  CheckCircle,
  XCircle,
  DollarSign,
  AlertCircle,
  FileText,
  Clock,
  Mail
} from 'lucide-react';
import {
  approveCustomerSale,
  loadCustomerSaleForDecision,
  rejectCustomerSale,
} from '@/services/customerSaleDecisionService';
import { formatCurrency } from '@/utils/salesUtils';

interface Sale {
  id: string;
  sale_number: string;
  quantity_oz: number;
  london_am_rate: number;
  gross_proceeds: number;
  freight_cost: number;
  other_costs: number;
  net_proceeds: number;
  royalty_amount: number;
  final_proceeds: number;
  status: string;
  mechanism_type: string | null;
  created_at: string;
  customer: {
    name: string;
    email: string;
    country: string;
  } | null;
}

const getPaymentTermsSummary = (mechanismType: string | null | undefined) => {
  if (!mechanismType || mechanismType.toLowerCase() === 'spot') {
    return {
      title: 'Paiement au comptant',
      timeline: 'Immédiat',
      commitment: 'Votre approbation constitue un engagement de paiement',
      dueDate: 'Paiement exigible sous deux jours ouvrés',
      pricing: 'Cours actuel du marché verrouillé',
      icon: DollarSign,
      color: 'emerald',
      alert: 'En approuvant cette vente, vous vous engagez à régler le montant sous deux jours ouvrés selon les conditions au comptant.'
    };
  }

  if (mechanismType.toLowerCase().includes('forward_7')) {
    return {
      title: 'Paiement à terme — 7 jours',
      timeline: '7 jours ouvrés',
      commitment: 'Paiement exigible sous sept jours ouvrés',
      dueDate: 'Échéance fixée à sept jours après l’approbation',
      pricing: 'Prix fixé à la date du contrat',
      icon: Clock,
      color: 'blue',
      alert: 'En approuvant cette vente, vous vous engagez à régler le montant sous sept jours ouvrés à compter de ce jour.'
    };
  }

  if (mechanismType.toLowerCase().includes('forward_14')) {
    return {
      title: 'Paiement à terme — 14 jours',
      timeline: '14 jours ouvrés',
      commitment: 'Paiement exigible sous quatorze jours ouvrés',
      dueDate: 'Échéance fixée à quatorze jours après l’approbation',
      pricing: 'Prix fixé à la date du contrat',
      icon: Clock,
      color: 'indigo',
      alert: 'En approuvant cette vente, vous vous engagez à régler le montant sous quatorze jours ouvrés à compter de ce jour.'
    };
  }

  return {
    title: 'Conditions de paiement standard',
    timeline: '2 jours ouvrés',
    commitment: 'Les conditions de paiement standard s’appliquent',
    dueDate: 'Paiement sous deux jours ouvrés',
    pricing: 'Conditions de prix en vigueur',
    icon: DollarSign,
    color: 'gray',
    alert: 'En approuvant cette vente, vous acceptez les conditions de paiement indiquées.'
  };
};

export function CustomerSaleApproval() {
  const { saleId } = useParams<{ saleId: string }>();

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    if (saleId) {
      loadSaleDetails();
    }
  }, [saleId]);

  const loadSaleDetails = async () => {
    if (!saleId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await loadCustomerSaleForDecision(saleId);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Vente introuvable.');
      }
      setSale(result.data as Sale);
    } catch (err: any) {
      console.error('Error loading sale:', err);
      setError(err.message || 'Failed to load sale details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!sale) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await approveCustomerSale(sale.id);

      if (result.success) {
        setActionType('approve');
        setSuccess(true);
      } else {
        throw new Error(result.error || 'La vente n’a pas pu être approuvée.');
      }
    } catch (err: any) {
      console.error('Error approving sale:', err);
      setError(err.message || 'Failed to approve sale');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!sale || rejectionReason.trim().length < 5) {
      setError('Veuillez préciser le motif du refus (5 caractères minimum).');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await rejectCustomerSale(sale.id, rejectionReason);

      if (result.success) {
        setActionType('reject');
        setSuccess(true);
        setShowRejectModal(false);
      } else {
        throw new Error(result.error || 'La vente n’a pas pu être rejetée.');
      }
    } catch (err: any) {
      console.error('Error rejecting sale:', err);
      setError(err.message || 'Failed to reject sale');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (error && !sale) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto py-12">
          <Alert variant="error" title="Chargement de la vente impossible">
            {error}
          </Alert>
        </div>
      </MainLayout>
    );
  }

  if (success && actionType) {
    const isApproved = actionType === 'approve';
    const isSpot = !sale?.mechanism_type || sale?.mechanism_type.toLowerCase() === 'spot';

    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto py-12 space-y-6">
          <Card className={`border-2 ${isApproved ? 'border-green-300' : 'border-red-300'}`}>
            <CardHeader className={`${isApproved ? 'bg-green-50' : 'bg-red-50'}`}>
              <CardTitle className="flex items-center gap-3">
                {isApproved ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
                <span className={isApproved ? 'text-green-900' : 'text-red-900'}>
                  {isApproved ? 'Vente approuvée avec succès' : 'Vente rejetée'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="text-center space-y-3">
                <p className="text-xl font-semibold text-gray-900">
                  Vente {sale?.sale_number}
                </p>

                {isApproved && (
                  <>
                    {isSpot ? (
                      <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-lg">
                        <p className="text-sm font-semibold text-emerald-900 mb-2">
                          État du paiement : ENGAGEMENT ENREGISTRÉ
                        </p>
                        <p className="text-sm text-emerald-800">
                          Votre approbation d’une vente <strong>au comptant</strong> constitue un engagement de paiement.
                          Le règlement est attendu sous <strong>deux jours ouvrés</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                        <p className="text-sm font-semibold text-blue-900 mb-2">
                          Paiement requis
                        </p>
                        <p className="text-sm text-blue-800">
                          Veuillez procéder au paiement conformément aux conditions convenues :
                          <strong className="block mt-1">
                            {sale?.mechanism_type?.includes('7') ? '7 jours ouvrés' : '14 jours ouvrés'}
                          </strong>
                        </p>
                      </div>
                    )}

                    <div className="pt-4 space-y-2 text-sm text-gray-700">
                      <p className="flex items-center justify-center gap-2">
                        <Mail className="h-4 w-4" />
                        Un courriel de confirmation a été envoyé à {sale?.customer?.email}
                      </p>
                      <p className="flex items-center justify-center gap-2">
                        <FileText className="h-4 w-4" />
                        La facture et les modalités de paiement seront communiquées prochainement.
                      </p>
                    </div>
                  </>
                )}

                {!isApproved && (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-700">
                      La vente a été rejetée. L’équipe commerciale en sera informée et pourra vous contacter afin d’examiner les solutions possibles.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Montant</p>
                    <p className="font-bold text-lg text-gray-900">
                      {formatCurrency(sale?.final_proceeds || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Quantité</p>
                    <p className="font-bold text-lg text-gray-900">
                      {sale?.quantity_oz.toFixed(3)} oz
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center text-xs text-gray-500 pt-4">
                <p>Merci de la confiance accordée à la SONASP.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (!sale) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto py-12">
          <Alert variant="error" title="Vente introuvable">
            La vente demandée est introuvable ou n’est plus disponible pour approbation.
          </Alert>
        </div>
      </MainLayout>
    );
  }

  const paymentTerms = getPaymentTermsSummary(sale.mechanism_type);
  const TermsIcon = paymentTerms.icon;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            Demande d’approbation d’une vente
          </h1>
          <p className="text-gray-600">
            Vérifiez les informations de la vente et les conditions de paiement avant de statuer.
          </p>
        </div>

        {error && (
          <Alert variant="error" title="Erreur">
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Informations sur la vente
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm font-semibold text-gray-700">Référence de la vente</span>
                    <span className="text-base font-bold text-gray-900">{sale.sale_number}</span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm font-semibold text-gray-700">Client</span>
                    <span className="text-base font-semibold text-gray-900">
                      {sale.customer?.name}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm font-semibold text-gray-700">Quantité</span>
                    <span className="text-base font-bold text-gray-900">
                      {sale.quantity_oz.toFixed(3)} oz
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm font-semibold text-gray-700">Prix par once</span>
                    <span className="text-base font-bold text-gray-900">
                      {formatCurrency(sale.london_am_rate)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-3 bg-green-50 rounded-lg px-4">
                    <span className="text-sm font-semibold text-green-900">Produit brut</span>
                    <span className="text-lg font-bold text-green-700">
                      {formatCurrency(sale.gross_proceeds)}
                    </span>
                  </div>

                  {sale.freight_cost > 0 && (
                    <div className="flex justify-between items-center px-4">
                      <span className="text-sm text-gray-700">Frais de transport</span>
                      <span className="text-base font-semibold text-red-600">
                        -{formatCurrency(sale.freight_cost)}
                      </span>
                    </div>
                  )}

                  {sale.other_costs > 0 && (
                    <div className="flex justify-between items-center px-4">
                      <span className="text-sm text-gray-700">Autres frais</span>
                      <span className="text-base font-semibold text-red-600">
                        -{formatCurrency(sale.other_costs)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center px-4 pt-2">
                    <span className="text-sm font-semibold text-gray-700">Produit net</span>
                    <span className="text-base font-bold text-gray-900">
                      {formatCurrency(sale.net_proceeds)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center px-4">
                    <span className="text-sm text-gray-700">Redevances (3 %)</span>
                    <span className="text-base font-semibold text-red-600">
                      -{formatCurrency(sale.royalty_amount)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-4 px-4 bg-gradient-to-r from-primary-100 to-blue-100 border-2 border-primary-300 rounded-lg mt-3">
                    <span className="text-lg font-bold text-gray-900">Montant final</span>
                    <span className="text-2xl font-bold text-primary-700">
                      {formatCurrency(sale.final_proceeds)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-2 border-${paymentTerms.color}-200`}>
              <CardHeader className={`bg-${paymentTerms.color}-50`}>
                <CardTitle className={`flex items-center gap-2 text-${paymentTerms.color}-900`}>
                  <TermsIcon className="h-5 w-5" />
                  {paymentTerms.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Délai</p>
                      <p className="font-semibold text-gray-900">{paymentTerms.timeline}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Tarification</p>
                      <p className="font-semibold text-gray-900">{paymentTerms.pricing}</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle className={`h-4 w-4 text-${paymentTerms.color}-600 flex-shrink-0 mt-0.5`} />
                      <span className="text-gray-700">{paymentTerms.commitment}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle className={`h-4 w-4 text-${paymentTerms.color}-600 flex-shrink-0 mt-0.5`} />
                      <span className="text-gray-700">{paymentTerms.dueDate}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle className={`h-4 w-4 text-${paymentTerms.color}-600 flex-shrink-0 mt-0.5`} />
                      <span className="text-gray-700">Virement bancaire sur le compte désigné</span>
                    </div>
                  </div>

                  <Alert type="warning" className="mt-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{paymentTerms.alert}</p>
                    </div>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-2 border-gray-200 sticky top-6">
              <CardHeader className="bg-gray-50">
                <CardTitle className="text-base">Votre décision</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {submitting ? 'Traitement en cours…' : 'Approuver la vente'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setShowRejectModal(true)}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Rejeter la vente
                  </Button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-600 text-center">
                    En approuvant cette vente, vous acceptez les conditions de paiement et vous engagez à exécuter la transaction selon les modalités indiquées.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <CardHeader className="bg-red-50">
                <CardTitle className="text-red-900">Rejeter la vente</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm text-gray-700">
                  Indiquez le motif du rejet de cette vente afin de permettre son examen par l’équipe commerciale.
                </p>

                <TextArea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Saisissez le motif du rejet…"
                  rows={4}
                  className="w-full"
                />

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectionReason('');
                    }}
                    disabled={submitting}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={submitting || !rejectionReason.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {submitting ? 'Traitement en cours…' : 'Confirmer le rejet'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
