import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, Clock, CheckCircle, DollarSign, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import {
  getPreSales,
  getPreSalesStatistics,
  type PreSaleSummary,
} from '@/services/preSalesService';

export default function PreSalesDashboard() {
  const navigate = useNavigate();
  const [preSales, setPreSales] = useState<PreSaleSummary[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [activeFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters = activeFilter !== 'all' ? { is_converted: activeFilter === 'converted' } : {};
      const [preSalesResult, statsResult] = await Promise.all([
        getPreSales(filters),
        getPreSalesStatistics(),
      ]);

      if (preSalesResult.success) {
        setPreSales(preSalesResult.data || []);
      }
      if (statsResult.success) {
        setStatistics(statsResult.data);
      }
    } catch (error) {
      console.error('Error loading pre-sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_management_approval: 'yellow',
      management_approved: 'blue',
      management_rejected: 'red',
      pending_for_customer_approval: 'purple',
      customer_approved: 'green',
      customer_rejected: 'red',
      waiting_for_payment: 'orange',
      payment_received: 'teal',
      inventory_arrived: 'indigo',
      converted_to_sale: 'green',
      completed: 'gray',
      cancelled: 'gray',
    };
    return colors[status] || 'gray';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatStatus = (status: string) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pre-Sales Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sell validated batches before inventory arrival
          </p>
        </div>
        <Button
          onClick={() => navigate('/presales/new')}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Pre-Sale
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pre-Sales</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {statistics?.total || 0}
              </p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Awaiting Inventory</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {statistics?.awaiting_inventory || 0}
              </p>
            </div>
            <div className="rounded-full bg-orange-100 p-3">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Converted to Sales</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {statistics?.converted || 0}
              </p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Value</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {formatCurrency(statistics?.pending_value || 0)}
              </p>
            </div>
            <div className="rounded-full bg-teal-100 p-3">
              <DollarSign className="h-6 w-6 text-teal-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={activeFilter === 'all' ? 'primary' : 'secondary'}
          onClick={() => setActiveFilter('all')}
          size="sm"
        >
          All
        </Button>
        <Button
          variant={activeFilter === 'active' ? 'primary' : 'secondary'}
          onClick={() => setActiveFilter('active')}
          size="sm"
        >
          Active
        </Button>
        <Button
          variant={activeFilter === 'converted' ? 'primary' : 'secondary'}
          onClick={() => setActiveFilter('converted')}
          size="sm"
        >
          Converted
        </Button>
      </div>

      {/* Pre-Sales List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Pre-Sale #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Batch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Expected Arrival
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {preSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">No pre-sales found</p>
                    <Button
                      onClick={() => navigate('/presales/new')}
                      className="mt-4"
                      size="sm"
                    >
                      Create First Pre-Sale
                    </Button>
                  </td>
                </tr>
              ) : (
                preSales.map((preSale) => (
                  <tr
                    key={preSale.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/presales/${preSale.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {preSale.pre_sale_number}
                        </div>
                        {preSale.is_converted && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            Converted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{preSale.batch_number}</div>
                      <div className="text-xs text-gray-500">{preSale.batch_status}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{preSale.customer_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {preSale.quantity_oz.toFixed(2)} oz
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(preSale.final_proceeds)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge
                        status={preSale.status}
                        label={formatStatus(preSale.status)}
                        color={getStatusColor(preSale.status)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {preSale.expected_arrival_date
                        ? new Date(preSale.expected_arrival_date).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/presales/${preSale.id}`);
                        }}
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Info Panel */}
      <Card className="bg-blue-50 border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">How Pre-Sales Work</h3>
            <ul className="mt-2 space-y-1 text-sm text-blue-800">
              <li>• Pre-sell validated batches before they arrive at the factory</li>
              <li>• System tracks customer accounts (amounts we owe them)</li>
              <li>• Automatic conversion to regular sale when inventory arrives</li>
              <li>• Same approval workflow as regular sales</li>
              <li>• Variance detection with automatic reconciliation</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
