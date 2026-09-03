import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronDown,
  ChevronUp, ClipboardCheck, Download, FileCheck2, FileText, Filter, Landmark,
  Loader2, Paperclip, Save, Search, ShieldCheck, Trash2, Upload, X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, Note, PageHeader } from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errorMessage';
import {
  reserveAllocationService,
  type EligibleReserveInventory,
  type ReserveAllocation,
  type ReserveAllocationDocument,
  type ReserveAllocationPayload,
  type ReserveDepository,
} from '@/services/reserveAllocationService';
import {
  formatDate, formatDateTime, formatDepositType, formatEur, formatFcfa, formatGrams, formatPercent, formatUsd,
  RESERVE_STATUS_LABELS, RESERVE_STATUS_TONES,
} from './reserveAllocationPresentation';
import './reserve-allocations.css';

type ControlKey = 'purity' | 'weight' | 'certificates' | 'eligibility' | 'sale_conflict' | 'availability';
type PendingDocument = { id: string; type: string; file: File };

const TODAY = new Date().toISOString().slice(0, 10);
const INITIAL_PAYLOAD: ReserveAllocationPayload = {
  allocation_date: TODAY,
  reason: '',
  allocation_nature: 'CONSTITUTION_RESERVE',
  priority: 'NORMAL',
  decision_reference: '',
  decision_date: TODAY,
  decision_authority: 'Ministère de l’Économie et des Finances',
  decision_department: '',
  decision_comment: '',
  depository_organization_id: '',
  deposit_type: 'reserve_vault',
  planned_deposit_reference: '',
  planned_transfer_date: '',
  control_results: {
    purity: false, weight: false, certificates: false,
    eligibility: false, sale_conflict: false, availability: false,
  },
};

const DOCUMENT_TYPES = [
  ['decision_allocation', 'Décision d’affectation'],
  ['analysis_certificate', 'Certificat d’analyse'],
  ['refinery_certificate', 'Certificat de raffinerie'],
  ['minutes', 'Procès-verbal'],
  ['transfer_note', 'Bordereau'],
  ['other', 'Document complémentaire'],
] as const;

const CONTROL_OPTIONS: Array<{ key: ControlKey; label: string; hint: string }> = [
  { key: 'purity', label: 'Pureté conforme', hint: 'La pureté respecte le seuil minimal de la réserve.' },
  { key: 'weight', label: 'Poids vérifié', hint: 'Les poids brut et fin concordent avec les certificats.' },
  { key: 'certificates', label: 'Certificats présents', hint: 'Les références d’analyse et de raffinage sont disponibles.' },
  { key: 'eligibility', label: 'Éligibilité confirmée', hint: 'Les actifs répondent aux règles de la réserve nationale.' },
  { key: 'sale_conflict', label: 'Absence de conflit avec une vente', hint: 'Aucun lingot n’est engagé dans une vente.' },
  { key: 'availability', label: 'Disponibilité du stock', hint: 'La quantité reste disponible dans le stock opérationnel.' },
];

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const formatNumber = (value: number): string => numberFormatter.format(value);

function itemFromAllocation(allocation: ReserveAllocation): EligibleReserveInventory[] {
  return allocation.items.map((item) => ({
    id: item.inventory_id,
    lot_reference: item.lot_reference,
    certificate_number: item.certificate_number,
    entry_date: item.reserved_at,
    gross_weight_grams: item.gross_weight_grams,
    fine_weight_grams: item.fine_weight_grams,
    fineness_percentage: item.fineness_percentage,
    quantity_available_oz: item.fine_weight_grams / 31.1034768,
    processing_location: null,
    refinery_id: null,
    refinery_name: null,
    mining_company_id: null,
    source_name: null,
  }));
}

