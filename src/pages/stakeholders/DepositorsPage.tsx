import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  UserCheck,
  Shield,
  Loader,
  Mail,
  Phone,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  depositorService,
  Depositor,
  DepositorCategory,
  DEPOSITOR_CATEGORIES,
} from '@/services/depositorService';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { useMineWorkspace } from '@/hooks/useMineWorkspace';

interface MiningCompany {
  id: string;
  name: string;
}

export function DepositorsPage() {
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useCustomAlert();
  const { isMine, companyId, companyName } = useMineWorkspace();
  const [depositors, setDepositors] = useState<Depositor[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>(companyId || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadMiningCompanies();
    loadDepositors();
  }, [selectedCompany, selectedCategory, companyId, isMine]);

  const loadMiningCompanies = async () => {
    if (isMine && !companyId) {
      setMiningCompanies([]);
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
    } catch (error: any) {
      console.error('Error loading mining companies:', error);
      showError('Impossible de charger les sociétés minières');
    }
  };

  const loadDepositors = async () => {
    try {
      setLoading(true);
      const filters: any = { is_active: true };

      if (isMine && companyId) {
        filters.mining_company_id = companyId;
      } else if (selectedCompany !== 'all') {
        filters.mining_company_id = selectedCompany;
      }

      if (selectedCategory !== 'all') {
        filters.category = selectedCategory as DepositorCategory;
      }

      const { data, error } = await depositorService.getDepositors(filters);

      if (error) throw error;
      setDepositors(data || []);
    } catch (error: any) {
      console.error('Error loading depositors:', error);
      showError('Impossible de charger les dépositaires');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await showConfirm(
      `Désactiver le dépositaire ${name} ?`,
      'Il ne sera plus proposé comme signataire.'
    );

    if (!confirmed) return;

    try {
      const { error } = await depositorService.deleteDepositor(id);

      if (error) throw error;

      showSuccess('Dépositaire désactivé');
      loadDepositors();
    } catch (error: any) {
      console.error('Error deleting depositor:', error);
      showError('Impossible de désactiver ce dépositaire');
    }
  };

  const filteredDepositors = depositors.filter((depositor) => {
    const matchesSearch =
      depositor.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      depositor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      depositor.job_title.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const getCategoryBadgeColor = (category: DepositorCategory): string => {
    const colors: Record<string, string> = {
      general_management: 'bg-blue-100 text-blue-800',
      general_management_backup: 'bg-blue-50 text-blue-600',
      finance: 'bg-green-100 text-green-800',
      finance_backup: 'bg-green-50 text-green-600',
      bullion_dispatch: 'bg-purple-100 text-purple-800',
      sale_of_gold: 'bg-yellow-100 text-yellow-800',
      pmr_assay: 'bg-orange-100 text-orange-800',
      security: 'bg-red-100 text-red-800',
      security_backup: 'bg-red-50 text-red-600',
      legal: 'bg-gray-100 text-gray-800',
      legal_backup: 'bg-gray-50 text-gray-600',
    };

    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getCompanyName = (companyId: string): string => {
    const company = miningCompanies.find((c) => c.id === companyId);
    return company?.name || (isMine ? companyName || 'Votre mine' : 'Société inconnue');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dépositaires</h1>
            <p className="text-gray-600 mt-1">
              Signataires et contacts autorisés pour les expéditions.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/stakeholders/depositors/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un dépositaire
            </Button>
          </div>
        </div>

        <Card>
          <div className="p-6">
            <div className={`grid grid-cols-1 gap-4 mb-6 ${isMine ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher par nom, courriel ou fonction…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {!isMine && <Select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                <option value="all">Toutes les sociétés</option>
                {miningCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>}

              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">Tous les rôles</option>
                {Object.entries(DEPOSITOR_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : filteredDepositors.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun dépositaire
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery || selectedCompany !== 'all' || selectedCategory !== 'all'
                    ? 'Aucun contact ne correspond aux filtres.'
                    : 'Ajoutez le premier signataire autorisé.'}
                </p>
                <Button onClick={() => navigate('/stakeholders/depositors/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un dépositaire
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Dépositaire
                      </th>
                      {!isMine && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Société minière
                      </th>}
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Responsabilité
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Coordonnées
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredDepositors.map((depositor, index) => (
                      <tr
                        key={depositor.id}
                        className={`transition-colors hover:bg-blue-50 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              {depositor.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">
                                {depositor.full_name}
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5">
                                {depositor.job_title}
                              </div>
                            </div>
                          </div>
                        </td>
                        {!isMine && <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-sm font-medium text-gray-900">
                              {getCompanyName(depositor.mining_company_id)}
                            </span>
                          </div>
                        </td>}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getCategoryBadgeColor(
                              depositor.category
                            )}`}
                          >
                            {DEPOSITOR_CATEGORIES[depositor.category]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              <a
                                href={`mailto:${depositor.email}`}
                                className="hover:text-blue-600 hover:underline truncate"
                              >
                                {depositor.email}
                              </a>
                            </div>
                            {depositor.cellphone && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Phone className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <a
                                  href={`tel:${depositor.cellphone}`}
                                  className="hover:text-green-600 hover:underline"
                                >
                                  {depositor.cellphone}
                                </a>
                              </div>
                            )}
                            {depositor.telephone && (
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span>{depositor.telephone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-center gap-1.5">
                            {depositor.is_primary && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                <UserCheck className="w-3.5 h-3.5 mr-1" />
                                Principal
                              </span>
                            )}
                            {depositor.is_backup && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                Suppléant
                              </span>
                            )}
                            {!depositor.is_primary && !depositor.is_backup && (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() =>
                                navigate(`/stakeholders/depositors/${depositor.id}/edit`)
                              }
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Modifier le dépositaire"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(depositor.id, depositor.full_name)
                              }
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Désactiver le dépositaire"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && filteredDepositors.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                {filteredDepositors.length} dépositaire{filteredDepositors.length > 1 ? 's' : ''}
                {filteredDepositors.length !== depositors.length ? ` sur ${depositors.length}` : ''}
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
