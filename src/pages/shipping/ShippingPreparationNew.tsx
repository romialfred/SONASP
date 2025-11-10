import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Package, Save, Plus, Trash2, User, Truck, Building2, X, ArrowLeft, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MainLayout } from '@/components/layout/MainLayout';
import { DynamicPackingList } from '@/components/shipping/DynamicPackingList';
import { DocumentUploadModal } from '@/components/shipping/DocumentUploadModal';
import { supabase } from '@/lib/supabase';
import { shippingPreparationService, ShippingPreparation, ShippingSignatory, ShippingProductionItem, ShippingDocument } from '@/services/shippingPreparationService';

interface DailyProduction {
  id: string;
  production_date: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  pure_gold_grams: number;
  estimated_oz: number;
  bar_reference: string | null;
  notes: string | null;
  mining_company_id: string | null;
  mining_company?: {
    id: string;
    name: string;
    code: string;
  };
}

interface TransportCompany {
  id: string;
  name: string;
  address: string | null;
  company_type: string;
  is_active: boolean;
}

interface Refinery {
  id: string;
  name: string;
  location: string;
  country: string;
  is_active: boolean;
}

export default function ShippingPreparationNew() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [selectedProductionIds, setSelectedProductionIds] = useState<string[]>([]);
  const [productionItems, setProductionItems] = useState<ShippingProductionItem[]>([]);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [signatories, setSignatories] = useState<ShippingSignatory[]>([]);
  const [documents, setDocuments] = useState<ShippingDocument[]>([]);
  const [freightCompanies, setFreightCompanies] = useState<TransportCompany[]>([]);
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Form state
  const [expeditionLotNumber, setExpeditionLotNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [selectedFreightCompanyId, setSelectedFreightCompanyId] = useState('');
  const [selectedRefineryId, setSelectedRefineryId] = useState('');

  // Signatory form
  const [newSignatoryPosition, setNewSignatoryPosition] = useState('');
  const [newSignatoryName, setNewSignatoryName] = useState('');

  const commonPositions = [
    'Gold Room Operator',
    'SMK Finance',
    'DNGM Representative',
    'Customs Representative',
    'Brinks Representative',
    'Freight Forwarder',
    'Quality Control Manager',
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (isEditMode && id) {
      loadPreparation(id);
    }
  }, [isEditMode, id]);

  useEffect(() => {
    if (selectedProductionIds.length > 0) {
      generateExpeditionLotNumber();
    }
  }, [selectedProductionIds]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProductions(),
        loadFreightCompanies(),
        loadRefineries(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProductions = async () => {
    const { data, error } = await supabase
      .from('daily_production')
      .select(`
        *,
        mining_company:mining_companies(id, name, code)
      `)
      .order('production_date', { ascending: false })
      .limit(100);

    if (error) throw error;
    setProductions(data || []);
  };

  const loadFreightCompanies = async () => {
    const { data, error } = await supabase
      .from('transport_companies')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setFreightCompanies(data || []);
  };

  const loadRefineries = async () => {
    const { data, error } = await supabase
      .from('refineries')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setRefineries(data || []);
  };

  const loadPreparation = async (prepId: string) => {
    try {
      const prep = await shippingPreparationService.getPreparationById(prepId);
      if (prep) {
        setPreparation(prep);
        setExpeditionLotNumber(prep.expedition_lot_number || '');
        setSealNumber(prep.seal_number || '');
        setSelectedFreightCompanyId(prep.shipped_to_company || '');
        setSelectedRefineryId(prep.shipped_to_address || '');

        const items = await shippingPreparationService.getProductionItems(prepId);
        setProductionItems(items);
        setSelectedProductionIds(items.map(i => i.daily_production_id));

        const sigs = await shippingPreparationService.getSignatories(prepId);
        setSignatories(sigs);

        const docs = await shippingPreparationService.getDocuments(prepId);
        setDocuments(docs);
      }
    } catch (error) {
      console.error('Error loading preparation:', error);
    }
  };

  const generateExpeditionLotNumber = () => {
    if (selectedProductionIds.length === 0) return;

    const firstProduction = productions.find(p => p.id === selectedProductionIds[0]);
    if (!firstProduction) return;

    const date = new Date(firstProduction.production_date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const companyCode = firstProduction.mining_company?.code || 'XXX';

    const lotNumber = `HUM-${companyCode}-${month}${day}/${year}`;
    setExpeditionLotNumber(lotNumber);
  };

  const handleAddProduction = (productionId: string) => {
    if (!selectedProductionIds.includes(productionId)) {
      setSelectedProductionIds([...selectedProductionIds, productionId]);
    }
  };

  const handleRemoveProduction = (productionId: string) => {
    setSelectedProductionIds(selectedProductionIds.filter(id => id !== productionId));
  };

  const handleCancel = () => {
    if (confirm('Annuler les modifications? Les données non enregistrées seront perdues.')) {
      navigate('/shipping/preparation');
    }
  };

  const handleSavePreparation = async () => {
    if (selectedProductionIds.length === 0) {
      alert('Veuillez sélectionner au moins une production');
      return;
    }

    if (!selectedFreightCompanyId || !selectedRefineryId) {
      alert('Veuillez sélectionner une Freight Company et une Refinery');
      return;
    }

    if (!sealNumber.trim()) {
      alert('Veuillez saisir un Seal Number');
      return;
    }

    try {
      setSaving(true);

      const prepData = {
        expedition_lot_number: expeditionLotNumber,
        seal_number: sealNumber,
        shipped_to_company: selectedFreightCompanyId,
        shipped_to_address: selectedRefineryId,
        status: 'prepared' as const,
        prepared_at: new Date().toISOString(),
      };

      let prepId: string;

      if (preparation) {
        await shippingPreparationService.updatePreparation(preparation.id, prepData);
        prepId = preparation.id;
      } else {
        const newPrep = await shippingPreparationService.createPreparation(prepData);
        prepId = newPrep.id;
        setPreparation(newPrep);
      }

      // Add production items
      for (const [index, productionId] of selectedProductionIds.entries()) {
        const production = productions.find(p => p.id === productionId);
        if (production) {
          const existingItem = productionItems.find(i => i.daily_production_id === productionId);
          if (!existingItem) {
            await shippingPreparationService.addProductionItem({
              shipping_preparation_id: prepId,
              daily_production_id: productionId,
              ingot_box_number: production.bar_reference || `BOX-${index + 1}`,
              net_weight_grams: production.pure_gold_grams,
              gross_weight_grams: production.bullion_grams,
              fineness_pct: production.estimated_fineness_pct,
              pure_gold_grams: production.pure_gold_grams,
              order_index: index,
            });
          }
        }
      }

      alert('Préparation enregistrée avec succès');

      // Reload to get updated data
      if (!isEditMode) {
        navigate(`/shipping/preparation/edit/${prepId}`);
      } else {
        await loadPreparation(prepId);
      }
    } catch (error) {
      console.error('Error saving preparation:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSignatory = async () => {
    if (!preparation || !newSignatoryPosition.trim() || !newSignatoryName.trim()) {
      alert('Veuillez enregistrer la préparation et remplir la position et le nom');
      return;
    }

    try {
      const newSignatory = await shippingPreparationService.createSignatory({
        shipping_preparation_id: preparation.id,
        position: newSignatoryPosition,
        name: newSignatoryName,
        order_index: signatories.length,
      });

      setSignatories([...signatories, newSignatory]);
      setNewSignatoryPosition('');
      setNewSignatoryName('');
    } catch (error) {
      console.error('Error adding signatory:', error);
      alert('Erreur lors de l\'ajout du signataire');
    }
  };

  const handleDeleteSignatory = async (sigId: string) => {
    if (!confirm('Supprimer ce signataire ?')) return;

    try {
      await shippingPreparationService.deleteSignatory(sigId);
      setSignatories(signatories.filter(s => s.id !== sigId));
    } catch (error) {
      console.error('Error deleting signatory:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleUploadDocument = async (file: File, title: string) => {
    if (!preparation) {
      alert('Veuillez enregistrer la préparation d\'abord');
      return;
    }

    try {
      const newDoc = await shippingPreparationService.uploadDocument(preparation.id, file, title);
      setDocuments([...documents, newDoc]);
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  };

  const handleDeleteDocument = async (docId: string, documentUrl: string) => {
    if (!confirm('Supprimer ce document ?')) return;

    try {
      await shippingPreparationService.deleteDocument(docId, documentUrl);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Erreur lors de la suppression du document');
    }
  };

  const selectedProductions = productions.filter(p => selectedProductionIds.includes(p.id));
  const selectedFreightCompany = freightCompanies.find(fc => fc.id === selectedFreightCompanyId);
  const selectedRefinery = refineries.find(r => r.id === selectedRefineryId);
  const totalNetWeight = selectedProductions.reduce((sum, p) => sum + p.pure_gold_grams, 0);
  const totalGrossWeight = selectedProductions.reduce((sum, p) => sum + p.bullion_grams, 0);

  return (
    <MainLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-50">
        {/* Form Section */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => navigate('/shipping/preparation')}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </Button>
                <div className="p-3 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl shadow-lg">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900">
                    {isEditMode ? 'Modifier Expédition' : 'Nouvelle Expédition'}
                  </h1>
                  <p className="text-gray-600">Préparez les barres pour l'expédition</p>
                </div>
              </div>
            </div>

            {/* Production Selector with Multi-Select */}
            <Card className="p-6 border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50">
              <h3 className="text-base font-bold text-yellow-900 mb-4">
                Sélectionner Productions ({selectedProductionIds.length} sélectionnée{selectedProductionIds.length > 1 ? 's' : ''})
              </h3>

              <div className="space-y-3">
                <select
                  onChange={(e) => handleAddProduction(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 bg-white"
                  disabled={loading}
                  value=""
                >
                  <option value="">-- Ajouter une production --</option>
                  {productions
                    .filter(p => !selectedProductionIds.includes(p.id))
                    .map((production) => (
                      <option key={production.id} value={production.id}>
                        {new Date(production.production_date).toLocaleDateString('fr-FR')} - {production.bar_reference} - {production.bullion_grams.toFixed(2)}g - {production.mining_company?.name}
                      </option>
                    ))}
                </select>

                {/* Selected Productions List */}
                {selectedProductions.length > 0 && (
                  <div className="space-y-2">
                    {selectedProductions.map((production, index) => (
                      <div key={production.id} className="flex items-center gap-3 bg-white p-4 rounded-lg border-2 border-yellow-200 shadow-sm">
                        <div className="flex-shrink-0 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-gray-600">Date</div>
                            <div className="font-semibold">{new Date(production.production_date).toLocaleDateString('fr-FR')}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Bar Ref</div>
                            <div className="font-semibold font-mono">{production.bar_reference}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Bullion</div>
                            <div className="font-semibold">{production.bullion_grams.toFixed(2)} g</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Pure Gold</div>
                            <div className="font-semibold text-yellow-800">{production.pure_gold_grams.toFixed(2)} g</div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRemoveProduction(production.id)}
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}

                    {/* Totals - Compact */}
                    <div className="bg-gradient-to-r from-yellow-100 to-amber-100 p-3 rounded-lg border border-yellow-300">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-xs text-yellow-700 font-medium">Total Boxes</div>
                          <div className="text-lg font-bold text-yellow-900">{selectedProductions.length}</div>
                        </div>
                        <div>
                          <div className="text-xs text-yellow-700 font-medium">Total Gross Weight</div>
                          <div className="text-lg font-bold text-yellow-900">{totalGrossWeight.toFixed(2)} g</div>
                        </div>
                        <div>
                          <div className="text-xs text-yellow-700 font-medium">Total Net Weight</div>
                          <div className="text-lg font-bold text-yellow-900">{totalNetWeight.toFixed(2)} g</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Expedition Details - Always show */}
            <Card className="p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Détails d'Expédition</h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Truck className="w-4 h-4 inline mr-1" />
                        Freight Company *
                      </label>
                      <select
                        value={selectedFreightCompanyId}
                        onChange={(e) => setSelectedFreightCompanyId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      >
                        <option value="">-- Sélectionner --</option>
                        {freightCompanies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Building2 className="w-4 h-4 inline mr-1" />
                        Refinery *
                      </label>
                      <select
                        value={selectedRefineryId}
                        onChange={(e) => setSelectedRefineryId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      >
                        <option value="">-- Sélectionner --</option>
                        {refineries.map((refinery) => (
                          <option key={refinery.id} value={refinery.id}>
                            {refinery.name} - {refinery.country}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expedition / Lot Number
                      </label>
                      <Input
                        value={expeditionLotNumber}
                        onChange={(e) => setExpeditionLotNumber(e.target.value)}
                        placeholder="HUM-SMK-380/2025"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Seal Number *
                      </label>
                      <Input
                        value={sealNumber}
                        onChange={(e) => setSealNumber(e.target.value)}
                        placeholder="0097099"
                      />
                    </div>
              </div>
            </Card>

            {/* Supporting Documents Section - Always show */}
            <Card className="p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Documents de Support</h2>

              {preparation ? (
                <>
                  <div className="mb-4">
                    <Button
                      onClick={() => setShowDocumentModal(true)}
                      variant="outline"
                      size="sm"
                      className="border-yellow-600 text-yellow-800 hover:bg-yellow-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter Document
                    </Button>
                  </div>

                  {documents.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-gray-700 text-white">
                            <th className="p-3 text-left font-semibold text-xs uppercase">#</th>
                            <th className="p-3 text-left font-semibold text-xs uppercase">Titre</th>
                            <th className="p-3 text-left font-semibold text-xs uppercase">Nom Fichier</th>
                            <th className="p-3 text-left font-semibold text-xs uppercase">Taille</th>
                            <th className="p-3 text-center font-semibold text-xs uppercase w-32">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {documents.map((doc, index) => (
                            <tr key={doc.id} className="hover:bg-gray-50">
                              <td className="p-3 text-gray-600">{index + 1}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-yellow-700" />
                                  <span className="font-medium text-gray-900">{doc.title}</span>
                                </div>
                              </td>
                              <td className="p-3 text-gray-700 text-xs">{doc.file_name}</td>
                              <td className="p-3 text-gray-600 text-xs">
                                {doc.file_size ? `${(doc.file_size / 1024).toFixed(2)} KB` : 'N/A'}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center justify-center gap-2">
                                  <a
                                    href={doc.document_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                  <Button
                                    onClick={() => handleDeleteDocument(doc.id, doc.document_url)}
                                    variant="outline"
                                    size="sm"
                                    className="border-red-300 text-red-600 hover:bg-red-50 p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-gray-600 font-medium text-sm">Aucun document ajouté</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 bg-blue-50 rounded-lg border-2 border-dashed border-blue-300">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-blue-400" />
                  <p className="text-blue-700 font-medium text-sm">Enregistrez d'abord la préparation pour ajouter des documents</p>
                </div>
              )}
            </Card>

            {/* Signatories Section */}
            {preparation && (
                  <Card className="p-6">
                    <h2 className="text-base font-bold text-gray-900 mb-4">Signataires</h2>

                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-yellow-800 mb-1">Position</label>
                          <select
                            value={newSignatoryPosition}
                            onChange={(e) => setNewSignatoryPosition(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                          >
                            <option value="">-- Sélectionner --</option>
                            {commonPositions.map((pos) => (
                              <option key={pos} value={pos}>{pos}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-yellow-800 mb-1">Nom</label>
                          <Input
                            value={newSignatoryName}
                            onChange={(e) => setNewSignatoryName(e.target.value)}
                            placeholder="Nom complet"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleAddSignatory}
                        variant="outline"
                        size="sm"
                        className="border-yellow-500 text-yellow-800 hover:bg-yellow-50"
                        disabled={!newSignatoryPosition.trim() || !newSignatoryName.trim()}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter Signataire
                      </Button>
                    </div>

                    {signatories.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                              <th className="p-4 text-left font-semibold text-sm uppercase tracking-wide">#</th>
                              <th className="p-4 text-left font-semibold text-sm uppercase tracking-wide">Position</th>
                              <th className="p-4 text-left font-semibold text-sm uppercase tracking-wide">Nom</th>
                              <th className="p-4 text-center font-semibold text-sm uppercase tracking-wide w-24">Action</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {signatories.map((signatory, index) => (
                              <tr key={signatory.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 text-gray-600 font-medium">{index + 1}</td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-yellow-700" />
                                    <span className="font-medium text-gray-900">{signatory.position}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-blue-900 font-semibold">{signatory.name}</span>
                                </td>
                                <td className="p-4 text-center">
                                  <Button
                                    onClick={() => handleDeleteSignatory(signatory.id)}
                                    variant="outline"
                                    size="sm"
                                    className="border-red-300 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <User className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-600 font-medium">Aucun signataire ajouté</p>
                      </div>
                    )}
              </Card>
            )}

            {/* Action Buttons - Refined without frame */}
            <div className="flex items-center justify-end gap-3 py-4">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="gap-2 px-6 py-2.5 border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 shadow-sm"
              >
                <X className="w-4 h-4" />
                Annuler
              </Button>
              <Button
                onClick={handleSavePreparation}
                disabled={saving || !sealNumber.trim() || !selectedFreightCompanyId || !selectedRefineryId || selectedProductionIds.length === 0}
                className="gap-2 px-8 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer Préparation'}
              </Button>
            </div>
          </div>
        </div>

        {/* Dynamic PDF Preview - Always visible */}
        {
          <div className="w-[650px] bg-white border-l-4 border-yellow-500 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-gradient-to-r from-yellow-500 to-amber-600 border-b-4 border-yellow-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Package className="w-5 h-5" />
                Packing List Preview
              </h3>
              <p className="text-sm text-yellow-100">Mise à jour en temps réel</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {selectedProductions.length > 0 ? (
                <div className="bg-white rounded-lg shadow-xl">
                  <DynamicPackingList
                    expeditionLotNumber={expeditionLotNumber}
                    productionDate={selectedProductions[0].production_date}
                    miningCompany={selectedProductions[0].mining_company?.name || ''}
                    refineryName={selectedRefinery?.name || ''}
                    refineryAddress={selectedRefinery?.location || ''}
                    refineryCountry={selectedRefinery?.country || ''}
                    freightCompany={selectedFreightCompany?.name || ''}
                    ingots={selectedProductions.map((prod, idx) => ({
                      ingotBoxNumber: prod.bar_reference || `BOX-${idx + 1}`,
                      netWeight: prod.pure_gold_grams,
                      grossWeight: prod.bullion_grams,
                      sealNumber1: sealNumber,
                      sealNumber2: sealNumber ? `${parseInt(sealNumber) + idx}` : '',
                    }))}
                    signatories={signatories.map(s => ({
                      position: s.position,
                      name: s.name,
                    }))}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center py-12 px-6 bg-white rounded-lg border-2 border-dashed border-gray-300 shadow-lg">
                    <Package className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Packing List Preview</h3>
                    <p className="text-sm text-gray-500 mb-4">Sélectionnez une production pour voir la facture</p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs text-yellow-800">Le PDF sera généré automatiquement au fur et à mesure que vous remplissez le formulaire</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
      </div>

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        onUpload={handleUploadDocument}
      />
    </MainLayout>
  );
}
