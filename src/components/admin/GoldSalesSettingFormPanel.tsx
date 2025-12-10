import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Factory, Users, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Toggle } from '@/components/ui/Toggle';
import { DatePicker } from '@/components/ui/DatePicker';
import {
  createGoldSalesSetting,
  updateGoldSalesSetting,
  checkDuplicateGoldSalesSetting,
  getSaleMethods,
  type GoldSalesSettingView,
  type CreateGoldSalesSettingData
} from '@/services/goldSalesSettingsService';
import { supabase } from '@/lib/supabase';

interface GoldSalesSettingFormPanelProps {
  setting: GoldSalesSettingView | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string, technicalDetails?: string) => void;
}

interface MiningCompany {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
}

interface Customer {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  country?: string;
}

export function GoldSalesSettingFormPanel({
  setting,
  isOpen,
  onClose,
  onSuccess,
  onError
}: GoldSalesSettingFormPanelProps) {
  const [formData, setFormData] = useState<CreateGoldSalesSettingData>({
    mining_company_id: '',
    customer_id: '',
    max_stock_percentage: 100,
    sale_method: 'standard',
    refining_fees_paid_by_customer: true,
    transport_fees_paid_by_customer: true,
    is_active: true,
    effective_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedMine, setSelectedMine] = useState<MiningCompany | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const saleMethods = getSaleMethods();
  const selectedMethodDescription = saleMethods.find(m => m.value === formData.sale_method)?.description || '';

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (setting) {
        setFormData({
          mining_company_id: setting.mining_company_id,
          customer_id: setting.customer_id,
          max_stock_percentage: setting.max_stock_percentage,
          sale_method: setting.sale_method,
          refining_fees_paid_by_customer: setting.refining_fees_paid_by_customer,
          transport_fees_paid_by_customer: setting.transport_fees_paid_by_customer,
          is_active: setting.is_active,
          effective_date: setting.effective_date || new Date().toISOString().split('T')[0],
          notes: setting.notes || ''
        });
      } else {
        setFormData({
          mining_company_id: '',
          customer_id: '',
          max_stock_percentage: 100,
          sale_method: 'standard',
          refining_fees_paid_by_customer: true,
          transport_fees_paid_by_customer: true,
          is_active: true,
          effective_date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        setSelectedMine(null);
        setSelectedCustomer(null);
      }
    }
  }, [isOpen, setting]);

  useEffect(() => {
    if (formData.mining_company_id) {
      const mine = miningCompanies.find(m => m.id === formData.mining_company_id);
      setSelectedMine(mine || null);
    } else {
      setSelectedMine(null);
    }
  }, [formData.mining_company_id, miningCompanies]);

  useEffect(() => {
    if (formData.customer_id) {
      const customer = customers.find(c => c.id === formData.customer_id);
      setSelectedCustomer(customer || null);
    } else {
      setSelectedCustomer(null);
    }
  }, [formData.customer_id, customers]);

  // Vérifier les doublons quand Mine et Client sont sélectionnés
  useEffect(() => {
    async function checkForDuplicate() {
      // Ne vérifier que si on a les deux IDs et qu'on n'est pas en mode édition
      // (en édition, on permet de modifier le même couple)
      if (!formData.mining_company_id || !formData.customer_id) {
        setDuplicateWarning(null);
        return;
      }

      // En mode édition, exclure l'enregistrement actuel
      const excludeId = setting?.id;

      setCheckingDuplicate(true);
      setDuplicateWarning(null);

      try {
        const result = await checkDuplicateGoldSalesSetting(
          formData.mining_company_id,
          formData.customer_id,
          excludeId
        );

        if (result.success && result.exists) {
          const mineName = miningCompanies.find(m => m.id === formData.mining_company_id)?.name || 'cette mine';
          const customerName = customers.find(c => c.id === formData.customer_id)?.name || 'ce client';

          setDuplicateWarning(
            `⚠️ Une configuration existe déjà pour ${mineName} → ${customerName}. Vous ne pouvez pas créer de doublon.`
          );
        } else {
          setDuplicateWarning(null);
        }
      } catch (error) {
        console.error('Error checking duplicate:', error);
      } finally {
        setCheckingDuplicate(false);
      }
    }

    checkForDuplicate();
  }, [formData.mining_company_id, formData.customer_id, setting, miningCompanies, customers]);

  async function loadInitialData() {
    setLoadingData(true);
    try {
      const [minesResult, customersResult] = await Promise.all([
        supabase.from('mining_companies').select('id, name, abbreviation, country').order('name'),
        supabase.from('customers').select('id, name, contact_person, email, country').order('name')
      ]);

      if (minesResult.data) setMiningCompanies(minesResult.data);
      if (customersResult.data) setCustomers(customersResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.mining_company_id || !formData.customer_id) {
      onError('Veuillez sélectionner une mine et un client.');
      return;
    }

    if (formData.max_stock_percentage < 1 || formData.max_stock_percentage > 100) {
      onError('Le pourcentage doit être entre 1 et 100.');
      return;
    }

    setLoading(true);

    try {
      const result = setting
        ? await updateGoldSalesSetting(setting.id, formData)
        : await createGoldSalesSetting(formData);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        const err = result.error as any;
        onError(err?.message || 'Une erreur est survenue.', err?.technicalDetails);
      }
    } catch (error: any) {
      onError('Une erreur inattendue est survenue.', error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {setting ? 'Modifier le Paramètre de Vente' : 'Nouveau Paramètre de Vente'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Configuration des règles de vente Mine-Client
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loadingData ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Statut */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      Statut du Paramétrage
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      {formData.is_active ? 'Ce paramétrage est actuellement actif' : 'Ce paramétrage est désactivé'}
                    </p>
                  </div>
                  <Toggle
                    checked={formData.is_active}
                    onChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    label=""
                  />
                </div>
              </div>

              {/* Date d'effet */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Date de Début d'Application
                </label>
                <DatePicker
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Date à partir de laquelle ce paramétrage entre en vigueur
                </p>
              </div>

              {/* Mine (Vendeur) */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Mine (Vendeur) *
                </label>
                <Select
                  value={formData.mining_company_id}
                  onChange={(e) => setFormData({ ...formData, mining_company_id: e.target.value })}
                  disabled={!!setting}
                  required
                >
                  <option value="">Sélectionner une mine...</option>
                  {miningCompanies.map((mine) => (
                    <option key={mine.id} value={mine.id}>
                      {mine.name} ({mine.abbreviation})
                    </option>
                  ))}
                </Select>

                {/* Informations de la Mine sélectionnée */}
                {selectedMine && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Factory className="w-5 h-5 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-900">{selectedMine.name}</p>
                        <div className="mt-1 space-y-1">
                          <p className="text-xs text-amber-700">
                            <span className="font-medium">Abréviation:</span> {selectedMine.abbreviation}
                          </p>
                          <p className="text-xs text-amber-700">
                            <span className="font-medium">Pays:</span> {selectedMine.country}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Client (Acheteur) */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Client (Acheteur) *
                </label>
                <Select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  disabled={!!setting}
                  required
                >
                  <option value="">Sélectionner un client...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </Select>

                {/* Informations du Client sélectionné */}
                {selectedCustomer && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="w-5 h-5 text-blue-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-900">{selectedCustomer.name}</p>
                        <div className="mt-1 space-y-1">
                          {selectedCustomer.contact_person && (
                            <p className="text-xs text-blue-700">
                              <span className="font-medium">Contact:</span> {selectedCustomer.contact_person}
                            </p>
                          )}
                          {selectedCustomer.email && (
                            <p className="text-xs text-blue-700">
                              <span className="font-medium">Email:</span> {selectedCustomer.email}
                            </p>
                          )}
                          {selectedCustomer.country && (
                            <p className="text-xs text-blue-700">
                              <span className="font-medium">Pays:</span> {selectedCustomer.country}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Avertissement de Doublon */}
              {duplicateWarning && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-900 mb-1">
                        Configuration Déjà Existante
                      </p>
                      <p className="text-sm text-red-700">
                        {duplicateWarning}
                      </p>
                      <p className="text-xs text-red-600 mt-2">
                        Une seule configuration est autorisée par couple Mine-Client.
                        {!setting && ' Modifiez la configuration existante ou sélectionnez une autre combinaison.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Message de vérification en cours */}
              {checkingDuplicate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Vérification de l'unicité...</span>
                  </div>
                </div>
              )}

              {/* Pourcentage Maximum */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Pourcentage Maximum du Stock * (%)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="0.01"
                  value={formData.max_stock_percentage}
                  onChange={(e) => setFormData({ ...formData, max_stock_percentage: parseFloat(e.target.value) || 0 })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Pourcentage maximum du stock disponible qui peut être vendu à ce client (1-100%)
                </p>
              </div>

              {/* Méthode de Vente */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Méthode de Vente *
                </label>
                <Select
                  value={formData.sale_method}
                  onChange={(e) => setFormData({ ...formData, sale_method: e.target.value as any })}
                  required
                >
                  {saleMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </Select>

                {/* Description de la méthode sélectionnée */}
                {selectedMethodDescription && (
                  <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-purple-900">{selectedMethodDescription}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Frais de Raffinage */}
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-gray-900">Frais de Raffinage</span>
                    <p className="text-xs text-gray-600 mt-1">
                      {formData.refining_fees_paid_by_customer
                        ? 'Payés par le client (acheteur)'
                        : 'Payés par le vendeur (mine)'}
                    </p>
                  </div>
                  <Toggle
                    checked={formData.refining_fees_paid_by_customer}
                    onChange={(checked) => setFormData({ ...formData, refining_fees_paid_by_customer: checked })}
                    label=""
                  />
                </label>
              </div>

              {/* Frais de Transport */}
              <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-gray-900">Frais de Transport</span>
                    <p className="text-xs text-gray-600 mt-1">
                      {formData.transport_fees_paid_by_customer
                        ? 'Payés par le client (acheteur)'
                        : 'Payés par le vendeur (mine)'}
                    </p>
                  </div>
                  <Toggle
                    checked={formData.transport_fees_paid_by_customer}
                    onChange={(checked) => setFormData({ ...formData, transport_fees_paid_by_customer: checked })}
                    label=""
                  />
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Notes et Commentaires
                </label>
                <TextArea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Ajoutez des notes ou commentaires sur ce paramétrage..."
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">Information importante</p>
                    <p className="text-blue-700">
                      Ce paramétrage définit les règles de vente entre la mine sélectionnée et le client.
                      Une fois créé, vous ne pourrez plus modifier le couple Mine-Client, mais vous pourrez
                      ajuster les autres paramètres.
                    </p>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || loadingData || !!duplicateWarning}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {setting ? 'Mettre à jour' : 'Créer le paramétrage'}
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
