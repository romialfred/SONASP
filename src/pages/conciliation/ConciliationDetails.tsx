import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, Archive, ArrowLeft, ArrowRight, Building2, CalendarDays,
  CheckCircle2, CircleDot, ClipboardList, Clock3, Download, Eye, FileDown,
  FileQuestion, FileText, FlaskConical, Gauge, Gem, History, Loader2,
  MessageSquare, Pencil, Play, ReceiptText, RefreshCw, Scale, ShieldCheck,
  UserRound, type LucideIcon,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Note } from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { CAPABILITIES, hasCapability, hasSensitiveCapability } from '@/lib/capabilities';
import { downloadExcelWorkbook } from '@/lib/excelExport';
import { errorMessage } from '@/lib/errorMessage';
import {
  dossierService,
  type DocumentDossier,
  type DossierComplet as DossierCompletData,
  type EvenementDossier,
} from '@/services/dossierService';
import {
  conciliationService,
  LIBELLES_PARAMETRES,
  LIBELLES_STATUTS_CONCILIATION,
  type Conciliation,
  type ContexteConciliation,
  type EcartConciliation,
  type ImpactFiscalConciliation,
  type StatutConciliation,
} from '@/services/conciliationService';
import './conciliation-detail.css';
import { blocageExpedition, calculerImpacts, fixingContractuel, mesureRaffinerie } from './conciliationImpact';

export type OngletConciliation =
  | 'apercu' | 'vente' | 'raffinage' | 'ecarts'
  | 'commentaires' | 'documents' | 'historique';

const GRAMMES_PAR_ONCE = 31.1034768;
const ETATS_SAISIE: StatutConciliation[] = ['en_attente_analyse', 'analyse_recue', 'contestee'];
const ETATS_VALIDATION: StatutConciliation[] = ['analyse_recue', 'calculee', 'en_attente_validation', 'ecart_a_verifier'];
const ENTIER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const DATE_HEURE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

const ONGLETS: Array<{ id: OngletConciliation; label: string; icon: LucideIcon }> = [
  { id: 'apercu', label: 'Aperçu', icon: Gauge },
  { id: 'vente', label: 'Détails de la vente', icon: ClipboardList },
  { id: 'raffinage', label: 'Résultats de raffinage', icon: FlaskConical },
  { id: 'ecarts', label: 'Écarts et analyse', icon: Scale },
  { id: 'commentaires', label: 'Commentaires', icon: MessageSquare },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'historique', label: 'Historique', icon: History },
];

const CONTEXTE_VIDE: ContexteConciliation = {
  lignes: [], certificat: null, analyseTeneur: null,
  expedition: null, raffinerie: null, paiement: null, origines: [], reception: null, donneesCertificat: null,
};

function deviseLisible(devise: string | null | undefined): string {
  if (!devise) return '';
  return devise.toUpperCase() === 'XOF' ? 'FCFA' : devise.toUpperCase();
}

export function formatMontantDetail(
  valeur: number | null | undefined,
  devise: string | null | undefined,
): string {
  if (valeur === null || valeur === undefined || !Number.isFinite(valeur)) return '—';
  const format = devise?.toUpperCase() === 'XOF' ? ENTIER : DECIMAL;
  return `${format.format(valeur)}${devise ? ` ${deviseLisible(devise)}` : ''}`;
}

function formatNombre(valeur: number | null | undefined, unite = '', decimales = 2): string {
  if (valeur === null || valeur === undefined || !Number.isFinite(valeur)) return '—';
  return `${valeur.toLocaleString('fr-FR', {
    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
  })}${unite ? ` ${unite}` : ''}`;
}

function dateIso(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? '';
}

function formatDate(value: string | null | undefined): string {
  const iso = dateIso(value);
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR');
}

function formatDateHeure(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_HEURE.format(date);
}

