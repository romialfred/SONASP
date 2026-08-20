import { useState, useEffect } from 'react';
import { Save, X, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Card } from '@/components/ui/Card';
import { FieldGuidePanel } from '@/components/ui/FieldGuidePanel';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { CustomConfirm } from '@/components/ui/CustomConfirm';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { useAuth } from '@/contexts/AuthContext';
import { dailyProductionService, DailyProduction, ProductionSummary } from '@/services/dailyProductionService';
import { productionDocumentService } from '@/services/productionDocumentService';
import { ProductionDocumentUpload } from './ProductionDocumentUpload';
import { ProductionDocumentsList, ProductionDocument } from './ProductionDocumentsList';
import { supabase } from '@/lib/supabase';
import { dailyProductionFieldGuides } from '@/data/productionFieldGuides';
import { filterOperationalMiningCompanies } from '@/utils/miningCompanyFilters';
import { roundUpToFixed } from '@/utils/numberUtils';
import { SITE_NATIONAL } from '@/constants/site';

interface DailyProductionFormProps {
  production?: DailyProduction | null;
  onCancel: () => void;
  onSuccess: () => void;
}

interface MiningCompany {
  id: string;
  name: string;
  /** Code au référentiel, source du préfixe des références de barres. */
  code?: string | null;
  abbreviation?: string | null;
}

