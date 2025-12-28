import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { ArtisanMinierFormWithTabs } from '@/components/artisan/ArtisanMinierFormWithTabs';
import { artisanMinierService } from '@/services/artisanMinierService';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';

export default function ArtisanMinierEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [artisan, setArtisan] = useState<any>(null);
  const { alertState, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    if (id) {
      loadArtisan();
    }
  }, [id]);

  const loadArtisan = async () => {
    try {
      setLoading(true);
      const data = await artisanMinierService.getById(id!);
      setArtisan(data);
    } catch (error: any) {
      console.error('Error loading artisan:', error);
      showError(error.message || 'Erreur lors du chargement de l\'artisan');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    navigate(`/artisan-minier/${id}`);
  };

  const handleCancel = () => {
    navigate(`/artisan-minier/${id}`);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loading />
        </div>
      </MainLayout>
    );
  }

  if (!artisan) {
    return (
      <MainLayout>
        <Card className="p-6">
          <p className="text-red-600">Artisan minier non trouvé</p>
          <Button onClick={() => navigate('/artisan-minier/liste')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la liste
          </Button>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Modifier Artisan Minier
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {artisan.numero_carte}
              </p>
            </div>
          </div>
        </div>

        <ArtisanMinierFormWithTabs
          artisan={artisan}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />

        <CustomAlert
          isOpen={alertState.isOpen}
          onClose={closeAlert}
          title={alertState.title}
          message={alertState.message}
          type={alertState.type}
        />
      </div>
    </MainLayout>
  );
}
