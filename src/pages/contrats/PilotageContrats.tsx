import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BellRing, CheckCircle2, FileSignature, Gavel, RefreshCw,
  Scale, ShieldCheck, SlidersHorizontal, Truck,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  alertesContractuellesService,
  cheminAlerte,
  LIBELLES_GRAVITE,
  ORDRE_GRAVITE,
  TONS_GRAVITE,
  type Alerte,
  type Gravite,
  type ParametreAlerte,
} from '@/services/alertesContractuellesService';
import {
  contratsService,
  formaterFcfa,
  formaterNombre,
  formaterQuantite,
  type Contrat,
} from '@/services/contratsService';
import { requisitionsService, type Requisition } from '@/services/requisitionsService';
import './contrats.css';
import './pilotage.css';

/**
 * Pilotage des contrats et des réquisitions.
 *
 * Les alertes ne sont pas stockées : elles se calculent à la lecture, depuis
 * les seuils que la direction règle plus bas. Une table d'alertes matérialisées
 * finirait par montrer une alerte levée depuis une heure, ou par taire une
 * alerte apparue depuis.
 *
 * Chaque alerte mène à la pièce qui la lève : une alerte qu'on ne peut pas
 * traiter d'un clic finit ignorée.
 */

/** Les états d'un contrat qui pèsent sur l'engagement national. */
export const ETATS_ENGAGEANTS = ['actif', 'suspendu'] as const;

/** Réquisitions dont la matière n'est pas encore rentrée. */
export const ETATS_EN_COURS_REQUISITION = [
  'autorisee', 'notifiee', 'accusee', 'contestee', 'executoire',
  'enlevement_planifie', 'en_cours_enlevement',
] as const;

