import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { Alert } from '@/components/ui/Alert';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { licenseRequestService } from '@/services/licenseRequestService';
import { supabase } from '@/lib/supabase';
import {
  FileText,
  Plus,
  Search,
  Filter,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react';
import type { LicenseRequest, LicenseRequestStatus } from '@/types/license';

export function LicenseRequestsListingPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LicenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    mine_id: '',
  });
  const [miningCompanies, setMiningCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    submitted: 0,
    inReview: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    loadData();
    loadMiningCompanies();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    console.log('🔍 Loading license requests with filters:', filters);

    try {
      const statusFilter = filters.status ? [filters.status as LicenseRequestStatus] : undefined;

      const [requestsData, statsData] = await Promise.all([
        licenseRequestService.listRequests({
          status: statusFilter,
          search: filters.search || undefined,
          mine_id: filters.mine_id || undefined,
        }),
        licenseRequestService.getRequestStatistics(),
      ]);

      console.log('✅ Loaded license requests:', {
        count: requestsData.length,
        stats: statsData,
      });

      setRequests(requestsData);
      setStats(statsData);
    } catch (error: any) {
      console.error('❌ Error loading license requests:', error);
      setError(error?.message || 'Failed to load license requests');
    } finally {
      setLoading(false);
    }
  };

  const loadMiningCompanies = async () => {
    try {
      const { data } = await supabase
        .from('mining_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      setMiningCompanies(data || []);
    } catch (error) {
      console.error('Error loading mining companies:', error);
    }
  };

  const getStatusColor = (status: LicenseRequestStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'default';
      case 'SUBMITTED':
        return 'info';
      case 'IN_REVIEW':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const columns = [
    {
      header: 'Request Number',
      accessor: (request: LicenseRequest) => (
        <div className="font-mono text-sm text-blue-600">
          {request.request_number || 'PENDING'}
        </div>
      ),
    },
    {
      header: 'Title',
      accessor: (request: LicenseRequest) => (
        <div className="font-medium text-gray-900">{request.title}</div>
      ),
    },
    {
      header: 'Mining Company',
      accessor: (request: LicenseRequest) => (
        <div className="text-sm text-gray-600">{request.mine_name}</div>
      ),
    },
    {
      header: 'Request Date',
      accessor: (request: LicenseRequest) => (
        <div className="text-sm text-gray-600">{formatDate(request.request_date)}</div>
      ),
    },
    {
      header: 'Quantity (oz)',
      accessor: (request: LicenseRequest) => (
        <div className="text-right font-mono">{request.planned_quantity_oz.toFixed(3)}</div>
      ),
    },
    {
      header: 'Period',
      accessor: (request: LicenseRequest) => (
        <div className="text-sm text-gray-600">
          {request.planned_start_date && request.planned_end_date ? (
            <>
              {formatDate(request.planned_start_date)}
              <br />
              to {formatDate(request.planned_end_date)}
            </>
          ) : (
            'Not specified'
          )}
        </div>
      ),
    },
    {
      header: 'Priority',
      accessor: (request: LicenseRequest) => (
        <span
          className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
            request.priority === 'URGENT'
              ? 'bg-red-100 text-red-800'
              : request.priority === 'HIGH'
              ? 'bg-orange-100 text-orange-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {request.priority}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (request: LicenseRequest) => (
        <StatusBadge status={request.status} variant={getStatusColor(request.status)} />
      ),
    },
    {
      header: 'Actions',
      accessor: (request: LicenseRequest) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/licenses/requests/${request.id}`)}
        >
          <Eye className="w-4 h-4 mr-1" />
          View
        </Button>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">License Requests</h1>
            <p className="text-gray-600 mt-2">
              Manage and track export license applications
            </p>
          </div>
          <Button onClick={() => navigate('/licenses/requests/new')}>
            <Plus className="w-5 h-5 mr-2" />
            New Request
          </Button>
        </div>

        <div className="grid grid-cols-5 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <FileText className="w-10 h-10 text-blue-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Draft</p>
                <p className="text-2xl font-bold text-gray-600 mt-1">{stats.draft}</p>
              </div>
              <Clock className="w-10 h-10 text-gray-400" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Review</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {stats.submitted + stats.inReview}
                </p>
              </div>
              <Clock className="w-10 h-10 text-yellow-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejected}</p>
              </div>
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
          </Card>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search by request number, title, or company..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={filters.mine_id}
              onChange={(e) => setFilters({ ...filters, mine_id: e.target.value })}
              className="w-64"
            >
              <option value="">All Mines</option>
              {miningCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>

            <Select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-48"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </Select>
          </div>
        </Card>

        {error && (
          <Alert variant="error" className="mb-6">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </Alert>
        )}

        <Card>
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading license requests...</div>
          ) : error ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Requests</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => loadData()} variant="secondary">
                Retry
              </Button>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No requests found</h3>
              <p className="text-gray-600 mb-6">
                {filters.status || filters.search || filters.mine_id
                  ? 'No requests match your current filters. Try adjusting your search criteria.'
                  : 'Create your first export license request to get started'}
              </p>
              <Button onClick={() => navigate('/licenses/requests/new')}>
                <Plus className="w-5 h-5 mr-2" />
                New Request
              </Button>
            </div>
          ) : (
            <Table columns={columns} data={requests} />
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
