import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Factory, Plus, Search, Edit, Eye, Globe, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { canManageMiningRegistry } from '@/lib/miningRegistryAccess';
import { supabase } from '@/lib/supabase';

interface MiningCompany {
  id: string;
  name: string;
  abbreviation?: string | null;
  code: string;
  company_type?: string | null;
  country: string;
  region?: string | null;
  province?: string | null;
  localite?: string | null;
  city: string | null;
  contact_person_name: string | null;
  contact_person_email: string;
  contact_person_phone: string;
  website: string | null;
  is_active: boolean;
  created_at: string;
}

export function MiningCompaniesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canCreate = canManageMiningRegistry(user);
  const [companies, setCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCompanies();
  }, [location.key]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(
        (data || []).map((company) => ({
          ...company,
          contact_person_email: company.contact_person_email ?? '',
          contact_person_phone: company.contact_person_phone ?? '',
          is_active: company.is_active ?? false,
          created_at: company.created_at ?? '',
        }))
      );
    } catch (error) {
      console.error('Erreur lors du chargement des sociétés minières :', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.abbreviation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Factory className="h-8 w-8 text-amber-700" />
              Sociétés minières
            </h1>
            <p className="text-gray-600 mt-1">
              Gérez les informations des sociétés minières et suivez leurs activités.
            </p>
          </div>
          {canCreate && <Button onClick={() => navigate('/stakeholders/mining-companies/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une société minière
          </Button>}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sociétés minières ({filteredCompanies.length})</CardTitle>
              <div className="w-80">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Rechercher une société…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto"></div>
                <p className="mt-4 text-gray-600">Chargement des sociétés…</p>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="py-12 text-center">
                <Factory className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Aucune société minière trouvée.</p>
                {canCreate && <Button
                  variant="outline"
                  onClick={() => navigate('/stakeholders/mining-companies/new')}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter la première société minière
                </Button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Société</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Localisation</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personne-ressource</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredCompanies.map((company) => (
                      <tr key={company.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Factory className="w-4 h-4 text-amber-700" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{company.name}</div>
                              {company.abbreviation && (
                                <div className="text-xs text-emerald-700">Nom usuel : {company.abbreviation}</div>
                              )}
                              {company.website && (
                                <a
                                  href={company.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <Globe className="w-3 h-3" />
                                  Site internet
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-mono text-gray-900">{company.code}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="flex items-start gap-1">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <div>{company.city}</div>
                              <div className="text-xs text-gray-500">{company.country}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {company.contact_person_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {company.contact_person_email || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            company.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {company.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/stakeholders/mining-companies/${company.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/stakeholders/mining-companies/${company.id}/edit`)}
                            >
                              <Edit className="w-4 h-4" />
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
    </MainLayout>
  );
}
