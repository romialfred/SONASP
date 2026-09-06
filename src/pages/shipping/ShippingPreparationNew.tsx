import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Package, Save, Plus, Trash2, Truck, Building2, ArrowLeft, FileText, Send, Circle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { PageHeader, Section, Field, FormActions, Note, Card as SnCard } from '@/components/ui/sn';
import { logisticsNumber, logisticsDate } from '@/components/shipping/LogisticsRegister';
import { shippingPreparationDetailsPath } from '@/lib/shippingRoutes';
import { UPLOAD_POLICIES, validateUploadFile } from '@/lib/uploadValidation';
import { DynamicPackingList } from '@/components/shipping/DynamicPackingList';
import { BusinessErrorDialog } from '@/components/ui/BusinessErrorDialog';
import { supabase } from '@/lib/supabase';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { shippingPreparationService, ShippingPreparation } from '@/services/shippingPreparationService';
import {
  exportLicenseService,
  isExportLicenseSelectable,
  type ExportLicense,
} from '@/services/exportLicenseService';
import { depositorService, Depositor } from '@/services/depositorService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '@/contexts/AuthContext';
import { ShippingLicenseSelect } from '@/components/shipping/ShippingLicenseSelect';
import {
  summarizeShippingProductionIssues,
  validateShippingProduction,
  validateShippingProductionSelection,
  type ShippingProductionCandidate,
} from './shippingPreparationValidation';

interface DailyProduction {
  id: string;
  production_date: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  estimated_gold_pct?: number | null;
  estimated_silver_pct?: number | null;
  silver_content_grams?: number;
  pure_gold_grams: number;
  estimated_oz: number;
  bar_reference: string | null;
  notes: string | null;
  mining_company_id: string | null;
  status: string | null;
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
  is_active: boolean | null;
}

interface Refinery {
  id: string;
  name: string;
  location: string;
  country: string;
  is_active: boolean | null;
}

