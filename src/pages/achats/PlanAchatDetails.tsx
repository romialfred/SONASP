import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarRange, RefreshCw, Send, Sparkles, Target } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  achatsIndustrielsService,
  LIBELLES_STATUT_PLAN,
  libelleMois,
  type LignePlan,
  type PlanAchat,
} from '@/services/achatsIndustrielsService';
import {
  arrondirQuantite,
  repartirParPourcentage,
  repartirParQuantiteCible,
  validerLigne,
  valoriserLigne,
} from '@/services/achatsIndustrielsCalculs';
import { francs, montant, onces, TONS_STATUT } from './PlansAchatPage';
import './achats.css';

/**
 * Répartition d'un plan entre les mines.
 *
 * L'écran tient une grille éditable. Deux principes le gouvernent :
 *
 *   1. La base fait autorité. L'aperçu affiché pendant la saisie sert à décider,
 *      pas à enregistrer : chaque valeur persistée revient de PostgreSQL, où le
 *      montant estimé est recalculé par déclencheur.
 *   2. Un arbitrage individuel ne s'efface pas. Une ligne modifiée à la main est
 *      marquée, et une nouvelle application globale la préserve, sauf ordre
 *      explicite du contraire.
 */

const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Le lexique de la grille. Chaque colonne porte sa définition : en infobulle sur
 * son en-tête, et rassemblées dans le bandeau de la section.
 *
 * Trois notions se confondent facilement, et l'écart entre elles décide de ce
 * que la SONASP peut acheter :
 *
 *   déclarée  ce que la mine dit avoir produit ce mois-ci ;
 *   engagée   ce que d'autres achats retiennent déjà sur ce même mois ;
 *   assiette  la différence : ce qui reste achetable.
 */
const COLONNES_DEFINIES = [
  {
    titre: 'Déclarée (oz)',
    definition: 'Production que la mine a déclarée sur le mois, en onces d’or fin, déclarations annulées exclues.',
  },
  {
    titre: 'Validée (oz)',
    definition: 'Part de cette déclaration dont le contrôle est achevé. C’est un sous-ensemble de la déclarée.',
  },
  {
    titre: 'Titre (%)',
    definition: 'Part d’or fin dans le doré, en pourcentage de sa masse ; le reste est de l’argent et des impuretés. Les onces des autres colonnes sont déjà exprimées en or fin : le titre ne s’y applique pas une seconde fois.',
  },
  {
    titre: 'Engagée (oz)',
    definition: 'Quantité que d’autres achats retiennent déjà sur la production de ce mois.',
  },
  {
    titre: 'Assiette (oz)',
    definition: 'Déclarée moins engagée : les onces d’or fin que la SONASP peut encore acheter. Une once ne s’achète pas deux fois.',
  },
  {
    titre: 'À acheter (oz)',
    definition: 'Quantité que le plan propose d’acheter à cette mine.',
  },
  {
    titre: 'Part (%)',
    definition: 'Ce que la quantité à acheter représente dans l’assiette de la mine.',
  },
  {
    titre: 'Prix / oz (FCFA)',
    definition: 'Prix négocié de l’once pour cette mine sur ce mois.',
  },
  {
    titre: 'Montant (FCFA)',
    definition: 'Quantité à acheter multipliée par le prix de l’once.',
  },
] as const;

/** Avril, août et octobre commencent par une voyelle : « de » s'élide. */
const MOIS_A_VOYELLE = new Set([4, 8, 10]);
const duMois = (mois: number, annee: number) =>
  `${MOIS_A_VOYELLE.has(mois) ? 'd’' : 'de '}${libelleMois(mois).toLowerCase()} ${annee}`;

interface Brouillon {
  quantite: string;
  prix: string;
}