export function DailyProductionFormEnhanced({ production, onCancel, onSuccess }: DailyProductionFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    production_date: production?.production_date || new Date().toISOString().split('T')[0],
    bullion_grams: production?.bullion_grams?.toString() || '',
    estimated_gold_pct: production?.estimated_gold_pct?.toString() || production?.estimated_fineness_pct?.toString() || '',
    estimated_silver_pct: production?.estimated_silver_pct?.toString() || '',
    bar_reference: production?.bar_reference || '',
    mining_company_id: production?.mining_company_id || '',
    notes: production?.notes || '',
  });

  const [weightUnit, setWeightUnit] = useState<'grams' | 'oz'>('grams');

  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, setWtdSummary] = useState<ProductionSummary | null>(null);
  const [, setMtdSummary] = useState<ProductionSummary | null>(null);
  const [, setYtdSummary] = useState<ProductionSummary | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [documents, setDocuments] = useState<ProductionDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const { alertState, confirmState, showSuccess, showError, closeAlert, closeConfirm } = useCustomAlert();

  useEffect(() => {
    loadMiningCompanies();
    if (!production) {
      loadSummaries();
    } else if (production.id) {
      loadDocuments(production.id);
    }
    productionDocumentService.ensureBucketExists();
  }, []);

  // Générer automatiquement la bar reference quand une société est sélectionnée
  useEffect(() => {
    if (formData.mining_company_id && !production) {
      generateBarReference(formData.mining_company_id, formData.production_date)
        .then(barRef => {
          if (barRef) {
            setFormData(prev => ({ ...prev, bar_reference: barRef }));
          }
        });
    }
  }, [formData.mining_company_id, miningCompanies]);

  const loadSummaries = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [wtd, mtd] = await Promise.all([
        dailyProductionService.getWTDSummary(today),
        dailyProductionService.getMTDSummary(today)
      ]);
      setWtdSummary(wtd);
      setMtdSummary(mtd);

      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const { data: ytdData } = await supabase
        .from('daily_production')
        .select('bullion_grams, pure_gold_grams, estimated_oz, estimated_fineness_pct')
        .gte('production_date', startOfYear)
        .lte('production_date', today);

      if (ytdData && ytdData.length > 0) {
        const total = ytdData.reduce((sum, p) => sum + p.estimated_oz, 0);
        const avgFineness = ytdData.reduce((sum, p) => sum + p.estimated_fineness_pct, 0) / ytdData.length;
        setYtdSummary({
          total_estimated_oz: total,
          avg_fineness_pct: avgFineness,
          record_count: ytdData.length,
          total_bullion_grams: ytdData.reduce((sum, p) => sum + p.bullion_grams, 0),
          total_pure_gold_grams: ytdData.reduce((sum, p) => sum + p.pure_gold_grams, 0)
        });
      }
    } catch (error) {
      console.error('Error loading summaries:', error);
    }
  };

  const loadMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name, code, abbreviation, company_type')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Exclure la société mère des sociétés opérationnelles
      setMiningCompanies(filterOperationalMiningCompanies(data || []));
    } catch (error) {
      console.error('Error loading mining companies:', error);
    }
  };

  // Conversion helpers
  const gramsToOz = (grams: number) => grams / 31.1034768;
  const ozToGrams = (oz: number) => oz * 31.1034768;

  // Calcul du bullion en fonction de l'unité
  const bullionInGrams = weightUnit === 'grams'
    ? parseFloat(formData.bullion_grams) || 0
    : ozToGrams(parseFloat(formData.bullion_grams) || 0);

  const bullionInOz = gramsToOz(bullionInGrams);

  // ARRONDI AU SUPÉRIEUR avec 2 décimales pour les grammes
  const pureGoldGrams = formData.bullion_grams && formData.estimated_gold_pct
    ? roundUpToFixed(bullionInGrams * parseFloat(formData.estimated_gold_pct) / 100, 2)
    : '0.00';

  const silverContentGrams = formData.bullion_grams && formData.estimated_silver_pct
    ? roundUpToFixed(bullionInGrams * parseFloat(formData.estimated_silver_pct) / 100, 2)
    : '0.00';

  // Calcul des impuretés
  const goldPct = parseFloat(formData.estimated_gold_pct) || 0;
  const silverPct = parseFloat(formData.estimated_silver_pct) || 0;
  const totalPct = goldPct + silverPct;
  const impuritiesPct = totalPct < 100 ? roundUpToFixed(100 - totalPct, 2) : '0.00';

  // ARRONDI AU SUPÉRIEUR avec 2 décimales pour les onces
  const silverContentOz = silverContentGrams !== '0.00'
    ? roundUpToFixed(parseFloat(silverContentGrams) / 31.1034768, 2)
    : '0.00';

  const estimatedOz = pureGoldGrams !== '0.00'
    ? roundUpToFixed(parseFloat(pureGoldGrams) / 31.1034768, 2)
    : '0.00';

  /**
   * Préfixe de référence d'une barre.
   *
   * Les préfixes étaient ceux d'un autre exploitant — `HUMSMK` pour Komana au
   * Mali, `HUMKGM` pour Kourousa en Guinée, `HUMDUG` pour Dugbe au Liberia — et
   * le défaut préfixait `HUM` à n'importe quel nom. Une barre burkinabè sortait
   * donc sous le code d'une société étrangère. Le préfixe vient désormais du
   * code de la société tel qu'inscrit au référentiel.
   */
  const getCompanyPrefix = (company: { name: string; code?: string | null; abbreviation?: string | null }): string => {
    const code = (company.code || company.abbreviation || '').trim().toUpperCase();
    if (code) return code.replace(/[^A-Z0-9]/g, '').slice(0, 6);

    // Sans code au référentiel, les initiales du nom valent mieux qu'un préfixe
    // emprunté : la barre reste rattachable à sa société.
    const initiales = company.name
      .split(/\s+/)
      .map((mot) => mot[0])
      .filter((lettre) => /[A-Za-zÀ-ÿ]/.test(lettre || ''))
      .join('')
      .toUpperCase();
    return (initiales || company.name.slice(0, 3)).replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'MINE';
  };

  const generateBarReference = async (companyId: string, _productionDate: string) => {
    try {
      const company = miningCompanies.find(c => c.id === companyId);
      if (!company) return '';

      const prefix = getCompanyPrefix(company);

      // Obtenir le dernier numéro pour ce préfixe
      const { data, error } = await supabase
        .from('daily_production')
        .select('bar_reference')
        .like('bar_reference', `${prefix}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0 && data[0].bar_reference) {
        const lastRef = data[0].bar_reference;
        const match = lastRef.match(/-(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      // Format : SBM-0001, WGM-0002 — le code de la société, puis un compteur.
      return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating bar reference:', error);
      return '';
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.production_date) {
      newErrors.production_date = 'La date est requise';
    }

    if (!formData.bullion_grams || parseFloat(formData.bullion_grams) <= 0) {
      newErrors.bullion_grams = 'Le poids du bullion doit être supérieur à 0';
    }

    if (!formData.estimated_gold_pct || parseFloat(formData.estimated_gold_pct) <= 0 || parseFloat(formData.estimated_gold_pct) > 100) {
      newErrors.estimated_gold_pct = 'La finesse or doit être entre 0 et 100%';
    }

    if (formData.estimated_silver_pct && (parseFloat(formData.estimated_silver_pct) < 0 || parseFloat(formData.estimated_silver_pct) > 100)) {
      newErrors.estimated_silver_pct = 'La finesse argent doit être entre 0 et 100%';
    }

    // Vérifier que la somme des pourcentages ne dépasse pas 100%
    const goldPct = parseFloat(formData.estimated_gold_pct) || 0;
    const silverPct = parseFloat(formData.estimated_silver_pct) || 0;
    if (goldPct + silverPct > 100) {
      newErrors.estimated_silver_pct = `La somme Or (${goldPct}%) + Argent (${silverPct}%) ne peut pas dépasser 100%`;
    }

    if (!formData.mining_company_id) {
      newErrors.mining_company_id = 'Veuillez sélectionner une mining company';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Toujours sauvegarder en grammes
    const bullionGramsToSave = weightUnit === 'oz'
      ? ozToGrams(parseFloat(formData.bullion_grams))
      : parseFloat(formData.bullion_grams);

    // Récupérer le site_id de l'utilisateur connecté
    const userSiteId = user?.site_ids?.[0] || SITE_NATIONAL;

    // Trouver le nom de la société

    try {
      setLoading(true);

      const data = {
        production_date: formData.production_date,
        bullion_grams: bullionGramsToSave,
        estimated_gold_pct: parseFloat(formData.estimated_gold_pct),
        estimated_silver_pct: formData.estimated_silver_pct ? parseFloat(formData.estimated_silver_pct) : 0,
        estimated_fineness_pct: parseFloat(formData.estimated_gold_pct),
        bar_reference: formData.bar_reference || undefined,
        mining_company_id: formData.mining_company_id || undefined,
        notes: formData.notes || undefined,
        site_id: userSiteId,
      };

      console.log('📊 Données de production à enregistrer:', data);
      console.log('👤 Utilisateur site_id:', userSiteId);
      console.log('🏢 Mining company ID:', formData.mining_company_id);

      if (production?.id) {
        const updated = await dailyProductionService.updateProduction(production.id, data);
        console.log('✅ Production mise à jour:', updated);
        showSuccess('Production mise à jour avec succès!', 'Mise à jour réussie');
        // Attendre 1.5 secondes avant de fermer pour que l'utilisateur voie le message
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        const newProduction = await dailyProductionService.createProduction(data);
        console.log('✅ Production créée:', newProduction);
        showSuccess(`Production créée avec succès!\nID: ${newProduction.id.substring(0, 8)}...\nDate: ${newProduction.production_date}\nSite: ${newProduction.site_id}`, 'Production créée');
        // Attendre 1.5 secondes avant de fermer pour que l'utilisateur voie le message
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving production:', error);
      showError(error.message || 'Erreur lors de la sauvegarde', 'Erreur de sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (productionId: string) => {
    try {
      setLoadingDocuments(true);
      const docs = await productionDocumentService.listDocuments(productionId);
      setDocuments(docs);
    } catch (error: any) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleDocumentUpload = async (file: File, documentName: string) => {
    if (!production?.id) {
      throw new Error('Veuillez d\'abord enregistrer la production avant d\'ajouter des documents');
    }

    try {
      await productionDocumentService.uploadDocument(production.id, file, documentName);
      await loadDocuments(production.id);
    } catch (error: any) {
      throw error;
    }
  };

  const handleDocumentView = async (doc: ProductionDocument) => {
    try {
      const url = await productionDocumentService.getDocumentUrl(doc.file_path);
      window.open(url, '_blank');
    } catch (error: any) {
      alert(error.message || 'Erreur lors de l\'ouverture du document');
    }
  };

  const handleDocumentDownload = async (doc: ProductionDocument) => {
    try {
      await productionDocumentService.downloadDocument(doc);
    } catch (error: any) {
      alert(error.message || 'Erreur lors du téléchargement');
    }
  };

  const handleDocumentDelete = async (documentId: string) => {
    if (!production?.id) return;

    try {
      await productionDocumentService.deleteDocument(documentId);
      await loadDocuments(production.id);
    } catch (error: any) {
      alert(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Production Form - 4 columns */}
      <div className="lg:col-span-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {production ? 'Modifier Production' : 'Nouvelle Production Journalière'}
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              size="sm"
            >
              <X className="w-4 h-4 mr-1" />
              Annuler
            </Button>
          </div>

          {/* Period Summaries - Removed as per user request */}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Production Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de Production *
                </label>
                <input
                  type="date"
                  value={formData.production_date}
                  onChange={(e) => handleChange('production_date', e.target.value)}
                  onFocus={() => setActiveField('production_date')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.production_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {errors.production_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.production_date}</p>
                )}
              </div>

              {/* Mining Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mining Company *
                </label>
                <select
                  value={formData.mining_company_id}
                  onChange={(e) => handleChange('mining_company_id', e.target.value)}
                  onFocus={() => setActiveField('mining_company_id')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.mining_company_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">Sélectionner...</option>
                  {miningCompanies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                {errors.mining_company_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.mining_company_id}</p>
                )}
              </div>

              {/* Bar Reference - Read Only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bar Reference
                </label>
                <Input
                  type="text"
                  value={formData.bar_reference}
                  onFocus={() => setActiveField('bar_reference')}
                  placeholder="Auto-généré"
                  className="bg-gray-50 cursor-not-allowed"
                  readOnly
                  disabled
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Bullion with Unit Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Doré pesé *
                </label>
                <div className="flex gap-2">
                  <select
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value as 'grams' | 'oz')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="grams">g</option>
                    <option value="oz">oz</option>
                  </select>
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.bullion_grams}
                      onChange={(e) => handleChange('bullion_grams', e.target.value)}
                      onFocus={() => setActiveField('bullion_grams')}
                      placeholder={weightUnit === 'grams' ? 'ex: 11270' : 'ex: 362.31'}
                      error={errors.bullion_grams}
                      required
                    />
                  </div>
                </div>
                {/* Conversion display */}
                {formData.bullion_grams && (
                  <div className="mt-2 space-y-1">
                    {weightUnit === 'grams' ? (
                      <p className="text-sm text-gray-600">= {roundUpToFixed(bullionInOz, 2)} oz</p>
                    ) : (
                      <p className="text-sm text-gray-600">= {roundUpToFixed(bullionInGrams, 2)} g</p>
                    )}
                    <p className="text-xs text-gray-500">Reference: 1 oz = 31.10 g</p>
                  </div>
                )}
              </div>

              {/* Gold Assay */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre or % <span className="text-xs italic text-gray-500 font-normal">(estimé)</span> *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.estimated_gold_pct}
                  onChange={(e) => handleChange('estimated_gold_pct', e.target.value)}
                  onFocus={() => setActiveField('estimated_gold_pct')}
                  placeholder="ex: 92.1"
                  error={errors.estimated_gold_pct}
                  required
                />
              </div>

              {/* Silver Assay */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre argent % <span className="text-xs italic text-gray-500 font-normal">(estimé)</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.estimated_silver_pct}
                  onChange={(e) => handleChange('estimated_silver_pct', e.target.value)}
                  onFocus={() => setActiveField('estimated_silver_pct')}
                  placeholder="ex: 5.2"
                  error={errors.estimated_silver_pct}
                />
                {totalPct > 100 && (
                  <p className="mt-1 text-xs text-red-600">
                    ⚠ La somme or + argent dépasse 100 % ({roundUpToFixed(totalPct, 2)}%)
                  </p>
                )}
              </div>
            </div>

            {/* Calculated Fields */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">
                Métriques Automatiques
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Or fin (g)
                  </label>
                  <div className="text-xl font-bold text-blue-900">
                    {pureGoldGrams}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Or fin (oz)
                  </label>
                  <div className="text-xl font-bold text-blue-900">
                    {estimatedOz}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Argent (g)
                  </label>
                  <div className="text-xl font-bold text-gray-700">
                    {silverContentGrams}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Argent (oz)
                  </label>
                  <div className="text-xl font-bold text-gray-700">
                    {silverContentOz}
                  </div>
                </div>
              </div>

              {/* Impurities Row - Only show if < 100% */}
              {totalPct < 100 && totalPct > 0 && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-orange-700">
                      Impuretés %
                    </label>
                    <div className="text-lg font-bold text-orange-700">
                      {impuritiesPct}%
                    </div>
                  </div>
                  <p className="text-xs text-orange-600 mt-1">
                    = 100% - ({roundUpToFixed(goldPct, 2)}% + {roundUpToFixed(silverPct, 2)}%)
                  </p>
                </div>
              )}

              <p className="text-xs text-blue-600 mt-3">
                Or fin = doré × titre or ÷ 100  ·  Argent = doré × titre argent ÷ 100  ·  Onces = grammes ÷ 31,1034768
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <TextArea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                onFocus={() => setActiveField('notes')}
                placeholder="Notes supplémentaires sur la production..."
                rows={3}
              />
            </div>

            {/* Documents Section - Only show for existing production */}
            {production?.id && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      Documents Attachés
                    </h3>
                    <span className="text-xs text-gray-500">({documents.length})</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowDocumentUpload(true)}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Ajouter un Document
                  </Button>
                </div>

                {loadingDocuments ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto" />
                  </div>
                ) : (
                  <ProductionDocumentsList
                    documents={documents}
                    onView={handleDocumentView}
                    onDownload={handleDocumentDownload}
                    onDelete={handleDocumentDelete}
                    canDelete={true}
                  />
                )}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Enregistrement...' : production ? 'Mettre à jour' : 'Enregistrer'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Field Guide Panel - 1 column */}
      <div className="lg:col-span-1">
        <FieldGuidePanel
          fields={dailyProductionFieldGuides}
          activeField={activeField}
        />
      </div>
    </div>

    {/* Document Upload Modal */}
    {production?.id && (
      <ProductionDocumentUpload
        isOpen={showDocumentUpload}
        onClose={() => setShowDocumentUpload(false)}
        onUpload={handleDocumentUpload}
      />
    )}

    {/* Custom Alert */}
    <CustomAlert
      isOpen={alertState.isOpen}
      onClose={closeAlert}
      title={alertState.title}
      message={alertState.message}
      type={alertState.type}
    />

    {/* Custom Confirm */}
    <CustomConfirm
      isOpen={confirmState.isOpen}
      onConfirm={confirmState.onConfirm}
      onCancel={closeConfirm}
      title={confirmState.title}
      message={confirmState.message}
      type={confirmState.type}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
    />
    </>
  );
}
