import { useState, useEffect } from 'react';
import { Check, Columns, Download, Eye, EyeOff, ChevronRight, ChevronLeft, FileSpreadsheet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ColumnConfig {
  id: string;
  label: string;
  category: string;
  defaultVisible: boolean;
  description?: string;
}

export const AVAILABLE_COLUMNS: ColumnConfig[] = [
  // Informations de base
  { id: 'reference_number', label: 'Référence', category: 'Basique', defaultVisible: true },
  { id: 'status', label: 'Statut', category: 'Basique', defaultVisible: true },
  { id: 'shipment_date', label: 'Date d\'Expédition', category: 'Basique', defaultVisible: true },

  // Compagnie et Raffinerie
  { id: 'mining_company', label: 'Compagnie Minière', category: 'Parties Prenantes', defaultVisible: true },
  { id: 'destination_refinery', label: 'Raffinerie Destination', category: 'Parties Prenantes', defaultVisible: true },

  // Quantités Or
  { id: 'total_pure_gold_grams', label: 'Or Pur (g)', category: 'Quantités', defaultVisible: true },
  { id: 'total_pure_gold_oz', label: 'Or Pur (oz)', category: 'Quantités', defaultVisible: false },
  { id: 'total_bullion_grams', label: 'Lingots Total (g)', category: 'Quantités', defaultVisible: false },

  // Argent
  { id: 'total_pure_silver_grams', label: 'Argent Pur (g)', category: 'Quantités', defaultVisible: false },

  // Valeurs financières
  { id: 'total_value_usd', label: 'Valeur USD', category: 'Financier', defaultVisible: true },
  { id: 'total_value_local', label: 'Valeur Locale', category: 'Financier', defaultVisible: false },
  { id: 'gold_price_usd_per_oz', label: 'Prix Or (USD/oz)', category: 'Financier', defaultVisible: false },
  { id: 'exchange_rate', label: 'Taux de Change', category: 'Financier', defaultVisible: false },
  { id: 'local_currency', label: 'Devise Locale', category: 'Financier', defaultVisible: false },

  // Détails expédition
  { id: 'number_of_boxes', label: 'Nombre de Boîtes', category: 'Logistique', defaultVisible: false },
  { id: 'box_type', label: 'Type de Boîte', category: 'Logistique', defaultVisible: false },
  { id: 'production_count', label: 'Nombre de Productions', category: 'Logistique', defaultVisible: false },

  // Workflow dates
  { id: 'approved_at', label: 'Date Approbation', category: 'Dates', defaultVisible: false },
  { id: 'shipped_at', label: 'Date Expédition', category: 'Dates', defaultVisible: false },
  { id: 'received_at', label: 'Date Réception', category: 'Dates', defaultVisible: false },
  { id: 'processing_started_at', label: 'Début Raffinage', category: 'Dates', defaultVisible: false },
  { id: 'processed_at', label: 'Date Raffiné', category: 'Dates', defaultVisible: false },
  { id: 'stocked_at', label: 'Date Mise en Stock', category: 'Dates', defaultVisible: false },
  { id: 'created_at', label: 'Date Création', category: 'Dates', defaultVisible: false },

  // Notes
  { id: 'notes', label: 'Notes', category: 'Informations', defaultVisible: false },
  { id: 'refining_notes', label: 'Notes Raffinage', category: 'Informations', defaultVisible: false }
];

interface ColumnSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedColumns: string[]) => void;
  currentColumns: string[];
  previewData?: any[];
}

type Step = 'selection' | 'preview';

