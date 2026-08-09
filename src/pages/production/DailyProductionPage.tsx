import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Filter, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { CustomConfirm } from '@/components/ui/CustomConfirm';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { dailyProductionService, DailyProduction } from '@/services/dailyProductionService';
import { DailyProductionFormEnhanced } from '@/components/production/DailyProductionFormEnhanced';
import { ProductionMetrics } from '@/components/production/ProductionMetrics';
import { ProductionTable } from '@/components/production/ProductionTable';
import { ProductionChart } from '@/components/production/ProductionChart';
import { supabase } from '@/lib/supabase';
import { filterOperationalMiningCompanies } from '@/utils/miningCompanyFilters';

interface MiningCompany {
  id: string;
  name: string;
}

export function DailyProductionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [filteredProductions, setFilteredProductions] = useState<DailyProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedProduction, setSelectedProduction] = useState<DailyProduction | null>(null);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const { alertState, confirmState, showError, showConfirm, closeAlert, closeConfirm } = useCustomAlert();

  useEffect(() => {
    loadMiningCompanies();
  }, []);

  useEffect(() => {
    loadProductions();
  }, [dateRange]);

  useEffect(() => {
    filterProductions();
  }, [productions, selectedCompanyFilter]);

  const loadMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Exclure la société mère des sociétés opérationnelles
      setMiningCompanies(filterOperationalMiningCompanies(data || []));
    } catch (error) {
      console.error('Error loading mining companies:', error);
    }
  };

  const filterProductions = () => {
    if (selectedCompanyFilter === 'all') {
      setFilteredProductions(productions);
    } else {
      setFilteredProductions(
        productions.filter(p => p.mining_company_id === selectedCompanyFilter)
      );
    }
  };

  const loadProductions = async () => {
    try {
      setLoading(true);
      // Note: listProduction charge toutes les productions sans filtre site_id
      // pour permettre la vue multi-sites pour les managers
      const data = await dailyProductionService.listProduction(dateRange);
      setProductions(data);
    } catch (error) {
      console.error('Error loading productions:', error);
      showError(t('pages.production.errorLoadingData'));
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = async () => {
    setShowForm(false);
    setSelectedProduction(null);

    try {
      setLoading(true);

      const expandedRange = {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      console.log('🔄 Reloading with expanded 90-day range after create/update');
      const data = await dailyProductionService.listProduction(expandedRange);
      setProductions(data);

      setDateRange(expandedRange);

      console.log(`✅ Loaded ${data.length} production(s), date range updated`);
    } catch (error) {
      console.error('❌ Error reloading after form success:', error);
      showError(t('pages.production.errorReloading'));
    } finally {
      setLoading(false);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setSelectedProduction(null);
  };

  const handleEdit = (production: DailyProduction) => {
    setSelectedProduction(production);
    setShowForm(true);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      t('pages.production.confirmDelete'),
      async () => {
        try {
          await dailyProductionService.deleteProduction(id);
          loadProductions();
        } catch (error) {
          console.error('Error deleting production:', error);
          showError(t('pages.production.errorDeleting'));
        }
      },
      {
        title: t('pages.production.confirmDeleteTitle'),
        type: 'danger',
        confirmText: t('common.delete'),
        cancelText: t('common.cancel')
      }
    );
  };

  const exportToCSV = () => {
    if (productions.length === 0) {
      showError(t('pages.production.noDataToExport'));
      return;
    }

    const headers = [
      'Date',
      'Mining Company',
      'Bullion (g)',
      'Fineness (%)',
      'Pure Gold (g)',
      'Estimated Oz',
      'Bar Reference',
      'Notes'
    ];

    const rows = productions.map(p => [
      p.production_date,
      p.mining_company_id || 'N/A',
      p.bullion_grams.toFixed(2),
      p.estimated_fineness_pct.toFixed(2),
      p.pure_gold_grams.toFixed(2),
      p.estimated_oz.toFixed(4),
      p.bar_reference || '',
      (p.notes || '').replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `production_${dateRange.startDate}_to_${dateRange.endDate}.csv`;
    link.click();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between page-header">
          <div>
            <h1 className="page-title">{t('pages.production.dailyProduction')}</h1>
            <p className="page-subtitle">
              {t('pages.production.dailyProductionSubtitle')}
            </p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button
              onClick={() => navigate('/production/budget')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 btn-text-base"
            >
              <TrendingUp className="w-4 h-4" />
              {t('pages.production.budgetForecast')}
            </Button>
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              disabled={productions.length === 0}
              className="btn-text-base"
            >
              <Download className="w-4 h-4 mr-1.5" />
              {t('pages.production.exportCsv')}
            </Button>
            {!showForm && (
              <Button
                onClick={() => {
                  setSelectedProduction(null);
                  setShowForm(true);
                }}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 btn-text-base"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {t('pages.production.newProduction')}
              </Button>
            )}
          </div>
        </div>

        {/* Form Section - Inline */}
        {showForm && (
          <DailyProductionFormEnhanced
            production={selectedProduction}
            onCancel={handleFormCancel}
            onSuccess={handleFormSuccess}
          />
        )}

        {/* Company Filter Tabs */}
        {!showForm && miningCompanies.length > 0 && (
          <Card className="p-4">
            <Tabs
              tabs={[
                { id: 'all', label: t('pages.production.allCompanies'), count: productions.length },
                ...miningCompanies.map(company => ({
                  id: company.id,
                  label: company.name,
                  count: productions.filter(p => p.mining_company_id === company.id).length
                }))
              ]}
              activeTab={selectedCompanyFilter}
              onChange={setSelectedCompanyFilter}
            />
          </Card>
        )}

        {/* Titre "Inventaire de Production" - Style similaire à Production in Safe */}
        {!showForm && (
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t('pages.production.productionInventory')}</h2>
            <p className="text-sm text-gray-600">
              {filteredProductions.length} {t('pages.production.bars')} · {filteredProductions.reduce((sum, p) => sum + p.estimated_oz, 0).toFixed(2)} {t('pages.production.ozTotal')}
            </p>
          </div>
        )}

        {/* Production Table - MOVED UP BEFORE METRICS */}
        {!showForm && <Card>
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{t('pages.production.filterBy')}</span>
              </div>
              <div className="flex items-center gap-3">
                {selectedCompanyFilter === 'all' && (
                  <select
                    value={selectedCompanyFilter}
                    onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="all">{t('pages.production.allCompanies')}</option>
                    {miningCompanies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                )}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <span className="text-gray-500">{t('pages.production.to')}</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <ProductionTable
            productions={filteredProductions}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            showMiningCompany={selectedCompanyFilter === 'all'}
            miningCompanies={miningCompanies}
          />
        </Card>}

        {/* Metrics - NOW AFTER TABLE */}
        {!showForm && <ProductionMetrics productions={filteredProductions} dateRange={dateRange} />}

        {/* Production Chart - NOW BELOW METRICS */}
        {!showForm && <ProductionChart
          productions={filteredProductions}
          dateRange={dateRange}
          groupByCompany={selectedCompanyFilter === 'all'}
          miningCompanies={miningCompanies}
        />}
      </div>

      {/* Custom Alert */}
      <CustomAlert
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />

      {/* Custom Confirm */}
      <CustomConfirm
        isOpen={confirmState.isOpen}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
      />
    </MainLayout>
  );
}
