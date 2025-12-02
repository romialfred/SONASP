import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Save, X } from 'lucide-react';
import {
  DepositorCategory,
  DEPOSITOR_CATEGORIES,
  CreateDepositorInput,
  UpdateDepositorInput,
  Depositor,
} from '@/services/depositorService';

interface DepositorFormProps {
  depositor?: Depositor;
  miningCompanyId: string;
  onSubmit: (data: CreateDepositorInput | UpdateDepositorInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function DepositorForm({
  depositor,
  miningCompanyId,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: DepositorFormProps) {
  const [formData, setFormData] = useState<CreateDepositorInput>({
    mining_company_id: miningCompanyId,
    category: 'general_management' as DepositorCategory,
    full_name: '',
    job_title: '',
    telephone: '',
    cellphone: '',
    email: '',
    is_primary: false,
    is_backup: false,
    group_email: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (depositor) {
      setFormData({
        mining_company_id: depositor.mining_company_id,
        category: depositor.category,
        full_name: depositor.full_name,
        job_title: depositor.job_title,
        telephone: depositor.telephone || '',
        cellphone: depositor.cellphone || '',
        email: depositor.email,
        is_primary: depositor.is_primary,
        is_backup: depositor.is_backup,
        group_email: depositor.group_email || '',
        notes: depositor.notes || '',
      });
    }
  }, [depositor]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }

    if (!formData.job_title.trim()) {
      newErrors.job_title = 'Job title is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.telephone?.trim() && !formData.cellphone?.trim()) {
      newErrors.contact = 'At least one phone number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleChange = (
    field: keyof CreateDepositorInput,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value as DepositorCategory)}
                required
              >
                {Object.entries(DEPOSITOR_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                className={errors.full_name ? 'border-red-500' : ''}
                required
              />
              {errors.full_name && (
                <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Title <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.job_title}
                onChange={(e) => handleChange('job_title', e.target.value)}
                className={errors.job_title ? 'border-red-500' : ''}
                required
              />
              {errors.job_title && (
                <p className="mt-1 text-sm text-red-600">{errors.job_title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={errors.email ? 'border-red-500' : ''}
                required
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telephone
              </label>
              <Input
                type="tel"
                value={formData.telephone || ''}
                onChange={(e) => handleChange('telephone', e.target.value)}
                placeholder="+224 xxx xx xx xx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cellphone <span className="text-red-500">*</span>
              </label>
              <Input
                type="tel"
                value={formData.cellphone || ''}
                onChange={(e) => handleChange('cellphone', e.target.value)}
                className={errors.contact ? 'border-red-500' : ''}
                placeholder="+224 xxx xx xx xx"
              />
              {errors.contact && (
                <p className="mt-1 text-sm text-red-600">{errors.contact}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Email (Optional)
              </label>
              <Input
                type="email"
                value={formData.group_email || ''}
                onChange={(e) => handleChange('group_email', e.target.value)}
                placeholder="group@company.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                For group distribution lists
              </p>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center gap-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_primary}
                    onChange={(e) => handleChange('is_primary', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Primary Contact</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_backup}
                    onChange={(e) => handleChange('is_backup', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Backup Contact</span>
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <TextArea
                value={formData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                placeholder="Additional information..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Saving...' : depositor ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
