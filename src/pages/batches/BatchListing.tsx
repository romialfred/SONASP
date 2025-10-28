import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Download, Filter } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, Column } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { formatWeight } from '@/utils/batchUtils';
import { supabase } from '@/lib/supabase';
import { getBatchStatusLabel, getBatchStatusVariant, getBatchStatusOptions } from '@/constants/batchStatuses';

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  shipping_date: string;
  metal_type: string;
  mining_company_name?: string;
  created_at: string;
}

export function BatchListing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          id,
          batch_number,
          status,
          weight_grams,
          weight_ounces,
          shipping_date,
          metal_type,
          created_at,
          mining_company:mining_companies(name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading batches:', error);
        throw error;
      }

      const formattedBatches = (data || []).map((batch: any) => ({
        id: batch.id,
        batch_number: batch.batch_number,
        status: batch.status,
        weight_grams: parseFloat(batch.weight_grams || 0),
        weight_ounces: parseFloat(batch.weight_ounces || 0),
        shipping_date: batch.shipping_date,
        metal_type: batch.metal_type || 'gold',
        mining_company_name: batch.mining_company?.name || 'Unknown',
        created_at: batch.created_at,
      }));

      setBatches(formattedBatches);
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBatches = batches.filter((batch) => {
    const matchesSearch =
      batch.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (batch.mining_company_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    const matchesSite = siteFilter === 'all' || (batch.mining_company_name || '').includes(siteFilter);

    return matchesSearch && matchesStatus && matchesSite;
  });

  const columns: Column<Batch>[] = [
    {
      key: 'batch_number',
      label: 'Batch Number',
      sortable: true,
      render: (value, row) => (
        <button
          onClick={() => navigate(`/batches/${row.id}`)}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          {value}
        </button>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <StatusBadge
          label={getBatchStatusLabel(value)}
          variant={getBatchStatusVariant(value)}
        />
      ),
    },
    {
      key: 'weight_grams',
      label: 'Weight',
      sortable: true,
      render: (value) => formatWeight(value),
    },
    {
      key: 'shipping_date',
      label: 'Shipping Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'metal_type',
      label: 'Metal Type',
      sortable: true,
      render: (value) => (
        <span className="capitalize">
          {value}
        </span>
      ),
    },
    {
      key: 'mining_company_name',
      label: 'Mining Company',
      sortable: true,
    },
  ];

  const handleExport = () => {
    console.log('Exporting batches...');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              {t('Batch Management')}
            </h1>
            <p className="text-gray-600 mt-1">Track and manage all batches</p>
          </div>

          <Button
            variant="primary"
            onClick={() => navigate('/batches/new')}
            className="gap-2"
          >
            <Plus className="h-5 w-5" />
            Create New Batch
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search and Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by batch number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="created">Created</option>
                <option value="shipped">Shipped</option>
                <option value="received_airport">Received at Airport</option>
                <option value="processing">Processing</option>
                <option value="processed">Processed</option>
                <option value="approved">Approved</option>
              </Select>

              <Select
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
              >
                <option value="all">All Sites</option>
                <option value="Conakry">Conakry</option>
                <option value="Abidjan">Abidjan</option>
                <option value="Bamako">Bamako</option>
              </Select>

              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Batches ({filteredBatches.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="text-gray-600">Loading batches...</div>
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No batches found</p>
                <Button
                  variant="primary"
                  onClick={() => navigate('/batches/new')}
                  className="mt-4 gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Create First Batch
                </Button>
              </div>
            ) : (
              <Table
                data={filteredBatches}
                columns={columns}
                pagination
                pageSize={10}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
