import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Package, Save, Plus, Trash2, User, Truck, Building2, X, ArrowLeft, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MainLayout } from '@/components/layout/MainLayout';
import { DynamicPackingList } from '@/components/shipping/DynamicPackingList';
import { SuccessDialog } from '@/components/ui/SuccessDialog';
import { supabase } from '@/lib/supabase';
import { shippingPreparationService, ShippingPreparation, ShippingSignatory, ShippingProductionItem } from '@/services/shippingPreparationService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

interface SelectedProductionData {
  production: DailyProduction;
  sealNumber1: string;
  sealNumber2: string;
}

interface PendingDocument {
  file: File;
  title: string;
  tempId: string;
}

export default function ShippingPreparationNew() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [selectedProductions, setSelectedProductions] = useState<SelectedProductionData[]>([]);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [signatories, setSignatories] = useState<{position: string; name: string; tempId: string}[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [freightCompanies, setFreightCompanies] = useState<TransportCompany[]>([]);
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [savedPreparationId, setSavedPreparationId] = useState<string>('');

  // Form state
  const [selectedFreightCompanyId, setSelectedFreightCompanyId] = useState('');
  const [selectedRefineryId, setSelectedRefineryId] = useState('');

  // Signatory form
  const [newSignatoryPosition, setNewSignatoryPosition] = useState('');
  const [newSignatoryName, setNewSignatoryName] = useState('');

  // Document form
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const [newDocumentFile, setNewDocumentFile] = useState<File | null>(null);

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
        setSelectedFreightCompanyId(prep.shipped_to_company || '');
        setSelectedRefineryId(prep.shipped_to_address || '');
      }
    } catch (error) {
      console.error('Error loading preparation:', error);
    }
  };

  const generateExpeditionLotNumber = () => {
    if (selectedProductions.length === 0) return '';

    const firstProduction = selectedProductions[0].production;
    const date = new Date(firstProduction.production_date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const companyCode = firstProduction.mining_company?.code || 'XXX';

    return `HUM-${companyCode}-${month}${day}/${year}`;
  };

  const handleAddProduction = (productionId: string) => {
    const production = productions.find(p => p.id === productionId);
    if (!production) return;

    const alreadySelected = selectedProductions.some(sp => sp.production.id === productionId);
    if (alreadySelected) return;

    setSelectedProductions([...selectedProductions, {
      production,
      sealNumber1: '',
      sealNumber2: ''
    }]);
  };

  const handleRemoveProduction = (productionId: string) => {
    setSelectedProductions(selectedProductions.filter(sp => sp.production.id !== productionId));
  };

  const handleSealNumber1Change = (productionId: string, value: string) => {
    setSelectedProductions(selectedProductions.map(sp =>
      sp.production.id === productionId ? { ...sp, sealNumber1: value } : sp
    ));
  };

  const handleSealNumber2Change = (productionId: string, value: string) => {
    setSelectedProductions(selectedProductions.map(sp =>
      sp.production.id === productionId ? { ...sp, sealNumber2: value } : sp
    ));
  };

  const handleAddSignatory = () => {
    if (!newSignatoryPosition.trim() || !newSignatoryName.trim()) {
      alert('Veuillez remplir la position et le nom');
      return;
    }

    setSignatories([...signatories, {
      position: newSignatoryPosition,
      name: newSignatoryName,
      tempId: `temp-${Date.now()}`
    }]);

    setNewSignatoryPosition('');
    setNewSignatoryName('');
  };

  const handleRemoveSignatory = (tempId: string) => {
    setSignatories(signatories.filter(s => s.tempId !== tempId));
  };

  const handleAddDocument = () => {
    if (!newDocumentTitle.trim() || !newDocumentFile) {
      alert('Veuillez remplir le titre et sélectionner un fichier');
      return;
    }

    setPendingDocuments([...pendingDocuments, {
      file: newDocumentFile,
      title: newDocumentTitle,
      tempId: `temp-doc-${Date.now()}`
    }]);

    setNewDocumentTitle('');
    setNewDocumentFile(null);
    setShowDocumentForm(false);
  };

  const handleRemoveDocument = (tempId: string) => {
    setPendingDocuments(pendingDocuments.filter(d => d.tempId !== tempId));
  };

  const handleCancel = () => {
    if (confirm('Annuler les modifications? Les données non enregistrées seront perdues.')) {
      navigate('/shipping/preparation');
    }
  };

  const generateAndUploadPackingList = async (preparationId: string, expeditionLotNumber: string) => {
    try {
      // Create a temporary container for the packing list
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '210mm'; // A4 width
      tempContainer.style.background = 'white';
      document.body.appendChild(tempContainer);

      // Render the packing list into the container
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempContainer);

      await new Promise<void>((resolve) => {
        root.render(
          <DynamicPackingList
            expeditionLotNumber={expeditionLotNumber}
            productionDate={selectedProductions[0]?.production.production_date || new Date().toISOString()}
            miningCompany={selectedProductions[0]?.production.mining_company?.name || 'N/A'}
            refineryName={selectedRefinery?.name || 'N/A'}
            refineryAddress={selectedRefinery?.location || 'N/A'}
            refineryCountry={selectedRefinery?.country || 'N/A'}
            freightCompany={selectedFreightCompany?.name || 'N/A'}
            ingots={selectedProductions.map(sp => ({
              ingotBoxNumber: sp.production.bar_reference || 'N/A',
              netWeight: sp.production.pure_gold_grams,
              grossWeight: sp.production.bullion_grams,
              sealNumber1: sp.sealNumber1,
              sealNumber2: sp.sealNumber2 || '',
            }))}
            signatories={signatories.map(s => ({
              position: s.position,
              name: s.name,
            }))}
          />
        );
        setTimeout(resolve, 500); // Wait for render
      });

      // Capture as canvas
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Convert to PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // Convert PDF to Blob
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `Packing-List-${expeditionLotNumber}.pdf`, { type: 'application/pdf' });

      // Upload to Supabase
      await shippingPreparationService.uploadDocument(
        preparationId,
        pdfFile,
        `Packing List - ${expeditionLotNumber}`
      );

      // Update the preparation with packing list URL
      const { data: { publicUrl } } = supabase.storage
        .from('shipping-documents')
        .getPublicUrl(`${preparationId}/${pdfFile.name}`);

      await shippingPreparationService.updatePreparation(preparationId, {
        packing_list_url: publicUrl,
      });

      // Cleanup
      root.unmount();
      document.body.removeChild(tempContainer);

      console.log('Packing List generated and uploaded successfully');
    } catch (error) {
      console.error('Error generating packing list:', error);
      // Don't fail the whole save if packing list generation fails
    }
  };

  const handleSavePreparation = async () => {
    if (selectedProductions.length === 0) {
      alert('Veuillez sélectionner au moins une production');
      return;
    }

    if (!selectedFreightCompanyId || !selectedRefineryId) {
      alert('Veuillez sélectionner une Freight Company et une Refinery');
      return;
    }

    // Check if all productions have at least seal number 1
    const missingSealNumbers = selectedProductions.filter(sp => !sp.sealNumber1.trim());
    if (missingSealNumbers.length > 0) {
      alert('Veuillez saisir au moins le Seal Number 1 pour toutes les productions');
      return;
    }

    try {
      setSaving(true);

      const expeditionLotNumber = generateExpeditionLotNumber();

      const prepData = {
        expedition_lot_number: expeditionLotNumber,
        seal_number: selectedProductions[0].sealNumber1, // For backward compatibility
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
      for (const [index, sp] of selectedProductions.entries()) {
        await shippingPreparationService.addProductionItem({
          shipping_preparation_id: prepId,
          daily_production_id: sp.production.id,
          ingot_box_number: sp.production.bar_reference || `BOX-${index + 1}`,
          net_weight_grams: sp.production.pure_gold_grams,
          gross_weight_grams: sp.production.bullion_grams,
          fineness_pct: sp.production.estimated_fineness_pct,
          pure_gold_grams: sp.production.pure_gold_grams,
          seal_number_1: sp.sealNumber1,
          seal_number_2: sp.sealNumber2 || undefined,
          order_index: index,
        });
      }

      // Add signatories
      for (const [index, sig] of signatories.entries()) {
        await shippingPreparationService.createSignatory({
          shipping_preparation_id: prepId,
          position: sig.position,
          name: sig.name,
          order_index: index,
        });
      }

      // Upload documents
      for (const doc of pendingDocuments) {
        await shippingPreparationService.uploadDocument(prepId, doc.file, doc.title);
      }

      // Generate and upload Packing List PDF
      console.log('Starting Packing List generation...');
      try {
        await generateAndUploadPackingList(prepId, expeditionLotNumber);
        console.log('Packing List generated successfully');
      } catch (err) {
        console.error('Failed to generate packing list, but preparation saved:', err);
        // Continue anyway - the PDF can be regenerated later
      }

      setSavedPreparationId(prepId);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error('Error saving preparation:', error);
      alert('Erreur lors de la sauvegarde: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
    } finally {
      setSaving(false);
    }
  };

  const selectedRefinery = refineries.find(r => r.id === selectedRefineryId);
  const selectedFreightCompany = freightCompanies.find(fc => fc.id === selectedFreightCompanyId);
  const totalNetWeight = selectedProductions.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);
  const totalGrossWeight = selectedProductions.reduce((sum, sp) => sum + sp.production.bullion_grams, 0);

  return (
    <MainLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-50">
        {/* Form Section */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
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
                  <h1 className="text-2xl font-bold text-gray-900">
                    {isEditMode ? 'Modifier Expédition' : 'Nouvelle Expédition'}
                  </h1>
                  <p className="text-sm text-gray-600">Préparez les barres pour l'expédition</p>
                </div>
              </div>
            </div>

            {/* Production Selection & Table */}
            <Card className="p-6 border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-yellow-900">
                  Sélectionner Productions ({selectedProductions.length})
                </h3>
                <select
                  onChange={(e) => {
                    handleAddProduction(e.target.value);
                    e.target.value = '';
                  }}
                  className="px-4 py-2 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-white text-sm"
                  disabled={loading}
                  value=""
                >
                  <option value="">-- Ajouter une production --</option>
                  {productions
                    .filter(p => !selectedProductions.some(sp => sp.production.id === p.id))
                    .map((production) => (
                      <option key={production.id} value={production.id}>
                        {new Date(production.production_date).toLocaleDateString('fr-FR')} - {production.bar_reference} - {production.bullion_grams.toFixed(2)}g
                      </option>
                    ))}
                </select>
              </div>

              {selectedProductions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                        <th className="px-3 py-3 text-left text-xs font-bold uppercase">#</th>
                        <th className="px-3 py-3 text-left text-xs font-bold uppercase">Date</th>
                        <th className="px-3 py-3 text-left text-xs font-bold uppercase">Bar Ref</th>
                        <th className="px-3 py-3 text-right text-xs font-bold uppercase">Bullion (g)</th>
                        <th className="px-3 py-3 text-right text-xs font-bold uppercase">Pure Gold (g)</th>
                        <th className="px-3 py-3 text-left text-xs font-bold uppercase">Seal 1 *</th>
                        <th className="px-3 py-3 text-left text-xs font-bold uppercase">Seal 2</th>
                        <th className="px-3 py-3 text-center text-xs font-bold uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedProductions.map((sp, index) => (
                        <tr key={sp.production.id} className="hover:bg-yellow-50 transition-colors">
                          <td className="px-3 py-3 text-sm font-bold text-gray-600">{index + 1}</td>
                          <td className="px-3 py-3 text-sm">{new Date(sp.production.production_date).toLocaleDateString('fr-FR')}</td>
                          <td className="px-3 py-3 text-sm font-mono font-semibold">{sp.production.bar_reference}</td>
                          <td className="px-3 py-3 text-sm text-right font-semibold">{sp.production.bullion_grams.toFixed(2)}</td>
                          <td className="px-3 py-3 text-sm text-right font-semibold text-yellow-800">{sp.production.pure_gold_grams.toFixed(2)}</td>
                          <td className="px-3 py-3">
                            <Input
                              value={sp.sealNumber1}
                              onChange={(e) => handleSealNumber1Change(sp.production.id, e.target.value)}
                              placeholder="0097099"
                              className="w-28 text-xs h-8"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <Input
                              value={sp.sealNumber2}
                              onChange={(e) => handleSealNumber2Change(sp.production.id, e.target.value)}
                              placeholder="0097100"
                              className="w-28 text-xs h-8"
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <Button
                              onClick={() => handleRemoveProduction(sp.production.id)}
                              variant="outline"
                              size="sm"
                              className="border-red-300 text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {/* Totals Row */}
                      <tr className="bg-gradient-to-r from-yellow-100 to-amber-100 font-bold border-t-2 border-yellow-400">
                        <td colSpan={3} className="px-3 py-3 text-sm text-yellow-900">TOTAL ({selectedProductions.length} boxes)</td>
                        <td className="px-3 py-3 text-sm text-right text-yellow-900">{totalGrossWeight.toFixed(2)}</td>
                        <td className="px-3 py-3 text-sm text-right text-yellow-900">{totalNetWeight.toFixed(2)}</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Expedition Details */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Détails d'Expédition</h2>

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
              </div>
            </Card>

            {/* Signatories Section */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Signataires</h2>

              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 mb-3">
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
                      className="text-sm"
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

              {signatories.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse bg-white rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Position</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Nom</th>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {signatories.map((signatory, index) => (
                        <tr key={signatory.tempId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600 font-medium">{index + 1}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-yellow-700" />
                              <span className="font-medium text-gray-900">{signatory.position}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-blue-900">{signatory.name}</td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              onClick={() => handleRemoveSignatory(signatory.tempId)}
                              variant="outline"
                              size="sm"
                              className="border-red-300 text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Documents Section */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Documents de Support</h2>

              {!showDocumentForm ? (
                <Button
                  onClick={() => setShowDocumentForm(true)}
                  variant="outline"
                  size="sm"
                  className="border-yellow-600 text-yellow-800 hover:bg-yellow-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter Document
                </Button>
              ) : (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">Titre du Document</label>
                      <Input
                        value={newDocumentTitle}
                        onChange={(e) => setNewDocumentTitle(e.target.value)}
                        placeholder="Ex: Certificat d'origine"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">Fichier</label>
                      <input
                        type="file"
                        onChange={(e) => setNewDocumentFile(e.target.files?.[0] || null)}
                        className="w-full text-sm border border-blue-300 rounded-lg p-2"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddDocument}
                      variant="outline"
                      size="sm"
                      className="border-blue-500 text-blue-800 hover:bg-blue-50"
                      disabled={!newDocumentTitle.trim() || !newDocumentFile}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Ajouter
                    </Button>
                    <Button
                      onClick={() => {
                        setShowDocumentForm(false);
                        setNewDocumentTitle('');
                        setNewDocumentFile(null);
                      }}
                      variant="outline"
                      size="sm"
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {pendingDocuments.length > 0 && (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full border-collapse bg-white rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Titre</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Fichier</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Taille</th>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pendingDocuments.map((doc, index) => (
                        <tr key={doc.tempId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-yellow-700" />
                              <span className="font-medium text-gray-900">{doc.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{doc.file.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{(doc.file.size / 1024).toFixed(2)} KB</td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              onClick={() => handleRemoveDocument(doc.tempId)}
                              variant="outline"
                              size="sm"
                              className="border-red-300 text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Action Buttons */}
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
                disabled={saving || !selectedFreightCompanyId || !selectedRefineryId || selectedProductions.length === 0 || selectedProductions.some(sp => !sp.sealNumber1.trim())}
                className="gap-2 px-8 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer Préparation'}
              </Button>
            </div>
          </div>
        </div>

        {/* Dynamic PDF Preview */}
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
                  expeditionLotNumber={generateExpeditionLotNumber()}
                  productionDate={selectedProductions[0].production.production_date}
                  miningCompany={selectedProductions[0].production.mining_company?.name || ''}
                  refineryName={selectedRefinery?.name || ''}
                  refineryAddress={selectedRefinery?.location || ''}
                  refineryCountry={selectedRefinery?.country || ''}
                  freightCompany={selectedFreightCompany?.name || ''}
                  ingots={selectedProductions.map((sp, idx) => ({
                    ingotBoxNumber: sp.production.bar_reference || `BOX-${idx + 1}`,
                    netWeight: sp.production.pure_gold_grams,
                    grossWeight: sp.production.bullion_grams,
                    sealNumber1: sp.sealNumber1,
                    sealNumber2: sp.sealNumber2,
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
      </div>

      {/* Success Dialog */}
      {showSuccessDialog && selectedProductions.length > 0 && (
        <SuccessDialog
          isOpen={showSuccessDialog}
          onClose={() => {
            setShowSuccessDialog(false);
            navigate('/shipping/preparation');
          }}
          onViewDetails={() => {
            console.log('Navigating to details page with ID:', savedPreparationId);
            setShowSuccessDialog(false);
            navigate(`/shipping/preparation/${savedPreparationId}`);
          }}
          expeditionNumber={generateExpeditionLotNumber()}
          totalBoxes={selectedProductions.length}
          totalNetWeight={totalNetWeight}
          totalGrossWeight={totalGrossWeight}
          refineryName={selectedRefinery?.name || 'N/A'}
          freightCompany={selectedFreightCompany?.name || 'N/A'}
          productionDate={selectedProductions[0]?.production.production_date || new Date().toISOString()}
        />
      )}
    </MainLayout>
  );
}
