import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Banknote, Building2, CheckCircle2, Eye, FileText,
  Landmark, Loader2, Lock, Save, Search, ShieldCheck, Wallet, X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { errorMessage } from '@/lib/errorMessage';
import { achatsIndustrielsService, type ReglementAchat } from '@/services/achatsIndustrielsService';
import {
  formaterFcfa,
  LIBELLES_CYCLE,
  masquerCompte,
  montantEnLettres,
  reglementsAchatService,
  TONS_CYCLE,
  type CompteBancaire,
  type FactureEligible,
  type SocieteEligible,
  type StatutReglementCycle,
} from '@/services/reglementsAchatService';
import {
  LIBELLES_TRANCHE,
  simulerAffectationFifo,
  type TrancheAge,
} from '@/services/achatsIndustrielsCalculs';
import { FactureAchatApercu } from './FactureAchatApercu';
import '@/pages/artisanal-sites/artisanal-site-form.css';
import './reglement-form.css';

/**
 * Préparation d'un ordre de virement à une société minière.
 *
 * ══ CE QUE CET ÉCRAN GARANTIT ══
 *
 * 1. Seules les sociétés portant une dette exigible sont proposées. La liste
 *    vient de `snp_societes_eligibles_paiement` : une société soldée n'y figure
 *    pas, et proposer un bénéficiaire sans dette inviterait à créer un paiement
 *    sans objet.
 * 2. Le compte bénéficiaire vient de la fiche de la société. Il ne se saisit
 *    pas ici, et le formulaire n'offre aucun moyen de le contourner : sans
 *    compte actif, la préparation est bloquée et l'écran renvoie à la fiche.
 * 3. Le mode de règlement est le virement bancaire, sans alternative. Espèces,
 *    chèque et mobile money n'ont pas cours pour des montants de cet ordre.
 * 4. Rien n'est enregistré avant l'étape de vérification. Consulter une facture
 *    n'efface pas la saisie en cours.
 *
 * L'habillage est celui du formulaire de création d'un site artisanal — même
 * grille, mêmes sections, même volet droit, même barre d'actions — repris par
 * import de sa feuille de style plutôt que recopié.
 */

const ETAPES = [
  { cle: 'saisie', libelle: 'Bénéficiaire et imputation' },
  { cle: 'verification', libelle: 'Vérification' },
] as const;

type Etape = (typeof ETAPES)[number]['cle'];

const formaterDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR');
};

/** Arrondi au franc : la devise n'a pas de subdivision en circulation. */
const auFranc = (valeur: number) => Math.round(Number(valeur) || 0);