function formatTaille(octets: number | null | undefined): string {
  if (!octets || octets <= 0) return 'Taille non renseignée';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

function libelleTechnique(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  return value.split('_').join(' ').replace(/(^|\s)\p{L}/gu, (lettre: string) => lettre.toLocaleUpperCase('fr-FR'));
}

export function etapeStatut(statut: StatutConciliation): number {
  if (statut === 'cloturee') return 3;
  if (['validee', 'facture_definitive_generee'].includes(statut)) return 2;
  if (['analyse_recue', 'calculee', 'ecart_a_verifier', 'en_attente_validation', 'contestee'].includes(statut)) return 1;
  return 0;
}

function libelleStatut(statut: StatutConciliation): string {
  if (statut === 'en_attente_analyse') return 'En attente de conciliation';
  if (['analyse_recue', 'calculee', 'en_attente_validation'].includes(statut)) return 'Analyse en cours';
  if (statut === 'ecart_a_verifier' || statut === 'contestee') return 'En litige';
  if (statut === 'validee' || statut === 'facture_definitive_generee') return 'Conciliée';
  return LIBELLES_STATUTS_CONCILIATION[statut];
}

function tonStatut(statut: StatutConciliation): string {
  if (statut === 'en_attente_analyse') return 'waiting';
  if (statut === 'contestee' || statut === 'ecart_a_verifier') return 'danger';
  if (['validee', 'facture_definitive_generee', 'cloturee'].includes(statut)) return 'success';
  return 'info';
}

function nomVendeur(dossier: Conciliation): string {
  return dossier.mining_company?.name || 'Vendeur non renseigné';
}

function nomAcheteur(dossier: Conciliation): string {
  return dossier.customer?.name || 'Acheteur non renseigné';
}

function nomOrigine(dossier: Conciliation, contexte: ContexteConciliation): string {
  const origines = [...new Set((contexte.origines ?? []).map((origine) => origine.origine).filter(Boolean))];
  if (origines.length > 0) return origines.join(', ');
  return dossier.mining_company?.name || 'Origine non disponible';
}

function referenceVente(dossier: Conciliation): string {
  return dossier.sale?.sale_number || dossier.reference;
}

function poidsBrut(dossier: Conciliation, contexte: ContexteConciliation): number | null {
  const expedition = contexte.expedition?.total_gross_weight_grams;
  if (expedition !== null && expedition !== undefined) return expedition;
  if (contexte.lignes.length > 0) return contexte.lignes.reduce((somme, ligne) => somme + ligne.quantity_grams, 0);
  return dossier.poids_initial_g;
}

function pureteInitiale(dossier: Conciliation, contexte: ContexteConciliation): number | null {
  if (dossier.teneur_initiale_pct !== null) return dossier.teneur_initiale_pct;
  const lignes = contexte.lignes.filter((ligne) => ligne.fineness_percentage !== null);
  if (lignes.length === 0) return null;
  const masse = lignes.reduce((somme, ligne) => somme + ligne.quantity_grams, 0);
  if (masse <= 0) return lignes[0].fineness_percentage;
  return lignes.reduce((somme, ligne) => somme + ligne.quantity_grams * (ligne.fineness_percentage as number), 0) / masse;
}

function pureteFinale(dossier: Conciliation, contexte: ContexteConciliation): number | null {
  return dossier.teneur_finale_pct
    ?? mesureRaffinerie(contexte).teneur
    ?? contexte.analyseTeneur?.teneur_retenue_pct
    ?? null;
}

function poidsFinalMesure(dossier: Conciliation, contexte: ContexteConciliation): number | null {
  return dossier.poids_final_g ?? contexte.donneesCertificat?.total_weight_g ?? null;
}

function typeOr(dossier: Conciliation, contexte: ContexteConciliation): string {
  const value = dossier.sale?.metal_type || contexte.lignes[0]?.metal_type;
  return value ? libelleTechnique(value) : 'Or';
}

function cheminSparkline(valeurs: number[], largeur = 260, hauteur = 34): string {
  if (valeurs.length === 0) return '';
  const serie = valeurs.length === 1 ? [0, valeurs[0]] : valeurs;
  const minimum = Math.min(...serie);
  const maximum = Math.max(...serie);
  const amplitude = maximum - minimum || 1;
  return serie.map((valeur, index) => {
    const x = (index / (serie.length - 1)) * largeur;
    const y = hauteur - 3 - ((valeur - minimum) / amplitude) * (hauteur - 8);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function StatusBadge({ dossier }: { dossier: Conciliation }) {
  return (
    <span className={`conciliation-detail__status is-${tonStatut(dossier.statut)}`}>
      <CircleDot aria-hidden="true" /> {libelleStatut(dossier.statut)}
    </span>
  );
}

function CardTitle({ icon: Icon, children, action }: {
  icon?: LucideIcon; children: ReactNode; action?: ReactNode;
}) {
  return (
    <header className="conciliation-detail-card__head">
      <h2>{Icon && <span><Icon aria-hidden="true" /></span>}{children}</h2>
      {action}
    </header>
  );
}

function EmptyPanel({ icon: Icon = FileQuestion, title, description }: {
  icon?: LucideIcon; title: string; description: string;
}) {
  return (
    <div className="conciliation-detail-empty">
      <Icon aria-hidden="true" /><strong>{title}</strong><p>{description}</p>
    </div>
  );
}

function DocumentRow({ document, compact = false, loading, onOpen }: {
  document: DocumentDossier; compact?: boolean; loading: boolean; onOpen: () => void;
}) {
  const ouvrable = dossierService.estOuvrable(document);
  return (
    <li className={`conciliation-document${compact ? ' is-compact' : ''}`}>
      <span className="conciliation-document__icon"><FileText aria-hidden="true" /></span>
      <div>
        <strong title={document.nom ?? 'Document'}>{document.nom ?? 'Document'}</strong>
        <span>{[formatDate(document.date), formatTaille(document.taille)].join(' · ')}</span>
      </div>
      <button
        type="button"
        aria-label={`Télécharger ${document.nom ?? 'le document'}`}
        title={ouvrable ? 'Télécharger le document' : 'Fichier indisponible'}
        onClick={onOpen}
        disabled={!ouvrable || loading}
      >
        {loading ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
      </button>
    </li>
  );
}

function TimelineStatut({ dossier }: { dossier: Conciliation }) {
  const courante = etapeStatut(dossier.statut);
  const etapes = [
    { label: 'En attente de conciliation', description: 'Résultats de raffinage reçus, en attente d’analyse.', date: dossier.created_at, icon: Clock3 },
    { label: 'Analyse en cours', description: 'Analyse des écarts et vérifications.', date: dossier.soumis_le, icon: Scale },
    { label: 'Conciliée', description: 'Vente conciliée avec succès.', date: dossier.valide_le, icon: CheckCircle2 },
    { label: 'Clôturée', description: 'Dossier clôturé et archivé.', date: dossier.cloture_le, icon: Archive },
  ];
  return (
    <ol className="conciliation-progress__timeline" aria-label="Progression de la conciliation">
      {etapes.map((etape, index) => {
        const Icon = etape.icon;
        const state = index < courante ? 'done' : index === courante ? 'current' : 'future';
        return (
          <li key={etape.label} className={`is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <div className="conciliation-progress__marker"><Icon aria-hidden="true" /></div>
            <div><strong>{etape.label}</strong><p>{etape.description}</p><time dateTime={etape.date ?? undefined}>{formatDate(etape.date)}</time></div>
          </li>
        );
      })}
    </ol>
  );
}

function Apercu({ dossier, contexte, dossierComplet, documentEnCours, onDocument, onTab }: {
  dossier: Conciliation; contexte: ContexteConciliation;
  dossierComplet: DossierCompletData | null; documentEnCours: string | null;
  onDocument: (document: DocumentDossier) => void; onTab: (onglet: OngletConciliation) => void;
}) {
  const devise = dossier.devise_finale || dossier.devise_initiale || dossier.sale?.currency || null;
  const poids = poidsBrut(dossier, contexte);
  const purete = pureteInitiale(dossier, contexte);
  const finalMesure = poidsFinalMesure(dossier, contexte);
  const finalPur = pureteFinale(dossier, contexte);
  const prixOnce = dossier.prix_initial ?? dossier.sale?.london_am_rate ?? null;
  const prixGramme = prixOnce === null || prixOnce === undefined ? null : prixOnce / GRAMMES_PAR_ONCE;
  const montantBrut = dossier.sale?.gross_proceeds ?? dossier.ca_initial;
  const montantTotal = dossier.sale?.total_amount ?? montantBrut;
  const redevance = dossier.sale?.royalty_amount;
  const frais = dossier.sale?.freight_cost == null && dossier.sale?.other_costs == null
    ? null
    : (dossier.sale?.freight_cost ?? 0) + (dossier.sale?.other_costs ?? 0);
  const ecart = dossier.ca_final !== null && dossier.ca_initial !== null ? dossier.ca_final - dossier.ca_initial : null;
  const serie = [dossier.ca_initial, dossier.sale?.gross_proceeds, dossier.sale?.total_amount, dossier.ca_final]
    .filter((valeur): valeur is number => valeur !== null && valeur !== undefined && Number.isFinite(valeur));
  const recents = (dossierComplet?.documents ?? []).slice(0, 2);
  const dateVente = dossier.sale?.sale_date || dossier.created_at;
  const periode = dateVente ? DATE_LONGUE.format(new Date(`${dateIso(dateVente)}T00:00:00`)) : '—';

  return (
    <div className="conciliation-detail-layout">
      <div className="conciliation-detail-main">
        <section className="conciliation-detail-card conciliation-general">
          <CardTitle action={<button type="button" className="conciliation-detail-card__edit" onClick={() => onTab('vente')} aria-label="Voir les détails complets"><Pencil aria-hidden="true" /></button>}>
            Informations générales
          </CardTitle>
          <div className="conciliation-general__body">
            <dl>
              <div><dt>Référence vente</dt><dd>{referenceVente(dossier)}</dd></div>
              <div><dt>Date de vente</dt><dd>{formatDate(dateVente)}</dd></div>
              <div><dt>Statut actuel</dt><dd><StatusBadge dossier={dossier} /></dd></div>
              <div><dt>Période de vente</dt><dd className="is-capitalized">{periode}</dd></div>
              <div><dt>Type de vente</dt><dd>{dossier.sale?.is_internal_sale ? 'Vente interne' : libelleTechnique(dossier.sale?.order_type, 'Vente d’or')}</dd></div>
              <div><dt>Destination d’expédition</dt><dd>{contexte.expedition?.shipped_to_company || '—'}</dd></div>
            </dl>
            <dl>
              <div><dt>Vendeur</dt><dd>{nomOrigine(dossier, contexte)}</dd></div>
              <div><dt>Contact</dt><dd>{dossier.mining_company?.contact_person_phone || '—'}</dd></div>
              <div><dt>Acheteur</dt><dd>{nomAcheteur(dossier)}</dd></div>
              <div><dt>Devise</dt><dd>{deviseLisible(devise) || '—'}</dd></div>
              <div><dt>Taux de change appliqué</dt><dd>{formatNombre(dossier.taux_change_final ?? dossier.taux_change_initial, '', 4)}</dd></div>
              <div><dt>Référence facture</dt><dd>{contexte.paiement?.invoice_number || contexte.paiement?.reference_number || '—'}</dd></div>
            </dl>
          </div>
        </section>

        <section className="conciliation-detail-card conciliation-sale-summary">
          <CardTitle icon={Gem}>Résumé de la vente</CardTitle>
          <div className="conciliation-sale-summary__body">
            <dl>
              <div><dt>Type d’or</dt><dd>{typeOr(dossier, contexte)}</dd></div>
              <div><dt>Qualité de l’or</dt><dd>{purete === null ? '—' : <span className="conciliation-quality">{formatNombre(purete / 100 * 24, 'K', 0)} ({formatNombre(purete, '%', 2)})</span>}</dd></div>
              <div><dt>Poids brut</dt><dd>{formatNombre(poids, 'g')}</dd></div>
              <div><dt>Poids fin (théorique)</dt><dd>{formatNombre(dossier.or_fin_initial_g, 'g')}</dd></div>
              <div><dt>Prix au gramme</dt><dd>{formatMontantDetail(prixGramme, devise)}</dd></div>
              <div><dt>Montant brut</dt><dd>{formatMontantDetail(montantBrut, devise)}</dd></div>
              <div><dt>Redevance / taxes</dt><dd>{formatMontantDetail(redevance, devise)}</dd></div>
              <div><dt>Frais déclarés</dt><dd>{formatMontantDetail(frais, devise)}</dd></div>
            </dl>
            <div className="conciliation-sale-summary__total"><span>Montant total</span><strong>{formatMontantDetail(montantTotal, devise)}</strong></div>
          </div>
        </section>

        <section className="conciliation-detail-card conciliation-progress">
          <CardTitle icon={Clock3}>Statut de conciliation</CardTitle>
          <TimelineStatut dossier={dossier} />
        </section>
      </div>

      <aside className="conciliation-detail-aside" aria-label="Informations contextuelles">
        <section className={`conciliation-detail-card conciliation-gap-card${(ecart ?? 0) < 0 ? ' is-negative' : ''}`}>
          <h2>Écart cumulé</h2><strong>{formatMontantDetail(ecart, devise)}</strong>
          <span>{ecart === null ? 'en attente de l’analyse' : ecart < 0 ? 'en faveur des acheteurs' : 'en faveur des vendeurs'}</span>
          {serie.length > 1 && <svg viewBox="0 0 260 38" role="img" aria-label="Évolution des valeurs commerciales" preserveAspectRatio="none"><path d={cheminSparkline(serie)} /></svg>}
        </section>

        <section className="conciliation-detail-card conciliation-finance-card">
          <h2>Informations financières</h2>
          <dl>
            <div><dt>Montant brut</dt><dd>{formatMontantDetail(montantBrut, devise)}</dd></div>
            <div><dt>Redevance / taxes</dt><dd>{formatMontantDetail(redevance, devise)}</dd></div>
            <div><dt>Frais déclarés</dt><dd>{formatMontantDetail(frais, devise)}</dd></div>
            <div className="is-total"><dt>Montant total</dt><dd>{formatMontantDetail(montantTotal, devise)}</dd></div>
          </dl>
        </section>

        <section className="conciliation-detail-card conciliation-refining-card">
          <h2>Résultats de raffinage</h2>
          {contexte.certificat || contexte.analyseTeneur || dossier.poids_final_g !== null ? (
            <><dl>
              <div><dt>Poids après raffinage</dt><dd>{formatNombre(finalMesure, 'g')}</dd></div>
              <div><dt>Pureté moyenne</dt><dd>{formatNombre(finalPur, '%')}</dd></div>
              <div><dt>Poids fin (réel)</dt><dd>{formatNombre(dossier.or_fin_final_g, 'g')}</dd></div>
              <div><dt>Date de réception</dt><dd>{formatDate(contexte.reception?.received_at)}</dd></div>
            </dl><button type="button" className="conciliation-aside-action" onClick={() => onTab('raffinage')}>Voir les résultats détaillés <Eye aria-hidden="true" /></button></>
          ) : <div className="conciliation-aside-empty"><FlaskConical aria-hidden="true" /><span>Résultat indisponible</span></div>}
        </section>

        <section className="conciliation-detail-card conciliation-recent-docs">
          <h2>Documents récents</h2>
          {recents.length > 0 ? <ul>{recents.map((document) => (
            <DocumentRow compact key={`${document.source}-${document.id}`} document={document} loading={documentEnCours === document.id} onOpen={() => onDocument(document)} />
          ))}</ul> : <div className="conciliation-aside-empty"><FileText aria-hidden="true" /><span>Aucun document visible</span></div>}
          <button type="button" className="conciliation-aside-link" onClick={() => onTab('documents')}>Voir tous les documents <ArrowRight aria-hidden="true" /></button>
        </section>
      </aside>
    </div>
  );
}

function DetailsVente({ dossier, contexte }: { dossier: Conciliation; contexte: ContexteConciliation }) {
  const sale = dossier.sale;
  if (!sale) return <EmptyPanel title="Vente source indisponible" description="La vente liée n’est pas visible dans votre périmètre." />;
  const devise = sale.currency || dossier.devise_initiale;
  return (
    <div className="conciliation-tab-grid">
      <section className="conciliation-detail-card conciliation-tab-card">
        <CardTitle icon={ReceiptText}>Informations commerciales</CardTitle>
        <dl className="conciliation-data-list is-two-columns">
          <div><dt>Référence</dt><dd>{sale.sale_number}</dd></div><div><dt>Date</dt><dd>{formatDate(sale.sale_date)}</dd></div>
          <div><dt>Statut de la vente</dt><dd>{libelleTechnique(sale.status)}</dd></div><div><dt>Type d’ordre</dt><dd>{libelleTechnique(sale.order_type)}</dd></div>
          <div><dt>Mécanisme de prix</dt><dd>{libelleTechnique(sale.mechanism_type)}</dd></div><div><dt>Métal</dt><dd>{typeOr(dossier, contexte)}</dd></div>
          <div><dt>Quantité fine</dt><dd>{formatNombre(sale.quantity_oz, 'oz')}</dd></div><div><dt>Devise</dt><dd>{deviseLisible(devise)}</dd></div>
          <div><dt>Cours initial</dt><dd>{formatMontantDetail(sale.london_am_rate, devise)}</dd></div><div><dt>Cours final</dt><dd>{formatMontantDetail(sale.final_price_per_oz, devise)}</dd></div>
          <div><dt>Produit brut</dt><dd>{formatMontantDetail(sale.gross_proceeds, devise)}</dd></div><div><dt>Produit net</dt><dd>{formatMontantDetail(sale.net_proceeds, devise)}</dd></div>
          <div><dt>Montant total</dt><dd>{formatMontantDetail(sale.total_amount, devise)}</dd></div><div><dt>Vente finalisée le</dt><dd>{formatDateHeure(sale.completed_at)}</dd></div>
        </dl>
      </section>
      <section className="conciliation-detail-card conciliation-tab-card">
        <CardTitle icon={Building2}>Contreparties et expédition</CardTitle>
        <dl className="conciliation-data-list is-two-columns">
          <div><dt>Origine de l’or</dt><dd>{nomOrigine(dossier, contexte)}</dd></div><div><dt>Vendeur export</dt><dd>{nomVendeur(dossier)}</dd></div>
          <div><dt>Acheteur</dt><dd>{nomAcheteur(dossier)}</dd></div><div><dt>Contact acheteur</dt><dd>{dossier.customer?.phone || '—'}</dd></div>
          <div><dt>Lot d’expédition</dt><dd>{contexte.expedition?.expedition_lot_number || '—'}</dd></div><div><dt>Destination</dt><dd>{contexte.expedition?.shipped_to_company || '—'}</dd></div>
          <div><dt>Pays de destination</dt><dd>{contexte.expedition?.shipped_to_country || '—'}</dd></div><div><dt>Raffinerie</dt><dd>{contexte.raffinerie?.name || '—'}</dd></div>
          <div><dt>Préparée le</dt><dd>{formatDateHeure(contexte.expedition?.prepared_at)}</dd></div><div><dt>Expédiée le</dt><dd>{formatDateHeure(contexte.expedition?.shipped_at)}</dd></div>
        </dl>
      </section>
      <section className="conciliation-detail-card conciliation-tab-card is-wide">
        <CardTitle icon={Gem}>Lignes de vente</CardTitle>
        {contexte.lignes.length === 0 ? <EmptyPanel title="Aucune ligne détaillée" description="La vente ne contient pas de ligne article visible." /> : (
          <div className="conciliation-table-scroll"><table className="conciliation-detail-table">
            <thead><tr><th>#</th><th>Métal</th><th>Poids brut</th><th>Poids fin</th><th>Pureté</th><th>Prix unitaire</th><th>Total</th></tr></thead>
            <tbody>{contexte.lignes.map((ligne) => <tr key={ligne.id}>
              <td>{ligne.line_number}</td><td>{libelleTechnique(ligne.metal_type)}</td><td>{formatNombre(ligne.quantity_grams, 'g')}</td>
              <td>{formatNombre(ligne.fine_weight_oz, 'oz')}</td><td>{formatNombre(ligne.fineness_percentage, '%')}</td>
              <td>{formatMontantDetail(ligne.unit_price, devise)}</td><td>{formatMontantDetail(ligne.line_total, devise)}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}

function ResultatsRaffinage({ dossier, contexte, ecarts, peutSaisir, enCours, poids, teneur, prix, dateFixing, setPoids, setTeneur, setPrix, setDateFixing, onSubmit, onCertificat, onDocument, documentEnCours }: {
  dossier: Conciliation; contexte: ContexteConciliation; peutSaisir: boolean; enCours: boolean;
  ecarts: EcartConciliation[]; onCertificat: (id: string) => void;
  onDocument: (document: DocumentDossier) => void; documentEnCours: string | null;
  poids: string; teneur: string; prix: string; dateFixing: string;
  setPoids: (value: string) => void; setTeneur: (value: string) => void;
  setPrix: (value: string) => void; setDateFixing: (value: string) => void; onSubmit: () => void;
}) {
  const certificat = contexte.certificat;
  const analyse = contexte.analyseTeneur;
  const certificatApprouve = certificat?.approval_status === 'approved' && Boolean(certificat.approved_by && certificat.approved_at);
  const analyseRetenue = analyse?.teneur_retenue_pct !== null && analyse?.teneur_retenue_pct !== undefined;
  const sourceDejaEnregistree = Boolean(dossier.source_analyse_type && (dossier.assay_certificate_id || dossier.analyse_teneur_id));
  const sourceDisponible = certificat ? certificatApprouve : Boolean(analyseRetenue || sourceDejaEnregistree);
  const saisiePossible = ETATS_SAISIE.includes(dossier.statut);
  const blocage = blocageExpedition(contexte);
  const impacts = calculerImpacts(dossier, contexte, { poids, teneur, prix });
  const mesuresCompletes = mesureRaffinerie(contexte).poids !== null && mesureRaffinerie(contexte).teneur !== null;
  return (
    <div className="conciliation-tab-grid conciliation-refining-workspace">
      <section className="conciliation-detail-card conciliation-proof-chain is-wide" aria-label="Traçabilité des analyses">
        <div><span className="conciliation-eyebrow">01 · ORIGINE</span><strong>{nomOrigine(dossier, contexte)}</strong><span>{contexte.analysesMine?.length ?? 0} analyse(s) Mine rattachée(s)</span></div>
        <ArrowRight aria-hidden="true" />
        <div><span className="conciliation-eyebrow">02 · LOT EXPÉDIÉ</span><strong>{contexte.expedition?.expedition_lot_number || 'Expédition non rattachée'}</strong><span>{contexte.expedition?.shipped_at ? `Expédié le ${formatDate(contexte.expedition.shipped_at)}` : 'Expédition à vérifier'}</span></div>
        <ArrowRight aria-hidden="true" />
        <div><span className="conciliation-eyebrow">03 · RAFFINERIE</span><strong>{contexte.raffinerie?.name || 'Destination non renseignée'}</strong><span>{contexte.certificats?.length ?? (certificat ? 1 : 0)} certificat(s) rattaché(s)</span></div>
      </section>
      {blocage && <div className="is-wide"><Note tone="warning" icon={AlertTriangle}>{blocage}</Note></div>}
      <section className="conciliation-detail-card conciliation-tab-card is-wide">
        <CardTitle icon={ClipboardList}>Rapports Mine et preuves de la raffinerie</CardTitle>
        <div className="conciliation-evidence-grid">
          <div><h3>Déclaration Mine / expédition</h3>{contexte.analysesMine?.length ? contexte.analysesMine.map(a => <dl className="conciliation-evidence" key={a.id}><div><dt>Rapport</dt><dd>{a.reference}</dd></div><div><dt>Teneur déclarée</dt><dd>{formatNombre(a.teneur_declaree_pct, '%')}</dd></div><div><dt>Date de prélèvement</dt><dd>{formatDate(a.date_prelevement)}</dd></div><div><dt>Décision</dt><dd>{libelleTechnique(a.statut)}</dd></div></dl>) : <p>Aucun rapport Mine rattaché. Les valeurs commerciales d’origine sont conservées ; elles ne constituent pas un rapport de laboratoire.</p>}</div>
          <div><h3>Certificat de la même expédition</h3>{(contexte.certificats?.length ?? 0) > 0 && <label className="conciliation-proof-select"><span>Rapport de raffinage</span><select value={certificat?.id || ''} disabled={!saisiePossible || enCours} onChange={e => onCertificat(e.target.value)}><option value="">Sélectionner un certificat</option>{contexte.certificats?.map(c => <option key={c.id} value={c.id}>{c.certificate_number || c.file_name} · {libelleTechnique(c.approval_status)}</option>)}</select></label>}<p>Seules les preuves de cette expédition sont proposées. Un rapport en attente d’approbation reste consultable, mais ne peut pas arrêter les valeurs définitives.</p></div>
        </div>
      </section>
      <section className="conciliation-detail-card conciliation-tab-card">
        <CardTitle icon={FlaskConical}>Résultat du raffinage</CardTitle>
        {certificat || analyse || dossier.poids_final_g !== null ? <dl className="conciliation-data-list is-two-columns">
          <div><dt>Raffinerie</dt><dd>{contexte.raffinerie?.name || contexte.expedition?.shipped_to_company || '—'}</dd></div><div><dt>Laboratoire</dt><dd>{certificat?.issuing_laboratory || '—'}</dd></div>
          <div><dt>Certificat</dt><dd>{certificat?.certificate_number || analyse?.reference || '—'}</dd></div><div><dt>Échantillon</dt><dd>{certificat?.sample_id || analyse?.numero_echantillon || '—'}</dd></div>
          <div><dt>Date du certificat</dt><dd>{formatDate(certificat?.certificate_date || analyse?.date_declaration)}</dd></div><div><dt>Date de réception</dt><dd>{formatDate(contexte.reception?.received_at)}</dd></div>
          <div><dt>Poids avant raffinage</dt><dd>{formatNombre(poidsBrut(dossier, contexte), 'g')}</dd></div><div><dt>Poids après raffinage</dt><dd>{formatNombre(impacts.find(i => i.code === 'poids')?.final, 'g')}</dd></div>
          <div><dt>Poids de l’échantillon</dt><dd>{formatNombre(certificat?.sample_weight_grams ?? analyse?.masse_echantillon_g, 'g')}</dd></div><div><dt>Pureté déclarée</dt><dd>{formatNombre(pureteInitiale(dossier, contexte), '%')}</dd></div>
          <div><dt>Pureté retenue</dt><dd>{formatNombre(impacts.find(i => i.code === 'teneur')?.final, '%')}</dd></div><div><dt>Poids fin théorique</dt><dd>{formatNombre(dossier.or_fin_initial_g, 'g', 4)}</dd></div>
          <div><dt>Poids fin calculé</dt><dd>{formatNombre(impacts.find(i => i.code === 'or_fin')?.final, 'g', 4)}</dd></div><div><dt>Statut du certificat</dt><dd>{libelleTechnique(certificat?.approval_status || analyse?.statut)}</dd></div>
        </dl> : <EmptyPanel icon={FlaskConical} title="Résultat de raffinage indisponible" description="Aucun certificat ou résultat d’analyse n’est encore rattaché à cette vente." />}
        {certificat?.file_path && <div className="conciliation-section-intro"><button type="button" className="sn-btn sn-btn--secondary" disabled={documentEnCours === certificat.id} onClick={() => onDocument({ etape: 'analyse', source: 'assay_certificates', id: certificat.id, nom: certificat.file_name, chemin: certificat.file_path, taille: certificat.file_size, date: certificat.certificate_date })}><FileText aria-hidden="true" />{documentEnCours === certificat.id ? 'Ouverture…' : 'Ouvrir le certificat sélectionné'}</button></div>}
      </section>
      <section id="conciliation-analysis-form" className="conciliation-detail-card conciliation-tab-card">
        <CardTitle icon={Play}>Lancer la conciliation</CardTitle>
        {blocage ? <EmptyPanel icon={FileQuestion} title="Rattachement à compléter" description="Complétez le lien et la destination dans la vente et son expédition. Aucun résultat n’est inventé ou affecté automatiquement." />
          : !peutSaisir ? <EmptyPanel icon={ShieldCheck} title="Action non autorisée" description="Votre profil peut consulter ce résultat, mais ne peut pas enregistrer l’analyse de conciliation." />
          : !saisiePossible ? <EmptyPanel icon={CheckCircle2} title="Analyse déjà arrêtée" description={`Le dossier est au statut « ${libelleStatut(dossier.statut)} » et ne peut plus recevoir de nouvelles valeurs.`} />
            : !sourceDisponible ? <EmptyPanel icon={FileQuestion} title="Preuve d’analyse requise" description="Un certificat ou une analyse de teneur réel doit être rattaché avant de lancer la conciliation." />
              : <form className="conciliation-analysis-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
                <p>Valeurs issues du certificat sélectionné et du fixing contractuel de la vente. L’enregistrement prépare la conciliation ; il ne valide pas les ajustements.</p>
                {!mesuresCompletes && <Note tone="warning">Le poids total vérifié du lot et sa teneur doivent être renseignés dans le certificat avant enregistrement. Le poids de l’échantillon ne peut pas les remplacer.</Note>}
                <div className="conciliation-analysis-form__grid">
                  <label><span>Poids final (g)</span><input readOnly inputMode="decimal" value={poids} onChange={(event) => setPoids(event.target.value)} /></label>
                  <label><span>Teneur finale (%)</span><input readOnly inputMode="decimal" value={teneur} onChange={(event) => setTeneur(event.target.value)} /></label>
                  <label><span>Prix retenu / once</span><input readOnly inputMode="decimal" value={prix} onChange={(event) => setPrix(event.target.value)} /></label>
                  <label><span>Date de fixing</span><input readOnly type="date" value={dateFixing} onChange={(event) => setDateFixing(event.target.value)} /></label>
                </div>
                <div className="conciliation-analysis-form__source"><FileText aria-hidden="true" /><span>Source</span><strong>{certificat?.certificate_number || certificat?.file_name || analyse?.reference || 'Analyse rattachée'}</strong></div>
                <button type="submit" className="sn-btn sn-btn--primary" disabled={enCours || !mesuresCompletes || !dateFixing || !prix}>{enCours ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Scale aria-hidden="true" />}{enCours ? 'Enregistrement…' : 'Enregistrer le résultat'}</button>
              </form>}
      </section>
      <section className="conciliation-detail-card conciliation-tab-card is-wide">
        <CardTitle icon={Scale}>Impact du résultat de raffinage</CardTitle>
        <p className="conciliation-section-intro">Comparaison indicative avant validation. Les quantités de stock, paiements et déclarations fiscales existants ne sont pas réécrits.</p>
        <div className="conciliation-table-scroll"><table className="conciliation-detail-table"><thead><tr><th>Paramètre</th><th>Vente / déclaration initiale</th><th>Résultat sélectionné</th><th>Écart</th></tr></thead><tbody>{impacts.map(l => <tr key={l.code}><th scope="row">{l.label}</th><td>{formatNombre(l.initial, l.unite)}</td><td>{formatNombre(l.final, l.unite)}</td><td className={l.ecart && l.ecart < 0 ? 'is-negative' : ''}>{formatNombre(l.ecart, l.code === 'teneur' ? 'points' : l.unite)}</td></tr>)}</tbody></table></div>
      </section>
      <section className="conciliation-detail-card conciliation-tab-card is-wide">
        <CardTitle icon={ReceiptText}>Conséquences fiscales et régularisations</CardTitle>
        <p className="conciliation-section-intro">Un écart de poids, de teneur ou de fixing peut modifier l’assiette des taxes. Les ajustements ci-dessous sont les écritures enregistrées en base, distinctes des versements déjà effectués. Un crédit constaté n’est pas un remboursement exécuté.</p>
        <SimulationFiscale dossier={dossier} ca={impacts.find(i => i.code === 'ca_ht')?.final ?? null} orFin={impacts.find(i => i.code === 'or_fin')?.final ?? null} prix={impacts.find(i => i.code === 'prix')?.final ?? null} date={dateFixing} />
        {ecarts.some(e => e.parametre === 'taxe') && <div className="conciliation-table-scroll"><table className="conciliation-detail-table"><thead><tr><th>Taxe</th><th>Base initiale calculée</th><th>Montant définitif</th><th>Ajustement constaté</th></tr></thead><tbody>{ecarts.filter(e => e.parametre === 'taxe').map(e => <tr key={e.id}><th scope="row">{libelleTechnique(e.code_taxe)}</th><td>{formatMontantDetail(e.valeur_initiale, e.unite || dossier.devise_initiale)}</td><td>{formatMontantDetail(e.valeur_definitive, e.unite || dossier.devise_finale || dossier.devise_initiale)}</td><td>{formatMontantDetail(e.ecart_absolu, e.unite || dossier.devise_initiale)}</td></tr>)}</tbody></table></div>}
        {contexte.fiscalite?.length ? <div className="conciliation-table-scroll"><table className="conciliation-detail-table"><thead><tr><th>Date</th><th>Taxe</th><th>Nature de l’écriture</th><th>Sens</th><th>Montant / devise</th><th>État du crédit</th></tr></thead><tbody>{contexte.fiscalite.map(m => <tr key={m.id}><td>{formatDate(m.created_at)}</td><th scope="row">{libelleTechnique(m.code_taxe)}</th><td>{libelleTechnique(m.type_mouvement)}</td><td>{libelleTechnique(m.sens)}</td><td>{formatMontantDetail(m.montant, m.devise)}</td><td>{libelleTechnique(m.statut_credit)}</td></tr>)}</tbody></table></div> : <div className="conciliation-section-intro">Aucune écriture fiscale rattachée visible. Aucun montant payé, taux ou remboursement ne peut être présumé ; la régularisation reste à établir et à valider.</div>}
      </section>
    </div>
  );
}

function SimulationFiscale({ dossier, ca, orFin, prix, date }: { dossier: Conciliation; ca: number | null; orFin: number | null; prix: number | null; date: string }) {
  const [lignes, setLignes] = useState<ImpactFiscalConciliation[]>([]);
  const [etat, setEtat] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let actif = true;
    setEtat('loading');
    conciliationService.impactsFiscaux(dossier.id, ca, orFin, prix, date).then(data => {
      if (actif) { setLignes(data); setEtat('ready'); }
    }).catch(() => { if (actif) setEtat('error'); });
    return () => { actif = false; };
  }, [dossier.id, ca, orFin, prix, date]);
  const libelles = { calculable: 'Estimation · à valider', regle_absente: 'Règle non disponible', conversion_requise: 'Conversion à justifier', assiette_incomplete: 'Assiette à compléter', base_initiale_absente: 'Base historique à compléter' };
  if (etat === 'loading') return <p className="conciliation-section-intro" role="status">Calcul des impacts fiscaux…</p>;
  if (etat === 'error') return <div className="conciliation-section-intro"><Note tone="warning">Simulation fiscale indisponible. Vérifiez la disponibilité du service de calcul ; aucune estimation locale de taxe ne remplace le résultat serveur.</Note></div>;
  return <div className="conciliation-table-scroll"><table className="conciliation-detail-table" aria-label="Simulation des régularisations fiscales"><thead><tr><th>Taxe / assiette</th><th>Initial enregistré</th><th>Après analyse</th><th>Ajustement estimé</th><th>Versements consignés</th><th>Contrôle</th></tr></thead><tbody>{lignes.map(l => <tr key={l.code_taxe}><th scope="row">{libelleTechnique(l.code_taxe)}<br /><small>{libelleTechnique(l.assiette)}</small></th><td>{formatMontantDetail(l.initial, l.devise)}</td><td>{formatMontantDetail(l.definitif, l.devise)}</td><td>{formatMontantDetail(l.ecart, l.devise)}</td><td>{formatMontantDetail(l.versements, l.devise)}</td><td>{libelles[l.etat]}</td></tr>)}</tbody></table></div>;
}

function EcartsAnalyse({ dossier, ecarts, peutValider, enCours, onValider }: {
  dossier: Conciliation; ecarts: EcartConciliation[]; peutValider: boolean; enCours: boolean; onValider: () => void;
}) {
  const validationPossible = ETATS_VALIDATION.includes(dossier.statut) && dossier.ca_final !== null;
  return (
    <div className="conciliation-tab-grid is-single">
      <section className="conciliation-detail-card conciliation-tab-card">
        <CardTitle icon={Scale}>Déclaré versus mesuré après raffinage</CardTitle>
        {ecarts.length === 0 ? <EmptyPanel icon={Scale} title="Aucun écart calculé" description="Les écarts seront produits par le moteur lors de la validation de l’analyse." /> : (
          <div className="conciliation-table-scroll"><table className="conciliation-detail-table">
            <thead><tr><th>Paramètre</th><th>Déclaré</th><th>Mesuré / confirmé</th><th>Écart</th><th>Variation</th><th>Contrôle</th></tr></thead>
            <tbody>{ecarts.map((ecart) => <tr key={ecart.id}>
              <td><strong>{LIBELLES_PARAMETRES[ecart.parametre] || libelleTechnique(ecart.parametre)}</strong>{ecart.code_taxe && <small>{ecart.code_taxe.toUpperCase()}</small>}</td>
              <td>{formatNombre(ecart.valeur_initiale, ecart.unite || '')}</td><td>{formatNombre(ecart.valeur_definitive, ecart.unite || '')}</td>
              <td className={(ecart.ecart_absolu ?? 0) < 0 ? 'is-negative' : (ecart.ecart_absolu ?? 0) > 0 ? 'is-positive' : ''}>{formatNombre(ecart.ecart_absolu, ecart.unite || '')}</td>
              <td>{formatNombre(ecart.ecart_relatif_pct, '%')}</td><td><span className={`conciliation-control-badge${ecart.depasse_seuil ? ' is-alert' : ''}`}>{ecart.depasse_seuil ? 'Seuil dépassé' : 'Conforme'}</span></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
      {peutValider && validationPossible && <section className="conciliation-detail-card conciliation-validation-card">
        <div><ShieldCheck aria-hidden="true" /><div><strong>Validation transactionnelle</strong><p>Cette action arrête les valeurs, écrit les ajustements commerciaux et fiscaux et conserve la trace d’audit.</p></div></div>
        <button type="button" className="sn-btn sn-btn--primary" onClick={onValider} disabled={enCours}>{enCours ? <Loader2 className="sn-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{enCours ? 'Validation…' : 'Valider la conciliation'}</button>
      </section>}
    </div>
  );
}

function Commentaires({ dossier }: { dossier: Conciliation }) {
  const commentaires = [
    dossier.observations ? { id: 'conciliation', titre: 'Observation de conciliation', texte: dossier.observations } : null,
    dossier.sale?.internal_notes ? { id: 'interne', titre: 'Note interne de la vente', texte: dossier.sale.internal_notes } : null,
    dossier.sale?.customer_notes ? { id: 'client', titre: 'Note client de la vente', texte: dossier.sale.customer_notes } : null,
  ].filter((item): item is { id: string; titre: string; texte: string } => Boolean(item));
  return <section className="conciliation-detail-card conciliation-tab-card"><CardTitle icon={MessageSquare}>Commentaires liés au dossier</CardTitle>
    {commentaires.length === 0 ? <EmptyPanel icon={MessageSquare} title="Aucun commentaire enregistré" description="Aucune note traçable n’est actuellement rattachée à cette vente ou à sa conciliation." /> : <ol className="conciliation-comments">
      {commentaires.map((commentaire) => <li key={commentaire.id}><span className="conciliation-comments__avatar"><MessageSquare aria-hidden="true" /></span><div><header><strong>{commentaire.titre}</strong></header><p>{commentaire.texte}</p></div></li>)}
    </ol>}
  </section>;
}

function Documents({ documents, documentEnCours, onDocument }: {
  documents: DocumentDossier[]; documentEnCours: string | null; onDocument: (document: DocumentDossier) => void;
}) {
  return <section className="conciliation-detail-card conciliation-tab-card"><CardTitle icon={FileText}>Documents du dossier</CardTitle>
    {documents.length === 0 ? <EmptyPanel icon={FileText} title="Aucun document visible" description="Aucune pièce de la chaîne n’est accessible dans votre périmètre." /> : <ul className="conciliation-documents-list">
      {documents.map((document) => <DocumentRow key={`${document.source}-${document.id}-${document.nom ?? ''}`} document={document} loading={documentEnCours === document.id} onOpen={() => onDocument(document)} />)}
    </ul>}
  </section>;
}

function HistoriqueDossier({ evenements, dossier }: { evenements: EvenementDossier[]; dossier: Conciliation }) {
  const fallback: EvenementDossier[] = [
    { etape: 'conciliation', date: dossier.created_at, titre: 'Dossier de conciliation ouvert', detail: dossier.reference },
  ];
  if (dossier.soumis_le) fallback.push({ etape: 'conciliation', date: dossier.soumis_le, titre: 'Analyse enregistrée', detail: dossier.motif_statut });
  if (dossier.valide_le) fallback.push({ etape: 'conciliation', date: dossier.valide_le, titre: 'Conciliation validée', detail: dossier.motif_statut });
  if (dossier.cloture_le) fallback.push({ etape: 'conciliation', date: dossier.cloture_le, titre: 'Dossier clôturé', detail: dossier.motif_statut });
  const liste = (evenements.length > 0 ? evenements : fallback).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return <section className="conciliation-detail-card conciliation-tab-card"><CardTitle icon={History}>Historique du dossier</CardTitle>
    {liste.length === 0 ? <EmptyPanel icon={History} title="Aucun événement visible" description="La chronologie ne contient encore aucun événement dans votre périmètre." /> : <ol className="conciliation-history">
      {liste.map((evenement, index) => <li key={`${evenement.etape}-${evenement.date}-${index}`}><span aria-hidden="true" /><div><header><strong>{evenement.titre}</strong><time>{formatDateHeure(evenement.date)}</time></header>{evenement.detail && <p>{evenement.detail}</p>}{evenement.acteur && <small><UserRound aria-hidden="true" /> {evenement.acteur}</small>}</div></li>)}
    </ol>}
  </section>;
}

function ConciliationSkeleton() {
  return <div className="conciliation-detail-skeleton" role="status" aria-label="Chargement du détail de la vente">
    <div className="is-actions" /><div className="is-summary" /><div className="is-tabs" /><div className="is-content"><span /><span /></div>
  </div>;
}

export function ConciliationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [dossier, setDossier] = useState<Conciliation | null>(null);
  const [contexte, setContexte] = useState<ContexteConciliation>(CONTEXTE_VIDE);
  const [dossierComplet, setDossierComplet] = useState<DossierCompletData | null>(null);
  const [ecarts, setEcarts] = useState<EcartConciliation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<OngletConciliation>('apercu');
  const [enCours, setEnCours] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [documentEnCours, setDocumentEnCours] = useState<string | null>(null);
  const [poids, setPoids] = useState('');
  const [teneur, setTeneur] = useState('');
  const [prix, setPrix] = useState('');
  const [dateFixing, setDateFixing] = useState('');
  const peutSaisir = hasSensitiveCapability(user, CAPABILITIES.RECONCILIATION_EDIT);
  const peutValider = hasSensitiveCapability(user, CAPABILITIES.RECONCILIATION_APPROVE);
  const peutExporter = hasCapability(user, CAPABILITIES.RECONCILIATION_EXPORT);

  const initialiserFormulaire = useCallback((fiche: Conciliation, details: ContexteConciliation) => {
    const poidsInitial = poidsFinalMesure(fiche, details);
    const teneurInitiale = pureteFinale(fiche, details);
    const fixing = fixingContractuel(fiche);
    const prixInitial = fixing.prix;
    setPoids(poidsInitial?.toString() ?? ''); setTeneur(teneurInitiale?.toString() ?? ''); setPrix(prixInitial?.toString() ?? '');
    setDateFixing(fixing.date);
  }, []);

  const charger = useCallback(async () => {
    if (!id) { setChargement(false); return; }
    try {
      setChargement(true); setErreur(null); setAvertissement(null);
      const [fiche, lignesEcarts] = await Promise.all([conciliationService.parIdentifiant(id), conciliationService.ecarts(id)]);
      setDossier(fiche); setEcarts(lignesEcarts);
      if (!fiche) { setContexte(CONTEXTE_VIDE); setDossierComplet(null); return; }
      const [contexteResultat, dossierResultat] = await Promise.allSettled([conciliationService.contexte(fiche), dossierService.charger('conciliation', id)]);
      const details = contexteResultat.status === 'fulfilled' ? contexteResultat.value : CONTEXTE_VIDE;
      setContexte(details); setDossierComplet(dossierResultat.status === 'fulfilled' ? dossierResultat.value : null); initialiserFormulaire(fiche, details);
      const incidents = (details.incidents ?? []).map(i => `${i.section} (${i.type === 'acces' ? 'accès refusé' : 'erreur de chargement'} · ${i.code})`);
      if (contexteResultat.status === 'rejected') incidents.push('Contexte métier : chargement impossible');
      if (dossierResultat.status === 'rejected') incidents.push('Documents et historique : chargement impossible');
      if (incidents.length) setAvertissement(`${incidents.join(' ; ')}. Les autres informations restent disponibles. Réessayez le chargement.`);
    } catch (error) {
      setErreur(errorMessage(error, 'Le dossier n’a pas pu être chargé.')); setDossier(null);
    } finally { setChargement(false); }
  }, [id, initialiserFormulaire]);

  useEffect(() => { void charger(); }, [charger]);

  const ouvrirOnglet = useCallback((nouvelOnglet: OngletConciliation) => {
    setOnglet(nouvelOnglet);
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }, []);
  const naviguerOnglets = (event: KeyboardEvent<HTMLElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const boutons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const indexActif = boutons.findIndex((bouton) => bouton === document.activeElement);
    if (indexActif < 0) return;
    event.preventDefault();
    const cible = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? boutons.length - 1
        : (indexActif + (event.key === 'ArrowRight' ? 1 : -1) + boutons.length) % boutons.length;
    boutons[cible]?.focus();
    boutons[cible]?.click();
  };
  const lancerConciliation = () => {
    ouvrirOnglet('raffinage');
  };

  const choisirCertificat = (certificatId: string) => {
    if (!dossier) return;
    const selection = {
      ...contexte,
      certificat: contexte.certificats?.find(c => c.id === certificatId) ?? null,
      donneesCertificat: contexte.mesuresCertificats?.find(m => m.certificate_id === certificatId) ?? null,
    };
    setContexte(selection);
    initialiserFormulaire({ ...dossier, poids_final_g: null, teneur_finale_pct: null }, selection);
  };

  const enregistrerAnalyse = async () => {
    if (!dossier) return;
    const p = Number(poids.replace(',', '.')); const t = Number(teneur.replace(',', '.')); const pr = Number(prix.replace(',', '.'));
    const certificatId = contexte.certificat?.approval_status === 'approved'
      ? contexte.certificat.id
      : dossier.source_analyse_type === 'certificat_acheteur' ? dossier.assay_certificate_id : null;
    const analyseId = contexte.analyseTeneur?.teneur_retenue_pct !== null && contexte.analyseTeneur?.teneur_retenue_pct !== undefined
      ? contexte.analyseTeneur.id
      : dossier.source_analyse_type === 'analyse_teneur' ? dossier.analyse_teneur_id : null;
    const sourceId = certificatId || analyseId;
    const sourceType = certificatId ? 'certificat_acheteur' as const : 'analyse_teneur' as const;
    if (!sourceId) { setErreur('Aucune preuve d’analyse réelle n’est rattachée à ce dossier.'); return; }
    if (!Number.isFinite(p) || p <= 0) { setErreur('Le poids final doit être un nombre positif.'); return; }
    if (!Number.isFinite(t) || t <= 0 || t > 100) { setErreur('La teneur doit être comprise entre 0 et 100 %.'); return; }
    if (!Number.isFinite(pr) || pr <= 0) { setErreur('Le prix retenu doit être un nombre positif.'); return; }
    if (!dateFixing) { setErreur('La date de fixing est requise.'); return; }
    try {
      setEnCours(true); setErreur(null);
      const resultat = await conciliationService.enregistrerAnalyse({ conciliationId: dossier.id, sourceType, sourceId, poidsFinalG: p, teneurFinalePct: t, prixFinal: pr, dateFixing });
      setMessage(`Analyse enregistrée : ${formatNombre(resultat.or_fin_final_g, 'g', 4)} d’or fin.`); await charger(); setOnglet('ecarts');
    } catch (error) { setErreur(errorMessage(error, 'Le résultat n’a pas pu être enregistré.')); }
    finally { setEnCours(false); }
  };

  const valider = async () => {
    if (!dossier) return;
    try {
      setEnCours(true); setErreur(null);
      // Empêche une nouvelle interface d'appeler l'ancien moteur fiscal avant
      // le déploiement atomique de la migration correspondante.
      try {
        await conciliationService.impactsFiscaux(dossier.id, null, null, null, dossier.date_fixing || '');
      } catch {
        throw new Error('Le moteur de régularisation fiscale est indisponible. La validation est suspendue ; aucune écriture n’a été créée.');
      }
      const resultat = await conciliationService.valider(dossier.id); const sansRegle = resultat.taxes_sans_regle ?? [];
      setMessage(`Dossier ${resultat.reference} validé. Écart commercial : ${formatMontantDetail(resultat.ecart_commercial, dossier.devise_finale || dossier.devise_initiale)}.${sansRegle.length > 0 ? ` Règles fiscales absentes : ${sansRegle.join(', ')}.` : ''}`);
      await charger();
    } catch (error) { setErreur(errorMessage(error, 'La validation a été refusée.')); }
    finally { setEnCours(false); }
  };

  const ouvrirDocument = useCallback(async (documentDossier: DocumentDossier) => {
    try {
      setDocumentEnCours(documentDossier.id); setErreur(null); const url = await dossierService.urlPourDocument(documentDossier);
      if (!url) { setErreur('Ce document est référencé dans le dossier, mais son fichier n’est pas disponible.'); return; }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) { setErreur(errorMessage(error, 'Le document n’a pas pu être téléchargé.')); }
    finally { setDocumentEnCours(null); }
  }, []);

  const exporter = async () => {
    if (!dossier) return;
    try {
      setExportEnCours(true); setErreur(null); const devise = dossier.devise_finale || dossier.devise_initiale || dossier.sale?.currency;
      await downloadExcelWorkbook([
        { name: 'Dossier', rows: [{ 'Référence vente': referenceVente(dossier), 'Référence conciliation': dossier.reference, Statut: libelleStatut(dossier.statut), Vendeur: nomOrigine(dossier, contexte), Acheteur: nomAcheteur(dossier), 'Date de vente': dateIso(dossier.sale?.sale_date), 'Poids brut (g)': poidsBrut(dossier, contexte), 'Or fin déclaré (g)': dossier.or_fin_initial_g, 'Or fin définitif (g)': dossier.or_fin_final_g, 'Valeur déclarée': dossier.ca_initial, 'Valeur définitive': dossier.ca_final, Devise: deviseLisible(devise) }] },
        { name: 'Écarts', rows: ecarts.map((ecart) => ({ Paramètre: LIBELLES_PARAMETRES[ecart.parametre] || ecart.parametre, Taxe: ecart.code_taxe, Déclaré: ecart.valeur_initiale, Définitif: ecart.valeur_definitive, Écart: ecart.ecart_absolu, 'Écart relatif (%)': ecart.ecart_relatif_pct, 'Seuil dépassé': ecart.depasse_seuil ? 'Oui' : 'Non' })) },
        { name: 'Documents', rows: (dossierComplet?.documents ?? []).map((doc) => ({ Étape: doc.etape, Nom: doc.nom, Catégorie: doc.categorie, Référence: doc.reference, Date: doc.date, Taille: doc.taille })) },
      ], `dossier-${referenceVente(dossier)}.xlsx`); setMessage('Le dossier a été exporté.');
    } catch (error) { setErreur(errorMessage(error, 'Le dossier n’a pas pu être exporté.')); }
    finally { setExportEnCours(false); }
  };

  const entete = useMemo(() => {
    if (!dossier) return null;
    const devise = dossier.devise_finale || dossier.devise_initiale || dossier.sale?.currency;
    return { date: dossier.sale?.sale_date || dossier.created_at, poids: poidsBrut(dossier, contexte), montant: dossier.sale?.total_amount ?? dossier.sale?.gross_proceeds ?? dossier.ca_initial, devise };
  }, [contexte, dossier]);

  if (chargement) return <NationalDashboardLayout><main className="sn-page conciliation-detail-page" aria-busy="true"><ConciliationSkeleton /></main></NationalDashboardLayout>;
  if (erreur && !dossier) return <NationalDashboardLayout><main className="sn-page conciliation-detail-page conciliation-detail-state"><AlertTriangle aria-hidden="true" /><h1>Impossible d’afficher ce dossier</h1><p>{erreur}</p><div><button type="button" className="sn-btn" onClick={() => navigate('/conciliation')}><ArrowLeft aria-hidden="true" /> Retour à la liste</button><button type="button" className="sn-btn sn-btn--primary" onClick={() => void charger()}><RefreshCw aria-hidden="true" /> Réessayer</button></div></main></NationalDashboardLayout>;
  if (!dossier || !entete) return <NationalDashboardLayout><main className="sn-page conciliation-detail-page conciliation-detail-state"><FileQuestion aria-hidden="true" /><h1>Dossier introuvable</h1><p>Ce dossier n’existe pas ou ne vous est pas accessible.</p><button type="button" className="sn-btn" onClick={() => navigate('/conciliation')}><ArrowLeft aria-hidden="true" /> Retour à la liste</button></main></NationalDashboardLayout>;

  const documents = dossierComplet?.documents ?? [];
  const peutLancer = peutSaisir && ETATS_SAISIE.includes(dossier.statut);
  return (
    <NationalDashboardLayout>
      <main className="sn-page conciliation-detail-page">
        <div className="conciliation-detail-top">
          <nav className="sn-breadcrumb" aria-label="Fil d’Ariane">
            <a href="/conciliation" onClick={(event) => { event.preventDefault(); navigate('/conciliation'); }}>Conciliation</a><span aria-hidden="true">›</span>
            <a href="/conciliation" onClick={(event) => { event.preventDefault(); navigate('/conciliation'); }}>Dossiers</a><span aria-hidden="true">›</span><strong>Détail de la vente</strong>
          </nav>
          <div className="conciliation-detail-actions">
            <button type="button" className="sn-btn" onClick={() => navigate('/conciliation')}><ArrowLeft aria-hidden="true" /> Retour à la liste</button><span />
            {peutExporter && <button type="button" className="sn-btn" onClick={() => void exporter()} disabled={exportEnCours}>{exportEnCours ? <Loader2 className="sn-spin" aria-hidden="true" /> : <FileDown aria-hidden="true" />}Exporter le dossier</button>}
            {peutLancer && <button type="button" className="sn-btn sn-btn--primary" onClick={lancerConciliation}><Scale aria-hidden="true" /> Lancer la conciliation</button>}
          </div>
        </div>

        <section className="conciliation-detail-hero" aria-label="Résumé de la vente">
          <div className="conciliation-detail-hero__reference"><StatusBadge dossier={dossier} /><h1>{referenceVente(dossier)}</h1><p>Référence unique de la vente</p></div>
          <dl>
            <div><dt>Date de vente</dt><dd><CalendarDays aria-hidden="true" /> {formatDate(entete.date)}</dd></div><div><dt>Artisan / Société</dt><dd title={nomOrigine(dossier, contexte)}>{nomOrigine(dossier, contexte)}</dd></div>
            <div><dt>Acheteur</dt><dd>{nomAcheteur(dossier)}</dd></div><div><dt>Poids brut</dt><dd>{formatNombre(entete.poids, 'g')}</dd></div>
            <div className="is-total"><dt>Montant total</dt><dd>{formatMontantDetail(entete.montant, entete.devise)}</dd></div>
          </dl>
        </section>

        <div ref={tabsRef} className="conciliation-detail-tabs-wrap">
          <nav className="conciliation-detail-tabs" aria-label="Sections du dossier" role="tablist" onKeyDown={naviguerOnglets}>
            {ONGLETS.map(({ id: tabId, label, icon: Icon }) => <button key={tabId} type="button" role="tab" tabIndex={onglet === tabId ? 0 : -1} aria-selected={onglet === tabId} aria-controls={`conciliation-panel-${tabId}`} className={onglet === tabId ? 'is-active' : undefined} onClick={() => setOnglet(tabId)}><Icon aria-hidden="true" /> {label}</button>)}
          </nav>
        </div>

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
        {avertissement && <Note tone="warning" icon={AlertTriangle}>{avertissement} <button type="button" className="sn-btn" onClick={() => void charger()}>Réessayer</button></Note>}
        {message && <Note tone="success">{message}</Note>}

        <section id={`conciliation-panel-${onglet}`} role="tabpanel" aria-label={ONGLETS.find((tab) => tab.id === onglet)?.label}>
          <header className="conciliation-panel-heading"><span className="conciliation-eyebrow">DOSSIER DE CONCILIATION · {dossier.reference}</span><h2>{ONGLETS.find(tab => tab.id === onglet)?.label}</h2><p>{({ apercu: 'Synthèse de la vente et état du rapprochement.', vente: 'Données commerciales d’origine, contreparties et composition du lot.', raffinage: 'Confrontez les déclarations de la Mine aux mesures de la raffinerie sur la même expédition.', ecarts: 'Contrôlez les écarts avant toute validation des ajustements.', commentaires: 'Observations consignées et éléments de décision.', documents: 'Pièces justificatives rattachées à la chaîne de traçabilité.', historique: 'Chronologie des opérations et des décisions du dossier.' })[onglet]}</p></header>
          {onglet === 'apercu' && <Apercu dossier={dossier} contexte={contexte} dossierComplet={dossierComplet} documentEnCours={documentEnCours} onDocument={(doc) => void ouvrirDocument(doc)} onTab={ouvrirOnglet} />}
          {onglet === 'vente' && <DetailsVente dossier={dossier} contexte={contexte} />}
          {onglet === 'raffinage' && <ResultatsRaffinage dossier={dossier} contexte={contexte} ecarts={ecarts} onCertificat={choisirCertificat} peutSaisir={peutSaisir} enCours={enCours} poids={poids} teneur={teneur} prix={prix} dateFixing={dateFixing} setPoids={setPoids} setTeneur={setTeneur} setPrix={setPrix} setDateFixing={setDateFixing} onSubmit={() => void enregistrerAnalyse()} onDocument={(doc) => void ouvrirDocument(doc)} documentEnCours={documentEnCours} />}
          {onglet === 'ecarts' && <EcartsAnalyse dossier={dossier} ecarts={ecarts} peutValider={peutValider} enCours={enCours} onValider={() => void valider()} />}
          {onglet === 'commentaires' && <Commentaires dossier={dossier} />}
          {onglet === 'documents' && <Documents documents={documents} documentEnCours={documentEnCours} onDocument={(doc) => void ouvrirDocument(doc)} />}
          {onglet === 'historique' && <HistoriqueDossier evenements={dossierComplet?.chronologie ?? []} dossier={dossier} />}
        </section>
      </main>
    </NationalDashboardLayout>
  );
}

export default ConciliationDetails;
