import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Package,
  TrendingUp,
  AlertCircle,
  FileText,
  Clock,
  Building2,
  Mail
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { customerApproveSale, customerRejectSale } from '@/services/salesService';
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
      title: 'Spot Basis Payment',
      timeline: 'Immediate',
      commitment: 'Your approval constitutes payment commitment',
      dueDate: 'Payment due within 2 business days',
      pricing: 'Current market price locked',
      icon: DollarSign,
      color: 'emerald',
      alert: 'By approving this sale, you are committing to pay within 2 business days according to spot basis terms.'
    };
  }

  if (mechanismType.toLowerCase().includes('forward_7')) {
    return {
      title: 'Forward 7 Days Payment',
      timeline: '7 Business Days',
      commitment: 'Payment required in 7 business days',
      dueDate: 'Due date: 7 days from approval',
      pricing: 'Price fixed at contract date',
      icon: Clock,
      color: 'blue',
      alert: 'By approving this sale, you agree to pay within 7 business days from today.'
    };
  }

  if (mechanismType.toLowerCase().includes('forward_14')) {
    return {
      title: 'Forward 14 Days Payment',
      timeline: '14 Business Days',
      commitment: 'Payment required in 14 business days',
      dueDate: 'Due date: 14 days from approval',
      pricing: 'Price fixed at contract date',
      icon: Clock,
      color: 'indigo',
      alert: 'By approving this sale, you agree to pay within 14 business days from today.'
    };
  }

  return {
    title: 'Standard Payment Terms',
    timeline: '2 Business Days',
    commitment: 'Standard payment terms apply',
    dueDate: 'Payment within 2 business days',
    pricing: 'Current price terms',
    icon: DollarSign,
    color: 'gray',
    alert: 'By approving this sale, you agree to the payment terms specified.'
  };
};

