import { useState, useEffect } from 'react';
import { Filter, X, Calendar, Building2, Package, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { supabase } from '@/lib/supabase';
import { FreightShipmentStatus } from '@/services/freightShipmentService';

interface RefiningFiltersProps {
  onFilterChange: (filters: FilterValues) => void;
  activeFiltersCount: number;
}

export type DatePreset = 'all' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

export interface FilterValues {
  search: string;
  status: FreightShipmentStatus | 'all';
  refineryId: string;
  miningCompanyId: string;
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  minValue: string;
  maxValue: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'received_at_refinery', label: 'Reçu à la Raffinerie' },
  { value: 'processing', label: 'En Cours de Raffinage' },
  { value: 'processed', label: 'Raffiné' },
  { value: 'in_stock', label: 'En Stock' }
];

export function RefiningFilters({ onFilterChange, activeFiltersCount }: RefiningFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [refineries, setRefineries] = useState<Array<{ id: string; name: string }>>([]);
  const [miningCompanies, setMiningCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [filters, setFilters] = useState<FilterValues>({
    search: '',
    status: 'all',
    refineryId: '',
    miningCompanyId: '',
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
    minValue: '',
    maxValue: ''
  });

  useEffect(() => {
    fetchRefineries();
    fetchMiningCompanies();
  }, []);

  useEffect(() => {
    onFilterChange(filters);
  }, [filters]);

  async function fetchRefineries() {
    const { data } = await supabase
      .from('refineries')
      .select('id, name')
      .order('name');

    if (data) {
      setRefineries(data);
    }
  }

  async function fetchMiningCompanies() {
    const { data } = await supabase
      .from('mining_companies')
      .select('id, name')
      .order('name');

    if (data) {
      setMiningCompanies(data);
    }
  }

  const getDateRange = (preset: DatePreset): { from: string; to: string } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'this_week': {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
          from: monday.toISOString().split('T')[0],
          to: sunday.toISOString().split('T')[0]
        };
      }
      case 'last_week': {
        const dayOfWeek = today.getDay();
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        return {
          from: lastMonday.toISOString().split('T')[0],
          to: lastSunday.toISOString().split('T')[0]
        };
      }
      case 'this_month': {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
          from: firstDay.toISOString().split('T')[0],
          to: lastDay.toISOString().split('T')[0]
        };
      }
      case 'last_month': {
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          from: firstDay.toISOString().split('T')[0],
          to: lastDay.toISOString().split('T')[0]
        };
      }
      default:
        return { from: '', to: '' };
    }
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    if (preset === 'custom') {
      setFilters({ ...filters, datePreset: preset });
    } else {
      const range = getDateRange(preset);
      setFilters({
        ...filters,
        datePreset: preset,
        dateFrom: range.from,
        dateTo: range.to
      });
    }
  };

  const handleReset = () => {
    const resetFilters: FilterValues = {
      search: '',
      status: 'all',
      refineryId: '',
      miningCompanyId: '',
      datePreset: 'all',
      dateFrom: '',
      dateTo: '',
      minValue: '',
      maxValue: ''
    };
    setFilters(resetFilters);
  };

  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.refineryId ||
                          filters.miningCompanyId || filters.datePreset !== 'all' ||
                          filters.dateFrom || filters.dateTo || filters.minValue || filters.maxValue;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header - Toujours visible */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher par référence, compagnie..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10 pr-4 h-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              Filtres Avancés
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-2 text-gray-600 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
                Réinitialiser
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filtres avancés - Collapsible */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Statut */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                Statut
              </label>
              <Select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as FreightShipmentStatus | 'all' })}
                className="h-9 text-sm"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>

            {/* Compagnie Minière */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Compagnie Minière
              </label>
              <Select
                value={filters.miningCompanyId}
                onChange={(e) => setFilters({ ...filters, miningCompanyId: e.target.value })}
                className="h-9 text-sm"
              >
                <option value="">Toutes les compagnies</option>
                {miningCompanies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
            </div>

            {/* Raffinerie */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Raffinerie
              </label>
              <Select
                value={filters.refineryId}
                onChange={(e) => setFilters({ ...filters, refineryId: e.target.value })}
                className="h-9 text-sm"
              >
                <option value="">Toutes les raffineries</option>
                {refineries.map(ref => (
                  <option key={ref.id} value={ref.id}>{ref.name}</option>
                ))}
              </Select>
            </div>

            {/* Période prédéfinie */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Période
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleDatePresetChange('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filters.datePreset === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Toutes
                </button>
                <button
                  onClick={() => handleDatePresetChange('this_week')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filters.datePreset === 'this_week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cette semaine
                </button>
                <button
                  onClick={() => handleDatePresetChange('last_week')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filters.datePreset === 'last_week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Semaine passée
                </button>
                <button
                  onClick={() => handleDatePresetChange('this_month')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filters.datePreset === 'this_month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Ce mois
                </button>
                <button
                  onClick={() => handleDatePresetChange('last_month')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filters.datePreset === 'last_month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Mois passé
                </button>
                <button
                  onClick={() => handleDatePresetChange('custom')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filters.datePreset === 'custom'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Personnalisée
                </button>
              </div>
            </div>

            {/* Dates personnalisées - visible seulement si custom */}
            {filters.datePreset === 'custom' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Date de début
                  </label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Date de fin
                  </label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              </>
            )}

            {/* Valeur minimum */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Valeur min. (USD)
              </label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minValue}
                onChange={(e) => setFilters({ ...filters, minValue: e.target.value })}
                className="h-9 text-sm"
              />
            </div>

            {/* Valeur maximum */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Valeur max. (USD)
              </label>
              <Input
                type="number"
                placeholder="999999"
                value={filters.maxValue}
                onChange={(e) => setFilters({ ...filters, maxValue: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Résumé des filtres actifs */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {filters.status !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Statut: {STATUS_OPTIONS.find(s => s.value === filters.status)?.label}
                    <button
                      onClick={() => setFilters({ ...filters, status: 'all' })}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.miningCompanyId && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                    Compagnie: {miningCompanies.find(c => c.id === filters.miningCompanyId)?.name}
                    <button
                      onClick={() => setFilters({ ...filters, miningCompanyId: '' })}
                      className="hover:bg-amber-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.refineryId && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    Raffinerie: {refineries.find(r => r.id === filters.refineryId)?.name}
                    <button
                      onClick={() => setFilters({ ...filters, refineryId: '' })}
                      className="hover:bg-purple-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.datePreset !== 'all' && filters.datePreset !== 'custom' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Période: {
                      filters.datePreset === 'this_week' ? 'Cette semaine' :
                      filters.datePreset === 'last_week' ? 'Semaine passée' :
                      filters.datePreset === 'this_month' ? 'Ce mois' :
                      'Mois passé'
                    }
                    <button
                      onClick={() => handleDatePresetChange('all')}
                      className="hover:bg-green-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.datePreset === 'custom' && filters.dateFrom && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Depuis: {new Date(filters.dateFrom).toLocaleDateString()}
                    <button
                      onClick={() => setFilters({ ...filters, dateFrom: '', datePreset: 'all' })}
                      className="hover:bg-green-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.datePreset === 'custom' && filters.dateTo && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Jusqu'à: {new Date(filters.dateTo).toLocaleDateString()}
                    <button
                      onClick={() => setFilters({ ...filters, dateTo: '', datePreset: 'all' })}
                      className="hover:bg-green-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
