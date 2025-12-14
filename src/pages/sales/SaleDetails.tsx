import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/ui/Loading';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Mail,
  MapPin,
  Award,
  TrendingUp,
  AlertCircle,
  FileText,
  Package,
  Gem,
  Receipt,
  FlaskConical,
  Download,
  Phone,
  ShoppingCart,
  Coins
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import TextArea from '@/components/ui/TextArea';
import { formatCurrency } from '@/utils/salesUtils';
import {
  saleDetailSchema,
  normalizeSaleStatus,
  extractCustomerName,
  SaleStatus,
} from '@/lib/schemas/sales';
import { useAlert } from '@/hooks/useAlert';
import { approveSale, rejectSale } from '@/services/salesService';
import { useAuth } from '@/contexts/AuthContext';
import { SalesWorkflowProgressPanel } from '@/components/sales/SalesWorkflowProgressPanel';
import { getSaleDocuments, downloadSaleDocument, type SaleDocument } from '@/services/saleDocumentsService';

interface SaleDetailsCustomer {
  name: string;
  email: string;
  country: string;
  phone: string;
  ytdGoldSold: number;
  ytdAvgPrice: number;
  ytdAmount: number;
  ytdTransactions: number;
  ytdRoyalties: number;
  isBestCustomer: boolean;
}

interface SaleCalculations {
  grossProceeds: number;
  freight: number;
  otherCosts: number;
  netProceeds: number;
  royalties: number;
  finalAmount: number;
}

interface SaleDetailsView {
  id: string;
  saleNumber: string;
  status: SaleStatus;
  createdDate: string;
  createdBy: string;
  customer: SaleDetailsCustomer;
  quantity: number;
  londonAMRate: number;
  freightCost: number;
  otherCosts: number;
  calculations: SaleCalculations;
  mechanismType?: string | null;
}

const getPaymentTerms = (mechanismType: string | null | undefined) => {
  if (!mechanismType) {
    return {
      title: 'Standard Payment Terms',
      description: 'Payment within 2 business days upon customer approval',
      details: [
        'Customer approval via email link',
        'Payment expected within 2 business days',
        'Wire transfer to designated account',
        'Final settlement upon payment confirmation'
      ]
    };
  }

  switch (mechanismType.toLowerCase()) {
    case 'spot':
      return {
        title: 'Spot Basis Payment',
        description: 'Immediate payment upon customer approval',
        details: [
          'Customer approval = Payment commitment',
          'Payment due within 2 business days',
          'Spot price locked at approval time',
          'Wire transfer required',
          'Settlement upon payment receipt'
        ]
      };
    case 'forward_7':
    case 'forward_7_days':
      return {
        title: 'Forward 7 Days Payment',
        description: 'Payment due 7 days after customer approval',
        details: [
          'Customer approval locks the terms',
          'Payment due date: 7 business days',
          'Price fixed at contract date',
          'Wire transfer to designated account',
          'Grace period: 1 additional business day'
        ]
      };
    case 'forward_14':
    case 'forward_14_days':
      return {
        title: 'Forward 14 Days Payment',
        description: 'Payment due 14 days after customer approval',
        details: [
          'Customer approval locks the terms',
          'Payment due date: 14 business days',
          'Price fixed at contract date',
          'Wire transfer to designated account',
          'Grace period: 2 additional business days'
        ]
      };
    default:
      return {
        title: 'Custom Payment Terms',
        description: `Payment terms based on ${mechanismType} mechanism`,
        details: [
          'Customer approval required',
          'Payment terms as per agreement',
          'Wire transfer to designated account',
          'Settlement upon payment confirmation'
        ]
      };
  }
};

// SaleDocument interface is now imported from saleDocumentsService

