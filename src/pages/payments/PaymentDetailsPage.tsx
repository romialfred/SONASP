import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, FileText, CheckCircle, Clock,
  XCircle, Package, Truck, Building2, DollarSign,
  User, Calendar, CreditCard, AlertCircle, Award,
  Shield, Zap, Eye, ExternalLink
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { collectPaymentDocuments, PaymentDocument } from '@/services/paymentDocumentsService';

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'in_progress';
  icon: any;
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  const sortedEvents = [...events].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-4">
      {sortedEvents.map((event, index) => {
        const Icon = event.icon;
        const isLast = index === sortedEvents.length - 1;

        const statusColors = {
          completed: 'bg-green-100 text-green-600 border-green-200',
          in_progress: 'bg-blue-100 text-blue-600 border-blue-200',
          pending: 'bg-gray-100 text-gray-600 border-gray-200',
        };

        return (
          <div key={event.id} className="relative">
            {!isLast && (
              <div className="absolute left-5 top-12 w-0.5 h-full bg-gradient-to-b from-gray-300 to-transparent -ml-px" />
            )}
            <div className="flex items-start gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-sm ${statusColors[event.status]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 pt-1">
                <p className="font-semibold text-gray-900">{event.title}</p>
                <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(event.timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentCard({ document }: { document: PaymentDocument }) {
  const iconMap = {
    production: { icon: Package, color: 'bg-blue-100 text-blue-600', borderColor: 'border-blue-200' },
    shipping: { icon: Truck, color: 'bg-purple-100 text-purple-600', borderColor: 'border-purple-200' },
    refining: { icon: Zap, color: 'bg-amber-100 text-amber-600', borderColor: 'border-amber-200' },
    sale: { icon: FileText, color: 'bg-green-100 text-green-600', borderColor: 'border-green-200' },
    export_license: { icon: Shield, color: 'bg-red-100 text-red-600', borderColor: 'border-red-200' },
    assay_certificate: { icon: Award, color: 'bg-indigo-100 text-indigo-600', borderColor: 'border-indigo-200' },
    payment_proof: { icon: CheckCircle, color: 'bg-green-100 text-green-600', borderColor: 'border-green-200' },
  };

  const config = iconMap[document.type] || iconMap.sale;
  const Icon = config.icon;

  return (
    <div className={`p-4 border-2 ${config.borderColor} rounded-lg hover:shadow-md transition-all bg-white`}>
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg ${config.color} shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{document.name}</p>
          {document.metadata?.description && (
            <p className="text-sm text-gray-600 mt-1">{document.metadata.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2">
            <p className="text-xs text-gray-500">
              {new Date(document.uploadedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            {document.size && (
              <p className="text-xs text-gray-500">
                {(document.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(document.url, '_blank')}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              View
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const link = document.createElement('a');
                link.href = document.url;
                link.download = document.name;
                link.click();
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'activity'>('overview');

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

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusVariant = (status: string) => {
    if (status === 'approved') return 'success';
    if (status === 'pending') return 'warning';
    if (status === 'rejected') return 'error';
    return 'default';
  };

  const timelineEvents: TimelineEvent[] = [
    {
      id: '1',
      title: 'Payment Created',
      description: `Payment record created for ${payment?.invoice_number || 'N/A'}`,
      timestamp: payment?.created_at || new Date().toISOString(),
      status: 'completed',
      icon: FileText,
    },
    {
      id: '2',
      title: payment?.status === 'approved' ? 'Payment Approved' : 'Awaiting Approval',
      description: payment?.status === 'approved'
        ? 'Payment has been approved and processed'
        : 'Payment is pending approval',
      timestamp: payment?.updated_at || payment?.created_at || new Date().toISOString(),
      status: payment?.status === 'approved' ? 'completed' : 'pending',
      icon: payment?.status === 'approved' ? CheckCircle : Clock,
    },
  ];

  const documentsByCategory = documents.reduce((acc, doc) => {
    const category = doc.type;
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, PaymentDocument[]>);

  const categoryLabels = {
    production: 'Production Documents',
    shipping: 'Shipping Documents',
    refining: 'Refining Documents',
    sale: 'Sales Documents',
    export_license: 'Export Licenses',
    assay_certificate: 'Quality Control Certificates',
    payment_proof: 'Payment Proof',
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading payment details...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!payment) {
    return (
      <MainLayout>
        <div className="text-center py-16">
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Not Found</h3>
          <p className="text-gray-600 mb-6">The payment you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/payments')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payments
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header with Gradient */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              onClick={() => navigate('/payments')}
              className="text-white border-white hover:bg-white hover:text-primary-600"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              variant="outline"
              className="text-white border-white hover:bg-white hover:text-primary-600"
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>

          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2">Payment Details</h1>
            <p className="text-primary-100 text-lg">{payment.invoice_number || `INV-${payment.id.slice(0, 8).toUpperCase()}`}</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8" />
                <div>
                  <p className="text-sm text-primary-100">Amount</p>
                  <p className="text-xl font-bold">{formatCurrency(payment.amount || 0, payment.currency || 'USD')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8" />
                <div>
                  <p className="text-sm text-primary-100">Due Date</p>
                  <p className="text-xl font-bold">{formatDate(payment.expected_date)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-8 w-8" />
                <div>
                  <p className="text-sm text-primary-100">Method</p>
                  <p className="text-xl font-bold">{payment.bank_name || 'Bank Transfer'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-3">
                {payment.status === 'approved' ? <CheckCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
                <div>
                  <p className="text-sm text-primary-100">Status</p>
                  <p className="text-xl font-bold capitalize">{payment.status || 'Pending'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'documents'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Documents ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'activity'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Activity
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sale Information */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <FileText className="h-5 w-5" />
                  Sale Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Sale Number</span>
                  <span className="text-gray-900 font-semibold">{sale?.sale_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Sale Date</span>
                  <span className="text-gray-900 font-semibold">{formatDate(sale?.sale_date)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Total Amount</span>
                  <span className="text-gray-900 font-semibold">{formatCurrency(sale?.total_amount || 0, 'USD')}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-gray-600 font-medium">Status</span>
                  <StatusBadge label={sale?.status || 'Unknown'} variant={getStatusVariant(sale?.status)} />
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b">
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <User className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Name</span>
                  <span className="text-gray-900 font-semibold">{customer?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Email</span>
                  <span className="text-gray-900 font-semibold">{customer?.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Phone</span>
                  <span className="text-gray-900 font-semibold">{customer?.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-gray-600 font-medium">Country</span>
                  <span className="text-gray-900 font-semibold">{customer?.country || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Information */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-amber-100 border-b">
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <DollarSign className="h-5 w-5" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Amount</span>
                  <span className="text-gray-900 font-bold text-lg">{formatCurrency(payment.amount || 0, payment.currency || 'USD')}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Currency</span>
                  <span className="text-gray-900 font-semibold">{payment.currency || 'USD'}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">FX Rate</span>
                  <span className="text-gray-900 font-semibold">{payment.fx_rate ? payment.fx_rate.toFixed(4) : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Payment Method</span>
                  <span className="text-gray-900 font-semibold">{payment.bank_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-gray-600 font-medium">Reference</span>
                  <span className="text-gray-900 font-semibold">{payment.reference_number || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b">
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <Clock className="h-5 w-5" />
                  Transaction Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Timeline events={timelineEvents} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            {documents.length === 0 ? (
              <Card className="shadow-lg">
                <CardContent className="py-16 text-center">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Documents Available</h3>
                  <p className="text-gray-600">Documents from production, shipping, and other processes will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              Object.entries(documentsByCategory).map(([category, docs]) => (
                <Card key={category} className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                    <CardTitle>{categoryLabels[category as keyof typeof categoryLabels] || category}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{docs.length} document(s)</p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {docs.map((doc) => (
                        <DocumentCard key={doc.id} document={doc} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-b">
              <CardTitle>Activity History</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Timeline events={timelineEvents} />
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