export function CustomerSaleApproval() {
  const { saleId, token } = useParams<{ saleId: string; token: string }>();
  const navigate = useNavigate();

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
      const { data, error: fetchError } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(
            name,
            email,
            country
          )
        `)
        .eq('id', saleId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        throw new Error('Sale not found');
      }

      // Customer can approve when status is 'customer_approved' (management approved, awaiting customer)
      // or 'pending_approval' in some cases
      if (!['pending_approval', 'customer_approved'].includes(data.status)) {
        throw new Error('This sale is not available for customer approval. Current status: ' + data.status);
      }

      setSale(data as Sale);
    } catch (err: any) {
      console.error('Error loading sale:', err);
      setError(err.message || 'Failed to load sale details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!sale || !sale.customer?.email) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await customerApproveSale(sale.id, sale.customer.email);

      if (result.success) {
        setActionType('approve');
        setSuccess(true);
      } else {
        throw new Error(result.error || 'Failed to approve sale');
      }
    } catch (err: any) {
      console.error('Error approving sale:', err);
      setError(err.message || 'Failed to approve sale');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!sale || !sale.customer?.email || !rejectionReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await customerRejectSale(
        sale.id,
        sale.customer.email,
        rejectionReason
      );

      if (result.success) {
        setActionType('reject');
        setSuccess(true);
        setShowRejectModal(false);
      } else {
        throw new Error(result.error || 'Failed to reject sale');
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
          <Alert variant="error" title="Unable to Load Sale">
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
                  {isApproved ? 'Sale Approved Successfully' : 'Sale Rejected'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="text-center space-y-3">
                <p className="text-xl font-semibold text-gray-900">
                  Sale {sale?.sale_number}
                </p>

                {isApproved && (
                  <>
                    {isSpot ? (
                      <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-lg">
                        <p className="text-sm font-semibold text-emerald-900 mb-2">
                          Payment Status: COMMITTED
                        </p>
                        <p className="text-sm text-emerald-800">
                          Your approval on <strong>Spot Basis</strong> constitutes payment commitment.
                          Payment is expected within <strong>2 business days</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                        <p className="text-sm font-semibold text-blue-900 mb-2">
                          Payment Required
                        </p>
                        <p className="text-sm text-blue-800">
                          Please proceed with payment according to the terms agreed:
                          <strong className="block mt-1">
                            {sale?.mechanism_type?.includes('7') ? '7 business days' : '14 business days'}
                          </strong>
                        </p>
                      </div>
                    )}

                    <div className="pt-4 space-y-2 text-sm text-gray-700">
                      <p className="flex items-center justify-center gap-2">
                        <Mail className="h-4 w-4" />
                        A confirmation email has been sent to {sale?.customer?.email}
                      </p>
                      <p className="flex items-center justify-center gap-2">
                        <FileText className="h-4 w-4" />
                        Invoice and payment details will follow shortly
                      </p>
                    </div>
                  </>
                )}

                {!isApproved && (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-700">
                      The sale has been rejected. The sales team will be notified and may contact you to discuss alternatives.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Amount</p>
                    <p className="font-bold text-lg text-gray-900">
                      {formatCurrency(sale?.final_proceeds || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Quantity</p>
                    <p className="font-bold text-lg text-gray-900">
                      {sale?.quantity_oz.toFixed(3)} oz
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center text-xs text-gray-500 pt-4">
                <p>Thank you for your business with Mansa Resources</p>
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
          <Alert variant="error" title="Sale Not Found">
            The requested sale could not be found or is no longer available for approval.
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
            Sale Approval Request
          </h1>
          <p className="text-gray-600">
            Please review the sale details and payment terms before approving
          </p>
        </div>

        {error && (
          <Alert variant="error" title="Error">
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Sale Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm font-semibold text-gray-700">Sale Number</span>
                    <span className="text-base font-bold text-gray-900">{sale.sale_number}</span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm font-semibold text-gray-700">Customer</span>
                    <span className="text-base font-semibold text-gray-900">
                      {sale.customer?.name}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm font-semibold text-gray-700">Quantity</span>
                    <span className="text-base font-bold text-gray-900">
                      {sale.quantity_oz.toFixed(3)} oz
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm font-semibold text-gray-700">Price per oz</span>
                    <span className="text-base font-bold text-gray-900">
                      {formatCurrency(sale.london_am_rate)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-3 bg-green-50 rounded-lg px-4">
                    <span className="text-sm font-semibold text-green-900">Gross Proceeds</span>
                    <span className="text-lg font-bold text-green-700">
                      {formatCurrency(sale.gross_proceeds)}
                    </span>
                  </div>

                  {sale.freight_cost > 0 && (
                    <div className="flex justify-between items-center px-4">
                      <span className="text-sm text-gray-700">Freight Cost</span>
                      <span className="text-base font-semibold text-red-600">
                        -{formatCurrency(sale.freight_cost)}
                      </span>
                    </div>
                  )}

                  {sale.other_costs > 0 && (
                    <div className="flex justify-between items-center px-4">
                      <span className="text-sm text-gray-700">Other Costs</span>
                      <span className="text-base font-semibold text-red-600">
                        -{formatCurrency(sale.other_costs)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center px-4 pt-2">
                    <span className="text-sm font-semibold text-gray-700">Net Proceeds</span>
                    <span className="text-base font-bold text-gray-900">
                      {formatCurrency(sale.net_proceeds)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center px-4">
                    <span className="text-sm text-gray-700">Royalties (3%)</span>
                    <span className="text-base font-semibold text-red-600">
                      -{formatCurrency(sale.royalty_amount)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-4 px-4 bg-gradient-to-r from-primary-100 to-blue-100 border-2 border-primary-300 rounded-lg mt-3">
                    <span className="text-lg font-bold text-gray-900">Final Amount</span>
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
                      <p className="text-xs text-gray-600 mb-1">Timeline</p>
                      <p className="font-semibold text-gray-900">{paymentTerms.timeline}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Pricing</p>
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
                      <span className="text-gray-700">Wire transfer to designated account</span>
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
                <CardTitle className="text-base">Your Decision</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {submitting ? 'Processing...' : 'Approve Sale'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setShowRejectModal(true)}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject Sale
                  </Button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-600 text-center">
                    By approving this sale, you agree to the payment terms and commit to complete the transaction as specified.
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
                <CardTitle className="text-red-900">Reject Sale</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm text-gray-700">
                  Please provide a reason for rejecting this sale. This will help us understand your concerns.
                </p>

                <TextArea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter your reason for rejection..."
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
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={submitting || !rejectionReason.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {submitting ? 'Processing...' : 'Confirm Rejection'}
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
