import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Package, Save, Plus, Trash2, User, Truck, Building2, X, ArrowLeft, FileText, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MainLayout } from '@/components/layout/MainLayout';
import { DynamicPackingList } from '@/components/shipping/DynamicPackingList';
import { SuccessDialog } from '@/components/ui/SuccessDialog';
import { BusinessErrorDialog } from '@/components/ui/BusinessErrorDialog';
import { supabase } from '@/lib/supabase';
import { shippingPreparationService, ShippingPreparation } from '@/services/shippingPreparationService';
import { exportLicenseService, ExportLicense } from '@/services/exportLicenseService';
import { depositorService, Depositor } from '@/services/depositorService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PackingListPdfService } from '@/services/packingListPdfService';
import { useAuth } from '@/contexts/AuthContext';

interface DailyProduction {
  id: string;
  production_date: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  estimated_gold_pct?: number;
  estimated_silver_pct?: number;
  silver_content_grams?: number;
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

interface MiningCompany {
  id: string;
  name: string;
  code: string;
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
  const { user } = useAuth();
  const mineCompanyId = user?.mining_company_id || null;
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [selectedProductions, setSelectedProductions] = useState<SelectedProductionData[]>([]);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [signatories, setSignatories] = useState<{position: string; name: string; tempId: string}[]>([]);
  const [depositors, setDepositors] = useState<Depositor[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [freightCompanies, setFreightCompanies] = useState<TransportCompany[]>([]);
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [availableLicenses, setAvailableLicenses] = useState<ExportLicense[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [savedPreparationId, setSavedPreparationId] = useState<string>('');
  const [licenseWarning, setLicenseWarning] = useState<string>('');
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);

  // Error dialog state
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorTitle, setErrorTitle] = useState('Erreur');
  const [errorTechnicalDetails, setErrorTechnicalDetails] = useState<string | undefined>(undefined);

  // Form state
  const [selectedMiningCompanyId, setSelectedMiningCompanyId] = useState(mineCompanyId || '');
  const [expeditionLotNumber, setExpeditionLotNumber] = useState('');
  const [selectedLicenseId, setSelectedLicenseId] = useState('');
  const [selectedFreightCompanyId, setSelectedFreightCompanyId] = useState('');
  const [selectedRefineryId, setSelectedRefineryId] = useState('');
  const effectiveCompanyId = mineCompanyId || selectedMiningCompanyId;
  const mineName = mineCompanyId
    ? miningCompanies.find((company) => company.id === mineCompanyId)?.name || 'Votre société minière'
    : null;

  // Signatory form
  const [selectedDepositorId, setSelectedDepositorId] = useState('');
  const [newSignatoryPosition, setNewSignatoryPosition] = useState('');
  const [newSignatoryName, setNewSignatoryName] = useState('');

