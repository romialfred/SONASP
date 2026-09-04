import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Search,
  SlidersHorizontal,
  UserRound,
  Weight,
  X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Note, PageHeader } from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { CAPABILITIES, hasCapability } from '@/lib/capabilities';
import { downloadExcelWorkbook } from '@/lib/excelExport';
import { errorMessage } from '@/lib/errorMessage';
import {
  conciliationService,
  type Conciliation,
  type StatutConciliation,
  type VenteConciliable,
} from '@/services/conciliationService';
import './conciliations-page.css';

export type VueConciliation = 'attente' | 'raffinage' | 'litige' | 'concilies' | 'tous';

const STATUTS_ATTENTE = new Set<StatutConciliation>([
  'en_attente_analyse',
  'calculee',
  'en_attente_validation',
]);
const STATUTS_RAFFINAGE = new Set<StatutConciliation>(['analyse_recue']);
const STATUTS_LITIGE = new Set<StatutConciliation>(['ecart_a_verifier', 'contestee']);
const STATUTS_CONCILIES = new Set<StatutConciliation>([
  'validee',
  'facture_definitive_generee',
  'cloturee',
]);

const ENTIER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function dateIso(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? '';
}

export function dateDossier(dossier: Conciliation): string {
  return dateIso(dossier.sale?.sale_date) || dateIso(dossier.created_at);
}

export function categorieDossier(dossier: Conciliation): Exclude<VueConciliation, 'tous'> | 'annule' {
  if (STATUTS_ATTENTE.has(dossier.statut)) return 'attente';
  if (STATUTS_RAFFINAGE.has(dossier.statut)) return 'raffinage';
  if (STATUTS_LITIGE.has(dossier.statut)) return 'litige';
  if (STATUTS_CONCILIES.has(dossier.statut)) return 'concilies';
  return 'annule';
}

function societeDossier(dossier: Conciliation): string {
  if (dossier.mining_company?.name) return dossier.mining_company.name;
  if (dossier.sale?.seller_type === 'sonasp') return 'SONASP';
  return 'Société non renseignée';
}

function acheteurDossier(dossier: Conciliation): string {
  return dossier.customer?.name || 'Acheteur non renseigné';
}

function referenceDossier(dossier: Conciliation): string {
  return dossier.sale?.sale_number || dossier.reference;
}

function poidsDossier(dossier: Conciliation): number | null {
  const poids = dossier.poids_final_g
    ?? dossier.poids_initial_g
    ?? dossier.or_fin_final_g
    ?? dossier.or_fin_initial_g;
  if (poids !== null) return poids;
  return dossier.sale?.quantity_oz === undefined
    ? null
    : dossier.sale.quantity_oz * 31.1034768;
}

function montantDossier(dossier: Conciliation): { valeur: number | null; devise: string | null } {
  const definitif = STATUTS_CONCILIES.has(dossier.statut) && dossier.ca_final !== null;
  return {
    valeur: definitif ? dossier.ca_final : dossier.ca_initial,
    devise: definitif
      ? dossier.devise_finale || dossier.devise_initiale || dossier.sale?.currency || null
      : dossier.devise_initiale || dossier.sale?.currency || null,
  };
}

function libelleDevise(devise: string | null): string {
  if (!devise) return '';
  return devise.toUpperCase() === 'XOF' ? 'FCFA' : devise.toUpperCase();
}

export function formatMontant(valeur: number | null, devise: string | null): string {
  if (valeur === null) return '—';
  const format = devise?.toUpperCase() === 'XOF' ? ENTIER : DECIMAL;
  return `${format.format(valeur)}${devise ? ` ${libelleDevise(devise)}` : ''}`;
}

export interface ResumeMontant {
  valeur: number | null;
  devise: string | null;
  multiDevises: boolean;
}

export function resumerMontants(dossiers: Conciliation[]): ResumeMontant {
  const montants = dossiers
    .map(montantDossier)
    .filter((montant): montant is { valeur: number; devise: string | null } => montant.valeur !== null);
  const devises = new Set(montants.map((montant) => montant.devise || ''));
  if (devises.size > 1) return { valeur: null, devise: null, multiDevises: true };
  return {
    valeur: montants.reduce((somme, montant) => somme + montant.valeur, 0),
    devise: montants[0]?.devise ?? null,
    multiDevises: false,
  };
}

