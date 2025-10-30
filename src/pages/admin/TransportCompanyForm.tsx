import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Truck, MapPin, Shield, FileText } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { InfoPanel, InfoPanelGroup } from '@/components/ui/InfoPanel';
import { supabase } from '@/lib/supabase';
import { useAlert } from '@/hooks/useAlert';
import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';

interface FormData {
  name: string;
  email: string;
  phone: string;
  company_type: 'mine_to_airport' | 'airport_to_refinery' | 'both';
  address: string;
  contact_person: string;
  is_active: boolean;
}

const companyTypeOptions = [
  { value: 'mine_to_airport', label: 'Mine to Airport' },
  { value: 'airport_to_refinery', label: 'Airport to Refinery' },
  { value: 'both', label: 'Both Routes' },
];

const statusOptions = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

export function TransportCompanyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const alert = useAlert();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    company_type: 'both',
    address: '',
    contact_person: '',
    is_active: true,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      loadCompany();
    }
  }, [id, isEditMode]);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transport_companies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name,
          email: data.email,
          phone: data.phone,
          company_type: data.company_type,
          address: data.address || '',
          contact_person: data.contact_person || '',
          is_active: data.is_active,
        });
      }
    } catch (error: any) {
      console.error('Error loading company:', error);
      alert.error('Error loading transport company');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.contact_person.trim()) {
      newErrors.contact_person = 'Contact person is required';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        company_type: formData.company_type,
        address: formData.address,
        contact_person: formData.contact_person,
        is_active: formData.is_active,
      };

      console.log('Submitting transport company data:', submitData);

      if (isEditMode && id) {
        console.log('Updating transport company with ID:', id);
        const { data, error } = await supabase
          .from('transport_companies')
          .update(submitData)
          .eq('id', id)
          .select();

        if (error) {
          console.error('Error updating transport company:', error);
          throw error;
        }
        console.log('Transport company updated successfully:', data);
        alert.success('Transport company updated successfully');
      } else {
        console.log('Inserting new transport company');
        const { data, error } = await supabase
          .from('transport_companies')
          .insert([submitData])
          .select();

        if (error) {
          console.error('Error inserting transport company:', error);
          throw error;
        }
        console.log('Transport company created successfully:', data);
        alert.success('Transport company created successfully');
      }

      setTimeout(() => {
        navigateWithAutoRefresh(navigate, '/admin/transport-companies');
      }, 1500);
    } catch (error: any) {
      console.error('Error saving transport company - Full error:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      alert.error(error.message || 'Error saving transport company');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/admin/transport-companies')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                {isEditMode ? 'Edit Transport Company' : 'New Transport Company'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isEditMode
                  ? 'Update transport company information'
                  : 'Add a new transport company to the system'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField label="Company Name" required error={errors.name}>
                        <Input
                          value={formData.name}
                          onChange={(e) => handleChange('name', e.target.value)}
                          error={!!errors.name}
                          placeholder="Enter company name"
                        />
                      </FormField>

                      <FormField label="Email Address" required error={errors.email}>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleChange('email', e.target.value)}
                          error={!!errors.email}
                          placeholder="company@example.com"
                        />
                      </FormField>

                      <FormField label="Phone Number" required error={errors.phone}>
                        <Input
                          value={formData.phone}
                          onChange={(e) => handleChange('phone', e.target.value)}
                          error={!!errors.phone}
                          placeholder="+XX XXX XXX XXXX"
                        />
                      </FormField>

                      <FormField label="Contact Person" required error={errors.contact_person}>
                        <Input
                          value={formData.contact_person}
                          onChange={(e) => handleChange('contact_person', e.target.value)}
                          error={!!errors.contact_person}
                          placeholder="Contact person name"
                        />
                      </FormField>

                      <FormField label="Company Type" required>
                        <Select
                          value={formData.company_type}
                          onChange={(e) =>
                            handleChange('company_type', e.target.value as FormData['company_type'])
                          }
                        >
                          {companyTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </FormField>

                      <FormField label="Status">
                        <Select
                          value={formData.is_active.toString()}
                          onChange={(e) => handleChange('is_active', e.target.value === 'true')}
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </FormField>

                      <FormField
                        label="Address"
                        required
                        error={errors.address}
                        className="md:col-span-2"
                      >
                        <Input
                          value={formData.address}
                          onChange={(e) => handleChange('address', e.target.value)}
                          error={!!errors.address}
                          placeholder="Full address"
                        />
                      </FormField>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/admin/transport-companies')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {isEditMode ? 'Update Company' : 'Create Company'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <InfoPanelGroup>
                <InfoPanel
                  title="Company Guidelines"
                  icon={Truck}
                  variant="blue"
                  items={[
                    { text: 'All fields marked with * are required' },
                    { text: 'Email will be used for notifications' },
                    { text: 'Select appropriate company type for operations' },
                    { text: 'Active companies appear in shipment selection' },
                  ]}
                />

                <InfoPanel
                  title="Transport Routes"
                  icon={MapPin}
                  variant="teal"
                  items={[
                    { text: 'Mine to Airport: Transport from mining sites to airport' },
                    { text: 'Airport to Refinery: Transport from airport to refinery' },
                    { text: 'Both Routes: Company handles all transport stages' },
                    { text: 'Route affects availability in shipment forms' },
                  ]}
                />

                <InfoPanel
                  title="Required Documents"
                  icon={FileText}
                  variant="green"
                  items={[
                    { text: 'Business registration certificate', icon: '✓' },
                    { text: 'Transport license and permits', icon: '✓' },
                    { text: 'Insurance coverage documents', icon: '✓' },
                    { text: 'Vehicle fleet information', icon: '✓' },
                  ]}
                />

                <InfoPanel
                  title="Security Requirements"
                  icon={Shield}
                  variant="amber"
                  items={[
                    { text: 'GPS tracking on all vehicles', icon: '⚠' },
                    { text: 'Security clearance for drivers', icon: '⚠' },
                    { text: 'Insurance minimum: $1M coverage', icon: '⚠' },
                    { text: 'Regular vehicle inspections required', icon: '⚠' },
                  ]}
                />
              </InfoPanelGroup>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
