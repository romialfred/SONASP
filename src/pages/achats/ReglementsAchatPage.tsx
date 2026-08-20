import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Banknote, CheckCircle2, Link2, Plus, RefreshCw, Undo2, Wallet, X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  achatsIndustrielsService,
  LIBELLES_STATUT_FACTURE,
  LIBELLES_STATUT_REGLEMENT,
  MODES_REGLEMENT,
  type Affectation,
  type FactureAchat,
  type ReglementAchat,
  type Societe,
} from '@/services/achatsIndustrielsService';
import { simulerAffectationFifo } from '@/services/achatsIndustrielsCalculs';
import {
  formaterFcfa,
  LIBELLES_CYCLE,

  TONS_CYCLE,
  type StatutReglementCycle,
} from '@/services/reglementsAchatService';
import { francs } from './PlansAchatPage';
import { formaterDate } from './DemandesAchatPage';
import './achats.css';

/**
 * Règlements de la SONASP aux sociétés minières, et leur affectation.
 *
 * ══ LE POINT QUI STRUCTURE CET ÉCRAN ══
 * Un règlement n'appartient pas à une facture. Il est versé à une société, et
 * s'impute ensuite sur une ou plusieurs factures. C'est ce qui rend exprimables
 * l'acompte, le versement global couvrant plusieurs mois, et le montant qui
 * reste sans affectation.
 *
 * Les plafonds — ne pas affecter plus que le règlement, ne pas payer plus que le
 * reste dû — sont vérifiés en base sous verrou. L'écran les anticipe pour éviter
 * un aller-retour, il ne les remplace pas.
 */

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function ReglementsAchatPage() {
  const navigate = useNavigate();
  const [reglements, setReglements] = useState<ReglementAchat[]>([]);
  const [factures, setFactures] = useState<FactureAchat[]>([]);
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);

  const [chargement, setChargement] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [filtreSociete, setFiltreSociete] = useState('all');
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [reglementOuvert, setReglementOuvert] = useState<ReglementAchat | null>(null);
  const [saisieAffectation, setSaisieAffectation] = useState<Record<string, string>>({});

  const [saisie, setSaisie] = useState({
    mining_company_id: '',
    montant_fcfa: '',
    date_reglement: new Date().toISOString().slice(0, 10),
    mode_reglement: 'virement',
    banque: '',
    reference_bancaire: '',
    observations: '',
    affecter_fifo: true,
  });

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [listeReglements, listeFactures, listeSocietes] = await Promise.all([
        achatsIndustrielsService.listerReglements(filtreSociete),
        achatsIndustrielsService.listerFactures({ societe: filtreSociete }),
        achatsIndustrielsService.societesProductrices(),
      ]);
      setReglements(listeReglements);
      setFactures(listeFactures);
      setSocietes(listeSocietes);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les règlements.'));
    } finally {
      setChargement(false);
    }
  }, [filtreSociete]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const chargerAffectations = useCallback(async (reglement: ReglementAchat) => {
    try {
      setAffectations(await achatsIndustrielsService.affectationsDuReglement(reglement.id));
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de lire les affectations.'));
    }
  }, []);

  const cumuls = useMemo(() => {
    const vivants = reglements.filter((reglement) => !['annule', 'rejete'].includes(reglement.statut));
    const verse = vivants.reduce((somme, reglement) => somme + Number(reglement.montant_fcfa || 0), 0);
    const affecte = vivants.reduce((somme, reglement) => somme + Number(reglement.montant_affecte_fcfa || 0), 0);
    const resteDu = factures
      .filter((facture) => facture.statut !== 'annulee')
      .reduce((somme, facture) => somme + Number(facture.reste_du_fcfa || 0), 0);
    return { verse, affecte, nonAffecte: verse - affecte, resteDu };
  }, [reglements, factures]);

  /** Factures encore ouvertes de la société du règlement ouvert. */
  const facturesDuReglement = useMemo(() => {
    if (!reglementOuvert) return [];
    return factures
      .filter((facture) =>
        facture.mining_company_id === reglementOuvert.mining_company_id
        && facture.devise === reglementOuvert.devise
        && !['annulee', 'brouillon'].includes(facture.statut)
        && Number(facture.reste_du_fcfa || 0) > 0.005)
      .sort((a, b) => a.date_echeance.localeCompare(b.date_echeance));
  }, [factures, reglementOuvert]);

  const soldeOuvert = reglementOuvert
    ? Number(reglementOuvert.montant_fcfa || 0) - Number(reglementOuvert.montant_affecte_fcfa || 0)
    : 0;

  const apercuFifo = useMemo(() => {
    if (!reglementOuvert) return null;
    return simulerAffectationFifo(
      soldeOuvert,
      facturesDuReglement.map((facture) => ({
        id: facture.id,
        numero_facture: facture.numero_facture,
        date_echeance: facture.date_echeance,
        date_emission: facture.date_emission,
        reste_du_fcfa: Number(facture.reste_du_fcfa || 0),
      }))
    );
  }, [reglementOuvert, soldeOuvert, facturesDuReglement]);

  const executer = async (nom: string, operation: () => Promise<string>) => {
    setAction(nom);
    setErreur(null);
    setMessage(null);
    try {
      setMessage(await operation());
      await charger();
      if (reglementOuvert) {
        const rafraichi = (await achatsIndustrielsService.listerReglements(filtreSociete))
          .find((reglement) => reglement.id === reglementOuvert.id);
        if (rafraichi) {
          setReglementOuvert(rafraichi);
          await chargerAffectations(rafraichi);
        }
      }
    } catch (raison) {
      setErreur(errorMessage(raison, 'L’opération a échoué.'));
    } finally {
      setAction(null);
    }
  };

  const enregistrer = () =>
    executer('enregistrer', async () => {
      if (!saisie.mining_company_id) throw new Error('Sélectionnez la société minière bénéficiaire.');
      if (!(Number(saisie.montant_fcfa) > 0)) throw new Error('Le montant doit être supérieur à zéro.');

      const resultat = await achatsIndustrielsService.enregistrerReglement({
        mining_company_id: saisie.mining_company_id,
        montant_fcfa: Number(saisie.montant_fcfa),
        date_reglement: saisie.date_reglement,
        mode_reglement: saisie.mode_reglement,
        banque: saisie.banque || null,
        reference_bancaire: saisie.reference_bancaire || null,
        observations: saisie.observations || null,
        affecter_fifo: saisie.affecter_fifo,
      });
      setFormulaireOuvert(false);
      setSaisie((s) => ({ ...s, montant_fcfa: '', reference_bancaire: '', observations: '' }));

      const nonAffecte = Number(resultat?.solde_non_affecte || 0);
      return nonAffecte > 0.005
        ? `Règlement ${resultat?.reference} enregistré. ${francs(nonAffecte)} restent sans affectation.`
        : `Règlement ${resultat?.reference} enregistré et intégralement affecté.`;
    });

  const affecterFifo = (reglement: ReglementAchat) =>
    executer(`fifo-${reglement.id}`, async () => {
      const bilan = await achatsIndustrielsService.affecterFifo(reglement.id);
      return bilan.factures_soldees === 0
        ? 'Aucune facture ouverte à imputer pour cette société.'
        : `${bilan.factures_soldees} facture(s) imputée(s) pour ${francs(bilan.montant_affecte)}.`;
    });

  const affecterManuellement = (facture: FactureAchat) =>
    executer(`affecter-${facture.id}`, async () => {
      if (!reglementOuvert) throw new Error('Aucun règlement sélectionné.');
      const montant = Number(saisieAffectation[facture.id]);
      if (!(montant > 0)) throw new Error('Saisissez un montant supérieur à zéro.');

      await achatsIndustrielsService.affecter(reglementOuvert.id, facture.id, montant);
      setSaisieAffectation((actuels) => ({ ...actuels, [facture.id]: '' }));
      return `${francs(montant)} imputés sur la facture ${facture.numero_facture}.`;
    });

  const annulerAffectation = (affectation: Affectation) =>
    executer(`annuler-${affectation.id}`, async () => {
      const motif = window.prompt('Motif de l’annulation de cette affectation (5 caractères minimum) :');
      if (!motif || motif.trim().length < 5) throw new Error('L’annulation doit être motivée.');
      await achatsIndustrielsService.annulerAffectation(affectation.id, motif.trim());
      return 'Affectation annulée. Le montant redevient disponible sur le règlement.';
    });

  return (
    <NationalDashboardLayout>
      <div className="sn-page achats-page">
        <PageHeader
          icon={Wallet}
          title="Règlements aux sociétés minières"
          subtitle="Sommes versées par la SONASP et leur imputation sur les factures d’achat."
          breadcrumb={[{ label: 'Achats industriels' }, { label: 'Règlements' }]}
          info={{
            titre: 'Pourquoi un règlement n’est pas une facture',
            contenu:
              'La SONASP achète chaque mois et ne règle pas nécessairement chaque mois. Un versement peut couvrir plusieurs factures, une facture recevoir plusieurs versements, et un montant rester sans affectation en attendant.',
          }}
          actions={
            <>
              {/* La préparation d'un virement de plusieurs milliards a son
                  écran : un tiroir de six champs n'y suffisait pas. */}
              <button
                type="button" className="sn-btn sn-btn--primary"
                onClick={() => navigate('/achats/reglements/nouveau')}
              >
                <Plus aria-hidden="true" /> Préparer un règlement
              </button>
              <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
                <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
            </>
          }
        />

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
        {message && !erreur && <Note icon={CheckCircle2}>{message}</Note>}

        <StatGrid
          sober
          ariaLabel="Situation des règlements"
          items={[
            { label: 'Versé', value: francs(cumuls.verse), icon: Banknote, tone: 'neutral' },
            { label: 'Imputé', value: francs(cumuls.affecte), icon: Link2, tone: 'green' },
            { label: 'Sans affectation', value: francs(cumuls.nonAffecte), icon: Wallet, tone: 'gold' },
            { label: 'Reste dû aux mines', value: francs(cumuls.resteDu), icon: AlertTriangle, tone: 'red' },
          ]}
        />

        <Section
          id="reglements"
          icon={Wallet}
          title="Règlements enregistrés"
          description="Sélectionnez un règlement pour imputer son solde sur les factures ouvertes."
        >
          <div className="sn-grid sn-grid--3" style={{ marginBottom: 14 }}>
            <label className="sn-field">
              <span className="sn-field__label">Société minière</span>
              <select value={filtreSociete} onChange={(evenement) => setFiltreSociete(evenement.target.value)}>
                <option value="all">Toutes les sociétés</option>
                {societes.map((societe) => (
                  <option key={societe.id} value={societe.id}>{societe.name}</option>
                ))}
              </select>
            </label>
          </div>

          {chargement ? (
            <p className="production-page__loading">Chargement des règlements…</p>
          ) : reglements.length === 0 ? (
            <EmptyState
              title="Aucun règlement"
              description="Les règlements versés aux sociétés minières apparaîtront ici."
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Référence</th>
                    <th scope="col">Date</th>
                    <th scope="col">Société</th>
                    <th scope="col">Banque bénéficiaire</th>
                    <th scope="col" className="is-right">Montant</th>
                    <th scope="col" className="is-right">Imputé</th>
                    <th scope="col" className="is-right">Sans affectation</th>
                    <th scope="col">État</th>
                    <th scope="col">Imputation</th>
                  </tr>
                </thead>
                <tbody>
                  {reglements.map((reglement) => {
                    const solde = Number(reglement.montant_fcfa || 0) - Number(reglement.montant_affecte_fcfa || 0);
                    return (
                      <tr key={reglement.id}>
                        <td><strong>{reglement.reference_reglement}</strong></td>
                        <td>{formaterDate(reglement.date_reglement)}</td>
                        <td>{reglement.mining_company?.name || '—'}</td>
                        <td>
                          {reglement.banque || '—'}
                          {reglement.reference_bancaire && (
                            <>
                              <br />
                              <span style={{ fontSize: 10.5, color: 'var(--sn-muted)' }}>
                                {reglement.reference_bancaire}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="is-right">{formaterFcfa(reglement.montant_fcfa)}</td>
                        <td className="is-right">{formaterFcfa(reglement.montant_affecte_fcfa)}</td>
                        <td className="is-right">
                          {solde > 0.005 ? <strong>{francs(solde)}</strong> : '—'}
                        </td>
                        <td>
                          <Badge tone={TONS_CYCLE[reglement.statut as StatutReglementCycle] ?? 'neutral'}>
                            {LIBELLES_CYCLE[reglement.statut as StatutReglementCycle]
                              ?? LIBELLES_STATUT_REGLEMENT[reglement.statut]}
                          </Badge>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button" className="sn-btn" style={{ height: 28, fontSize: 11 }}
                              onClick={() => {
                                setReglementOuvert(reglement);
                                void chargerAffectations(reglement);
                              }}
                            >
                              <Link2 aria-hidden="true" /> Imputer
                            </button>
                            {solde > 0.005 && (
                              <button
                                type="button" className="sn-btn" style={{ height: 28, fontSize: 11 }}
                                onClick={() => void affecterFifo(reglement)}
                                disabled={action !== null}
                              >
                                Plus ancienne d’abord
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ------------------------------------------------ Enregistrement -- */}
        {formulaireOuvert && (
          <div className="achats-fenetre" role="dialog" aria-modal="true" aria-label="Enregistrer un règlement">
            <div className="achats-fenetre__voile" aria-hidden="true" onClick={() => setFormulaireOuvert(false)} />
            <div className="achats-fenetre__panneau">
              <header>
                <h3><Banknote aria-hidden="true" /> Enregistrer un règlement</h3>
                <button type="button" aria-label="Fermer" onClick={() => setFormulaireOuvert(false)}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="achats-fenetre__corps">
                <Field label="Société minière bénéficiaire" required htmlFor="societe">
                  <select
                    id="societe" className="sn-select" value={saisie.mining_company_id}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, mining_company_id: evenement.target.value }))}
                  >
                    <option value="">Choisir…</option>
                    {societes.map((societe) => (
                      <option key={societe.id} value={societe.id}>{societe.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Montant versé (FCFA)" required htmlFor="montant">
                  <input
                    id="montant" type="number" className="sn-input" min={0} step={1000}
                    value={saisie.montant_fcfa}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, montant_fcfa: evenement.target.value }))}
                  />
                </Field>

                <Field label="Date du règlement" required htmlFor="date">
                  <input
                    id="date" type="date" className="sn-input" value={saisie.date_reglement}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, date_reglement: evenement.target.value }))}
                  />
                </Field>

                <Field label="Mode de règlement" required htmlFor="mode">
                  <select
                    id="mode" className="sn-select" value={saisie.mode_reglement}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, mode_reglement: evenement.target.value }))}
                  >
                    {MODES_REGLEMENT.map((mode) => (
                      <option key={mode.valeur} value={mode.valeur}>{mode.libelle}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Banque" htmlFor="banque">
                  <input
                    id="banque" className="sn-input" value={saisie.banque}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, banque: evenement.target.value }))}
                  />
                </Field>

                <Field label="Référence bancaire" htmlFor="ref">
                  <input
                    id="ref" className="sn-input" value={saisie.reference_bancaire}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, reference_bancaire: evenement.target.value }))}
                  />
                </Field>

                <Field label="Observations" wide htmlFor="obs">
                  <textarea
                    id="obs" className="sn-input" rows={3} value={saisie.observations}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, observations: evenement.target.value }))}
                  />
                </Field>

                <label className="sn-field sn-field--wide" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox" checked={saisie.affecter_fifo}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, affecter_fifo: evenement.target.checked }))}
                  />
                  <span className="sn-field__label" style={{ margin: 0 }}>
                    Imputer aussitôt sur les factures les plus anciennes
                  </span>
                </label>
              </div>

              <footer>
                <button type="button" className="sn-btn" onClick={() => setFormulaireOuvert(false)}>Annuler</button>
                <button
                  type="button" className="sn-btn sn-btn--primary"
                  onClick={() => void enregistrer()} disabled={action !== null}
                >
                  {action === 'enregistrer' ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------- Imputation -- */}
        {reglementOuvert && (
          <div className="achats-fenetre" role="dialog" aria-modal="true" aria-label="Imputer le règlement">
            <div className="achats-fenetre__voile" aria-hidden="true" onClick={() => setReglementOuvert(null)} />
            <div className="achats-fenetre__panneau">
              <header>
                <h3><Link2 aria-hidden="true" /> {reglementOuvert.reference_reglement}</h3>
                <button type="button" aria-label="Fermer" onClick={() => setReglementOuvert(null)}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="achats-fenetre__corps">
                <dl className="achats-synthese" style={{ position: 'static' }}>
                  <div className="achats-synthese__poste">
                    <dt>Montant versé</dt>
                    <dd>{francs(reglementOuvert.montant_fcfa)}</dd>
                  </div>
                  <div className="achats-synthese__poste">
                    <dt>Déjà imputé</dt>
                    <dd>{francs(reglementOuvert.montant_affecte_fcfa)}</dd>
                  </div>
                  <div className="achats-synthese__poste">
                    <dt>Disponible</dt>
                    <dd className={soldeOuvert > 0.005 ? 'est-ecart' : 'est-conforme'}>{francs(soldeOuvert)}</dd>
                  </div>
                </dl>

                {apercuFifo && soldeOuvert > 0.005 && apercuFifo.affectations.length > 0 && (
                  <Note tone="info" icon={Link2}>
                    Imputation automatique : {apercuFifo.affectations.length} facture(s) seraient soldées,{' '}
                    {francs(apercuFifo.soldeNonAffecte)} resteraient disponibles.
                  </Note>
                )}

                <h4 style={{ margin: '14px 0 8px', fontSize: 13 }}>Factures ouvertes</h4>
                {facturesDuReglement.length === 0 ? (
                  <EmptyState
                    title="Aucune facture ouverte"
                    description="Cette société n’a plus de facture à régler ; le solde reste disponible."
                  />
                ) : (
                  <div className="sn-table-wrap">
                    <table className="sn-table">
                      <thead>
                        <tr>
                          <th scope="col">Facture</th>
                          <th scope="col">Échéance</th>
                          <th scope="col" className="is-right">Reste dû</th>
                          <th scope="col" className="is-right">À imputer</th>
                          <th scope="col" />
                        </tr>
                      </thead>
                      <tbody>
                        {facturesDuReglement.map((facture) => (
                          <tr key={facture.id}>
                            <td>
                              <strong>{facture.numero_facture}</strong>
                              <br />
                              <span style={{ fontSize: 11, color: 'var(--sn-muted)' }}>
                                {LIBELLES_STATUT_FACTURE[facture.statut]}
                              </span>
                            </td>
                            <td>{formaterDate(facture.date_echeance)}</td>
                            <td className="is-right">{francs(facture.reste_du_fcfa)}</td>
                            <td className="is-right">
                              <input
                                type="number" min={0} step={1000} className="sn-input"
                                style={{ height: 30, textAlign: 'right', minWidth: 120 }}
                                aria-label={`Montant à imputer sur ${facture.numero_facture}`}
                                value={saisieAffectation[facture.id] ?? ''}
                                placeholder={String(Math.min(soldeOuvert, Number(facture.reste_du_fcfa || 0)))}
                                onChange={(evenement) => setSaisieAffectation((actuels) => ({
                                  ...actuels, [facture.id]: evenement.target.value,
                                }))}
                              />
                            </td>
                            <td>
                              <button
                                type="button" className="sn-btn" style={{ height: 28, fontSize: 11 }}
                                onClick={() => void affecterManuellement(facture)}
                                disabled={action !== null || soldeOuvert <= 0.005}
                              >
                                Imputer
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h4 style={{ margin: '18px 0 8px', fontSize: 13 }}>Imputations de ce règlement</h4>
                {affectations.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--sn-muted)' }}>Aucune imputation pour l’instant.</p>
                ) : (
                  <div className="sn-table-wrap">
                    <table className="sn-table">
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col" className="is-right">Montant</th>
                          <th scope="col">Mode</th>
                          <th scope="col">État</th>
                          <th scope="col" />
                        </tr>
                      </thead>
                      <tbody>
                        {affectations.map((affectation) => (
                          <tr key={affectation.id}>
                            <td>{formaterDate(affectation.date_affectation)}</td>
                            <td className="is-right">{francs(affectation.montant_affecte_fcfa)}</td>
                            <td>
                              {affectation.mode_affectation === 'automatique_fifo'
                                ? 'Automatique' : 'Manuelle'}
                            </td>
                            <td>
                              <Badge tone={affectation.statut === 'active' ? 'success' : 'neutral'}>
                                {affectation.statut === 'active' ? 'Active' : 'Annulée'}
                              </Badge>
                              {affectation.motif_annulation && (
                                <span className="achats-erreur-ligne">{affectation.motif_annulation}</span>
                              )}
                            </td>
                            <td>
                              {affectation.statut === 'active' && (
                                <button
                                  type="button" className="sn-btn" style={{ height: 28, fontSize: 11 }}
                                  onClick={() => void annulerAffectation(affectation)}
                                  disabled={action !== null}
                                >
                                  <Undo2 aria-hidden="true" /> Annuler
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <footer>
                <button type="button" className="sn-btn" onClick={() => setReglementOuvert(null)}>Fermer</button>
                {soldeOuvert > 0.005 && (
                  <button
                    type="button" className="sn-btn sn-btn--primary"
                    onClick={() => void affecterFifo(reglementOuvert)}
                    disabled={action !== null}
                  >
                    Imputer sur les plus anciennes
                  </button>
                )}
              </footer>
            </div>
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default ReglementsAchatPage;

/** Réexport commode pour les écrans qui affichent un montant en francs. */
export { entier as formaterEntier };