interface MiningCompany {
  id: string;
  name: string;
  code: string;
  is_active: boolean | null;
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

function toShippingProductionCandidate(production: DailyProduction): ShippingProductionCandidate {
  return {
    id: production.id,
    reference: production.bar_reference,
    miningCompanyId: production.mining_company_id,
    status: production.status,
    grossWeightGrams: production.bullion_grams,
    // The current preparation payload uses fine-gold weight as its net shipment weight.
    netWeightGrams: production.pure_gold_grams,
    pureGoldGrams: production.pure_gold_grams,
    finenessPercent: production.estimated_fineness_pct,
  };
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
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [savedPreparationId, setSavedPreparationId] = useState<string>('');
  const [licenseWarning, setLicenseWarning] = useState<string>('');
  const [productionSelectionError, setProductionSelectionError] = useState('');
  const [excludedProductionCount, setExcludedProductionCount] = useState(0);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(true);
  const saveLock = useRef(false);
  const pendingCreationId = useRef<string | null>(null);
  const companyRequest = useRef(0);

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
      console.error('Erreur lors du chargement des données initiales :', error);
      setErrorMessage('Impossible de charger les référentiels du formulaire. Actualisez la page avant de poursuivre.');
      setShowErrorDialog(true);
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
    const request = companyRequest.current;
    if (!miningCompanyId) {
      setProductions([]);
      setExcludedProductionCount(0);
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
    if (request !== companyRequest.current) return;

    // Create a Set of assigned production IDs for fast lookup
    const assignedIds = new Set(
      (assignedProductions || []).map(item => item.daily_production_id)
    );

    // Filter out productions that are already assigned
    const availableProductions = (allProductions || []).filter(
      prod => !assignedIds.has(prod.id)
    );



    const normalizedProductions = availableProductions.map((production) => ({
        ...production,
        bullion_grams: production.bullion_grams ?? 0,
        pure_gold_grams: production.pure_gold_grams ?? 0,
        estimated_oz: production.estimated_oz ?? 0,
        silver_content_grams: production.silver_content_grams ?? undefined,
        mining_company: production.mining_company ?? undefined,
      }));
    const admissibleProductions = normalizedProductions.filter((production) =>
      validateShippingProduction(toShippingProductionCandidate(production), miningCompanyId).length === 0);

    setExcludedProductionCount(normalizedProductions.length - admissibleProductions.length);
    setProductions(admissibleProductions);
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
    const request = companyRequest.current;
    if (!miningCompanyId) {
      setDepositors([]);
      return;
    }

    try {
      const { data, error } = await depositorService.getDepositorsByCompany(miningCompanyId);
      if (error) throw error;
      if (request !== companyRequest.current) return;
      setDepositors(data || []);
    } catch (error) {
      if (request !== companyRequest.current) return;
      console.error('Erreur lors du chargement des dépositaires :', error);
      setDepositors([]);
    }
  };

  const loadPreparation = async (prepId: string) => {
    try {
      const prep = await shippingPreparationService.getPreparationById(prepId);
      if (prep) {
        setPreparation(prep);
        setSelectedFreightCompanyId(prep.freight_company_id || '');
        setSelectedRefineryId(prep.refinery_id || '');
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la préparation :', error);
    }
  };

  const handleMiningCompanyChange = async (companyId: string) => {
    if (mineCompanyId && companyId !== mineCompanyId) return;
    const request = ++companyRequest.current;
    setSelectedMiningCompanyId(companyId);
    setSelectedLicenseId('');
    setSelectedProductions([]);
    setProductions([]);
    setAvailableLicenses([]);
    setSignatories([]);
    setDepositors([]);
    setSelectedDepositorId('');
    setNewSignatoryName('');
    setNewSignatoryPosition('');
    setExpeditionLotNumber('');
    setLicenseWarning('');
    setProductionSelectionError('');
    setExcludedProductionCount(0);

    setLoadingCompany(Boolean(companyId));
    if (companyId) {
      try { await Promise.all([loadProductions(companyId), loadActiveLicenses(companyId)]); }
      catch {
        if (request === companyRequest.current) {
          setErrorMessage('Impossible de charger les productions de cette société. Sélectionnez-la de nouveau pour réessayer.');
          setShowErrorDialog(true);
        }
      } finally { if (request === companyRequest.current) setLoadingCompany(false); }
    } else {
      setProductions([]);
      setAvailableLicenses([]);
    }
  };

  const loadActiveLicenses = async (companyId: string) => {
    const request = companyRequest.current;
    if (mineCompanyId && companyId !== mineCompanyId) {
      setAvailableLicenses([]);
      setSelectedLicenseId('');
      setLicenseWarning('Cette société minière ne relève pas de votre périmètre autorisé.');
      return;
    }
    try {
      const licenses = await exportLicenseService.getActiveLicensesByCompany(companyId);
      if (request !== companyRequest.current) return;
      const selectableLicenses = licenses.filter((license) =>
        isExportLicenseSelectable(license, companyId));
      setAvailableLicenses(selectableLicenses);

      if (selectableLicenses.length === 0) {
        setLicenseWarning('Aucune licence active n’est disponible pour cette société.');
      }
    } catch (error) {
      if (request !== companyRequest.current) return;
      console.error('Erreur lors du chargement des licences :', error);
      setAvailableLicenses([]);
      setSelectedLicenseId('');
      setLicenseWarning('Impossible de charger les licences et les quotas disponibles.');
    }
  };

  const handleLicenseChange = async (licenseId: string) => {
    if (licenseId && !availableLicenses.some((license) => license.id === licenseId)) {
      setSelectedLicenseId('');
      setLicenseWarning('Cette licence n’est pas active pour la société sélectionnée.');
      return;
    }
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
          setLicenseWarning(`Quota disponible : ${availability.remaining_quantity.toLocaleString('fr-FR')} g`);
        }
      } catch (error) {
        console.error('Erreur lors du contrôle de la licence :', error);
        setLicenseWarning('Impossible de vérifier le quota disponible de la licence.');
      }
    }
  };

  const handleAddProduction = (productionId: string) => {
    if (!productionId) {
      setProductionSelectionError('');
      return;
    }
    const production = productions.find(p => p.id === productionId);
    if (!production) {
      setProductionSelectionError('La production sélectionnée n’est plus disponible. Actualisez la liste avant de poursuivre.');
      return;
    }

    const issues = validateShippingProduction(
      toShippingProductionCandidate(production),
      effectiveCompanyId,
    );
    if (issues.length > 0) {
      setProductionSelectionError(summarizeShippingProductionIssues(issues));
      return;
    }

    const alreadySelected = selectedProductions.some(sp => sp.production.id === productionId);
    if (alreadySelected) {
      setProductionSelectionError('Ce lot de production est déjà inclus dans la préparation.');
      return;
    }

    const newSelections = [...selectedProductions, {
      production,
      sealNumber1: '',
      sealNumber2: ''
    }];

    setSelectedProductions(newSelections);
    setProductionSelectionError('');

    // Re-validate license if selected
    if (selectedLicenseId) {
      const totalNetWeight = newSelections.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);
      void exportLicenseService.checkLicenseAvailability(selectedLicenseId, totalNetWeight)
        .then((availability) => {
          if (!availability.is_available) {
            setLicenseWarning(`❌ ${availability.message}`);
          } else {
            setLicenseWarning(`Quota disponible : ${availability.remaining_quantity.toLocaleString('fr-FR')} g`);
          }
        })
        .catch(() => setLicenseWarning('Impossible de vérifier le quota disponible de la licence.'));
    }
  };

  const handleRemoveProduction = (productionId: string) => {
    const remainingSelections = selectedProductions.filter(sp => sp.production.id !== productionId);
    setSelectedProductions(remainingSelections);
    setProductionSelectionError('');
    if (!selectedLicenseId) return;
    const totalNetWeight = remainingSelections.reduce(
      (sum, selection) => sum + selection.production.pure_gold_grams,
      0,
    );
    if (totalNetWeight <= 0) {
      setLicenseWarning('');
      return;
    }
    void exportLicenseService.checkLicenseAvailability(selectedLicenseId, totalNetWeight)
      .then((availability) => setLicenseWarning(
        availability.is_available
          ? `Quota disponible : ${availability.remaining_quantity.toLocaleString('fr-FR')} g`
          : `❌ ${availability.message}`,
      ))
      .catch(() => setLicenseWarning('Impossible de vérifier le quota disponible de la licence.'));
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
      setErrorMessage('Sélectionnez un signataire enregistré ou saisissez son nom complet et sa fonction.');
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
      setErrorMessage('Saisissez un titre de document et sélectionnez un fichier.');
      setShowErrorDialog(true);
      return;
    }
    try { validateUploadFile(newDocumentFile, UPLOAD_POLICIES.shippingDocument); }
    catch (error) {
      setErrorTitle('Document non pris en charge');
      setErrorMessage(error instanceof Error ? error.message : 'Vérifiez le type et la taille du fichier.');
      setShowErrorDialog(true);
      return;
    }

    setPendingDocuments([...pendingDocuments, {
      file: newDocumentFile,
      title: newDocumentTitle.trim(),
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
    if (confirm('Quitter ce formulaire ? Les informations non enregistrées seront perdues.')) {
      navigate('/shipping/preparation');
    }
  };

  const handleSendPackingListByEmail = async () => {
    try {
      if (selectedProductions.length === 0) {
        setErrorTitle('Aucune production sélectionnée');
        setErrorMessage('Sélectionnez au moins un lot de production avant de préparer le courriel.');
        setShowErrorDialog(true);
        return;
      }

      const productionIssues = validateShippingProductionSelection(
        selectedProductions.map(({ production }) => toShippingProductionCandidate(production)),
        effectiveCompanyId,
      );
      if (productionIssues.length > 0) {
        setProductionSelectionError(summarizeShippingProductionIssues(productionIssues));
        document.getElementById('shipping-production-select')?.focus();
        return;
      }

      if (!selectedRefinery) {
        setErrorTitle('Aucune raffinerie sélectionnée');
        setErrorMessage('Sélectionnez la raffinerie de destination avant de préparer le courriel.');
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
      const { PackingListPdfService } = await import('@/services/packingListPdfService');
      await PackingListPdfService.sendViaOutlook(packingListData);

    } catch (error) {
      console.error('Erreur lors de la préparation du courriel :', error);
      setErrorTitle('Courriel non préparé');
      setErrorMessage('Impossible de préparer le courriel. Vérifiez la destination, puis réessayez.');
      setShowErrorDialog(true);
    }
  };

  const generateAndUploadPackingList = async (preparationId: string, expeditionLotNumber: string) => {
    const tempContainer = document.createElement('div');
    let root: import('react-dom/client').Root | undefined;
    try {
      // Create a temporary container for the packing list
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '210mm'; // A4 width
      tempContainer.style.background = 'white';
      document.body.appendChild(tempContainer);

      // Render the packing list into the container
      const { createRoot } = await import('react-dom/client');
      root = createRoot(tempContainer);

      await new Promise<void>((resolve) => {
        root!.render(
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
      const pdfFile = new File([pdfBlob], `Packing-List-${expeditionLotNumber.replace(/[\\/]/g, '-')}.pdf`, { type: 'application/pdf' });

      // Upload to Supabase
      const packingListDocument = await shippingPreparationService.uploadDocument(
        preparationId,
        pdfFile,
        `Packing List - ${expeditionLotNumber}`
      );

      // Les colonnes legacy conservent désormais la référence privée canonique.
      await shippingPreparationService.updatePreparation(preparationId, {
        packing_list_url: packingListDocument.document_url,
        packing_list_document_id: packingListDocument.id,
      });

    } finally {
      root?.unmount();
      tempContainer.remove();
    }
  };

  const handleSavePreparation = async () => {
    if (saveLock.current || showSuccessDialog) return;
    saveLock.current = true;
    try {
    if (!effectiveCompanyId) {
      setErrorTitle('Société minière obligatoire');
      setErrorMessage('Sélectionnez une société minière avant de poursuivre.');
      setShowErrorDialog(true);
      return;
    }

    if (!selectedLicenseId) {
      setErrorTitle('Licence d’exportation obligatoire');
      setErrorMessage('Sélectionnez une licence d’exportation valide.');
      setShowErrorDialog(true);
      return;
    }

    if (!preparation && !availableLicenses.some((license) =>
      license.id === selectedLicenseId
      && isExportLicenseSelectable(license, effectiveCompanyId))) {
      setErrorTitle('Licence non autorisée');
      setErrorMessage('Cette licence est inactive, appartient à une autre société ou ne dispose d’aucun quota disponible.');
      setShowErrorDialog(true);
      return;
    }

    if (selectedProductions.length === 0) {
      setErrorTitle('Production obligatoire');
      setErrorMessage('Sélectionnez au moins un lot de production à expédier.');
      setErrorTechnicalDetails(undefined);
      setProductionSelectionError('Sélectionnez au moins un lot de production admissible.');
      setShowErrorDialog(true);
      document.getElementById('shipping-production-select')?.focus();
      return;
    }
    const productionIssues = validateShippingProductionSelection(
      selectedProductions.map(({ production }) => toShippingProductionCandidate(production)),
      effectiveCompanyId,
    );
    if (productionIssues.length > 0) {
      const validationMessage = summarizeShippingProductionIssues(productionIssues);
      setErrorTitle('Production non valide');
      setErrorMessage(validationMessage);
      setErrorTechnicalDetails(undefined);
      setProductionSelectionError(validationMessage);
      setShowErrorDialog(true);
      document.getElementById('shipping-production-select')?.focus();
      return;
    }
    setProductionSelectionError('');

    // On resume the existing reservation is revalidated by the authoritative RPC.
    const totalNetWeight = selectedProductions.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);
    if (!preparation) try {
      const availability = await exportLicenseService.checkLicenseAvailability(selectedLicenseId, totalNetWeight);

      if (!availability.is_available) {
        setErrorTitle('Quota de licence insuffisant');
        setErrorMessage(availability.message);
        setShowErrorDialog(true);
        return;
      }
    } catch (error) {
      console.error('Erreur lors du contrôle de la licence :', error);
      setErrorTitle('Contrôle de licence indisponible');
      setErrorMessage('Impossible de vérifier la disponibilité de la licence. Réessayez.');
      setShowErrorDialog(true);
      return;
    }

    if (!selectedFreightCompanyId || !selectedRefineryId) {
      setErrorTitle('Informations de transport obligatoires');
      setErrorMessage('Sélectionnez un transporteur et une raffinerie de destination.');
      setShowErrorDialog(true);
      return;
    }

    // Check if all productions have at least seal number 1
    const missingSealNumbers = selectedProductions.filter(sp => !sp.sealNumber1.trim());
    if (missingSealNumbers.length > 0) {
      setErrorTitle('Numéros de scellé manquants');
      setErrorMessage('Saisissez le premier numéro de scellé de chaque lot sélectionné.');
      setShowErrorDialog(true);
      return;
    }

    try {
      setSaving(true);

      // Poids agrégés (le poids net d'expédition = l'or fin, comme le colisage).
      const totalNetWeightGrams = selectedProductions.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);
      const totalGrossWeightGrams = selectedProductions.reduce((sum, sp) => sum + sp.production.bullion_grams, 0);
      const preparedAt = new Date().toISOString();

      let prepId: string;
      let reference: string;

      if (preparation) {
        // Édition d'une préparation déjà créée : la référence canonique existe.
        reference = preparation.expedition_lot_number || expeditionLotNumber;
        if (!reference) throw new Error('La référence de l’expédition est introuvable pour cette préparation.');
        await shippingPreparationService.updatePreparation(preparation.id, {
          seal_number: selectedProductions[0].sealNumber1,
          mining_company_id: effectiveCompanyId,
          export_license_id: selectedLicenseId,
          freight_company_id: selectedFreightCompanyId,
          refinery_id: selectedRefineryId,
          total_net_weight_grams: totalNetWeightGrams,
          total_gross_weight_grams: totalGrossWeightGrams,
          total_weight_oz: totalNetWeightGrams / 31.1034768,
          total_boxes: selectedProductions.length,
        });
        prepId = preparation.id;
      } else {
        // Création ATOMIQUE : parent, lignes, signataires et réservation de quota
        // sont validés dans une seule transaction serveur — plus de préparation
        // « fantôme » tenant un quota après une coupure. La référence est générée
        // côté serveur (compteur atomique) et la clé rend un rejeu sûr.
        pendingCreationId.current ||= crypto.randomUUID();
        const newPrep = await shippingPreparationService.createPreparationAtomic({
          idempotencyKey: pendingCreationId.current,
          miningCompanyId: effectiveCompanyId,
          exportLicenseId: selectedLicenseId,
          freightCompanyId: selectedFreightCompanyId,
          refineryId: selectedRefineryId,
          preparedAt,
          items: selectedProductions.map((sp, index) => ({
            daily_production_id: sp.production.id,
            ingot_box_number: sp.production.bar_reference || `BOX-${index + 1}`,
            net_weight_grams: sp.production.pure_gold_grams,
            gross_weight_grams: sp.production.bullion_grams,
            fineness_pct: sp.production.estimated_fineness_pct,
            pure_gold_grams: sp.production.pure_gold_grams,
            seal_number_1: sp.sealNumber1,
            seal_number_2: sp.sealNumber2 || null,
            order_index: index,
          })),
          signatories: signatories.map((s, index) => ({ position: s.position, name: s.name, order_index: index })),
        });
        prepId = newPrep.id;
        reference = newPrep.expedition_lot_number || '';
        if (!reference) throw new Error('La référence de l’expédition n’a pas été générée.');
        setPreparation(newPrep);
        setExpeditionLotNumber(reference);
      }

      // A resumed save must continue the same record, not duplicate its children.
      const existingItems = await shippingPreparationService.getProductionItems(prepId);
      for (const [index, sp] of selectedProductions.entries()) {
        if (existingItems.some(item => item.daily_production_id === sp.production.id)) continue;
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

      const existingSignatories = await shippingPreparationService.getSignatories(prepId);
      for (const [index, sig] of signatories.entries()) {
        if (existingSignatories.some(item => item.name === sig.name && item.position === sig.position)) continue;
        await shippingPreparationService.createSignatory({
          shipping_preparation_id: prepId,
          position: sig.position,
          name: sig.name,
          order_index: index,
        });
      }

      const existingDocuments = await shippingPreparationService.getDocuments(prepId);
      for (const doc of pendingDocuments) {
        if (existingDocuments.some(item => item.title === doc.title && item.file_size === doc.file.size)) continue;
        await shippingPreparationService.uploadDocument(prepId, doc.file, doc.title);
      }

      // Reserve license quota
      try {
        const quotaReserved = await shippingPreparationService.reserveLicenseQuota(
          selectedLicenseId,
          prepId,
          totalNetWeightGrams
        );
        if (!quotaReserved) throw new Error('La réservation du quota de licence n’a pas été confirmée.');
      } catch (err) {
        console.error('Échec de la réservation du quota de licence :', err);
        // Keep the draft so the same operation can be resumed.
        throw new Error(`Impossible de réserver le quota de licence : ${err instanceof Error ? err.message : 'aucune confirmation reçue'}`);
      }

      // A failed PDF leaves this same preparation resumable, never falsely complete.
      const existingPackingList = existingDocuments.find(doc => doc.title === `Packing List - ${reference}`);
      if (existingPackingList) {
        await shippingPreparationService.updatePreparation(prepId, {
          packing_list_document_id: existingPackingList.id,
          packing_list_url: existingPackingList.document_url,
        });
      } else {
        await generateAndUploadPackingList(prepId, reference);
      }

      setSavedPreparationId(prepId);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error('Erreur lors de l’enregistrement de la préparation :', error);

      setErrorTitle('Préparation non enregistrée');
      // Les messages métier (validations, RAISE curés) sont relayés ; les erreurs
      // PostgREST/PostgreSQL brutes sont classées sans exposer d'interne.
      setErrorMessage(messageErreurUtilisateur(
        error,
        'La demande d’enregistrement n’a pas pu aboutir. Vérifiez cette préparation avant de réessayer.',
      ));
      setErrorTechnicalDetails(undefined);
      setShowErrorDialog(true);
    } finally {
      setSaving(false);
    }
    } finally { saveLock.current = false; }
  };

  const selectedRefinery = refineries.find(r => r.id === selectedRefineryId);
  const selectedFreightCompany = freightCompanies.find(fc => fc.id === selectedFreightCompanyId);
  const totalNetWeight = selectedProductions.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);
  const totalGrossWeight = selectedProductions.reduce((sum, sp) => sum + sp.production.bullion_grams, 0);
  const selectedProductionIssues = validateShippingProductionSelection(
    selectedProductions.map(({ production }) => toShippingProductionCandidate(production)),
    effectiveCompanyId,
  );
  const checklist = [
    ['Société et licence d’exportation', Boolean(effectiveCompanyId && selectedLicenseId)],
    ['Production et scellés', selectedProductions.length > 0
      && selectedProductionIssues.length === 0
      && selectedProductions.every(sp => sp.sealNumber1.trim())],
    ['Transporteur et raffinerie', Boolean(selectedFreightCompanyId && selectedRefineryId)],
  ] as const;
  return <NationalDashboardLayout><div className="sn-page logistics-workspace">
    <PageHeader title="Nouvelle préparation d’expédition" subtitle="Sélectionnez les productions admissibles, consignez les scellés et préparez la liste de colisage." icon={Package}
      breadcrumb={[{ label: 'Mine industrielle' }, { label: 'Gestion des expéditions', to: '/shipping/preparation' }, { label: 'Nouvelle préparation' }]}
      actions={<Button type="button" variant="outline" onClick={handleCancel} disabled={saving}><ArrowLeft size={16} />Retour aux préparations</Button>} />
    <nav className="logistics-stepper" aria-label="Sections de la préparation">
      {['Société et licence', 'Production et scellés', 'Transport', 'Signataires et documents'].map((label, index) =>
        <a key={label} href={`#shipping-section-${index + 1}`}><b>{index + 1}</b>{label}</a>)}
    </nav>
    {preparation && !showSuccessDialog && <Note tone="warning">La préparation {preparation.expedition_lot_number} a été créée. Terminez les étapes restantes dans ce dossier ; ne créez pas une autre préparation.</Note>}
    <div className="logistics-form-grid">
      <div className="logistics-form-main">
        <fieldset disabled={loading || loadingCompany || saving || Boolean(preparation) || Boolean(pendingCreationId.current)} className="logistics-form-main">
          <Section id="shipping-section-1" title="Société et licence d’exportation" description="La licence doit appartenir à la société et disposer d’un quota suffisant." icon={Building2}>
            <div className="logistics-fields">
              {!mineCompanyId && <Field label="Société minière" required><select value={selectedMiningCompanyId} onChange={e => void handleMiningCompanyChange(e.target.value)}>
                <option value="">Sélectionnez une société minière</option>{miningCompanies.map(company => <option key={company.id} value={company.id}>{company.name} ({company.code})</option>)}
              </select></Field>}
              <ShippingLicenseSelect companyId={effectiveCompanyId} licenses={availableLicenses} value={selectedLicenseId} loading={loading} onChange={handleLicenseChange} />
            </div>
            {licenseWarning && <div className="mt-4"><Note tone={licenseWarning.startsWith('❌') ? 'danger' : licenseWarning.startsWith('✅') ? 'success' : 'warning'}>{licenseWarning.replace(/^[❌✅⚠️]+\s*/u, '')}</Note></div>}
          </Section>
          <Section id="shipping-section-2" title="Production et scellés" description="Seules les productions admissibles qui ne sont pas déjà affectées à une autre préparation sont proposées." icon={Package}>
            <Field label="Ajouter un lot de production" htmlFor="shipping-production-select"><select id="shipping-production-select" value="" disabled={!effectiveCompanyId}
              aria-invalid={Boolean(productionSelectionError)} aria-describedby={`shipping-production-help${productionSelectionError ? ' shipping-production-error' : ''}`}
              onChange={e => handleAddProduction(e.target.value)}>
              <option value="">{loading ? 'Chargement des productions…' : 'Sélectionnez un lot de production admissible'}</option>
              {productions.filter(p => !selectedProductions.some(sp => sp.production.id === p.id)).map(p => <option key={p.id} value={p.id}>{p.bar_reference || p.production_date} · {logisticsNumber(p.pure_gold_grams)} g d’or fin</option>)}
            </select></Field>
            <p id="shipping-production-help" className="mt-2 text-xs text-slate-600">Les lots admissibles doivent être prêts pour la douane, appartenir à la société sélectionnée et présenter des poids positifs ainsi qu’une pureté cohérente.</p>
            {productionSelectionError && <p id="shipping-production-error" className="mt-2 text-sm font-semibold text-red-700" role="alert">{productionSelectionError}</p>}
            {excludedProductionCount > 0 && <div className="mt-4" role="status" aria-live="polite"><Note tone="warning">{excludedProductionCount} lot{excludedProductionCount > 1 ? 's de production ont été exclus' : ' de production a été exclu'} en raison de données physiques ou d’un statut de circuit non admissibles.</Note></div>}
            {effectiveCompanyId && !loading && !productions.length && <div className="mt-4"><Note tone="info">Aucune production admissible n’est disponible pour cette société.</Note></div>}
            {selectedProductions.length > 0 && <div className="sn-table-wrap mt-5"><table className="sn-table">
              <caption className="sr-only">Lots de production sélectionnés et numéros de scellé</caption>
              <thead><tr><th>Lot / lingot</th><th>Poids brut (g)</th><th>Pureté (%)</th><th>Or fin (g)</th><th>Scellé 1 *</th><th>Scellé 2</th><th>Retirer</th></tr></thead>
              <tbody>{selectedProductions.map(sp => <tr key={sp.production.id}>
                <td><strong>{sp.production.bar_reference || '—'}</strong><small className="block">{logisticsDate(sp.production.production_date)}</small></td>
                <td>{logisticsNumber(sp.production.bullion_grams)}</td><td>{logisticsNumber(sp.production.estimated_fineness_pct)}</td><td>{logisticsNumber(sp.production.pure_gold_grams)}</td>
                <td><input aria-label={`Scellé principal de ${sp.production.bar_reference || sp.production.id}`} value={sp.sealNumber1} onChange={e => handleSealNumber1Change(sp.production.id, e.target.value)} required /></td>
                <td><input aria-label={`Scellé secondaire de ${sp.production.bar_reference || sp.production.id}`} value={sp.sealNumber2} onChange={e => handleSealNumber2Change(sp.production.id, e.target.value)} /></td>
                <td><Button type="button" variant="ghost" aria-label={`Retirer ${sp.production.bar_reference || sp.production.id}`} onClick={() => handleRemoveProduction(sp.production.id)}><Trash2 size={17} /></Button></td>
              </tr>)}</tbody>
            </table></div>}
          </Section>
          <Section id="shipping-section-3" title="Transport et destination" description="Sélectionnez le transporteur et la raffinerie destinataire." icon={Truck}>
            <div className="logistics-fields">
              <Field label="Transporteur" required><select value={selectedFreightCompanyId} onChange={e => setSelectedFreightCompanyId(e.target.value)}><option value="">Sélectionnez un transporteur</option>{freightCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Raffinerie de destination" required><select value={selectedRefineryId} onChange={e => setSelectedRefineryId(e.target.value)}><option value="">Sélectionnez une raffinerie</option>{refineries.map(r => <option key={r.id} value={r.id}>{r.name} · {r.country}</option>)}</select></Field>
            </div>
          </Section>
          <Section id="shipping-section-4" title="Signataires et pièces justificatives" description="Renseignez les signataires et joignez les pièces justificatives." icon={FileText}>
            <Field label="Signataire enregistré"><select value={selectedDepositorId} onChange={e => handleDepositorSelect(e.target.value)} disabled={!effectiveCompanyId}>
              <option value="">Sélectionnez un signataire ou saisissez ses informations ci-dessous</option>{depositors.map(d => <option key={d.id} value={d.id}>{d.full_name} · {d.job_title}</option>)}
            </select></Field>
            <div className="logistics-fields mt-4"><Field label="Nom complet"><input value={newSignatoryName} onChange={e => setNewSignatoryName(e.target.value)} /></Field>
              <Field label="Fonction"><input value={newSignatoryPosition} onChange={e => setNewSignatoryPosition(e.target.value)} /></Field></div>
            <Button type="button" className="mt-4" variant="outline" onClick={handleAddSignatory} disabled={!effectiveCompanyId}><Plus size={16} />Ajouter le signataire</Button>
            <ul className="mt-4 space-y-2">{signatories.map(s => <li key={s.tempId} className="flex items-center justify-between gap-3"><span>{s.name} · {s.position}</span><Button type="button" variant="ghost" onClick={() => handleRemoveSignatory(s.tempId)} aria-label={`Retirer le signataire ${s.name}`}><Trash2 size={16} /></Button></li>)}</ul>
            <div className="border-t mt-6 pt-6"><Button type="button" variant="outline" onClick={() => setShowDocumentForm(!showDocumentForm)}><Plus size={16} />Ajouter un document</Button></div>
            {showDocumentForm && <div className="mt-4"><div className="logistics-fields">
              <Field label="Titre du document" required><input value={newDocumentTitle} maxLength={200} onChange={e => setNewDocumentTitle(e.target.value)} /></Field>
              <Field label="Fichier" required hint="PDF, JPG ou PNG. Les fichiers sont contrôlés avant le téléversement."><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setNewDocumentFile(e.target.files?.[0] || null)} /></Field>
            </div><Button type="button" className="mt-4" variant="outline" onClick={handleAddDocument}>Joindre le document</Button></div>}
            <ul className="mt-4 space-y-2">{pendingDocuments.map(doc => <li key={doc.tempId} className="flex items-center justify-between gap-3"><span>{doc.title}<small className="block">{doc.file.name}</small></span><Button type="button" variant="ghost" onClick={() => handleRemoveDocument(doc.tempId)} aria-label={`Retirer le document ${doc.title}`}><Trash2 size={16} /></Button></li>)}</ul>
          </Section>
        </fieldset>
      </div>
      <SnCard title="Synthèse de la préparation" className="logistics-summary">
        <dl><dt>Référence</dt><dd>{expeditionLotNumber || 'Générée à l’enregistrement'}</dd><dt>Colis</dt><dd>{selectedProductions.length}</dd>
          <dt>Poids brut</dt><dd>{logisticsNumber(totalGrossWeight)} g</dd><dt>Or fin</dt><dd>{logisticsNumber(totalNetWeight)} g</dd>
          <dt>Or fin</dt><dd>{logisticsNumber(totalNetWeight / 31.1034768)} oz</dd><dt>Pureté pondérée de l’or</dt><dd>{logisticsNumber(totalGrossWeight > 0 ? totalNetWeight / totalGrossWeight * 100 : null)} %</dd>
          <dt>Raffinerie</dt><dd>{selectedRefinery?.name || '—'}</dd><dt>Documents</dt><dd>{pendingDocuments.length}</dd></dl>
        <h4>Liste de contrôle</h4><ul className="logistics-checklist">{checklist.map(([label, complete]) => <li key={label} className={complete ? 'is-complete' : ''}>{complete ? <CheckCircle /> : <Circle />}{label}</li>)}</ul>
        <Button type="button" className="mt-6 w-full" variant="outline" disabled={!selectedProductions.length} onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)}><FileText size={16} />{isPreviewCollapsed ? 'Prévisualiser la liste de colisage' : 'Masquer l’aperçu'}</Button>
        <p className="mt-4 text-xs text-slate-500">L’enregistrement crée une préparation en attente d’approbation douanière. Il ne déclenche pas l’expédition.</p>
      </SnCard>
    </div>
    {!isPreviewCollapsed && selectedProductions.length > 0 && <Section id="packing-preview" title="Aperçu de la liste de colisage" description="Vérifiez les quantités et les scellés avant l’enregistrement." icon={FileText}>
      <Button type="button" variant="outline" onClick={handleSendPackingListByEmail}><Send size={16} />Préparer le courriel</Button>
      <div className="overflow-auto mt-5"><DynamicPackingList expeditionLotNumber={expeditionLotNumber} productionDate={selectedProductions[0].production.production_date}
        miningCompany={selectedProductions[0].production.mining_company?.name || ''} refineryName={selectedRefinery?.name || ''} refineryAddress={selectedRefinery?.location || ''}
        refineryCountry={selectedRefinery?.country || ''} freightCompany={selectedFreightCompany?.name || ''}
        ingots={selectedProductions.map((sp, index) => ({ ingotBoxNumber: sp.production.bar_reference || `BOX-${index + 1}`, netWeight: sp.production.pure_gold_grams, grossWeight: sp.production.bullion_grams, sealNumber1: sp.sealNumber1, sealNumber2: sp.sealNumber2 }))}
        signatories={signatories.map(s => ({ position: s.position, name: s.name }))} /></div>
    </Section>}
    <FormActions><Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>Annuler</Button>
      <Button type="button" onClick={handleSavePreparation} disabled={saving || loading || loadingCompany || showSuccessDialog}><Save size={16} />{saving ? 'Enregistrement de la préparation…' : preparation ? 'Finaliser la préparation' : 'Enregistrer la préparation'}</Button></FormActions>
    {showSuccessDialog && <SnCard title="Préparation enregistrée"><Note>La préparation {expeditionLotNumber} est enregistrée.</Note><Button type="button" className="mt-4" onClick={() => navigate(shippingPreparationDetailsPath(savedPreparationId))}>Ouvrir la préparation</Button></SnCard>}
    <BusinessErrorDialog isOpen={showErrorDialog} onClose={() => setShowErrorDialog(false)} title={errorTitle} message={errorMessage} technicalDetails={errorTechnicalDetails} />
  </div></NationalDashboardLayout>;
}
