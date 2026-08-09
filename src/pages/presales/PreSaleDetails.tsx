import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  TrendingUp,
  AlertTriangle,
  User,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { useAlert } from '@/hooks/useAlert';
import {
  getPreSaleById,
  approvePreSale,
  rejectPreSale,
  getPreSaleInventoryMatch,
  type PreSaleSummary,
} from '@/services/preSalesService';
import { formatStatusFr } from '@/utils/statusFormatter';

export default function PreSaleDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const alert = useAlert();

  const [preSale, setPreSale] = useState<PreSaleSummary | null>(null);
  const [inventoryMatch, setInventoryMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadPreSaleDetails();
    }
  }, [id]);

  const loadPreSaleDetails = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [preSaleResult, matchResult] = await Promise.all([
        getPreSaleById(id),
        getPreSaleInventoryMatch(id),
      ]);

      if (preSaleResult.success && preSaleResult.data) {
        setPreSale(preSaleResult.data);
      } else {
        alert.showAlert(preSaleResult.error || 'Pre-sale not found', 'error');
        navigate('/presales');
        return;
      }

      if (matchResult.success && matchResult.data) {
        setInventoryMatch(matchResult.data);
      }
    } catch (error: any) {
      console.error('Error loading pre-sale details:', error);
      alert.showAlert('Error loading pre-sale details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const result = await approvePreSale(id);
      if (result.success) {
        alert.showAlert('Pre-sale approved successfully', 'success');
        loadPreSaleDetails();
      } else {
        alert.showAlert(result.error || 'Failed to approve pre-sale', 'error');
      }
    } catch (error: any) {
      alert.showAlert('Error approving pre-sale: ' + error.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to reject this pre-sale?')) return;

    setActionLoading(true);
    try {
      const result = await rejectPreSale(id, 'Rejected by management');
      if (result.success) {
        alert.showAlert('Pre-sale rejected', 'success');
        loadPreSaleDetails();
      } else {
        alert.showAlert(result.error || 'Failed to reject pre-sale', 'error');
      }
    } catch (error: any) {
      alert.showAlert('Error rejecting pre-sale: ' + error.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatStatus = (status: string) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  if (!preSale) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Pre-sale not found</p>
          <Button onClick={() => navigate('/presales')} className="mt-4">
            Back to Pre-Sales
          </Button>
        </div>
      </MainLayout>
    );
  }

  const canApprove =
    preSale.status === 'pending_management_approval' ||
    preSale.status === 'management_approved';

  const showVarianceWarning =
    inventoryMatch &&
    inventoryMatch.match_status === 'variance_detected' &&
    Math.abs(inventoryMatch.variance_percentage) > 2;

  return (
    <MainLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={() => navigate('/presales')} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{preSale.pre_sale_number}</h1>
            <p className="mt-1 text-sm text-gray-500">Pre-Sale Details</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge
            status={preSale.status}
            label={formatStatus(preSale.status)}
          />
          {canApprove && (
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                disabled={actionLoading}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={handleReject}
                disabled={actionLoading}
                size="sm"
                variant="secondary"
                className="text-red-600 hover:text-red-700"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Conversion Alert */}
      {preSale.is_converted && preSale.converted_sale_number && (
        <Alert variant="success" icon={CheckCircle}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Pre-Sale Converted to Sale</p>
              <p className="text-sm mt-1">
                This pre-sale has been automatically converted to sale: {preSale.converted_sale_number}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => navigate(`/sales/${preSale.converted_sale_id}`)}
            >
              View Sale
            </Button>
          </div>
        </Alert>
      )}

      {/* Variance Warning */}
      {showVarianceWarning && (
        <Alert variant="warning" icon={AlertTriangle}>
          <p className="font-medium">Inventory Variance Detected</p>
          <p className="text-sm mt-1">
            The arrived inventory has a variance of {inventoryMatch.variance_oz.toFixed(2)} oz (
            {inventoryMatch.variance_percentage.toFixed(2)}%) from the pre-sale quantity. Manual
            reconciliation may be required.
          </p>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Batch Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Batch Information
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-gray-600">Batch Number</p>
                <p className="font-medium text-gray-900">{preSale.batch_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Batch Status</p>
                <p className="font-medium text-gray-900">{formatStatusFr(preSale.batch_status)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Quantity</p>
                <p className="font-medium text-gray-900">{preSale.quantity_oz.toFixed(4)} oz</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Expected Arrival</p>
                <p className="font-medium text-gray-900">
                  {formatDate(preSale.expected_arrival_date)}
                </p>
              </div>
              {preSale.actual_arrival_date && (
                <div>
                  <p className="text-sm text-gray-600">Actual Arrival</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(preSale.actual_arrival_date)}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Customer Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-gray-600">Customer Name</p>
                <p className="font-medium text-gray-900">{preSale.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Sale Date</p>
                <p className="font-medium text-gray-900">{formatDate(preSale.sale_date)}</p>
              </div>
            </div>
          </Card>

          {/* Inventory Match Details */}
          {inventoryMatch && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Inventory Match Status
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-600">Match Status</p>
                  <p className="font-medium text-gray-900 capitalize">
                    {inventoryMatch.match_status.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Matched At</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(inventoryMatch.matched_at)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pre-Sale Quantity</p>
                  <p className="font-medium text-gray-900">
                    {inventoryMatch.pre_sale_quantity_oz.toFixed(4)} oz
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Actual Quantity</p>
                  <p className="font-medium text-gray-900">
                    {inventoryMatch.actual_quantity_oz.toFixed(4)} oz
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Variance</p>
                  <p
                    className={`font-medium ${
                      Math.abs(inventoryMatch.variance_oz) > 0.1
                        ? 'text-orange-600'
                        : 'text-green-600'
                    }`}
                  >
                    {inventoryMatch.variance_oz > 0 ? '+' : ''}
                    {inventoryMatch.variance_oz.toFixed(4)} oz (
                    {inventoryMatch.variance_percentage.toFixed(2)}%)
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Financial Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">London AM Rate:</span>
                  <span className="font-medium">
                    {formatCurrency(preSale.london_am_rate)}/oz
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-gray-700">Gross Proceeds:</span>
                  <span className="font-semibold">
                    {formatCurrency(preSale.gross_proceeds)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-red-600">
                  <span>Freight Cost:</span>
                  <span>-{formatCurrency(preSale.freight_cost)}</span>
                </div>
                <div className="flex justify-between text-sm text-red-600">
                  <span>Other Costs:</span>
                  <span>-{formatCurrency(preSale.other_costs)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-gray-700">Net Proceeds:</span>
                  <span className="font-semibold">
                    {formatCurrency(preSale.net_proceeds)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-red-600">
                  <span>Royalty ({(preSale.royalty_rate * 100).toFixed(1)}%):</span>
                  <span>-{formatCurrency(preSale.royalty_amount)}</span>
                </div>
                <div className="border-t-2 border-gray-300 pt-3 flex justify-between">
                  <span className="font-bold text-gray-900">Final Proceeds:</span>
                  <span className="font-bold text-lg text-green-600">
                    {formatCurrency(preSale.final_proceeds)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Timeline */}
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timeline
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-green-100 p-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(preSale.created_at)}
                    </p>
                  </div>
                </div>
                {preSale.is_converted && (
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-blue-100 p-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Converted to Sale</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(preSale.updated_at)}
                      </p>
                    </div>
                  </div>
                )}
                {!preSale.is_converted && preSale.expected_arrival_date && (
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-orange-100 p-2">
                      <Clock className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Expected Arrival</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(preSale.expected_arrival_date)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </MainLayout>
  );
}
