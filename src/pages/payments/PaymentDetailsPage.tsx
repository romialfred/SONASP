import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, FileText, CheckCircle, Clock,
  XCircle, Package, Truck, Building2, DollarSign,
  User, Calendar, CreditCard, AlertCircle, MapPin,
  Phone, Mail, FileCheck, Upload, Eye, BadgeCheck
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Timeline } from '@/components/batch/Timeline';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

interface PaymentDetails {
  id: string;
  sale_id: string;
  customer_id: string;
  invoice_number: string;
  expected_date: string;
  actual_date: string | null;
  due_date: string | null;
  amount: number;
  currency: string;
  fx_rate: number;
  bank_name: string;
  account_number: string;
  reference_number: string;
  transaction_id: string;
  payment_method: string;
  proof_url: string;
  notes: string;
  status: string;
  created_at: string;
  approved_at: string;
  verified_at: string;
  sale_number: string;
  sale_date: string;
  sale_total_amount: number;
  net_proceeds: number;
  sale_status: string;
  london_am_rate: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  company_name: string;
  customer_country: string;
  payment_status_category: string;
  days_overdue: number | null;
  document_count: number;
  proof_count: number;
  created_by_name: string;
  created_by_email: string;
  approved_by_name: string;
  approved_by_email: string;
  verified_by_name: string;
  verified_by_email: string;
}

interface PaymentDocument {
  id: string;
  document_type: string;
  document_name: string;
  document_url: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  notes: string;
  is_verified: boolean;
  verified_at: string;
}

interface PaymentHistory {
  id: string;
  changed_at: string;
  change_type: string;
  old_status: string;
  new_status: string;
  field_changes: any;
  notes: string;
}

interface SaleLineItem {
  id: string;
  batch_id: string;
  metal_type: string;
  quantity_grams: number;
  quantity_oz: number;
  unit_price: number;
  fineness_percentage: number;
  fine_weight_oz: number;
  line_total: number;
}

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_oz: number;
  created_at: string;
  shipped_date: string;
  received_at_airport_date: string;
  received_at_refinery_date: string;
}

