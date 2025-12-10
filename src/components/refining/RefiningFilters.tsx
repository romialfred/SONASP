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

export interface FilterValues {
  search: string;
  status: FreightShipmentStatus | 'all';
  refineryId: string;
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
  const [filters, setFilters] = useState<FilterValues>({
    search: '',
    status: 'all',
    refineryId: '',
    dateFrom: '',
    dateTo: '',
    minValue: '',
    maxValue: ''
  });

  useEffect(() => {
    fetchRefineries();
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

  const handleReset = () => {
    const resetFilters: FilterValues = {
      search: '',
      status: 'all',
      refineryId: '',
      dateFrom: '',
      dateTo: '',
      minValue: '',
      maxValue: ''
    };
    setFilters(resetFilters);
  };

  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.refineryId ||
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Date début */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Date de début
              </label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="h-9 text-sm"
              />
            </div>

            {/* Date fin */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Date de fin
              </label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="h-9 text-sm"
              />
            </div>

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
                {filters.dateFrom && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Depuis: {new Date(filters.dateFrom).toLocaleDateString()}
                    <button
                      onClick={() => setFilters({ ...filters, dateFrom: '' })}
                      className="hover:bg-green-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.dateTo && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Jusqu'à: {new Date(filters.dateTo).toLocaleDateString()}
                    <button
                      onClick={() => setFilters({ ...filters, dateTo: '' })}
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
