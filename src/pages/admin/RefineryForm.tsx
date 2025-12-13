import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Factory, MapPin, TrendingUp, FileText } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { InfoPanel, InfoPanelGroup } from '@/components/ui/InfoPanel';
import { COUNTRIES } from '@/constants/countries';
import { supabase } from '@/lib/supabase';
import { useAlert } from '@/hooks/useAlert';
import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';

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

const statusOptions = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

export function RefineryForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const alert = useAlert();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    location: '',
    country: '',
    email: '',
    phone: '',
    contact_person: '',
    capacity_grams_per_month: '',
    is_active: true,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      loadRefinery();
    }
  }, [id, isEditMode]);

  const loadRefinery = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('refineries')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name,
          location: data.location,
          country: data.country,
          email: data.email,
          phone: data.phone,
          contact_person: data.contact_person || '',
          capacity_grams_per_month: data.capacity_grams_per_month?.toString() || '',
          is_active: data.is_active,
        });
      }
    } catch (error: any) {
      console.error('Error loading refinery:', error);
      alert.error('Error loading refinery');
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
      newErrors.name = 'Refinery name is required';
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

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!formData.country) {
      newErrors.country = 'Country is required';
    }

    if (formData.capacity_grams_per_month) {
      const capacity = parseFloat(formData.capacity_grams_per_month);
      if (isNaN(capacity) || capacity < 0) {
        newErrors.capacity_grams_per_month = 'Valid capacity is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = {
        name: formData.name,
        location: formData.location,
        country: formData.country,
        email: formData.email,
        phone: formData.phone,
        contact_person: formData.contact_person,
        capacity_grams_per_month: formData.capacity_grams_per_month
          ? parseFloat(formData.capacity_grams_per_month)
          : null,
        is_active: formData.is_active,
      };

      if (isEditMode && id) {
        const { error } = await supabase
          .from('refineries')
          .update(submitData)
          .eq('id', id);

        if (error) throw error;
        alert.success('Refinery updated successfully');
      } else {
        const { error } = await supabase.from('refineries').insert([submitData]);

        if (error) throw error;
        alert.success('Refinery created successfully');
      }

      setTimeout(() => {
        navigateWithAutoRefresh(navigate, '/admin/refineries');
      }, 1500);
    } catch (error: any) {
      console.error('Error saving refinery:', error);
      alert.error(error.message || 'Error saving refinery');
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
            <Button variant="outline" onClick={() => navigate('/admin/refineries')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                {isEditMode ? 'Edit Refinery Plant' : 'New Refinery Plant'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isEditMode
                  ? 'Update refinery plant information'
                  : 'Add a new refinery plant to the system'}
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
                    <CardTitle>Refinery Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField label="Refinery Name" required error={errors.name}>
                        <Input
                          value={formData.name}
                          onChange={(e) => handleChange('name', e.target.value)}
                          error={!!errors.name}
                          placeholder="Enter refinery name"
                        />
                      </FormField>

                      <FormField label="Email Address" required error={errors.email}>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleChange('email', e.target.value)}
                          error={!!errors.email}
                          placeholder="refinery@example.com"
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

                      <FormField label="Location (City)" required error={errors.location}>
                        <Input
                          value={formData.location}
                          onChange={(e) => handleChange('location', e.target.value)}
                          error={!!errors.location}
                          placeholder="City name"
                        />
                      </FormField>

                      <FormField label="Country" required error={errors.country}>
                        <Select
                          value={formData.country}
                          onChange={(e) => handleChange('country', e.target.value)}
                          error={!!errors.country}
                        >
                          <option value="">Select a country</option>
                          {COUNTRIES.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </Select>
                      </FormField>

                      <FormField
                        label="Capacity (grams/month)"
                        error={errors.capacity_grams_per_month}
                      >
                        <Input
                          type="number"
                          value={formData.capacity_grams_per_month}
                          onChange={(e) => handleChange('capacity_grams_per_month', e.target.value)}
                          error={!!errors.capacity_grams_per_month}
                          placeholder="Monthly processing capacity"
                          min="0"
                        />
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
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/admin/refineries')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {isEditMode ? 'Update Refinery' : 'Create Refinery'}
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
                  title="Refinery Guidelines"
                  icon={Factory}
                  variant="purple"
                  items={[
                    { text: 'All fields marked with * are required' },
                    { text: 'Email will be used for batch notifications' },
                    { text: 'Capacity helps with planning and allocation' },
                    { text: 'Active refineries appear in selection lists' },
                  ]}
                />

                <InfoPanel
                  title="Processing Capacity"
                  icon={TrendingUp}
                  variant="blue"
                  items={[
                    { text: 'Monthly capacity in grams of gold' },
                    { text: 'Used for workload distribution' },
                    { text: 'Updated based on operational changes' },
                    { text: 'Helps prevent overloading facilities' },
                  ]}
                />

                <InfoPanel
                  title="Location Details"
                  icon={MapPin}
                  variant="teal"
                  items={[
                    { text: 'City and country required for logistics' },
                    { text: 'Affects transportation routing' },
                    { text: 'Determines customs and regulations' },
                    { text: 'Used for delivery time calculations' },
                  ]}
                />

                <InfoPanel
                  title="Required Certifications"
                  icon={FileText}
                  variant="green"
                  items={[
                    { text: 'ISO 9001 quality management', icon: '✓' },
                    { text: 'Environmental compliance certificates', icon: '✓' },
                    { text: 'Precious metals handling license', icon: '✓' },
                    { text: 'Safety and security certifications', icon: '✓' },
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
