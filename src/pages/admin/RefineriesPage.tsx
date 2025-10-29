import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Plus, Edit, Search, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAlert } from '@/hooks/useAlert';

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

interface FormData {
  name: string;
  location: string;
  country: string;
  email: string;
  phone: string;
  contact_person: string;
  capacity_grams_per_month: string;
  is_active: boolean;
}

export function RefineriesPage() {
  const alert = useAlert();
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRefinery, setEditingRefinery] = useState<Refinery | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    location: '',
    country: 'GN',
    email: '',
    phone: '',
    contact_person: '',
    capacity_grams_per_month: '',
    is_active: true,
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [submitting, setSubmitting] = useState(false);

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

  const handleAdd = () => {
    setEditingRefinery(null);
    setFormData({
      name: '',
      location: '',
      country: 'GN',
      email: '',
      phone: '',
      contact_person: '',
      capacity_grams_per_month: '',
      is_active: true,
    });
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = (refinery: Refinery) => {
    setEditingRefinery(refinery);
    setFormData({
      name: refinery.name,
      location: refinery.location,
      country: refinery.country,
      email: refinery.email,
      phone: refinery.phone,
      contact_person: refinery.contact_person || '',
      capacity_grams_per_month: refinery.capacity_grams_per_month?.toString() || '',
      is_active: refinery.is_active,
    });
    setErrors({});
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) newErrors.name = 'Refinery name is required';
    if (!formData.location.trim()) newErrors.location = 'Location is required';
    if (!formData.country) newErrors.country = 'Country is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      const data = {
        ...formData,
        capacity_grams_per_month: formData.capacity_grams_per_month ? parseFloat(formData.capacity_grams_per_month) : null,
      };

      if (editingRefinery) {
        const { error } = await supabase
          .from('refineries')
          .update(data)
          .eq('id', editingRefinery.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('refineries')
          .insert([data]);

        if (error) throw error;
      }

      await loadRefineries();
      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving refinery:', error);
      alert.error('Error: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getCountryName = (code: string) => {
    const countries: Record<string, string> = {
      GN: 'Guinea',
      CI: 'Côte d\'Ivoire',
      ML: 'Mali',
    };
    return countries[code] || code;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Refineries</h1>
            <p className="text-gray-600 mt-1">Manage gold processing refineries</p>
          </div>
          <Button onClick={handleAdd} className="gap-2">
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
                          <div className="text-xs text-gray-500">{getCountryName(refinery.country)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{refinery.contact_person || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{refinery.email}</div>
                          <div className="text-xs text-gray-500">{refinery.phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {refinery.capacity_grams_per_month
                              ? `${refinery.capacity_grams_per_month.toLocaleString()}g/mo`
                              : 'N/A'}
                          </div>
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
                            onClick={() => handleEdit(refinery)}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {editingRefinery ? 'Edit Refinery' : 'Add Refinery'}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <FormField label="Refinery Name" required error={errors.name}>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter refinery name"
                error={!!errors.name}
              />
            </FormField>

            <FormField label="Location" required error={errors.location}>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City, District"
                error={!!errors.location}
              />
            </FormField>

            <FormField label="Country" required error={errors.country}>
              <Select
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                error={!!errors.country}
              >
                <option value="GN">Guinea</option>
                <option value="CI">Côte d'Ivoire</option>
                <option value="ML">Mali</option>
              </Select>
            </FormField>

            <FormField label="Email" required error={errors.email}>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="refinery@example.com"
                error={!!errors.email}
              />
            </FormField>

            <FormField label="Phone" required error={errors.phone}>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+000-000-000-000"
                error={!!errors.phone}
              />
            </FormField>

            <FormField label="Contact Person">
              <Input
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Enter contact person name"
              />
            </FormField>

            <FormField label="Capacity (grams per month)">
              <Input
                type="number"
                value={formData.capacity_grams_per_month}
                onChange={(e) => setFormData({ ...formData, capacity_grams_per_month: e.target.value })}
                placeholder="e.g., 50000"
              />
            </FormField>

            <FormField label="Status">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </FormField>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {editingRefinery ? 'Update' : 'Create'}
          </Button>
        </ModalFooter>
      </Modal>
    </MainLayout>
  );
}
