import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Banknote, Building2, CheckCircle2, Eye, FileText,
  Landmark, Loader2, Lock, Save, Search, ShieldCheck, Wallet, X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { achatsIndustrielsService, type ReglementAchat } from '@/services/achatsIndustrielsService';
import {
  formaterFcfa,
  formaterMontant,
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
import { LIBELLES_TRANCHE, type TrancheAge } from '@/services/achatsIndustrielsCalculs';
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
 * 4. Le montant de l'ordre est la somme des imputations. Il ne se saisit pas :
 *    un virement qui ne correspondrait pas à ce qu'on porte sur les factures
 *    laisserait un écart que personne ne rattraperait.
 * 5. Rien n'est enregistré avant l'étape de vérification. Consulter une facture
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
  const [factureActiveId, setFactureActiveId] = useState<string | null>(null);
  const [derniersReglements, setDerniersReglements] = useState<ReglementAchat[]>([]);
  const [factureOuverte, setFactureOuverte] = useState<FactureEligible | null>(null);

  const [chargement, setChargement] = useState(true);
  const [chargementSociete, setChargementSociete] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [entete, setEntete] = useState({
    date_execution_prevue: '',
    objet: '',
    observations: '',
  });

  /* ------------------------------------------------------------ Chargement */

  const chargerSocietes = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setSocietes(await reglementsAchatService.societesEligibles());
    } catch (raison) {
      setErreur(messageErreurUtilisateur(raison, 'Impossible de charger les bénéficiaires éligibles.'));
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
    setFactureActiveId(null);
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
      // La plus ancienne s'ouvre d'emblée : c'est celle qu'on règle en premier.
      setFactureActiveId(facturesChargees[0]?.facture_id ?? null);
      setDerniersReglements(reglements.slice(0, 6));
      // Un seul compte principal : il se présélectionne, l'agent n'a rien à
      // choisir là où il n'y a pas de choix.
      const principal = comptesCharges.find((compte) => compte.is_primary) ?? comptesCharges[0];
      if (principal) setCompteChoisi(principal.id);
    } catch (raison) {
      setErreur(messageErreurUtilisateur(raison, 'Impossible de charger la situation de cette société.'));
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
    return {
      affecte,
      nbRetenues: lignes.filter((ligne) => ligne.impute > 0).length,
      enExces: lignes.filter((ligne) => ligne.excede).length,
      detteApres: Math.max(0, auFranc(societeChoisie?.reste_du ?? 0) - affecte),
    };
  }, [lignes, societeChoisie]);

  /** Le virement vaut ce qu'on porte sur les factures, ni plus ni moins. */
  const montantVirement = totaux.affecte;

  const ligneActive = lignes.find((ligne) => ligne.facture.facture_id === factureActiveId) ?? null;

  /** Porte sur la facture ouverte la totalité de ce qu'elle peut recevoir. */
  const solderFactureActive = () => {
    if (!ligneActive) return;
    setImputations((actuelles) => ({
      ...actuelles,
      [ligneActive.facture.facture_id]: String(ligneActive.plafond),
    }));
    setErreur(null);
  };

  const retirerImputation = (factureId: string) => {
    setImputations((actuelles) => {
      const suite = { ...actuelles };
      delete suite[factureId];
      return suite;
    });
  };

  /** Solde d'un geste toutes les factures ouvertes de la société. */
  const toutSolder = () => {
    setImputations(Object.fromEntries(
      factures
        .map((facture) => [facture.facture_id, String(auFranc(facture.reste_a_affecter))])
        .filter(([, montant]) => Number(montant) > 0)
    ));
    setErreur(null);
  };

  const validerSaisie = (): string | null => {
    if (!societeChoisie) return 'Choisissez la société bénéficiaire.';
    if (!compte) return 'Aucun compte bancaire actif n’est rattaché à cette société.';
    if (totaux.enExces > 0) {
      return `${totaux.enExces} imputation(s) dépassent le reste imputable de leur facture.`;
    }
    if (montantVirement <= 0) {
      return 'Portez un montant sur au moins une facture : le virement en est la somme.';
    }
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
        montant_fcfa: montantVirement,
        affectations: lignes
          .filter((ligne) => ligne.impute > 0)
          .map((ligne) => ({ facture_id: ligne.facture.facture_id, montant: ligne.impute })),
        date_execution_prevue: entete.date_execution_prevue || null,
        objet: entete.objet || null,
        observations: entete.observations || null,
      });
      navigate(`/achats/reglements?prepare=${resultat?.r_reference ?? ''}`);
    } catch (raison) {
      setErreur(messageErreurUtilisateur(raison, 'Le règlement n’a pas pu être préparé.'));
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
              <output>{montantVirement > 0 ? formaterFcfa(montantVirement) : '—'}</output>
              {montantVirement > 0 && <small>{montantEnLettres(montantVirement)}</small>}
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
                          <p>Date d’exécution, objet et observations.</p>
                        </div>
                      </header>
                      <div className="site-form__section-body">
                        <div className="reglement-form__virement">
                          <div className="reglement-form__total">
                            <span>Montant du virement, somme des imputations ({societeChoisie.devise})</span>
                            <output>{montantVirement > 0 ? formaterMontant(montantVirement) : '0'}</output>
                            {montantVirement > 0 && <em>{montantEnLettres(montantVirement)}</em>}
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
                        </div>

                        <div className="reglement-form__virement-suivi">
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
                          <p>Le montant porté sur chaque facture forme le total du virement.</p>
                        </div>
                      </header>
                      <div className="site-form__section-body">
                        <dl className="reglement-form__synthese">
                          <div>
                            <dt>Montant du virement</dt>
                            <dd className={montantVirement > 0 ? 'est-complet' : undefined}>
                              {formaterFcfa(montantVirement)}
                            </dd>
                          </div>
                          <div>
                            <dt>Factures retenues</dt>
                            <dd>{totaux.nbRetenues} sur {factures.length}</dd>
                          </div>
                          <div>
                            <dt>Dette avant virement</dt>
                            <dd>{formaterFcfa(societeChoisie.reste_du)}</dd>
                          </div>
                          <div>
                            <dt>Dette après virement</dt>
                            <dd>{formaterFcfa(totaux.detteApres)}</dd>
                          </div>
                        </dl>

                        <div className="reglement-form__outils">
                          <button type="button" className="reglement-form__voir" onClick={toutSolder}>
                            <ShieldCheck aria-hidden="true" /> Solder toutes les factures
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
                        ) : !ligneActive ? (
                          <p className="reglement-form__vide" style={{ padding: 0 }}>
                            Choisissez une facture dans la liste « Factures liées aux achats », à droite.
                          </p>
                        ) : (
                          <article className="reglement-form__selection">
                            <header>
                              <div>
                                <strong>{ligneActive.facture.numero_facture}</strong>
                                <em>
                                  Émise le {formaterDate(ligneActive.facture.date_emission)},
                                  échéance le {formaterDate(ligneActive.facture.date_echeance)}
                                </em>
                              </div>
                              <span className={`reglement-form__age est-${ligneActive.facture.tranche}`}>
                                {LIBELLES_TRANCHE[ligneActive.facture.tranche as TrancheAge]
                                  ?? ligneActive.facture.tranche}
                              </span>
                              <button
                                type="button" className="reglement-form__voir"
                                onClick={() => setFactureOuverte(ligneActive.facture)}
                              >
                                <Eye aria-hidden="true" /> Voir la facture
                              </button>
                            </header>

                            <dl className="reglement-form__chiffres">
                              <div>
                                <dt>Montant TTC</dt>
                                <dd>{formaterFcfa(ligneActive.facture.montant_ttc)}</dd>
                              </div>
                              <div>
                                <dt>Déjà payé</dt>
                                <dd>{formaterFcfa(ligneActive.facture.montant_paye)}</dd>
                              </div>
                              <div>
                                <dt>Reste dû</dt>
                                <dd>{formaterFcfa(ligneActive.facture.reste_du)}</dd>
                              </div>
                              <div className="est-imputable">
                                <dt title="Reste dû, diminué de ce que retiennent les règlements déjà préparés.">
                                  Imputable
                                </dt>
                                <dd>{formaterFcfa(ligneActive.plafond)}</dd>
                              </div>
                            </dl>

                            <div className="reglement-form__saisie">
                              <div className="site-form__field">
                                <label className="site-form__label" htmlFor="imputation">
                                  Montant à imputer sur cette facture, en {societeChoisie.devise}
                                </label>
                                <input
                                  id="imputation" type="number" min={0} max={ligneActive.plafond}
                                  step={1000}
                                  aria-invalid={ligneActive.excede ? true : undefined}
                                  value={imputations[ligneActive.facture.facture_id] ?? ''}
                                  onChange={(evenement) => setImputations((actuelles) => ({
                                    ...actuelles,
                                    [ligneActive.facture.facture_id]: evenement.target.value,
                                  }))}
                                  placeholder="0"
                                />
                                {ligneActive.excede && (
                                  <small className="is-warning">
                                    Dépasse de {formaterFcfa(ligneActive.impute - ligneActive.plafond)}
                                    {' '}ce que cette facture peut recevoir.
                                  </small>
                                )}
                              </div>

                              <div className="reglement-form__saisie-gestes">
                                <button
                                  type="button" className="reglement-form__voir"
                                  onClick={solderFactureActive}
                                >
                                  <CheckCircle2 aria-hidden="true" /> Solder cette facture
                                </button>
                                <button
                                  type="button" className="reglement-form__voir"
                                  onClick={() => retirerImputation(ligneActive.facture.facture_id)}
                                  disabled={ligneActive.impute <= 0}
                                >
                                  <X aria-hidden="true" /> Retirer
                                </button>
                              </div>

                              <div className="reglement-form__apres">
                                <span>Solde de la facture après imputation</span>
                                <strong>{formaterFcfa(ligneActive.soldeApres)}</strong>
                              </div>
                            </div>
                          </article>
                        )}

                        {totaux.nbRetenues > 0 && (
                          <div className="reglement-form__retenues">
                            <h4>Imputations retenues</h4>
                            <div className="reglement-form__factures">
                              <table>
                                <thead>
                                  <tr>
                                    <th scope="col">Facture</th>
                                    <th scope="col">Échéance</th>
                                    <th scope="col" className="est-nombre">Reste dû (FCFA)</th>
                                    <th scope="col" className="est-nombre">Imputé (FCFA)</th>
                                    <th scope="col" className="est-nombre">Solde après (FCFA)</th>
                                    <th scope="col" aria-label="Retirer" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {lignes.filter((ligne) => ligne.impute > 0).map((ligne) => (
                                    <tr
                                      key={ligne.facture.facture_id}
                                      className={[
                                        'est-retenue',
                                        ligne.facture.facture_id === factureActiveId ? 'est-ouverte' : '',
                                      ].filter(Boolean).join(' ')}
                                    >
                                      <td>
                                        <button
                                          type="button" className="reglement-form__lien"
                                          onClick={() => setFactureActiveId(ligne.facture.facture_id)}
                                        >
                                          {ligne.facture.numero_facture}
                                        </button>
                                      </td>
                                      <td>{formaterDate(ligne.facture.date_echeance)}</td>
                                      <td className="est-nombre">{formaterMontant(ligne.facture.reste_du)}</td>
                                      <td className="est-nombre">{formaterMontant(ligne.impute)}</td>
                                      <td className="est-nombre">{formaterMontant(ligne.soldeApres)}</td>
                                      <td>
                                        <button
                                          type="button" className="reglement-form__retirer"
                                          onClick={() => retirerImputation(ligne.facture.facture_id)}
                                          aria-label={`Retirer l’imputation sur ${ligne.facture.numero_facture}`}
                                        >
                                          <X aria-hidden="true" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan={3}>Total imputé</td>
                                    <td className="est-nombre">{formaterMontant(totaux.affecte)}</td>
                                    <td className="est-nombre">{formaterMontant(totaux.detteApres)}</td>
                                    <td />
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
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
                    <strong>{formaterFcfa(montantVirement)}</strong>
                    <em>{montantEnLettres(montantVirement)}</em>
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
                    <div><dt>Objet</dt><dd>{entete.objet || '—'}</dd></div>
                  </dl>

                  <h4 style={{ margin: '22px 0 10px', fontSize: 12.5 }}>Factures imputées</h4>
                  <div className="reglement-form__factures">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Facture</th>
                          <th scope="col">Échéance</th>
                          <th scope="col" className="est-nombre">Solde avant (FCFA)</th>
                          <th scope="col" className="est-nombre">Imputé (FCFA)</th>
                          <th scope="col" className="est-nombre">Solde après (FCFA)</th>
                          <th scope="col" />
                        </tr>
                      </thead>
                      <tbody>
                        {lignes.filter((ligne) => ligne.impute > 0).map((ligne) => (
                          <tr key={ligne.facture.facture_id}>
                            <td><strong>{ligne.facture.numero_facture}</strong></td>
                            <td>{formaterDate(ligne.facture.date_echeance)}</td>
                            <td className="est-nombre">{formaterMontant(ligne.facture.reste_du)}</td>
                            <td className="est-nombre">{formaterMontant(ligne.impute)}</td>
                            <td className="est-nombre">{formaterMontant(ligne.soldeApres)}</td>
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
                          <td className="est-nombre">{formaterMontant(totaux.affecte)}</td>
                          <td className="est-nombre">{formaterMontant(totaux.detteApres)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

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
                  <p>
                    {factures.length === 0
                      ? 'Aucune facture imputable'
                      : `${factures.length} facture(s) · cliquez pour imputer`}
                  </p>
                </div>
              </header>
              {factures.length === 0 ? (
                <p className="reglement-form__vide">
                  {societeChoisie
                    ? 'Aucune facture imputable.'
                    : 'Choisissez une société pour voir ses factures.'}
                </p>
              ) : (
                <ul className="reglement-form__liste est-defilante est-cliquable">
                  {factures.map((facture) => {
                    const impute = auFranc(Number(imputations[facture.facture_id]) || 0);
                    return (
                      <li
                        key={facture.facture_id}
                        className={[
                          facture.facture_id === factureActiveId ? 'est-ouverte' : '',
                          impute > 0 ? 'est-retenue' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <button
                          type="button"
                          className="reglement-form__facture"
                          aria-pressed={facture.facture_id === factureActiveId}
                          onClick={() => setFactureActiveId(facture.facture_id)}
                        >
                          <span className="reglement-form__liste-tete">
                            <strong>{facture.numero_facture}</strong>
                            <span>{formaterFcfa(facture.reste_du)}</span>
                          </span>
                          <span className="reglement-form__liste-meta">
                            Échéance {formaterDate(facture.date_echeance)}
                            {' · '}
                            <span className={`reglement-form__age est-${facture.tranche}`}>
                              {LIBELLES_TRANCHE[facture.tranche as TrancheAge] ?? facture.tranche}
                            </span>
                          </span>
                          {impute > 0 && (
                            <span className="reglement-form__facture-impute">
                              Imputé : {formaterFcfa(impute)}
                            </span>
                          )}
                        </button>
                        <button
                          type="button" className="reglement-form__voir"
                          onClick={() => setFactureOuverte(facture)}
                        >
                          <Eye aria-hidden="true" /> Voir
                        </button>
                      </li>
                    );
                  })}
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