  // Document form
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const [newDocumentFile, setNewDocumentFile] = useState<File | null>(null);


  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (mineCompanyId && !isEditMode) void handleMiningCompanyChange(mineCompanyId);
  }, [mineCompanyId, isEditMode]);

  useEffect(() => {
    if (mineCompanyId && selectedMiningCompanyId !== mineCompanyId) {
      void handleMiningCompanyChange(mineCompanyId);
    }
  }, [mineCompanyId, selectedMiningCompanyId]);

  useEffect(() => {
    if (isEditMode && id) {
      loadPreparation(id);
    }
  }, [isEditMode, id]);

  useEffect(() => {
    if (selectedMiningCompanyId) {
      loadDepositors(selectedMiningCompanyId);
      // Generate expedition lot number when company changes
      generateExpeditionLotNumber().then(setExpeditionLotNumber);
    } else {
      setExpeditionLotNumber('');
    }
  }, [selectedMiningCompanyId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMiningCompanies(),
        loadFreightCompanies(),
        loadRefineries(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMiningCompanies = async () => {
    let query = supabase
      .from('mining_companies')
      .select('id, name, code, is_active')
      .eq('is_active', true)
      .order('name');
    if (mineCompanyId) query = query.eq('id', mineCompanyId);
    const { data, error } = await query;

    if (error) throw error;
    setMiningCompanies(data || []);
  };

  const loadProductions = async (miningCompanyId: string) => {
    if (!miningCompanyId) {
      setProductions([]);
      return;
    }

    // CRITICAL: Load only productions that are:
    // 1. From the selected mining company
    // 2. With status 'ready_for_customs'
    // 3. NOT already assigned to any expedition (not in shipping_production_items)
    const { data: allProductions, error: prodError } = await supabase
      .from('daily_production')
      .select(`
        *,
        mining_company:mining_companies(id, name, code)
      `)
      .eq('mining_company_id', miningCompanyId)
      .eq('status', 'ready_for_customs')
      .order('production_date', { ascending: false });

    if (prodError) throw prodError;

    // Get list of production IDs already assigned to expeditions
    const { data: assignedProductions, error: assignError } = await supabase
      .from('shipping_production_items')
      .select('daily_production_id');

    if (assignError) throw assignError;

    // Create a Set of assigned production IDs for fast lookup
    const assignedIds = new Set(
      (assignedProductions || []).map(item => item.daily_production_id)
    );

    // Filter out productions that are already assigned
    const availableProductions = (allProductions || []).filter(
      prod => !assignedIds.has(prod.id)
    );

    console.log(`📊 Productions disponibles pour ${miningCompanyId}:`, {
      total: allProductions?.length || 0,
      assigned: assignedIds.size,
      available: availableProductions.length
    });

    setProductions(availableProductions);
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

  const loadDepositors = async (miningCompanyId: string) => {
    if (!miningCompanyId) {
      setDepositors([]);
      return;
    }

    try {
      const { data, error } = await depositorService.getDepositorsByCompany(miningCompanyId);
      if (error) throw error;
      setDepositors(data || []);
    } catch (error) {
      console.error('Error loading depositors:', error);
      setDepositors([]);
    }
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

  const generateExpeditionLotNumber = async (): Promise<string> => {
    if (!selectedMiningCompanyId) return '';

    try {
      const year = new Date().getFullYear();
      const expeditionLotNumber = await shippingPreparationService.generateExpeditionLotNumber(
        selectedMiningCompanyId,
        year
      );
      console.log('✅ Generated expedition lot number:', expeditionLotNumber);
      return expeditionLotNumber;
    } catch (error) {
      console.error('❌ Error generating expedition lot number:', error);
      console.error('Mining company ID:', selectedMiningCompanyId);
      // Show error to user
      setErrorTitle('Erreur de Numéro d\'Expédition');
      setErrorMessage(
        'Impossible de générer le numéro d\'expédition automatiquement. ' +
        'Vérifiez que la compagnie minière a une abréviation configurée. ' +
        'Erreur: ' + (error as Error).message
      );
      setShowErrorDialog(true);
      // Fallback to temporary format
      const year = new Date().getFullYear();
      return `HUM-XXX-0000/${year}`;
    }
  };

  const handleMiningCompanyChange = async (companyId: string) => {
    setSelectedMiningCompanyId(companyId);
    setSelectedLicenseId('');
    setSelectedProductions([]);
    setLicenseWarning('');

    if (companyId) {
      await loadProductions(companyId);
      await loadActiveLicenses(companyId);
    } else {
      setProductions([]);
      setAvailableLicenses([]);
    }
  };

  const loadActiveLicenses = async (companyId: string) => {
    try {
      const licenses = await exportLicenseService.getActiveLicensesByCompany(companyId);
      setAvailableLicenses(licenses);

      if (licenses.length === 0) {
        setLicenseWarning('⚠️ Aucune licence active disponible pour cette compagnie');
      }
    } catch (error) {
      console.error('Error loading licenses:', error);
    }
  };

  const handleLicenseChange = async (licenseId: string) => {
    setSelectedLicenseId(licenseId);
    setLicenseWarning('');

    if (licenseId && selectedProductions.length > 0) {
      await validateLicenseQuantity(licenseId);
    }
  };

  const validateLicenseQuantity = async (licenseId: string) => {
    const totalNetWeight = selectedProductions.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);

    if (totalNetWeight > 0) {
      try {
        const availability = await exportLicenseService.checkLicenseAvailability(licenseId, totalNetWeight);

        if (!availability.is_available) {
          setLicenseWarning(`❌ ${availability.message}`);
        } else {
          setLicenseWarning(`✅ Quantité disponible: ${availability.remaining_quantity.toLocaleString()}g`);
        }
      } catch (error) {
        console.error('Error checking license:', error);
      }
    }
  };

  const handleAddProduction = (productionId: string) => {
    const production = productions.find(p => p.id === productionId);
    if (!production) return;

    const alreadySelected = selectedProductions.some(sp => sp.production.id === productionId);
    if (alreadySelected) return;

    const newSelections = [...selectedProductions, {
      production,
      sealNumber1: '',
      sealNumber2: ''
    }];

    setSelectedProductions(newSelections);

    // Re-validate license if selected
    if (selectedLicenseId) {
      const totalNetWeight = newSelections.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);
      exportLicenseService.checkLicenseAvailability(selectedLicenseId, totalNetWeight).then(availability => {
        if (!availability.is_available) {
          setLicenseWarning(`❌ ${availability.message}`);
        } else {
          setLicenseWarning(`✅ Quantité disponible: ${availability.remaining_quantity.toLocaleString()}g`);
        }
      });
    }
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

  const handleDepositorSelect = (depositorId: string) => {
    setSelectedDepositorId(depositorId);
    if (depositorId) {
      const depositor = depositors.find(d => d.id === depositorId);
      if (depositor) {
        setNewSignatoryPosition(depositor.job_title);
        setNewSignatoryName(depositor.full_name);
      }
    } else {
      setNewSignatoryPosition('');
      setNewSignatoryName('');
    }
  };

  const handleAddSignatory = () => {
    if (!newSignatoryPosition.trim() || !newSignatoryName.trim()) {
      setErrorTitle('Informations manquantes');
      setErrorMessage('Veuillez sélectionner un dépositaire ou remplir manuellement la position et le nom du signataire.');
      setShowErrorDialog(true);
      return;
    }

    setSignatories([...signatories, {
      position: newSignatoryPosition,
      name: newSignatoryName,
      tempId: `temp-${Date.now()}`
    }]);

    setSelectedDepositorId('');
    setNewSignatoryPosition('');
    setNewSignatoryName('');
  };

  const handleRemoveSignatory = (tempId: string) => {
    setSignatories(signatories.filter(s => s.tempId !== tempId));
  };

  const handleAddDocument = () => {
    if (!newDocumentTitle.trim() || !newDocumentFile) {
      setErrorTitle('Informations manquantes');
      setErrorMessage('Veuillez remplir le titre et sélectionner un fichier pour le document.');
      setShowErrorDialog(true);
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

  const handleSendPackingListByEmail = async () => {
    try {
      if (selectedProductions.length === 0) {
        setErrorTitle('Aucune production sélectionnée');
        setErrorMessage('Veuillez sélectionner au moins une production avant d\'envoyer le packing list.');
        setShowErrorDialog(true);
        return;
      }

      if (!selectedRefinery) {
        setErrorTitle('Raffinerie non sélectionnée');
        setErrorMessage('Veuillez sélectionner une raffinerie avant d\'envoyer le packing list.');
        setShowErrorDialog(true);
        return;
      }

      // Préparer les données du packing list
      const packingListData = {
        expeditionLotNumber,
        productionDate: selectedProductions[0].production.production_date,
        miningCompany: selectedProductions[0].production.mining_company?.name || '',
        refineryName: selectedRefinery.name,
        refineryAddress: selectedRefinery.location,
        refineryCountry: selectedRefinery.country,
        freightCompany: selectedFreightCompany?.name,
        ingots: selectedProductions.map((sp, idx) => ({
          ingotBoxNumber: sp.production.bar_reference || `BOX-${idx + 1}`,
          netWeight: sp.production.pure_gold_grams,
          grossWeight: sp.production.bullion_grams,
          sealNumber1: sp.sealNumber1,
          sealNumber2: sp.sealNumber2,
        })),
        signatories: signatories.map(s => ({
          position: s.position,
          name: s.name,
        })),
      };

      // Envoyer via Outlook
      await PackingListPdfService.sendViaOutlook(packingListData);

    } catch (error) {
      console.error('Erreur lors de l\'envoi par email:', error);
      setErrorTitle('Erreur d\'envoi');
      setErrorMessage('Une erreur est survenue lors de la préparation de l\'email. Veuillez réessayer.');
      setShowErrorDialog(true);
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
    if (!effectiveCompanyId) {
      setErrorTitle('Compagnie minière requise');
      setErrorMessage('Veuillez sélectionner une compagnie minière avant de continuer.');
      setShowErrorDialog(true);
      return;
    }

    if (!selectedLicenseId) {
      setErrorTitle('Licence d\'exportation requise');
      setErrorMessage('Veuillez sélectionner une licence d\'exportation valide.');
      setShowErrorDialog(true);
      return;
    }

    if (selectedProductions.length === 0) {
      setErrorTitle('Production requise');
      setErrorMessage('Veuillez sélectionner au moins une production à expédier.');
      setShowErrorDialog(true);
      return;
    }

    // Validate license availability
    const totalNetWeight = selectedProductions.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);
    try {
      const availability = await exportLicenseService.checkLicenseAvailability(selectedLicenseId, totalNetWeight);

      if (!availability.is_available) {
        setErrorTitle('Licence insuffisante');
        setErrorMessage(availability.message);
        setShowErrorDialog(true);
        return;
      }
    } catch (error) {
      console.error('Error checking license:', error);
      setErrorTitle('Erreur de vérification');
      setErrorMessage('Impossible de vérifier la disponibilité de la licence. Veuillez réessayer.');
      setShowErrorDialog(true);
      return;
    }

    if (!selectedFreightCompanyId || !selectedRefineryId) {
      setErrorTitle('Informations de transport requises');
      setErrorMessage('Veuillez sélectionner une Freight Company et une Refinery (destination).');
      setShowErrorDialog(true);
      return;
    }

    // Check if all productions have at least seal number 1
    const missingSealNumbers = selectedProductions.filter(sp => !sp.sealNumber1.trim());
    if (missingSealNumbers.length > 0) {
      setErrorTitle('Seal Numbers manquants');
      setErrorMessage('Veuillez saisir au moins le Seal Number 1 pour toutes les productions sélectionnées.');
      setShowErrorDialog(true);
      return;
    }

    try {
      setSaving(true);

      // Calculate total weights
      const totalNetWeightGrams = selectedProductions.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);
      const totalGrossWeightGrams = selectedProductions.reduce((sum, sp) => sum + sp.production.bullion_grams, 0);
      const totalNetWeightOz = totalNetWeightGrams / 31.1034768;
      const totalBoxes = selectedProductions.length; // Nombre de productions = nombre de boxes

      const prepData = {
        expedition_lot_number: expeditionLotNumber,
        seal_number: selectedProductions[0].sealNumber1, // For backward compatibility
        mining_company_id: effectiveCompanyId,
        export_license_id: selectedLicenseId,
        freight_company_id: selectedFreightCompanyId,  // ✅ CORRECTED: Use proper column
        refinery_id: selectedRefineryId,                // ✅ CORRECTED: Use proper column
        total_net_weight_grams: totalNetWeightGrams,
        total_gross_weight_grams: totalGrossWeightGrams,
        total_weight_oz: totalNetWeightOz,
        total_boxes: totalBoxes,
        status: 'waiting_for_customs_approval' as const,  // Statut initial du workflow
        prepared_at: new Date().toISOString(),
      };

      // DEBUG: Vérifier les données avant envoi
      console.log('=== DEBUG SHIPPING PREPARATION ===');
      console.log('prepData.status:', prepData.status);
      console.log('Full prepData:', JSON.stringify(prepData, null, 2));
      console.log('==================================');

      let prepId: string;

      if (preparation) {
        console.log('UPDATE MODE - preparation.id:', preparation.id);
        console.log('preparation actuelle:', preparation);
        await shippingPreparationService.updatePreparation(preparation.id, prepData);
        prepId = preparation.id;
      } else {
        console.log('CREATE MODE - Nouvelle préparation');
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

      // Reserve license quota
      console.log('Reserving license quota...');
      try {
        await shippingPreparationService.reserveLicenseQuota(
          selectedLicenseId,
          prepId,
          totalNetWeightGrams
        );
        console.log('License quota reserved successfully');
      } catch (err) {
        console.error('Failed to reserve license quota:', err);
        // Rollback - delete the preparation since we couldn't reserve quota
        throw new Error(`Impossible de réserver le quota de licence: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
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

      // Extract business message and technical details
      let businessMessage = 'Il y a eu un problème technique lors de l\'enregistrement de la préparation.';
      let technicalDetails: string | undefined;

      if (error instanceof Error) {
        businessMessage = error.message;
        // Check if error has technical details attached
        const errorWithDetails = error as any;
        if (errorWithDetails.technicalDetails) {
          technicalDetails = errorWithDetails.technicalDetails;
        } else {
          // Fallback: use the original error message as technical details
          technicalDetails = `Erreur: ${error.message}\nStack: ${error.stack || 'N/A'}`;
        }
      } else if (typeof error === 'object' && error !== null) {
        const err = error as any;
        if (err.message) {
          businessMessage = err.message;
        }
        technicalDetails = JSON.stringify(err, null, 2);
      }

      setErrorTitle('Erreur lors de l\'enregistrement');
      setErrorMessage(businessMessage);
      setErrorTechnicalDetails(technicalDetails);
      setShowErrorDialog(true);
    } finally {
      setSaving(false);
    }
  };

  const selectedRefinery = refineries.find(r => r.id === selectedRefineryId);
  const selectedFreightCompany = freightCompanies.find(fc => fc.id === selectedFreightCompanyId);
  const totalNetWeight = selectedProductions.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);
  const totalGrossWeight = selectedProductions.reduce((sum, sp) => sum + sp.production.bullion_grams, 0);
  const totalSilverContent = selectedProductions.reduce((sum, sp) => sum + (sp.production.silver_content_grams || 0), 0);
  const avgGoldPct = selectedProductions.length > 0
    ? selectedProductions.reduce((sum, sp) => sum + (sp.production.estimated_gold_pct || sp.production.estimated_fineness_pct), 0) / selectedProductions.length
    : 0;
  const avgSilverPct = selectedProductions.length > 0
    ? selectedProductions.reduce((sum, sp) => sum + (sp.production.estimated_silver_pct || 0), 0) / selectedProductions.length
    : 0;

  return (
    <MainLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-50">
        {/* Form Section */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => navigate('/shipping/preparation')}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 px-3"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Retour
                </Button>
                <div className="p-2 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg shadow">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {isEditMode ? 'Modifier Expédition' : 'Nouvelle Expédition'}
                    {mineName && <span className="text-emerald-700"> — {mineName}</span>}
                  </h1>
                  <p className="text-xs text-gray-500">Préparez les barres pour l'expédition</p>
                </div>
              </div>
            </div>

            {/* Mining Company & License Selection - Same Row */}
            <Card className="p-4 border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="grid grid-cols-2 gap-4">
                {mineCompanyId ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Mine expéditrice</span>
                    <strong className="mt-1 block text-sm text-emerald-950">{mineName}</strong>
                    <small className="mt-1 block text-[11px] leading-snug text-emerald-700">Périmètre fixé par votre compte</small>
                  </div>
                ) : (
                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Compagnie Minière *
                  </label>
                  <select
                    value={selectedMiningCompanyId}
                    onChange={(e) => handleMiningCompanyChange(e.target.value)}
                    className="w-full px-3 py-1.5 border border-blue-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white text-xs font-medium"
                    disabled={loading}
                  >
                    <option value="">-- Sélectionner une compagnie minière --</option>
                    {miningCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.code})
                      </option>
                    ))}
                  </select>
                  {selectedMiningCompanyId && (
                    <p className="mt-2 text-xs text-blue-600">
                      ✓ Seules les productions de cette compagnie seront disponibles
                    </p>
                  )}
                </div>
                )}

                {/* License Selection */}
                <div>
                  <label className="block text-xs font-semibold text-green-900 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Licence d'Exportation *
                  </label>
                  <select
                    value={selectedLicenseId}
                    onChange={(e) => handleLicenseChange(e.target.value)}
                    className="w-full px-3 py-1.5 border border-green-300 rounded-md focus:ring-1 focus:ring-green-500 bg-white text-xs font-medium"
                    disabled={loading || !selectedMiningCompanyId || availableLicenses.length === 0}
                  >
                    <option value="">
                      {!selectedMiningCompanyId
                        ? '-- Sélectionner d\'abord une compagnie --'
                        : availableLicenses.length === 0
                        ? '-- Aucune licence active disponible --'
                        : '-- Sélectionner une licence --'}
                    </option>
                    {availableLicenses.map((license) => (
                      <option key={license.id} value={license.id}>
                        {license.license_number} - Restant: {license.remaining_quantity_grams.toLocaleString()}g
                        (Expire: {new Date(license.end_date).toLocaleDateString('fr-FR')})
                      </option>
                    ))}
                  </select>
                  {selectedMiningCompanyId && availableLicenses.length === 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                      ⚠️ Aucune licence d'exportation active pour cette compagnie.
                    </div>
                  )}
                </div>
              </div>

              {/* License Warning - Full Width */}
              {licenseWarning && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${
                  licenseWarning.startsWith('❌')
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : licenseWarning.startsWith('⚠️')
                    ? 'bg-orange-100 text-orange-800 border border-orange-300'
                    : 'bg-green-100 text-green-800 border border-green-300'
                }`}>
                  {licenseWarning}
                </div>
              )}
            </Card>

            {/* Production Selection & Table - Only show if license is selected */}
            {selectedLicenseId && (
              <Card className="p-4 border border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-yellow-900">
                    Productions ({selectedProductions.length})
                  </h3>
                  <select
                    onChange={(e) => {
                      handleAddProduction(e.target.value);
                      e.target.value = '';
                    }}
                    className="px-3 py-1.5 border border-yellow-300 rounded-md focus:ring-1 focus:ring-yellow-500 bg-white text-xs"
                    disabled={loading || !selectedMiningCompanyId || productions.length === 0}
                    value=""
                  >
                    <option value="">
                      {!selectedMiningCompanyId
                        ? '-- Sélectionnez une compagnie d\'abord --'
                        : productions.length === 0
                        ? '-- Aucune production disponible --'
                        : '-- Ajouter --'}
                    </option>
                    {productions
                      .filter(p => !selectedProductions.some(sp => sp.production.id === p.id))
                      .map((production) => (
                        <option key={production.id} value={production.id}>
                          {new Date(production.production_date).toLocaleDateString('fr-FR')} - {production.bar_reference} - {production.bullion_grams.toFixed(2)}g
                        </option>
                      ))}
                  </select>
                </div>

                {/* Info message when no productions available */}
                {selectedMiningCompanyId && productions.length === 0 && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-700">
                      ℹ️ Aucune production disponible pour cette compagnie.
                      Toutes les productions avec le statut "Prêt pour la douane" ont déjà été assignées à des expéditions.
                    </p>
                  </div>
                )}

              {selectedProductions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse bg-white rounded-md overflow-hidden shadow-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">#</th>
                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">Date</th>
                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">Bar Ref</th>
                        <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">Bullion (g)</th>
                        <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">Au%</th>
                        <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">Pure Au (g)</th>
                        <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">Ag%</th>
                        <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">Ag (g)</th>
                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">Seal 1 *</th>
                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">Seal 2</th>
                        <th className="px-2 py-2 text-center text-[10px] font-bold uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedProductions.map((sp, index) => (
                        <tr key={sp.production.id} className="hover:bg-yellow-50 transition-colors">
                          <td className="px-2 py-1.5 text-xs font-bold text-gray-600">{index + 1}</td>
                          <td className="px-2 py-1.5 text-xs">{new Date(sp.production.production_date).toLocaleDateString('fr-FR')}</td>
                          <td className="px-2 py-1.5 text-xs font-mono font-semibold">{sp.production.bar_reference}</td>
                          <td className="px-2 py-1.5 text-xs text-right font-semibold">{sp.production.bullion_grams.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-xs text-right font-semibold text-yellow-600">{(sp.production.estimated_gold_pct || sp.production.estimated_fineness_pct).toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-xs text-right font-semibold text-yellow-800">{sp.production.pure_gold_grams.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-600">{(sp.production.estimated_silver_pct || 0).toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-700">{(sp.production.silver_content_grams || 0).toFixed(2)}</td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={sp.sealNumber1}
                              onChange={(e) => handleSealNumber1Change(sp.production.id, e.target.value)}
                              placeholder="0097099"
                              className="w-24 text-[10px] h-6 px-2"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={sp.sealNumber2}
                              onChange={(e) => handleSealNumber2Change(sp.production.id, e.target.value)}
                              placeholder="0097100"
                              className="w-24 text-[10px] h-6 px-2"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <Button
                              onClick={() => handleRemoveProduction(sp.production.id)}
                              variant="outline"
                              size="sm"
                              className="border-red-300 text-red-600 hover:bg-red-50 h-6 w-6 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {/* Totals Row */}
                      <tr className="bg-gradient-to-r from-yellow-100 to-amber-100 font-bold border-t-2 border-yellow-400">
                        <td colSpan={3} className="px-2 py-2 text-xs text-yellow-900">TOTAL ({selectedProductions.length} boxes)</td>
                        <td className="px-2 py-2 text-xs text-right text-yellow-900">{totalGrossWeight.toFixed(2)}</td>
                        <td className="px-2 py-2 text-xs text-right text-yellow-700">{avgGoldPct.toFixed(2)}%</td>
                        <td className="px-2 py-2 text-xs text-right text-yellow-900">{totalNetWeight.toFixed(2)}</td>
                        <td className="px-2 py-2 text-xs text-right text-gray-600">{avgSilverPct.toFixed(2)}%</td>
                        <td className="px-2 py-2 text-xs text-right text-gray-700">{totalSilverContent.toFixed(2)}</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {selectedProductions.length === 0 && (
                <div className="text-center py-12 text-yellow-700 bg-yellow-100 rounded-lg border border-yellow-300">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-40" />
                  <p className="font-medium text-lg mb-2">Aucune production sélectionnée</p>
                  <p className="text-sm">Utilisez le menu déroulant ci-dessus pour ajouter des productions à cette expédition</p>
                </div>
              )}
              </Card>
            )}

            {/* Expedition Details */}
            <Card className="p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Détails d'Expédition</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    Freight Company *
                  </label>
                  <select
                    value={selectedFreightCompanyId}
                    onChange={(e) => setSelectedFreightCompanyId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 text-xs"
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Refinery *
                  </label>
                  <select
                    value={selectedRefineryId}
                    onChange={(e) => setSelectedRefineryId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 text-xs"
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
            <Card className="p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Signataires</h2>

              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-md p-3 mb-3">
                {!selectedMiningCompanyId ? (
                  <div className="text-center text-amber-700 text-sm py-4">
                    Veuillez d'abord sélectionner une compagnie minière pour voir les dépositaires
                  </div>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-yellow-800 mb-1">
                        Sélectionner un Dépositaire
                      </label>
                      <select
                        value={selectedDepositorId}
                        onChange={(e) => handleDepositorSelect(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      >
                        <option value="">-- Sélectionner --</option>
                        {depositors
                          .filter(depositor => !signatories.some(sig => sig.name === depositor.full_name))
                          .map((depositor) => (
                            <option key={depositor.id} value={depositor.id}>
                              {depositor.full_name} - {depositor.job_title}
                            </option>
                          ))}
                      </select>
                      {depositors.filter(depositor => !signatories.some(sig => sig.name === depositor.full_name)).length === 0 && depositors.length > 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Tous les dépositaires ont déjà été ajoutés. Vous pouvez saisir manuellement ci-dessous.
                        </p>
                      )}
                      {depositors.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Aucun dépositaire trouvé. Vous pouvez saisir manuellement ci-dessous.
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-yellow-800 mb-1">Position</label>
                        <Input
                          value={newSignatoryPosition}
                          onChange={(e) => setNewSignatoryPosition(e.target.value)}
                          placeholder="Titre du poste"
                          className="text-sm"
                        />
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
                  </>
                )}
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
            <div className="flex items-center justify-end gap-2 py-3">
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
                className="gap-1.5 px-4 py-2 border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 shadow-sm text-xs"
              >
                <X className="w-3.5 h-3.5" />
                Annuler
              </Button>
              <Button
                onClick={handleSavePreparation}
                disabled={saving || !selectedMiningCompanyId || !selectedLicenseId || !selectedFreightCompanyId || !selectedRefineryId || selectedProductions.length === 0 || selectedProductions.some(sp => !sp.sealNumber1.trim()) || licenseWarning.startsWith('❌')}
                size="sm"
                className="gap-1.5 px-6 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>

        {/* Dynamic PDF Preview - Collapsible */}
        <div className={`${isPreviewCollapsed ? 'w-12' : 'w-[650px]'} bg-white border-l-4 border-yellow-500 flex flex-col overflow-hidden shadow-2xl transition-all duration-300`}>
          <div className="p-3 bg-gradient-to-r from-yellow-500 to-amber-600 border-b-2 border-yellow-700 flex items-center justify-between">
            {!isPreviewCollapsed && (
              <div className="flex-1">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Packing List Preview
                </h3>
                <p className="text-xs text-yellow-100">Mise à jour en temps réel</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {!isPreviewCollapsed && selectedProductions.length > 0 && (
                <button
                  onClick={handleSendPackingListByEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-yellow-700 hover:bg-yellow-50 rounded-md transition-colors text-xs font-semibold shadow-sm"
                  title="Envoyer par email (Outlook)"
                >
                  <Send className="w-3.5 h-3.5" />
                  Envoyer par Email
                </button>
              )}
              <button
                onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)}
                className="p-1.5 hover:bg-yellow-600 rounded-md transition-colors"
                title={isPreviewCollapsed ? 'Ouvrir le preview' : 'Fermer le preview'}
              >
                {isPreviewCollapsed ? (
                  <ChevronLeft className="w-5 h-5 text-white" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>
          {!isPreviewCollapsed && (
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {selectedProductions.length > 0 ? (
              <div className="bg-white rounded-lg shadow-xl">
                <DynamicPackingList
                  expeditionLotNumber={expeditionLotNumber}
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
          )}
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
          expeditionNumber={expeditionLotNumber}
          totalBoxes={selectedProductions.length}
          totalNetWeight={totalNetWeight}
          totalGrossWeight={totalGrossWeight}
          refineryName={selectedRefinery?.name || 'N/A'}
          freightCompany={selectedFreightCompany?.name || 'N/A'}
          productionDate={selectedProductions[0]?.production.production_date || new Date().toISOString()}
        />
      )}

      {/* Error Dialog */}
      <BusinessErrorDialog
        isOpen={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        title={errorTitle}
        message={errorMessage}
        technicalDetails={errorTechnicalDetails}
      />
    </MainLayout>
  );
}