export interface FiltresConciliation {
  recherche: string;
  societe: string;
  acheteur: string;
  debut: string;
  fin: string;
  vue: VueConciliation;
}

function normaliserRecherche(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fr');
}

export function filtrerDossiers(
  dossiers: Conciliation[],
  filtres: FiltresConciliation,
): Conciliation[] {
  const terme = normaliserRecherche(filtres.recherche);

  return dossiers.filter((dossier) => {
    if (filtres.vue !== 'tous' && categorieDossier(dossier) !== filtres.vue) return false;
    if (filtres.societe !== 'toutes' && dossier.mining_company_id !== filtres.societe) return false;
    if (filtres.acheteur !== 'tous' && dossier.customer_id !== filtres.acheteur) return false;

    const date = dateDossier(dossier);
    if (filtres.debut && (!date || date < filtres.debut)) return false;
    if (filtres.fin && (!date || date > filtres.fin)) return false;

    if (!terme) return true;
    return [
      dossier.reference,
      referenceDossier(dossier),
      societeDossier(dossier),
      acheteurDossier(dossier),
    ].some((valeur) => normaliserRecherche(valeur).includes(terme));
  });
}

function memeMois(value: string | null | undefined, date = new Date()): boolean {
  if (!value) return false;
  const candidate = new Date(value);
  return candidate.getFullYear() === date.getFullYear() && candidate.getMonth() === date.getMonth();
}

function libelleStatut(dossier: Conciliation): string {
  const categorie = categorieDossier(dossier);
  if (categorie === 'attente') return 'En attente de conciliation';
  if (categorie === 'raffinage') return 'En raffinage';
  if (categorie === 'litige') return 'En litige';
  if (categorie === 'concilies') return 'Conciliée';
  return 'Annulée';
}

