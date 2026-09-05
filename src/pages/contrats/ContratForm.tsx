import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Building2, CalendarRange, CircleDollarSign, FileSignature,
  FlaskConical, Gavel, Loader2, Save, Scale, Truck,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { useMineWorkspace } from '@/hooks/useMineWorkspace';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { achatsIndustrielsService, type Societe } from '@/services/achatsIndustrielsService';
import type { TablesInsert } from '@/types/database';
import {
  contratsService,
  formaterQuantite,
  LIBELLES_METHODE_PRIX,
  LIBELLES_PARTENAIRE,
  LIBELLES_PERIODICITE,
  LIBELLES_TYPE_CONTRAT,
  type Contrat,
  type MethodePrix,
  type PartenaireType,
  type Periodicite,
  type TypeContrat,
} from '@/services/contratsService';
import '@/pages/artisanal-sites/artisanal-site-form.css';
import './contrat-form.css';

/**
 * Établissement d'un contrat de fourniture d'or.
 *
 * ══ CE QUE CET ÉCRAN GARANTIT ══
 *
 * 1. Le formulaire s'adapte au partenaire. Un orpailleur ne reçoit pas le
 *    formulaire d'une mine industrielle : les sections de laboratoire et de
 *    contre-expertise ne s'ouvrent que là où elles ont un sens.
 * 2. Rien n'est calculé puis enregistré depuis ici. Le numéro du contrat se
 *    compose en base, l'échéancier aussi.
 * 3. Le brouillon s'enregistre à tout moment. Un contrat se prépare en
 *    plusieurs fois, et perdre une heure de saisie sur une validation
 *    incomplète serait absurde.
 * 4. Les contrôles qui engagent — approbation, activation — sont en base. Cet
 *    écran ne fait que les annoncer.
 */

const SECTIONS = [
  { cle: 'general', libelle: 'Informations générales', icone: FileSignature },
  { cle: 'parties', libelle: 'Parties concernées', icone: Building2 },
  { cle: 'engagements', libelle: 'Période et engagements', icone: CalendarRange },
  { cle: 'qualite', libelle: 'Qualité et teneur', icone: FlaskConical },
  { cle: 'prix', libelle: 'Fixation du prix', icone: CircleDollarSign },
  { cle: 'livraison', libelle: 'Livraison et enlèvement', icone: Truck },
  { cle: 'financier', libelle: 'Modalités financières', icone: Scale },
  { cle: 'clauses', libelle: 'Clauses et obligations', icone: Gavel },
] as const;

type CleSection = (typeof SECTIONS)[number]['cle'];

/** Les catégories qui appellent une chaîne d'analyse formelle. */
const PARTENAIRES_INDUSTRIELS: PartenaireType[] = ['mine_industrielle', 'mine_semi_mecanisee'];

interface Saisie {
  intitule: string;
  partenaire_type: PartenaireType;
  mining_company_id: string;
  partenaire_libelle: string;
  representant_partenaire: string;
  representant_contact: string;
  type_contrat: TypeContrat;
  direction_responsable: string;
  date_signature: string;
  date_debut: string;
  date_fin: string;
  reconduction: string;
  preavis_reconduction_jours: string;
  unite: string;
  quantite_totale: string;
  quantite_minimale: string;
  quantite_maximale: string;
  periodicite: Periodicite;
  tolerance_quantite_pct: string;
  report_reliquat: string;
  plafond_depassement_pct: string;
  livraison_anticipee_autorisee: boolean;
  teneur_reference_pct: string;
  teneur_minimale_pct: string;
  teneur_tolerance_pct: string;
  methode_echantillonnage: string;
  methode_analyse: string;
  laboratoire_initial: string;
  laboratoire_independant: string;
  delai_contestation_jours: string;
  frais_contre_expertise: string;
  teneur_faisant_foi: string;
  methode_prix: MethodePrix;
  source_cours: string;
  devise_cours: string;
  prix_fixe_fcfa: string;
  prime_pct: string;
  decote_pct: string;
  formule_prix: string;
  prix_ajuste_sur_teneur: boolean;
  conditions_livraison: string;
  conditions_enlevement: string;
  modalites_pesee: string;
  transfert_propriete: string;
  conditions_paiement: string;
  delai_paiement_jours: string;
  penalites: string;
  force_majeure: string;
  reglement_differends: string;
  confidentialite: string;
  obligations_fournisseur: string;
  obligations_sonasp: string;
  observations: string;
}

const SAISIE_VIDE: Saisie = {
  intitule: '',
  partenaire_type: 'mine_industrielle',
  mining_company_id: '',
  partenaire_libelle: '',
  representant_partenaire: '',
  representant_contact: '',
  type_contrat: 'quantite_periodique',
  direction_responsable: '',
  date_signature: '',
  date_debut: '',
  date_fin: '',
  reconduction: 'aucune',
  preavis_reconduction_jours: '',
  unite: 'oz',
  quantite_totale: '',
  quantite_minimale: '',
  quantite_maximale: '',
  periodicite: 'mensuelle',
  tolerance_quantite_pct: '5',
  report_reliquat: 'autorise',
  plafond_depassement_pct: '10',
  livraison_anticipee_autorisee: true,
  teneur_reference_pct: '',
  teneur_minimale_pct: '',
  teneur_tolerance_pct: '0.5',
  methode_echantillonnage: '',
  methode_analyse: '',
  laboratoire_initial: '',
  laboratoire_independant: '',
  delai_contestation_jours: '5',
  frais_contre_expertise: 'partie_perdante',
  teneur_faisant_foi: 'analyse_sonasp',
  methode_prix: 'cours_marche',
  source_cours: '',
  devise_cours: 'USD',
  prix_fixe_fcfa: '',
  prime_pct: '0',
  decote_pct: '0',
  formule_prix: '',
  prix_ajuste_sur_teneur: true,
  conditions_livraison: '',
  conditions_enlevement: '',
  modalites_pesee: '',
  transfert_propriete: '',
  conditions_paiement: 'differe_30j',
  delai_paiement_jours: '30',
  penalites: '',
  force_majeure: '',
  reglement_differends: '',
  confidentialite: '',
  obligations_fournisseur: '',
  obligations_sonasp: '',
  observations: '',
};

