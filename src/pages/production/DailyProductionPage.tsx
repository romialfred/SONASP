import { useState, useEffect } from 'react';
import { Plus, Download, Filter } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { dailyProductionService, DailyProduction } from '@/services/dailyProductionService';
import { DailyProductionFormEnhanced } from '@/components/production/DailyProductionFormEnhanced';
import { ProductionMetrics } from '@/components/production/ProductionMetrics';
import { ProductionTable } from '@/components/production/ProductionTable';
import { ProductionChart } from '@/components/production/ProductionChart';

export function DailyProductionPage() {
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedProduction, setSelectedProduction] = useState<DailyProduction | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadProductions();
  }, [dateRange]);

  const loadProductions = async () => {
    try {
      setLoading(true);
      const data = await dailyProductionService.listProduction(dateRange);
      setProductions(data);
    } catch (error) {
      console.error('Error loading productions:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedProduction(null);
    loadProductions();
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
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette production?')) {
      return;
    }

    try {
      await dailyProductionService.deleteProduction(id);
      loadProductions();
    } catch (error) {
      console.error('Error deleting production:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const exportToCSV = () => {
    if (productions.length === 0) {
      alert('Aucune donnée à exporter');
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Daily Production</h1>
            <p className="text-gray-600 mt-1">
              Production journalière et analyses de laboratoire préliminaires
            </p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <Button
              onClick={exportToCSV}
              variant="outline"
              disabled={productions.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            {!showForm && (
              <Button
                onClick={() => {
                  setSelectedProduction(null);
                  setShowForm(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Production
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

        {/* Metrics */}
        {!showForm && <ProductionMetrics productions={productions} dateRange={dateRange} />}

        {/* Production Chart - Last 30 Days */}
        {!showForm && <ProductionChart productions={productions} dateRange={dateRange} />}

        {/* Production Table - Only show when form is not visible */}
        {!showForm && <Card>
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Historique de Production
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <span className="text-gray-500">à</span>
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
            productions={productions}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </Card>}
      </div>
    </MainLayout>
  );
}
