import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Loading } from '@/components/ui/Loading';
import { Modal } from '@/components/ui/Modal';
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  CreditCard,
  FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import {
  getVirtualPayments,
  getVirtualPaymentById,
  convertVirtualToActual,
  markVirtualPaymentReceived,
  getVirtualPaymentStats,
  type VirtualPayment
} from '@/services/virtualPaymentService';
import { getCurrentFXRate, compareFXRates } from '@/services/paymentService';
import { formatCurrency } from '@/utils/salesUtils';

export function VirtualPaymentsPage() {
  const navigate = useNavigate();
  const alert = useAlert();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [virtualPayments, setVirtualPayments] = useState<VirtualPayment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for conversion
  const [actualDate, setActualDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [fxComparison, setFxComparison] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentsResult, statsResult] = await Promise.all([
        getVirtualPayments(),
        getVirtualPaymentStats()
      ]);

      if (paymentsResult.success && paymentsResult.data) {
        setVirtualPayments(paymentsResult.data);
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert.error('Failed to load virtual payments');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPayment = async (payment: VirtualPayment) => {
    try {
      const result = await getVirtualPaymentById(payment.id);
      if (result.success && result.data) {
        setSelectedPayment(result.data);
        setReferenceNumber(result.data.reference_number || '');
        setBankName(result.data.bank_name || '');
        setNotes(result.data.notes || '');
      }
    } catch (error) {
      console.error('Error loading payment details:', error);
    }
  };

  const handleOpenConvertModal = async (payment: VirtualPayment) => {
    await handleSelectPayment(payment);
    setShowConvertModal(true);

    // Auto-fetch FX rate if currency is not USD
    if (payment.currency !== 'USD') {
      const fxResult = await getCurrentFXRate(payment.currency);
      if (fxResult.success && fxResult.rate) {
        setFxRate(fxResult.rate);
      }

      const comparisonResult = await compareFXRates(payment.currency);
      if (comparisonResult.success && comparisonResult.data) {
        setFxComparison(comparisonResult.data);
      }
    }
  };

  const handleConvertToActual = async () => {
    if (!selectedPayment || !user?.email) {
      alert.error('Missing required information');
      return;
    }

    if (!bankName.trim() || !referenceNumber.trim()) {
      alert.error('Please provide bank name and reference number');
      return;
    }

    setSubmitting(true);
    try {
      const result = await convertVirtualToActual({
        paymentId: selectedPayment.id,
        actualDate,
        bankName,
        accountNumber: accountNumber.trim() || 'N/A',
        referenceNumber,
        transactionId: transactionId.trim() || undefined,
        fxRate: fxRate || undefined,
        proofUrl: proofUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        convertedBy: user.id
      });

      if (result.success) {
        alert.success('Virtual payment converted to actual successfully!');
        setShowConvertModal(false);
        resetForm();
        await loadData();
      } else {
        alert.error(result.error || 'Failed to convert payment');
      }
    } catch (error: any) {
      console.error('Error converting payment:', error);
      alert.error(error.message || 'Failed to convert payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickApprove = async (paymentId: string) => {
    if (!user?.id) return;

    if (!confirm('Mark this virtual payment as received? This will update the sale status to "payment_received".')) {
      return;
    }

    try {
      const result = await markVirtualPaymentReceived(paymentId, user.id);
      if (result.success) {
        alert.success('Payment marked as received');
        await loadData();
      } else {
        alert.error(result.error || 'Failed to mark payment');
      }
    } catch (error: any) {
      alert.error(error.message || 'Failed to mark payment');
    }
  };

  const resetForm = () => {
    setSelectedPayment(null);
    setActualDate(new Date().toISOString().split('T')[0]);
    setBankName('');
    setAccountNumber('');
    setReferenceNumber('');
    setTransactionId('');
    setFxRate(null);
    setProofUrl('');
    setNotes('');
    setFxComparison(null);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'overdue': return 'text-red-600 bg-red-50 border-red-200';
      case 'due_today': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'due_soon': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      case 'due_today': return <Clock className="h-4 w-4" />;
      case 'due_soon': return <Calendar className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
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

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Virtual Payments Management
            </h1>
            <p className="text-gray-600 mt-1">
              Auto-credited payments awaiting confirmation
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/payments')}
          >
            View All Payments
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-2 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Virtual</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formatCurrency(stats.total_amount)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Overdue</p>
                    <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formatCurrency(stats.overdue_amount)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Due Today</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.due_today}</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-yellow-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Due Soon</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.due_soon}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payments List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Virtual Payments Awaiting Confirmation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {virtualPayments.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No virtual payments pending</p>
                <p className="text-sm text-gray-500 mt-1">
                  Virtual payments are created automatically when customers approve sales
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {virtualPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`border-2 rounded-lg p-4 ${getUrgencyColor(payment.payment_urgency)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getUrgencyIcon(payment.payment_urgency)}
                          <span className="font-bold text-lg">
                            {payment.sale_number}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase
                            ${payment.payment_urgency === 'overdue' ? 'bg-red-600 text-white' :
                              payment.payment_urgency === 'due_today' ? 'bg-orange-600 text-white' :
                              payment.payment_urgency === 'due_soon' ? 'bg-yellow-600 text-white' :
                              'bg-gray-600 text-white'}`}
                          >
                            {payment.payment_urgency.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Customer</p>
                            <p className="font-semibold">{payment.customer_name}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Amount</p>
                            <p className="font-bold text-lg">{formatCurrency(payment.amount)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Payment Terms</p>
                            <p className="font-semibold uppercase">
                              {payment.mechanism_type?.replace('_', ' ')}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Due Date</p>
                            <p className="font-semibold">
                              {new Date(payment.virtual_due_date).toLocaleDateString()}
                            </p>
                            {payment.days_overdue > 0 && (
                              <p className="text-xs text-red-600 font-semibold">
                                {payment.days_overdue} days overdue
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-gray-600">
                          <p>Reference: {payment.reference_number}</p>
                          <p>Auto-credited: {new Date(payment.auto_credited_at).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => handleOpenConvertModal(payment)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Record Details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickApprove(payment.id)}
                          className="border-green-600 text-green-600 hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Quick Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Convert to Actual Modal */}
        {showConvertModal && selectedPayment && (
          <Modal
            isOpen={showConvertModal}
            onClose={() => {
              setShowConvertModal(false);
              resetForm();
            }}
            title="Record Actual Payment Details"
          >
            <div className="space-y-6">
              {/* Payment Summary */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Sale</p>
                      <p className="font-bold">{selectedPayment.sale?.sale_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Customer</p>
                      <p className="font-semibold">{selectedPayment.customer?.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Expected Amount</p>
                      <p className="font-bold text-lg">{formatCurrency(selectedPayment.amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Due Date</p>
                      <p className="font-semibold">
                        {new Date(selectedPayment.virtual_due_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Form Fields */}
              <FormField label="Actual Payment Date" required>
                <Input
                  type="date"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Bank Name" required>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Enter bank name"
                  />
                </FormField>

                <FormField label="Account Number">
                  <Input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Optional"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Reference Number" required>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Payment reference"
                  />
                </FormField>

                <FormField label="Transaction ID">
                  <Input
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="Optional"
                  />
                </FormField>
              </div>

              {selectedPayment.currency !== 'USD' && (
                <FormField label="FX Rate" help={`1 USD = ? ${selectedPayment.currency}`}>
                  <Input
                    type="number"
                    step="0.0001"
                    value={fxRate || ''}
                    onChange={(e) => setFxRate(parseFloat(e.target.value) || null)}
                    placeholder="Enter FX rate"
                  />
                </FormField>
              )}

              <FormField label="Proof Document URL">
                <Input
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="URL to payment proof (optional)"
                />
              </FormField>

              <FormField label="Additional Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Any additional details about this payment..."
                />
              </FormField>

              {/* FX Comparison */}
              {fxComparison && fxComparison.length > 0 && (
                <Card className="bg-gray-50">
                  <CardHeader>
                    <CardTitle className="text-sm">FX Rate Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {fxComparison.map((comp: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-gray-700">{comp.source}</span>
                          <span className="font-semibold">{comp.rate.toFixed(4)}</span>
                          <span className={comp.variance_percent > 0 ? 'text-red-600' : 'text-green-600'}>
                            {comp.variance_percent > 0 ? '+' : ''}{comp.variance_percent.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConvertModal(false);
                    resetForm();
                  }}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConvertToActual}
                  disabled={submitting || !bankName.trim() || !referenceNumber.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {submitting ? 'Processing...' : 'Confirm Payment'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </MainLayout>
  );
}