export function SaleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const alert = useAlert();
  const { user } = useAuth();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [sale, setSale] = useState<SaleDetailsView | null>(null);
  const [documents, setDocuments] = useState<SaleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const mountedRef = useRef(false);

  const loadSaleDetails = useCallback(async () => {
    if (!id) {
      if (mountedRef.current) {
        setSale(null);
        setErrorMessage('Sale not found');
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const query = supabase
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

      const response = await query;

      if (response.error) {
        throw response.error;
      }

      if (!response.data) {
        if (!mountedRef.current) {
          return;
        }
        setSale(null);
        setErrorMessage('Sale not found');
        return;
      }

      const parsed = saleDetailSchema.safeParse(response.data);

      if (!parsed.success) {
        console.error('Sale detail validation failed', parsed.error.issues);
        if (!mountedRef.current) {
          return;
        }
        setSale(null);
        setErrorMessage('Received unexpected data for this sale.');
        return;
      }

      if (!mountedRef.current) {
        return;
      }

      const record = parsed.data;

      // Load YTD data for this customer
      let ytdGoldSold = 0;
      let ytdAvgPrice = 0;
      let ytdAmount = 0;
      let ytdTransactions = 0;
      let ytdRoyalties = 0;

      if (record.customer?.id) {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

        const { data: ytdSales } = await supabase
          .from('sales')
          .select('quantity_oz, unit_price, final_proceeds, royalty_amount')
          .eq('customer_id', record.customer.id)
          .gte('created_at', startOfYear);

        if (ytdSales && ytdSales.length > 0) {
          ytdTransactions = ytdSales.length;
          ytdGoldSold = ytdSales.reduce((sum, s) => sum + (s.quantity_oz || 0), 0);
          ytdAmount = ytdSales.reduce((sum, s) => sum + (s.final_proceeds || 0), 0);
          ytdRoyalties = ytdSales.reduce((sum, s) => sum + (s.royalty_amount || 0), 0);
          ytdAvgPrice = ytdGoldSold > 0 ? ytdAmount / ytdGoldSold : 0;
        }
      }

      setSale({
        id: record.id,
        saleNumber: record.sale_number,
        status: normalizeSaleStatus(record.status ?? undefined),
        createdDate: record.created_at,
        createdBy: 'System',
        customer: {
          name: extractCustomerName(record.customer),
          email: record.customer?.email ?? '',
          country: record.customer?.country ?? '',
          phone: record.customer?.phone ?? '',
          ytdGoldSold,
          ytdAvgPrice,
          ytdAmount,
          ytdTransactions,
          ytdRoyalties,
          isBestCustomer: false,
        },
        quantity: record.quantity_oz,
        londonAMRate: record.london_am_rate,
        freightCost: record.freight_cost,
        otherCosts: record.other_costs,
        calculations: {
          grossProceeds: record.gross_proceeds,
          freight: record.freight_cost,
          otherCosts: record.other_costs,
          netProceeds: record.net_proceeds,
          royalties: record.royalty_amount,
          finalAmount: record.final_proceeds,
        },
        mechanismType: record.mechanism_type ?? null,
      });

      // Load real documents from database/storage
      const documentsResult = await getSaleDocuments(record.id);

      if (documentsResult.success && documentsResult.data) {
        if (mountedRef.current) {
          setDocuments(documentsResult.data);
        }
      } else {
        console.warn('Failed to load documents:', documentsResult.error);
        // Set empty documents array if loading fails
        if (mountedRef.current) {
          setDocuments([]);
        }
      }
    } catch (error) {
      console.error('Error fetching sale details:', error);
      if (!mountedRef.current) {
        return;
      }
      setSale(null);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load sale details.'
      );
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    mountedRef.current = true;
    void loadSaleDetails();

    return () => {
      mountedRef.current = false;
    };
  }, [loadSaleDetails]);

  const handleRetry = () => {
    if (!mountedRef.current) {
      return;
    }
    void loadSaleDetails();
  };

  type StatusDisplay = {
    label: string;
    color: string;
    icon: LucideIcon;
  };

  const statusConfig: Partial<Record<SaleStatus, StatusDisplay>> & {
    pending: StatusDisplay;
  } = {
    pending: {
      label: 'Pending Approval',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: Clock
    },
    pending_management_approval: {
      label: 'Pending Management Approval',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: Clock
    },
    management_approved: {
      label: 'Management Approved',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: CheckCircle
    },
    pending_for_customer_approval: {
      label: 'Pending Customer Approval',
      color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
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
    waiting_for_payment: {
      label: 'Waiting for Payment',
      color: 'bg-orange-100 text-orange-800 border-orange-300',
      icon: Clock
    },
    payment_received: {
      label: 'Payment Received',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: DollarSign
    },
    completed: {
      label: 'Completed',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: CheckCircle
    },
    management_rejected: {
      label: 'Management Rejected',
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: XCircle
    },
    customer_rejected: {
      label: 'Customer Rejected',
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: XCircle
    },
    rejected: {
      label: 'Rejected',
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: XCircle
    }
  };

  const handleApprove = async () => {
    if (!id || !user?.email) {
      alert.error('Unable to approve sale: Missing required information');
      return;
    }

    setIsApproving(true);
    console.log('Approving sale with notes:', approvalNotes);

    try {
      const result = await approveSale(id, user.email, approvalNotes);

      if (result.success) {
        alert.success('Sale approved successfully! Customer will be notified by email.');
        setShowApprovalModal(false);

        // Reload sale details to show updated status
        await loadSaleDetails();

        // Navigate back to sales dashboard after a short delay
        setTimeout(() => {
          void navigate('/sales');
        }, 1500);
      } else {
        alert.error(`Failed to approve sale: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error approving sale:', error);
      alert.error(`Error approving sale: ${error.message || 'Unknown error'}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert.warning('Please provide a reason for rejection');
      return;
    }

    if (!id || !user?.email) {
      alert.error('Unable to reject sale: Missing required information');
      return;
    }

    setIsRejecting(true);
    console.log('Rejecting sale with reason:', rejectionReason);

    try {
      const result = await rejectSale(id, user.email, rejectionReason);

      if (result.success) {
        alert.success('Sale rejected successfully');
        setShowRejectionModal(false);

        // Reload sale details to show updated status
        await loadSaleDetails();

        // Navigate back to sales dashboard after a short delay
        setTimeout(() => {
          void navigate('/sales');
        }, 1500);
      } else {
        alert.error(`Failed to reject sale: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error rejecting sale:', error);
      alert.error(`Error rejecting sale: ${error.message || 'Unknown error'}`);
    } finally {
      setIsRejecting(false);
    }
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
        <div className="max-w-xl mx-auto py-12 space-y-6 text-center">
          <Alert variant="error" title="Unable to load sale">
            {errorMessage || 'Sale not found'}
          </Alert>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                handleRetry();
              }}
            >
              Retry
            </Button>
            <Button
              onClick={() => {
                void navigate('/sales');
              }}
            >
              Back to Sales
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const status = statusConfig[sale.status] ?? statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <MainLayout>
      <div className="space-y-6 w-full px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                void navigate('/sales');
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sales
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading text-2xl font-bold text-gray-900">
                  {sale.saleNumber}
                </h1>
                <div className={`flex items-center gap-1 px-3 py-1 border rounded-full text-sm font-semibold ${status.color}`}>
                  <StatusIcon className="h-4 w-4" />
                  {status.label}
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Created by {sale.createdBy} on {new Date(sale.createdDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })} at {new Date(sale.createdDate).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>

        {(sale.status === 'pending' || sale.status === 'pending_management_approval') && (
          <Alert type="warning" title="Action Required">
            This sale requires management approval before proceeding to customer notification.
          </Alert>
        )}

        {sale.status === 'pending_for_customer_approval' && (
          <Alert type="info" title="Awaiting Customer">
            This sale has been approved by management and is awaiting customer approval.
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
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {/* Compact Customer Info */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900">{sale.customer.name}</h3>
                          {sale.customer.isBestCustomer && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 border border-yellow-300 rounded-full">
                              <Award className="h-3 w-3 text-yellow-600" />
                              <span className="text-xs font-semibold text-yellow-700">Best</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {sale.customer.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {sale.customer.country}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {sale.customer.phone}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* YTD Performance - 5 tuiles */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <h4 className="text-sm font-semibold text-gray-900">YTD Performance (2025)</h4>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Gem className="h-3.5 w-3.5 text-amber-600" />
                          <p className="text-xs font-medium text-amber-900">Gold Sold</p>
                        </div>
                        <p className="text-lg font-bold text-amber-900">{sale.customer.ytdGoldSold.toFixed(2)} oz</p>
                      </div>

                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-3.5 w-3.5 text-green-600" />
                          <p className="text-xs font-medium text-green-900">Avg Price</p>
                        </div>
                        <p className="text-lg font-bold text-green-900">${sale.customer.ytdAvgPrice.toFixed(0)}</p>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                          <p className="text-xs font-medium text-blue-900">Total Amount</p>
                        </div>
                        <p className="text-lg font-bold text-blue-900">{formatCurrency(sale.customer.ytdAmount)}</p>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                        <div className="flex items-center gap-2 mb-1">
                          <ShoppingCart className="h-3.5 w-3.5 text-purple-600" />
                          <p className="text-xs font-medium text-purple-900">Transactions</p>
                        </div>
                        <p className="text-lg font-bold text-purple-900">{sale.customer.ytdTransactions}</p>
                      </div>

                      <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-lg p-3 border border-rose-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Coins className="h-3.5 w-3.5 text-rose-600" />
                          <p className="text-xs font-medium text-rose-900">Royalties Paid</p>
                        </div>
                        <p className="text-lg font-bold text-rose-900">{formatCurrency(Math.abs(sale.customer.ytdRoyalties))}</p>
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
                    Financial Overview
                  </CardTitle>
                  <div className="text-right text-xs text-gray-600">
                    <p>Report Date</p>
                    <p className="font-semibold">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-50 rounded transition-colors">
                    <span className="text-sm font-medium text-gray-700">Quantity</span>
                    <span className="text-sm font-bold text-gray-900">{sale.quantity.toFixed(3)} oz</span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-50 rounded transition-colors">
                    <span className="text-sm font-medium text-gray-700">London AM Rate</span>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(sale.londonAMRate)} / oz</span>
                  </div>

                  <div className="h-px bg-gray-200 my-1"></div>

                  <div className="flex justify-between items-center py-2 px-3 bg-green-50 rounded">
                    <div>
                      <span className="text-sm font-semibold text-green-900">Gross Proceeds</span>
                      <p className="text-xs text-green-700">
                        {sale.quantity.toFixed(3)} oz × {formatCurrency(sale.londonAMRate)}
                      </p>
                    </div>
                    <span className="text-base font-bold text-green-700">
                      {formatCurrency(sale.calculations.grossProceeds)}
                    </span>
                  </div>

                  {sale.calculations.freight > 0 && (
                    <div className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-50 rounded transition-colors">
                      <span className="text-sm font-medium text-gray-700">Freight Cost</span>
                      <span className="text-sm font-bold text-red-600">
                        -{formatCurrency(sale.calculations.freight)}
                      </span>
                    </div>
                  )}

                  {sale.calculations.otherCosts > 0 && (
                    <div className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-50 rounded transition-colors">
                      <span className="text-sm font-medium text-gray-700">Other Costs</span>
                      <span className="text-sm font-bold text-red-600">
                        -{formatCurrency(sale.calculations.otherCosts)}
                      </span>
                    </div>
                  )}

                  <div className="h-px bg-gray-300 my-1"></div>

                  <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded">
                    <div>
                      <span className="text-sm font-semibold text-blue-900">Net Proceeds</span>
                      <p className="text-xs text-blue-700">
                        Gross - Total Costs ({formatCurrency(sale.calculations.freight + sale.calculations.otherCosts)})
                      </p>
                    </div>
                    <span className="text-base font-bold text-blue-700">
                      {formatCurrency(sale.calculations.netProceeds)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 px-3 hover:bg-gray-50 rounded transition-colors">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Net Smelted Royalties (3%)</span>
                      <p className="text-xs text-gray-600">
                        {formatCurrency(sale.calculations.netProceeds)} × 3%
                      </p>
                    </div>
                    <span className="text-sm font-bold text-red-600">
                      -{formatCurrency(sale.calculations.royalties)}
                    </span>
                  </div>

                  <div className="h-0.5 bg-gradient-to-r from-primary-200 to-blue-200 my-2 rounded-full"></div>

                  <div className="flex justify-between items-center py-2.5 px-3 bg-gradient-to-r from-primary-100 to-blue-100 border-2 border-primary-300 rounded-lg">
                    <div>
                      <span className="text-base font-bold text-gray-900">Final Proceeds</span>
                      <p className="text-xs text-gray-700">Net - Royalties</p>
                    </div>
                    <span className="text-xl font-bold text-primary-700">
                      {formatCurrency(sale.calculations.finalAmount)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Terms */}
            {sale.mechanismType && (
              <Card className="border-2 border-emerald-200">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50">
                  <CardTitle className="flex items-center gap-2 text-emerald-900">
                    <DollarSign className="h-5 w-5" />
                    Payment Terms
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {(() => {
                    const terms = getPaymentTerms(sale.mechanismType);
                    return (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-bold text-gray-900 mb-1">{terms.title}</h4>
                          <p className="text-sm text-gray-600">{terms.description}</p>
                        </div>
                        <div className="space-y-2">
                          {terms.details.map((detail, index) => (
                            <div key={index} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700">{detail}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-900">
                            <strong>Note:</strong> Upon customer approval, payment is considered committed according to the {sale.mechanismType} mechanism terms.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right sidebar column - Sticky sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
            {/* Only show Management Actions if there are actionable items */}
            {(sale.status === 'pending' ||
              sale.status === 'pending_management_approval' ||
              sale.status === 'pending_for_customer_approval') && (
              <Card className="border-2 border-gray-200">
                <CardHeader className="bg-gray-50">
                  <CardTitle className="text-base">Management Actions</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {(sale.status === 'pending' || sale.status === 'pending_management_approval') ? (
                    <div className="space-y-3">
                      <Button
                        onClick={() => {
                          setShowApprovalModal(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve Sale
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowRejectionModal(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject Sale
                      </Button>
                    </div>
                  ) : sale.status === 'pending_for_customer_approval' ? (
                    <div className="space-y-4">
                      <div className="text-center py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <Clock className="h-10 w-10 mx-auto mb-2 text-indigo-600" />
                        <p className="text-sm font-semibold text-indigo-900 mb-1">
                          Awaiting Customer Approval
                        </p>
                        <p className="text-xs text-indigo-700">
                          Email sent to customer
                        </p>
                      </div>
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-600 mb-3 text-center">
                          Administrator override options:
                        </p>
                        <div className="space-y-2">
                          <Button
                            onClick={async () => {
                              if (!id || !user?.email) return;
                              setIsApproving(true);
                              try {
                                const { data, error } = await supabase
                                  .from('sales')
                                  .update({ status: 'customer_approved' })
                                  .eq('id', id)
                                  .select()
                                  .single();

                                if (!error) {
                                  alert.success('Sale approved as customer (admin override)');
                                  await loadSaleDetails();
                                } else {
                                  alert.error('Failed to override: ' + error.message);
                                }
                              } catch (err: any) {
                                alert.error('Error: ' + err.message);
                              } finally {
                                setIsApproving(false);
                              }
                            }}
                            disabled={isApproving}
                            size="sm"
                            className="w-full bg-green-600 hover:bg-green-700 text-xs"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approve as Customer
                          </Button>
                          <Button
                            onClick={async () => {
                              if (!id || !user?.email) return;
                              const reason = prompt('Rejection reason:');
                              if (!reason) return;

                              setIsRejecting(true);
                              try {
                                const { error } = await supabase
                                  .from('sales')
                                  .update({ status: 'customer_rejected' })
                                  .eq('id', id);

                                if (!error) {
                                  alert.success('Sale rejected (admin override)');
                                  await loadSaleDetails();
                                } else {
                                  alert.error('Failed to override: ' + error.message);
                                }
                              } catch (err: any) {
                                alert.error('Error: ' + err.message);
                              } finally {
                                setIsRejecting(false);
                              }
                            }}
                            disabled={isRejecting}
                            size="sm"
                            variant="outline"
                            className="w-full text-red-600 border-red-600 hover:bg-red-50 text-xs"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject as Customer
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Sales Workflow Progress Panel */}
            <SalesWorkflowProgressPanel currentStatus={sale.status} />
            </div>
          </div>
        </div>

        {/* Documents Section - Dynamic List */}
        <Card className="mt-6 border-2 border-primary-200">
          <CardHeader className="bg-gradient-to-r from-primary-50 to-blue-50 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary-600" />
                Documents
              </CardTitle>
              <div className="text-xs text-gray-600">
                <span className="font-semibold">{documents.filter(d => d.available).length}</span>
                {' / '}
                <span>{documents.length}</span> available
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No documents available yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {documents.map((doc, index) => {
                  // Map icon name string to actual icon component
                  const getIconComponent = (iconName: string): LucideIcon => {
                    const iconMap: Record<string, LucideIcon> = {
                      Package,
                      Gem,
                      Receipt,
                      FlaskConical,
                      FileText,
                    };
                    return iconMap[iconName] || FileText;
                  };

                  const Icon = getIconComponent(doc.icon);
                  const docKey = doc.documentId || `${doc.type}-${index}`;

                  return (
                    <div
                      key={docKey}
                      className={`group relative overflow-hidden rounded-lg border transition-all duration-200 ${
                        doc.available
                          ? `${doc.bgColor} cursor-pointer hover:shadow-md`
                          : 'bg-gray-50 border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="p-3">
                        <div className="flex flex-col items-center mb-2">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
                            doc.available ? `${doc.bgColor} border` : 'bg-gray-100'
                          }`}>
                            <Icon className={`w-5 h-5 ${doc.available ? doc.color : 'text-gray-400'}`} />
                          </div>
                          <h4 className={`text-xs font-semibold text-center ${
                            doc.available ? 'text-gray-900 group-hover:text-primary-600' : 'text-gray-500'
                          } transition-colors line-clamp-2`}>
                            {doc.label}
                          </h4>
                          <p className="text-xs text-gray-500 text-center mt-1 line-clamp-1">{doc.description}</p>
                        </div>

                        {doc.available ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full flex items-center justify-center gap-1 text-xs py-1 group-hover:bg-primary-50 group-hover:border-primary-400 transition-colors"
                            onClick={async () => {
                              // If document has direct URL, open it
                              if (doc.fileUrl) {
                                window.open(doc.fileUrl, '_blank');
                                return;
                              }

                              // Otherwise, try to download via service
                              try {
                                const result = await downloadSaleDocument(
                                  doc.type,
                                  doc.documentId,
                                  id
                                );

                                if (result.success && result.url) {
                                  window.open(result.url, '_blank');
                                } else {
                                  alert.info(`Generating ${doc.label}...`);
                                  // For generated documents (bullion summary, sales invoice),
                                  // this would trigger PDF generation
                                }
                              } catch (error: any) {
                                alert.error(`Failed to download: ${error.message}`);
                              }
                            }}
                          >
                            <Download className="w-3 h-3" />
                            {doc.fileName ? 'Download' : 'View'}
                          </Button>
                        ) : (
                          <div className="w-full text-center py-1 px-2 bg-gray-100 rounded text-xs text-gray-500 border border-gray-200">
                            Not available
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Important Notes - Inline at bottom */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Important Notes</h4>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-blue-700">
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-blue-600 rounded-full" />
                  Approval sends automatic email to customer
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-blue-600 rounded-full" />
                  Customer has 7 days to approve/reject
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-blue-600 rounded-full" />
                  Rejection requires detailed reason
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-blue-600 rounded-full" />
                  All actions logged for compliance
                </span>
              </div>
            </div>
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
                    onChange={(event) => {
                      setApprovalNotes(event.target.value);
                    }}
                    placeholder="Add any notes about this approval..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowApprovalModal(false);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {isApproving ? 'Approving...' : 'Confirm Approval'}
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
                    onChange={(event) => {
                      setRejectionReason(event.target.value);
                    }}
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
                    disabled={isRejecting || !rejectionReason.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
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
