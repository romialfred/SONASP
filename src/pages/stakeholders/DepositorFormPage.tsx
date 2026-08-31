import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { DepositorForm } from '@/components/depositors/DepositorForm';
import { Card } from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import { ArrowLeft, Shield, Users, Mail, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  depositorService,
  Depositor,
  CreateDepositorInput,
  UpdateDepositorInput,
} from '@/services/depositorService';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { useMineWorkspace } from '@/hooks/useMineWorkspace';

interface MiningCompany {
  id: string;
  name: string;
}

export function DepositorFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showSuccess, showError } = useCustomAlert();
  const { isMine, companyId } = useMineWorkspace();
  const [depositor, setDepositor] = useState<Depositor | undefined>();
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companyId || '');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingDepositors, setExistingDepositors] = useState<Depositor[]>([]);
  const [loadingDepositors, setLoadingDepositors] = useState(false);

  const isEditMode = Boolean(id);

  useEffect(() => {
    loadMiningCompanies();
    if (id) {
      loadDepositor(id);
    }
  }, [id]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadExistingDepositors();
    } else {
      setExistingDepositors([]);
    }
  }, [selectedCompanyId]);

  const loadExistingDepositors = async () => {
    if (!selectedCompanyId) return;

    try {
      setLoadingDepositors(true);
      const { data, error } = await supabase
        .from('depositors')
        .select('*')
        .eq('mining_company_id', selectedCompanyId)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setExistingDepositors(
        (data || []).map((item) => ({ ...item, is_active: item.is_active ?? false }))
      );
    } catch (error) {
      console.error('Error loading existing depositors:', error);
    } finally {
      setLoadingDepositors(false);
    }
  };

  const loadMiningCompanies = async () => {
    if (isMine && !companyId) {
      showError('Votre compte n’est rattaché à aucune société minière');
      return;
    }

    try {
      let query = supabase
        .from('mining_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (isMine && companyId) query = query.eq('id', companyId);
      const { data, error } = await query;

      if (error) throw error;
      setMiningCompanies(data || []);

      if (isMine && companyId) {
        setSelectedCompanyId(companyId);
      } else if (data && data.length > 0 && !id) {
        setSelectedCompanyId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading mining companies:', error);
      showError('Impossible de charger les sociétés minières');
    }
  };

  const loadDepositor = async (depositorId: string) => {
    try {
      setLoading(true);
      const { data, error } = await depositorService.getDepositorById(depositorId);

      if (error) throw error;
      if (data) {
        if (isMine && companyId && data.mining_company_id !== companyId) {
          showError('Ce dépositaire n’appartient pas à votre société');
          navigate('/stakeholders/depositors');
          return;
        }
        setDepositor(data);
        setSelectedCompanyId(isMine && companyId ? companyId : data.mining_company_id);
      }
    } catch (error: any) {
      console.error('Error loading depositor:', error);
      showError('Impossible de charger ce dépositaire');
      navigate('/stakeholders/depositors');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: CreateDepositorInput | UpdateDepositorInput) => {
    try {
      setIsSubmitting(true);

      const targetCompanyId = isMine ? companyId : selectedCompanyId;
      if (!targetCompanyId) {
        showError('Veuillez sélectionner une société minière');
        setIsSubmitting(false);
        return;
      }

      if (isEditMode && id) {
        // In edit mode, ensure mining_company_id is included in the update
        const updateData = {
          ...data,
          mining_company_id: targetCompanyId,
        };
        const { error } = await depositorService.updateDepositor(id, updateData);
        if (error) {
          // Check if it's a unique constraint violation
          if (error.code === '23505') {
            showError('Cette personne possède déjà ce rôle dans la société.');
          } else {
            throw error;
          }
          return;
        }
        showSuccess('Dépositaire mis à jour');
      } else {
        // In create mode, ensure mining_company_id is set correctly
        const createData = {
          ...data,
          mining_company_id: targetCompanyId,
        } as CreateDepositorInput;

        const { error } = await depositorService.createDepositor(createData);
        if (error) {
          // Check if it's a unique constraint violation
          if (error.code === '23505') {
            showError('Cette personne possède déjà ce rôle dans la société.');
          } else {
            throw error;
          }
          return;
        }
        showSuccess('Dépositaire ajouté');
      }

      navigate('/stakeholders/depositors');
    } catch (error: any) {
      console.error('Error saving depositor:', error);
      showError(
        error.message || `Impossible de ${isEditMode ? 'modifier' : 'créer'} le dépositaire`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/stakeholders/depositors');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/stakeholders/depositors')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditMode ? 'Modifier le dépositaire' : 'Nouveau dépositaire'}
              </h1>
              <p className="text-sm text-gray-600">
                {isEditMode
                  ? 'Mettez à jour ses coordonnées et sa responsabilité.'
                  : 'Ajoutez un signataire autorisé pour les expéditions.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-6">
            {!isMine && <Card>
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Société minière <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  required
                  disabled={isSubmitting}
                >
                  <option value="">Sélectionner une société…</option>
                  {miningCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </Select>
                {miningCompanies.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600">
                    Aucune société minière active n’est disponible.
                  </p>
                )}
                {isEditMode && (
                  <p className="mt-2 text-sm text-gray-600">
                    La société peut être modifiée pour ce dépositaire.
                  </p>
                )}
              </div>
            </Card>}

            {selectedCompanyId && (
              <DepositorForm
                depositor={depositor}
                miningCompanyId={selectedCompanyId}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isSubmitting={isSubmitting}
              />
            )}
          </div>

          {/* Right Column - Existing Depositors List */}
          <div className="lg:col-span-1">
            <Card>
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Dépositaires enregistrés
                  </h3>
                </div>
                {selectedCompanyId && (
                  <p className="text-sm text-gray-600 mt-1">
                    {existingDepositors.length} contact{existingDepositors.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div className="p-4">
                {!selectedCompanyId ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      Sélectionnez une société minière.
                    </p>
                  </div>
                ) : loadingDepositors ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : existingDepositors.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      Aucun dépositaire n’est encore enregistré.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {existingDepositors.map((dep) => (
                      <div
                        key={dep.id}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">
                              {dep.full_name}
                            </h4>
                            <p className="text-xs text-gray-600 mt-0.5 truncate">
                              {dep.job_title}
                            </p>
                            <div className="mt-2 space-y-1">
                              {dep.email && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <Mail className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{dep.email}</span>
                                </div>
                              )}
                              {dep.cellphone && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <Phone className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{dep.cellphone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {dep.is_primary && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full flex-shrink-0">
                              Principal
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