function cheminSparkline(valeurs: number[], largeur = 180, hauteur = 36): string {
  if (valeurs.length === 0) return '';
  const serie = valeurs.length === 1 ? [valeurs[0], valeurs[0]] : valeurs;
  const minimum = Math.min(...serie);
  const maximum = Math.max(...serie);
  const amplitude = maximum - minimum || 1;
  return serie.map((valeur, index) => {
    const x = (index / (serie.length - 1)) * largeur;
    const y = hauteur - 3 - ((valeur - minimum) / amplitude) * (hauteur - 8);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

interface StatusTabProps {
  active: boolean;
  count: number;
  icon: typeof Clock3;
  label: string;
  onClick: () => void;
  tone: 'green' | 'blue' | 'red' | 'mint' | 'slate';
}

function StatusTab({ active, count, icon: Icon, label, onClick, tone }: StatusTabProps) {
  return (
    <button
      type="button"
      className={`conciliation-tab is-${tone}${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <b>{ENTIER.format(count)}</b>
    </button>
  );
}

function MetricCard({
  dossiers,
  icon: Icon,
  label,
  tone,
}: {
  dossiers: Conciliation[];
  icon: typeof Clock3;
  label: string;
  tone: 'amber' | 'blue' | 'red' | 'green';
}) {
  const resume = resumerMontants(dossiers);
  return (
    <article className={`conciliation-metric is-${tone}`}>
      <span className="conciliation-metric__icon"><Icon aria-hidden="true" /></span>
      <div className="conciliation-metric__copy">
        <p>{label}</p>
        <strong>{ENTIER.format(dossiers.length)} <small>{dossiers.length === 1 ? 'Dossier' : 'Dossiers'}</small></strong>
        <span>Valeur totale</span>
        <b>{resume.multiDevises ? 'Plusieurs devises' : formatMontant(resume.valeur, resume.devise)}</b>
      </div>
    </article>
  );
}

function DossierCard({ dossier, onOpen }: { dossier: Conciliation; onOpen: () => void }) {
  const categorie = categorieDossier(dossier);
  const poids = poidsDossier(dossier);
  const montant = montantDossier(dossier);
  const date = dateDossier(dossier);

  return (
    <article className={`conciliation-card is-${categorie}`}>
      <div className="conciliation-card__topline">
        <span className="conciliation-card__status">
          <i aria-hidden="true" /> {libelleStatut(dossier)}
        </span>
        <span className="conciliation-card__document" aria-hidden="true">
          <FileText />
        </span>
      </div>
      <h3 title={referenceDossier(dossier)}>{referenceDossier(dossier)}</h3>
      <dl>
        <div><dt><CalendarDays aria-hidden="true" /><span className="sr-only">Date</span></dt><dd>{date ? new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR') : '—'}</dd></div>
        <div><dt><UserRound aria-hidden="true" /><span className="sr-only">Société</span></dt><dd title={societeDossier(dossier)}>{societeDossier(dossier)}</dd></div>
        <div><dt><Building2 aria-hidden="true" /><span className="sr-only">Acheteur</span></dt><dd title={acheteurDossier(dossier)}>{acheteurDossier(dossier)}</dd></div>
        <div><dt><Weight aria-hidden="true" /><span className="sr-only">Poids</span></dt><dd>{poids === null ? '—' : `${DECIMAL.format(poids)} g`}</dd></div>
        <div className="conciliation-card__amount"><dt><Coins aria-hidden="true" /><span className="sr-only">Montant</span></dt><dd>{formatMontant(montant.valeur, montant.devise)}</dd></div>
      </dl>
      <button type="button" className="conciliation-card__link" onClick={onOpen}>
        Voir les détails <ChevronRight aria-hidden="true" />
      </button>
    </article>
  );
}

export function ConciliationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dossiers, setDossiers] = useState<Conciliation[]>([]);
  const [ventes, setVentes] = useState<VenteConciliable[]>([]);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [vue, setVue] = useState<VueConciliation>('attente');
  const [recherche, setRecherche] = useState('');
  const [societe, setSociete] = useState('toutes');
  const [acheteur, setAcheteur] = useState('tous');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const [venteChoisie, setVenteChoisie] = useState('');
  const [ouverture, setOuverture] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [page, setPage] = useState(1);
  const [taillePage, setTaillePage] = useState(40);

  const peutOuvrir = hasCapability(user, CAPABILITIES.RECONCILIATION_CREATE);
  const peutExporter = hasCapability(user, CAPABILITIES.RECONCILIATION_EXPORT);

  const charger = useCallback(async (silencieux = false) => {
    try {
      silencieux ? setActualisation(true) : setChargement(true);
      setErreur(null);
      const [liste, conciliables] = await Promise.all([
        conciliationService.lister(),
        peutOuvrir ? conciliationService.ventesConciliables() : Promise.resolve([]),
      ]);
      setDossiers(liste);
      setVentes(conciliables);
    } catch (error) {
      setErreur(errorMessage(error, 'Les dossiers de conciliation n’ont pas pu être chargés.'));
      setDossiers([]);
    } finally {
      setChargement(false);
      setActualisation(false);
    }
  }, [peutOuvrir]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const dossiersDansPerimetre = useMemo(
    () => filtrerDossiers(dossiers, { recherche, societe, acheteur, debut, fin, vue: 'tous' }),
    [acheteur, debut, dossiers, fin, recherche, societe],
  );
  const groupesFiltres = useMemo(() => ({
    attente: dossiersDansPerimetre.filter((dossier) => categorieDossier(dossier) === 'attente'),
    raffinage: dossiersDansPerimetre.filter((dossier) => categorieDossier(dossier) === 'raffinage'),
    litige: dossiersDansPerimetre.filter((dossier) => categorieDossier(dossier) === 'litige'),
    concilies: dossiersDansPerimetre.filter((dossier) => categorieDossier(dossier) === 'concilies'),
  }), [dossiersDansPerimetre]);

  const conciliesCeMois = useMemo(
    () => groupesFiltres.concilies.filter((dossier) => memeMois(dossier.valide_le || dossier.cloture_le || dossier.updated_at)),
    [groupesFiltres.concilies],
  );

  const resumeEcart = useMemo(() => {
    const lignes = groupesFiltres.concilies
      .filter((dossier) => dossier.ca_initial !== null && dossier.ca_final !== null)
      .map((dossier) => ({
        valeur: (dossier.ca_final as number) - (dossier.ca_initial as number),
        devise: dossier.devise_finale || dossier.devise_initiale || dossier.sale?.currency || null,
        date: dossier.valide_le || dossier.updated_at,
      }));
    const devises = new Set(lignes.map((ligne) => ligne.devise || ''));
    const multiDevises = devises.size > 1;
    const valeur = multiDevises ? null : lignes.reduce((somme, ligne) => somme + ligne.valeur, 0);
    let cumul = 0;
    const serie = lignes
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((ligne) => (cumul += ligne.valeur));
    return { valeur, devise: lignes[0]?.devise ?? null, multiDevises, serie };
  }, [groupesFiltres.concilies]);

  const societes = useMemo(() => {
    const uniques = new Map<string, string>();
    dossiers.forEach((dossier) => {
      if (dossier.mining_company_id) uniques.set(dossier.mining_company_id, societeDossier(dossier));
    });
    return [...uniques.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  }, [dossiers]);

  const acheteurs = useMemo(() => {
    const uniques = new Map<string, string>();
    dossiers.forEach((dossier) => {
      if (dossier.customer_id) uniques.set(dossier.customer_id, acheteurDossier(dossier));
    });
    return [...uniques.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  }, [dossiers]);

  const dossiersFiltres = vue === 'tous' ? dossiersDansPerimetre : groupesFiltres[vue];
  const nombrePages = Math.max(1, Math.ceil(dossiersFiltres.length / taillePage));
  const dossiersPage = dossiersFiltres.slice((page - 1) * taillePage, page * taillePage);
  const premier = dossiersFiltres.length === 0 ? 0 : (page - 1) * taillePage + 1;
  const dernier = Math.min(page * taillePage, dossiersFiltres.length);
  const nombreFiltres = [
    normaliserRecherche(recherche),
    societe !== 'toutes',
    acheteur !== 'tous',
    Boolean(debut),
    Boolean(fin),
  ]
    .filter(Boolean).length;

  useEffect(() => {
    setPage(1);
  }, [acheteur, debut, fin, recherche, societe, taillePage, vue]);

  useEffect(() => {
    if (page > nombrePages) setPage(nombrePages);
  }, [nombrePages, page]);

  const ouvrirDossier = async () => {
    if (!venteChoisie) {
      setErreur('Choisissez la vente à concilier.');
      return;
    }
    try {
      setOuverture(true);
      setErreur(null);
      const dossier = await conciliationService.ouvrir(venteChoisie);
      setMessage(`Le dossier ${dossier.reference} a été ouvert.`);
      setVenteChoisie('');
      await charger(true);
      navigate(`/conciliation/${dossier.id}`);
    } catch (error) {
      setErreur(errorMessage(error, 'Le dossier n’a pas pu être ouvert.'));
    } finally {
      setOuverture(false);
    }
  };

  const reinitialiserFiltres = () => {
    setRecherche('');
    setSociete('toutes');
    setAcheteur('tous');
    setDebut('');
    setFin('');
  };

  const exporter = async () => {
    if (dossiersFiltres.length === 0) return;
    try {
      setExportEnCours(true);
      setErreur(null);
      await downloadExcelWorkbook([{
        name: 'Conciliation des ventes',
        rows: dossiersFiltres.map((dossier) => {
          const montant = montantDossier(dossier);
          return {
            'Référence vente': referenceDossier(dossier),
            'Référence conciliation': dossier.reference,
            Date: dateDossier(dossier),
            Statut: libelleStatut(dossier),
            'Société d’origine': societeDossier(dossier),
            Acheteur: acheteurDossier(dossier),
            'Poids (g)': poidsDossier(dossier),
            Montant: montant.valeur,
            Devise: libelleDevise(montant.devise),
          };
        }),
      }], `conciliations-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setMessage(`${ENTIER.format(dossiersFiltres.length)} dossier${dossiersFiltres.length > 1 ? 's' : ''} exporté${dossiersFiltres.length > 1 ? 's' : ''}.`);
    } catch (error) {
      setErreur(errorMessage(error, 'L’export n’a pas pu être généré.'));
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <NationalDashboardLayout>
      <main className="sn-page conciliation-page" aria-busy={chargement || actualisation}>
        <PageHeader
          title="Conciliation des ventes"
          subtitle="Suivez et conciliez les ventes d’or après réception des résultats de raffinage."
          icon={Scale}
          breadcrumb={[{ label: 'Conciliation' }, { label: 'Dossiers' }]}
          actions={(
            <>
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => void charger(true)} disabled={actualisation}>
                <RefreshCw className={actualisation ? 'sn-spin' : ''} aria-hidden="true" />
                Actualiser
              </button>
              {peutExporter && (
                <button type="button" className="sn-btn" onClick={() => void exporter()} disabled={exportEnCours || dossiersFiltres.length === 0}>
                  {exportEnCours ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                  Exporter
                </button>
              )}
            </>
          )}
        />

        <nav className="conciliation-tabs" aria-label="États des dossiers">
          <StatusTab active={vue === 'attente'} count={groupesFiltres.attente.length} icon={Clock3} label="En attente de conciliation" tone="green" onClick={() => setVue('attente')} />
          <StatusTab active={vue === 'raffinage'} count={groupesFiltres.raffinage.length} icon={FlaskConical} label="En raffinage" tone="blue" onClick={() => setVue('raffinage')} />
          <StatusTab active={vue === 'litige'} count={groupesFiltres.litige.length} icon={AlertCircle} label="En litige" tone="red" onClick={() => setVue('litige')} />
          <StatusTab active={vue === 'concilies'} count={groupesFiltres.concilies.length} icon={CheckCircle2} label="Conciliées" tone="mint" onClick={() => setVue('concilies')} />
          <StatusTab active={vue === 'tous'} count={dossiersDansPerimetre.length} icon={FileSpreadsheet} label="Toutes les ventes" tone="slate" onClick={() => setVue('tous')} />
        </nav>

        <section className="conciliation-metrics" aria-label="Synthèse des conciliations">
          <MetricCard dossiers={groupesFiltres.attente} icon={Clock3} label="En attente de conciliation" tone="amber" />
          <MetricCard dossiers={groupesFiltres.raffinage} icon={FlaskConical} label="En raffinage" tone="blue" />
          <MetricCard dossiers={groupesFiltres.litige} icon={AlertTriangle} label="En litige" tone="red" />
          <MetricCard dossiers={conciliesCeMois} icon={CheckCircle2} label="Conciliées (ce mois)" tone="green" />
          <article className={`conciliation-gap${(resumeEcart.valeur ?? 0) < 0 ? ' is-negative' : ' is-positive'}`}>
            <p>Écart cumulé</p>
            <strong>{resumeEcart.multiDevises ? 'Plusieurs devises' : formatMontant(resumeEcart.valeur, resumeEcart.devise)}</strong>
            <span>{resumeEcart.valeur === null ? 'Valeurs non additionnées' : resumeEcart.valeur < 0 ? 'en faveur des acheteurs' : 'en faveur des vendeurs'}</span>
            {resumeEcart.serie.length > 0 && (
              <svg viewBox="0 0 180 40" role="img" aria-label="Évolution de l’écart cumulé" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="conciliation-spark-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path className="conciliation-gap__area" d={`${cheminSparkline(resumeEcart.serie)} L 180 40 L 0 40 Z`} />
                <path className="conciliation-gap__line" d={cheminSparkline(resumeEcart.serie)} />
              </svg>
            )}
          </article>
        </section>

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
        {message && <Note tone="success">{message}</Note>}

        <section className="conciliation-workspace" aria-label="Dossiers de conciliation">
          <div className="conciliation-toolbar">
            <label className="conciliation-search">
              <span className="sr-only">Rechercher une vente</span>
              <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher une vente, référence, société…" />
              <Search aria-hidden="true" />
            </label>

            <label className="conciliation-control">
              <span>Artisan / Société</span>
              <select value={societe} onChange={(event) => setSociete(event.target.value)}>
                <option value="toutes">Tous</option>
                {societes.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
              </select>
            </label>

            <label className="conciliation-control">
              <span>Acheteur</span>
              <select value={acheteur} onChange={(event) => setAcheteur(event.target.value)}>
                <option value="tous">Tous</option>
                {acheteurs.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
              </select>
            </label>

            <fieldset className="conciliation-period">
              <legend>Période de vente</legend>
              <label><span className="sr-only">Date de début</span><input type="date" value={debut} max={fin || undefined} onChange={(event) => setDebut(event.target.value)} /></label>
              <ChevronRight aria-hidden="true" />
              <label><span className="sr-only">Date de fin</span><input type="date" value={fin} min={debut || undefined} onChange={(event) => setFin(event.target.value)} /></label>
              <CalendarDays aria-hidden="true" />
            </fieldset>

            <button
              type="button"
              className={`sn-btn conciliation-filter-button${nombreFiltres > 0 ? ' is-filtered' : ''}`}
              onClick={() => setPanneauOuvert((ouvert) => !ouvert)}
              aria-expanded={panneauOuvert}
              aria-controls="conciliation-filters-panel"
            >
              <SlidersHorizontal aria-hidden="true" /> Filtres
              {nombreFiltres > 0 && <em>{nombreFiltres}</em>}
            </button>
          </div>

          {panneauOuvert && (
            <div id="conciliation-filters-panel" className="conciliation-panel">
              <div>
                <strong>Filtres et actions</strong>
                <p>La liste et l’export suivent les critères sélectionnés ci-dessus.</p>
              </div>
              <button type="button" className="sn-btn sn-btn--sm" onClick={reinitialiserFiltres}>Réinitialiser</button>
              {peutOuvrir && (
                <div className="conciliation-panel__new">
                  <label>
                    <span>Nouvelle conciliation</span>
                    <select value={venteChoisie} onChange={(event) => setVenteChoisie(event.target.value)}>
                      <option value="">Choisir une vente disponible…</option>
                      {ventes.map((vente) => (
                        <option key={vente.id} value={vente.id}>
                          {vente.sale_number} — {formatMontant(vente.gross_proceeds, vente.currency)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="sn-btn sn-btn--primary sn-btn--sm" onClick={() => void ouvrirDossier()} disabled={!venteChoisie || ouverture}>
                    {ouverture ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
                    Ouvrir le dossier
                  </button>
                </div>
              )}
              <button type="button" className="conciliation-panel__close" onClick={() => setPanneauOuvert(false)} aria-label="Fermer le panneau">
                <X aria-hidden="true" />
              </button>
            </div>
          )}

          {chargement ? (
            <div className="conciliation-grid" aria-label="Chargement des dossiers">
              {Array.from({ length: 8 }, (_, index) => <div className="conciliation-card is-skeleton" key={index} />)}
            </div>
          ) : dossiersPage.length === 0 ? (
            <div className="conciliation-empty">
              <FileText aria-hidden="true" />
              <strong>{dossiers.length === 0 ? 'Aucun dossier de conciliation' : 'Aucun dossier pour ces critères'}</strong>
              <p>{dossiers.length === 0 ? 'Les dossiers ouverts depuis les ventes apparaîtront ici.' : 'Élargissez la période ou modifiez les filtres.'}</p>
              {dossiers.length > 0 && <button type="button" className="sn-btn sn-btn--sm" onClick={reinitialiserFiltres}>Réinitialiser les filtres</button>}
            </div>
          ) : (
            <div className="conciliation-grid">
              {dossiersPage.map((dossier) => (
                <DossierCard key={dossier.id} dossier={dossier} onOpen={() => navigate(`/conciliation/${dossier.id}`)} />
              ))}
            </div>
          )}

          <footer className="conciliation-pagination">
            <p>Affichage {ENTIER.format(premier)} à {ENTIER.format(dernier)} sur {ENTIER.format(dossiersFiltres.length)} dossier{dossiersFiltres.length > 1 ? 's' : ''}</p>
            <div className="conciliation-pagination__pages">
              <button type="button" onClick={() => setPage((courante) => Math.max(1, courante - 1))} disabled={page === 1} aria-label="Page précédente"><ChevronLeft aria-hidden="true" /></button>
              <span>{page}</span>
              <button type="button" onClick={() => setPage((courante) => Math.min(nombrePages, courante + 1))} disabled={page === nombrePages} aria-label="Page suivante"><ChevronRight aria-hidden="true" /></button>
            </div>
            <label className="conciliation-pagination__size">
              <span className="sr-only">Nombre de dossiers par page</span>
              <select value={taillePage} onChange={(event) => setTaillePage(Number(event.target.value))}>
                {[8, 12, 20, 40].map((taille) => <option key={taille} value={taille}>{taille} / page</option>)}
              </select>
            </label>
          </footer>
        </section>
      </main>
    </NationalDashboardLayout>
  );
}

export default ConciliationsPage;
