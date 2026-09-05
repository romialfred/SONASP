import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CalendarRange, CheckCircle2, CircleDollarSign, FileSignature,
  FilePlus, FlaskConical, Gavel, History, Pencil, RefreshCw, Target,
} from 'lucide-react';
import { AnalysesTeneur } from '@/components/contrats/AnalysesTeneur';
import { PiecesContractuelles } from '@/components/contrats/PiecesContractuelles';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section } from '@/components/ui/sn';
import { useMineWorkspace } from '@/hooks/useMineWorkspace';
import { messageErreurUtilisateur } from '@/lib/presentError';
import {
  contratsService,
  formaterFcfa,
  formaterNombre,
  formaterQuantite,
  LIBELLES_GRAVITE_DEFAUT,
  LIBELLES_METHODE_PRIX,
  LIBELLES_NATURE_DEFAUT,
  LIBELLES_PARTENAIRE,
  LIBELLES_PERIODICITE,
  LIBELLES_STATUT_CONTRAT,
  LIBELLES_STATUT_DEFAUT,
  LIBELLES_TYPE_CONTRAT,
  TONS_STATUT_CONTRAT,
  TONS_STATUT_DEFAUT,
  type Contrat,
  type DefautContrat,
  type DocumentContrat,
  type NatureDefaut,
  type EcheanceContrat,
  type ExecutionContrat,
  type HistoriqueContrat,
  type StatutContrat,
} from '@/services/contratsService';
import './contrats.css';

/**
 * Dossier d'un contrat de fourniture.
 *
 * L'exécution affichée ne vient d'aucun total stocké : `snp_contrat_execution`
 * la recompose à chaque lecture depuis les achats et les factures. Une quantité
 * livrée dans le circuit normal et une quantité réquisitionnée s'y distinguent
 * sans jamais se compter deux fois : c'est l'achat, source physique unique, qui
 * porte l'origine et la part imputée à l'engagement.
 */

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

/** Les décisions qui ferment une porte demandent un motif écrit. */
export const STATUTS_A_MOTIVER: StatutContrat[] = ['rejete', 'suspendu', 'resilie', 'annule'];

const estNatureDefaut = (value: string): value is NatureDefaut =>
  Object.prototype.hasOwnProperty.call(LIBELLES_NATURE_DEFAUT, value);

const estGraviteDefaut = (value: string): value is DefautContrat['gravite'] =>
  value === 'mineure' || value === 'majeure' || value === 'critique';

