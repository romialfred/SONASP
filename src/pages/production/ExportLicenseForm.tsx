import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Plus, X } from 'lucide-react';
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

export function ExportLicenseForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);

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
        // Update existing license
        await exportLicenseService.updateLicense(id, formData);
        licenseId = id;
      } else {
        // Create new license
        const newLicense = await exportLicenseService.createLicense(formData);
        licenseId = newLicense.id;
      }

      // Save documents (only new ones without existing IDs)
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

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto p-6">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de Licence *
                </label>
                <div className="flex gap-2">
                  <Input
                    value={formData.license_number}
                    onChange={(e) =>
                      setFormData({ ...formData, license_number: e.target.value })
                    }
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compagnie Minière *
                </label>
                <select
                  value={formData.mining_company_id}
                  onChange={(e) =>
                    setFormData({ ...formData, mining_company_id: e.target.value })
                  }
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de Demande *
                </label>
                <Input
                  type="date"
                  value={formData.request_date}
                  onChange={(e) =>
                    setFormData({ ...formData, request_date: e.target.value })
                  }
                  required
                />
              </div>

              {/* Institution Émettrice */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Institution Émettrice *
                </label>
                <Input
                  value={formData.issuing_institution}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      issuing_institution: e.target.value,
                    })
                  }
                  placeholder="Ministère des Mines..."
                  required
                />
              </div>

              {/* Date de Début */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de Début *
                </label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  required
                />
              </div>

              {/* Date de Fin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de Fin *
                </label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  required
                />
              </div>

              {/* Quantité Autorisée */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantité Autorisée (grammes) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.authorized_quantity_grams}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      authorized_quantity_grams: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>

              {/* Prix Moyen de Vente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prix Moyen de Vente (USD/g)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.average_sale_price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      average_sale_price: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {/* Commentaires */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commentaires
              </label>
              <TextArea
                value={formData.comments || ''}
                onChange={(e) =>
                  setFormData({ ...formData, comments: e.target.value })
                }
                rows={3}
                placeholder="Commentaires supplémentaires..."
              />
            </div>
          </Card>

          {/* Documents */}
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Documents</h2>
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
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucun document. Cliquez sur "Ajouter Document" pour en ajouter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex gap-3 items-center">
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
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="document">Document</option>
                      <option value="license_copy">Copie Licence</option>
                      <option value="authorization">Autorisation</option>
                      <option value="certificate">Certificat</option>
                      <option value="other">Autre</option>
                    </select>
                    <Button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.id)}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-600 hover:bg-red-50"
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
    </MainLayout>
  );
}
