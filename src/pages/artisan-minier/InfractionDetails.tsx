import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  FileText,
  Edit2,
  AlertTriangle,
  Eye,
  Download,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { artisanInfractionsService, ArtisanInfraction } from '@/services/artisanInfractionsService';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';

const TRAITEMENT_LABELS: Record<string, { label: string; color: string }> = {
  en_cours: { label: 'En Cours', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  cloture: { label: 'Clôturé', color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

const CONCLUSION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  reconnu: { label: 'Reconnu Coupable', color: 'bg-red-100 text-red-800 border-red-200', icon: '❌' },
  soupçonne: { label: 'Soupçonné', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '⚠️' },
  complice: { label: 'Complice', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '🤝' },
  innocente: { label: 'Innocenté', color: 'bg-green-100 text-green-800 border-green-200', icon: '✅' },
};

export default function InfractionDetails() {
  const navigate = useNavigate();
  const { artisanId, infractionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [infraction, setInfraction] = useState<ArtisanInfraction | null>(null);
  const { alertState, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    if (infractionId) {
      loadInfraction();
    }
  }, [infractionId]);

  const loadInfraction = async () => {
    try {
      setLoading(true);
      const data = await artisanInfractionsService.getById(infractionId!);
      setInfraction(data);
    } catch (error) {
      showError('Impossible de charger les détails de l\'infraction');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getFileIcon = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return 'image';
    }
    return 'file';
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-96">
          <Loading />
        </div>
      </MainLayout>
    );
  }

  if (!infraction) {
    return (
      <MainLayout>
        <Card className="p-8">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Infraction introuvable
            </h3>
            <Button onClick={() => navigate(`/artisan-minier/${artisanId}`)}>
              Retour au profil
            </Button>
          </div>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <CustomAlert {...alertState} onClose={closeAlert} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/artisan-minier/${artisanId}`)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Détails de l'Infraction
              </h1>
              <p className="text-gray-600 mt-1">
                {infraction.type_infraction}
              </p>
            </div>
          </div>
          <Button
            onClick={() =>
              navigate(`/artisan-minier/${artisanId}/infractions/${infractionId}/modifier`)
            }
          >
            <Edit2 className="w-5 h-5 mr-2" />
            Modifier
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" />
                Informations Générales
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Date de l'Infraction
                  </label>
                  <p className="text-base font-medium text-gray-900">
                    {formatDate(infraction.date_infraction)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Lieu
                  </label>
                  <p className="text-base font-medium text-gray-900">
                    {infraction.lieu || 'Non spécifié'}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    Type d'Infraction
                  </label>
                  <p className="text-base font-semibold text-red-700">
                    {infraction.type_infraction}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Description Détaillée
              </h3>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {infraction.description}
                </p>
              </div>
            </Card>

            {infraction.remarques && (
              <Card className="p-6 bg-blue-50 border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Remarques Complémentaires
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {infraction.remarques}
                </p>
              </Card>
            )}

            {/* Documents */}
            {infraction.documents && infraction.documents.length > 0 && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Documents & Preuves ({infraction.documents.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {infraction.documents.map((url, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                    >
                      {getFileIcon(url) === 'image' ? (
                        <img
                          src={url}
                          alt={`Document ${index + 1}`}
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                      ) : (
                        <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center mb-2">
                          <FileText className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => window.open(url, '_blank')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `document-${index + 1}`;
                            a.click();
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Statut du Traitement
              </h3>
              <div className="text-center">
                <span
                  className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full border ${
                    TRAITEMENT_LABELS[infraction.statut_traitement]?.color
                  }`}
                >
                  {TRAITEMENT_LABELS[infraction.statut_traitement]?.label}
                </span>
              </div>
            </Card>

            {infraction.conclusion && (
              <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Conclusion
                </h3>
                <div className="text-center">
                  <div className="text-4xl mb-3">
                    {CONCLUSION_LABELS[infraction.conclusion]?.icon}
                  </div>
                  <span
                    className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full border ${
                      CONCLUSION_LABELS[infraction.conclusion]?.color
                    }`}
                  >
                    {CONCLUSION_LABELS[infraction.conclusion]?.label}
                  </span>
                </div>
              </Card>
            )}

            {infraction.date_cloture && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Date de Clôture
                </h3>
                <div className="text-center">
                  <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-base font-medium text-gray-900">
                    {formatDate(infraction.date_cloture)}
                  </p>
                </div>
              </Card>
            )}

            <Card className="p-6 bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
              <h4 className="text-sm font-semibold text-red-900 mb-2">
                ⚠️ Métadonnées
              </h4>
              <div className="space-y-2 text-xs text-red-700">
                <p>
                  <strong>Créé le:</strong>{' '}
                  {formatDate(infraction.created_at)}
                </p>
                <p>
                  <strong>Modifié le:</strong>{' '}
                  {formatDate(infraction.updated_at)}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
