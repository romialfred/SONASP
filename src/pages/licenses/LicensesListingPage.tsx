import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { licenseService } from '@/services/licenseService';
import { supabase } from '@/lib/supabase';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { License, LicenseStatus, LicenseSummary } from '@/types/license';

export function LicensesListingPage() {
  const navigate = useNavigate();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [summary, setSummary] = useState<LicenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    mine_id: '',
  });
  const [miningCompanies, setMiningCompanies] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadData();
    loadMiningCompanies();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const statusFilter = filters.status ? [filters.status as LicenseStatus] : undefined;

      const [licensesData, summaryData] = await Promise.all([
        licenseService.listLicenses({
          status: statusFilter,
          search: filters.search || undefined,
          mine_id: filters.mine_id || undefined,
        }),
        licenseService.getLicenseSummary({
          status: statusFilter,
          mine_id: filters.mine_id || undefined,
        }),
      ]);

      setLicenses(licensesData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMiningCompanies = async () => {
    try {
      const { data } = await supabase
        .from('mining_companies')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      setMiningCompanies(data || []);
    } catch (error) {
      console.error('Error loading mining companies:', error);
    }
  };

  const getTrafficLight = (license: License): string => {
    if (license.status === 'EXPIRED') return 'bg-red-500';
    if (license.status === 'CLOSED') return 'bg-gray-400';
    if (license.days_to_expiry <= 7 || license.remaining_percentage <= 10) return 'bg-red-500';
    if (license.days_to_expiry <= 15 || license.remaining_percentage <= 25) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusColor = (status: LicenseStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'REGISTERED':
        return 'info';
      case 'EXPIRED':
        return 'error';
      case 'CLOSED':
        return 'default';
      case 'SUSPENDED':
        return 'warning';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      header: 'Evaluation',
      accessor: (license: License) => (
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full ${getTrafficLight(license)}`} />
        </div>
      ),
    },
    {
      header: 'Mine',
      accessor: (license: License) => (
        <div className="font-medium text-gray-900">{license.applicant_company_name}</div>
      ),
    },
    {
      header: 'License Number',
      accessor: (license: License) => (
        <div className="font-mono text-sm text-blue-600">{license.license_number}</div>
      ),
    },
    {
      header: 'Issue Date',
      accessor: (license: License) => (
        <div className="text-sm text-gray-600">{license.issue_date}</div>
      ),
    },
    {
      header: 'Expiry Date',
      accessor: (license: License) => (
        <div className="text-sm text-gray-600">{license.expiry_date}</div>
      ),
    },
    {
      header: 'Authorized (oz)',
      accessor: (license: License) => (
        <div className="text-right font-mono">{license.authorized_qty_oz.toFixed(3)}</div>
      ),
    },
    {
      header: 'Consumed (oz)',
      accessor: (license: License) => (
        <div className="text-right font-mono">{license.consumed_qty_oz.toFixed(3)}</div>
      ),
    },
    {
      header: 'Remaining (oz)',
      accessor: (license: License) => (
        <div className="text-right font-mono font-semibold">
          {license.remaining_qty_oz.toFixed(3)}
        </div>
      ),
    },
    {
      header: '% Remaining',
      accessor: (license: License) => (
        <div className="text-right">
          <span
            className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
              license.remaining_percentage <= 10
                ? 'bg-red-100 text-red-800'
                : license.remaining_percentage <= 25
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {license.remaining_percentage.toFixed(1)}%
          </span>
        </div>
      ),
    },
    {
      header: 'Days to Expiry',
      accessor: (license: License) => (
        <div className="text-right">
          {license.days_to_expiry < 0 ? (
            <span className="text-red-600 font-semibold">Expired</span>
          ) : (
            <span
              className={
                license.days_to_expiry <= 7
                  ? 'text-red-600 font-semibold'
                  : license.days_to_expiry <= 15
                  ? 'text-yellow-600 font-semibold'
                  : 'text-gray-600'
              }
            >
              {license.days_to_expiry}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (license: License) => (
        <StatusBadge status={license.status} variant={getStatusColor(license.status)} />
      ),
    },
    {
      header: 'Actions',
      accessor: (license: License) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/licenses/${license.id}`)}
        >
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
            <h1 className="text-3xl font-bold text-gray-900">Export Licenses</h1>
            <p className="text-gray-600 mt-2">
              Track and manage gold export licenses and quota utilization
            </p>
          </div>
          <Button onClick={() => navigate('/licenses/register')}>
            <Plus className="w-5 h-5 mr-2" />
            Register License
          </Button>
        </div>

        {summary && (
          <div className="grid grid-cols-4 gap-6 mb-8">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Authorized</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {summary.totalAuthorizedOz.toLocaleString(undefined, {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })} oz
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Consumed</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {summary.totalConsumedOz.toLocaleString(undefined, {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })} oz
                  </p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Expiring Soon</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">
                    {summary.licensesExpiringSoon}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Within 15 days</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-yellow-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Low Quota</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {summary.licensesLowQuota}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Below 25%</p>
                </div>
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
            </Card>
          </div>
        )}

        <Card className="p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search by license number, company name..."
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
              <option value="ACTIVE">Active</option>
              <option value="REGISTERED">Registered</option>
              <option value="EXPIRED">Expired</option>
              <option value="CLOSED">Closed</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>

            <Button variant="secondary">
              <Filter className="w-5 h-5 mr-2" />
              More Filters
            </Button>
          </div>
        </Card>

        <Card>
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading licenses...</div>
          ) : licenses.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No licenses found</h3>
              <p className="text-gray-600 mb-6">
                Register your first export license to start tracking quota utilization
              </p>
              <Button onClick={() => navigate('/licenses/register')}>
                <Plus className="w-5 h-5 mr-2" />
                Register License
              </Button>
            </div>
          ) : (
            <Table columns={columns} data={licenses} />
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
