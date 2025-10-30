import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Plus, Edit, Search, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TransportCompany {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_type: 'mine_to_airport' | 'airport_to_refinery' | 'both';
  address: string | null;
  contact_person: string | null;
  is_active: boolean;
  created_at: string;
}

export function TransportCompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<TransportCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      console.log('Loading transport companies from database...');
      const { data, error } = await supabase
        .from('transport_companies')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error loading transport companies:', error);
        throw error;
      }

      console.log(`Loaded ${data?.length || 0} transport companies:`, data);
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Error loading companies - Full error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCompanyTypeLabel = (type: string) => {
    switch (type) {
      case 'mine_to_airport': return 'Mine to Airport';
      case 'airport_to_refinery': return 'Airport to Refinery';
      case 'both': return 'Both';
      default: return type;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transport Companies</h1>
            <p className="text-gray-600 mt-1">Manage freight companies for gold shipments</p>
          </div>
          <Button onClick={() => navigate('/admin/transport-companies/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCompanies.map((company) => (
                      <tr key={company.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{company.name}</div>
                          {company.address && (
                            <div className="text-xs text-gray-500">{company.address}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{company.contact_person || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{company.email}</div>
                          <div className="text-xs text-gray-500">{company.phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{getCompanyTypeLabel(company.company_type)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            company.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {company.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => navigate(`/admin/transport-companies/edit/${company.id}`)}
                            className="text-amber-600 hover:text-amber-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredCompanies.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No transport companies found.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
