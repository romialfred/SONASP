import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Plus, X, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { MainLayout } from '@/components/layout/MainLayout';
import { NotificationDialog } from '@/components/ui/NotificationDialog';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { exportLicenseService, CreateLicenseData } from '@/services/exportLicenseService';
import { supabase } from '@/lib/supabase';
import { filterOperationalMiningCompanies } from '@/utils/miningCompanyFilters';
import { useAuth } from '@/contexts/AuthContext';
import { FieldGuidePanel } from '@/components/ui/FieldGuidePanel';

interface MiningCompany {
  id: string;
  name: string;
  code: string;
}

interface DocumentEntry {
  id: string;
  name: string;
  type: string;
  file?: File;
  fileUrl?: string;
}

interface FieldHelp {
  title: string;
  description: string;
  example?: string;
  tips?: string[];
}

const FIELD_HELP: Record<string, FieldHelp> = {
  license_number: {
    title: 'Numéro de Licence',
    description: 'Référence unique générée automatiquement.',
    example: 'EXP-SMD-2025-0001',
    tips: [
      'Format: EXP-[CODE]-[ANNÉE]-[NUMÉRO]',
      'Cliquez sur "Générer" pour créer automatiquement',
      'Unique dans le système'
    ]
  },
  mining_company: {
    title: 'Compagnie Minière',
    description: 'Société propriétaire de l’or à exporter.',
    tips: [
      'Sélectionnez la compagnie concernée',
      'Seules les compagnies actives sont listées',
      'Requis pour générer le numéro de licence'
    ]
  },
  request_date: {
    title: 'Date de Demande',
    description: 'Jour de dépôt de la demande.',
    tips: [
      'Généralement la date du jour',
      'Ne peut pas être dans le futur',
      'Important pour les délais administratifs'
    ]
  },
  issuing_institution: {
    title: 'Institution Émettrice',
    description: 'Autorité qui délivre la licence.',
    example: 'Ministère des Mines et de la Géologie',
    tips: [
      'Nom complet de l\'institution',
      'Vérifier l\'orthographe officielle',
      'Peut varier selon le pays'
    ]
  },
  start_date: {
    title: 'Date de Début',
    description: 'Premier jour de validité de la licence.',
    tips: [
      'Doit être après la date de demande',
      'Généralement la date d\'émission',
      'Définit le début de la période de validité'
    ]
  },
  end_date: {
    title: 'Date de Fin',
    description: 'Dernier jour de validité de la licence.',
    tips: [
      'Doit être après la date de début',
      'Durée typique: 6 à 12 mois',
      'Le système bloque les exportations après expiration'
    ]
  },
  authorized_quantity: {
    title: 'Quantité Autorisée',
    description: 'Poids maximal d’or autorisé à l’exportation.',
    example: '100,000 grammes = 100 kg',
    tips: [
      'Exprimé en grammes uniquement',
      'Doit être > 0',
      'Le système suit automatiquement l\'utilisation',
      'Alerte quand 90% utilisé'
    ]
  },
  average_price: {
    title: 'Prix Moyen de Vente',
    description: 'Prix de vente estimé en USD par gramme.',
    example: '75.50 USD/g',
    tips: [
      'Optionnel mais recommandé',
      'Base pour évaluation fiscale',
      'Référence: cours mondial de l\'or',
      'Peut être mis à jour si nécessaire'
    ]
  },
  comments: {
    title: 'Commentaires',
    description: 'Condition ou précision utile sur la licence.',
    tips: [
      'Champ libre et optionnel',
      'Restrictions spéciales',
      'Conditions d\'exportation',
      'Historique de modifications'
    ]
  },
  documents: {
    title: 'Documents Joints',
    description: 'Justificatifs associés à la licence.',
    tips: [
      'Plusieurs documents possibles',
      'Nom descriptif recommandé',
      'Type: licence, autorisation, annexe, etc.',
      'Facilite les audits et vérifications'
    ]
  }
};

