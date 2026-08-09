import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, FileText, Calendar, DollarSign,
  User, Clock, Download, Eye, CheckCircle,
  Building2, MapPin, Phone, Mail, TrendingUp, AlertCircle, Award, Truck, Shield
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { collectPaymentDocuments, PaymentDocument } from '@/services/paymentDocumentsService';

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'pending';
}

export function PaymentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [payment, setPayment] = useState<any>(null);
  const [sale, setSale] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [documents, setDocuments] = useState<PaymentDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPaymentDetails();
      fetchDocuments();
    }
  }, [id]);

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true);

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', id)
        .single();

      if (paymentError) throw paymentError;
      setPayment(paymentData);

      if (paymentData.sale_id) {
        const { data: saleData } = await supabase
          .from('sales')
          .select('*')
          .eq('id', paymentData.sale_id)
          .single();

        setSale(saleData);

        if (saleData?.customer_id) {
          const { data: customerData } = await supabase
            .from('customers')
            .select('*')
            .eq('id', saleData.customer_id)
            .single();

          setCustomer(customerData);
        }
      }
    } catch (error: any) {
      console.error('Error fetching payment details:', error);
      addToast(`Failed to load payment details: ${error?.message || 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const docs = await collectPaymentDocuments(id!);
      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    if (status === 'approved') return 'success';
    if (status === 'pending') return 'warning';
    if (status === 'rejected') return 'error';
    return 'default';
  };

  const timelineEvents: TimelineEvent[] = [
    {
      id: '1',
      title: 'Créée',
      description: formatDate(payment?.created_at),
      timestamp: payment?.created_at || '',
      status: 'completed',
    },
    {
      id: '2',
      title: payment?.status === 'approved' ? 'Approuvée' : 'En Attente',
      description: payment?.status === 'approved' ? formatDate(payment?.updated_at) : 'En cours',
      timestamp: payment?.updated_at || payment?.created_at || '',
      status: payment?.status === 'approved' ? 'completed' : 'pending',
    },
  ];

  const documentsByCategory = documents.reduce((acc, doc) => {
    const category = doc.type;
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, PaymentDocument[]>);

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  if (!payment) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Paiement introuvable</h3>
          <p className="text-gray-600 mb-6">Le paiement demandé n'existe pas ou a été supprimé.</p>
          <Button onClick={() => navigate('/payments')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux paiements
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/payments')}
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {payment.invoice_number || `INV-${payment.id.slice(0, 8).toUpperCase()}`}
                </h1>
                <StatusBadge
                  label={payment.status || 'pending'}
                  variant={getStatusVariant(payment.status)}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Détails complets du paiement client
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations Générales */}
            <Card>
              <div className="p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                  <Package className="w-5 h-5 text-blue-600" />
                  Informations Générales
                </h3>

                {/* Info Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">
                      Date d'Échéance
                    </p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatDate(payment.expected_date)}
                    </p>
                  </div>

                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                    <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">
                      Type de Boîte
                    </p>
                    <p className="text-xl font-bold text-amber-900">
                      {payment.payment_method || 'Bank Transfer'}
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">
                      Nombre de Documents
                    </p>
                    <p className="text-xl font-bold text-green-900">
                      {documents.length}
                    </p>
                  </div>
                </div>

                {/* Destination Info */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
                        Client / Destinataire
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {customer?.name || 'Non spécifié'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {customer?.country || 'Pays non spécifié'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Vente Associée */}
            {sale && (
              <Card>
                <div className="p-6">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Vente Associée
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-start">
                      <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">
                        Numéro de Vente :
                      </span>
                      <span className="text-sm text-gray-900 font-semibold">
                        {sale.sale_number}
                      </span>
                    </div>

                    <div className="flex items-start">
                      <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">
                        Date de Vente :
                      </span>
                      <span className="text-sm text-gray-900">
                        {formatDate(sale.sale_date)}
                      </span>
                    </div>

                    <div className="flex items-start">
                      <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">
                        Montant Total :
                      </span>
                      <span className="text-sm text-gray-900 font-semibold">
                        {formatCurrency(sale.total_amount || 0, 'USD')}
                      </span>
                    </div>

                    <div className="flex items-start">
                      <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">
                        Statut :
                      </span>
                      <StatusBadge
                        label={sale.status}
                        variant={getStatusVariant(sale.status)}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Informations Financières */}
            <Card>
              <div className="p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Informations Financières
                </h3>

                <div className="bg-emerald-50 rounded-lg p-6 border-2 border-emerald-200 mb-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium text-emerald-700 mb-1">
                        Montant du Paiement
                      </p>
                      <p className="text-3xl font-bold text-emerald-900">
                        {formatCurrency(payment.amount || 0, payment.currency || 'USD')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-700 mb-1">
                        Taux de Change
                      </p>
                      <p className="text-2xl font-semibold text-emerald-900">
                        {payment.fx_rate ? payment.fx_rate.toFixed(4) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start">
                    <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">
                      Devise :
                    </span>
                    <span className="text-sm text-gray-900 font-semibold">
                      {payment.currency || 'USD'}
                    </span>
                  </div>

                  <div className="flex items-start">
                    <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">
                      Méthode de Paiement :
                    </span>
                    <span className="text-sm text-gray-900">
                      {payment.bank_name || 'Virement Bancaire'}
                    </span>
                  </div>

                  <div className="flex items-start">
                    <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">
                      Référence :
                    </span>
                    <span className="text-sm text-gray-900 font-mono">
                      {payment.reference_number || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Informations Client */}
            {customer && (
              <Card>
                <div className="p-6">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                    <User className="w-5 h-5 text-purple-600" />
                    Informations Client
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-start">
                      <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">
                        Nom :
                      </span>
                      <span className="text-sm text-gray-900 font-semibold">
                        {customer.name}
                      </span>
                    </div>

                    <div className="flex items-start">
                      <Mail className="w-4 h-4 text-gray-500 mt-0.5 mr-2" />
                      <span className="text-sm font-medium text-gray-600 w-44 flex-shrink-0">
                        Email :
                      </span>
                      <span className="text-sm text-gray-900">
                        {customer.email || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-start">
                      <Phone className="w-4 h-4 text-gray-500 mt-0.5 mr-2" />
                      <span className="text-sm font-medium text-gray-600 w-44 flex-shrink-0">
                        Téléphone :
                      </span>
                      <span className="text-sm text-gray-900">
                        {customer.phone || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-start">
                      <MapPin className="w-4 h-4 text-gray-500 mt-0.5 mr-2" />
                      <span className="text-sm font-medium text-gray-600 w-44 flex-shrink-0">
                        Pays :
                      </span>
                      <span className="text-sm text-gray-900">
                        {customer.country || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-6">
            {/* Chronologie */}
            <Card className="bg-blue-50 border-blue-200">
              <div className="p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-blue-900 mb-4">
                  <Calendar className="w-5 h-5" />
                  Chronologie
                </h3>

                <div className="space-y-4">
                  {timelineEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                          event.status === 'completed'
                            ? 'bg-green-100 text-green-600 border-2 border-green-300'
                            : 'bg-gray-100 text-gray-400 border-2 border-gray-300'
                        }`}
                      >
                        {event.status === 'completed' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm font-semibold text-gray-900">{event.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Documents */}
            <Card className="bg-amber-50 border-amber-200">
              <div className="p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-amber-900 mb-4">
                  <FileText className="w-5 h-5" />
                  Documents Générés
                </h3>

                <div className="space-y-3">
                  {documents.length === 0 ? (
                    <p className="text-sm text-amber-700 text-center py-4">
                      Aucun document disponible
                    </p>
                  ) : (
                    documents.slice(0, 5).map((doc) => {
                      let IconComponent = FileText;
                      let bgColor = 'bg-amber-100';
                      let textColor = 'text-amber-600';

                      if (doc.type === 'payment_proof') {
                        IconComponent = CheckCircle;
                        bgColor = 'bg-green-100';
                        textColor = 'text-green-600';
                      } else if (doc.type === 'sale') {
                        IconComponent = TrendingUp;
                        bgColor = 'bg-blue-100';
                        textColor = 'text-blue-600';
                      } else if (doc.type === 'assay_certificate') {
                        IconComponent = Award;
                        bgColor = 'bg-purple-100';
                        textColor = 'text-purple-600';
                      } else if (doc.type === 'shipping') {
                        IconComponent = Truck;
                        bgColor = 'bg-indigo-100';
                        textColor = 'text-indigo-600';
                      } else if (doc.type === 'export_license') {
                        IconComponent = Shield;
                        bgColor = 'bg-red-100';
                        textColor = 'text-red-600';
                      }

                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-200 hover:border-amber-300 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`p-2 rounded-lg ${bgColor}`}>
                              <IconComponent className={`h-4 w-4 ${textColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {doc.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <button
                              onClick={() => window.open(doc.url, '_blank')}
                              className="p-1.5 hover:bg-amber-100 rounded transition-colors"
                              title="Voir"
                            >
                              <Eye className="h-4 w-4 text-amber-700" />
                            </button>
                            <button
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = doc.url;
                                link.download = doc.name;
                                link.click();
                              }}
                              className="p-1.5 hover:bg-amber-100 rounded transition-colors"
                              title="Télécharger"
                            >
                              <Download className="h-4 w-4 text-amber-700" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {documents.length > 5 && (
                    <p className="text-xs text-amber-700 text-center pt-2">
                      +{documents.length - 5} autres document(s)
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