export function ReserveAllocationForm() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const { user } = useAuth();
  const { addToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [allocationId, setAllocationId] = useState<string | null>(routeId || null);
  const [allocation, setAllocation] = useState<ReserveAllocation | null>(null);
  const [eligible, setEligible] = useState<EligibleReserveInventory[]>([]);
  const [depositories, setDepositories] = useState<ReserveDepository[]>([]);
  const [payload, setPayload] = useState<ReserveAllocationPayload>(INITIAL_PAYLOAD);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [refinery, setRefinery] = useState('all');
  const [minimumPurity, setMinimumPurity] = useState('99.90');
  const [advanced, setAdvanced] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [documentType, setDocumentType] = useState('decision_allocation');
  const [confirmed, setConfirmed] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const [eligibleRows, depositoryRows, current] = await Promise.all([
        reserveAllocationService.listEligible(),
        reserveAllocationService.listDepositories(),
        routeId ? reserveAllocationService.get(routeId) : Promise.resolve(null),
      ]);
      setDepositories(depositoryRows);
      if (current) {
        if (current.status !== 'DRAFT') throw new Error('Cette affectation n’est plus modifiable.');
        setAllocation(current);
        setAllocationId(current.id);
        const existingItems = itemFromAllocation(current);
        setEligible([...existingItems, ...eligibleRows.filter((row) => !existingItems.some((item) => item.id === row.id))]);
        setSelectedIds(current.items.map((item) => item.inventory_id));
        setPayload({
          allocation_date: current.allocation_date,
          reason: current.reason || '', allocation_nature: current.allocation_nature || 'CONSTITUTION_RESERVE',
          priority: current.priority, decision_reference: current.decision_reference || '',
          decision_date: current.decision_date || TODAY, decision_authority: current.decision_authority || '',
          decision_department: current.decision_department || '', decision_comment: current.decision_comment || '',
          depository_organization_id: current.depository_organization_id || '', deposit_type: current.deposit_type || 'reserve_vault',
          planned_deposit_reference: current.planned_deposit_reference || '', planned_transfer_date: current.planned_transfer_date || '',
          control_results: { ...INITIAL_PAYLOAD.control_results, ...(current.control_results || {}) },
        });
      } else {
        setEligible(eligibleRows);
        if (depositoryRows.length === 1) setPayload((value) => ({ ...value, depository_organization_id: depositoryRows[0].id }));
      }
    } catch (reason) {
      setFailure(errorMessage(reason, 'Impossible de charger le formulaire d’affectation.'));
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => { void load(); }, [load]);

  const selectedItems = useMemo(() => eligible.filter((item) => selectedIds.includes(item.id)), [eligible, selectedIds]);
  const summary = useMemo(() => {
    const gross = selectedItems.reduce((sum, item) => sum + item.gross_weight_grams, 0);
    const fine = selectedItems.reduce((sum, item) => sum + item.fine_weight_grams, 0);
    const purity = gross > 0 ? fine / gross * 100 : 0;
    const price = allocation?.gold_price_fcfa_gram || 0;
    const fcfa = fine * price;
    return {
      lots: selectedItems.length, ingots: selectedItems.length, gross, fine, purity, fcfa,
      usd: allocation?.usd_xof_rate ? fcfa / allocation.usd_xof_rate : 0,
      eur: allocation?.eur_xof_rate ? fcfa / allocation.eur_xof_rate : 0,
    };
  }, [allocation, selectedItems]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    const minimum = Number(minimumPurity || 0);
    return eligible.filter((item) => {
      if (item.fineness_percentage < minimum) return false;
      if (source !== 'all' && item.mining_company_id !== source) return false;
      if (refinery !== 'all' && item.refinery_id !== refinery) return false;
      return !query || [item.lot_reference, item.certificate_number, item.refinery_name, item.source_name]
        .some((value) => value?.toLocaleLowerCase('fr').includes(query));
    });
  }, [eligible, minimumPurity, refinery, search, source]);
  const sources = useMemo(() => [...new Map(eligible.filter((item) => item.mining_company_id).map((item) => [item.mining_company_id!, item.source_name || 'Source sans nom'])).entries()], [eligible]);
  const refineries = useMemo(() => [...new Map(eligible.filter((item) => item.refinery_id).map((item) => [item.refinery_id!, item.refinery_name || 'Raffinerie'])).entries()], [eligible]);
  const depository = depositories.find((item) => item.id === payload.depository_organization_id) || allocation?.depository || null;
  const controlsComplete = CONTROL_OPTIONS.every(({ key }) => payload.control_results[key]);
  const hasDecisionDocument = allocation?.documents.some((document) => document.document_type === 'decision_allocation')
    || pendingDocuments.some((document) => document.type === 'decision_allocation');

  const set = <K extends keyof ReserveAllocationPayload>(key: K, value: ReserveAllocationPayload[K]) => setPayload((current) => ({ ...current, [key]: value }));
  const toggleSelection = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const saveDraft = async (quiet = false): Promise<string | null> => {
    setSaving(true);
    setFailure(null);
    try {
      const id = await reserveAllocationService.saveDraft(allocationId, payload, selectedIds);
      setAllocationId(id);
      for (const document of pendingDocuments) {
        await reserveAllocationService.uploadDocument(id, document.type, document.file);
      }
      setPendingDocuments([]);
      const current = await reserveAllocationService.get(id);
      setAllocation(current);
      if (!quiet) addToast('Brouillon enregistré dans la base de données.', 'success');
      if (!routeId) navigate(`/national-reserve/allocations/${id}/edit`, { replace: true });
      return id;
    } catch (reason) {
      const message = errorMessage(reason, 'Impossible d’enregistrer le brouillon.');
      setFailure(message);
      addToast(message, 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const validateStep = (targetStep: number): boolean => {
    if (targetStep > 1 && selectedIds.length === 0) { addToast('Sélectionnez au moins un lingot éligible.', 'error'); return false; }
    if (targetStep > 2 && (!payload.reason.trim() || !payload.decision_reference.trim() || !payload.depository_organization_id)) {
      addToast('Renseignez le motif, la décision et le dépositaire.', 'error'); return false;
    }
    if (targetStep > 3 && (!controlsComplete || !hasDecisionDocument)) {
      addToast('Confirmez les six contrôles et joignez la décision d’affectation.', 'error'); return false;
    }
    return true;
  };

  const goNext = async () => {
    if (!validateStep(step + 1)) return;
    if (step === 3 && !allocationId) {
      const id = await saveDraft(true);
      if (!id) return;
    }
    setStep((value) => Math.min(4, value + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    if (!validateStep(4)) return;
    if (!confirmed) {
      addToast('Confirmez la vérification finale avant soumission.', 'error');
      setStep(4);
      return;
    }
    setSubmitting(true);
    try {
      const id = await saveDraft(true);
      if (!id) return;
      await reserveAllocationService.transition(id, 'SUBMITTED', 'Soumission du dossier complet pour approbation.');
      addToast('L’affectation a été soumise au circuit d’approbation.', 'success');
      navigate(`/national-reserve/allocations/${id}`);
    } catch (reason) {
      addToast(errorMessage(reason, 'La soumission a été refusée par le serveur.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const queueFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
    const additions = Array.from(files).flatMap((file) => {
      if (!allowed.has(file.type)) {
        addToast(`${file.name} : format refusé.`, 'error');
        return [];
      }
      if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
        addToast(`${file.name} : taille maximale 15 Mo.`, 'error');
        return [];
      }
      return [{ id: crypto.randomUUID(), type: documentType, file }];
    });
    setPendingDocuments((current) => [...current, ...additions]);
    if (fileInput.current) fileInput.current.value = '';
  };

  const openDocument = async (document: ReserveAllocationDocument) => {
    try { window.open(await reserveAllocationService.signedDocumentUrl(document.storage_path), '_blank', 'noopener,noreferrer'); }
    catch (reason) { addToast(errorMessage(reason, 'Téléchargement impossible.'), 'error'); }
  };

  const removeDocument = async (document: ReserveAllocationDocument) => {
    if (!window.confirm(`Retirer « ${document.file_name} » du brouillon ?`)) return;
    try {
      await reserveAllocationService.removeDocument(document);
      setAllocation((current) => current
        ? { ...current, documents: current.documents.filter((item) => item.id !== document.id) }
        : current);
      addToast('Pièce jointe retirée et action journalisée.', 'success');
    } catch (reason) {
      addToast(errorMessage(reason, 'Impossible de retirer la pièce jointe.'), 'error');
    }
  };

  if (loading) return <NationalDashboardLayout><main className="sn-page reserve-loading"><Loader2 className="sn-spin" /> Chargement de l’affectation…</main></NationalDashboardLayout>;

  return (
    <NationalDashboardLayout>
      <main className="sn-page reserve-page reserve-form-page">
        <PageHeader
          title={allocation ? `Modifier l’affectation ${allocation.reference}` : 'Nouvelle affectation à la réserve nationale'}
          subtitle={allocation ? 'Mettez à jour le brouillon avant sa soumission au circuit d’approbation.' : 'Sélectionnez les lingots éligibles dans les stocks pour les affecter à la réserve nationale d’or.'}
          breadcrumb={[{ label: 'Réserve d’or du Burkina Faso' }, { label: 'Réserve nationale d’or', to: '/national-reserve' }, { label: 'Affectations à la réserve', to: '/national-reserve/allocations' }, { label: allocation ? allocation.reference : 'Nouvelle affectation' }]}
          actions={<>
            <button type="button" className="sn-btn" onClick={() => navigate('/national-reserve/allocations')}><X aria-hidden="true" /> Annuler</button>
            <button type="button" className="sn-btn sn-btn--soft" onClick={() => void saveDraft()} disabled={saving || submitting}>{saving ? <Loader2 className="sn-spin" /> : <Save />} Enregistrer le brouillon</button>
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => void submit()} disabled={saving || submitting}>{submitting ? <Loader2 className="sn-spin" /> : <ShieldCheck />} Soumettre pour approbation</button>
          </>}
        />
        {failure && <Note tone="danger">{failure}</Note>}

        <nav className="reserve-stepper" aria-label="Étapes de l’affectation">
          {[
            ['Sélection des lingots', 'Choisir dans les stocks éligibles'],
            ['Informations de l’affectation', 'Détails et destination'],
            ['Validation & pièces jointes', 'Contrôle et justification'],
            ['Revue & soumission', 'Résumé et approbation'],
          ].map(([label, hint], index) => {
            const number = index + 1;
            return <button key={label} type="button" className={`${step === number ? 'is-active' : ''}${step > number ? ' is-complete' : ''}`} onClick={() => number < step ? setStep(number) : validateStep(number) && setStep(number)}>
              <span>{step > number ? <Check aria-hidden="true" /> : number}</span><div><strong>{label}</strong><small>{hint}</small></div>
            </button>;
          })}
        </nav>

        <div className="reserve-form-layout">
          <div className="reserve-form-main">
            {step === 1 && <section className="reserve-card reserve-form-section">
              <header><div><small>1. Sélection des lingots éligibles</small><p>Sélectionnez les lingots disponibles dans les stocks opérationnels éligibles à une affectation à la réserve.</p></div><button type="button" aria-label="Replier la section" onClick={() => setSectionOpen((value) => !value)}>{sectionOpen ? <ChevronUp /> : <ChevronDown />}</button></header>
              {sectionOpen && <>
                <div className="reserve-stock-filters">
                  <label><span>Source du stock</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">Tous</option>{sources.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><ChevronDown /></label>
                  <label><span>Raffinerie</span><select value={refinery} onChange={(event) => setRefinery(event.target.value)}><option value="all">Toutes</option>{refineries.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><ChevronDown /></label>
                  <label><span>Pureté minimale</span><select value={minimumPurity} onChange={(event) => setMinimumPurity(event.target.value)}><option value="0">Toutes</option><option value="91.67">91,67 %</option><option value="99.50">99,50 %</option><option value="99.90">99,90 %</option></select><ChevronDown /></label>
                  <label className="reserve-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un lot, n° lingot, certificat..." /></label>
                  <button type="button" className="sn-btn" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}><Filter /> Filtres</button>
                </div>
                {advanced && <Note tone="info">Les actifs vendus, transférés, déjà réservés ou sans poids d’or fin disponible sont automatiquement exclus par le serveur.</Note>}
                <div className="reserve-table-wrap reserve-selection-table"><table className="reserve-table"><caption className="sr-only">Lingots éligibles du stock opérationnel</caption><thead><tr><th><input type="checkbox" aria-label="Tout sélectionner" checked={filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id))} onChange={(event) => setSelectedIds(event.target.checked ? [...new Set([...selectedIds, ...filteredItems.map((item) => item.id)])] : selectedIds.filter((id) => !filteredItems.some((item) => item.id === id)))} /></th><th>Lot / Lingot</th><th>Raffinerie</th><th>Poids brut</th><th>Pureté</th><th>Poids fin</th><th>Certificat</th><th>Date d’entrée</th><th>Disponible</th></tr></thead><tbody>
                  {filteredItems.map((item) => <tr key={item.id} className={selectedIds.includes(item.id) ? 'is-selected' : ''} onClick={() => toggleSelection(item.id)}><td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} onClick={(event) => event.stopPropagation()} aria-label={`Sélectionner ${item.lot_reference}`} /></td><td><strong>{item.lot_reference}</strong><small>Lingot disponible</small></td><td>{item.refinery_name || item.processing_location || 'Non renseignée'}</td><td className="is-num">{formatGrams(item.gross_weight_grams)}</td><td className="is-num">{formatPercent(item.fineness_percentage)}</td><td className="is-num">{formatGrams(item.fine_weight_grams)}</td><td>{item.certificate_number || '—'}</td><td>{formatDate(item.entry_date)}</td><td className="is-num">{formatGrams(item.fine_weight_grams)}</td></tr>)}
                </tbody></table>{filteredItems.length === 0 && <div className="reserve-empty">Aucun lingot du stock réel ne correspond à ces critères.</div>}</div>
                <div className="reserve-selection-footer"><strong>{selectedItems.length} lot(s) sélectionné(s)</strong><div><span>Poids brut total <b>{formatGrams(summary.gross)}</b></span><span>Poids d’or fin total <b>{formatGrams(summary.fine)}</b></span></div></div>
              </>}
            </section>}

            {step === 2 && <>
              <FormSection icon={ClipboardCheck} title="Informations générales" description="Référence, motif et nature de l’affectation."><div className="reserve-fields reserve-fields--three"><Field label="Référence générée"><input value={allocation?.reference || 'Générée à l’enregistrement'} readOnly /></Field><Field label="Date d’affectation" required><input type="date" value={payload.allocation_date} onChange={(event) => set('allocation_date', event.target.value)} /></Field><Field label="Priorité"><select value={payload.priority} onChange={(event) => set('priority', event.target.value)}><option value="LOW">Basse</option><option value="NORMAL">Normale</option><option value="HIGH">Haute</option><option value="URGENT">Urgente</option></select></Field><Field label="Nature de l’affectation" required><select value={payload.allocation_nature} onChange={(event) => set('allocation_nature', event.target.value)}><option value="CONSTITUTION_RESERVE">Constitution de la réserve</option><option value="RENFORCEMENT_RESERVE">Renforcement de la réserve</option><option value="REINTEGRATION">Réintégration après contrôle</option></select></Field><Field label="Motif" required wide><textarea value={payload.reason} onChange={(event) => set('reason', event.target.value)} placeholder="Fondement et objectif de l’affectation" /></Field></div></FormSection>
              <FormSection icon={FileCheck2} title="Décision d’affectation" description="Acte administratif à l’origine de l’opération."><div className="reserve-fields reserve-fields--three"><Field label="Référence décision" required><input value={payload.decision_reference} onChange={(event) => set('decision_reference', event.target.value)} placeholder="DEC-2026-..." /></Field><Field label="Date de décision" required><input type="date" value={payload.decision_date} onChange={(event) => set('decision_date', event.target.value)} /></Field><Field label="Autorité décisionnelle" required><input value={payload.decision_authority} onChange={(event) => set('decision_authority', event.target.value)} /></Field><Field label="Direction / service"><input value={payload.decision_department} onChange={(event) => set('decision_department', event.target.value)} /></Field><Field label="Commentaire" wide><textarea value={payload.decision_comment} onChange={(event) => set('decision_comment', event.target.value)} /></Field></div></FormSection>
              <FormSection icon={Landmark} title="Destination" description="Le dépositaire provient exclusivement du référentiel Parties prenantes."><div className="reserve-fields reserve-fields--three"><Field label="Dépositaire" required><select value={payload.depository_organization_id} onChange={(event) => set('depository_organization_id', event.target.value)}><option value="">Sélectionner</option>{depositories.map((item) => <option key={item.id} value={item.id}>{item.short_name || item.name}</option>)}</select></Field><Field label="Type de dépôt" required><select value={payload.deposit_type} onChange={(event) => set('deposit_type', event.target.value)}><option value="reserve_vault">Coffre de réserve</option><option value="sovereign_vault">Coffre souverain SONASP</option><option value="custody_account">Compte de conservation</option></select></Field><Field label="Référence dépôt prévue"><input value={payload.planned_deposit_reference} onChange={(event) => set('planned_deposit_reference', event.target.value)} placeholder="BCEAO-OR-..." /></Field><Field label="Date prévue de transfert"><input type="date" value={payload.planned_transfer_date} onChange={(event) => set('planned_transfer_date', event.target.value)} /></Field><Field label="Localisation"><input value={depository?.address || depository?.administrative_region || ''} readOnly placeholder="Définie par l’organisation" /></Field></div></FormSection>
            </>}

            {step === 3 && <>
              <FormSection icon={ShieldCheck} title="Contrôles d’éligibilité" description="Chaque contrôle engage le préparateur et sera journalisé lors de la soumission."><div className="reserve-controls">{CONTROL_OPTIONS.map((control) => <label key={control.key} className={payload.control_results[control.key] ? 'is-checked' : ''}><input type="checkbox" checked={Boolean(payload.control_results[control.key])} onChange={(event) => set('control_results', { ...payload.control_results, [control.key]: event.target.checked })} /><span><CheckCircle2 /><strong>{control.label}</strong><small>{control.hint}</small></span></label>)}</div></FormSection>
              <FormSection icon={Paperclip} title="Pièces jointes" description="PDF ou image, 15 Mo maximum. La décision d’affectation est obligatoire."><div className="reserve-upload"><div className="reserve-upload__toolbar"><label><span>Type de document</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="sn-btn" onClick={() => fileInput.current?.click()}><Upload /> Ajouter un document</button><input ref={fileInput} hidden type="file" multiple accept="application/pdf,image/png,image/jpeg" onChange={(event) => queueFiles(event.target.files)} /></div><ul>{allocation?.documents.map((document) => <li key={document.id}><FileText /><div><strong>{document.file_name}</strong><small>{DOCUMENT_TYPES.find(([type]) => type === document.document_type)?.[1] || document.document_type} · {formatNumber(document.size_bytes / 1024)} Ko</small></div><button type="button" onClick={() => void openDocument(document)} aria-label={`Télécharger ${document.file_name}`}><Download /></button><button type="button" onClick={() => void removeDocument(document)} aria-label={`Supprimer ${document.file_name}`}><Trash2 /></button></li>)}{pendingDocuments.map((document) => <li key={document.id} className="is-pending"><FileText /><div><strong>{document.file.name}</strong><small>À téléverser · {formatNumber(document.file.size / 1024)} Ko</small></div><button type="button" onClick={() => setPendingDocuments((current) => current.filter((item) => item.id !== document.id))} aria-label={`Retirer ${document.file.name}`}><Trash2 /></button></li>)}</ul>{!allocation?.documents.length && pendingDocuments.length === 0 && <div className="reserve-empty">Aucune pièce jointe. Ajoutez au minimum la décision d’affectation.</div>}</div></FormSection>
            </>}

            {step === 4 && <section className="reserve-card reserve-review"><header><ShieldCheck /><div><h3>Revue & soumission</h3><p>Vérifiez la synthèse avant d’engager le circuit d’approbation.</p></div></header><div className="reserve-review__grid"><Review title="Sélection" rows={[["Lots sélectionnés", String(summary.lots)], ["Lingots", String(summary.ingots)], ["Poids brut", formatGrams(summary.gross)], ["Poids d’or fin", formatGrams(summary.fine)], ["Pureté pondérée", formatPercent(summary.purity)]]} /><Review title="Décision" rows={[["Référence", payload.decision_reference], ["Autorité", payload.decision_authority], ["Date", formatDate(payload.decision_date)], ["Motif", payload.reason]]} /><Review title="Destination" rows={[["Dépositaire", depository?.short_name || depository?.name || '—'], ["Type de dépôt", formatDepositType(payload.deposit_type)], ["Transfert prévu", formatDate(payload.planned_transfer_date)], ["Référence", payload.planned_deposit_reference || 'À renseigner']]} /><Review title="Pièces & circuit" rows={[["Documents", String((allocation?.documents.length || 0) + pendingDocuments.length)], ["Contrôles", controlsComplete ? '6 / 6 conformes' : 'Incomplets'], ["Workflow", 'Double validation puis transfert'], ["Séparation des tâches", 'Contrôlée par le serveur']]} /></div><label className={`reserve-confirmation${confirmed ? ' is-checked' : ''}`}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><ShieldCheck /><span><strong>Confirmation</strong>Je confirme que les informations ci-dessus ont été vérifiées et que les lingots sélectionnés sont éligibles à une affectation à la Réserve Nationale.</span></label><button type="button" className="sn-btn sn-btn--primary reserve-submit" onClick={() => void submit()} disabled={!confirmed || submitting}>{submitting ? <Loader2 className="sn-spin" /> : <ShieldCheck />} Soumettre pour approbation</button></section>}

            <footer className="reserve-form-nav"><button type="button" className="sn-btn" disabled={step === 1} onClick={() => setStep((value) => Math.max(1, value - 1))}><ArrowLeft /> Étape précédente</button>{step < 4 && <button type="button" className="sn-btn sn-btn--primary" onClick={() => void goNext()}>Étape suivante <ArrowRight /></button>}</footer>
          </div>

          <aside className={`reserve-summary${summaryOpen ? '' : ' is-collapsed'}`} aria-label="Résumé de l’affectation">
            <header>
              <div className="reserve-summary__heading">
                <span aria-hidden="true"><ClipboardCheck /></span>
                <div><h3>Résumé de l’affectation</h3><p>Synthèse mise à jour en temps réel</p></div>
              </div>
              <button
                type="button"
                aria-expanded={summaryOpen}
                aria-label={summaryOpen ? 'Replier le résumé' : 'Déplier le résumé'}
                onClick={() => setSummaryOpen((value) => !value)}
              >
                {summaryOpen ? <ChevronUp /> : <ChevronDown />}
              </button>
            </header>

            {summaryOpen && <div className="reserve-summary__body" aria-live="polite">
              <section className="reserve-summary__status-section">
                <div className="reserve-summary__status-head">
                  <span>Statut actuel</span>
                  <Badge tone={allocation ? RESERVE_STATUS_TONES[allocation.status] : 'warning'}>
                    {allocation ? RESERVE_STATUS_LABELS[allocation.status] : 'Brouillon'}
                  </Badge>
                </div>
                <div className="reserve-summary__progress-label"><span>Progression du dossier</span><b>{step} / 4</b></div>
                <progress max="4" value={step} aria-label={`Étape ${step} sur 4`} />
              </section>

              <SummaryMetrics
                lots={summary.lots}
                gross={formatGrams(summary.gross)}
                fine={formatGrams(summary.fine)}
                purity={formatPercent(summary.purity)}
              />

              {summary.lots === 0 && <p className="reserve-summary__empty">
                Sélectionnez un lot éligible pour afficher sa valorisation.
              </p>}

              {(summary.lots > 0 || allocation) && <>
                <SummarySection title="Valorisation indicative" rows={[
                  ['Valeur FCFA', allocation ? formatFcfa(allocation.indicative_value_fcfa) : 'Calculée à l’enregistrement'],
                  ['Valeur USD', allocation ? formatUsd(allocation.indicative_value_usd) : '—'],
                  ['Valeur EUR', allocation ? formatEur(allocation.indicative_value_eur) : '—'],
                ]} />
                <div className="reserve-summary__provenance">
                  <span>Référentiel de valorisation</span>
                  <strong>{allocation?.valuation_source || 'Cours de l’or et taux XOF officiels'}</strong>
                  <small>{allocation?.valuation_at ? formatDateTime(allocation.valuation_at) : 'Cours figés lors de l’enregistrement'}</small>
                </div>
              </>}

              {step >= 2 && <SummarySection title="Destination prévue" rows={[
                ['Dépositaire', depository?.short_name || depository?.name || 'À définir'],
                ['Type de dépôt', formatDepositType(payload.deposit_type)],
                ['Localisation', depository?.address || depository?.administrative_region || 'À définir'],
                ['Référence dépôt', payload.planned_deposit_reference || 'À renseigner'],
                ['Transfert prévu', formatDate(payload.planned_transfer_date)],
              ]} />}

              <footer className="reserve-summary__author">
                <span>Préparée par</span>
                <strong>{user?.full_name || 'Utilisateur SONASP'}</strong>
                <small>{allocation ? formatDate(allocation.created_at) : 'Enregistrement à venir'}</small>
              </footer>
            </div>}
          </aside>
        </div>
      </main>
    </NationalDashboardLayout>
  );
}

function FormSection({ icon: Icon, title, description, children }: { icon: typeof Building2; title: string; description: string; children: React.ReactNode }) {
  return <section className="reserve-card reserve-data-section"><header><span><Icon /></span><div><h3>{title}</h3><p>{description}</p></div></header><div className="reserve-data-section__body">{children}</div></section>;
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return <label className={`reserve-field${wide ? ' is-wide' : ''}`}><span>{label}{required && <i>*</i>}</span>{children}</label>;
}

function SummaryMetrics({ lots, gross, fine, purity }: { lots: number; gross: string; fine: string; purity: string }) {
  return <section className="reserve-summary__metrics">
    <h4>Sélection</h4>
    <div>
      <article><span>Lots</span><strong>{lots}</strong></article>
      <article><span>Poids brut</span><strong>{gross}</strong></article>
      <article><span>Or fin</span><strong>{fine}</strong><small>{purity} de pureté</small></article>
    </div>
  </section>;
}

function SummarySection({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <section><h4>{title}</h4><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}

function Review({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <article><h4>{title}</h4><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl></article>;
}

export default ReserveAllocationForm;