export function ContratDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMine, companyId } = useMineWorkspace();

  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [execution, setExecution] = useState<ExecutionContrat | null>(null);
  const [echeancier, setEcheancier] = useState<EcheanceContrat[]>([]);
  const [documents, setDocuments] = useState<DocumentContrat[]>([]);
  const [defauts, setDefauts] = useState<DefautContrat[]>([]);
  const [historique, setHistorique] = useState<HistoriqueContrat[]>([]);
  const [transitions, setTransitions] = useState<StatutContrat[]>([]);

  const [chargement, setChargement] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [decision, setDecision] = useState<{ statut: StatutContrat; motif: string } | null>(null);
  const [manquement, setManquement] = useState<{
    nature: NatureDefaut; partie: string; gravite: DefautContrat['gravite']; description: string;
    quantite: string; echeance: string; actions: string;
  } | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    setChargement(true);
    setErreur(null);
    try {
      const fiche = await contratsService.contrat(id, isMine ? companyId : undefined);
      if (!fiche) throw new Error('Ce contrat n’existe pas ou a été supprimé.');
      setContrat(fiche);

      const [exec, lignes, pieces, manquements, trace, suites] = await Promise.all([
        contratsService.execution(id),
        contratsService.echeancier(id),
        contratsService.documents(id),
        contratsService.defauts(id),
        contratsService.historique(id),
        isMine ? Promise.resolve([]) : contratsService.transitions(fiche.statut),
      ]);
      setExecution(exec);
      setEcheancier(lignes);
      setDocuments(pieces);
      setDefauts(manquements);
      setHistorique(trace);
      setTransitions(suites);
    } catch (raison) {
      setErreur(messageErreurUtilisateur(raison, 'Impossible de charger ce contrat.'));
    } finally {
      setChargement(false);
    }
  }, [companyId, id, isMine]);

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
      setErreur(messageErreurUtilisateur(raison, 'L’opération a échoué.'));
    } finally {
      setAction(null);
    }
  };

  const changerStatut = (statut: StatutContrat, motif?: string) =>
    executer(`statut-${statut}`, async () => {
      if (!id) throw new Error('Contrat inconnu.');
      await contratsService.changerStatut(id, statut, motif);
      setDecision(null);
      return `Contrat porté à l’état « ${LIBELLES_STATUT_CONTRAT[statut]} ».`;
    });

  /** Ouvre un manquement. La description est exigée : un défaut sans faits
   *  décrits ne se défend pas devant le partenaire. */
  const ouvrirManquement = () =>
    executer('manquement', async () => {
      if (!id || !manquement) throw new Error('Contrat inconnu.');
      const defaut = await contratsService.ouvrirDefaut({
        // La référence métier est attribuée par le déclencheur de numérotation.
        reference: '',
        contrat_id: id,
        nature: manquement.nature,
        partie_responsable: manquement.partie,
        gravite: manquement.gravite,
        description: manquement.description.trim(),
        quantite_concernee: Number(manquement.quantite) || null,
        echeance_correction: manquement.echeance || null,
        actions_correctives: manquement.actions || null,
      });
      setManquement(null);
      return `Manquement ${defaut.reference} ouvert.`;
    });

  const composerEcheancier = (ecraser: boolean) =>
    executer('echeancier', async () => {
      if (!id) throw new Error('Contrat inconnu.');
      const nombre = await contratsService.genererEcheancier(id, ecraser);
      return `${nombre} période(s) composée(s).`;
    });

  const defautsOuverts = useMemo(
    () => defauts.filter((defaut) => !['regularise', 'clos', 'annule'].includes(defaut.statut)),
    [defauts]
  );

  const contratSigneVerse = documents.some(
    (document) => document.categorie === 'contrat_signe' && document.statut === 'actif'
  );

  if (!chargement && !contrat) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page contrats-page">
          <EmptyState
            title="Contrat introuvable"
            description="Ce contrat n’existe pas ou a été supprimé."
            action={
              <button type="button" className="sn-btn" onClick={() => navigate('/contrats')}>
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
      <div className="sn-page contrats-page">
        <PageHeader
          icon={FileSignature}
          title={contrat ? contrat.intitule : 'Contrat de fourniture'}
          subtitle={
            contrat
              ? `${contrat.numero_contrat} · ${LIBELLES_TYPE_CONTRAT[contrat.type_contrat]} · ${LIBELLES_PARTENAIRE[contrat.partenaire_type]}`
              : ''
          }
          breadcrumb={[
            { label: isMine ? 'Relations avec la SONASP' : 'Achats d’or', to: isMine ? '/portail-mine' : undefined },
            { label: 'Contrats', to: '/contrats' },
            { label: contrat?.numero_contrat || '…' },
          ]}
          info={{
            titre: 'Comment l’exécution se compte',
            contenu:
              'Les quantités viennent des achats enregistrés, seule source physique d’or acheté. Chaque achat porte son origine — livraison contractuelle ou réquisition — et la part imputée à l’engagement. Une once ne peut donc pas être comptée deux fois.',
          }}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/contrats')}>
                <ArrowLeft aria-hidden="true" /> Retour
              </button>
              <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
                <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
              {!isMine && contrat && ['brouillon', 'rejete'].includes(contrat.statut) && (
                <button
                  type="button" className="sn-btn"
                  onClick={() => navigate(`/contrats/${contrat.id}/modifier`)}
                >
                  <Pencil aria-hidden="true" /> Modifier
                </button>
              )}
              {!isMine && contrat && ['actif', 'suspendu'].includes(contrat.statut)
                && contrat.type_contrat !== 'avenant' && (
                <button
                  type="button" className="sn-btn"
                  onClick={() => navigate(`/contrats/nouveau?parent=${contrat.id}`)}
                >
                  <FilePlus aria-hidden="true" /> Établir un avenant
                </button>
              )}
            </>
          }
        />

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
        {message && !erreur && <Note icon={CheckCircle2}>{message}</Note>}

        {contrat && (
          <div className="contrat-barre">
            <div className="contrat-barre__etat">
              <Badge tone={TONS_STATUT_CONTRAT[contrat.statut]}>
                {LIBELLES_STATUT_CONTRAT[contrat.statut]}
              </Badge>
              <span>
                {formaterDate(contrat.date_debut)} au {formaterDate(contrat.date_fin)}
                {contrat.date_signature && ` · signé le ${formaterDate(contrat.date_signature)}`}
              </span>
            </div>

            {!isMine && transitions.length > 0 && (
              <div className="contrat-barre__actions">
                {transitions.map((statut) => (
                  <button
                    key={statut}
                    type="button"
                    className={`sn-btn${statut === 'actif' || statut === 'approuve' ? ' sn-btn--primary' : ''}`}
                    disabled={action !== null}
                    onClick={() => (STATUTS_A_MOTIVER.includes(statut)
                      ? setDecision({ statut, motif: '' })
                      : void changerStatut(statut))}
                  >
                    {LIBELLES_STATUT_CONTRAT[statut]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {contrat?.motif_statut && STATUTS_A_MOTIVER.includes(contrat.statut) && (
          <Note tone="warning" icon={AlertTriangle}>
            Motif retenu : {contrat.motif_statut}
          </Note>
        )}

        {!isMine && decision && (
          <section className="contrat-decision" aria-label="Motiver la décision">
            <h3>Motiver le passage à « {LIBELLES_STATUT_CONTRAT[decision.statut]} »</h3>
            <p>Cette décision se conserve dans l’historique du contrat, avec son auteur.</p>
            <textarea
              rows={3}
              value={decision.motif}
              onChange={(evenement) => setDecision({ ...decision, motif: evenement.target.value })}
              placeholder="Raison de la décision, en quelques mots"
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

        {contrat?.statut === 'approuve' && !contratSigneVerse && (
          <Note tone="warning" icon={AlertTriangle}>
            Le contrat signé n’est pas versé au dossier. L’activation le demandera.
          </Note>
        )}

        {/* --------------------------------------------------- Exécution -- */}
        {execution && (
          <dl className="contrat-execution">
            <div>
              <dt>Quantité engagée</dt>
              <dd>{formaterQuantite(execution.quantite_totale, contrat?.unite)}</dd>
            </div>
            <div>
              <dt>Imputée sur l’engagement</dt>
              <dd>{formaterQuantite(execution.quantite_imputee, contrat?.unite)}</dd>
            </div>
            <div>
              <dt>Restant à collecter</dt>
              <dd>{formaterQuantite(execution.quantite_restante, contrat?.unite)}</dd>
            </div>
            <div>
              <dt>Taux d’exécution</dt>
              <dd className={
                execution.taux_execution === null ? undefined
                  : execution.taux_execution >= 100 ? 'est-complet' : 'est-partiel'
              }>
                {execution.taux_execution === null ? '—' : `${execution.taux_execution} %`}
              </dd>
            </div>
            <div>
              <dt>Dont réquisitionnée</dt>
              <dd>{formaterQuantite(execution.quantite_requisitionnee, contrat?.unite)}</dd>
            </div>
            <div>
              <dt>Hors engagement</dt>
              <dd>{formaterQuantite(execution.quantite_hors_contrat, contrat?.unite)}</dd>
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

        {execution && execution.quantite_en_retard > 0 && (
          <Note tone="warning" icon={AlertTriangle}>
            {formaterQuantite(execution.quantite_en_retard, contrat?.unite)} manquent sur des
            périodes déjà closes. Ouvrez un manquement si le retard n’est pas justifié.
          </Note>
        )}

        {/* -------------------------------------------------- Échéancier -- */}
        <Section
          id="echeancier"
          icon={CalendarRange}
          title={`Échéancier (${echeancier.length})`}
          description="Ce que le contrat engage, période par période. Le plan d’achat mensuel s’en sert."
        >
          {contrat && ['brouillon', 'soumis', 'revue_juridique', 'validation_metier',
            'validation_financiere'].includes(contrat.statut) && (
            <div className="contrat-gestes">
              <button
                type="button" className="sn-btn"
                onClick={() => void composerEcheancier(false)} disabled={action !== null}
              >
                <CalendarRange aria-hidden="true" /> Composer l’échéancier
              </button>
              {echeancier.length > 0 && (
                <button
                  type="button" className="sn-btn"
                  onClick={() => void composerEcheancier(true)} disabled={action !== null}
                >
                  <RefreshCw aria-hidden="true" /> Recomposer
                </button>
              )}
            </div>
          )}

          {echeancier.length === 0 ? (
            <EmptyState
              title="Aucune période"
              description="L’échéancier se compose depuis la périodicité et la quantité totale engagée."
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Rang</th>
                    <th scope="col">Période</th>
                    <th scope="col" className="sn-table__num">Quantité prévue</th>
                    <th scope="col" className="sn-table__num">Minimum garanti</th>
                    <th scope="col">Nature</th>
                  </tr>
                </thead>
                <tbody>
                  {echeancier.map((ligne) => (
                    <tr key={ligne.id}>
                      <td>{ligne.rang}</td>
                      <td>{formaterDate(ligne.periode_debut)} au {formaterDate(ligne.periode_fin)}</td>
                      <td className="sn-table__num">
                        {formaterQuantite(ligne.quantite_prevue, contrat?.unite)}
                      </td>
                      <td className="sn-table__num">
                        {ligne.quantite_minimale === null
                          ? '—'
                          : formaterQuantite(ligne.quantite_minimale, contrat?.unite)}
                      </td>
                      <td>
                        <Badge tone={ligne.nature === 'ferme' ? 'success' : 'neutral'}>
                          {ligne.nature === 'ferme' ? 'Ferme'
                            : ligne.nature === 'prevision' ? 'Prévision' : 'Option'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total engagé</td>
                    <td className="sn-table__num">
                      {formaterQuantite(
                        echeancier.reduce((somme, ligne) => somme + Number(ligne.quantite_prevue || 0), 0),
                        contrat?.unite
                      )}
                    </td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>

        {/* ----------------------------------------- Termes contractuels -- */}
        <Section
          id="termes"
          icon={FlaskConical}
          tone="blue"
          title="Termes retenus"
          description="Teneur, prix et règlement, tels que le contrat les fixe."
        >
          <div className="contrat-termes">
            <article>
              <h4><FlaskConical aria-hidden="true" /> Qualité</h4>
              <dl>
                <div>
                  <dt>Teneur de référence</dt>
                  <dd>{contrat?.teneur_reference_pct ? `${contrat.teneur_reference_pct} %` : '—'}</dd>
                </div>
                <div>
                  <dt>Teneur minimale</dt>
                  <dd>{contrat?.teneur_minimale_pct ? `${contrat.teneur_minimale_pct} %` : '—'}</dd>
                </div>
                <div>
                  <dt>Tolérance</dt>
                  <dd>{contrat?.teneur_tolerance_pct ?? '—'} point(s)</dd>
                </div>
                <div>
                  <dt>Résultat faisant foi</dt>
                  <dd>
                    {contrat?.teneur_faisant_foi === 'analyse_sonasp' ? 'Analyse de la SONASP'
                      : contrat?.teneur_faisant_foi === 'analyse_fournisseur' ? 'Analyse du fournisseur'
                        : contrat?.teneur_faisant_foi === 'laboratoire_independant' ? 'Laboratoire indépendant'
                          : 'Moyenne des deux analyses'}
                  </dd>
                </div>
                <div>
                  <dt>Laboratoire indépendant</dt>
                  <dd>{contrat?.laboratoire_independant || '—'}</dd>
                </div>
              </dl>
            </article>

            <article>
              <h4><CircleDollarSign aria-hidden="true" /> Prix</h4>
              <dl>
                <div>
                  <dt>Méthode</dt>
                  <dd>{contrat ? LIBELLES_METHODE_PRIX[contrat.methode_prix] : '—'}</dd>
                </div>
                {contrat?.methode_prix === 'fixe' && (
                  <div>
                    <dt>Prix de l’once</dt>
                    <dd>{formaterFcfa(contrat.prix_fixe_fcfa)}</dd>
                  </div>
                )}
                <div>
                  <dt>Source du cours</dt>
                  <dd>{contrat?.source_cours || '—'}</dd>
                </div>
                <div>
                  <dt>Prime / décote</dt>
                  <dd>{contrat?.prime_pct ?? 0} % / {contrat?.decote_pct ?? 0} %</dd>
                </div>
                <div>
                  <dt>Ajustement sur teneur</dt>
                  <dd>{contrat?.prix_ajuste_sur_teneur ? 'Oui' : 'Non'}</dd>
                </div>
              </dl>
            </article>

            <article>
              <h4><Target aria-hidden="true" /> Quantités</h4>
              <dl>
                <div>
                  <dt>Périodicité</dt>
                  <dd>{contrat ? LIBELLES_PERIODICITE[contrat.periodicite] : '—'}</dd>
                </div>
                <div>
                  <dt>Tolérance</dt>
                  <dd>{contrat?.tolerance_quantite_pct ?? 0} %</dd>
                </div>
                <div>
                  <dt>Dépassement admis</dt>
                  <dd>{contrat?.plafond_depassement_pct ?? 0} %</dd>
                </div>
                <div>
                  <dt>Report des reliquats</dt>
                  <dd>
                    {contrat?.report_reliquat === 'autorise' ? 'Autorisé'
                      : contrat?.report_reliquat === 'sur_accord' ? 'Sur accord' : 'Interdit'}
                  </dd>
                </div>
                <div>
                  <dt>Règlement</dt>
                  <dd>{contrat?.delai_paiement_jours ?? 0} jours</dd>
                </div>
              </dl>
            </article>
          </div>
        </Section>

        {/* ----------------------------------------------------- Défauts -- */}
        <Section
          id="defauts"
          icon={Gavel}
          tone="amber"
          title={`Manquements (${defauts.length})`}
          description="Écarts constatés de part et d’autre, et leur traitement."
        >
          {defauts.length === 0 ? (
            <EmptyState
              title="Aucun manquement constaté"
              description="Un manquement s’ouvre quand une obligation n’est pas tenue : absence de livraison, teneur insuffisante, retard de paiement."
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Référence</th>
                    <th scope="col">Nature</th>
                    <th scope="col">Partie</th>
                    <th scope="col">Gravité</th>
                    <th scope="col">Détecté le</th>
                    <th scope="col" className="sn-table__num">Quantité</th>
                    <th scope="col">État</th>
                  </tr>
                </thead>
                <tbody>
                  {defauts.map((defaut) => (
                    <tr key={defaut.id}>
                      <td><strong>{defaut.reference}</strong></td>
                      <td>{LIBELLES_NATURE_DEFAUT[defaut.nature]}</td>
                      <td>
                        {defaut.partie_responsable === 'fournisseur' ? 'Fournisseur'
                          : defaut.partie_responsable === 'sonasp' ? 'SONASP'
                            : defaut.partie_responsable === 'tiers' ? 'Tiers' : 'Indéterminée'}
                      </td>
                      <td>
                        <Badge tone={defaut.gravite === 'critique' ? 'danger'
                          : defaut.gravite === 'majeure' ? 'warning' : 'neutral'}>
                          {defaut.gravite === 'critique' ? 'Critique'
                            : defaut.gravite === 'majeure' ? 'Majeure' : 'Mineure'}
                        </Badge>
                      </td>
                      <td>{formaterDate(defaut.date_detection)}</td>
                      <td className="sn-table__num">
                        {defaut.quantite_concernee === null
                          ? '—'
                          : formaterQuantite(defaut.quantite_concernee, contrat?.unite)}
                      </td>
                      <td>
                        <Badge tone={TONS_STATUT_DEFAUT[defaut.statut]}>
                          {LIBELLES_STATUT_DEFAUT[defaut.statut]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isMine && contrat && !['brouillon', 'annule'].includes(contrat.statut) && (
            <div className="contrat-gestes" style={{ marginTop: 14 }}>
              <button
                type="button" className="sn-btn"
                onClick={() => setManquement({
                  nature: 'absence_livraison', partie: 'fournisseur', gravite: 'majeure',
                  description: '', quantite: '', echeance: '', actions: '',
                })}
                disabled={action !== null}
              >
                <Gavel aria-hidden="true" /> Ouvrir un manquement
              </button>
            </div>
          )}

          {manquement && (
            <div className="contrat-manquement">
              <h4>Constater un manquement</h4>
              <p>
                Décrivez les faits. Un manquement se défend devant le partenaire : sans faits
                décrits, il ne tient pas.
              </p>
              <div className="contrat-manquement__champs">
                <label className="sn-field">
                  <span className="sn-field__label">Nature</span>
                  <select
                    value={manquement.nature}
                    onChange={(evenement) => {
                      const nature = evenement.target.value;
                      if (estNatureDefaut(nature)) setManquement({ ...manquement, nature });
                    }}
                  >
                    {Object.entries(LIBELLES_NATURE_DEFAUT).map(([nature, libelle]) => (
                      <option key={nature} value={nature}>{libelle}</option>
                    ))}
                  </select>
                </label>
                <label className="sn-field">
                  <span className="sn-field__label">Partie responsable</span>
                  <select
                    value={manquement.partie}
                    onChange={(evenement) => setManquement({
                      ...manquement, partie: evenement.target.value,
                    })}
                  >
                    <option value="fournisseur">Le fournisseur</option>
                    <option value="sonasp">La SONASP</option>
                    <option value="tiers">Un tiers</option>
                    <option value="indeterminee">Indéterminée</option>
                  </select>
                </label>
                <label className="sn-field">
                  <span className="sn-field__label">Gravité</span>
                  <select
                    value={manquement.gravite}
                    onChange={(evenement) => {
                      const gravite = evenement.target.value;
                      if (estGraviteDefaut(gravite)) setManquement({ ...manquement, gravite });
                    }}
                  >
                    {Object.entries(LIBELLES_GRAVITE_DEFAUT).map(([valeur, libelle]) => (
                      <option key={valeur} value={valeur}>{libelle}</option>
                    ))}
                  </select>
                </label>
                <label className="sn-field">
                  <span className="sn-field__label">Quantité concernée ({contrat?.unite})</span>
                  <input
                    type="number" min={0} step={0.0001} value={manquement.quantite}
                    onChange={(evenement) => setManquement({
                      ...manquement, quantite: evenement.target.value,
                    })}
                  />
                </label>
                <label className="sn-field">
                  <span className="sn-field__label">Échéance de régularisation</span>
                  <input
                    type="date" value={manquement.echeance}
                    onChange={(evenement) => setManquement({
                      ...manquement, echeance: evenement.target.value,
                    })}
                  />
                </label>
                <label className="sn-field is-large">
                  <span className="sn-field__label">Description des faits</span>
                  <textarea
                    rows={3} value={manquement.description}
                    onChange={(evenement) => setManquement({
                      ...manquement, description: evenement.target.value,
                    })}
                    placeholder="Ce qui a été constaté, quand, et sur quelle quantité"
                  />
                </label>
                <label className="sn-field is-large">
                  <span className="sn-field__label">Actions correctives attendues</span>
                  <textarea
                    rows={2} value={manquement.actions}
                    onChange={(evenement) => setManquement({
                      ...manquement, actions: evenement.target.value,
                    })}
                  />
                </label>
              </div>
              <div className="contrat-decision__gestes">
                <button type="button" className="sn-btn" onClick={() => setManquement(null)}>
                  Renoncer
                </button>
                <button
                  type="button" className="sn-btn sn-btn--primary"
                  onClick={() => void ouvrirManquement()}
                  disabled={action !== null || manquement.description.trim().length < 10}
                >
                  Ouvrir le manquement
                </button>
              </div>
            </div>
          )}

          {defautsOuverts.length > 0 && (
            <Note tone="warning" icon={AlertTriangle}>
              {formaterNombre(defautsOuverts.length)} manquement(s) ouverts. Ils pèsent sur
              l’évaluation du contrat tant qu’ils ne sont pas régularisés ou clos.
            </Note>
          )}
        </Section>

        {/* --------------------------------------------------- Analyses -- */}
        {!isMine && contrat && (
          <AnalysesTeneur
            contratId={contrat.id}
            miningCompanyId={contrat.mining_company_id}
            teneurDeclareeProposee={contrat.teneur_reference_pct}
          />
        )}

        {/* --------------------------------------------------- Documents -- */}
        {contrat && (
          <PiecesContractuelles
            domaine="contrat"
            objetId={contrat.id}
            categorieAttendue="contrat_signe"
            modifiable={!isMine && !['cloture', 'annule', 'resilie'].includes(contrat.statut)}
          />
        )}

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
              description="Ce contrat n’a pas changé d’état depuis sa création."
            />
          ) : (
            <ol className="contrat-historique">
              {historique.map((trace) => (
                <li key={trace.id}>
                  <div>
                    <strong>
                      {trace.statut_avant
                        ? `${LIBELLES_STATUT_CONTRAT[trace.statut_avant as StatutContrat] ?? trace.statut_avant} → `
                        : ''}
                      {LIBELLES_STATUT_CONTRAT[trace.statut_apres as StatutContrat] ?? trace.statut_apres}
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

export default ContratDetails;
