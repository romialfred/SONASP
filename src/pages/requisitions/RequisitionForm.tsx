import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Building2, CircleDollarSign, Gavel, Loader2, Save, Scale, Truck,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { achatsIndustrielsService, type Societe } from '@/services/achatsIndustrielsService';
import { contratsService, formaterQuantite, type Contrat } from '@/services/contratsService';
import {
  LIBELLES_REGIME,
  LIBELLES_TYPE_REQUISITION,
  PORTEE_REGIME,
  requisitionsService,
  type RegimeJuridique,
  type Requisition,
  type TypeRequisition,
} from '@/services/requisitionsService';
import '@/pages/artisanal-sites/artisanal-site-form.css';
import '@/pages/contrats/contrat-form.css';
import './requisitions.css';

/**
 * Préparation d'une réquisition de production d'or.
 *
 * ══ PRUDENCE JURIDIQUE ══
 *
 * Le régime juridique se déclare, il ne se devine pas. L'écran en explique la
 * portée au moment du choix, parce que la suite du parcours en dépend : sous un
 * régime exécutoire, la mine accuse réception sans que son accord soit requis ;
 * sous un régime d'accord, l'absence d'accord empêche l'exécution.
 *
 * La base applique la règle indépendamment de cet écran : `snp_changer_statut_requisition`
 * refuse d'autoriser une pièce dont le régime n'est pas qualifié, et de la rendre
 * exécutoire sans l'accord que son régime exige.
 */

const SECTIONS = [
  { cle: 'objet', libelle: 'Objet et mine', icone: Building2 },
  { cle: 'fondement', libelle: 'Fondement juridique', icone: Gavel },
  { cle: 'quantites', libelle: 'Quantités et période', icone: Scale },
  { cle: 'logistique', libelle: 'Enlèvement et transport', icone: Truck },
  { cle: 'valorisation', libelle: 'Valorisation et paiement', icone: CircleDollarSign },
] as const;

type CleSection = (typeof SECTIONS)[number]['cle'];

interface Saisie {
  objet: string;
  mining_company_id: string;
  contrat_id: string;
  type_requisition: TypeRequisition;
  regime_juridique: RegimeJuridique;
  autorite_origine: string;
  nature_acte: string;
  reference_acte: string;
  date_signature_acte: string;
  date_effet: string;
  periode_debut: string;
  periode_fin: string;
  quantite_oz: string;
  pourcentage_production: string;
  produits_concernes: string;
  teneur_estimee_pct: string;
  lieu_stockage: string;
  lieu_enlevement: string;
  delai_mise_a_disposition_jours: string;
  modalites_enlevement: string;
  conditions_transport: string;
  conditions_analyse: string;
  methode_prix: string;
  prix_once_fcfa: string;
  modalites_paiement: string;
  equipe: string;
  confidentialite: string;
  observations: string;
}

const SAISIE_VIDE: Saisie = {
  objet: '',
  mining_company_id: '',
  contrat_id: '',
  type_requisition: 'partielle',
  regime_juridique: 'a_qualifier',
  autorite_origine: '',
  nature_acte: '',
  reference_acte: '',
  date_signature_acte: '',
  date_effet: '',
  periode_debut: '',
  periode_fin: '',
  quantite_oz: '',
  pourcentage_production: '',
  produits_concernes: '',
  teneur_estimee_pct: '',
  lieu_stockage: '',
  lieu_enlevement: '',
  delai_mise_a_disposition_jours: '',
  modalites_enlevement: '',
  conditions_transport: '',
  conditions_analyse: '',
  methode_prix: 'cours_marche',
  prix_once_fcfa: '',
  modalites_paiement: 'differe_30j',
  equipe: '',
  confidentialite: 'interne',
  observations: '',
};

const nombreOuNull = (valeur: string) => {
  const nombre = Number(valeur);
  return valeur.trim() === '' || Number.isNaN(nombre) ? null : nombre;
};

const texteOuNull = (valeur: string) => (valeur.trim() === '' ? null : valeur.trim());

