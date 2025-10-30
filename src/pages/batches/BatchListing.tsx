import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { Download, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { BatchFilters } from '@/components/batch/BatchFilters';
import { BatchMetricsTiles } from '@/components/batch/BatchMetricsTiles';
import { BatchSections } from '@/components/batch/BatchSections';
import { supabase } from '@/lib/supabase';
import { convertGramsToOunces } from '@/utils/batchUtils';

interface MiningCompany {
  id: string;
  name: string;
  country?: string;
}

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  metal_type?: string;
  shipping_date?: string;
  created_at: string;
  mining_company_id?: string;
  mining_company?: MiningCompany;
  sale_id?: string;
}

export function BatchListing() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [miningCompanyFilter, setMiningCompanyFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [batchesResult, companiesResult] = await Promise.all([
        supabase
          .from('batches')
          .select(`
            *,
            mining_company:mining_companies(id, name, country),
            sales!left(id)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('mining_companies')
          .select('id, name, country')
          .eq('status', 'active')
          .order('name'),
      ]);

      if (batchesResult.data) {
        const enrichedBatches = batchesResult.data.map((batch: any) => ({
          ...batch,
          weight_ounces: batch.weight_ounces || convertGramsToOunces(batch.weight_grams),
          sale_id: batch.sales?.[0]?.id || null,
        }));
        setBatches(enrichedBatches);
      }

      if (companiesResult.data) {
        setMiningCompanies(companiesResult.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const matchesSearch = batch.batch_number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
      const matchesCompany =
        miningCompanyFilter === 'all' || batch.mining_company_id === miningCompanyFilter;

      let matchesDate = true;
      if (yearFilter !== 'all') {
        const batchDate = new Date(batch.shipping_date || batch.created_at);
        const batchYear = batchDate.getFullYear().toString();
        matchesDate = batchYear === yearFilter;

        if (matchesDate && monthFilter) {
          const batchMonth = String(batchDate.getMonth() + 1).padStart(2, '0');
          matchesDate = batchMonth === monthFilter;
        }
      }

      return matchesSearch && matchesStatus && matchesCompany && matchesDate;
    });
  }, [batches, searchQuery, statusFilter, miningCompanyFilter, yearFilter, monthFilter]);

  const statusMetrics = useMemo(() => {
    const metricsMap = new Map<string, { count: number; totalWeightGrams: number; totalWeightOunces: number }>();

    filteredBatches.forEach((batch) => {
      const existing = metricsMap.get(batch.status) || {
        count: 0,
        totalWeightGrams: 0,
        totalWeightOunces: 0,
      };

      metricsMap.set(batch.status, {
        count: existing.count + 1,
        totalWeightGrams: existing.totalWeightGrams + batch.weight_grams,
        totalWeightOunces: existing.totalWeightOunces + batch.weight_ounces,
      });
    });

    return Array.from(metricsMap.entries())
      .map(([status, data]) => ({
        status,
        ...data,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredBatches]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    batches.forEach((batch) => {
      const date = new Date(batch.shipping_date || batch.created_at);
      years.add(date.getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [batches]);

  const handleExport = () => {
    console.log('Export functionality to be implemented');
  };

  const handleBatchClick = (batchId: string) => {
    navigate(`/batches/${batchId}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Batches</h1>
            <p className="text-gray-600 mt-1">
              Suivez et gérez tous les batches de métaux précieux
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exporter
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/batches/new')}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700"
            >
              <Plus className="w-4 h-4" />
              Créer un Batch
            </Button>
          </div>
        </div>

        {/* Filters */}
        <BatchFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          miningCompanyFilter={miningCompanyFilter}
          onMiningCompanyChange={setMiningCompanyFilter}
          yearFilter={yearFilter}
          onYearChange={(year) => {
            setYearFilter(year);
            if (year === 'all') {
              setMonthFilter('');
            }
          }}
          monthFilter={monthFilter}
          onMonthChange={setMonthFilter}
          miningCompanies={miningCompanies}
          availableYears={availableYears}
        />

        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <Loading size="lg" />
            </div>
          </Card>
        ) : (
          <>
            {/* Metrics Tiles */}
            {statusMetrics.length > 0 && <BatchMetricsTiles metrics={statusMetrics} />}

            {/* Batch Sections */}
            {filteredBatches.length > 0 ? (
              <BatchSections batches={filteredBatches} onBatchClick={handleBatchClick} />
            ) : (
              <Card>
                <div className="text-center py-12">
                  <p className="text-gray-500 text-sm">
                    {batches.length === 0
                      ? 'Aucun batch créé. Cliquez sur "Créer un Batch" pour commencer.'
                      : 'Aucun batch ne correspond à vos critères de recherche.'}
                  </p>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