export function PilotageContrats() {
  const navigate = useNavigate();

  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [parametres, setParametres] = useState<ParametreAlerte[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reglages, setReglages] = useState(false);
  const [filtreGravite, setFiltreGravite] = useState<Gravite | 'all'>('all');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [listeAlertes, listeParametres, listeContrats, listeRequisitions] = await Promise.all([
        alertesContractuellesService.alertes(),
        alertesContractuellesService.parametres(),
        contratsService.lister(),
        requisitionsService.lister(),
      ]);
      setAlertes(listeAlertes);
      setParametres(listeParametres);
      setContrats(listeContrats);
      setRequisitions(listeRequisitions);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger le pilotage.'));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const reglerSeuil = async (cle: string, champs: Partial<ParametreAlerte>) => {
    setErreur(null);
    setMessage(null);
    try {
      await alertesContractuellesService.reglerSeuil(cle, champs);
      setMessage('Seuil enregistré. Les alertes suivent immédiatement.');
      await charger();
    } catch (raison) {
      setErreur(errorMessage(raison, 'Le seuil n’a pas pu être réglé.'));
    }
  };

  const cumuls = useMemo(() => {
    const actifs = contrats.filter((contrat) => contrat.statut === 'actif');
    const enCours = requisitions.filter((piece) =>
      (ETATS_EN_COURS_REQUISITION as readonly string[]).includes(piece.statut));
    return {
      contratsActifs: actifs.length,
      quantiteEngagee: actifs.reduce(
        (somme, contrat) => somme + Number(contrat.quantite_totale || 0), 0),
      enValidation: contrats.filter((contrat) => [
        'soumis', 'revue_juridique', 'validation_metier', 'validation_financiere', 'approuve',
      ].includes(contrat.statut)).length,
      requisitionsEnCours: enCours.length,
      quantiteRequise: enCours.reduce(
        (somme, piece) => somme + Number(piece.quantite_oz || 0), 0),
      bloquantes: alertes.filter((alerte) => alerte.gravite === 'critique').length,
    };
  }, [contrats, requisitions, alertes]);

  const parGravite = useMemo(() => {
    const groupes = new Map<Gravite, Alerte[]>();
    ORDRE_GRAVITE.forEach((gravite) => groupes.set(gravite, []));
    alertes.forEach((alerte) => groupes.get(alerte.gravite)?.push(alerte));
    return groupes;
  }, [alertes]);

  const affichees = filtreGravite === 'all'
    ? alertes
    : alertes.filter((alerte) => alerte.gravite === filtreGravite);

  return (
    <NationalDashboardLayout>
      <div className="sn-page contrats-page pilotage-page">
        <PageHeader
          icon={BellRing}
          title="Pilotage des engagements"
          subtitle="Ce qui appelle une décision sur les contrats, les réquisitions et les analyses."
          breadcrumb={[{ label: 'Achats d’or' }, { label: 'Pilotage' }]}
          info={{
            titre: 'Pourquoi les alertes ne sont pas stockées',
            contenu:
              'Elles se calculent à la lecture, depuis les seuils réglés plus bas. Une table d’alertes matérialisées exigerait un balayage périodique et finirait par montrer une alerte levée depuis une heure, ou par taire une alerte apparue depuis.',
          }}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
                <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
              <button
                type="button" className="sn-btn"
                onClick={() => setReglages((ouvert) => !ouvert)}
              >
                <SlidersHorizontal aria-hidden="true" /> Régler les seuils
              </button>
            </>
          }
        />

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
        {message && !erreur && <Note icon={CheckCircle2}>{message}</Note>}

        <StatGrid
          sober
          ariaLabel="Pilotage des engagements"
          items={[
            {
              label: 'Contrats actifs',
              value: formaterNombre(cumuls.contratsActifs),
              icon: ShieldCheck,
              tone: 'green',
              onClick: () => navigate('/contrats'),
            },
            {
              label: 'Quantité engagée',
              value: formaterQuantite(cumuls.quantiteEngagee),
              icon: FileSignature,
              tone: 'neutral',
            },
            {
              label: 'En validation',
              value: formaterNombre(cumuls.enValidation),
              icon: Scale,
              tone: cumuls.enValidation > 0 ? 'blue' : 'neutral',
            },
            {
              label: 'Réquisitions en cours',
              value: formaterNombre(cumuls.requisitionsEnCours),
              icon: Truck,
              tone: cumuls.requisitionsEnCours > 0 ? 'gold' : 'neutral',
              onClick: () => navigate('/requisitions'),
            },
            {
              label: 'Alertes bloquantes',
              value: formaterNombre(cumuls.bloquantes),
              icon: AlertTriangle,
              tone: cumuls.bloquantes > 0 ? 'red' : 'neutral',
              onClick: cumuls.bloquantes > 0 ? () => setFiltreGravite('critique') : undefined,
            },
          ]}
        />

        <Section
          id="alertes"
          icon={BellRing}
          tone={cumuls.bloquantes > 0 ? 'amber' : 'emerald'}
          title={`Alertes du moment (${alertes.length})`}
          description="Chaque ligne mène à la pièce qui la lève."
        >
          {alertes.length > 0 && (
            <div className="pilotage__filtres">
              <button
                type="button"
                className={`pilotage__filtre${filtreGravite === 'all' ? ' est-actif' : ''}`}
                onClick={() => setFiltreGravite('all')}
              >
                Toutes ({alertes.length})
              </button>
              {ORDRE_GRAVITE.map((gravite) => {
                const nombre = parGravite.get(gravite)?.length ?? 0;
                if (nombre === 0) return null;
                return (
                  <button
                    key={gravite}
                    type="button"
                    className={`pilotage__filtre is-${gravite}${filtreGravite === gravite ? ' est-actif' : ''}`}
                    onClick={() => setFiltreGravite(gravite)}
                  >
                    {LIBELLES_GRAVITE[gravite]} ({nombre})
                  </button>
                );
              })}
            </div>
          )}

          {chargement ? (
            <p className="production-page__loading">Chargement des alertes…</p>
          ) : affichees.length === 0 ? (
            <EmptyState
              title={alertes.length === 0 ? 'Rien n’appelle de décision' : 'Aucune alerte de ce niveau'}
              description={alertes.length === 0
                ? 'Aucun contrat n’approche de son terme, aucun engagement n’est en retard, aucune réquisition n’attend.'
                : 'Choisissez un autre niveau de gravité.'}
            />
          ) : (
            <ul className="pilotage__alertes">
              {affichees.map((alerte, rang) => (
                <li key={`${alerte.cle}-${alerte.objet_id}-${rang}`} className={`is-${alerte.gravite}`}>
                  <button
                    type="button"
                    onClick={() => navigate(cheminAlerte(alerte))}
                    aria-label={`Ouvrir ${alerte.reference}`}
                  >
                    <div className="pilotage__alerte-tete">
                      <strong>{alerte.libelle}</strong>
                      <Badge tone={TONS_GRAVITE[alerte.gravite]}>
                        {LIBELLES_GRAVITE[alerte.gravite]}
                      </Badge>
                    </div>
                    <p className="pilotage__alerte-piece">
                      {alerte.reference} · {alerte.partenaire}
                    </p>
                    <p className="pilotage__alerte-detail">{alerte.detail}</p>
                    {alerte.jours !== null && (
                      <small>
                        {alerte.jours >= 0
                          ? `Dans ${alerte.jours} jour(s)`
                          : `Depuis ${Math.abs(alerte.jours)} jour(s)`}
                      </small>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {reglages && (
          <Section
            id="seuils"
            icon={SlidersHorizontal}
            tone="slate"
            title="Seuils d’alerte"
            description="La direction décide de ce qui l’alerte, et à partir de quand."
          >
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Alerte</th>
                    <th scope="col">Domaine</th>
                    <th scope="col" className="sn-table__num">Seuil (jours)</th>
                    <th scope="col" className="sn-table__num">Seuil (%)</th>
                    <th scope="col">Gravité</th>
                    <th scope="col">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {parametres.map((parametre) => (
                    <tr key={parametre.cle}>
                      <td><strong>{parametre.libelle}</strong></td>
                      <td>
                        {parametre.domaine === 'contrat' ? 'Contrats'
                          : parametre.domaine === 'requisition' ? 'Réquisitions' : 'Analyses'}
                      </td>
                      <td className="sn-table__num">
                        {parametre.seuil_jours === null ? '—' : (
                          <input
                            type="number" min={0} step={1} className="pilotage__seuil"
                            defaultValue={parametre.seuil_jours}
                            onBlur={(evenement) => {
                              const valeur = Number(evenement.target.value);
                              if (valeur !== parametre.seuil_jours) {
                                void reglerSeuil(parametre.cle, { seuil_jours: valeur });
                              }
                            }}
                            aria-label={`Seuil en jours pour ${parametre.libelle}`}
                          />
                        )}
                      </td>
                      <td className="sn-table__num">
                        {parametre.seuil_pourcentage === null ? '—' : (
                          <input
                            type="number" min={0} max={100} step={0.1} className="pilotage__seuil"
                            defaultValue={parametre.seuil_pourcentage}
                            onBlur={(evenement) => {
                              const valeur = Number(evenement.target.value);
                              if (valeur !== parametre.seuil_pourcentage) {
                                void reglerSeuil(parametre.cle, { seuil_pourcentage: valeur });
                              }
                            }}
                            aria-label={`Seuil en pourcentage pour ${parametre.libelle}`}
                          />
                        )}
                      </td>
                      <td>
                        <select
                          className="pilotage__gravite"
                          defaultValue={parametre.gravite}
                          onChange={(evenement) =>
                            void reglerSeuil(parametre.cle, {
                              gravite: evenement.target.value as Gravite,
                            })}
                          aria-label={`Gravité de ${parametre.libelle}`}
                        >
                          {ORDRE_GRAVITE.map((gravite) => (
                            <option key={gravite} value={gravite}>{LIBELLES_GRAVITE[gravite]}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="pilotage__bascule">
                          <input
                            type="checkbox" checked={parametre.actif}
                            onChange={(evenement) =>
                              void reglerSeuil(parametre.cle, { actif: evenement.target.checked })}
                            aria-label={`Activer ${parametre.libelle}`}
                          />
                          <span>{parametre.actif ? 'Oui' : 'Non'}</span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        <Section
          id="requisitions"
          icon={Gavel}
          title="Réquisitions en cours"
          description="Quantités requises dont la matière n’est pas encore rentrée."
        >
          {requisitions.filter((piece) =>
            (ETATS_EN_COURS_REQUISITION as readonly string[]).includes(piece.statut)).length === 0 ? (
            <EmptyState
              title="Aucune réquisition en cours"
              description="Les réquisitions autorisées, notifiées ou exécutoires apparaîtront ici."
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Référence</th>
                    <th scope="col">Mine</th>
                    <th scope="col">Régime</th>
                    <th scope="col" className="sn-table__num">Quantité requise</th>
                    <th scope="col">État</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions
                    .filter((piece) =>
                      (ETATS_EN_COURS_REQUISITION as readonly string[]).includes(piece.statut))
                    .map((piece) => (
                      <tr
                        key={piece.id}
                        className="is-clickable"
                        onClick={() => navigate(`/requisitions/${piece.id}`)}
                      >
                        <td><strong>{piece.reference}</strong></td>
                        <td>{piece.mining_company?.name || '—'}</td>
                        <td>
                          {piece.regime_juridique === 'a_qualifier' ? 'À qualifier'
                            : piece.regime_juridique === 'accord_requis' ? 'Accord requis'
                              : 'Exécutoire'}
                        </td>
                        <td className="sn-table__num">
                          {formaterQuantite(piece.quantite_oz, piece.unite)}
                        </td>
                        <td>{piece.statut}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total requis</td>
                    <td className="sn-table__num">{formaterQuantite(cumuls.quantiteRequise)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>

        {contrats.length === 0 && requisitions.length === 0 && !chargement && (
          <Note icon={FileSignature}>
            Aucun contrat ni réquisition enregistré. Le pilotage se remplira dès le premier
            engagement pris. Les montants suivis y apparaîtront en{' '}
            {formaterFcfa(0).replace('0 ', '')}.
          </Note>
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default PilotageContrats;
