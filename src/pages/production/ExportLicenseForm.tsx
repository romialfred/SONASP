import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Plus, X, HelpCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { MainLayout } from '@/components/layout/MainLayout';
import { exportLicenseService, CreateLicenseData } from '@/services/exportLicenseService';
import { supabase } from '@/lib/supabase';

interface MiningCompany {
  id: string;
  name: string;
  code: string;
}

interface DocumentEntry {
  id: string;
  name: string;
  type: string;
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
    description: 'Identifiant unique de la licence d\'exportation généré automatiquement selon le format standard.',
    example: 'EXP-SMD-2025-0001',
    tips: [
      'Format: EXP-[CODE]-[ANNÉE]-[NUMÉRO]',
      'Cliquez sur "Générer" pour créer automatiquement',
      'Unique dans le système'
    ]
  },
  mining_company: {
    title: 'Compagnie Minière',
    description: 'La société propriétaire de la production d\'or qui demande l\'autorisation d\'exportation.',
    tips: [
      'Sélectionnez la compagnie concernée',
      'Seules les compagnies actives sont listées',
      'Requis pour générer le numéro de licence'
    ]
  },
  request_date: {
    title: 'Date de Demande',
    description: 'Date à laquelle la demande de licence d\'exportation a été officiellement soumise aux autorités.',
    tips: [
      'Généralement la date du jour',
      'Ne peut pas être dans le futur',
      'Important pour les délais administratifs'
    ]
  },
  issuing_institution: {
    title: 'Institution Émettrice',
    description: 'Organisme gouvernemental ou autorité qui délivre la licence d\'exportation.',
    example: 'Ministère des Mines et de la Géologie',
    tips: [
      'Nom complet de l\'institution',
      'Vérifier l\'orthographe officielle',
      'Peut varier selon le pays'
    ]
  },
  start_date: {
    title: 'Date de Début',
    description: 'Date à partir de laquelle la licence devient valide et les exportations sont autorisées.',
    tips: [
      'Doit être après la date de demande',
      'Généralement la date d\'émission',
      'Définit le début de la période de validité'
    ]
  },
  end_date: {
    title: 'Date de Fin',
    description: 'Date d\'expiration de la licence. Au-delà, aucune exportation n\'est autorisée avec cette licence.',
    tips: [
      'Doit être après la date de début',
      'Durée typique: 6 à 12 mois',
      'Le système bloque les exportations après expiration'
    ]
  },
  authorized_quantity: {
    title: 'Quantité Autorisée',
    description: 'Poids total d\'or (en grammes) autorisé à l\'exportation pour cette licence.',
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
    description: 'Prix moyen estimé ou convenu pour la vente de l\'or exporté (USD par gramme).',
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
    description: 'Notes additionnelles, conditions particulières ou observations concernant cette licence.',
    tips: [
      'Champ libre et optionnel',
      'Restrictions spéciales',
      'Conditions d\'exportation',
      'Historique de modifications'
    ]
  },
  documents: {
    title: 'Documents Joints',
    description: 'Fichiers PDF ou documents officiels liés à la licence (copie licence, autorisations, etc.).',
    tips: [
      'Plusieurs documents possibles',
      'Nom descriptif recommandé',
      'Type: licence, autorisation, annexe, etc.',
      'Facilite les audits et vérifications'
    ]
  }
};

