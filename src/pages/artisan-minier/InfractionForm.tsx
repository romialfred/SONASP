import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  Calendar,
  MapPin,
  FileText,
  Upload,
  X,
  Image as ImageIcon,
  File,
  Eye,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import {
  artisanInfractionsService,
  CreateInfractionData,
  StatutTraitementInfraction,
  ConclusionInfraction,
} from '@/services/artisanInfractionsService';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';

const TYPE_INFRACTIONS = [
  'Non-déclaration de production',
  'Vente illégale',
  'Exploitation sans autorisation',
  'Non-respect des normes environnementales',
  'Travail des enfants',
  'Conditions de travail dangereuses',
  'Non-paiement des taxes',
  'Falsification de documents',
  'Trafic illégal',
  'Autre',
];

interface UploadedFile {
  file: File;
  preview: string;
  url?: string;
}

export default function InfractionForm() {
  const navigate = useNavigate();
  const { artisanId, infractionId } = useParams();
  const isEditMode = Boolean(infractionId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [formData, setFormData] = useState<CreateInfractionData>({
    artisan_id: artisanId || '',
    date_infraction: new Date().toISOString().split('T')[0],
    type_infraction: '',
    description: '',
    lieu: '',
    statut_traitement: 'en_cours' as StatutTraitementInfraction,
    conclusion: undefined,
    remarques: '',
    documents: [],
    date_cloture: undefined,
  });

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [customType, setCustomType] = useState('');
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    if (isEditMode && infractionId) {
      loadInfraction();
    }
  }, [isEditMode, infractionId]);

  const loadInfraction = async () => {
    try {
      setLoading(true);
      const data = await artisanInfractionsService.getById(infractionId!);
      if (data) {
        setFormData({
          artisan_id: data.artisan_id,
          date_infraction: data.date_infraction,
          type_infraction: data.type_infraction,
          description: data.description,
          lieu: data.lieu,
          statut_traitement: data.statut_traitement,
          conclusion: data.conclusion,
          remarques: data.remarques,
          documents: data.documents,
          date_cloture: data.date_cloture,
        });
      }
    } catch (error) {
      showError('Impossible de charger l\'infraction');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: UploadedFile[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setUploadedFiles([...uploadedFiles, ...newFiles]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...uploadedFiles];
    URL.revokeObjectURL(newFiles[index].preview);
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
  };

  const uploadFiles = async () => {
    const uploadedUrls: string[] = [];

    try {
      setUploadingFiles(true);
      for (const fileObj of uploadedFiles) {
        if (!fileObj.url) {
          const url = await artisanInfractionsService.uploadDocument(
            fileObj.file,
            formData.artisan_id
          );
          uploadedUrls.push(url);
        } else {
          uploadedUrls.push(fileObj.url);
        }
      }
      return uploadedUrls;
    } catch (error) {
      throw new Error('Erreur lors de l\'upload des fichiers');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.type_infraction) {
      showError('Veuillez sélectionner un type d\'infraction');
      return;
    }

    if (!formData.description) {
      showError('Veuillez fournir une description');
      return;
    }

    try {
      setSaving(true);

      let documentUrls: string[] = formData.documents || [];
      if (uploadedFiles.length > 0) {
        documentUrls = await uploadFiles();
      }

      const dataToSave = {
        ...formData,
        documents: documentUrls,
        type_infraction:
          formData.type_infraction === 'Autre' && customType
            ? customType
            : formData.type_infraction,
      };

      if (isEditMode && infractionId) {
        await artisanInfractionsService.update(infractionId, dataToSave);
        showSuccess('Infraction mise à jour avec succès');
      } else {
        await artisanInfractionsService.create(dataToSave);
        showSuccess('Infraction enregistrée avec succès');
      }

      setTimeout(() => {
        navigate(`/artisan-minier/${artisanId}`);
      }, 1500);
    } catch (error: any) {
      showError(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
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
                {isEditMode ? 'Modifier' : 'Nouvelle'} Infraction
              </h1>
              <p className="text-gray-600 mt-1">
                Enregistrer un manquement ou une infraction
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Détails de l'Infraction
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Date de l'Infraction *
                      </label>
                      <Input
                        type="date"
                        value={formData.date_infraction}
                        onChange={(e) =>
                          setFormData({ ...formData, date_infraction: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <MapPin className="w-4 h-4 inline mr-2" />
                        Lieu
                      </label>
                      <Input
                        type="text"
                        value={formData.lieu || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, lieu: e.target.value })
                        }
                        placeholder="Site, village, localité..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type d'Infraction *
                    </label>
                    <select
                      value={formData.type_infraction}
                      onChange={(e) =>
                        setFormData({ ...formData, type_infraction: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      required
                    >
                      <option value="">Sélectionner un type</option>
                      {TYPE_INFRACTIONS.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.type_infraction === 'Autre' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Précisez le type d'infraction *
                      </label>
                      <Input
                        type="text"
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value)}
                        placeholder="Décrivez le type d'infraction..."
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Description Détaillée *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Décrivez en détail les faits constatés, les circonstances, les témoignages, etc."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Remarques Complémentaires
                    </label>
                    <textarea
                      value={formData.remarques || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, remarques: e.target.value })
                      }
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Notes, observations, recommandations..."
                    />
                  </div>
                </div>
              </Card>

              {/* Documents Upload */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Documents & Preuves
                </h3>

                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileSelect}
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Cliquez pour uploader ou glissez-déposez
                      </p>
                      <p className="text-xs text-gray-500">
                        Images, PDF, Word (max 10 MB par fichier)
                      </p>
                    </label>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {uploadedFiles.map((fileObj, index) => (
                        <div
                          key={index}
                          className="relative group border border-gray-200 rounded-lg p-2 hover:shadow-md transition-shadow"
                        >
                          {fileObj.file.type.startsWith('image/') ? (
                            <img
                              src={fileObj.preview}
                              alt={`Preview ${index}`}
                              className="w-full h-32 object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center">
                              <File className="w-12 h-12 text-gray-400" />
                            </div>
                          )}
                          <p className="text-xs text-gray-600 mt-2 truncate">
                            {fileObj.file.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Traitement
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Statut du Traitement *
                    </label>
                    <select
                      value={formData.statut_traitement}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          statut_traitement: e.target.value as StatutTraitementInfraction,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      required
                    >
                      <option value="en_cours">En Cours</option>
                      <option value="cloture">Clôturé</option>
                    </select>
                  </div>

                  {formData.statut_traitement === 'cloture' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date de Clôture
                        </label>
                        <Input
                          type="date"
                          value={formData.date_cloture || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, date_cloture: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Conclusion *
                        </label>
                        <select
                          value={formData.conclusion || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              conclusion: e.target.value as ConclusionInfraction,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          required
                        >
                          <option value="">Sélectionner</option>
                          <option value="reconnu">Reconnu</option>
                          <option value="soupçonne">Soupçonné</option>
                          <option value="complice">Complice</option>
                          <option value="innocente">Innocenté</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
                <h4 className="text-sm font-semibold text-red-900 mb-2">
                  ⚠️ Information Importante
                </h4>
                <p className="text-xs text-red-700">
                  L'enregistrement d'une infraction est un acte sérieux. Assurez-vous
                  d'avoir vérifié tous les faits et de disposer de preuves suffisantes.
                </p>
              </Card>

              {/* Actions */}
              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || uploadingFiles}
                >
                  {saving || uploadingFiles ? (
                    <>
                      <Loading />
                      {uploadingFiles ? 'Upload en cours...' : 'Enregistrement...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      {isEditMode ? 'Mettre à Jour' : 'Enregistrer l\'Infraction'}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/artisan-minier/${artisanId}`)}
                  disabled={saving || uploadingFiles}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
