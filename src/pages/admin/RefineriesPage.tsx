import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Plus, Edit, Search, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Refinery {
  id: string;
  name: string;
  location: string;
  country: string;
  email: string;
  phone: string;
  contact_person: string | null;
  capacity_grams_per_month: number | null;
  is_active: boolean;
  created_at: string;
}

export function RefineriesPage() {
  const navigate = useNavigate();
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRefineries();
  }, []);

  const loadRefineries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('refineries')
        .select('*')
        .order('name');

      if (error) throw error;
      setRefineries(data || []);
    } catch (error: any) {
      console.error('Error loading refineries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRefineries = refineries.filter(refinery =>
    refinery.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    refinery.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    refinery.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCapacity = (grams: number | null) => {
    if (!grams) return 'N/A';
    return `${(grams / 1000).toFixed(1)} kg/month`;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Refinery Plants</h1>
            <p className="text-gray-600 mt-1">Manage refinery facilities for gold processing</p>
          </div>
          <Button onClick={() => navigate('/admin/refineries/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Refinery
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search refineries..."
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Refinery Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRefineries.map((refinery) => (
                      <tr key={refinery.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{refinery.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{refinery.location}</div>
                          <div className="text-xs text-gray-500">{refinery.country}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{refinery.contact_person || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{refinery.email}</div>
                          <div className="text-xs text-gray-500">{refinery.phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">
                            {formatCapacity(refinery.capacity_grams_per_month)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            refinery.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {refinery.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => navigate(`/admin/refineries/edit/${refinery.id}`)}
                            className="text-amber-600 hover:text-amber-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredRefineries.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No refineries found.</p>
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
