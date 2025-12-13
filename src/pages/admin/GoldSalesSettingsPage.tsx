import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CheckCircle, XCircle, Settings } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { UserFriendlyErrorModal } from '@/components/ui/UserFriendlyError';
import { GoldSalesSettingFormPanel } from '@/components/admin/GoldSalesSettingFormPanel';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import {
  getAllGoldSalesSettings,
  deleteGoldSalesSetting,
  getSaleMethods,
  type GoldSalesSettingView
} from '@/services/goldSalesSettingsService';

export default function GoldSalesSettingsPage() {
  const [settings, setSettings] = useState<GoldSalesSettingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<GoldSalesSettingView | null>(null);
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    message: string;
    technicalDetails?: string;
  }>({ isOpen: false, message: '' });

  const alert = useCustomAlert();
  const saleMethods = getSaleMethods();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    const result = await getAllGoldSalesSettings();

    if (result.success) {
      setSettings(result.data);
    } else {
      const err = result.error as any;
      setErrorModal({
        isOpen: true,
        message: err?.message || 'Erreur lors du chargement des paramètres.',
        technicalDetails: err?.technicalDetails
      });
    }
    setLoading(false);
  }

  async function handleDelete(id: string, miningCompanyName: string, customerName: string) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le paramètre pour ${miningCompanyName} → ${customerName} ?`)) {
      return;
    }

    const result = await deleteGoldSalesSetting(id);

    if (result.success) {
      alert.success('Paramètre supprimé avec succès');
      loadSettings();
    } else {
      const err = result.error as any;
      setErrorModal({
        isOpen: true,
        message: err?.message || 'Erreur lors de la suppression.',
        technicalDetails: err?.technicalDetails
      });
    }
  }

  function handleCreate() {
    setSelectedSetting(null);
    setIsFormOpen(true);
  }

  function handleEdit(setting: GoldSalesSettingView) {
    setSelectedSetting(setting);
    setIsFormOpen(true);
  }

  function handleFormClose() {
    setIsFormOpen(false);
    setSelectedSetting(null);
  }

  function handleFormSuccess() {
    alert.success(selectedSetting ? 'Paramètre mis à jour avec succès' : 'Paramètre créé avec succès');
    loadSettings();
  }

  function handleFormError(message: string, technicalDetails?: string) {
    setErrorModal({
      isOpen: true,
      message,
      technicalDetails
    });
  }

  function getSaleMethodLabel(method: string): string {
    const found = saleMethods.find(m => m.value === method);
    return found?.label || method;
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Settings className="w-8 h-8 text-blue-600" />
              Paramétrage des Ventes d'Or
            </h1>
            <p className="mt-2 text-gray-600">
              Configuration des règles de vente par couple Mine-Client
            </p>
          </div>

          <Button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouveau paramétrage
          </Button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total configurations</p>
                  <p className="text-2xl font-bold text-gray-900">{settings.length}</p>
                </div>
                <Settings className="w-10 h-10 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Actives</p>
                  <p className="text-2xl font-bold text-green-600">
                    {settings.filter(s => s.is_active).length}
                  </p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Inactives</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {settings.filter(s => !s.is_active).length}
                  </p>
                </div>
                <XCircle className="w-10 h-10 text-gray-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Mines configurées</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {new Set(settings.map(s => s.mining_company_id)).size}
                  </p>
                </div>
                <Settings className="w-10 h-10 text-amber-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Configurations de Vente</CardTitle>
          </CardHeader>
          <CardContent>
            {settings.length === 0 ? (
              <div className="text-center py-12">
                <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">Aucun paramétrage défini</p>
                <p className="text-gray-400 mt-2">
                  Créez votre premier paramétrage pour contrôler les ventes par Mine-Client
                </p>
                <Button
                  onClick={handleCreate}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Créer un paramétrage
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mine
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Max Stock %
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Méthode de vente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Frais
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {settings.map((setting) => (
                      <tr key={setting.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          {setting.is_active ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {setting.mining_company_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {setting.mining_company_abbr}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {setting.customer_name}
                          </div>
                          {setting.contact_person && (
                            <div className="text-xs text-gray-500">
                              {setting.contact_person}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-blue-600">
                              {setting.max_stock_percentage.toFixed(2)}%
                            </span>
                            {setting.effective_date && (
                              <span className="text-xs text-gray-500">
                                Depuis: {new Date(setting.effective_date).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {getSaleMethodLabel(setting.sale_method)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs ${setting.refining_fees_paid_by_customer ? 'text-orange-600' : 'text-gray-500'}`}>
                              Raffinage: {setting.refining_fees_paid_by_customer ? 'Client' : 'Vendeur'}
                            </span>
                            <span className={`text-xs ${setting.transport_fees_paid_by_customer ? 'text-orange-600' : 'text-gray-500'}`}>
                              Transport: {setting.transport_fees_paid_by_customer ? 'Client' : 'Vendeur'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(setting)}
                              className="text-blue-600 hover:text-blue-900 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(setting.id, setting.mining_company_name, setting.customer_name)}
                              className="text-red-600 hover:text-red-900 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Panel */}
      <GoldSalesSettingFormPanel
        setting={selectedSetting}
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        onError={handleFormError}
      />

      {/* Error Modal */}
      <UserFriendlyErrorModal
        isOpen={errorModal.isOpen}
        title="Erreur"
        message={errorModal.message}
        technicalDetails={errorModal.technicalDetails}
        onClose={() => setErrorModal({ isOpen: false, message: '' })}
        variant="error"
      />
    </MainLayout>
  );
}
