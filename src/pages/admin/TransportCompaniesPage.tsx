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

interface FormData {
  name: string;
  email: string;
  phone: string;
  company_type: 'mine_to_airport' | 'airport_to_refinery' | 'both';
  address: string;
  contact_person: string;
  is_active: boolean;
}

export function TransportCompaniesPage() {
  const [companies, setCompanies] = useState<TransportCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<TransportCompany | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    company_type: 'both',
    address: '',
    contact_person: '',
    is_active: true,
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transport_companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = () => {
    setEditingCompany(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      company_type: 'both',
      address: '',
      contact_person: '',
      is_active: true,
    });
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = (company: TransportCompany) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      email: company.email,
      phone: company.phone,
      company_type: company.company_type,
      address: company.address || '',
      contact_person: company.contact_person || '',
      is_active: company.is_active,
    });
    setErrors({});
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) newErrors.name = 'Company name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    if (!formData.company_type) newErrors.company_type = 'Company type is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      if (editingCompany) {
        const { error } = await supabase
          .from('transport_companies')
          .update(formData)
          .eq('id', editingCompany.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transport_companies')
          .insert([formData]);

        if (error) throw error;
      }

      await loadCompanies();
      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving company:', error);
      alert('Error: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

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
          <Button onClick={handleAdd} className="gap-2">
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
                            onClick={() => handleEdit(company)}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {editingCompany ? 'Edit Transport Company' : 'Add Transport Company'}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <FormField label="Company Name" required error={errors.name}>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter company name"
                error={!!errors.name}
              />
            </FormField>

            <FormField label="Email" required error={errors.email}>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="company@example.com"
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

            <FormField label="Company Type" required error={errors.company_type}>
              <Select
                value={formData.company_type}
                onChange={(e) => setFormData({ ...formData, company_type: e.target.value as any })}
                error={!!errors.company_type}
              >
                <option value="mine_to_airport">Mine to Airport</option>
                <option value="airport_to_refinery">Airport to Refinery</option>
                <option value="both">Both</option>
              </Select>
            </FormField>

            <FormField label="Contact Person">
              <Input
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Enter contact person name"
              />
            </FormField>

            <FormField label="Address">
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter company address"
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
            {editingCompany ? 'Update' : 'Create'}
          </Button>
        </ModalFooter>
      </Modal>
    </MainLayout>
  );
}