export function PlanAchatDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<PlanAchat | null>(null);
  const [lignes, setLignes] = useState<LignePlan[]>([]);
  const [brouillons, setBrouillons] = useState<Record<string, Brouillon>>({});
  const [chargement, setChargement] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [politique, setPolitique] = useState({ pourcentage: '', prix: '' });

  const charger = useCallback(async () => {
    if (!id) return;
    setChargement(true);
    setErreur(null);
    try {
      const [planCharge, lignesChargees] = await Promise.all([
        achatsIndustrielsService.plan(id),
        achatsIndustrielsService.lignesDuPlan(id),
      ]);
      setPlan(planCharge);
      setLignes(lignesChargees);
      setBrouillons(Object.fromEntries(lignesChargees.map((ligne) => [
        ligne.id,
        { quantite: String(ligne.quantite_proposee_oz ?? 0), prix: String(ligne.prix_once_fcfa ?? 0) },
      ])));
      setPolitique({
        pourcentage: planCharge?.pourcentage_global ? String(planCharge.pourcentage_global) : '',
        prix: planCharge?.prix_once_global_fcfa ? String(planCharge.prix_once_global_fcfa) : '',
      });
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger ce plan.'));
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const modifiable = plan ? ['brouillon', 'pret_soumission'].includes(plan.statut) : false;

  /** Aperçu vivant : ce que l'utilisateur est en train de composer. */
  const apercu = useMemo(() => {
    return lignes.map((ligne) => {
      const brouillon = brouillons[ligne.id];
      const quantite = arrondirQuantite(Number(brouillon?.quantite ?? ligne.quantite_proposee_oz) || 0);
      const prix = Number(brouillon?.prix ?? ligne.prix_once_fcfa) || 0;
      const eligible = Number(ligne.production_eligible_oz) || 0;
      return {
        ligne,
        quantite,
        prix,
        eligible,
        montant: valoriserLigne(quantite, prix),
        part: eligible > 0 ? (quantite * 100) / eligible : null,
        probleme: validerLigne({
          quantite_proposee_oz: quantite,
          production_eligible_oz: eligible,
          prix_once_fcfa: prix,
        }),
        modifie:
          Math.abs(quantite - Number(ligne.quantite_proposee_oz || 0)) > 1e-6
          || Math.abs(prix - Number(ligne.prix_once_fcfa || 0)) > 1e-6,
      };
    });
  }, [lignes, brouillons]);

  const totaux = useMemo(() => {
    const quantite = apercu.reduce((somme, item) => somme + item.quantite, 0);
    const total = apercu.reduce((somme, item) => somme + item.montant, 0);
    const eligible = apercu.reduce((somme, item) => somme + item.eligible, 0);
    const cible = Number(plan?.quantite_cible_oz || 0);
    return {
      quantite: arrondirQuantite(quantite),
      montant: total,
      eligible: arrondirQuantite(eligible),
      part: eligible > 0 ? (quantite * 100) / eligible : 0,
      ecart: plan?.mode_repartition === 'quantite_cible' ? arrondirQuantite(quantite - cible) : null,
      enErreur: apercu.filter((item) => item.probleme).length,
      modifiees: apercu.filter((item) => item.modifie).length,
    };
  }, [apercu, plan]);

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

  /** Répartition : la base relit la production et recalcule les parts. */
  const repartir = (ecraser: boolean) =>
    executer(ecraser ? 'repartir-force' : 'repartir', async () => {
      if (!id) throw new Error('Plan inconnu.');
      const bilan = await achatsIndustrielsService.repartir(id, ecraser);
      const morceaux = [
        bilan.lignes_creees > 0 ? `${bilan.lignes_creees} ligne(s) créée(s)` : null,
        bilan.lignes_mises_a_jour > 0 ? `${bilan.lignes_mises_a_jour} mise(s) à jour` : null,
        bilan.lignes_preservees > 0 ? `${bilan.lignes_preservees} ajustement(s) préservé(s)` : null,
      ].filter(Boolean);
      return morceaux.length ? `Répartition faite : ${morceaux.join(', ')}.` : 'Aucune mine éligible sur ce mois.';
    });

  /** Application locale d'un pourcentage : rien n'est enregistré tant qu'on n'a pas validé la ligne. */
  const appliquerPourcentage = () => {
    const taux = Number(politique.pourcentage);
    if (!(taux > 0 && taux <= 100)) {
      setErreur('Le pourcentage doit être compris entre 0 et 100.');
      return;
    }
    const parts = repartirParPourcentage(
      lignes.map((ligne) => ({
        mining_company_id: ligne.mining_company_id,
        production_eligible_oz: Number(ligne.production_eligible_oz) || 0,
      })),
      taux
    );
    const parSociete = new Map(parts.map((part) => [part.mining_company_id, part.quantite_proposee_oz]));
    setBrouillons((actuels) => {
      const suivants = { ...actuels };
      lignes.forEach((ligne) => {
        suivants[ligne.id] = {
          ...suivants[ligne.id],
          quantite: String(parSociete.get(ligne.mining_company_id) ?? 0),
        };
      });
      return suivants;
    });
    setMessage(`Pourcentage de ${taux} % appliqué à l’écran. Enregistrez pour le rendre effectif.`);
  };

  /**
   * Application locale de la quantité nationale : le prorata et le replacement
   * du reliquat suivent la même règle qu'en base, pour que l'aperçu ne promette
   * pas autre chose que ce qui sera enregistré.
   */
  const appliquerCible = () => {
    const cible = Number(plan?.quantite_cible_oz || 0);
    if (!(cible > 0)) {
      setErreur('Ce plan ne vise pas de quantité nationale.');
      return;
    }
    const parts = repartirParQuantiteCible(
      lignes.map((ligne) => ({
        mining_company_id: ligne.mining_company_id,
        production_eligible_oz: Number(ligne.production_eligible_oz) || 0,
      })),
      cible
    );
    const parSociete = new Map(parts.map((part) => [part.mining_company_id, part.quantite_proposee_oz]));
    setBrouillons((actuels) => {
      const suivants = { ...actuels };
      lignes.forEach((ligne) => {
        suivants[ligne.id] = {
          ...suivants[ligne.id],
          quantite: String(parSociete.get(ligne.mining_company_id) ?? 0),
        };
      });
      return suivants;
    });
    setMessage(`Cible de ${decimal.format(cible)} oz répartie à l’écran. Enregistrez pour la rendre effective.`);
  };

  const appliquerPrix = () => {
    const prix = Number(politique.prix);
    if (!(prix > 0)) {
      setErreur('Le prix à l’once doit être supérieur à zéro.');
      return;
    }
    setBrouillons((actuels) => {
      const suivants = { ...actuels };
      lignes.forEach((ligne) => {
        suivants[ligne.id] = { ...suivants[ligne.id], prix: String(prix) };
      });
      return suivants;
    });
    setMessage(`Prix de ${decimal.format(prix)} FCFA appliqué à l’écran. Enregistrez pour le rendre effectif.`);
  };

  const enregistrerModifications = () =>
    executer('enregistrer', async () => {
      const aEnregistrer = apercu.filter((item) => item.modifie);
      if (!aEnregistrer.length) return 'Aucune modification à enregistrer.';

      const invalides = aEnregistrer.filter((item) => item.probleme);
      if (invalides.length) {
        throw new Error(`${invalides.length} ligne(s) invalide(s) : corrigez-les avant d’enregistrer.`);
      }

      for (const item of aEnregistrer) {
        await achatsIndustrielsService.ajusterLigne(item.ligne.id, {
          quantite_proposee_oz: item.quantite,
          prix_once_fcfa: item.prix,
        });
      }
      return `${aEnregistrer.length} ligne(s) enregistrée(s).`;
    });

  const soumettre = () =>
    executer('soumettre', async () => {
      if (!id) throw new Error('Plan inconnu.');
      if (totaux.modifiees > 0) {
        throw new Error('Des modifications ne sont pas enregistrées : enregistrez-les avant de soumettre.');
      }
      const nombre = await achatsIndustrielsService.soumettrePlan(id);
      return `${nombre} demande(s) transmise(s) aux sociétés minières.`;
    });

  if (!chargement && !plan) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page achats-page">
          <EmptyState title="Plan introuvable" description="Ce plan d’achat n’existe pas ou a été supprimé." />
        </div>
      </NationalDashboardLayout>
    );
  }

  /**
   * Une cible nationale ne s'impose pas aux mines : si elle dépasse ce que le
   * mois a produit, la répartition s'arrête à l'assiette et l'écart reste.
   */
  const totauxColonnes = useMemo(() => ({
    declaree: apercu.reduce((somme, item) => somme + Number(item.ligne.production_declaree_oz || 0), 0),
    validee: apercu.reduce((somme, item) => somme + Number(item.ligne.production_validee_oz || 0), 0),
    engagee: apercu.reduce((somme, item) => somme + Number(item.ligne.deja_engage_oz || 0), 0),
  }), [apercu]);

  const cible = Number(plan?.quantite_cible_oz || 0);
  const cibleHorsAssiette =
    plan?.mode_repartition === 'quantite_cible' && lignes.length > 0 && cible > totaux.eligible
      ? arrondirQuantite(cible - totaux.eligible)
      : null;

  return (
    <NationalDashboardLayout>
      <div className="sn-page achats-page plan-page">
        <PageHeader
          icon={CalendarRange}
          title={plan ? `Plan d’achat ${duMois(plan.mois, plan.annee)}` : 'Plan d’achat'}
          subtitle={
            plan?.mode_repartition === 'pourcentage'
              ? `${plan.numero_plan} · ${decimal.format(Number(plan.pourcentage_global || 0))} % de la production éligible.`
              : `${plan?.numero_plan ?? ''} · ${onces(plan?.quantite_cible_oz)} visées à l’échelle nationale.`
          }
          breadcrumb={[
            { label: 'Achats industriels' },
            { label: 'Plans mensuels', to: '/achats/plans' },
            { label: plan?.numero_plan || '…' },
          ]}
          info={{
            titre: 'Assiette achetable',
            contenu:
              'C’est la production déclarée du mois, non annulée, diminuée de ce que d’autres achats retiennent déjà. On ne peut pas acheter deux fois la même once.',
          }}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/achats/plans')}>
                <ArrowLeft aria-hidden="true" /> Retour
              </button>
              <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
                <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
            </>
          }
        />

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
        {message && !erreur && <Note icon={Sparkles}>{message}</Note>}

        {/* Ce que le plan est, et ce qu'on peut lui faire : une seule barre,
            séparée des chiffres qu'elle commande. */}
        {plan && (
          <div className="plan-barre">
            <div className="plan-barre__etat">
              <Badge tone={TONS_STATUT[plan.statut]}>{LIBELLES_STATUT_PLAN[plan.statut]}</Badge>
              <span>
                {libelleMois(plan.mois)} {plan.annee}
                {' · '}
                {lignes.length > 0 ? `${lignes.length} mine(s)` : 'aucune ligne'}
                {totaux.modifiees > 0 && ` · ${totaux.modifiees} ligne(s) non enregistrée(s)`}
              </span>
            </div>

            {modifiable ? (
              <div className="plan-barre__actions">
                <button
                  type="button" className="sn-btn"
                  onClick={() => void repartir(false)} disabled={action !== null}
                >
                  <Target aria-hidden="true" />
                  {action === 'repartir' ? 'Répartition…' : 'Répartir'}
                </button>
                <button
                  type="button" className="sn-btn"
                  onClick={() => void enregistrerModifications()}
                  disabled={action !== null || totaux.modifiees === 0}
                >
                  {action === 'enregistrer' ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  type="button" className="sn-btn sn-btn--primary"
                  onClick={() => void soumettre()}
                  disabled={action !== null || totaux.quantite <= 0 || totaux.enErreur > 0}
                >
                  <Send aria-hidden="true" /> {action === 'soumettre' ? 'Transmission…' : 'Soumettre aux mines'}
                </button>
              </div>
            ) : (
              <p className="plan-barre__fige">
                Plan {LIBELLES_STATUT_PLAN[plan.statut].toLowerCase()} : sa répartition ne se modifie plus.
              </p>
            )}
          </div>
        )}

        <dl className="achats-synthese">
          <div className="achats-synthese__poste">
            <dt>Assiette achetable</dt>
            <dd>{onces(totaux.eligible)}</dd>
          </div>
          <div className="achats-synthese__poste">
            <dt>Quantité répartie</dt>
            <dd>{onces(totaux.quantite)}</dd>
          </div>
          <div className="achats-synthese__poste">
            <dt>Part de l’assiette</dt>
            <dd>{decimal.format(totaux.part)} %</dd>
          </div>
          <div className="achats-synthese__poste">
            <dt>Montant prévisionnel</dt>
            <dd>{francs(totaux.montant)}</dd>
          </div>
          {totaux.ecart !== null && (
            <div className="achats-synthese__poste">
              <dt>Écart à la cible</dt>
              <dd className={Math.abs(totaux.ecart) < 0.0001 ? 'est-conforme' : 'est-ecart'}>
                {totaux.ecart >= 0 ? '+' : ''}{decimal.format(totaux.ecart)} oz
              </dd>
            </div>
          )}
          {totaux.enErreur > 0 && (
            <div className="achats-synthese__poste">
              <dt>Lignes en erreur</dt>
              <dd className="est-ecart">{totaux.enErreur}</dd>
            </div>
          )}
        </dl>

        {cibleHorsAssiette !== null && (
          <Note tone="warning" icon={AlertTriangle}>
            La cible de {onces(cible)} dépasse de {decimal.format(cibleHorsAssiette)} oz ce que les
            mines ont déclaré ce mois-ci. La répartition s’arrête à l’assiette : révisez la cible,
            ou attendez les déclarations manquantes.
          </Note>
        )}

        {modifiable && (
          <Section
            id="politique"
            icon={Sparkles}
            tone="blue"
            title="Application globale"
            description="Un taux ou un prix posé sur toutes les lignes, à ajuster ensuite ligne à ligne."
          >
            <div className="plan-politique">
              <div className="plan-politique__champs">
                {plan?.mode_repartition === 'quantite_cible' ? (
                  <div className="sn-field">
                    <span className="sn-field__label">Quantité nationale visée</span>
                    <p className="sn-readonly">{onces(plan.quantite_cible_oz)}</p>
                  </div>
                ) : (
                  <label className="sn-field">
                    <span className="sn-field__label">Pourcentage à appliquer</span>
                    <input
                      type="number" min={0} max={100} step={0.5} value={politique.pourcentage}
                      onChange={(evenement) => setPolitique((p) => ({ ...p, pourcentage: evenement.target.value }))}
                    />
                  </label>
                )}
                <label className="sn-field">
                  <span className="sn-field__label">Prix à l’once (FCFA)</span>
                  <input
                    type="number" min={0} step={1000} value={politique.prix}
                    onChange={(evenement) => setPolitique((p) => ({ ...p, prix: evenement.target.value }))}
                  />
                </label>
              </div>

              <div className="plan-politique__gestes">
                {plan?.mode_repartition === 'quantite_cible' ? (
                  <button type="button" className="sn-btn" onClick={appliquerCible}>
                    Répartir la quantité visée
                  </button>
                ) : (
                  <button type="button" className="sn-btn" onClick={appliquerPourcentage}>
                    Appliquer le pourcentage
                  </button>
                )}
                <button type="button" className="sn-btn" onClick={appliquerPrix}>
                  Appliquer le prix
                </button>
                <span className="plan-politique__note">
                  À l’écran seulement : enregistrez pour rendre effectif.
                </span>
              </div>
            </div>

            <div className="plan-politique__base">
              <div>
                <strong>Reprendre la répartition depuis la production</strong>
                <span>
                  La base relit les déclarations du mois et recalcule les parts.
                </span>
              </div>
              <div className="plan-politique__gestes">
                <button
                  type="button" className="sn-btn"
                  onClick={() => void repartir(false)} disabled={action !== null}
                >
                  <Target aria-hidden="true" /> En préservant les ajustements
                </button>
                <button
                  type="button" className="sn-btn"
                  onClick={() => void repartir(true)} disabled={action !== null}
                >
                  <RefreshCw aria-hidden="true" /> En les écrasant
                </button>
              </div>
            </div>
          </Section>
        )}

        <Section
          id="repartition"
          icon={Target}
          title="Répartition par société minière"
          description="Une ligne par mine. Les lignes marquées ont été ajustées à la main."
          info={{
            titre: 'Ce que dit chaque colonne',
            contenu: (
              <dl className="plan-lexique">
                {COLONNES_DEFINIES.map((colonne) => (
                  <div key={colonne.titre}>
                    <dt>{colonne.titre}</dt>
                    <dd>{colonne.definition}</dd>
                  </div>
                ))}
              </dl>
            ),
          }}
        >
          {chargement ? (
            <p className="production-page__loading">Chargement de la répartition…</p>
          ) : lignes.length === 0 ? (
            <EmptyState
              title="Aucune ligne"
              description="Lancez la répartition pour constituer une ligne par mine à partir de la production du mois."
            />
          ) : (
            <div className="achats-grille plan-grille">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Société minière</th>
                    {COLONNES_DEFINIES.map((colonne) => (
                      <th key={colonne.titre} scope="col" className="is-right" title={colonne.definition}>
                        {colonne.titre}
                      </th>
                    ))}
                    <th scope="col">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {apercu.map((item) => (
                    <tr key={item.ligne.id} className={item.ligne.ajustee_manuellement ? 'est-ajustee' : undefined}>
                      <td><strong>{item.ligne.mining_company?.code || '—'}</strong></td>
                      <td className="plan-grille__nom">
                        {item.ligne.mining_company?.name || 'Société inconnue'}
                      </td>
                      <td className="is-right">{decimal.format(Number(item.ligne.production_declaree_oz || 0))}</td>
                      <td className="is-right">{decimal.format(Number(item.ligne.production_validee_oz || 0))}</td>
                      <td className="is-right">
                        {item.ligne.titre_moyen_pct === null
                          ? '—'
                          : decimal.format(Number(item.ligne.titre_moyen_pct))}
                      </td>
                      <td className="is-right">{decimal.format(Number(item.ligne.deja_engage_oz || 0))}</td>
                      <td className="is-right"><strong>{decimal.format(item.eligible)}</strong></td>
                      <td className="is-right">
                        {modifiable ? (
                          <>
                            <input
                              type="number" min={0} step={0.01}
                              aria-label={`Quantité à acheter à ${item.ligne.mining_company?.name || 'cette mine'}`}
                              aria-invalid={item.probleme ? true : undefined}
                              value={brouillons[item.ligne.id]?.quantite ?? ''}
                              onChange={(evenement) => setBrouillons((actuels) => ({
                                ...actuels,
                                [item.ligne.id]: {
                                  ...actuels[item.ligne.id],
                                  quantite: evenement.target.value,
                                },
                              }))}
                            />
                            {item.probleme && <span className="achats-erreur-ligne">{item.probleme}</span>}
                          </>
                        ) : (
                          decimal.format(item.quantite)
                        )}
                      </td>
                      <td className="is-right">
                        {item.part === null ? '—' : decimal.format(item.part)}
                      </td>
                      <td className="is-right">
                        {modifiable ? (
                          <input
                            type="number" min={0} step={1000}
                            aria-label={`Prix à l’once pour ${item.ligne.mining_company?.name || 'cette mine'}`}
                            value={brouillons[item.ligne.id]?.prix ?? ''}
                            onChange={(evenement) => setBrouillons((actuels) => ({
                              ...actuels,
                              [item.ligne.id]: {
                                ...actuels[item.ligne.id],
                                prix: evenement.target.value,
                              },
                            }))}
                          />
                        ) : (
                          montant(item.prix)
                        )}
                      </td>
                      <td className="is-right">{montant(item.montant)}</td>
                      <td>
                        {item.ligne.statut === 'approuvee' && <Badge tone="success">Approuvée</Badge>}
                        {item.ligne.statut === 'rejetee' && <Badge tone="danger">Rejetée</Badge>}
                        {item.ligne.statut === 'soumise' && <Badge tone="warning">Soumise</Badge>}
                        {item.ligne.statut === 'brouillon' && (
                          item.ligne.ajustee_manuellement
                            ? <Badge tone="info">Ajustée</Badge>
                            : <Badge tone="neutral">Brouillon</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td className="is-right">{decimal.format(totauxColonnes.declaree)}</td>
                    <td className="is-right">{decimal.format(totauxColonnes.validee)}</td>
                    <td />
                    <td className="is-right">{decimal.format(totauxColonnes.engagee)}</td>
                    <td className="is-right">{decimal.format(totaux.eligible)}</td>
                    <td className="is-right">{decimal.format(totaux.quantite)}</td>
                    <td className="is-right">{decimal.format(totaux.part)}</td>
                    <td />
                    <td className="is-right">{montant(totaux.montant)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}

export default PlanAchatDetails;
