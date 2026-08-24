import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, CircleDollarSign, Gavel, History,
  Pencil, RefreshCw, Scale, Send, Truck,
} from 'lucide-react';
import { AnalysesTeneur } from '@/components/contrats/AnalysesTeneur';
import { PiecesContractuelles } from '@/components/contrats/PiecesContractuelles';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section } from '@/components/ui/sn';
import { useMineWorkspace } from '@/hooks/useMineWorkspace';
import { errorMessage } from '@/lib/errorMessage';
import { contratsService, formaterFcfa, formaterQuantite, type Contrat } from '@/services/contratsService';
import {
  LIBELLES_CANAL,
  LIBELLES_IMPUTATION,
  LIBELLES_REGIME,
  LIBELLES_STATUT_ENLEVEMENT,
  LIBELLES_STATUT_REQUISITION,
  LIBELLES_TYPE_REQUISITION,
  PORTEE_REGIME,
  poidsNet,
  requisitionsService,
  TONS_STATUT_REQUISITION,
  type CanalNotification,
  type Enlevement,
  type ExecutionRequisition,
  type HistoriqueRequisition,
  type ImputationContractuelle,
  type NotificationRequisition,
  type Requisition,
  type StatutRequisition,
} from '@/services/requisitionsService';
import '@/pages/contrats/contrats.css';
import './requisitions.css';

/**
 * Dossier d'une réquisition, de l'acte juridique au paiement.
 *
 * Quatre faits distincts se lisent séparément sur cet écran, parce qu'ils ne
 * disent pas la même chose : l'accusé de réception de la notification,
 * les observations de la mine, sa contestation, et son accord lorsque le régime
 * l'exige. Les confondre ferait dire au système qu'une mine a consenti quand
 * elle n'a fait qu'accuser réception.
 */

export const STATUTS_A_MOTIVER: StatutRequisition[] = ['suspendue', 'annulee', 'contestee'];

const formaterDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR');
};

