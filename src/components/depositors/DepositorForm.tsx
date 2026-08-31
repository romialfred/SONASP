import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Save, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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

  // Update formData when miningCompanyId prop changes
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      mining_company_id: miningCompanyId,
    }));
  }, [miningCompanyId]);

  // Update formData when depositor is loaded (edit mode)
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
        is_primary: depositor.is_primary ?? false,
        is_backup: depositor.is_backup ?? false,
        group_email: depositor.group_email || '',
        notes: depositor.notes || '',
      });
    }
  }, [depositor]);

  const checkForDuplicate = async (): Promise<boolean> => {
    try {
      // Normalize the name for comparison (lowercase and trim)
      const normalizedName = formData.full_name.trim().toLowerCase();

      // Get all depositors for this company and category
      const { data, error } = await supabase
        .from('depositors')
        .select('id, full_name')
        .eq('mining_company_id', formData.mining_company_id)
        .eq('category', formData.category)
        .eq('is_active', true);

      if (error) throw error;

      // Check for exact match (case-insensitive)
      const duplicates = data?.filter(d => {
        const isCurrentDepositor = d.id === depositor?.id;
        const nameMatches = d.full_name.trim().toLowerCase() === normalizedName;
        return !isCurrentDepositor && nameMatches;
      }) || [];

      if (duplicates.length > 0) {
        setErrors({
          ...errors,
          full_name: 'Cette personne possède déjà ce rôle dans la société.',
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return false;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Le nom complet est requis';
    }

    if (!formData.job_title.trim()) {
      newErrors.job_title = 'La fonction est requise';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Le courriel est requis';
    } else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(formData.email)) {
      newErrors.email = 'Le format du courriel est invalide';
    }

    if (!formData.telephone?.trim() && !formData.cellphone?.trim()) {
      newErrors.contact = 'Au moins un numéro de téléphone est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check for duplicates before submitting
    const isDuplicate = await checkForDuplicate();
    if (isDuplicate) {
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

    // Clear errors for the changed field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // If category or mining_company_id changes, also clear full_name error
    // since the duplicate check depends on these
    if ((field === 'category' || field === 'mining_company_id') && errors.full_name) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.full_name;
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <div className="p-6 space-y-6">
          {errors.full_name && errors.full_name.includes('déjà ce rôle') && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-800">Dépositaire déjà enregistré</h3>
                  <p className="text-sm text-amber-700 mt-1">{errors.full_name}</p>
                  <p className="text-xs text-amber-600 mt-2">
                    Une même personne ne peut pas être enregistrée deux fois avec la même responsabilité.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rôle <span className="text-red-500">*</span>
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
                Nom complet <span className="text-red-500">*</span>
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
                Fonction <span className="text-red-500">*</span>
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
                Téléphone
              </label>
              <Input
                type="tel"
                value={formData.telephone || ''}
                onChange={(e) => handleChange('telephone', e.target.value)}
                placeholder="+226 00 00 00 00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone mobile <span className="text-red-500">*</span>
              </label>
              <Input
                type="tel"
                value={formData.cellphone || ''}
                onChange={(e) => handleChange('cellphone', e.target.value)}
                className={errors.contact ? 'border-red-500' : ''}
                placeholder="+226 00 00 00 00"
              />
              {errors.contact && (
                <p className="mt-1 text-sm text-red-600">{errors.contact}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Courriel du groupe (facultatif)
              </label>
              <Input
                type="email"
                value={formData.group_email || ''}
                onChange={(e) => handleChange('group_email', e.target.value)}
                placeholder="groupe@entreprise.bf"
              />
              <p className="mt-1 text-xs text-gray-500">
                Pour une liste de diffusion partagée
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
                  <span className="ml-2 text-sm text-gray-700">Contact principal</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_backup}
                    onChange={(e) => handleChange('is_backup', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Contact suppléant</span>
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
                placeholder="Informations complémentaires…"
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
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Enregistrement…' : depositor ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