const nombreOuNull = (valeur: string) => {
  const nombre = Number(valeur);
  return valeur.trim() === '' || Number.isNaN(nombre) ? null : nombre;
};

const texteOuNull = (valeur: string) => (valeur.trim() === '' ? null : valeur.trim());

const formaterDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR');
};

/** Durée du contrat en mois entamés, telle qu'elle se lit sur une fiche. */
export function dureeEnMois(debut: string, fin: string): number | null {
  if (!debut || !fin) return null;
  const d = new Date(`${debut}T00:00:00`);
  const f = new Date(`${fin}T00:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(f.getTime()) || f < d) return null;
  return (f.getFullYear() - d.getFullYear()) * 12 + (f.getMonth() - d.getMonth()) + 1;
}

/** Nombre de périodes que la périodicité découpera sur la durée du contrat. */
export function nombrePeriodes(debut: string, fin: string, periodicite: Periodicite): number | null {
  const mois = dureeEnMois(debut, fin);
  if (mois === null) return null;
  switch (periodicite) {
    case 'unique':
    case 'personnalisee':
      return 1;
    case 'hebdomadaire': {
      const jours = (new Date(`${fin}T00:00:00`).getTime()
        - new Date(`${debut}T00:00:00`).getTime()) / 86_400_000;
      return Math.max(1, Math.ceil((jours + 1) / 7));
    }
    case 'trimestrielle':
      return Math.max(1, Math.ceil(mois / 3));
    default:
      return mois;
  }
}

export function ContratForm() {
  const { id } = useParams<{ id: string }>();
  const [parametres] = useSearchParams();
  const navigate = useNavigate();
  const modeEdition = Boolean(id);
  const { isMine, companyId, companyName } = useMineWorkspace();

  /* Un avenant se rattache a son parent des l'ouverture : il en herite le
     partenaire, et ne modifie que ce qu'il declare. */
  const parentId = parametres.get('parent');
  const [parent, setParent] = useState<Contrat | null>(null);

  const [saisie, setSaisie] = useState<Saisie>(SAISIE_VIDE);
  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [section, setSection] = useState<CleSection>('general');
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const societesChargees = isMine && companyId
        ? [{ id: companyId, name: companyName || 'Votre société minière' }]
        : await achatsIndustrielsService.societesProductrices();
      setSocietes(societesChargees);

      if (isMine && companyId && !id) {
        setSaisie((actuelle) => ({
          ...actuelle,
          partenaire_type: 'mine_industrielle',
          mining_company_id: companyId,
        }));
      }

      if (parentId && !id) {
        const contratParent = await contratsService.contrat(parentId);
        if (!contratParent) throw new Error('Le contrat a amender est introuvable.');
        setParent(contratParent);
        setSaisie((actuelle) => ({
          ...actuelle,
          intitule: `Avenant au contrat ${contratParent.numero_contrat}`,
          partenaire_type: contratParent.partenaire_type,
          mining_company_id: contratParent.mining_company_id ?? '',
          partenaire_libelle: contratParent.partenaire_libelle ?? '',
          representant_partenaire: contratParent.representant_partenaire ?? '',
          type_contrat: 'avenant',
          date_debut: contratParent.date_debut,
          date_fin: contratParent.date_fin,
          unite: contratParent.unite,
          periodicite: contratParent.periodicite,
          methode_prix: contratParent.methode_prix,
          devise_cours: contratParent.devise_cours,
          conditions_paiement: contratParent.conditions_paiement,
          delai_paiement_jours: contratParent.delai_paiement_jours?.toString() ?? '30',
          teneur_reference_pct: contratParent.teneur_reference_pct?.toString() ?? '',
          teneur_minimale_pct: contratParent.teneur_minimale_pct?.toString() ?? '',
          teneur_tolerance_pct: contratParent.teneur_tolerance_pct?.toString() ?? '0.5',
        }));
      }

      if (id) {
        const existant = await contratsService.contrat(id);
        if (!existant) throw new Error('Ce contrat n’existe pas ou a été supprimé.');
        setContrat(existant);
        setSaisie({
          ...SAISIE_VIDE,
          intitule: existant.intitule ?? '',
          partenaire_type: existant.partenaire_type,
          mining_company_id: existant.mining_company_id ?? '',
          partenaire_libelle: existant.partenaire_libelle ?? '',
          representant_partenaire: existant.representant_partenaire ?? '',
          representant_contact: existant.representant_contact ?? '',
          type_contrat: existant.type_contrat,
          direction_responsable: existant.direction_responsable ?? '',
          date_signature: existant.date_signature ?? '',
          date_debut: existant.date_debut ?? '',
          date_fin: existant.date_fin ?? '',
          reconduction: existant.reconduction ?? 'aucune',
          preavis_reconduction_jours: existant.preavis_reconduction_jours?.toString() ?? '',
          unite: existant.unite ?? 'oz',
          quantite_totale: existant.quantite_totale?.toString() ?? '',
          quantite_minimale: existant.quantite_minimale?.toString() ?? '',
          quantite_maximale: existant.quantite_maximale?.toString() ?? '',
          periodicite: existant.periodicite,
          tolerance_quantite_pct: existant.tolerance_quantite_pct?.toString() ?? '0',
          report_reliquat: existant.report_reliquat ?? 'autorise',
          plafond_depassement_pct: existant.plafond_depassement_pct?.toString() ?? '0',
          livraison_anticipee_autorisee: existant.livraison_anticipee_autorisee ?? true,
          teneur_reference_pct: existant.teneur_reference_pct?.toString() ?? '',
          teneur_minimale_pct: existant.teneur_minimale_pct?.toString() ?? '',
          teneur_tolerance_pct: existant.teneur_tolerance_pct?.toString() ?? '0.5',
          methode_echantillonnage: existant.methode_echantillonnage ?? '',
          methode_analyse: existant.methode_analyse ?? '',
          laboratoire_initial: existant.laboratoire_initial ?? '',
          laboratoire_independant: existant.laboratoire_independant ?? '',
          delai_contestation_jours: existant.delai_contestation_jours?.toString() ?? '5',
          frais_contre_expertise: existant.frais_contre_expertise ?? 'partie_perdante',
          teneur_faisant_foi: existant.teneur_faisant_foi ?? 'analyse_sonasp',
          methode_prix: existant.methode_prix,
          source_cours: existant.source_cours ?? '',
          devise_cours: existant.devise_cours ?? 'USD',
          prix_fixe_fcfa: existant.prix_fixe_fcfa?.toString() ?? '',
          prime_pct: existant.prime_pct?.toString() ?? '0',
          decote_pct: existant.decote_pct?.toString() ?? '0',
          formule_prix: existant.formule_prix ?? '',
          prix_ajuste_sur_teneur: existant.prix_ajuste_sur_teneur ?? true,
          conditions_livraison: existant.conditions_livraison ?? '',
          conditions_enlevement: existant.conditions_enlevement ?? '',
          modalites_pesee: existant.modalites_pesee ?? '',
          transfert_propriete: existant.transfert_propriete ?? '',
          conditions_paiement: existant.conditions_paiement ?? 'differe_30j',
          delai_paiement_jours: existant.delai_paiement_jours?.toString() ?? '30',
          penalites: existant.penalites ?? '',
          force_majeure: existant.force_majeure ?? '',
          reglement_differends: existant.reglement_differends ?? '',
          confidentialite: existant.confidentialite ?? '',
          obligations_fournisseur: existant.obligations_fournisseur ?? '',
          obligations_sonasp: existant.obligations_sonasp ?? '',
          observations: existant.observations ?? '',
        });
      }
    } catch (raison) {
      setErreur(messageErreurUtilisateur(raison, 'Impossible de charger ce contrat.'));
    } finally {
      setChargement(false);
    }
  }, [companyId, companyName, id, isMine, parentId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const modifiable = isMine
    ? !contrat
    : !contrat || ['brouillon', 'rejete'].includes(contrat.statut);
  const industriel = PARTENAIRES_INDUSTRIELS.includes(saisie.partenaire_type);
  const societeChoisie = societes.find((societe) => societe.id === saisie.mining_company_id);

  const periodes = nombrePeriodes(saisie.date_debut, saisie.date_fin, saisie.periodicite);
  const quantiteTotale = Number(saisie.quantite_totale) || 0;
  const quantiteParPeriode = periodes && periodes > 0 ? quantiteTotale / periodes : null;

  const modifier = <C extends keyof Saisie>(champ: C, valeur: Saisie[C]) =>
    setSaisie((actuelle) => ({ ...actuelle, [champ]: valeur }));

  /** Ce qui manque pour que le contrat puisse être soumis. */
  const manques = useMemo(() => {
    const liste: string[] = [];
    if (!saisie.intitule.trim()) liste.push('l’intitulé du contrat');
    if (industriel && !saisie.mining_company_id) liste.push('la société minière');
    if (!industriel && !saisie.partenaire_libelle.trim()) liste.push('le nom du partenaire');
    if (!saisie.date_debut) liste.push('la date de début');
    if (!saisie.date_fin) liste.push('la date de fin');
    if (saisie.date_debut && saisie.date_fin && saisie.date_fin < saisie.date_debut) {
      liste.push('une date de fin postérieure au début');
    }
    if (!(quantiteTotale > 0)) liste.push('la quantité totale engagée');
    if (saisie.methode_prix === 'fixe' && !(Number(saisie.prix_fixe_fcfa) > 0)) {
      liste.push('le prix fixe contractuel');
    }
    if (saisie.methode_prix === 'formule' && !saisie.formule_prix.trim()) {
      liste.push('la formule de calcul du prix');
    }
    return liste;
  }, [saisie, industriel, quantiteTotale]);

  const construireCharge = (): TablesInsert<'snp_contrats'> => ({
    // Le déclencheur serveur remplace cette valeur vide par le numéro
    // séquentiel autoritatif lors de l'insertion.
    numero_contrat: '',
    intitule: saisie.intitule.trim(),
    partenaire_type: saisie.partenaire_type,
    mining_company_id: industriel ? saisie.mining_company_id || null : null,
    site_id: null,
    artisan_id: null,
    partenaire_libelle: texteOuNull(saisie.partenaire_libelle),
    representant_partenaire: texteOuNull(saisie.representant_partenaire),
    representant_contact: texteOuNull(saisie.representant_contact),
    type_contrat: saisie.type_contrat,
    contrat_parent_id: parent?.id ?? null,
    direction_responsable: texteOuNull(saisie.direction_responsable),
    date_signature: saisie.date_signature || null,
    date_debut: saisie.date_debut,
    date_fin: saisie.date_fin,
    reconduction: saisie.reconduction,
    preavis_reconduction_jours: nombreOuNull(saisie.preavis_reconduction_jours),
    unite: saisie.unite,
    quantite_totale: nombreOuNull(saisie.quantite_totale),
    quantite_minimale: nombreOuNull(saisie.quantite_minimale),
    quantite_maximale: nombreOuNull(saisie.quantite_maximale),
    periodicite: saisie.periodicite,
    tolerance_quantite_pct: Number(saisie.tolerance_quantite_pct) || 0,
    report_reliquat: saisie.report_reliquat,
    plafond_depassement_pct: Number(saisie.plafond_depassement_pct) || 0,
    livraison_anticipee_autorisee: saisie.livraison_anticipee_autorisee,
    teneur_reference_pct: nombreOuNull(saisie.teneur_reference_pct),
    teneur_minimale_pct: nombreOuNull(saisie.teneur_minimale_pct),
    teneur_tolerance_pct: Number(saisie.teneur_tolerance_pct) || 0,
    methode_echantillonnage: texteOuNull(saisie.methode_echantillonnage),
    methode_analyse: texteOuNull(saisie.methode_analyse),
    laboratoire_initial: texteOuNull(saisie.laboratoire_initial),
    laboratoire_independant: texteOuNull(saisie.laboratoire_independant),
    delai_contestation_jours: Number(saisie.delai_contestation_jours) || 5,
    frais_contre_expertise: saisie.frais_contre_expertise,
    teneur_faisant_foi: saisie.teneur_faisant_foi,
    methode_prix: saisie.methode_prix,
    source_cours: texteOuNull(saisie.source_cours),
    devise_cours: saisie.devise_cours,
    prix_fixe_fcfa: nombreOuNull(saisie.prix_fixe_fcfa),
    prime_pct: Number(saisie.prime_pct) || 0,
    decote_pct: Number(saisie.decote_pct) || 0,
    formule_prix: texteOuNull(saisie.formule_prix),
    prix_ajuste_sur_teneur: saisie.prix_ajuste_sur_teneur,
    conditions_livraison: texteOuNull(saisie.conditions_livraison),
    conditions_enlevement: texteOuNull(saisie.conditions_enlevement),
    modalites_pesee: texteOuNull(saisie.modalites_pesee),
    transfert_propriete: texteOuNull(saisie.transfert_propriete),
    conditions_paiement: saisie.conditions_paiement,
    delai_paiement_jours: Number(saisie.delai_paiement_jours) || 30,
    penalites: texteOuNull(saisie.penalites),
    force_majeure: texteOuNull(saisie.force_majeure),
    reglement_differends: texteOuNull(saisie.reglement_differends),
    confidentialite: texteOuNull(saisie.confidentialite),
    obligations_fournisseur: texteOuNull(saisie.obligations_fournisseur),
    obligations_sonasp: texteOuNull(saisie.obligations_sonasp),
    observations: texteOuNull(saisie.observations),
  });

  const enregistrer = async (puisOuvrir: boolean) => {
    if (!saisie.intitule.trim()) {
      setErreur('L’intitulé du contrat est nécessaire, même pour un brouillon.');
      setSection('general');
      return;
    }
    if (!saisie.date_debut || !saisie.date_fin) {
      setErreur('Les dates de début et de fin sont nécessaires, même pour un brouillon.');
      setSection('engagements');
      return;
    }

    setEnregistrement(true);
    setErreur(null);
    setMessage(null);
    try {
      const charge = construireCharge();
      if (isMine && id) throw new Error('Une proposition déjà transmise ne peut plus être modifiée.');
      const enregistre = isMine
        ? await contratsService.proposerMine({
            ...charge,
            partenaire_type: 'mine_industrielle',
            mining_company_id: companyId,
            date_signature: null,
          })
        : id
          ? await contratsService.modifier(id, charge)
          : await contratsService.creer(charge);
      setContrat(enregistre);
      if (puisOuvrir) {
        navigate(`/contrats/${enregistre.id}`);
      } else {
        setMessage(isMine
          ? `Proposition ${enregistre.numero_contrat} transmise à la SONASP.`
          : `Contrat ${enregistre.numero_contrat} enregistré en brouillon.`);
        if (!id) navigate(`/contrats/${enregistre.id}/modifier`, { replace: true });
      }
    } catch (raison) {
      setErreur(messageErreurUtilisateur(raison, 'Le contrat n’a pas pu être enregistré.'));
    } finally {
      setEnregistrement(false);
    }
  };

  if (chargement) {
    return (
      <NationalDashboardLayout>
        <div className="site-form contrat-form">
          <div className="site-form__loading">
            <Loader2 aria-hidden="true" /> Chargement du contrat…
          </div>
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="site-form contrat-form">
        <header className="site-form__intro">
          <span className="site-form__intro-icon"><FileSignature aria-hidden="true" /></span>
          <div>
            <h2>
              {modeEdition ? 'Modifier le contrat'
                : parent ? `Avenant au contrat ${parent.numero_contrat}`
                  : isMine ? 'Proposer un contrat de fourniture'
                    : 'Établir un contrat de fourniture'}
            </h2>
            <p className="site-form__subtitle">
              {parent
                ? 'L’avenant hérite du partenaire et ne modifie que ce qu’il déclare.'
                : isMine
                  ? 'Votre proposition sera transmise à la SONASP pour instruction.'
                  : 'Engagement de livraison d’or entre la SONASP et son fournisseur.'}
            </p>
          </div>

          <div className="site-form__meta">
            <div className="site-form__meta-tile is-code">
              <p>Référence</p>
              <output>{contrat?.numero_contrat ?? 'Attribuée à l’enregistrement'}</output>
            </div>
            <div className="site-form__meta-tile">
              <p>Quantité engagée</p>
              <output>
                {quantiteTotale > 0 ? formaterQuantite(quantiteTotale, saisie.unite) : '—'}
              </output>
              {quantiteParPeriode !== null && quantiteTotale > 0 && (
                <small>
                  {formaterQuantite(quantiteParPeriode, saisie.unite)} par période, sur{' '}
                  {periodes} période(s)
                </small>
              )}
            </div>
          </div>
        </header>

        <nav className="contrat-form__sections" aria-label="Sections du contrat">
          {SECTIONS.map((element, index) => {
            const Icone = element.icone;
            return (
              <button
                key={element.cle}
                type="button"
                className={element.cle === section ? 'est-courante' : ''}
                onClick={() => setSection(element.cle)}
                aria-current={element.cle === section ? 'step' : undefined}
              >
                <b>{index + 1}</b>
                <Icone aria-hidden="true" />
                {element.libelle}
              </button>
            );
          })}
        </nav>

        {erreur && <div className="site-form__error" role="alert">{erreur}</div>}
        {message && !erreur && <div className="contrat-form__message">{message}</div>}

        {!modifiable && (
          <div className="contrat-form__fige" role="status">
            Ce contrat n’est plus au stade du brouillon : ses termes ne se modifient plus depuis
            cet écran. Un changement de fond passe par un avenant.
          </div>
        )}

        <div className="site-form__layout">
          <div className="site-form__main">
            {/* ------------------------------------ Informations générales -- */}
            {section === 'general' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-emerald">
                  <span className="site-form__section-icon"><FileSignature aria-hidden="true" /></span>
                  <div>
                    <h3>Informations générales</h3>
                    <p>Objet du contrat, sa nature et la direction qui en répond.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="intitule">
                        Intitulé du contrat <i>*</i>
                      </label>
                      <input
                        id="intitule" value={saisie.intitule} disabled={!modifiable}
                        onChange={(evenement) => modifier('intitule', evenement.target.value)}
                        placeholder="Fourniture d’or doré, campagne 2026"
                      />
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="type-contrat">
                        Nature du contrat
                      </label>
                      <select
                        id="type-contrat" value={saisie.type_contrat} disabled={!modifiable}
                        onChange={(evenement) =>
                          modifier('type_contrat', evenement.target.value as TypeContrat)}
                      >
                        {(Object.keys(LIBELLES_TYPE_CONTRAT) as TypeContrat[])
                          .filter((type) => type !== 'avenant')
                          .map((type) => (
                            <option key={type} value={type}>{LIBELLES_TYPE_CONTRAT[type]}</option>
                          ))}
                      </select>
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="direction">
                        Direction responsable
                      </label>
                      <input
                        id="direction" value={saisie.direction_responsable} disabled={!modifiable}
                        onChange={(evenement) => modifier('direction_responsable', evenement.target.value)}
                        placeholder="Direction des achats"
                      />
                    </div>

                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="observations">
                        {isMine ? 'Commentaire à la SONASP' : 'Observations internes'}
                      </label>
                      <textarea
                        id="observations" rows={3} value={saisie.observations} disabled={!modifiable}
                        onChange={(evenement) => modifier('observations', evenement.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ------------------------------------------ Parties concernées */}
            {section === 'parties' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-blue">
                  <span className="site-form__section-icon"><Building2 aria-hidden="true" /></span>
                  <div>
                    <h3>Parties concernées</h3>
                    <p>Le fournisseur engagé et son représentant.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    {!isMine && <div className="site-form__field">
                      <label className="site-form__label" htmlFor="categorie">
                        Catégorie de partenaire <i>*</i>
                      </label>
                      <select
                        id="categorie" value={saisie.partenaire_type} disabled={!modifiable}
                        onChange={(evenement) =>
                          modifier('partenaire_type', evenement.target.value as PartenaireType)}
                      >
                        {(Object.keys(LIBELLES_PARTENAIRE) as PartenaireType[]).map((type) => (
                          <option key={type} value={type}>{LIBELLES_PARTENAIRE[type]}</option>
                        ))}
                      </select>
                    </div>}

                    {industriel ? (
                      <div className="site-form__field">
                        <label className="site-form__label" htmlFor="societe">
                          Société minière <i>*</i>
                        </label>
                        {isMine ? (
                          <input id="societe" value={companyName || 'Votre société minière'} readOnly />
                        ) : (
                          <select
                            id="societe" value={saisie.mining_company_id} disabled={!modifiable}
                            onChange={(evenement) => modifier('mining_company_id', evenement.target.value)}
                          >
                            <option value="">Choisir une société</option>
                            {societes.map((societe) => (
                              <option key={societe.id} value={societe.id}>
                                {societe.name}{societe.code ? ` (${societe.code})` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      <div className="site-form__field">
                        <label className="site-form__label" htmlFor="partenaire">
                          Nom du partenaire <i>*</i>
                        </label>
                        <input
                          id="partenaire" value={saisie.partenaire_libelle} disabled={!modifiable}
                          onChange={(evenement) => modifier('partenaire_libelle', evenement.target.value)}
                          placeholder="Comptoir de Poura"
                        />
                      </div>
                    )}

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="representant">
                        Représentant du fournisseur
                      </label>
                      <input
                        id="representant" value={saisie.representant_partenaire} disabled={!modifiable}
                        onChange={(evenement) => modifier('representant_partenaire', evenement.target.value)}
                      />
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="contact">
                        Coordonnées du représentant
                      </label>
                      <input
                        id="contact" value={saisie.representant_contact} disabled={!modifiable}
                        onChange={(evenement) => modifier('representant_contact', evenement.target.value)}
                        placeholder="Téléphone ou courriel"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ------------------------------------ Période et engagements -- */}
            {section === 'engagements' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-amber">
                  <span className="site-form__section-icon"><CalendarRange aria-hidden="true" /></span>
                  <div>
                    <h3>Période et engagements</h3>
                    <p>Ce que le fournisseur s’engage à livrer, et sur quelle durée.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="debut">
                        Début d’exécution <i>*</i>
                      </label>
                      <input
                        id="debut" type="date" value={saisie.date_debut} disabled={!modifiable}
                        onChange={(evenement) => modifier('date_debut', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="fin">Fin <i>*</i></label>
                      <input
                        id="fin" type="date" value={saisie.date_fin} disabled={!modifiable}
                        onChange={(evenement) => modifier('date_fin', evenement.target.value)}
                      />
                      {dureeEnMois(saisie.date_debut, saisie.date_fin) !== null && (
                        <small>{dureeEnMois(saisie.date_debut, saisie.date_fin)} mois</small>
                      )}
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="signature">
                        Date de signature
                      </label>
                      <input
                        id="signature" type="date" value={saisie.date_signature} disabled={!modifiable}
                        onChange={(evenement) => modifier('date_signature', evenement.target.value)}
                      />
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="quantite">
                        Quantité totale engagée <i>*</i>
                      </label>
                      <input
                        id="quantite" type="number" min={0} step={0.0001}
                        value={saisie.quantite_totale} disabled={!modifiable}
                        onChange={(evenement) => modifier('quantite_totale', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="unite">Unité</label>
                      <select
                        id="unite" value={saisie.unite} disabled={!modifiable}
                        onChange={(evenement) => modifier('unite', evenement.target.value)}
                      >
                        <option value="oz">Onces d’or fin (oz)</option>
                        <option value="g">Grammes (g)</option>
                        <option value="kg">Kilogrammes (kg)</option>
                      </select>
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="periodicite">
                        Périodicité de livraison
                      </label>
                      <select
                        id="periodicite" value={saisie.periodicite} disabled={!modifiable}
                        onChange={(evenement) =>
                          modifier('periodicite', evenement.target.value as Periodicite)}
                      >
                        {(Object.keys(LIBELLES_PERIODICITE) as Periodicite[]).map((valeur) => (
                          <option key={valeur} value={valeur}>{LIBELLES_PERIODICITE[valeur]}</option>
                        ))}
                      </select>
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="minimale">
                        Quantité minimale garantie
                      </label>
                      <input
                        id="minimale" type="number" min={0} step={0.0001}
                        value={saisie.quantite_minimale} disabled={!modifiable}
                        onChange={(evenement) => modifier('quantite_minimale', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="maximale">
                        Quantité maximale
                      </label>
                      <input
                        id="maximale" type="number" min={0} step={0.0001}
                        value={saisie.quantite_maximale} disabled={!modifiable}
                        onChange={(evenement) => modifier('quantite_maximale', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="tolerance">
                        Tolérance sur les quantités (%)
                      </label>
                      <input
                        id="tolerance" type="number" min={0} max={100} step={0.1}
                        value={saisie.tolerance_quantite_pct} disabled={!modifiable}
                        onChange={(evenement) => modifier('tolerance_quantite_pct', evenement.target.value)}
                      />
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="report">
                        Report des reliquats
                      </label>
                      <select
                        id="report" value={saisie.report_reliquat} disabled={!modifiable}
                        onChange={(evenement) => modifier('report_reliquat', evenement.target.value)}
                      >
                        <option value="autorise">Autorisé</option>
                        <option value="sur_accord">Sur accord des parties</option>
                        <option value="interdit">Interdit</option>
                      </select>
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="plafond">
                        Plafond de dépassement (%)
                      </label>
                      <input
                        id="plafond" type="number" min={0} max={100} step={0.1}
                        value={saisie.plafond_depassement_pct} disabled={!modifiable}
                        onChange={(evenement) => modifier('plafond_depassement_pct', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="reconduction">
                        Reconduction
                      </label>
                      <select
                        id="reconduction" value={saisie.reconduction} disabled={!modifiable}
                        onChange={(evenement) => modifier('reconduction', evenement.target.value)}
                      >
                        <option value="aucune">Aucune</option>
                        <option value="tacite">Tacite</option>
                        <option value="expresse">Expresse</option>
                      </select>
                    </div>

                    {saisie.reconduction !== 'aucune' && (
                      <div className="site-form__field">
                        <label className="site-form__label" htmlFor="preavis">
                          Préavis de non-reconduction (jours)
                        </label>
                        <input
                          id="preavis" type="number" min={0} step={1}
                          value={saisie.preavis_reconduction_jours} disabled={!modifiable}
                          onChange={(evenement) =>
                            modifier('preavis_reconduction_jours', evenement.target.value)}
                        />
                      </div>
                    )}

                    <div className="site-form__field is-wide">
                      <label className="contrat-form__bascule">
                        <input
                          type="checkbox" checked={saisie.livraison_anticipee_autorisee}
                          disabled={!modifiable}
                          onChange={(evenement) =>
                            modifier('livraison_anticipee_autorisee', evenement.target.checked)}
                        />
                        <span>Les livraisons anticipées sont acceptées</span>
                      </label>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ---------------------------------------- Qualité et teneur -- */}
            {section === 'qualite' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-blue">
                  <span className="site-form__section-icon"><FlaskConical aria-hidden="true" /></span>
                  <div>
                    <h3>Qualité et teneur</h3>
                    <p>La teneur attendue, l’écart admis et qui tranche au-delà.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="teneur-ref">
                        Teneur de référence (%)
                      </label>
                      <input
                        id="teneur-ref" type="number" min={0} max={100} step={0.001}
                        value={saisie.teneur_reference_pct} disabled={!modifiable}
                        onChange={(evenement) => modifier('teneur_reference_pct', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="teneur-min">
                        Teneur minimale acceptable (%)
                      </label>
                      <input
                        id="teneur-min" type="number" min={0} max={100} step={0.001}
                        value={saisie.teneur_minimale_pct} disabled={!modifiable}
                        onChange={(evenement) => modifier('teneur_minimale_pct', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="teneur-tol">
                        Tolérance admise (points)
                      </label>
                      <input
                        id="teneur-tol" type="number" min={0} max={100} step={0.001}
                        value={saisie.teneur_tolerance_pct} disabled={!modifiable}
                        onChange={(evenement) => modifier('teneur_tolerance_pct', evenement.target.value)}
                      />
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="foi">
                        Résultat faisant foi
                      </label>
                      <select
                        id="foi" value={saisie.teneur_faisant_foi} disabled={!modifiable}
                        onChange={(evenement) => modifier('teneur_faisant_foi', evenement.target.value)}
                      >
                        <option value="analyse_sonasp">Analyse de la SONASP</option>
                        <option value="analyse_fournisseur">Analyse du fournisseur</option>
                        <option value="laboratoire_independant">Laboratoire indépendant</option>
                        <option value="moyenne">Moyenne des deux analyses</option>
                      </select>
                    </div>

                    {industriel && (
                      <>
                        <div className="site-form__field">
                          <label className="site-form__label" htmlFor="echantillonnage">
                            Méthode d’échantillonnage
                          </label>
                          <input
                            id="echantillonnage" value={saisie.methode_echantillonnage}
                            disabled={!modifiable}
                            onChange={(evenement) =>
                              modifier('methode_echantillonnage', evenement.target.value)}
                          />
                        </div>
                        <div className="site-form__field">
                          <label className="site-form__label" htmlFor="analyse">
                            Méthode d’analyse
                          </label>
                          <input
                            id="analyse" value={saisie.methode_analyse} disabled={!modifiable}
                            onChange={(evenement) => modifier('methode_analyse', evenement.target.value)}
                            placeholder="Coupellation, fluorescence X…"
                          />
                        </div>
                        <div className="site-form__field">
                          <label className="site-form__label" htmlFor="labo">
                            Laboratoire de première analyse
                          </label>
                          <input
                            id="labo" value={saisie.laboratoire_initial} disabled={!modifiable}
                            onChange={(evenement) => modifier('laboratoire_initial', evenement.target.value)}
                          />
                        </div>
                        <div className="site-form__field">
                          <label className="site-form__label" htmlFor="labo-ind">
                            Laboratoire indépendant
                          </label>
                          <input
                            id="labo-ind" value={saisie.laboratoire_independant} disabled={!modifiable}
                            onChange={(evenement) =>
                              modifier('laboratoire_independant', evenement.target.value)}
                          />
                        </div>
                        <div className="site-form__field">
                          <label className="site-form__label" htmlFor="delai">
                            Délai de contestation (jours)
                          </label>
                          <input
                            id="delai" type="number" min={0} step={1}
                            value={saisie.delai_contestation_jours} disabled={!modifiable}
                            onChange={(evenement) =>
                              modifier('delai_contestation_jours', evenement.target.value)}
                          />
                        </div>
                        <div className="site-form__field">
                          <label className="site-form__label" htmlFor="frais">
                            Frais de contre-expertise
                          </label>
                          <select
                            id="frais" value={saisie.frais_contre_expertise} disabled={!modifiable}
                            onChange={(evenement) =>
                              modifier('frais_contre_expertise', evenement.target.value)}
                          >
                            <option value="partie_perdante">À la charge de la partie perdante</option>
                            <option value="sonasp">À la charge de la SONASP</option>
                            <option value="fournisseur">À la charge du fournisseur</option>
                            <option value="partage">Partagés</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* -------------------------------------- Fixation du prix ----- */}
            {section === 'prix' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-amber">
                  <span className="site-form__section-icon"><CircleDollarSign aria-hidden="true" /></span>
                  <div>
                    <h3>Fixation du prix</h3>
                    <p>Comment le prix de l’once se détermine à chaque livraison.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="methode-prix">
                        Méthode de fixation
                      </label>
                      <select
                        id="methode-prix" value={saisie.methode_prix} disabled={!modifiable}
                        onChange={(evenement) =>
                          modifier('methode_prix', evenement.target.value as MethodePrix)}
                      >
                        {(Object.keys(LIBELLES_METHODE_PRIX) as MethodePrix[]).map((methode) => (
                          <option key={methode} value={methode}>{LIBELLES_METHODE_PRIX[methode]}</option>
                        ))}
                      </select>
                    </div>

                    {saisie.methode_prix === 'fixe' && (
                      <div className="site-form__field">
                        <label className="site-form__label" htmlFor="prix-fixe">
                          Prix de l’once, en FCFA <i>*</i>
                        </label>
                        <input
                          id="prix-fixe" type="number" min={0} step={1000}
                          value={saisie.prix_fixe_fcfa} disabled={!modifiable}
                          onChange={(evenement) => modifier('prix_fixe_fcfa', evenement.target.value)}
                        />
                      </div>
                    )}

                    {saisie.methode_prix === 'formule' && (
                      <div className="site-form__field is-wide">
                        <label className="site-form__label" htmlFor="formule">
                          Formule contractuelle <i>*</i>
                        </label>
                        <textarea
                          id="formule" rows={3} value={saisie.formule_prix} disabled={!modifiable}
                          onChange={(evenement) => modifier('formule_prix', evenement.target.value)}
                          placeholder="Cours LBMA du jour × taux BCEAO × (1 + prime) − décote"
                        />
                      </div>
                    )}

                    {saisie.methode_prix !== 'fixe' && (
                      <>
                        <div className="site-form__field">
                          <label className="site-form__label" htmlFor="source">
                            Source officielle du cours
                          </label>
                          <input
                            id="source" value={saisie.source_cours} disabled={!modifiable}
                            onChange={(evenement) => modifier('source_cours', evenement.target.value)}
                            placeholder="LBMA, fixing de Londres"
                          />
                        </div>
                        <div className="site-form__field">
                          <label className="site-form__label" htmlFor="devise-cours">
                            Devise du cours
                          </label>
                          <select
                            id="devise-cours" value={saisie.devise_cours} disabled={!modifiable}
                            onChange={(evenement) => modifier('devise_cours', evenement.target.value)}
                          >
                            <option value="USD">Dollar américain (USD)</option>
                            <option value="EUR">Euro (EUR)</option>
                            <option value="XOF">Franc CFA (XOF)</option>
                          </select>
                        </div>
                      </>
                    )}

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="prime">Prime (%)</label>
                      <input
                        id="prime" type="number" step={0.0001}
                        value={saisie.prime_pct} disabled={!modifiable}
                        onChange={(evenement) => modifier('prime_pct', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="decote">Décote (%)</label>
                      <input
                        id="decote" type="number" step={0.0001}
                        value={saisie.decote_pct} disabled={!modifiable}
                        onChange={(evenement) => modifier('decote_pct', evenement.target.value)}
                      />
                    </div>

                    <div className="site-form__field is-wide">
                      <label className="contrat-form__bascule">
                        <input
                          type="checkbox" checked={saisie.prix_ajuste_sur_teneur}
                          disabled={!modifiable}
                          onChange={(evenement) =>
                            modifier('prix_ajuste_sur_teneur', evenement.target.checked)}
                        />
                        <span>Le prix se recalcule sur la teneur finalement retenue</span>
                      </label>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ------------------------------------ Livraison et enlèvement - */}
            {section === 'livraison' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-slate">
                  <span className="site-form__section-icon"><Truck aria-hidden="true" /></span>
                  <div>
                    <h3>Livraison et enlèvement</h3>
                    <p>Où, comment et à quel moment l’or change de mains.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="cond-livraison">
                        Conditions de livraison
                      </label>
                      <textarea
                        id="cond-livraison" rows={3} value={saisie.conditions_livraison}
                        disabled={!modifiable}
                        onChange={(evenement) => modifier('conditions_livraison', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="cond-enlevement">
                        Conditions d’enlèvement
                      </label>
                      <textarea
                        id="cond-enlevement" rows={3} value={saisie.conditions_enlevement}
                        disabled={!modifiable}
                        onChange={(evenement) => modifier('conditions_enlevement', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="pesee">
                        Modalités de pesée
                      </label>
                      <textarea
                        id="pesee" rows={2} value={saisie.modalites_pesee} disabled={!modifiable}
                        onChange={(evenement) => modifier('modalites_pesee', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="propriete">
                        Transfert de propriété
                      </label>
                      <textarea
                        id="propriete" rows={2} value={saisie.transfert_propriete} disabled={!modifiable}
                        onChange={(evenement) => modifier('transfert_propriete', evenement.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* -------------------------------------- Modalités financières - */}
            {section === 'financier' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-emerald">
                  <span className="site-form__section-icon"><Scale aria-hidden="true" /></span>
                  <div>
                    <h3>Modalités financières</h3>
                    <p>Délais de règlement et pénalités convenues.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="cond-paiement">
                        Conditions de paiement
                      </label>
                      <select
                        id="cond-paiement" value={saisie.conditions_paiement} disabled={!modifiable}
                        onChange={(evenement) => modifier('conditions_paiement', evenement.target.value)}
                      >
                        <option value="comptant">Comptant</option>
                        <option value="differe_30j">Différé 30 jours</option>
                        <option value="differe_60j">Différé 60 jours</option>
                        <option value="differe_90j">Différé 90 jours</option>
                        <option value="echelonne">Échelonné</option>
                      </select>
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="delai-paiement">
                        Délai de paiement (jours)
                      </label>
                      <input
                        id="delai-paiement" type="number" min={0} step={1}
                        value={saisie.delai_paiement_jours} disabled={!modifiable}
                        onChange={(evenement) => modifier('delai_paiement_jours', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="penalites">Pénalités</label>
                      <textarea
                        id="penalites" rows={3} value={saisie.penalites} disabled={!modifiable}
                        onChange={(evenement) => modifier('penalites', evenement.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ----------------------------------- Clauses et obligations --- */}
            {section === 'clauses' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-slate">
                  <span className="site-form__section-icon"><Gavel aria-hidden="true" /></span>
                  <div>
                    <h3>Clauses et obligations</h3>
                    <p>Engagements de chaque partie et règles de sortie.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="oblig-fournisseur">
                        Obligations du fournisseur
                      </label>
                      <textarea
                        id="oblig-fournisseur" rows={3} value={saisie.obligations_fournisseur}
                        disabled={!modifiable}
                        onChange={(evenement) =>
                          modifier('obligations_fournisseur', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="oblig-sonasp">
                        Obligations de la SONASP
                      </label>
                      <textarea
                        id="oblig-sonasp" rows={3} value={saisie.obligations_sonasp}
                        disabled={!modifiable}
                        onChange={(evenement) => modifier('obligations_sonasp', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="force-majeure">
                        Force majeure
                      </label>
                      <textarea
                        id="force-majeure" rows={2} value={saisie.force_majeure} disabled={!modifiable}
                        onChange={(evenement) => modifier('force_majeure', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="differends">
                        Règlement des différends
                      </label>
                      <textarea
                        id="differends" rows={2} value={saisie.reglement_differends}
                        disabled={!modifiable}
                        onChange={(evenement) => modifier('reglement_differends', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="confidentialite">
                        Confidentialité
                      </label>
                      <textarea
                        id="confidentialite" rows={2} value={saisie.confidentialite}
                        disabled={!modifiable}
                        onChange={(evenement) => modifier('confidentialite', evenement.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            <footer className="site-form__actions">
              <button type="button" onClick={() => navigate('/contrats')}>
                <ArrowLeft aria-hidden="true" /> Retour au registre
              </button>
              {modifiable && (
                <>
                  {!isMine && <button
                    type="button" onClick={() => void enregistrer(false)} disabled={enregistrement}
                  >
                    {enregistrement ? <Loader2 className="is-spinning" aria-hidden="true" /> : <Save aria-hidden="true" />}
                    Enregistrer le brouillon
                  </button>}
                  <button
                    type="button" className="is-primary"
                    onClick={() => void enregistrer(true)} disabled={enregistrement}
                  >
                    {isMine ? 'Transmettre à la SONASP' : 'Enregistrer et ouvrir le dossier'}
                  </button>
                </>
              )}
            </footer>
          </div>

          {/* -------------------------------------------------- Volet droit */}
          <aside className="site-form__aside" aria-label="Résumé du contrat">
            <section className="site-form__card">
              <header>
                <span className="site-form__card-icon is-emerald"><FileSignature aria-hidden="true" /></span>
                <div>
                  <h3>Résumé</h3>
                  <p>{contrat?.numero_contrat ?? 'Contrat en préparation'}</p>
                </div>
              </header>
              <ul className="contrat-form__resume">
                <li>
                  <span>Partenaire</span>
                  <b>
                    {industriel
                      ? societeChoisie?.name ?? 'Non choisie'
                      : saisie.partenaire_libelle || 'Non nommé'}
                  </b>
                </li>
                <li>
                  <span>Catégorie</span>
                  <b>{LIBELLES_PARTENAIRE[saisie.partenaire_type]}</b>
                </li>
                <li>
                  <span>Période</span>
                  <b>{formaterDate(saisie.date_debut)} au {formaterDate(saisie.date_fin)}</b>
                </li>
                <li>
                  <span>Quantité engagée</span>
                  <b>{quantiteTotale > 0 ? formaterQuantite(quantiteTotale, saisie.unite) : '—'}</b>
                </li>
                <li>
                  <span>Périodicité</span>
                  <b>{LIBELLES_PERIODICITE[saisie.periodicite]}</b>
                </li>
                <li>
                  <span>Prix</span>
                  <b>{LIBELLES_METHODE_PRIX[saisie.methode_prix]}</b>
                </li>
              </ul>
            </section>

            <section className="site-form__card">
              <header>
                <span className="site-form__card-icon is-amber"><AlertTriangle aria-hidden="true" /></span>
                <div>
                  <h3>Avant de soumettre</h3>
                  <p>{manques.length === 0 ? 'Le dossier est complet' : `${manques.length} point(s) à compléter`}</p>
                </div>
              </header>
              {manques.length === 0 ? (
                <p className="contrat-form__vide">
                  Tout ce qui conditionne la soumission est renseigné. L’échéancier se compose
                  ensuite depuis le dossier du contrat.
                </p>
              ) : (
                <ul className="contrat-form__manques">
                  {manques.map((manque) => <li key={manque}>{manque}</li>)}
                </ul>
              )}
            </section>

            {quantiteParPeriode !== null && quantiteTotale > 0 && (
              <section className="site-form__card">
                <header>
                  <span className="site-form__card-icon is-blue"><CalendarRange aria-hidden="true" /></span>
                  <div>
                    <h3>Échéancier prévisible</h3>
                    <p>{periodes} période(s)</p>
                  </div>
                </header>
                <ul className="contrat-form__resume">
                  <li>
                    <span>Par période</span>
                    <b>{formaterQuantite(quantiteParPeriode, saisie.unite)}</b>
                  </li>
                  <li>
                    <span>Tolérance</span>
                    <b>{saisie.tolerance_quantite_pct} %</b>
                  </li>
                  <li>
                    <span>Dépassement admis</span>
                    <b>{saisie.plafond_depassement_pct} %</b>
                  </li>
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}

export default ContratForm;