export function ReglementForm() {
  const navigate = useNavigate();

  const [etape, setEtape] = useState<Etape>('saisie');
  const [societes, setSocietes] = useState<SocieteEligible[]>([]);
  const [recherche, setRecherche] = useState('');
  const [societeChoisie, setSocieteChoisie] = useState<SocieteEligible | null>(null);
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [compteChoisi, setCompteChoisi] = useState<string>('');
  const [factures, setFactures] = useState<FactureEligible[]>([]);
  const [imputations, setImputations] = useState<Record<string, string>>({});
  const [derniersReglements, setDerniersReglements] = useState<ReglementAchat[]>([]);
  const [factureOuverte, setFactureOuverte] = useState<FactureEligible | null>(null);

  const [chargement, setChargement] = useState(true);
  const [chargementSociete, setChargementSociete] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [entete, setEntete] = useState({
    montant: '',
    date_execution_prevue: '',
    objet: '',
    reference_interne: '',
    observations: '',
  });

  /* ------------------------------------------------------------ Chargement */

  const chargerSocietes = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setSocietes(await reglementsAchatService.societesEligibles());
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les bénéficiaires éligibles.'));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void chargerSocietes();
  }, [chargerSocietes]);

  const choisirSociete = async (societe: SocieteEligible) => {
    setSocieteChoisie(societe);
    setImputations({});
    setCompteChoisi('');
    setChargementSociete(true);
    setErreur(null);
    try {
      const [comptesCharges, facturesChargees, reglements] = await Promise.all([
        reglementsAchatService.comptesBancaires(societe.mining_company_id, societe.devise),
        reglementsAchatService.facturesEligibles(societe.mining_company_id, societe.devise),
        achatsIndustrielsService.listerReglements(societe.mining_company_id),
      ]);
      setComptes(comptesCharges);
      setFactures(facturesChargees);
      setDerniersReglements(reglements.slice(0, 6));
      // Un seul compte principal : il se présélectionne, l'agent n'a rien à
      // choisir là où il n'y a pas de choix.
      const principal = comptesCharges.find((compte) => compte.is_primary) ?? comptesCharges[0];
      if (principal) setCompteChoisi(principal.id);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger la situation de cette société.'));
    } finally {
      setChargementSociete(false);
    }
  };

  /* --------------------------------------------------------------- Calculs */

  const societesFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return societes;
    return societes.filter((societe) =>
      societe.societe.toLowerCase().includes(terme)
      || (societe.code || '').toLowerCase().includes(terme)
      || (societe.plus_ancienne_facture || '').toLowerCase().includes(terme));
  }, [societes, recherche]);

  const compte = comptes.find((element) => element.id === compteChoisi) ?? null;
  const montantSaisi = auFranc(Number(entete.montant) || 0);

  const lignes = useMemo(() => factures.map((facture) => {
    const impute = auFranc(Number(imputations[facture.facture_id]) || 0);
    const plafond = auFranc(facture.reste_a_affecter);
    return {
      facture,
      impute,
      plafond,
      excede: impute > plafond,
      soldeApres: Math.max(0, auFranc(facture.reste_du) - impute),
    };
  }), [factures, imputations]);

  const totaux = useMemo(() => {
    const affecte = lignes.reduce((somme, ligne) => somme + ligne.impute, 0);
    const retenues = lignes.filter((ligne) => ligne.impute > 0);
    return {
      affecte,
      reste: montantSaisi - affecte,
      nbRetenues: retenues.length,
      totalRetenues: retenues.reduce((somme, ligne) => somme + auFranc(ligne.facture.reste_du), 0),
      enExces: lignes.filter((ligne) => ligne.excede).length,
      detteApres: Math.max(0, auFranc(societeChoisie?.reste_du ?? 0) - affecte),
    };
  }, [lignes, montantSaisi, societeChoisie]);

  /** Imputation automatique, la plus ancienne d'abord. */
  const imputerFifo = () => {
    if (montantSaisi <= 0) {
      setErreur('Saisissez d’abord le montant du virement.');
      return;
    }
    const { affectations } = simulerAffectationFifo(
      montantSaisi,
      factures.map((facture) => ({
        id: facture.facture_id,
        numero_facture: facture.numero_facture,
        date_echeance: facture.date_echeance,
        date_emission: facture.date_emission,
        reste_du_fcfa: auFranc(facture.reste_a_affecter),
      }))
    );
    setImputations(Object.fromEntries(
      affectations.map((affectation) => [affectation.facture_id, String(affectation.montant_affecte_fcfa)])
    ));
    setErreur(null);
  };

  const validerSaisie = (): string | null => {
    if (!societeChoisie) return 'Choisissez la société bénéficiaire.';
    if (!compte) return 'Aucun compte bancaire actif n’est rattaché à cette société.';
    if (montantSaisi <= 0) return 'Le montant du virement doit être supérieur à zéro.';
    if (totaux.enExces > 0) {
      return `${totaux.enExces} imputation(s) dépassent le reste imputable de leur facture.`;
    }
    if (totaux.affecte > montantSaisi) {
      return 'Le total imputé dépasse le montant du virement.';
    }
    if (totaux.affecte <= 0) return 'Imputez le virement sur au moins une facture.';
    return null;
  };

  const allerVerifier = () => {
    const probleme = validerSaisie();
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setErreur(null);
    setEtape('verification');
  };

  const soumettre = async () => {
    const probleme = validerSaisie();
    if (probleme) {
      setErreur(probleme);
      setEtape('saisie');
      return;
    }

    setEnregistrement(true);
    setErreur(null);
    try {
      const resultat = await reglementsAchatService.preparer({
        mining_company_id: societeChoisie!.mining_company_id,
        compte_bancaire_id: compteChoisi,
        montant_fcfa: montantSaisi,
        affectations: lignes
          .filter((ligne) => ligne.impute > 0)
          .map((ligne) => ({ facture_id: ligne.facture.facture_id, montant: ligne.impute })),
        date_execution_prevue: entete.date_execution_prevue || null,
        objet: entete.objet || null,
        reference_interne: entete.reference_interne || null,
        observations: entete.observations || null,
      });
      navigate(`/achats/reglements?prepare=${resultat?.r_reference ?? ''}`);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Le règlement n’a pas pu être préparé.'));
      setEtape('saisie');
    } finally {
      setEnregistrement(false);
    }
  };

  /* ------------------------------------------------------------- Affichage */

  return (
    <NationalDashboardLayout>
      <div className="site-form reglement-form">
        <header className="site-form__intro">
          <span className="site-form__intro-icon"><Banknote aria-hidden="true" /></span>
          <div>
            <h2>Préparer un règlement</h2>
            <p className="site-form__subtitle">
              Virement bancaire à une société minière industrielle, imputé sur ses factures d’achat.
            </p>
          </div>

          <div className="site-form__meta">
            <div className="site-form__meta-tile is-code">
              <p><Lock aria-hidden="true" /> Mode de règlement</p>
              <output>Virement bancaire</output>
            </div>
            <div className="site-form__meta-tile">
              <p>Montant du virement</p>
              <output>{montantSaisi > 0 ? formaterFcfa(montantSaisi) : '—'}</output>
              {montantSaisi > 0 && <small>{montantEnLettres(montantSaisi)}</small>}
            </div>
          </div>
        </header>

        <ol className="reglement-form__etapes">
          {ETAPES.map((element, index) => (
            <li
              key={element.cle}
              className={
                element.cle === etape ? 'est-courante'
                  : (etape === 'verification' && index === 0) ? 'est-faite' : ''
              }
            >
              <b>{index + 1}</b> {element.libelle}
            </li>
          ))}
        </ol>

        {erreur && <div className="site-form__error" role="alert">{erreur}</div>}

        <div className="site-form__layout">
          <div className="site-form__main">
            {chargement ? (
              <div className="site-form__loading">
                <Loader2 aria-hidden="true" /> Chargement des bénéficiaires…
              </div>
            ) : etape === 'saisie' ? (
              <>
                {/* ---------------------------------------- Bénéficiaire -- */}
                <section className="site-form__section">
                  <header className="site-form__section-head is-emerald">
                    <span className="site-form__section-icon"><Building2 aria-hidden="true" /></span>
                    <div>
                      <h3>Société bénéficiaire</h3>
                      <p>
                        Seules les sociétés portant une dette exigible apparaissent.
                        {societes.length > 0 && ` ${societes.length} société(s) concernée(s).`}
                      </p>
                    </div>
                  </header>
                  <div className="site-form__section-body">
                    <label className="site-form__search" style={{ marginBottom: 14, display: 'block' }}>
                      <Search aria-hidden="true" />
                      <input
                        type="search" value={recherche}
                        onChange={(evenement) => setRecherche(evenement.target.value)}
                        placeholder="Rechercher par raison sociale, code ou numéro de facture"
                        aria-label="Rechercher un bénéficiaire"
                      />
                    </label>

                    {societesFiltrees.length === 0 ? (
                      <p className="reglement-form__vide" style={{ padding: 0 }}>
                        {societes.length === 0
                          ? 'Aucune société ne présente de facture impayée : il n’y a rien à régler.'
                          : 'Aucune société ne correspond à cette recherche.'}
                      </p>
                    ) : (
                      <div className="reglement-form__beneficiaires">
                        {societesFiltrees.map((societe) => (
                          <button
                            key={`${societe.mining_company_id}-${societe.devise}`}
                            type="button"
                            className={[
                              'reglement-form__beneficiaire',
                              societeChoisie?.mining_company_id === societe.mining_company_id ? 'est-choisi' : '',
                              societe.nb_comptes_actifs === 0 ? 'est-bloquee' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => void choisirSociete(societe)}
                          >
                            <strong>{societe.societe}</strong>
                            <em>{societe.code} · {societe.devise}</em>
                            <dl>
                              <div>
                                <dt>Reste dû</dt>
                                <dd>{formaterFcfa(societe.reste_du)}</dd>
                              </div>
                              <div>
                                <dt>Dont échu</dt>
                                <dd className={societe.dette_echue > 0 ? 'est-echu' : undefined}>
                                  {formaterFcfa(societe.dette_echue)}
                                </dd>
                              </div>
                              <div>
                                <dt>Factures ouvertes</dt>
                                <dd>{societe.nb_factures_ouvertes}</dd>
                              </div>
                              <div>
                                <dt>Plus ancienne</dt>
                                <dd>{societe.anciennete_jours} j</dd>
                              </div>
                            </dl>
                            {societe.nb_comptes_actifs === 0 && (
                              <span className="est-alerte">
                                Aucun compte bancaire actif : renseignez-le sur la fiche de la société.
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {societeChoisie && (
                  <>
                    {/* ------------------------------ Compte bénéficiaire -- */}
                    <section className="site-form__section">
                      <header className="site-form__section-head is-blue">
                        <span className="site-form__section-icon"><Landmark aria-hidden="true" /></span>
                        <div>
                          <h3>Compte bancaire bénéficiaire</h3>
                          <p>Défini sur la fiche de la société. Il ne se saisit pas ici.</p>
                        </div>
                      </header>
                      <div className="site-form__section-body">
                        {chargementSociete ? (
                          <div className="site-form__loading" style={{ minHeight: 120 }}>
                            <Loader2 aria-hidden="true" /> Chargement…
                          </div>
                        ) : comptes.length === 0 ? (
                          <div className="reglement-form__banque-vide" role="alert">
                            <strong>Aucun compte bancaire actif pour cette société.</strong>
                            <br />
                            Un virement ne peut pas être préparé sans coordonnées vérifiées. Un
                            utilisateur habilité doit les renseigner sur la fiche de la société
                            minière, où la modification est tracée.
                          </div>
                        ) : (
                          <>
                            {comptes.length > 1 && (
                              <div className="site-form__field" style={{ marginBottom: 14 }}>
                                <span className="site-form__label">Compte à créditer</span>
                                <select
                                  value={compteChoisi}
                                  onChange={(evenement) => setCompteChoisi(evenement.target.value)}
                                >
                                  {comptes.map((element) => (
                                    <option key={element.id} value={element.id}>
                                      {element.bank_name} — {masquerCompte(element.account_number)}
                                      {element.is_primary ? ' (principal)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {compte && (
                              <dl className="reglement-form__banque">
                                <div><dt>Banque</dt><dd>{compte.bank_name}</dd></div>
                                <div><dt>Agence</dt><dd>{compte.branch_name || '—'}</dd></div>
                                <div><dt>Titulaire</dt><dd>{compte.account_holder || compte.account_name}</dd></div>
                                <div><dt>Numéro de compte</dt><dd>{masquerCompte(compte.account_number)}</dd></div>
                                <div><dt>Code banque</dt><dd>{compte.bank_code || '—'}</dd></div>
                                <div><dt>Code guichet</dt><dd>{compte.branch_code || '—'}</dd></div>
                                <div><dt>Clé RIB</dt><dd>{compte.rib_key || '—'}</dd></div>
                                <div><dt>SWIFT / BIC</dt><dd>{compte.swift_code || '—'}</dd></div>
                                <div><dt>Devise</dt><dd>{compte.account_currency}</dd></div>
                                <div>
                                  <dt>Vérification</dt>
                                  <dd>
                                    {compte.verification_status === 'verifie' ? 'Compte vérifié'
                                      : compte.verification_status === 'rejete' ? 'Vérification rejetée'
                                        : 'À vérifier'}
                                  </dd>
                                </div>
                              </dl>
                            )}

                            {compte && compte.verification_status !== 'verifie' && (
                              <div className="site-form__coordinates" style={{ borderColor: '#f3c8c3', color: '#b3261e', background: '#fff2f0' }}>
                                <AlertTriangle aria-hidden="true" />
                                Ces coordonnées n’ont pas été vérifiées. Faites-les contrôler avant
                                d’émettre un ordre de cette importance.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </section>

                    {/* ------------------------------ Informations du virement */}
                    <section className="site-form__section">
                      <header className="site-form__section-head is-slate">
                        <span className="site-form__section-icon"><Wallet aria-hidden="true" /></span>
                        <div>
                          <h3>Informations du virement</h3>
                          <p>Montant, échéance d’exécution et références de suivi.</p>
                        </div>
                      </header>
                      <div className="site-form__section-body">
                        <div className="site-form__grid">
                          <div className="site-form__field">
                            <label className="site-form__label" htmlFor="montant">
                              Montant du virement (FCFA) <i>*</i>
                            </label>
                            <input
                              id="montant" type="number" min={0} step={1000}
                              value={entete.montant}
                              onChange={(evenement) => setEntete((e) => ({ ...e, montant: evenement.target.value }))}
                              placeholder="0"
                            />
                            {montantSaisi > 0 && (
                              <small>{montantEnLettres(montantSaisi)}</small>
                            )}
                          </div>

                          <div className="site-form__field">
                            <label className="site-form__label" htmlFor="devise">Devise</label>
                            <input id="devise" value={societeChoisie.devise} disabled />
                          </div>

                          <div className="site-form__field">
                            <label className="site-form__label" htmlFor="execution">
                              Date d’exécution prévue
                            </label>
                            <input
                              id="execution" type="date" value={entete.date_execution_prevue}
                              onChange={(evenement) => setEntete((e) => ({
                                ...e, date_execution_prevue: evenement.target.value,
                              }))}
                            />
                          </div>

                          <div className="site-form__field">
                            <label className="site-form__label" htmlFor="reference">
                              Référence interne
                            </label>
                            <input
                              id="reference" value={entete.reference_interne}
                              onChange={(evenement) => setEntete((e) => ({
                                ...e, reference_interne: evenement.target.value,
                              }))}
                              placeholder="OV-2026-000"
                            />
                          </div>

                          <div className="site-form__field is-wide">
                            <label className="site-form__label" htmlFor="objet">Objet du virement</label>
                            <input
                              id="objet" value={entete.objet}
                              onChange={(evenement) => setEntete((e) => ({ ...e, objet: evenement.target.value }))}
                              placeholder="Règlement des achats d’or de…"
                            />
                          </div>

                          <div className="site-form__field is-wide">
                            <label className="site-form__label" htmlFor="observations">Observations</label>
                            <textarea
                              id="observations" rows={3} value={entete.observations}
                              onChange={(evenement) => setEntete((e) => ({
                                ...e, observations: evenement.target.value,
                              }))}
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* ------------------------------------- Imputation --- */}
                    <section className="site-form__section">
                      <header className="site-form__section-head is-amber">
                        <span className="site-form__section-icon"><FileText aria-hidden="true" /></span>
                        <div>
                          <h3>Imputation sur les factures</h3>
                          <p>
                            Un virement peut couvrir plusieurs factures, et une facture recevoir
                            plusieurs virements.
                          </p>
                        </div>
                      </header>
                      <div className="site-form__section-body">
                        <dl className="reglement-form__synthese">
                          <div>
                            <dt>Montant du virement</dt>
                            <dd>{formaterFcfa(montantSaisi)}</dd>
                          </div>
                          <div>
                            <dt>Total imputé</dt>
                            <dd>{formaterFcfa(totaux.affecte)}</dd>
                          </div>
                          <div>
                            <dt>Reste à imputer</dt>
                            <dd className={
                              totaux.reste < 0 ? 'est-excedent'
                                : totaux.reste === 0 && totaux.affecte > 0 ? 'est-complet' : 'est-restant'
                            }>
                              {formaterFcfa(totaux.reste)}
                            </dd>
                          </div>
                          <div>
                            <dt>Factures retenues</dt>
                            <dd>{totaux.nbRetenues}</dd>
                          </div>
                          <div>
                            <dt>Dette après virement</dt>
                            <dd>{formaterFcfa(totaux.detteApres)}</dd>
                          </div>
                        </dl>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                          <button type="button" className="reglement-form__voir" onClick={imputerFifo}>
                            <ShieldCheck aria-hidden="true" /> Affecter aux factures les plus anciennes
                          </button>
                          <button
                            type="button" className="reglement-form__voir"
                            onClick={() => setImputations({})}
                          >
                            <X aria-hidden="true" /> Tout retirer
                          </button>
                        </div>

                        {factures.length === 0 ? (
                          <p className="reglement-form__vide" style={{ padding: 0 }}>
                            Cette société n’a aucune facture imputable.
                          </p>
                        ) : (
                          <div className="reglement-form__factures">
                            <table>
                              <thead>
                                <tr>
                                  <th scope="col">Facture</th>
                                  <th scope="col">Achat</th>
                                  <th scope="col">Échéance</th>
                                  <th scope="col">Ancienneté</th>
                                  <th scope="col" className="est-nombre">Montant TTC</th>
                                  <th scope="col" className="est-nombre">Déjà payé</th>
                                  <th scope="col" className="est-nombre">Reste dû</th>
                                  <th scope="col" className="est-nombre">Imputable</th>
                                  <th scope="col" className="est-nombre">À imputer</th>
                                  <th scope="col" className="est-nombre">Solde après</th>
                                  <th scope="col" />
                                </tr>
                              </thead>
                              <tbody>
                                {lignes.map((ligne) => (
                                  <tr
                                    key={ligne.facture.facture_id}
                                    className={ligne.impute > 0 ? 'est-retenue' : undefined}
                                  >
                                    <td><strong>{ligne.facture.numero_facture}</strong></td>
                                    <td>{ligne.facture.achat_numero || '—'}</td>
                                    <td>{formaterDate(ligne.facture.date_echeance)}</td>
                                    <td>
                                      <span className={`reglement-form__age est-${ligne.facture.tranche}`}>
                                        {LIBELLES_TRANCHE[ligne.facture.tranche as TrancheAge]
                                          ?? ligne.facture.tranche}
                                      </span>
                                    </td>
                                    <td className="est-nombre">{formaterFcfa(ligne.facture.montant_ttc)}</td>
                                    <td className="est-nombre">{formaterFcfa(ligne.facture.montant_paye)}</td>
                                    <td className="est-nombre">{formaterFcfa(ligne.facture.reste_du)}</td>
                                    <td className="est-nombre">{formaterFcfa(ligne.plafond)}</td>
                                    <td className="est-nombre">
                                      <input
                                        type="number" min={0} max={ligne.plafond} step={1000}
                                        aria-label={`Montant à imputer sur ${ligne.facture.numero_facture}`}
                                        aria-invalid={ligne.excede ? true : undefined}
                                        value={imputations[ligne.facture.facture_id] ?? ''}
                                        onChange={(evenement) => setImputations((actuelles) => ({
                                          ...actuelles,
                                          [ligne.facture.facture_id]: evenement.target.value,
                                        }))}
                                      />
                                    </td>
                                    <td className="est-nombre">{formaterFcfa(ligne.soldeApres)}</td>
                                    <td>
                                      <button
                                        type="button" className="reglement-form__voir"
                                        onClick={() => setFactureOuverte(ligne.facture)}
                                      >
                                        <Eye aria-hidden="true" /> Voir la facture
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={6}>Total</td>
                                  <td className="est-nombre">
                                    {formaterFcfa(lignes.reduce((s, l) => s + auFranc(l.facture.reste_du), 0))}
                                  </td>
                                  <td className="est-nombre">
                                    {formaterFcfa(lignes.reduce((s, l) => s + l.plafond, 0))}
                                  </td>
                                  <td className="est-nombre">{formaterFcfa(totaux.affecte)}</td>
                                  <td className="est-nombre">
                                    {formaterFcfa(lignes.reduce((s, l) => s + l.soldeApres, 0))}
                                  </td>
                                  <td />
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    </section>
                  </>
                )}
              </>
            ) : (
              /* ------------------------------------------- Vérification -- */
              <section className="site-form__section">
                <header className="site-form__section-head is-emerald">
                  <span className="site-form__section-icon"><CheckCircle2 aria-hidden="true" /></span>
                  <div>
                    <h3>Vérification avant soumission</h3>
                    <p>Relisez l’ordre : il engagera la trésorerie de la SONASP.</p>
                  </div>
                </header>
                <div className="site-form__section-body">
                  <div className="reglement-form__verif-montant">
                    <strong>{formaterFcfa(montantSaisi)}</strong>
                    <em>{montantEnLettres(montantSaisi)}</em>
                  </div>

                  <dl className="reglement-form__recap">
                    <div><dt>Bénéficiaire</dt><dd>{societeChoisie?.societe}</dd></div>
                    <div><dt>Banque</dt><dd>{compte?.bank_name}</dd></div>
                    <div><dt>Titulaire</dt><dd>{compte?.account_holder || compte?.account_name}</dd></div>
                    <div><dt>Compte</dt><dd>{masquerCompte(compte?.account_number)}</dd></div>
                    <div><dt>SWIFT / BIC</dt><dd>{compte?.swift_code || '—'}</dd></div>
                    <div><dt>Mode</dt><dd>Virement bancaire</dd></div>
                    <div><dt>Devise</dt><dd>{societeChoisie?.devise}</dd></div>
                    <div><dt>Exécution prévue</dt><dd>{formaterDate(entete.date_execution_prevue)}</dd></div>
                    <div><dt>Référence interne</dt><dd>{entete.reference_interne || '—'}</dd></div>
                    <div><dt>Objet</dt><dd>{entete.objet || '—'}</dd></div>
                  </dl>

                  <h4 style={{ margin: '22px 0 10px', fontSize: 12.5 }}>Factures imputées</h4>
                  <div className="reglement-form__factures">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Facture</th>
                          <th scope="col">Échéance</th>
                          <th scope="col" className="est-nombre">Solde avant</th>
                          <th scope="col" className="est-nombre">Imputé</th>
                          <th scope="col" className="est-nombre">Solde après</th>
                          <th scope="col" />
                        </tr>
                      </thead>
                      <tbody>
                        {lignes.filter((ligne) => ligne.impute > 0).map((ligne) => (
                          <tr key={ligne.facture.facture_id}>
                            <td><strong>{ligne.facture.numero_facture}</strong></td>
                            <td>{formaterDate(ligne.facture.date_echeance)}</td>
                            <td className="est-nombre">{formaterFcfa(ligne.facture.reste_du)}</td>
                            <td className="est-nombre">{formaterFcfa(ligne.impute)}</td>
                            <td className="est-nombre">{formaterFcfa(ligne.soldeApres)}</td>
                            <td>
                              <button
                                type="button" className="reglement-form__voir"
                                onClick={() => setFactureOuverte(ligne.facture)}
                              >
                                <Eye aria-hidden="true" /> Voir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3}>Total imputé</td>
                          <td className="est-nombre">{formaterFcfa(totaux.affecte)}</td>
                          <td className="est-nombre">{formaterFcfa(totaux.detteApres)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {totaux.reste > 0 && (
                    <div className="site-form__coordinates" style={{ borderColor: '#fbeccc', color: '#96690a', background: '#fdf6e7' }}>
                      <AlertTriangle aria-hidden="true" />
                      {formaterFcfa(totaux.reste)} resteront sans imputation. Le montant sera
                      conservé au crédit de la société et pourra être imputé plus tard.
                    </div>
                  )}

                  <div className="site-form__note">
                    <ShieldCheck aria-hidden="true" />
                    <span>
                      Le règlement sera enregistré en <strong>brouillon</strong>. Il retiendra les
                      factures imputées sans réduire la dette : celle-ci ne baissera qu’à
                      l’exécution confirmée, attestée par une pièce bancaire.
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* ------------------------------------------------- Actions -- */}
            <footer className="site-form__actions">
              {etape === 'saisie' ? (
                <>
                  <button type="button" onClick={() => navigate('/achats/reglements')}>
                    <ArrowLeft aria-hidden="true" /> Retour
                  </button>
                  <button
                    type="button" className="is-primary"
                    onClick={allerVerifier}
                    disabled={!societeChoisie || comptes.length === 0}
                  >
                    Vérifier l’ordre
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setEtape('saisie')}>
                    <ArrowLeft aria-hidden="true" /> Corriger
                  </button>
                  <button
                    type="button" className="is-primary"
                    onClick={() => void soumettre()}
                    disabled={enregistrement}
                  >
                    {enregistrement ? <Loader2 className="is-spinning" aria-hidden="true" /> : <Save aria-hidden="true" />}
                    {enregistrement ? 'Enregistrement…' : 'Confirmer et enregistrer'}
                  </button>
                </>
              )}
            </footer>
          </div>

          {/* ------------------------------------------------ Volet droit -- */}
          <aside className="site-form__aside" aria-label="Situation du bénéficiaire">
            <section className="site-form__card">
              <header>
                <span className="site-form__card-icon is-emerald"><Building2 aria-hidden="true" /></span>
                <div>
                  <h3>Synthèse du compte</h3>
                  <p>{societeChoisie ? societeChoisie.societe : 'Aucun bénéficiaire choisi'}</p>
                </div>
              </header>
              {societeChoisie ? (
                <ul className="reglement-form__liste">
                  <li>
                    <div className="reglement-form__liste-tete">
                      <strong>Encours total</strong>
                      <span>{formaterFcfa(societeChoisie.reste_du)}</span>
                    </div>
                  </li>
                  <li>
                    <div className="reglement-form__liste-tete">
                      <strong>Dont échu</strong>
                      <span>{formaterFcfa(societeChoisie.dette_echue)}</span>
                    </div>
                  </li>
                  <li>
                    <div className="reglement-form__liste-tete">
                      <strong>Non échu</strong>
                      <span>{formaterFcfa(societeChoisie.reste_du - societeChoisie.dette_echue)}</span>
                    </div>
                  </li>
                  <li>
                    <div className="reglement-form__liste-tete">
                      <strong>Factures ouvertes</strong>
                      <span>{societeChoisie.nb_factures_ouvertes}</span>
                    </div>
                    <span className="reglement-form__liste-meta">
                      Plus ancienne : {societeChoisie.plus_ancienne_facture || '—'} — échue le{' '}
                      {formaterDate(societeChoisie.plus_ancienne_echeance)}
                    </span>
                  </li>
                </ul>
              ) : (
                <p className="reglement-form__vide">
                  Choisissez une société pour voir sa situation.
                </p>
              )}
            </section>

            <section className="site-form__card">
              <header>
                <span className="site-form__card-icon is-blue"><Wallet aria-hidden="true" /></span>
                <div>
                  <h3>Derniers règlements</h3>
                  <p>{derniersReglements.length} opération(s) récente(s)</p>
                </div>
              </header>
              {derniersReglements.length === 0 ? (
                <p className="reglement-form__vide">
                  {societeChoisie
                    ? 'Aucun règlement enregistré pour cette société.'
                    : 'Choisissez une société pour voir son historique.'}
                </p>
              ) : (
                <ul className="reglement-form__liste est-defilante">
                  {derniersReglements.map((reglement) => {
                    const statut = reglement.statut as StatutReglementCycle;
                    const nonAffecte = Number(reglement.montant_fcfa || 0)
                      - Number(reglement.montant_affecte_fcfa || 0);
                    return (
                      <li key={reglement.id}>
                        <div className="reglement-form__liste-tete">
                          <strong>{reglement.reference_reglement}</strong>
                          <span>{formaterFcfa(reglement.montant_fcfa)}</span>
                        </div>
                        <span className="reglement-form__liste-meta">
                          {formaterDate(reglement.date_reglement)} ·{' '}
                          <span className={`reglement-form__etat est-${TONS_CYCLE[statut] ?? 'neutral'}`}>
                            {LIBELLES_CYCLE[statut] ?? reglement.statut}
                          </span>
                        </span>
                        {nonAffecte > 0.5 && (
                          <span className="reglement-form__liste-meta">
                            Non imputé : {formaterFcfa(nonAffecte)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="site-form__card">
              <header>
                <span className="site-form__card-icon is-amber"><FileText aria-hidden="true" /></span>
                <div>
                  <h3>Factures liées aux achats</h3>
                  <p>{factures.length} facture(s) imputable(s)</p>
                </div>
              </header>
              {factures.length === 0 ? (
                <p className="reglement-form__vide">
                  {societeChoisie
                    ? 'Aucune facture imputable.'
                    : 'Choisissez une société pour voir ses factures.'}
                </p>
              ) : (
                <ul className="reglement-form__liste est-defilante">
                  {factures.map((facture) => (
                    <li key={facture.facture_id}>
                      <div className="reglement-form__liste-tete">
                        <strong>{facture.numero_facture}</strong>
                        <span>{formaterFcfa(facture.reste_du)}</span>
                      </div>
                      <span className="reglement-form__liste-meta">
                        {facture.achat_numero || '—'} · échéance {formaterDate(facture.date_echeance)}
                      </span>
                      <span className="reglement-form__liste-meta">
                        <span className={`reglement-form__age est-${facture.tranche}`}>
                          {LIBELLES_TRANCHE[facture.tranche as TrancheAge] ?? facture.tranche}
                        </span>
                        {' '}
                        <button
                          type="button" className="reglement-form__voir"
                          style={{ height: 22, fontSize: 10 }}
                          onClick={() => setFactureOuverte(facture)}
                        >
                          <Eye aria-hidden="true" /> Voir
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        {/* La facture se consulte en entier, dans sa forme comptable. Fermer ne
            touche pas à la saisie : elle vit dans l'état du formulaire, que
            cette fenêtre ne remonte jamais. */}
        {factureOuverte && (
          <FactureAchatApercu
            factureId={factureOuverte.facture_id}
            onFermer={() => setFactureOuverte(null)}
          />
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default ReglementForm;
