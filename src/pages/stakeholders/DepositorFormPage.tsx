import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { DepositorForm } from '@/components/depositors/DepositorForm';
import { Card } from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import { ArrowLeft, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  depositorService,
  Depositor,
  CreateDepositorInput,
  UpdateDepositorInput,
} from '@/services/depositorService';
import { useCustomAlert } from '@/hooks/useCustomAlert';

interface MiningCompany {
  id: string;
  name: string;
}

export function DepositorFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showSuccess, showError } = useCustomAlert();
  const [depositor, setDepositor] = useState<Depositor | undefined>();
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = Boolean(id);

  useEffect(() => {
    loadMiningCompanies();
    if (id) {
      loadDepositor(id);
    }
  }, [id]);

  const loadMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMiningCompanies(data || []);

      if (data && data.length > 0 && !id) {
        setSelectedCompanyId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading mining companies:', error);
      showError('Failed to load mining companies');
    }
  };

  const loadDepositor = async (depositorId: string) => {
    try {
      setLoading(true);
      const { data, error } = await depositorService.getDepositorById(depositorId);

      if (error) throw error;
      if (data) {
        setDepositor(data);
        setSelectedCompanyId(data.mining_company_id);
      }
    } catch (error: any) {
      console.error('Error loading depositor:', error);
      showError('Failed to load depositor');
      navigate('/stakeholders/depositors');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: CreateDepositorInput | UpdateDepositorInput) => {
    try {
      setIsSubmitting(true);

      if (isEditMode && id) {
        const { error } = await depositorService.updateDepositor(id, data);
        if (error) throw error;
        showSuccess('Depositor updated successfully');
      } else {
        const { error } = await depositorService.createDepositor(
          data as CreateDepositorInput
        );
        if (error) throw error;
        showSuccess('Depositor created successfully');
      }

      navigate('/stakeholders/depositors');
    } catch (error: any) {
      console.error('Error saving depositor:', error);
      showError(
        error.message || `Failed to ${isEditMode ? 'update' : 'create'} depositor`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/stakeholders/depositors');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/stakeholders/depositors')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditMode ? 'Edit Depositor' : 'New Depositor'}
              </h1>
              <p className="text-sm text-gray-600">
                {isEditMode
                  ? 'Update depositor contact information'
                  : 'Add a new depositor contact'}
              </p>
            </div>
          </div>
        </div>

        <Card>
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mining Company <span className="text-red-500">*</span>
            </label>
            <Select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              required
              disabled={isSubmitting}
            >
              <option value="">Select a company...</option>
              {miningCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
            {miningCompanies.length === 0 && (
              <p className="mt-2 text-sm text-amber-600">
                No mining companies found. Please create a mining company first.
              </p>
            )}
            {isEditMode && (
              <p className="mt-2 text-sm text-gray-600">
                You can change the mining company for this depositor.
              </p>
            )}
          </div>
        </Card>

        {selectedCompanyId && (
          <DepositorForm
            depositor={depositor}
            miningCompanyId={selectedCompanyId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </MainLayout>
  );
}