export function RequisitionForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [saisie, setSaisie] = useState<Saisie>(SAISIE_VIDE);
  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [section, setSection] = useState<CleSection>('objet');
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [societesChargees, contratsCharges] = await Promise.all([
        achatsIndustrielsService.societesProductrices(),
        contratsService.lister({ statut: 'actif' }),
      ]);
      setSocietes(societesChargees);
      setContrats(contratsCharges);

      if (id) {
        const existante = await requisitionsService.requisition(id);
        if (!existante) throw new Error('Cette réquisition n’existe pas ou a été supprimée.');
        setRequisition(existante);
        setSaisie({
          ...SAISIE_VIDE,
          objet: existante.objet ?? '',
          mining_company_id: existante.mining_company_id ?? '',
          contrat_id: existante.contrat_id ?? '',
          type_requisition: existante.type_requisition,
          regime_juridique: existante.regime_juridique,
          autorite_origine: existante.autorite_origine ?? '',
          nature_acte: existante.nature_acte ?? '',
          reference_acte: existante.reference_acte ?? '',
          date_signature_acte: existante.date_signature_acte ?? '',
          date_effet: existante.date_effet ?? '',
          periode_debut: existante.periode_debut ?? '',
          periode_fin: existante.periode_fin ?? '',
          quantite_oz: existante.quantite_oz?.toString() ?? '',
          pourcentage_production: existante.pourcentage_production?.toString() ?? '',
          produits_concernes: existante.produits_concernes ?? '',
          teneur_estimee_pct: existante.teneur_estimee_pct?.toString() ?? '',
          lieu_stockage: existante.lieu_stockage ?? '',
          lieu_enlevement: existante.lieu_enlevement ?? '',
          delai_mise_a_disposition_jours:
            existante.delai_mise_a_disposition_jours?.toString() ?? '',
          modalites_enlevement: existante.modalites_enlevement ?? '',
          conditions_transport: existante.conditions_transport ?? '',
          conditions_analyse: existante.conditions_analyse ?? '',
          methode_prix: existante.methode_prix ?? 'cours_marche',
          prix_once_fcfa: existante.prix_once_fcfa?.toString() ?? '',
          modalites_paiement: existante.modalites_paiement ?? 'differe_30j',
          equipe: existante.equipe ?? '',
          confidentialite: existante.confidentialite ?? 'interne',
          observations: existante.observations ?? '',
        });
      }
    } catch (raison) {
      setErreur(messageErreurUtilisateur(raison, 'Impossible de charger cette réquisition.'));
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const modifiable = !requisition
    || ['brouillon', 'verification_juridique'].includes(requisition.statut);

  const contratsDeLaMine = useMemo(
    () => contrats.filter((contrat) => contrat.mining_company_id === saisie.mining_company_id),
    [contrats, saisie.mining_company_id]
  );

  const modifier = <C extends keyof Saisie>(champ: C, valeur: Saisie[C]) =>
    setSaisie((actuelle) => ({ ...actuelle, [champ]: valeur }));

  /** Ce qui manque pour que la pièce puisse quitter la vérification juridique. */
  const manques = useMemo(() => {
    const liste: string[] = [];
    if (!saisie.objet.trim()) liste.push('l’objet de la réquisition');
    if (!saisie.mining_company_id) liste.push('la mine concernée');
    if (saisie.regime_juridique === 'a_qualifier') liste.push('la qualification du régime juridique');
    if (!saisie.autorite_origine.trim()) liste.push('l’autorité à l’origine de la décision');
    if (!saisie.nature_acte.trim()) liste.push('la nature de l’acte');
    if (!saisie.reference_acte.trim()) liste.push('la référence de l’acte');
    if (saisie.type_requisition === 'pourcentage') {
      const part = Number(saisie.pourcentage_production);
      if (!(part > 0 && part <= 100)) liste.push('le pourcentage de production visé');
    } else if (!(Number(saisie.quantite_oz) > 0)) {
      liste.push('la quantité visée');
    }
    return liste;
  }, [saisie]);

  const enregistrer = async (puisOuvrir: boolean) => {
    if (!saisie.objet.trim()) {
      setErreur('L’objet de la réquisition est nécessaire, même pour un brouillon.');
      setSection('objet');
      return;
    }
    if (!saisie.mining_company_id) {
      setErreur('La mine concernée est nécessaire, même pour un brouillon.');
      setSection('objet');
      return;
    }
    const parPourcentage = saisie.type_requisition === 'pourcentage';
    if (parPourcentage) {
      const part = Number(saisie.pourcentage_production);
      if (!(part > 0 && part <= 100)) {
        setErreur('Indiquez un pourcentage de production compris entre 0 et 100.');
        setSection('quantites');
        return;
      }
    } else if (!(Number(saisie.quantite_oz) > 0)) {
      setErreur('Indiquez la quantité visée, supérieure à zéro.');
      setSection('quantites');
      return;
    }

    setEnregistrement(true);
    setErreur(null);
    setMessage(null);
    try {
      const charge: Partial<Requisition> = {
        objet: saisie.objet.trim(),
        partenaire_type: 'mine_industrielle',
        mining_company_id: saisie.mining_company_id,
        contrat_id: saisie.contrat_id || null,
        type_requisition: saisie.type_requisition,
        regime_juridique: saisie.regime_juridique,
        autorite_origine: texteOuNull(saisie.autorite_origine),
        nature_acte: texteOuNull(saisie.nature_acte),
        reference_acte: texteOuNull(saisie.reference_acte),
        date_signature_acte: saisie.date_signature_acte || null,
        date_effet: saisie.date_effet || null,
        periode_debut: saisie.periode_debut || null,
        periode_fin: saisie.periode_fin || null,
        quantite_oz: parPourcentage ? null : nombreOuNull(saisie.quantite_oz),
        pourcentage_production: parPourcentage
          ? nombreOuNull(saisie.pourcentage_production)
          : null,
        produits_concernes: texteOuNull(saisie.produits_concernes),
        teneur_estimee_pct: nombreOuNull(saisie.teneur_estimee_pct),
        lieu_stockage: texteOuNull(saisie.lieu_stockage),
        lieu_enlevement: texteOuNull(saisie.lieu_enlevement),
        delai_mise_a_disposition_jours: nombreOuNull(saisie.delai_mise_a_disposition_jours),
        modalites_enlevement: texteOuNull(saisie.modalites_enlevement),
        conditions_transport: texteOuNull(saisie.conditions_transport),
        conditions_analyse: texteOuNull(saisie.conditions_analyse),
        methode_prix: saisie.methode_prix,
        prix_once_fcfa: nombreOuNull(saisie.prix_once_fcfa),
        modalites_paiement: saisie.modalites_paiement,
        equipe: texteOuNull(saisie.equipe),
        confidentialite: saisie.confidentialite,
        observations: texteOuNull(saisie.observations),
      };

      const enregistree = id
        ? await requisitionsService.modifier(id, charge)
        : await requisitionsService.creer(charge);
      setRequisition(enregistree);

      if (puisOuvrir) {
        navigate(`/requisitions/${enregistree.id}`);
      } else {
        setMessage(`Réquisition ${enregistree.reference} enregistrée en brouillon.`);
        if (!id) navigate(`/requisitions/${enregistree.id}/modifier`, { replace: true });
      }
    } catch (raison) {
      setErreur(messageErreurUtilisateur(raison, 'La réquisition n’a pas pu être enregistrée.'));
    } finally {
      setEnregistrement(false);
    }
  };

  if (chargement) {
    return (
      <NationalDashboardLayout>
        <div className="site-form contrat-form">
          <div className="site-form__loading">
            <Loader2 aria-hidden="true" /> Chargement de la réquisition…
          </div>
        </div>
      </NationalDashboardLayout>
    );
  }

  const parPourcentage = saisie.type_requisition === 'pourcentage';

  return (
    <NationalDashboardLayout>
      <div className="site-form contrat-form">
        <header className="site-form__intro">
          <span className="site-form__intro-icon"><Gavel aria-hidden="true" /></span>
          <div>
            <h2>{id ? 'Modifier la réquisition' : 'Préparer une réquisition'}</h2>
            <p className="site-form__subtitle">
              Mesure portant sur la production d’une mine, fondée sur un acte juridique habilitant.
            </p>
          </div>

          <div className="site-form__meta">
            <div className="site-form__meta-tile is-code">
              <p>Référence</p>
              <output>{requisition?.reference ?? 'Attribuée à l’enregistrement'}</output>
            </div>
            <div className="site-form__meta-tile">
              <p>Portée</p>
              <output>
                {parPourcentage
                  ? `${saisie.pourcentage_production || '—'} % de la production`
                  : formaterQuantite(Number(saisie.quantite_oz) || 0)}
              </output>
            </div>
          </div>
        </header>

        <nav className="contrat-form__sections" aria-label="Sections de la réquisition">
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
            Cette réquisition a quitté la vérification juridique : ses termes ne se modifient plus
            depuis cet écran.
          </div>
        )}

        <div className="site-form__layout">
          <div className="site-form__main">
            {/* ------------------------------------------- Objet et mine -- */}
            {section === 'objet' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-emerald">
                  <span className="site-form__section-icon"><Building2 aria-hidden="true" /></span>
                  <div>
                    <h3>Objet et mine concernée</h3>
                    <p>Ce que la réquisition vise, et auprès de qui.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="objet">
                        Objet de la réquisition <i>*</i>
                      </label>
                      <input
                        id="objet" value={saisie.objet} disabled={!modifiable}
                        onChange={(evenement) => modifier('objet', evenement.target.value)}
                        placeholder="Réquisition de la production d’août 2026"
                      />
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="mine">
                        Mine concernée <i>*</i>
                      </label>
                      <select
                        id="mine" value={saisie.mining_company_id} disabled={!modifiable}
                        onChange={(evenement) => {
                          modifier('mining_company_id', evenement.target.value);
                          modifier('contrat_id', '');
                        }}
                      >
                        <option value="">Choisir une société</option>
                        {societes.map((societe) => (
                          <option key={societe.id} value={societe.id}>
                            {societe.name}{societe.code ? ` (${societe.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="contrat">
                        Contrat actif associé
                      </label>
                      <select
                        id="contrat" value={saisie.contrat_id} disabled={!modifiable || !saisie.mining_company_id}
                        onChange={(evenement) => modifier('contrat_id', evenement.target.value)}
                      >
                        <option value="">Aucun contrat rattaché</option>
                        {contratsDeLaMine.map((contrat) => (
                          <option key={contrat.id} value={contrat.id}>
                            {contrat.numero_contrat} — {contrat.intitule}
                          </option>
                        ))}
                      </select>
                      {saisie.mining_company_id && contratsDeLaMine.length === 0 && (
                        <small>Aucun contrat actif avec cette société.</small>
                      )}
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="confidentialite">
                        Niveau de confidentialité
                      </label>
                      <select
                        id="confidentialite" value={saisie.confidentialite} disabled={!modifiable}
                        onChange={(evenement) => modifier('confidentialite', evenement.target.value)}
                      >
                        <option value="public">Public</option>
                        <option value="interne">Interne</option>
                        <option value="restreint">Restreint</option>
                        <option value="confidentiel">Confidentiel</option>
                      </select>
                    </div>

                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="observations">Observations</label>
                      <textarea
                        id="observations" rows={3} value={saisie.observations} disabled={!modifiable}
                        onChange={(evenement) => modifier('observations', evenement.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* -------------------------------------- Fondement juridique -- */}
            {section === 'fondement' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-slate">
                  <span className="site-form__section-icon"><Gavel aria-hidden="true" /></span>
                  <div>
                    <h3>Fondement juridique</h3>
                    <p>L’acte qui habilite la mesure, et ce qu’il permet.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="regime">
                        Régime applicable <i>*</i>
                      </label>
                      <select
                        id="regime" value={saisie.regime_juridique} disabled={!modifiable}
                        onChange={(evenement) =>
                          modifier('regime_juridique', evenement.target.value as RegimeJuridique)}
                      >
                        {(Object.keys(LIBELLES_REGIME) as RegimeJuridique[]).map((regime) => (
                          <option key={regime} value={regime}>{LIBELLES_REGIME[regime]}</option>
                        ))}
                      </select>
                    </div>

                    <div
                      className={`requisition-portee is-${saisie.regime_juridique}`}
                      role="note"
                    >
                      {PORTEE_REGIME[saisie.regime_juridique]}
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="autorite">
                        Autorité à l’origine
                      </label>
                      <input
                        id="autorite" value={saisie.autorite_origine} disabled={!modifiable}
                        onChange={(evenement) => modifier('autorite_origine', evenement.target.value)}
                        placeholder="Présidence du Faso"
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="nature-acte">
                        Nature de l’acte
                      </label>
                      <input
                        id="nature-acte" value={saisie.nature_acte} disabled={!modifiable}
                        onChange={(evenement) => modifier('nature_acte', evenement.target.value)}
                        placeholder="Décret, arrêté, décision"
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="ref-acte">
                        Référence de l’acte
                      </label>
                      <input
                        id="ref-acte" value={saisie.reference_acte} disabled={!modifiable}
                        onChange={(evenement) => modifier('reference_acte', evenement.target.value)}
                        placeholder="n°2026-0000/PRES"
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="date-acte">
                        Date de signature
                      </label>
                      <input
                        id="date-acte" type="date" value={saisie.date_signature_acte}
                        disabled={!modifiable}
                        onChange={(evenement) => modifier('date_signature_acte', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="date-effet">
                        Prise d’effet
                      </label>
                      <input
                        id="date-effet" type="date" value={saisie.date_effet} disabled={!modifiable}
                        onChange={(evenement) => modifier('date_effet', evenement.target.value)}
                      />
                    </div>
                  </div>

                  <div className="requisition-piece" role="note">
                    <AlertTriangle aria-hidden="true" />
                    <span>
                      L’acte lui-même se verse au dossier depuis la fiche de la réquisition.
                      L’autorisation le réclame.
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* -------------------------------------- Quantités et période -- */}
            {section === 'quantites' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-amber">
                  <span className="site-form__section-icon"><Scale aria-hidden="true" /></span>
                  <div>
                    <h3>Quantités et période</h3>
                    <p>Ce qui est requis, et sur quelle production.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="type-req">
                        Portée de la mesure
                      </label>
                      <select
                        id="type-req" value={saisie.type_requisition} disabled={!modifiable}
                        onChange={(evenement) =>
                          modifier('type_requisition', evenement.target.value as TypeRequisition)}
                      >
                        {(Object.keys(LIBELLES_TYPE_REQUISITION) as TypeRequisition[]).map((type) => (
                          <option key={type} value={type}>{LIBELLES_TYPE_REQUISITION[type]}</option>
                        ))}
                      </select>
                    </div>

                    {parPourcentage ? (
                      <div className="site-form__field">
                        <label className="site-form__label" htmlFor="part">
                          Pourcentage de la production <i>*</i>
                        </label>
                        <input
                          id="part" type="number" min={0} max={100} step={0.001}
                          value={saisie.pourcentage_production} disabled={!modifiable}
                          onChange={(evenement) =>
                            modifier('pourcentage_production', evenement.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="site-form__field">
                        <label className="site-form__label" htmlFor="quantite">
                          Quantité requise, en onces <i>*</i>
                        </label>
                        <input
                          id="quantite" type="number" min={0} step={0.0001}
                          value={saisie.quantite_oz} disabled={!modifiable}
                          onChange={(evenement) => modifier('quantite_oz', evenement.target.value)}
                        />
                      </div>
                    )}

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="teneur">
                        Teneur estimée (%)
                      </label>
                      <input
                        id="teneur" type="number" min={0} max={100} step={0.001}
                        value={saisie.teneur_estimee_pct} disabled={!modifiable}
                        onChange={(evenement) => modifier('teneur_estimee_pct', evenement.target.value)}
                      />
                    </div>

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="periode-debut">
                        Période visée, début
                      </label>
                      <input
                        id="periode-debut" type="date" value={saisie.periode_debut}
                        disabled={!modifiable}
                        onChange={(evenement) => modifier('periode_debut', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="periode-fin">
                        Période visée, fin
                      </label>
                      <input
                        id="periode-fin" type="date" value={saisie.periode_fin} disabled={!modifiable}
                        onChange={(evenement) => modifier('periode_fin', evenement.target.value)}
                      />
                    </div>

                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="produits">
                        Produits concernés
                      </label>
                      <input
                        id="produits" value={saisie.produits_concernes} disabled={!modifiable}
                        onChange={(evenement) => modifier('produits_concernes', evenement.target.value)}
                        placeholder="Or doré en lingots"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ---------------------------------- Enlèvement et transport -- */}
            {section === 'logistique' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-blue">
                  <span className="site-form__section-icon"><Truck aria-hidden="true" /></span>
                  <div>
                    <h3>Enlèvement et transport</h3>
                    <p>Où l’or est détenu, où il est repris, et sous quelles conditions.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="stockage">
                        Lieu de stockage
                      </label>
                      <input
                        id="stockage" value={saisie.lieu_stockage} disabled={!modifiable}
                        onChange={(evenement) => modifier('lieu_stockage', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="enlevement">
                        Lieu d’enlèvement
                      </label>
                      <input
                        id="enlevement" value={saisie.lieu_enlevement} disabled={!modifiable}
                        onChange={(evenement) => modifier('lieu_enlevement', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="delai-dispo">
                        Délai de mise à disposition (jours)
                      </label>
                      <input
                        id="delai-dispo" type="number" min={0} step={1}
                        value={saisie.delai_mise_a_disposition_jours} disabled={!modifiable}
                        onChange={(evenement) =>
                          modifier('delai_mise_a_disposition_jours', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="equipe">
                        Équipe chargée de l’opération
                      </label>
                      <input
                        id="equipe" value={saisie.equipe} disabled={!modifiable}
                        onChange={(evenement) => modifier('equipe', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="modalites">
                        Modalités d’enlèvement
                      </label>
                      <textarea
                        id="modalites" rows={3} value={saisie.modalites_enlevement}
                        disabled={!modifiable}
                        onChange={(evenement) => modifier('modalites_enlevement', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="transport">
                        Conditions de transport
                      </label>
                      <textarea
                        id="transport" rows={2} value={saisie.conditions_transport}
                        disabled={!modifiable}
                        onChange={(evenement) => modifier('conditions_transport', evenement.target.value)}
                      />
                    </div>
                    <div className="site-form__field is-wide">
                      <label className="site-form__label" htmlFor="analyse">
                        Conditions d’analyse
                      </label>
                      <textarea
                        id="analyse" rows={2} value={saisie.conditions_analyse} disabled={!modifiable}
                        onChange={(evenement) => modifier('conditions_analyse', evenement.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* -------------------------------- Valorisation et paiement --- */}
            {section === 'valorisation' && (
              <section className="site-form__section">
                <header className="site-form__section-head is-emerald">
                  <span className="site-form__section-icon"><CircleDollarSign aria-hidden="true" /></span>
                  <div>
                    <h3>Valorisation et paiement</h3>
                    <p>Comment la quantité collectée sera valorisée puis réglée.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="site-form__grid">
                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="methode">
                        Méthode de détermination du prix
                      </label>
                      <select
                        id="methode" value={saisie.methode_prix} disabled={!modifiable}
                        onChange={(evenement) => modifier('methode_prix', evenement.target.value)}
                      >
                        <option value="cours_marche">Cours du marché au jour de l’enlèvement</option>
                        <option value="cours_date_reference">Cours à une date de référence</option>
                        <option value="moyenne_periode">Moyenne du cours sur la période</option>
                        <option value="negocie">Prix négocié</option>
                        <option value="fixe">Prix fixe</option>
                        <option value="contrat">Selon le contrat rattaché</option>
                      </select>
                    </div>

                    {saisie.methode_prix === 'fixe' && (
                      <div className="site-form__field">
                        <label className="site-form__label" htmlFor="prix">
                          Prix de l’once, en FCFA
                        </label>
                        <input
                          id="prix" type="number" min={0} step={1000}
                          value={saisie.prix_once_fcfa} disabled={!modifiable}
                          onChange={(evenement) => modifier('prix_once_fcfa', evenement.target.value)}
                        />
                      </div>
                    )}

                    <div className="site-form__field">
                      <label className="site-form__label" htmlFor="paiement">
                        Modalités de paiement
                      </label>
                      <select
                        id="paiement" value={saisie.modalites_paiement} disabled={!modifiable}
                        onChange={(evenement) => modifier('modalites_paiement', evenement.target.value)}
                      >
                        <option value="comptant">Comptant</option>
                        <option value="differe_30j">Différé 30 jours</option>
                        <option value="differe_60j">Différé 60 jours</option>
                        <option value="differe_90j">Différé 90 jours</option>
                        <option value="echelonne">Échelonné</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <footer className="site-form__actions">
              <button type="button" onClick={() => navigate('/requisitions')}>
                <ArrowLeft aria-hidden="true" /> Retour au registre
              </button>
              {modifiable && (
                <>
                  <button
                    type="button" onClick={() => void enregistrer(false)} disabled={enregistrement}
                  >
                    {enregistrement ? <Loader2 className="is-spinning" aria-hidden="true" /> : <Save aria-hidden="true" />}
                    Enregistrer le brouillon
                  </button>
                  <button
                    type="button" className="is-primary"
                    onClick={() => void enregistrer(true)} disabled={enregistrement}
                  >
                    Enregistrer et ouvrir le dossier
                  </button>
                </>
              )}
            </footer>
          </div>

          {/* -------------------------------------------------- Volet droit */}
          <aside className="site-form__aside" aria-label="Résumé de la réquisition">
            <section className="site-form__card">
              <header>
                <span className="site-form__card-icon is-emerald"><Gavel aria-hidden="true" /></span>
                <div>
                  <h3>Résumé</h3>
                  <p>{requisition?.reference ?? 'Réquisition en préparation'}</p>
                </div>
              </header>
              <ul className="contrat-form__resume">
                <li>
                  <span>Mine</span>
                  <b>
                    {societes.find((societe) => societe.id === saisie.mining_company_id)?.name
                      ?? 'Non choisie'}
                  </b>
                </li>
                <li>
                  <span>Portée</span>
                  <b>{LIBELLES_TYPE_REQUISITION[saisie.type_requisition]}</b>
                </li>
                <li>
                  <span>Régime</span>
                  <b>{LIBELLES_REGIME[saisie.regime_juridique]}</b>
                </li>
                <li>
                  <span>Acte</span>
                  <b>{saisie.reference_acte || '—'}</b>
                </li>
                <li>
                  <span>Contrat rattaché</span>
                  <b>
                    {contratsDeLaMine.find((contrat) => contrat.id === saisie.contrat_id)
                      ?.numero_contrat ?? 'Aucun'}
                  </b>
                </li>
              </ul>
            </section>

            <section className="site-form__card">
              <header>
                <span className="site-form__card-icon is-amber"><AlertTriangle aria-hidden="true" /></span>
                <div>
                  <h3>Avant l’autorisation</h3>
                  <p>{manques.length === 0 ? 'Le dossier est complet' : `${manques.length} point(s) à compléter`}</p>
                </div>
              </header>
              {manques.length === 0 ? (
                <p className="contrat-form__vide">
                  Tout ce qui conditionne l’autorisation est renseigné. L’acte juridique reste à
                  verser au dossier.
                </p>
              ) : (
                <ul className="contrat-form__manques">
                  {manques.map((manque) => <li key={manque}>{manque}</li>)}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}

export default RequisitionForm;
