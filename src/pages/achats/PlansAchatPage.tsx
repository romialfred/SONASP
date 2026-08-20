import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarRange, Plus, RefreshCw, Target, X } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  achatsIndustrielsService,
  LIBELLES_STATUT_PLAN,
  libelleMois,
  type PlanAchat,
  type StatutPlan,
} from '@/services/achatsIndustrielsService';
import './achats.css';

/**
 * Plans mensuels d'achat.
 *
 * Chaque mois, la SONASP arrête la quantité d'or qu'elle entend acquérir. Le
 * plan porte cette décision : une politique globale — un pourcentage de la
 * production ou une quantité nationale — puis sa répartition entre les mines.
 */

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const onces = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined ? '—' : `${decimal.format(Number(valeur))} oz`;

export const francs = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined ? '—' : `${entier.format(Number(valeur))} FCFA`;

/**
 * Le même montant, sans sa devise. Dans un tableau dont l'en-tête porte déjà
 * « (FCFA) », l'unité répétée dans chaque cellule repasse à la ligne et casse
 * l'alignement des chiffres.
 */
export const montant = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined ? '—' : entier.format(Number(valeur));

export const TONS_STATUT: Record<StatutPlan, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  brouillon: 'neutral',
  pret_soumission: 'info',
  soumis: 'warning',
  partiellement_approuve: 'warning',
  approuve: 'success',
  rejete: 'danger',
  en_execution: 'info',
  cloture: 'neutral',
  annule: 'danger',
};