const formaterHorodatage = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : `${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

export function RequisitionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMine } = useMineWorkspace();

  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [execution, setExecution] = useState<ExecutionRequisition | null>(null);
  const [notifications, setNotifications] = useState<NotificationRequisition[]>([]);
  const [enlevements, setEnlevements] = useState<Enlevement[]>([]);
  const [historique, setHistorique] = useState<HistoriqueRequisition[]>([]);
  const [transitions, setTransitions] = useState<StatutRequisition[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);

  const [chargement, setChargement] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [commentaireMine, setCommentaireMine] = useState('');

  const [decision, setDecision] = useState<{ statut: StatutRequisition; motif: string } | null>(null);
  const [formNotification, setFormNotification] = useState<{
    canal: CanalNotification; destinataires: string; objet: string; contenu: string; preuve: string;
  } | null>(null);
  const [formEnlevement, setFormEnlevement] = useState<{
    date_prevue: string; lieu: string; equipe_sonasp: string; representants_mine: string;
    quantite_prevue_oz: string; moyens_transport: string; numeros_scelles: string;
    nombre_colis: string;
  } | null>(null);
  const [formImputation, setFormImputation] = useState<{
    imputation: ImputationContractuelle; contratId: string; motif: string;
  } | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    setChargement(true);
    setErreur(null);
    try {
      const fiche = await requisitionsService.requisition(id);
      if (!fiche) throw new Error('Cette réquisition n’existe pas ou a été supprimée.');
      setRequisition(fiche);

      const [exec, envois, operations, trace, suites, contratsActifs] = await Promise.all([
        requisitionsService.execution(id),
        requisitionsService.notifications(id),
        requisitionsService.enlevements(id),
        requisitionsService.historique(id),
        isMine ? Promise.resolve([]) : requisitionsService.transitions(fiche.statut),
        isMine ? Promise.resolve([]) : contratsService.lister({ statut: 'actif' }),
      ]);
      setExecution(exec);
      setNotifications(envois);
      setEnlevements(operations);
      setHistorique(trace);
      setTransitions(suites);
      setContrats(contratsActifs.filter(
        (contrat) => contrat.mining_company_id === fiche.mining_company_id
      ));
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger cette réquisition.'));
    } finally {
      setChargement(false);
    }
  }, [id, isMine]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const executer = async (nom: string, operation: () => Promise<string>) => {
    setAction(nom);
    setErreur(null);
    setMessage(null);
    try {
      setMessage(await operation());
      await charger();
    } catch (raison) {
      setErreur(errorMessage(raison, 'L’opération a échoué.'));
    } finally {
      setAction(null);
    }
  };

  const changerStatut = (statut: StatutRequisition, motif?: string) =>
    executer(`statut-${statut}`, async () => {
      if (!id) throw new Error('Réquisition inconnue.');
      await requisitionsService.changerStatut(id, statut, motif);
      setDecision(null);
      return `Réquisition portée à l’état « ${LIBELLES_STATUT_REQUISITION[statut]} ».`;
    });

  const envoyerNotification = () =>
    executer('notifier', async () => {
      if (!id || !formNotification) throw new Error('Réquisition inconnue.');
      await requisitionsService.notifier({
        requisitionId: id,
        canal: formNotification.canal,
        destinataires: formNotification.destinataires,
        objet: formNotification.objet,
        contenu: formNotification.contenu,
        preuveEnvoi: formNotification.preuve || null,
      });
      setFormNotification(null);
      return 'Notification consignée : contenu, destinataires et date sont conservés.';
    });

  const accuserReception = (notificationId: string) =>
    executer(`accuse-${notificationId}`, async () => {
      const nom = window.prompt('Nom de la personne qui accuse réception, du côté de la mine :');
      if (!nom || !nom.trim()) throw new Error('Le nom de la personne est nécessaire.');
      await requisitionsService.accuserReception(notificationId, nom.trim());
      return 'Accusé de réception consigné. Il ne vaut ni acceptation ni accord.';
    });

  const planifierEnlevement = () =>
    executer('enlevement', async () => {
      if (!id || !formEnlevement) throw new Error('Réquisition inconnue.');
      await requisitionsService.planifierEnlevement({
        requisition_id: id,
        date_prevue: formEnlevement.date_prevue || null,
        lieu: formEnlevement.lieu || null,
        equipe_sonasp: formEnlevement.equipe_sonasp || null,
        representants_mine: formEnlevement.representants_mine || null,
        quantite_prevue_oz: Number(formEnlevement.quantite_prevue_oz) || null,
        moyens_transport: formEnlevement.moyens_transport || null,
        numeros_scelles: formEnlevement.numeros_scelles || null,
        nombre_colis: Number(formEnlevement.nombre_colis) || null,
        statut: 'planifie',
      });
      setFormEnlevement(null);
      return 'Opération d’enlèvement programmée.';
    });

  const deciderImputation = () =>
    executer('imputation', async () => {
      if (!id || !formImputation) throw new Error('Réquisition inconnue.');
      await requisitionsService.deciderImputation({
        requisitionId: id,
        imputation: formImputation.imputation,
        contratId: formImputation.contratId || null,
        motif: formImputation.motif || null,
      });
      setFormImputation(null);
      return 'Décision d’imputation enregistrée, avec son motif et son auteur.';
    });

  const repondreCommeMine = (decisionMine: 'approuver' | 'contester') =>
    executer(`mine-${decisionMine}`, async () => {
      if (!id) throw new Error('Réquisition inconnue.');
      if (commentaireMine.trim().length < 5) {
        throw new Error('Ajoutez un commentaire d’au moins cinq caractères.');
      }
      await requisitionsService.repondreMine(id, decisionMine, commentaireMine);
      setCommentaireMine('');
      return decisionMine === 'approuver'
        ? 'Votre approbation a été transmise à la SONASP.'
        : 'Votre contestation a été transmise à la SONASP.';
    });

  const collecte = useMemo(
    () => enlevements
      .filter((operation) => ['realise', 'partiel'].includes(operation.statut))
      .reduce((somme, operation) => somme + Number(operation.quantite_constatee_oz || 0), 0),
    [enlevements]
  );

  const accordManquant = requisition?.regime_juridique === 'accord_requis'
    && requisition.accord_mine !== true;
  const reponseMineEnAttente = Boolean(
    isMine
      && requisition
      && ['notifiee', 'accusee'].includes(requisition.statut)
      && !requisition.observations_recues_le
      && !requisition.contestation_recue_le
      && !requisition.accord_recu_le
  );

  if (!chargement && !requisition) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page contrats-page">
          <EmptyState
            title="Réquisition introuvable"
            description="Cette réquisition n’existe pas ou a été supprimée."
            action={
              <button type="button" className="sn-btn" onClick={() => navigate('/requisitions')}>
                Retour au registre
              </button>
            }
          />
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="sn-page contrats-page requisitions-page">
        <PageHeader
          icon={Gavel}
          title={requisition ? requisition.objet : 'Réquisition'}
          subtitle={
            requisition
              ? `${requisition.reference} · ${requisition.mining_company?.name ?? 'Mine non nommée'} · ${LIBELLES_TYPE_REQUISITION[requisition.type_requisition]}`
              : ''
          }
          breadcrumb={[
            { label: 'Achats d’or' },
            { label: 'Réquisitions', to: '/requisitions' },
            { label: requisition?.reference || '…' },
          ]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/requisitions')}>
                <ArrowLeft aria-hidden="true" /> Retour
              </button>
              <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
                <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
              {!isMine && requisition && ['brouillon', 'verification_juridique'].includes(requisition.statut) && (
                <button
                  type="button" className="sn-btn"
                  onClick={() => navigate(`/requisitions/${requisition.id}/modifier`)}
                >
                  <Pencil aria-hidden="true" /> Modifier
                </button>
              )}
            </>
          }
        />

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
        {message && !erreur && <Note icon={CheckCircle2}>{message}</Note>}

        {requisition && (
          <>
            <div className="contrat-barre">
              <div className="contrat-barre__etat">
                <Badge tone={TONS_STATUT_REQUISITION[requisition.statut]}>
                  {LIBELLES_STATUT_REQUISITION[requisition.statut]}
                </Badge>
                <span>
                  {requisition.reference_acte || 'Acte non référencé'}
                  {requisition.date_signature_acte
                    && ` du ${formaterDate(requisition.date_signature_acte)}`}
                </span>
              </div>

              {!isMine && transitions.length > 0 && (
                <div className="contrat-barre__actions">
                  {transitions.map((statut) => (
                    <button
                      key={statut}
                      type="button"
                      className={`sn-btn${statut === 'executoire' || statut === 'autorisee' ? ' sn-btn--primary' : ''}`}
                      disabled={action !== null}
                      onClick={() => (STATUTS_A_MOTIVER.includes(statut)
                        ? setDecision({ statut, motif: '' })
                        : void changerStatut(statut))}
                    >
                      {LIBELLES_STATUT_REQUISITION[statut]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Le régime, rappelé en toutes lettres : c'est lui qui décide. */}
            <div className={`requisition-portee is-${requisition.regime_juridique}`} role="note">
              <strong>{LIBELLES_REGIME[requisition.regime_juridique]}.</strong>{' '}
              {PORTEE_REGIME[requisition.regime_juridique]}
            </div>

            {isMine && reponseMineEnAttente && (
              <section className="contrat-decision" aria-label="Répondre à la réquisition">
                <h3>Votre réponse à la SONASP</h3>
                <p>
                  Consultez l’acte et les pièces du dossier, puis laissez un commentaire avant
                  d’approuver ou de contester cette réquisition.
                </p>
                <label className="sn-field" htmlFor="commentaire-mine">
                  <span className="sn-field__label">Commentaire</span>
                  <textarea
                    id="commentaire-mine"
                    rows={3}
                    value={commentaireMine}
                    onChange={(evenement) => setCommentaireMine(evenement.target.value)}
                    placeholder="Votre décision et, si nécessaire, vos réserves"
                  />
                </label>
                <div className="contrat-decision__gestes">
                  <button
                    type="button"
                    className="sn-btn"
                    disabled={action !== null || commentaireMine.trim().length < 5}
                    onClick={() => void repondreCommeMine('contester')}
                  >
                    Contester
                  </button>
                  <button
                    type="button"
                    className="sn-btn sn-btn--primary"
                    disabled={action !== null || commentaireMine.trim().length < 5}
                    onClick={() => void repondreCommeMine('approuver')}
                  >
                    <CheckCircle2 aria-hidden="true" /> Approuver et transmettre
                  </button>
                </div>
              </section>
            )}

            {isMine && !reponseMineEnAttente && requisition.observations_mine && (
              <Note icon={CheckCircle2} tone={requisition.statut === 'contestee' ? 'warning' : 'success'}>
                Réponse transmise : {requisition.observations_mine}
              </Note>
            )}

            {accordManquant && requisition.statut !== 'annulee' && (
              <Note tone="warning" icon={AlertTriangle}>
                Ce régime subordonne l’exécution à l’accord de la mine. Tant que cet accord n’est
                pas enregistré, la réquisition ne peut pas devenir exécutoire — un accusé de
                réception n’en tient pas lieu.
              </Note>
            )}
          </>
        )}

        {!isMine && decision && (
          <section className="contrat-decision" aria-label="Motiver la décision">
            <h3>Motiver le passage à « {LIBELLES_STATUT_REQUISITION[decision.statut]} »</h3>
            <p>Cette décision se conserve dans l’historique, avec son auteur et sa date.</p>
            <textarea
              rows={3} value={decision.motif}
              onChange={(evenement) => setDecision({ ...decision, motif: evenement.target.value })}
              placeholder="Raison de la décision"
            />
            <div className="contrat-decision__gestes">
              <button type="button" className="sn-btn" onClick={() => setDecision(null)}>
                Renoncer
              </button>
              <button
                type="button" className="sn-btn sn-btn--primary"
                disabled={decision.motif.trim().length < 5 || action !== null}
                onClick={() => void changerStatut(decision.statut, decision.motif.trim())}
              >
                Confirmer
              </button>
            </div>
          </section>
        )}

        {/* ------------------------------------------------- Consolidation */}
        {execution && (
          <dl className="contrat-execution">
            <div>
              <dt>Quantité requise</dt>
              <dd>{formaterQuantite(execution.quantite_requise)}</dd>
            </div>
            <div>
              <dt>Collectée</dt>
              <dd>{formaterQuantite(execution.quantite_collectee)}</dd>
            </div>
            <div>
              <dt>Restant à enlever</dt>
              <dd>{formaterQuantite(execution.quantite_restante)}</dd>
            </div>
            <div>
              <dt>Achetée</dt>
              <dd>{formaterQuantite(execution.quantite_achetee)}</dd>
            </div>
            <div>
              <dt>Imputée au contrat</dt>
              <dd>{formaterQuantite(execution.quantite_imputee_contrat)}</dd>
            </div>
            <div>
              <dt>Montant facturé</dt>
              <dd>{formaterFcfa(execution.montant_facture_fcfa)}</dd>
            </div>
            <div>
              <dt>Solde à payer</dt>
              <dd className={execution.solde_a_payer_fcfa > 0 ? 'est-partiel' : 'est-complet'}>
                {formaterFcfa(execution.solde_a_payer_fcfa)}
              </dd>
            </div>
          </dl>
        )}

        {/* ----------------------------------------------- Notifications -- */}
        <Section
          id="notifications"
          icon={Send}
          tone="blue"
          title={`Notifications (${notifications.length})`}
          description="Ce qui a été envoyé à la mine, à qui, par quel canal, et ce qu’elle en a accusé."
        >
          {!isMine && requisition && !['brouillon', 'verification_juridique', 'validation_metier',
            'validation_direction', 'annulee'].includes(requisition.statut) && (
            <div className="contrat-gestes">
              <button
                type="button" className="sn-btn"
                onClick={() => setFormNotification({
                  canal: 'courrier_officiel',
                  destinataires: '',
                  objet: `Réquisition ${requisition.reference}`,
                  contenu: '',
                  preuve: '',
                })}
                disabled={action !== null}
              >
                <Send aria-hidden="true" /> Consigner une notification
              </button>
            </div>
          )}

          {formNotification && (
            <div className="requisition-formulaire">
              <div className="site-form__grid">
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="canal">Canal</label>
                  <select
                    id="canal" value={formNotification.canal}
                    onChange={(evenement) => setFormNotification({
                      ...formNotification, canal: evenement.target.value as CanalNotification,
                    })}
                  >
                    {(Object.keys(LIBELLES_CANAL) as CanalNotification[]).map((canal) => (
                      <option key={canal} value={canal}>{LIBELLES_CANAL[canal]}</option>
                    ))}
                  </select>
                </div>
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="destinataires">Destinataires</label>
                  <input
                    id="destinataires" value={formNotification.destinataires}
                    onChange={(evenement) => setFormNotification({
                      ...formNotification, destinataires: evenement.target.value,
                    })}
                    placeholder="Direction générale de la mine"
                  />
                </div>
                <div className="site-form__field is-wide">
                  <label className="site-form__label" htmlFor="objet-notif">Objet</label>
                  <input
                    id="objet-notif" value={formNotification.objet}
                    onChange={(evenement) => setFormNotification({
                      ...formNotification, objet: evenement.target.value,
                    })}
                  />
                </div>
                <div className="site-form__field is-wide">
                  <label className="site-form__label" htmlFor="contenu">
                    Contenu notifié
                  </label>
                  <textarea
                    id="contenu" rows={5} value={formNotification.contenu}
                    onChange={(evenement) => setFormNotification({
                      ...formNotification, contenu: evenement.target.value,
                    })}
                    placeholder="Texte intégral de la notification adressée à la mine"
                  />
                </div>
                <div className="site-form__field is-wide">
                  <label className="site-form__label" htmlFor="preuve">
                    Preuve d’envoi
                  </label>
                  <input
                    id="preuve" value={formNotification.preuve}
                    onChange={(evenement) => setFormNotification({
                      ...formNotification, preuve: evenement.target.value,
                    })}
                    placeholder="Numéro de bordereau, accusé postal, référence du courriel"
                  />
                </div>
              </div>
              <div className="contrat-decision__gestes">
                <button type="button" className="sn-btn" onClick={() => setFormNotification(null)}>
                  Renoncer
                </button>
                <button
                  type="button" className="sn-btn sn-btn--primary"
                  disabled={action !== null
                    || formNotification.destinataires.trim().length === 0
                    || formNotification.contenu.trim().length < 20}
                  onClick={() => void envoyerNotification()}
                >
                  Consigner
                </button>
              </div>
            </div>
          )}

          {notifications.length === 0 ? (
            <EmptyState
              title="Aucune notification"
              description="Une réquisition autorisée se notifie à la mine avant tout enlèvement."
            />
          ) : (
            <ul className="requisition-notifications">
              {notifications.map((envoi) => (
                <li key={envoi.id}>
                  <div className="requisition-notifications__tete">
                    <strong>{envoi.objet}</strong>
                    <Badge tone={envoi.accuse_le ? 'success' : 'warning'}>
                      {envoi.accuse_le ? 'Réception accusée' : 'En attente d’accusé'}
                    </Badge>
                  </div>
                  <p className="requisition-notifications__meta">
                    {LIBELLES_CANAL[envoi.canal]} · {envoi.destinataires} ·{' '}
                    envoyée le {formaterHorodatage(envoi.envoye_le)}
                  </p>
                  {envoi.preuve_envoi && (
                    <p className="requisition-notifications__meta">
                      Preuve d’envoi : {envoi.preuve_envoi}
                    </p>
                  )}
                  {envoi.accuse_le ? (
                    <p className="requisition-notifications__meta">
                      Accusée par {envoi.accuse_par} le {formaterHorodatage(envoi.accuse_le)}
                    </p>
                  ) : !isMine ? (
                    <button
                      type="button" className="sn-btn"
                      onClick={() => void accuserReception(envoi.id)}
                      disabled={action !== null}
                    >
                      Consigner l’accusé de réception
                    </button>
                  ) : (
                    <p className="requisition-notifications__meta">Réponse à transmettre depuis le bloc de décision.</p>
                  )}
                  <details className="requisition-notifications__contenu">
                    <summary>Contenu notifié</summary>
                    <pre>{envoi.contenu}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ------------------------------------------------- Enlèvements -- */}
        <Section
          id="enlevements"
          icon={Truck}
          tone="amber"
          title={`Enlèvements (${enlevements.length})`}
          description="Pesées, scellés et constats contradictoires de chaque opération."
        >
          {!isMine && requisition && ['executoire', 'enlevement_planifie', 'en_cours_enlevement']
            .includes(requisition.statut) && (
            <div className="contrat-gestes">
              <button
                type="button" className="sn-btn"
                onClick={() => setFormEnlevement({
                  date_prevue: '', lieu: requisition.lieu_enlevement ?? '',
                  equipe_sonasp: requisition.equipe ?? '', representants_mine: '',
                  quantite_prevue_oz: requisition.quantite_oz?.toString() ?? '',
                  moyens_transport: '', numeros_scelles: '', nombre_colis: '',
                })}
                disabled={action !== null}
              >
                <Truck aria-hidden="true" /> Programmer un enlèvement
              </button>
            </div>
          )}

          {formEnlevement && (
            <div className="requisition-formulaire">
              <div className="site-form__grid">
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="date-prevue">Date prévue</label>
                  <input
                    id="date-prevue" type="datetime-local" value={formEnlevement.date_prevue}
                    onChange={(evenement) => setFormEnlevement({
                      ...formEnlevement, date_prevue: evenement.target.value,
                    })}
                  />
                </div>
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="lieu">Lieu</label>
                  <input
                    id="lieu" value={formEnlevement.lieu}
                    onChange={(evenement) => setFormEnlevement({
                      ...formEnlevement, lieu: evenement.target.value,
                    })}
                  />
                </div>
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="quantite-prevue">
                    Quantité prévue, en onces
                  </label>
                  <input
                    id="quantite-prevue" type="number" min={0} step={0.0001}
                    value={formEnlevement.quantite_prevue_oz}
                    onChange={(evenement) => setFormEnlevement({
                      ...formEnlevement, quantite_prevue_oz: evenement.target.value,
                    })}
                  />
                </div>
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="colis">Nombre de colis</label>
                  <input
                    id="colis" type="number" min={0} step={1} value={formEnlevement.nombre_colis}
                    onChange={(evenement) => setFormEnlevement({
                      ...formEnlevement, nombre_colis: evenement.target.value,
                    })}
                  />
                </div>
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="equipe-sonasp">Équipe SONASP</label>
                  <input
                    id="equipe-sonasp" value={formEnlevement.equipe_sonasp}
                    onChange={(evenement) => setFormEnlevement({
                      ...formEnlevement, equipe_sonasp: evenement.target.value,
                    })}
                  />
                </div>
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="representants">
                    Représentants de la mine
                  </label>
                  <input
                    id="representants" value={formEnlevement.representants_mine}
                    onChange={(evenement) => setFormEnlevement({
                      ...formEnlevement, representants_mine: evenement.target.value,
                    })}
                  />
                </div>
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="transport-moyens">
                    Moyens de transport
                  </label>
                  <input
                    id="transport-moyens" value={formEnlevement.moyens_transport}
                    onChange={(evenement) => setFormEnlevement({
                      ...formEnlevement, moyens_transport: evenement.target.value,
                    })}
                  />
                </div>
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="scelles">Numéros de scellés</label>
                  <input
                    id="scelles" value={formEnlevement.numeros_scelles}
                    onChange={(evenement) => setFormEnlevement({
                      ...formEnlevement, numeros_scelles: evenement.target.value,
                    })}
                  />
                </div>
              </div>
              <div className="contrat-decision__gestes">
                <button type="button" className="sn-btn" onClick={() => setFormEnlevement(null)}>
                  Renoncer
                </button>
                <button
                  type="button" className="sn-btn sn-btn--primary"
                  disabled={action !== null}
                  onClick={() => void planifierEnlevement()}
                >
                  Programmer
                </button>
              </div>
            </div>
          )}

          {enlevements.length === 0 ? (
            <EmptyState
              title="Aucun enlèvement programmé"
              description="L’enlèvement se programme une fois la réquisition exécutoire."
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Référence</th>
                    <th scope="col">Date</th>
                    <th scope="col">Lieu</th>
                    <th scope="col" className="sn-table__num">Colis</th>
                    <th scope="col" className="sn-table__num">Poids net (g)</th>
                    <th scope="col" className="sn-table__num">Constaté (oz)</th>
                    <th scope="col">Constat</th>
                    <th scope="col">État</th>
                  </tr>
                </thead>
                <tbody>
                  {enlevements.map((operation) => (
                    <tr key={operation.id}>
                      <td><strong>{operation.reference}</strong></td>
                      <td>{formaterHorodatage(operation.date_reelle ?? operation.date_prevue)}</td>
                      <td>{operation.lieu || '—'}</td>
                      <td className="sn-table__num">{operation.nombre_colis ?? '—'}</td>
                      <td className="sn-table__num">
                        {operation.poids_net_g
                          ?? poidsNet(operation.poids_brut_g, operation.tare_g)
                          ?? '—'}
                      </td>
                      <td className="sn-table__num">
                        {operation.quantite_constatee_oz === null
                          ? '—'
                          : formaterQuantite(operation.quantite_constatee_oz)}
                      </td>
                      <td>
                        <Badge tone={operation.constat_contradictoire ? 'success' : 'warning'}>
                          {operation.constat_contradictoire ? 'Contradictoire' : 'Non contradictoire'}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={operation.statut === 'realise' ? 'success'
                          : operation.statut === 'annule' ? 'danger' : 'info'}>
                          {LIBELLES_STATUT_ENLEVEMENT[operation.statut]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>Total constaté</td>
                    <td className="sn-table__num">{formaterQuantite(collecte)}</td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>

        {/* ---------------------------------------------------- Analyses -- */}
        {!isMine && requisition && (
          <AnalysesTeneur
            requisitionId={requisition.id}
            miningCompanyId={requisition.mining_company_id}
            teneurDeclareeProposee={requisition.teneur_estimee_pct}
          />
        )}

        {/* ----------------------------------------------------- Pièces -- */}
        {requisition && (
          <PiecesContractuelles
            domaine="requisition"
            objetId={requisition.id}
            categorieAttendue="acte_juridique"
            modifiable={!isMine && !['cloturee', 'annulee'].includes(requisition.statut)}
          />
        )}

        {/* -------------------------------------------------- Imputation -- */}
        <Section
          id="imputation"
          icon={Scale}
          title="Imputation contractuelle"
          description="Ce que la quantité réquisitionnée vient déduire, ou non, d’un engagement."
          info={{
            titre: 'Pourquoi la décision est explicite',
            contenu:
              'Une quantité réquisitionnée peut venir en déduction d’un engagement contractuel, ou constituer une quantité exceptionnelle hors contrat. Le choix a des conséquences financières et contractuelles : il se décide, se justifie et se conserve, jamais par défaut.',
          }}
        >
          {requisition?.imputation_contractuelle ? (
            <div className="requisition-imputation">
              <div>
                <span>Règle retenue</span>
                <strong>{LIBELLES_IMPUTATION[requisition.imputation_contractuelle]}</strong>
              </div>
              <div>
                <span>Contrat</span>
                <strong>{requisition.contrat?.numero_contrat ?? 'Aucun'}</strong>
              </div>
              <div>
                <span>Décidée le</span>
                <strong>{formaterHorodatage(requisition.imputation_decidee_le)}</strong>
              </div>
              {requisition.imputation_motif && (
                <p className="requisition-imputation__motif">{requisition.imputation_motif}</p>
              )}
            </div>
          ) : (
            <EmptyState
              title="Aucune règle d’imputation retenue"
              description="Tant que la règle n’est pas décidée, la quantité collectée ne vient en déduction d’aucun engagement."
            />
          )}

          {!isMine && requisition && !['annulee', 'cloturee'].includes(requisition.statut) && (
            <div className="contrat-gestes">
              <button
                type="button" className="sn-btn"
                onClick={() => setFormImputation({
                  imputation: requisition.imputation_contractuelle ?? 'hors_contrat',
                  contratId: requisition.contrat_id ?? '',
                  motif: requisition.imputation_motif ?? '',
                })}
                disabled={action !== null}
              >
                <Scale aria-hidden="true" /> Décider de l’imputation
              </button>
            </div>
          )}

          {formImputation && (
            <div className="requisition-formulaire">
              <div className="site-form__grid">
                <div className="site-form__field">
                  <label className="site-form__label" htmlFor="regle">Règle</label>
                  <select
                    id="regle" value={formImputation.imputation}
                    onChange={(evenement) => setFormImputation({
                      ...formImputation,
                      imputation: evenement.target.value as ImputationContractuelle,
                    })}
                  >
                    {(Object.keys(LIBELLES_IMPUTATION) as ImputationContractuelle[]).map((regle) => (
                      <option key={regle} value={regle}>{LIBELLES_IMPUTATION[regle]}</option>
                    ))}
                  </select>
                </div>
                {formImputation.imputation !== 'hors_contrat' && (
                  <div className="site-form__field">
                    <label className="site-form__label" htmlFor="contrat-impute">Contrat</label>
                    <select
                      id="contrat-impute" value={formImputation.contratId}
                      onChange={(evenement) => setFormImputation({
                        ...formImputation, contratId: evenement.target.value,
                      })}
                    >
                      <option value="">Choisir un contrat actif</option>
                      {contrats.map((contrat) => (
                        <option key={contrat.id} value={contrat.id}>
                          {contrat.numero_contrat} — {contrat.intitule}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="site-form__field is-wide">
                  <label className="site-form__label" htmlFor="motif-imputation">
                    Justification
                  </label>
                  <textarea
                    id="motif-imputation" rows={3} value={formImputation.motif}
                    onChange={(evenement) => setFormImputation({
                      ...formImputation, motif: evenement.target.value,
                    })}
                  />
                </div>
              </div>
              <div className="contrat-decision__gestes">
                <button type="button" className="sn-btn" onClick={() => setFormImputation(null)}>
                  Renoncer
                </button>
                <button
                  type="button" className="sn-btn sn-btn--primary"
                  disabled={action !== null
                    || (formImputation.imputation !== 'hors_contrat' && !formImputation.contratId)}
                  onClick={() => void deciderImputation()}
                >
                  Enregistrer la décision
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ------------------------------------------- Réponse de la mine -- */}
        <Section
          id="reponse"
          icon={CircleDollarSign}
          tone="slate"
          title="Ce que la mine a répondu"
          description="Quatre faits distincts, qui ne se remplacent pas l’un l’autre."
        >
          <div className="requisition-reponse">
            <article>
              <h4>Accusé de réception</h4>
              <p>{requisition?.accuse_reception_le
                ? `Reçu le ${formaterHorodatage(requisition.accuse_reception_le)}${requisition.accuse_reception_par ? `, par ${requisition.accuse_reception_par}` : ''}.`
                : 'Aucun accusé enregistré.'}</p>
              <small>Constate la remise. Ne vaut ni acceptation, ni accord.</small>
            </article>
            <article>
              <h4>Observations</h4>
              <p>{requisition?.observations_mine || 'Aucune observation reçue.'}</p>
              <small>La mine peut s’exprimer sans que cela suspende la mesure.</small>
            </article>
            <article className={requisition?.contestation_motif ? 'est-alerte' : undefined}>
              <h4>Contestation</h4>
              <p>{requisition?.contestation_motif || 'Aucune contestation.'}</p>
              <small>
                {requisition?.contestation_recue_le
                  ? `Reçue le ${formaterHorodatage(requisition.contestation_recue_le)}.`
                  : 'Une contestation se consigne sans effacer la mesure.'}
              </small>
            </article>
            <article>
              <h4>Accord</h4>
              <p>
                {requisition?.regime_juridique !== 'accord_requis'
                  ? 'Sans objet sous ce régime.'
                  : requisition.accord_mine === true
                    ? `Accord donné le ${formaterHorodatage(requisition.accord_recu_le)}.`
                    : 'Aucun accord enregistré.'}
              </p>
              <small>
                Ne se renseigne que sous un régime qui l’exige : la base l’interdit ailleurs.
              </small>
            </article>
          </div>
        </Section>

        {/* -------------------------------------------------- Historique -- */}
        <Section
          id="historique"
          icon={History}
          title="Historique des décisions"
          description="Chaque changement d’état, son auteur, sa date et son motif."
        >
          {historique.length === 0 ? (
            <EmptyState
              title="Aucune décision enregistrée"
              description="Cette réquisition n’a pas changé d’état depuis sa création."
            />
          ) : (
            <ol className="contrat-historique">
              {historique.map((trace) => (
                <li key={trace.id}>
                  <div>
                    <strong>
                      {trace.statut_avant
                        ? `${LIBELLES_STATUT_REQUISITION[trace.statut_avant as StatutRequisition] ?? trace.statut_avant} → `
                        : ''}
                      {LIBELLES_STATUT_REQUISITION[trace.statut_apres as StatutRequisition] ?? trace.statut_apres}
                    </strong>
                    <small>{formaterHorodatage(trace.survenu_le)}</small>
                  </div>
                  {trace.motif && <p>{trace.motif}</p>}
                  {trace.commentaire && <p>{trace.commentaire}</p>}
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}

export default RequisitionDetails;
