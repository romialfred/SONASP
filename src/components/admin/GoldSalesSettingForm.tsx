import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { FormField } from '@/components/ui/FormField';
import { supabase } from '@/lib/supabase';
import {
  createGoldSalesSetting,
  updateGoldSalesSetting,
  getSaleMethods,
  type CreateGoldSalesSettingData,
  type GoldSalesSettingView,
  type SaleMethod
} from '@/services/goldSalesSettingsService';

interface GoldSalesSettingFormProps {
  setting?: GoldSalesSettingView | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string, technicalDetails?: string) => void;
}

interface MiningCompany {
  id: string;
  name: string;
  abbreviation: string;
}

interface Customer {
  id: string;
  name: string;
}

export function GoldSalesSettingForm({ setting, isOpen, onClose, onSuccess, onError }: GoldSalesSettingFormProps) {
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    mining_company_id: '',
    customer_id: '',
    max_stock_percentage: '100',
    sale_method: 'standard' as SaleMethod,
    refining_fees_paid_by_customer: false,
    transport_fees_paid_by_customer: false,
    is_active: true,
    notes: ''
  });

  const saleMethods = getSaleMethods();

  useEffect(() => {
    if (isOpen) {
      loadMiningCompanies();
      loadCustomers();

      if (setting) {
        setFormData({
          mining_company_id: setting.mining_company_id,
          customer_id: setting.customer_id,
          max_stock_percentage: setting.max_stock_percentage.toString(),
          sale_method: setting.sale_method,
          refining_fees_paid_by_customer: setting.refining_fees_paid_by_customer,
          transport_fees_paid_by_customer: setting.transport_fees_paid_by_customer,
          is_active: setting.is_active,
          notes: setting.notes || ''
        });
      } else {
        setFormData({
          mining_company_id: '',
          customer_id: '',
          max_stock_percentage: '100',
          sale_method: 'standard',
          refining_fees_paid_by_customer: false,
          transport_fees_paid_by_customer: false,
          is_active: true,
          notes: ''
        });
      }
    }
  }, [isOpen, setting]);

  async function loadMiningCompanies() {
    const { data } = await supabase
      .from('mining_companies')
      .select('id, name, abbreviation')
      .order('name');

    if (data) setMiningCompanies(data);
  }

  async function loadCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .order('name');

    if (data) setCustomers(data);
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.mining_company_id) {
      newErrors.mining_company_id = 'Veuillez sélectionner une mine';
    }

    if (!formData.customer_id) {
      newErrors.customer_id = 'Veuillez sélectionner un client';
    }

    const percentage = parseFloat(formData.max_stock_percentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      newErrors.max_stock_percentage = 'Le pourcentage doit être entre 1 et 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const data: CreateGoldSalesSettingData = {
        mining_company_id: formData.mining_company_id,
        customer_id: formData.customer_id,
        max_stock_percentage: parseFloat(formData.max_stock_percentage),
        sale_method: formData.sale_method,
        refining_fees_paid_by_customer: formData.refining_fees_paid_by_customer,
        transport_fees_paid_by_customer: formData.transport_fees_paid_by_customer,
        notes: formData.notes || undefined
      };

      let result;
      if (setting) {
        result = await updateGoldSalesSetting(setting.id, {
          ...data,
          is_active: formData.is_active
        });
      } else {
        result = await createGoldSalesSetting(data);
      }

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        const err = result.error as any;
        onError(
          err?.message || 'Une erreur est survenue',
          err?.technicalDetails
        );
      }
    } catch (error: any) {
      onError(
        'Une erreur inattendue est survenue',
        error?.message || JSON.stringify(error, null, 2)
      );
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {setting ? 'Modifier le paramétrage' : 'Nouveau paramétrage'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Mine Selection */}
            <FormField
              label="Mine *"
              error={errors.mining_company_id}
              required
            >
              <Select
                value={formData.mining_company_id}
                onChange={(e) => setFormData({ ...formData, mining_company_id: e.target.value })}
                disabled={!!setting} // Cannot change mine on update
              >
                <option value="">-- Sélectionner une mine --</option>
                {miningCompanies.map((mc) => (
                  <option key={mc.id} value={mc.id}>
                    {mc.name} ({mc.abbreviation})
                  </option>
                ))}
              </Select>
            </FormField>

            {/* Customer Selection */}
            <FormField
              label="Client *"
              error={errors.customer_id}
              required
            >
              <Select
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                disabled={!!setting} // Cannot change customer on update
              >
                <option value="">-- Sélectionner un client --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>

            {/* Max Stock Percentage */}
            <FormField
              label="Pourcentage maximum du stock *"
              error={errors.max_stock_percentage}
              required
              hint="Pourcentage maximum du stock disponible pouvant être vendu en une transaction (1-100)"
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={formData.max_stock_percentage}
                  onChange={(e) => setFormData({ ...formData, max_stock_percentage: e.target.value })}
                  placeholder="100.00"
                  className="flex-1"
                />
                <span className="text-gray-600 font-medium">%</span>
              </div>
            </FormField>

            {/* Sale Method */}
            <FormField
              label="Méthode de vente *"
              required
            >
              <Select
                value={formData.sale_method}
                onChange={(e) => setFormData({ ...formData, sale_method: e.target.value as SaleMethod })}
              >
                {saleMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label} - {method.description}
                  </option>
                ))}
              </Select>
            </FormField>

            {/* Fee Allocation */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
                Répartition des frais
              </h3>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="refining_fees"
                  checked={formData.refining_fees_paid_by_customer}
                  onChange={(e) => setFormData({ ...formData, refining_fees_paid_by_customer: e.target.checked })}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="refining_fees" className="text-sm text-gray-700 cursor-pointer">
                  <span className="font-medium">Frais de raffinage à la charge du client</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Si non coché, les frais de raffinage sont à la charge du vendeur
                  </p>
                </label>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="transport_fees"
                  checked={formData.transport_fees_paid_by_customer}
                  onChange={(e) => setFormData({ ...formData, transport_fees_paid_by_customer: e.target.checked })}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="transport_fees" className="text-sm text-gray-700 cursor-pointer">
                  <span className="font-medium">Frais de transport à la charge du client</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Si non coché, les frais de transport sont à la charge du vendeur
                  </p>
                </label>
              </div>
            </div>

            {/* Active Status (only on update) */}
            {setting && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700 cursor-pointer">
                  <span className="font-medium">Configuration active</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Désactivez pour ignorer temporairement cette configuration
                  </p>
                </label>
              </div>
            )}

            {/* Notes */}
            <FormField
              label="Notes"
              hint="Remarques ou commentaires sur cette configuration"
            >
              <TextArea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ex: Configuration spéciale pour client privilégié..."
                rows={3}
              />
            </FormField>

            {/* Warning if percentage is low */}
            {parseFloat(formData.max_stock_percentage) < 100 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    Limitation de stock configurée
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Ce client pourra acheter maximum {formData.max_stock_percentage}% du stock disponible par transaction.
                  </p>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {setting ? 'Mettre à jour' : 'Créer'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
