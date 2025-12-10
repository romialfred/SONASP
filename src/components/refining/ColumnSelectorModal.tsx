import { useState, useEffect } from 'react';
import { Check, Columns, Download, Eye, EyeOff } from 'lucide-react';
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
}

export function ColumnSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  currentColumns
}: ColumnSelectorModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(currentColumns);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    setSelectedColumns(currentColumns);
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

  const handleConfirm = () => {
    onConfirm(selectedColumns);
    onClose();
  };

  const handleReset = () => {
    const defaults = AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.id);
    setSelectedColumns(defaults);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Columns className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Sélection des Colonnes
                </h3>
                <p className="text-sm text-gray-600">
                  Choisissez les colonnes à afficher et exporter
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
              <Check className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">
                {selectedColumns.length} sélectionnée{selectedColumns.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Filtres par catégorie */}
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

        {/* Actions rapides */}
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

        {/* Liste des colonnes */}
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

        {/* Footer avec aperçu */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-xs text-gray-600 mb-2">Colonnes sélectionnées :</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedColumns.length === 0 ? (
              <span className="text-xs text-gray-400 italic">Aucune colonne sélectionnée</span>
            ) : (
              selectedColumns.map(colId => {
                const col = AVAILABLE_COLUMNS.find(c => c.id === colId);
                return col ? (
                  <span
                    key={colId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                  >
                    {col.label}
                  </span>
                ) : null;
              })
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedColumns.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Download className="w-4 h-4" />
            Appliquer et Exporter
          </Button>
        </div>
      </div>
    </Modal>
  );
}