export function ColumnSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  currentColumns,
  previewData = []
}: ColumnSelectorModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(currentColumns);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [step, setStep] = useState<Step>('selection');

  useEffect(() => {
    if (isOpen) {
      setSelectedColumns(currentColumns);
      setStep('selection');
    }
  }, [currentColumns, isOpen]);

  const categories = ['all', ...Array.from(new Set(AVAILABLE_COLUMNS.map(col => col.category)))];

  const filteredColumns = selectedCategory === 'all'
    ? AVAILABLE_COLUMNS
    : AVAILABLE_COLUMNS.filter(col => col.category === selectedCategory);

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const selectAll = () => {
    const filtered = filteredColumns.map(col => col.id);
    setSelectedColumns(prev => {
      const others = prev.filter(id => !filtered.includes(id));
      return [...others, ...filtered];
    });
  };

  const deselectAll = () => {
    const filtered = filteredColumns.map(col => col.id);
    setSelectedColumns(prev => prev.filter(id => !filtered.includes(id)));
  };

  const handleNext = () => {
    if (selectedColumns.length === 0) return;
    setStep('preview');
  };

  const handleBack = () => {
    setStep('selection');
  };

  const handleConfirm = (format: 'excel' | 'csv') => {
    onConfirm(selectedColumns);
    onClose();
  };

  const handleReset = () => {
    const defaults = AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.id);
    setSelectedColumns(defaults);
  };

  const getColumnValue = (item: any, columnId: string): string => {
    switch (columnId) {
      case 'reference_number':
        return item.reference_number || '';
      case 'status':
        return item.status || '';
      case 'mining_company':
        return item.mining_company?.name || '';
      case 'destination_refinery':
        return item.destination_refinery?.name || '';
      case 'total_pure_gold_grams':
        return item.total_pure_gold_grams?.toFixed(3) || '0';
      case 'total_pure_gold_oz':
        return item.total_pure_gold_oz?.toFixed(6) || '0';
      case 'total_value_usd':
        return `$${item.total_value_usd?.toLocaleString() || '0'}`;
      case 'shipment_date':
        return item.shipment_date ? new Date(item.shipment_date).toLocaleDateString('fr-FR') : '';
      default:
        return String(item[columnId] || '');
    }
  };

  const previewRows = previewData.slice(0, 5);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="4xl">
      <div className="space-y-5">
        {/* Header with Steps */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Columns className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {step === 'selection' ? 'Sélection des Colonnes' : 'Aperçu de l\'Export'}
                </h3>
                <p className="text-sm text-gray-600">
                  {step === 'selection'
                    ? 'Choisissez les colonnes à exporter'
                    : 'Vérifiez les données avant l\'export'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
              step === 'selection' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              <span className="text-xs font-medium">1. Sélection</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
              step === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              <span className="text-xs font-medium">2. Aperçu</span>
            </div>
          </div>
        </div>

        {step === 'selection' ? (
          <>
            {/* Column Count Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                <Check className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">
                  {selectedColumns.length} colonne{selectedColumns.length > 1 ? 's' : ''} sélectionnée{selectedColumns.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Sur {AVAILABLE_COLUMNS.length} disponibles
              </div>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-200">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat === 'all' ? 'Toutes' : cat}
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="text-xs gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Tout sélectionner
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                  className="text-xs gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Tout désélectionner
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs"
              >
                Par défaut
              </Button>
            </div>

            {/* Column List */}
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              <div className="divide-y divide-gray-200">
                {filteredColumns.map((column) => {
                  const isSelected = selectedColumns.includes(column.id);

                  return (
                    <button
                      key={column.id}
                      onClick={() => toggleColumn(column.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-sm font-medium ${
                              isSelected ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {column.label}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              {column.category}
                            </span>
                          </div>
                          {column.description && (
                            <p className="text-xs text-gray-500 leading-relaxed">
                              {column.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Preview Table */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    Aperçu des données
                  </p>
                  <p className="text-xs text-blue-700">
                    {previewRows.length} première{previewRows.length > 1 ? 's' : ''} ligne{previewRows.length > 1 ? 's' : ''} sur {previewData.length} au total
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-700">Colonnes</p>
                  <p className="text-lg font-bold text-blue-900">{selectedColumns.length}</p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      {selectedColumns.map(colId => {
                        const col = AVAILABLE_COLUMNS.find(c => c.id === colId);
                        return (
                          <th
                            key={colId}
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
                          >
                            {col?.label || colId}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {selectedColumns.map(colId => (
                          <td
                            key={colId}
                            className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"
                          >
                            {getColumnValue(row, colId)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {previewData.length > 5 && (
              <div className="text-center text-xs text-gray-500">
                + {previewData.length - 5} ligne{previewData.length - 5 > 1 ? 's' : ''} supplémentaire{previewData.length - 5 > 1 ? 's' : ''} seront exportées
              </div>
            )}
          </>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <Button
            variant="ghost"
            onClick={step === 'selection' ? onClose : handleBack}
            className="gap-2"
          >
            {step === 'selection' ? (
              'Annuler'
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                Retour
              </>
            )}
          </Button>

          {step === 'selection' ? (
            <Button
              onClick={handleNext}
              disabled={selectedColumns.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              Suivant: Aperçu
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={() => handleConfirm('csv')}
                className="bg-gray-600 hover:bg-gray-700 text-white gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Exporter CSV
              </Button>
              <Button
                onClick={() => handleConfirm('excel')}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <Download className="w-4 h-4" />
                Exporter Excel
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