export function ExportLicenseForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [activeField, setActiveField] = useState<string>('license_number');

  // Form state
  const [formData, setFormData] = useState<CreateLicenseData>({
    license_number: '',
    mining_company_id: '',
    request_date: new Date().toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    issuing_institution: '',
    authorized_quantity_grams: 0,
    average_sale_price: 0,
    comments: '',
    notes: '',
  });

  const [documents, setDocuments] = useState<DocumentEntry[]>([]);

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadMiningCompanies();

      if (isEditMode && id) {
        await loadLicense(id);
        await loadDocuments(id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadMiningCompanies = async () => {
    const { data, error } = await supabase
      .from('mining_companies')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setMiningCompanies(data || []);
  };

  const loadLicense = async (licenseId: string) => {
    const license = await exportLicenseService.getLicenseById(licenseId);
    if (license) {
      setFormData({
        license_number: license.license_number,
        mining_company_id: license.mining_company_id,
        request_date: license.request_date,
        start_date: license.start_date,
        end_date: license.end_date,
        issuing_institution: license.issuing_institution,
        authorized_quantity_grams: license.authorized_quantity_grams,
        average_sale_price: license.average_sale_price || 0,
        comments: license.comments || '',
        notes: license.notes || '',
      });
    }
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
    if (!formData.mining_company_id) {
      alert('Veuillez d\'abord sélectionner une compagnie minière');
      return;
    }

    const company = miningCompanies.find((c) => c.id === formData.mining_company_id);
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
        type: 'document',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.license_number || !formData.mining_company_id) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.authorized_quantity_grams <= 0) {
      alert('La quantité autorisée doit être supérieure à 0');
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      alert('La date de fin doit être après la date de début');
      return;
    }

    try {
      setSaving(true);

      let licenseId: string;

      if (isEditMode && id) {
        await exportLicenseService.updateLicense(id, formData);
        licenseId = id;
      } else {
        const newLicense = await exportLicenseService.createLicense(formData);
        licenseId = newLicense.id;
      }

      for (const doc of documents) {
        if (doc.id.startsWith('temp-') && doc.name.trim()) {
          await exportLicenseService.addDocument({
            license_id: licenseId,
            document_name: doc.name,
            document_type: doc.type,
          });
        }
      }

      alert(
        isEditMode
          ? 'Licence mise à jour avec succès'
          : 'Licence créée avec succès'
      );
      navigate('/production/licenses');
    } catch (error: any) {
      console.error('Error saving license:', error);
      alert('Erreur lors de la sauvegarde: ' + error.message);
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

  const currentHelp = FIELD_HELP[activeField] || FIELD_HELP.license_number;

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
                  {isEditMode ? 'Modifier la Licence' : 'Nouvelle Licence d\'Exportation'}
                </h1>
                <p className="text-sm text-gray-600">
                  Enregistrez les informations de la licence d'exportation
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

                  {/* Compagnie Minière */}
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
                        className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <Input
                          value={doc.name}
                          onChange={(e) =>
                            handleDocumentChange(doc.id, 'name', e.target.value)
                          }
                          placeholder="Nom du document"
                          className="flex-1"
                        />
                        <select
                          value={doc.type}
                          onChange={(e) =>
                            handleDocumentChange(doc.id, 'type', e.target.value)
                          }
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="license">Licence</option>
                          <option value="authorization">Autorisation</option>
                          <option value="certificate">Certificat</option>
                          <option value="annex">Annexe</option>
                          <option value="other">Autre</option>
                        </select>
                        <Button
                          type="button"
                          onClick={() => handleRemoveDocument(doc.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                        </Button>
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

        {/* Help Panel - Right Side */}
        <div className="w-96 bg-gradient-to-b from-blue-50 to-white border-l border-gray-200 p-6 overflow-y-auto">
          <div className="sticky top-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Info className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Guide d'Aide</h3>
                <p className="text-xs text-gray-600">Informations contextuelles</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-blue-900 text-lg mb-2">
                  {currentHelp.title}
                </h4>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                  {currentHelp.description}
                </p>
              </div>

              {currentHelp.example && (
                <div className="bg-white border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Exemple</p>
                  <p className="text-sm font-mono text-gray-800">{currentHelp.example}</p>
                </div>
              )}

              {currentHelp.tips && currentHelp.tips.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Conseils :</p>
                  <ul className="space-y-2">
                    {currentHelp.tips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-blue-500 font-bold">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-blue-100">
                <p className="text-xs text-gray-500 italic">
                  💡 Survolez ou cliquez sur un champ pour voir son aide détaillée
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