export function PaymentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [documents, setDocuments] = useState<PaymentDocument[]>([]);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [saleLineItems, setSaleLineItems] = useState<SaleLineItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'history' | 'batches'>('overview');

  useEffect(() => {
    if (id) {
      fetchPaymentDetails();
    }
  }, [id]);

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true);

      const [paymentRes, docsRes, historyRes] = await Promise.all([
        supabase.from('payments_with_details').select('*').eq('id', id).single(),
        supabase.from('payment_documents').select('*').eq('payment_id', id).order('uploaded_at', { ascending: false }),
        supabase.from('payment_history').select('*').eq('payment_id', id).order('changed_at', { ascending: false }),
      ]);

      if (paymentRes.error) throw paymentRes.error;
      setPayment(paymentRes.data);

      setDocuments(docsRes.data || []);
      setHistory(historyRes.data || []);

      if (paymentRes.data?.sale_id) {
        const { data: lineItems, error: lineItemsError } = await supabase
          .from('sales_line_items')
          .select('*')
          .eq('sale_id', paymentRes.data.sale_id);

        if (!lineItemsError && lineItems) {
          setSaleLineItems(lineItems);

          const batchIds = lineItems.map((item) => item.batch_id).filter(Boolean);
          if (batchIds.length > 0) {
            const { data: batchData, error: batchError } = await supabase
              .from('batches')
              .select('*')
              .in('id', batchIds);

            if (!batchError && batchData) {
              setBatches(batchData);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching payment details:', error);
      addToast('Failed to load payment details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'paid':
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'overdue':
        return 'error';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return FileText;
      case 'payment_proof':
        return FileCheck;
      case 'receipt':
        return CheckCircle;
      default:
        return FileText;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-600">Loading payment details...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!payment) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Payment not found</p>
          <Button className="mt-4" onClick={() => navigate('/payments')}>
            Back to Payments
          </Button>
        </div>
      </MainLayout>
    );
  }

  const timelineEvents = [
    ...(batches.length > 0
      ? batches.flatMap((batch) => [
          {
            id: `batch-${batch.id}-shipped`,
            title: 'Batch Shipped from Factory',
            description: `Batch ${batch.batch_number} - ${batch.weight_grams}g`,
            timestamp: batch.shipped_date || batch.created_at,
            status: 'completed' as const,
            icon: Package,
          },
          batch.received_at_airport_date && {
            id: `batch-${batch.id}-airport`,
            title: 'Received at Airport',
            description: `Batch ${batch.batch_number}`,
            timestamp: batch.received_at_airport_date,
            status: 'completed' as const,
            icon: MapPin,
          },
          batch.received_at_refinery_date && {
            id: `batch-${batch.id}-refinery`,
            title: 'Received at Refinery',
            description: `Batch ${batch.batch_number}`,
            timestamp: batch.received_at_refinery_date,
            status: 'completed' as const,
            icon: Building2,
          },
        ]).filter(Boolean)
      : []),
    {
      id: 'sale-created',
      title: 'Sale Created',
      description: `Sale ${payment.sale_number}`,
      timestamp: payment.sale_date,
      status: 'completed' as const,
      icon: DollarSign,
    },
    {
      id: 'payment-created',
      title: 'Payment Record Created',
      description: `Invoice ${payment.invoice_number}`,
      timestamp: payment.created_at,
      status: 'completed' as const,
      icon: FileText,
    },
    payment.approved_at && {
      id: 'payment-approved',
      title: 'Payment Approved',
      description: `Approved by ${payment.approved_by_name}`,
      timestamp: payment.approved_at,
      status: 'completed' as const,
      icon: CheckCircle,
    },
    payment.verified_at && {
      id: 'payment-verified',
      title: 'Payment Verified',
      description: `Verified by ${payment.verified_by_name}`,
      timestamp: payment.verified_at,
      status: 'completed' as const,
      icon: BadgeCheck,
    },
  ].filter(Boolean) as Array<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
    status: 'completed' | 'pending' | 'in_progress';
    icon: any;
  }>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/payments')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                Payment Details
              </h1>
              <p className="text-gray-600 mt-1">{payment.invoice_number}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <StatusBadge
              label={payment.payment_status_category}
              variant={getStatusVariant(payment.payment_status_category)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Invoice Number</label>
                  <p className="mt-1 text-gray-900 font-medium">{payment.invoice_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Sale Number</label>
                  <p className="mt-1 text-gray-900 font-medium">{payment.sale_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <p className="mt-1 text-2xl font-bold text-primary-600">
                    {formatCurrency(payment.amount, payment.currency)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Currency</label>
                  <p className="mt-1 text-gray-900 font-medium">{payment.currency}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Method</label>
                  <p className="mt-1 text-gray-900">
                    {payment.payment_method ? payment.payment_method.replace(/_/g, ' ').toUpperCase() : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">FX Rate</label>
                  <p className="mt-1 text-gray-900">{payment.fx_rate || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Expected Date</label>
                  <p className="mt-1 text-gray-900">{formatDate(payment.expected_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Due Date</label>
                  <p className="mt-1 text-gray-900">{formatDate(payment.due_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Actual Payment Date</label>
                  <p className="mt-1 text-gray-900">{formatDate(payment.actual_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Days Overdue</label>
                  <p className={`mt-1 font-medium ${payment.days_overdue && payment.days_overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {payment.days_overdue && payment.days_overdue > 0 ? `${payment.days_overdue} days` : 'On Time'}
                  </p>
                </div>
              </div>

              {payment.notes && (
                <div className="mt-6">
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="mt-1 text-gray-900 bg-gray-50 p-3 rounded-lg">{payment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">{payment.customer_name}</p>
                      <p className="text-sm text-gray-500">{payment.company_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <p className="text-sm text-gray-600">{payment.customer_email}</p>
                  </div>
                  {payment.customer_phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <p className="text-sm text-gray-600">{payment.customer_phone}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <p className="text-sm text-gray-600">{payment.customer_country}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Banking Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Bank Name</label>
                    <p className="mt-1 text-gray-900">{payment.bank_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Account Number</label>
                    <p className="mt-1 text-gray-900 font-mono">
                      {payment.account_number || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Reference Number</label>
                    <p className="mt-1 text-gray-900 font-mono">{payment.reference_number}</p>
                  </div>
                  {payment.transaction_id && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Transaction ID</label>
                      <p className="mt-1 text-gray-900 font-mono">{payment.transaction_id}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Transaction Timeline
            </button>
            <button
              onClick={() => setActiveTab('batches')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'batches'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Gold Sold ({saleLineItems.length})
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'documents'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Documents ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'history'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              History ({history.length})
            </button>
          </nav>
        </div>

        {activeTab === 'overview' && (
          <Card>
            <CardHeader>
              <CardTitle>Complete Transaction Timeline</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Track the complete journey from factory shipping to payment
              </p>
            </CardHeader>
            <CardContent>
              <Timeline events={timelineEvents} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'batches' && (
          <Card>
            <CardHeader>
              <CardTitle>Gold Batches Sold</CardTitle>
            </CardHeader>
            <CardContent>
              {saleLineItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No batch information available</p>
              ) : (
                <div className="space-y-4">
                  {saleLineItems.map((item, index) => {
                    const batch = batches.find((b) => b.id === item.batch_id);
                    return (
                      <div
                        key={item.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg">
                              <Package className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {batch ? batch.batch_number : `Line ${index + 1}`}
                              </p>
                              <p className="text-sm text-gray-500">{item.metal_type}</p>
                            </div>
                          </div>
                          {batch && (
                            <StatusBadge label={batch.status} variant="info" />
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <label className="text-xs font-medium text-gray-500">Quantity</label>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              {item.quantity_oz.toFixed(4)} oz
                            </p>
                            <p className="text-xs text-gray-500">{item.quantity_grams.toFixed(3)} g</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">Fineness</label>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              {item.fineness_percentage}%
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">Unit Price</label>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              ${item.unit_price.toFixed(2)}/oz
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">Line Total</label>
                            <p className="mt-1 text-sm font-bold text-primary-600">
                              {formatCurrency(item.line_total, payment.currency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-gray-900">Total Sale Amount</p>
                      <p className="text-2xl font-bold text-primary-600">
                        {formatCurrency(payment.sale_total_amount, payment.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Payment Documents</CardTitle>
                <Button size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No documents uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const Icon = getDocumentIcon(doc.document_type);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Icon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{doc.document_name}</p>
                            <p className="text-sm text-gray-500">
                              {doc.document_type.replace(/_/g, ' ')} •{' '}
                              {formatDateTime(doc.uploaded_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.is_verified && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'history' && (
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No history available</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Clock className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">
                            {item.change_type.replace(/_/g, ' ').toUpperCase()}
                          </p>
                          <p className="text-sm text-gray-500">{formatDateTime(item.changed_at)}</p>
                        </div>
                        {item.old_status && item.new_status && (
                          <p className="text-sm text-gray-600 mt-1">
                            Status changed from{' '}
                            <span className="font-medium">{item.old_status}</span> to{' '}
                            <span className="font-medium">{item.new_status}</span>
                          </p>
                        )}
                        {item.notes && <p className="text-sm text-gray-600 mt-1">{item.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
