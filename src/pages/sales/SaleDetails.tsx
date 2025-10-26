import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/ui/Loading';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Mail,
  MapPin,
  Calendar,
  Award,
  TrendingUp,
  AlertCircle,
  FileText
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import TextArea from '@/components/ui/TextArea';
import { formatCurrency } from '@/utils/salesUtils';

export function SaleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchSaleDetails();
    }
  }, [id]);

  const fetchSaleDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(
            id,
            name,
            email,
            country,
            phone
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setSale({
          id: data.id,
          saleNumber: data.sale_number,
          status: data.status,
          createdDate: data.created_at,
          createdBy: 'System',
          customer: {
            name: data.customer?.name || 'Unknown Customer',
            email: data.customer?.email || '',
            country: data.customer?.country || '',
            phone: data.customer?.phone || '',
            ytdGoldSold: 0,
            ytdAvgPrice: 0,
            ytdAmount: 0,
            isBestCustomer: false
          },
          quantity: data.quantity_oz,
          londonAMRate: data.london_am_rate,
          freightCost: data.freight_cost || 0,
          otherCosts: data.other_costs || 0,
          calculations: {
            grossProceeds: data.gross_proceeds,
            freight: data.freight_cost || 0,
            otherCosts: data.other_costs || 0,
            netProceeds: data.net_proceeds,
            royalties: data.royalty_amount,
            finalAmount: data.final_proceeds
          }
        });
      }
    } catch (error) {
      console.error('Error fetching sale details:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    pending: {
      label: 'Pending Approval',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: Clock
    },
    approved: {
      label: 'Management Approved',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: CheckCircle
    },
    customer_approved: {
      label: 'Customer Approved',
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: CheckCircle
    },
    rejected: {
      label: 'Rejected',
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: XCircle
    }
  };

  const status = statusConfig[sale.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const handleApprove = () => {
    console.log('Approving sale with notes:', approvalNotes);
    setShowApprovalModal(false);
    navigate('/sales');
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    console.log('Rejecting sale with reason:', rejectionReason);
    setShowRejectionModal(false);
    navigate('/sales');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!sale) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Sale not found</p>
          <Button onClick={() => navigate('/sales')} className="mt-4">
            Back to Sales
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/sales')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sales
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                {sale.saleNumber}
              </h1>
              <div className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-sm font-semibold ${status.color}`}>
                <StatusIcon className="h-4 w-4" />
                {status.label}
              </div>
            </div>
            <p className="text-gray-600 mt-1">
              Created by {sale.createdBy} on {new Date(sale.createdDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        {sale.status === 'pending' && (
          <Alert type="warning" title="Action Required">
            This sale requires management approval before proceeding to customer notification.
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-gray-900">{sale.customer.name}</h3>
                        {sale.customer.isBestCustomer && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded-full">
                            <Award className="h-3 w-3 text-yellow-600" />
                            <span className="text-xs font-semibold text-yellow-700">Best Customer</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 mt-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="h-4 w-4" />
                          {sale.customer.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4" />
                          {sale.customer.country}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="h-4 w-4" />
                          {sale.customer.phone}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <h4 className="text-sm font-semibold text-gray-900">YTD Customer Performance</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">Gold Sold</p>
                        <p className="text-lg font-bold text-gray-900">{sale.customer.ytdGoldSold.toFixed(2)} oz</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">Avg Price</p>
                        <p className="text-lg font-bold text-gray-900">${sale.customer.ytdAvgPrice.toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(sale.customer.ytdAmount)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary-200">
              <CardHeader className="bg-gradient-to-r from-primary-50 to-blue-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary-600" />
                    Sale Calculations Report
                  </CardTitle>
                  <div className="text-right text-xs text-gray-600">
                    <p>Report Date</p>
                    <p className="font-semibold">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <div className="flex justify-between items-center py-3 px-4 hover:bg-gray-50 rounded transition-colors">
                    <span className="text-sm font-semibold text-gray-700">Quantity</span>
                    <span className="text-base font-bold text-gray-900">{sale.quantity.toFixed(3)} oz</span>
                  </div>

                  <div className="flex justify-between items-center py-3 px-4 hover:bg-gray-50 rounded transition-colors">
                    <span className="text-sm font-semibold text-gray-700">London AM Rate</span>
                    <span className="text-base font-bold text-gray-900">{formatCurrency(sale.londonAMRate)} / oz</span>
                  </div>

                  <div className="h-px bg-gray-200 my-2"></div>

                  <div className="flex justify-between items-center py-3 px-4 bg-green-50 rounded">
                    <div>
                      <span className="text-sm font-semibold text-green-900">Gross Proceeds</span>
                      <p className="text-xs text-green-700 mt-1">
                        {sale.quantity.toFixed(3)} oz × {formatCurrency(sale.londonAMRate)}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-green-700">
                      {formatCurrency(sale.calculations.grossProceeds)}
                    </span>
                  </div>

                  {sale.calculations.freight > 0 && (
                    <div className="flex justify-between items-center py-3 px-4 hover:bg-gray-50 rounded transition-colors">
                      <span className="text-sm font-semibold text-gray-700">Freight Cost</span>
                      <span className="text-base font-bold text-red-600">
                        -{formatCurrency(sale.calculations.freight)}
                      </span>
                    </div>
                  )}

                  {sale.calculations.otherCosts > 0 && (
                    <div className="flex justify-between items-center py-3 px-4 hover:bg-gray-50 rounded transition-colors">
                      <span className="text-sm font-semibold text-gray-700">Other Costs</span>
                      <span className="text-base font-bold text-red-600">
                        -{formatCurrency(sale.calculations.otherCosts)}
                      </span>
                    </div>
                  )}

                  <div className="h-px bg-gray-300 my-2"></div>

                  <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded">
                    <div>
                      <span className="text-sm font-semibold text-blue-900">Net Proceeds</span>
                      <p className="text-xs text-blue-700 mt-1">
                        Gross - Total Costs ({formatCurrency(sale.calculations.freight + sale.calculations.otherCosts)})
                      </p>
                    </div>
                    <span className="text-lg font-bold text-blue-700">
                      {formatCurrency(sale.calculations.netProceeds)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-3 px-4 hover:bg-gray-50 rounded transition-colors">
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Net Smelted Royalties (3%)</span>
                      <p className="text-xs text-gray-600 mt-1">
                        {formatCurrency(sale.calculations.netProceeds)} × 3%
                      </p>
                    </div>
                    <span className="text-base font-bold text-red-600">
                      -{formatCurrency(sale.calculations.royalties)}
                    </span>
                  </div>

                  <div className="h-1 bg-gradient-to-r from-primary-200 to-blue-200 my-3 rounded-full"></div>

                  <div className="flex justify-between items-center py-4 px-4 bg-gradient-to-r from-primary-100 to-blue-100 border-2 border-primary-300 rounded-lg">
                    <div>
                      <span className="text-lg font-bold text-gray-900">Final Proceeds</span>
                      <p className="text-xs text-gray-700 mt-1">
                        Net - Royalties
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-primary-700">
                      {formatCurrency(sale.calculations.finalAmount)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-2 border-gray-200 sticky top-6">
              <CardHeader className="bg-gray-50">
                <CardTitle className="text-base">Management Actions</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {sale.status === 'pending' ? (
                  <div className="space-y-3">
                    <Button
                      onClick={() => setShowApprovalModal(true)}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve Sale
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectionModal(true)}
                      className="w-full flex items-center justify-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject Sale
                    </Button>

                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Approval Process</h4>
                      <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold flex-shrink-0">1</div>
                          <div>
                            <p className="font-semibold text-gray-900">Management Review</p>
                            <p>Current stage - Pending your approval</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-semibold flex-shrink-0">2</div>
                          <div>
                            <p className="font-semibold text-gray-500">Customer Notification</p>
                            <p>Email sent to customer for confirmation</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-semibold flex-shrink-0">3</div>
                          <div>
                            <p className="font-semibold text-gray-500">Customer Approval</p>
                            <p>Customer approves via email link</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-semibold flex-shrink-0">4</div>
                          <div>
                            <p className="font-semibold text-gray-500">Payment Processing</p>
                            <p>Payment tracking and verification</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <StatusIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      This sale has been {status.label.toLowerCase()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  Important Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-gray-600">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                    <p>Approval sends automatic email notification to customer</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                    <p>Customer has 7 days to approve or reject the sale</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                    <p>Rejection requires detailed reason for audit trail</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                    <p>All actions are logged for compliance purposes</p>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {showApprovalModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <CheckCircle className="h-5 w-5" />
                  Approve Sale
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm text-gray-700">
                  You are about to approve sale <strong>{sale.saleNumber}</strong> for <strong>{sale.customer.name}</strong>.
                </p>
                <p className="text-sm text-gray-700">
                  Final amount: <strong className="text-primary-700 text-lg">{formatCurrency(sale.calculations.finalAmount)}</strong>
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approval Notes (Optional)
                  </label>
                  <TextArea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Add any notes about this approval..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowApprovalModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApprove}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Confirm Approval
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showRejectionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <CardHeader className="bg-red-50">
                <CardTitle className="flex items-center gap-2 text-red-900">
                  <XCircle className="h-5 w-5" />
                  Reject Sale
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <Alert type="error" title="Action Required">
                  You must provide a detailed reason for rejecting this sale.
                </Alert>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-600">*</span>
                  </label>
                  <TextArea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this sale is being rejected..."
                    rows={4}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectionModal(false);
                      setRejectionReason('');
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReject}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    Confirm Rejection
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
