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
  Download,
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

interface MiningCompany {
  id: string;
  name: string;
}

export function DepositorsPage() {
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useCustomAlert();
  const [depositors, setDepositors] = useState<Depositor[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadMiningCompanies();
    loadDepositors();
  }, [selectedCompany, selectedCategory]);

  const loadMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMiningCompanies(data || []);
    } catch (error: any) {
      console.error('Error loading mining companies:', error);
      showError('Failed to load mining companies');
    }
  };

  const loadDepositors = async () => {
    try {
      setLoading(true);
      const filters: any = { is_active: true };

      if (selectedCompany !== 'all') {
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
      showError('Failed to load depositors');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await showConfirm(
      `Are you sure you want to delete ${name}?`,
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const { error } = await depositorService.deleteDepositor(id);

      if (error) throw error;

      showSuccess('Depositor deleted successfully');
      loadDepositors();
    } catch (error: any) {
      console.error('Error deleting depositor:', error);
      showError('Failed to delete depositor');
    }
  };

  const handleExport = () => {
    const csv = depositorService.exportToCSV(filteredDepositors);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depositors_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
    return company?.name || 'Unknown';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Depositor List</h1>
            <p className="text-gray-600 mt-1">
              Manage depositor contacts, signatories and approvers
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => navigate('/stakeholders/depositors/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Depositor
            </Button>
          </div>
        </div>

        <Card>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, email, or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                <option value="all">All Companies</option>
                {miningCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>

              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
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
                  No depositors found
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery || selectedCompany !== 'all' || selectedCategory !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Get started by adding your first depositor'}
                </p>
                <Button onClick={() => navigate('/stakeholders/depositors/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Depositor
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Name & Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Company
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDepositors.map((depositor) => (
                      <tr key={depositor.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {depositor.full_name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {depositor.job_title}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {getCompanyName(depositor.mining_company_id)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeColor(
                              depositor.category
                            )}`}
                          >
                            {DEPOSITOR_CATEGORIES[depositor.category]}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-gray-900">
                              <Mail className="w-3 h-3 mr-1 text-gray-400" />
                              {depositor.email}
                            </div>
                            {depositor.cellphone && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Phone className="w-3 h-3 mr-1 text-gray-400" />
                                {depositor.cellphone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            {depositor.is_primary && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                <UserCheck className="w-3 h-3 mr-1" />
                                Primary
                              </span>
                            )}
                            {depositor.is_backup && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                Backup
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() =>
                                navigate(`/stakeholders/depositors/${depositor.id}/edit`)
                              }
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(depositor.id, depositor.full_name)
                              }
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
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
                Showing {filteredDepositors.length} of {depositors.length} depositor
                {depositors.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