export function ExportLicenseForm() {
  const { user } = useAuth();
  const mineCompanyId = user?.mining_company_id || null;
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [activeField, setActiveField] = useState<string>('license_number');

  // Dialog states
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorTitle, setErrorTitle] = useState('Erreur');

  // Form state
  const [formData, setFormData] = useState<CreateLicenseData>({
    license_number: '',
    mining_company_id: mineCompanyId || '',
    request_date: new Date().toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    issuing_institution: '',
    authorized_quantity_grams: 0,
    average_sale_price: 0,
    comments: '',
    notes: '',
  });
  const boundCompanyId = mineCompanyId || formData.mining_company_id;
  const mineName = mineCompanyId
    ? miningCompanies.find((company) => company.id === mineCompanyId)?.name || 'Votre société minière'
    : null;

  const [documents, setDocuments] = useState<DocumentEntry[]>([]);

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadMiningCompanies();

      if (isEditMode && id) {
        const licenceAccessible = await loadLicense(id);
        if (licenceAccessible) await loadDocuments(id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setErrorTitle('Erreur de chargement');
      setErrorMessage('Impossible de charger les données. Veuillez réessayer.');
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const loadMiningCompanies = async () => {
    let query = supabase
      .from('mining_companies')
      .select('id, name, code, company_type')
      .eq('is_active', true)
      .order('name');
    if (mineCompanyId) query = query.eq('id', mineCompanyId);
    const { data, error } = await query;

    if (error) throw error;

    // Exclure la société mère des sociétés opérationnelles
    setMiningCompanies(filterOperationalMiningCompanies(data || []));
  };

  const loadLicense = async (licenseId: string) => {
    const license = await exportLicenseService.getLicenseById(licenseId, mineCompanyId);
    if (license) {
      setFormData({
        license_number: license.license_number,
        mining_company_id: mineCompanyId || license.mining_company_id,
        request_date: license.request_date,
        start_date: license.start_date,
        end_date: license.end_date,
        issuing_institution: license.issuing_institution,
        authorized_quantity_grams: license.authorized_quantity_grams,
        average_sale_price: license.average_sale_price || 0,
        comments: license.comments || '',
        notes: license.notes || '',
      });
      return true;
    }
    return false;
  };

  const loadDocuments = async (licenseId: string) => {
    const docs = await exportLicenseService.getLicenseDocuments(licenseId);
    setDocuments(
      docs.map((doc) => ({
        id: doc.id,
        name: doc.document_name,
        type: doc.document_type || 'document',
      }))
    );
  };

  const handleGenerateLicenseNumber = async () => {
    if (!boundCompanyId) {
      setErrorTitle('Compagnie requise');
      setErrorMessage('Veuillez d\'abord sélectionner une compagnie minière pour générer le numéro de licence.');
      setShowErrorDialog(true);
      return;
    }

    const company = miningCompanies.find((c) => c.id === boundCompanyId);
    if (company) {
      const licenseNumber = await exportLicenseService.generateLicenseNumber(company.code);
      setFormData({ ...formData, license_number: licenseNumber });
    }
  };

  const handleAddDocument = () => {
    setDocuments([
      ...documents,
      {
        id: `temp-${Date.now()}`,
        name: '',
        type: 'license',
        file: undefined,
      },
    ]);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(documents.filter((doc) => doc.id !== id));
  };

  const handleDocumentChange = (id: string, field: 'name' | 'type', value: string) => {
    setDocuments(
      documents.map((doc) =>
        doc.id === id ? { ...doc, [field]: value } : doc
      )
    );
  };

  const handleFileChange = (id: string, file: File | null) => {
    setDocuments(
      documents.map((doc) =>
        doc.id === id ? { ...doc, file: file || undefined, name: file?.name || doc.name } : doc
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.license_number || !boundCompanyId) {
      setErrorTitle('Champs requis');
      setErrorMessage('Veuillez remplir tous les champs obligatoires (numéro de licence et compagnie minière).');
      setShowErrorDialog(true);
      return;
    }

    if (formData.authorized_quantity_grams <= 0) {
      setErrorTitle('Quantité invalide');
      setErrorMessage('La quantité autorisée doit être supérieure à 0 grammes.');
      setShowErrorDialog(true);
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setErrorTitle('Dates invalides');
      setErrorMessage('La date de fin doit être postérieure à la date de début.');
      setShowErrorDialog(true);
      return;
    }

    try {
      setSaving(true);
      const securedFormData = { ...formData, mining_company_id: boundCompanyId };

      let licenseId: string;

      if (isEditMode && id) {
        await exportLicenseService.updateLicense(id, securedFormData);
        licenseId = id;
      } else {
        const newLicense = await exportLicenseService.createLicense(securedFormData);
        licenseId = newLicense.id;
      }

      // Upload documents
      for (const doc of documents) {
        if (doc.id.startsWith('temp-') && doc.file && doc.name.trim()) {
          try {
            // Upload file to storage
            const fileExt = doc.file.name.split('.').pop();
            const fileName = `${licenseId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('export-license-documents')
              .upload(fileName, doc.file);

            if (uploadError) {
              console.error('Error uploading file:', uploadError);
              continue;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('export-license-documents')
              .getPublicUrl(fileName);

            // Save document record
            await exportLicenseService.addDocument({
              license_id: licenseId,
              document_name: doc.name,
              document_type: doc.type,
              file_url: publicUrl,
              file_path: fileName,
              file_size_kb: Math.round(doc.file.size / 1024),
            });
          } catch (error) {
            console.error('Error processing document:', error);
          }
        }
      }

      setShowSuccessDialog(true);
      setTimeout(() => {
        navigate('/production/licenses');
      }, 1500);
    } catch (error: any) {
      console.error('Error saving license:', error);
      setErrorTitle('Erreur de sauvegarde');
      setErrorMessage('Impossible de sauvegarder la licence: ' + (error.message || 'Erreur inconnue'));
      setShowErrorDialog(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Chargement...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex h-full">
        {/* Main Form Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Button
                onClick={() => navigate('/production/licenses')}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isEditMode ? 'Modifier la licence' : 'Nouvelle licence d\'exportation'}
                </h1>
                <p className="text-sm text-gray-600">
                  Autorisation, période et quantité exportable.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Informations de Base */}
              <Card className="p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Informations de Base
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  {/* Numéro de Licence */}
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                      onMouseEnter={() => setActiveField('license_number')}
                    >
                      Numéro de Licence *
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.license_number}
                        onChange={(e) =>
                          setFormData({ ...formData, license_number: e.target.value })
                        }
                        onFocus={() => setActiveField('license_number')}
                        placeholder="EXP-XXX-2025-0001"
                        required
                      />
                      <Button
                        type="button"
                        onClick={handleGenerateLicenseNumber}
                        variant="outline"
                        size="sm"
                      >
                        Générer
                      </Button>
                    </div>
                  </div>

                  {mineCompanyId ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-emerald-700">Périmètre de la licence</span>
                      <strong className="mt-1 block text-sm text-emerald-950">{mineName}</strong>
                      <small className="mt-1 block text-xs text-emerald-700">Société fixée par le compte connecté</small>
                    </div>
                  ) : (
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                      onMouseEnter={() => setActiveField('mining_company')}
                    >
                      Compagnie Minière *
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                    </label>
                    <select
                      value={formData.mining_company_id}
                      onChange={(e) =>
                        setFormData({ ...formData, mining_company_id: e.target.value })
                      }
                      onFocus={() => setActiveField('mining_company')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">-- Sélectionner --</option>
                      {miningCompanies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name} ({company.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  )}

                  {/* Date de Demande */}
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                      onMouseEnter={() => setActiveField('request_date')}
                    >
                      Date de Demande *
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                    </label>
                    <Input
                      type="date"
                      value={formData.request_date}
                      onChange={(e) =>
                        setFormData({ ...formData, request_date: e.target.value })
                      }
                      onFocus={() => setActiveField('request_date')}
                      required
                    />
                  </div>

                  {/* Institution Émettrice */}
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                      onMouseEnter={() => setActiveField('issuing_institution')}
                    >
                      Institution Émettrice *
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                    </label>
                    <Input
                      value={formData.issuing_institution}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          issuing_institution: e.target.value,
                        })
                      }
                      onFocus={() => setActiveField('issuing_institution')}
                      placeholder="Ministère des Mines..."
                      required
                    />
                  </div>

                  {/* Date de Début */}
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                      onMouseEnter={() => setActiveField('start_date')}
                    >
                      Date de Début *
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                    </label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                      onFocus={() => setActiveField('start_date')}
                      required
                    />
                  </div>

                  {/* Date de Fin */}
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                      onMouseEnter={() => setActiveField('end_date')}
                    >
                      Date de Fin *
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                    </label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                      onFocus={() => setActiveField('end_date')}
                      required
                    />
                  </div>

                  {/* Quantité Autorisée */}
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                      onMouseEnter={() => setActiveField('authorized_quantity')}
                    >
                      Quantité Autorisée (grammes) *
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.authorized_quantity_grams}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          authorized_quantity_grams: parseFloat(e.target.value) || 0,
                        })
                      }
                      onFocus={() => setActiveField('authorized_quantity')}
                      required
                    />
                  </div>

                  {/* Prix Moyen */}
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                      onMouseEnter={() => setActiveField('average_price')}
                    >
                      Prix Moyen de Vente (USD/g)
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.average_sale_price || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          average_sale_price: parseFloat(e.target.value) || 0,
                        })
                      }
                      onFocus={() => setActiveField('average_price')}
                    />
                  </div>
                </div>

                {/* Commentaires */}
                <div className="mt-4">
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                    onMouseEnter={() => setActiveField('comments')}
                  >
                    Commentaires
                    <HelpCircle className="w-4 h-4 text-blue-500" />
                  </label>
                  <TextArea
                    value={formData.comments || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, comments: e.target.value })
                    }
                    onFocus={() => setActiveField('comments')}
                    placeholder="Commentaires supplémentaires..."
                    rows={3}
                  />
                </div>
              </Card>

              {/* Documents */}
              <Card className="p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="flex items-center gap-2"
                    onMouseEnter={() => setActiveField('documents')}
                  >
                    <h2 className="text-lg font-bold text-gray-900">Documents</h2>
                    <HelpCircle className="w-5 h-5 text-blue-500" />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddDocument}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter Document
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun document ajouté</p>
                    <p className="text-sm">Cliquez sur "Ajouter Document" pour commencer</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex gap-3 items-start">
                          {/* File Upload */}
                          <div className="flex-1 space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Fichier *
                              </label>
                              <input
                                type="file"
                                onChange={(e) => handleFileChange(doc.id, e.target.files?.[0] || null)}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                required={doc.id.startsWith('temp-')}
                              />
                              {doc.file && (
                                <p className="text-xs text-green-600 mt-1">
                                  ✓ {doc.file.name} ({Math.round(doc.file.size / 1024)} KB)
                                </p>
                              )}
                              {doc.fileUrl && !doc.file && (
                                <p className="text-xs text-blue-600 mt-1">
                                  ✓ Document existant
                                </p>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Nom du document
                                </label>
                                <Input
                                  value={doc.name}
                                  onChange={(e) =>
                                    handleDocumentChange(doc.id, 'name', e.target.value)
                                  }
                                  placeholder="Ex: Licence officielle"
                                  className="text-sm"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Type
                                </label>
                                <select
                                  value={doc.type}
                                  onChange={(e) =>
                                    handleDocumentChange(doc.id, 'type', e.target.value)
                                  }
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  required
                                >
                                  <option value="license">Licence</option>
                                  <option value="authorization">Autorisation</option>
                                  <option value="certificate">Certificat</option>
                                  <option value="annex">Annexe</option>
                                  <option value="other">Autre</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Remove Button */}
                          <Button
                            type="button"
                            onClick={() => handleRemoveDocument(doc.id)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 mt-5"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => navigate('/production/licenses')}
                  variant="outline"
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div className="w-80 border-l border-gray-200 bg-slate-50 p-4">
          <FieldGuidePanel
            title="Champs du formulaire"
            fieldGuides={FIELD_HELP}
            activeField={activeField}
            excludeFields={mineCompanyId ? ['mining_company'] : []}
          />
        </div>
      </div>

      {/* Success Dialog */}
      <NotificationDialog
        isOpen={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}
        type="success"
        title={isEditMode ? "Licence Mise à Jour" : "Licence Créée"}
        message={
          isEditMode
            ? "La licence d'exportation a été mise à jour avec succès."
            : "La nouvelle licence d'exportation a été créée avec succès."
        }
      />

      {/* Error Dialog */}
      <ErrorDialog
        isOpen={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        title={errorTitle}
        message={errorMessage}
      />
    </MainLayout>
  );
}