export function PlansAchatPage() {
  const navigate = useNavigate();

  const [plans, setPlans] = useState<PlanAchat[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);

  const aujourdhui = useMemo(() => new Date(), []);
  const [saisie, setSaisie] = useState({
    annee: aujourdhui.getFullYear(),
    mois: aujourdhui.getMonth() + 1,
    mode_repartition: 'pourcentage' as 'pourcentage' | 'quantite_cible',
    pourcentage_global: '40',
    quantite_cible_oz: '',
    prix_once_global_fcfa: '',
    observations: '',
  });

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setPlans(await achatsIndustrielsService.listerPlans());
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les plans d’achat.'));
      setPlans([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    if (!formulaireOuvert) return;
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setFormulaireOuvert(false);
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [formulaireOuvert]);

  const cumuls = useMemo(() => {
    const vivants = plans.filter((plan) => !['annule', 'rejete'].includes(plan.statut));
    return {
      total: plans.length,
      enCours: vivants.filter((plan) => ['soumis', 'partiellement_approuve', 'en_execution'].includes(plan.statut)).length,
      quantite: vivants.reduce((somme, plan) => somme + Number(plan.quantite_repartie_oz || 0), 0),
      montant: vivants.reduce((somme, plan) => somme + Number(plan.montant_previsionnel_fcfa || 0), 0),
    };
  }, [plans]);

  const validerSaisie = (): string | null => {
    if (saisie.mode_repartition === 'pourcentage') {
      const taux = Number(saisie.pourcentage_global);
      if (!(taux > 0 && taux <= 100)) return 'Le pourcentage doit être compris entre 0 et 100.';
    } else {
      if (!(Number(saisie.quantite_cible_oz) > 0)) return 'La quantité nationale visée doit être renseignée.';
    }
    if (!(Number(saisie.prix_once_global_fcfa) > 0)) {
      return 'Le prix de référence à l’once doit être renseigné.';
    }
    return null;
  };

  const creer = async () => {
    const probleme = validerSaisie();
    if (probleme) {
      setErreur(probleme);
      return;
    }

    setEnregistrement(true);
    setErreur(null);
    try {
      const plan = await achatsIndustrielsService.creerPlan({
        annee: saisie.annee,
        mois: saisie.mois,
        mode_repartition: saisie.mode_repartition,
        pourcentage_global: saisie.mode_repartition === 'pourcentage' ? Number(saisie.pourcentage_global) : null,
        quantite_cible_oz: saisie.mode_repartition === 'quantite_cible' ? Number(saisie.quantite_cible_oz) : null,
        prix_once_global_fcfa: Number(saisie.prix_once_global_fcfa),
        observations: saisie.observations || null,
      });
      setFormulaireOuvert(false);
      navigate(`/achats/plans/${plan.id}`);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Le plan n’a pas pu être créé.'));
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page achats-page">
        <PageHeader
          icon={CalendarRange}
          title="Plans d’achat mensuels"
          subtitle="Quantité d’or que la SONASP entend acquérir auprès des mines industrielles, mois par mois."
          breadcrumb={[{ label: 'Achats industriels' }, { label: 'Plans mensuels' }]}
          info={{
            titre: 'À quoi sert un plan',
            contenu:
              'Le plan fixe la politique d’achat du mois, pourcentage de la production ou quantité nationale, puis sa répartition entre les mines. Une fois soumis, chaque ligne devient une demande adressée à sa mine.',
          }}
          actions={
            <>
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => setFormulaireOuvert(true)}>
                <Plus aria-hidden="true" /> Nouveau plan
              </button>
              <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
                <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
            </>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <StatGrid
          sober
          ariaLabel="Cumuls des plans d’achat"
          items={[
            { label: 'Plans', value: entier.format(cumuls.total), icon: CalendarRange, tone: 'neutral' },
            { label: 'En cours', value: entier.format(cumuls.enCours), icon: Target, tone: 'gold' },
            { label: 'Quantité répartie', value: onces(cumuls.quantite), icon: Target, tone: 'gold' },
            { label: 'Montant prévisionnel', value: francs(cumuls.montant), icon: Target, tone: 'neutral' },
          ]}
        />

        {formulaireOuvert && (
          <div className="achats-fenetre" role="dialog" aria-modal="true" aria-label="Nouveau plan d’achat">
            <div className="achats-fenetre__voile" aria-hidden="true" onClick={() => setFormulaireOuvert(false)} />
            <div className="achats-fenetre__panneau">
              <header>
                <h3><Plus aria-hidden="true" /> Nouveau plan d’achat</h3>
                <button type="button" aria-label="Fermer" onClick={() => setFormulaireOuvert(false)}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="achats-fenetre__corps">
                <Field label="Année" required htmlFor="annee">
                  <input
                    id="annee" type="number" className="sn-input"
                    value={saisie.annee} min={2020} max={2100}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, annee: Number(evenement.target.value) }))}
                  />
                </Field>

                <Field label="Mois" required htmlFor="mois">
                  <select
                    id="mois" className="sn-select" value={saisie.mois}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, mois: Number(evenement.target.value) }))}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((mois) => (
                      <option key={mois} value={mois}>{libelleMois(mois)}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Politique d’achat" required htmlFor="mode">
                  <select
                    id="mode" className="sn-select" value={saisie.mode_repartition}
                    onChange={(evenement) => setSaisie((s) => ({
                      ...s, mode_repartition: evenement.target.value as 'pourcentage' | 'quantite_cible',
                    }))}
                  >
                    <option value="pourcentage">Pourcentage de la production éligible</option>
                    <option value="quantite_cible">Quantité nationale visée</option>
                  </select>
                </Field>

                {saisie.mode_repartition === 'pourcentage' ? (
                  <Field label="Pourcentage de la production éligible" required htmlFor="pct">
                    <input
                      id="pct" type="number" className="sn-input" min={0} max={100} step={0.5}
                      value={saisie.pourcentage_global}
                      onChange={(evenement) => setSaisie((s) => ({ ...s, pourcentage_global: evenement.target.value }))}
                    />
                  </Field>
                ) : (
                  <Field label="Quantité nationale visée (oz)" required htmlFor="cible">
                    <input
                      id="cible" type="number" className="sn-input" min={0} step={0.01}
                      value={saisie.quantite_cible_oz}
                      onChange={(evenement) => setSaisie((s) => ({ ...s, quantite_cible_oz: evenement.target.value }))}
                    />
                  </Field>
                )}

                <Field label="Prix de référence à l’once (FCFA)" required htmlFor="prix">
                  <input
                    id="prix" type="number" className="sn-input" min={0} step={1000}
                    value={saisie.prix_once_global_fcfa}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, prix_once_global_fcfa: evenement.target.value }))}
                  />
                </Field>

                <Field label="Observations" wide htmlFor="obs">
                  <textarea
                    id="obs" className="sn-input" rows={3} value={saisie.observations}
                    onChange={(evenement) => setSaisie((s) => ({ ...s, observations: evenement.target.value }))}
                  />
                </Field>
              </div>

              <footer>
                <button type="button" className="sn-btn" onClick={() => setFormulaireOuvert(false)}>
                  Annuler
                </button>
                <button
                  type="button" className="sn-btn sn-btn--primary"
                  onClick={() => void creer()} disabled={enregistrement}
                >
                  {enregistrement ? 'Création…' : 'Créer et répartir'}
                </button>
              </footer>
            </div>
          </div>
        )}

        <Section
          id="plans"
          icon={CalendarRange}
          title="Plans enregistrés"
          description="Un plan par mois. Sélectionnez-en un pour ajuster sa répartition."
        >
          {chargement ? (
            <p className="production-page__loading">Chargement des plans…</p>
          ) : plans.length === 0 ? (
            <EmptyState
              title="Aucun plan d’achat"
              description="Créez le plan du mois pour répartir les achats entre les mines."
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Plan</th>
                    <th scope="col">Période</th>
                    <th scope="col">Politique</th>
                    <th scope="col" className="is-right">Quantité répartie</th>
                    <th scope="col" className="is-right">Montant prévisionnel</th>
                    <th scope="col">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="is-clickable"
                      onClick={() => navigate(`/achats/plans/${plan.id}`)}
                    >
                      <td><strong>{plan.numero_plan}</strong></td>
                      <td>{libelleMois(plan.mois)} {plan.annee}</td>
                      <td>
                        {plan.mode_repartition === 'pourcentage'
                          ? `${decimal.format(Number(plan.pourcentage_global || 0))} % de l’éligible`
                          : `${onces(plan.quantite_cible_oz)} visées`}
                      </td>
                      <td className="is-right">{onces(plan.quantite_repartie_oz)}</td>
                      <td className="is-right">{francs(plan.montant_previsionnel_fcfa)}</td>
                      <td>
                        <Badge tone={TONS_STATUT[plan.statut]}>{LIBELLES_STATUT_PLAN[plan.statut]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}

export default PlansAchatPage;
