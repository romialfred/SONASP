import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Factory,
  RefreshCw,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Target,
  X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { ProductionStatusBadge } from '@/components/production/ProductionStatusBadge';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import type { ProductionStatus } from '@/constants/productionStatuses';
import {
  bornesPeriodes,
  cumulerObjectif,
  dernieresRevisions,
  ecartAuBut,
  libelleMois,
  realiseSur,
  type LigneObjectif,
  type Periode,
} from './productionInSafeData';
import './production.css';

/**
 * Or en coffre : ce que les compagnies ont déclaré et qui n'est ni annulé ni
 * sorti. L'écran compare le réalisé aux objectifs **votés** — budget mensuel et
 * prévision révisée — là où il affichait auparavant des objectifs codés en dur.
 */

interface Compagnie {
  id: string;
  name: string;
}

interface LigneProduction {
  id: string;
  production_date: string;
  mining_company_id: string | null;
  bullion_grams: number | null;
  pure_gold_grams: number | null;
  estimated_oz: number | null;
  estimated_fineness_pct: number | null;
  bar_reference: string | null;
  status: string;
}

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const onces = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined ? '—' : `${decimal.format(valeur)} oz`;
export const grammes = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined ? '—' : `${entier.format(valeur)} g`;

export const formatDate = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR');
};

/** Le coffre exclut les déclarations annulées : elles n'y sont plus. */
const STATUT_EXCLU = 'cancelled';

const STATUTS_FILTRABLES: Array<{ valeur: string; libelle: string }> = [
  { valeur: 'all', libelle: 'Tous les statuts' },
  { valeur: 'prepared', libelle: 'Préparé' },
  { valeur: 'ready_for_customs', libelle: 'Prêt pour la douane' },
  { valeur: 'shipped', libelle: 'Expédié' },
  { valeur: 'refined', libelle: 'Affiné' },
];

export function ProductionInSafe() {
  const navigate = useNavigate();

  const [productions, setProductions] = useState<LigneProduction[]>([]);
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);
  const [budgets, setBudgets] = useState<LigneObjectif[] | null>(null);
  const [previsions, setPrevisions] = useState<LigneObjectif[] | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [compagnieFiltre, setCompagnieFiltre] = useState('all');
  const [statutFiltre, setStatutFiltre] = useState('all');

  const parDefaut = useMemo(() => bornesPeriodes(), []);
  const [periode, setPeriode] = useState<Periode>(parDefaut.annee);

  const periodeInvalide = periode.debut > periode.fin;

  const chargerCompagnies = useCallback(async () => {
    const { data, error } = await supabase
      .from('mining_companies')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    setCompagnies(data || []);
  }, []);

  const chargerProductions = useCallback(async () => {
    let requete = supabase
      .from('daily_production')
      .select(
        'id, production_date, mining_company_id, bullion_grams, pure_gold_grams, estimated_oz, estimated_fineness_pct, bar_reference, status'
      )
      .gte('production_date', periode.debut)
      .lte('production_date', periode.fin)
      .neq('status', STATUT_EXCLU)
      .order('production_date', { ascending: false });

    if (compagnieFiltre !== 'all') requete = requete.eq('mining_company_id', compagnieFiltre);
    if (statutFiltre !== 'all') requete = requete.eq('status', statutFiltre);

    const { data, error } = await requete;
    if (error) throw error;
    setProductions((data || []) as LigneProduction[]);
  }, [periode.debut, periode.fin, compagnieFiltre, statutFiltre]);

  /**
   * Objectifs votés. La société filtrée restreint aussi les objectifs : comparer
   * la production d'une mine au budget national dirait n'importe quoi.
   */
  const chargerObjectifs = useCallback(async () => {
    let requeteBudgets = supabase
      .from('monthly_budgets')
      .select('month, daily_budget_oz, mining_company_id, annual_budget:annual_budgets(year)');
    let requetePrevisions = supabase
      .from('quarterly_forecasts')
      .select('month, daily_forecast_oz, revision_date, mining_company_id, annual_budget:annual_budgets(year)');

    if (compagnieFiltre !== 'all') {
      requeteBudgets = requeteBudgets.eq('mining_company_id', compagnieFiltre);
      requetePrevisions = requetePrevisions.eq('mining_company_id', compagnieFiltre);
    }

    const [budgetsRes, previsionsRes] = await Promise.all([requeteBudgets, requetePrevisions]);

    // Une source en échec n'en vide pas une autre : chacune s'affiche ou se tait
    // pour son propre compte.
    setBudgets(
      budgetsRes.error
        ? null
        : (budgetsRes.data || []).map((ligne: Record<string, any>) => ({
            month: Number(ligne.month),
            year: Number(ligne.annual_budget?.year || 0),
            dailyOz: Number(ligne.daily_budget_oz || 0),
            mining_company_id: ligne.mining_company_id,
          }))
    );

    setPrevisions(
      previsionsRes.error
        ? null
        : dernieresRevisions(
            (previsionsRes.data || []).map((ligne: Record<string, any>) => ({
              month: Number(ligne.month),
              year: Number(ligne.annual_budget?.year || 0),
              dailyOz: Number(ligne.daily_forecast_oz || 0),
              mining_company_id: ligne.mining_company_id,
              revision: ligne.revision_date,
            }))
          )
    );
  }, [compagnieFiltre]);

  const charger = useCallback(async () => {
    if (periodeInvalide) return;
    setChargement(true);
    setErreur(null);
    try {
      await Promise.all([chargerCompagnies(), chargerProductions(), chargerObjectifs()]);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les déclarations du coffre.'));
      setProductions([]);
    } finally {
      setChargement(false);
    }
  }, [periodeInvalide, chargerCompagnies, chargerProductions, chargerObjectifs]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    if (!filtresOuverts) return;
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setFiltresOuverts(false);
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [filtresOuverts]);

  const cumuls = useMemo(() => {
    const dore = productions.reduce((total, ligne) => total + Number(ligne.bullion_grams || 0), 0);
    const fin = productions.reduce((total, ligne) => total + Number(ligne.pure_gold_grams || 0), 0);
    const oz = productions.reduce((total, ligne) => total + Number(ligne.estimated_oz || 0), 0);
    const titres = productions
      .map((ligne) => Number(ligne.estimated_fineness_pct || 0))
      .filter((titre) => titre > 0);
    return {
      declarations: productions.length,
      dore,
      fin,
      oz,
      titreMoyen: titres.length ? titres.reduce((a, b) => a + b, 0) / titres.length : null,
    };
  }, [productions]);

  const nomCompagnie = useCallback(
    (id: string | null) => (id ? compagnies.find((c) => c.id === id)?.name || 'Société inconnue' : '—'),
    [compagnies]
  );

  const filtresActifs =
    (compagnieFiltre === 'all' ? 0 : 1) +
    (statutFiltre === 'all' ? 0 : 1) +
    (periode.debut === parDefaut.annee.debut && periode.fin === parDefaut.annee.fin ? 0 : 1);

  const reinitialiser = () => {
    setCompagnieFiltre('all');
    setStatutFiltre('all');
    setPeriode(parDefaut.annee);
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page production-page">
        <PageHeader
          icon={Shield}
          title="Or en coffre"
          subtitle="Déclarations détenues au coffre, comparées au budget voté et à la prévision révisée."
          breadcrumb={[{ label: 'Mines industrielles' }, { label: 'Or en coffre' }]}
          actions={
            <>
              <button
                type="button"
                className={`sn-btn${filtresActifs > 0 ? ' is-filtered' : ''}`}
                onClick={() => setFiltresOuverts(true)}
              >
                <SlidersHorizontal aria-hidden="true" /> Filtres
                {filtresActifs > 0 && <em>{filtresActifs}</em>}
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

        <p className="production-page__resume">
          <span>
            Période du <strong>{formatDate(periode.debut)}</strong> au <strong>{formatDate(periode.fin)}</strong>
          </span>
          <span>
            {compagnieFiltre === 'all' ? 'Toutes les compagnies' : nomCompagnie(compagnieFiltre)}
          </span>
          <span>{STATUTS_FILTRABLES.find((s) => s.valeur === statutFiltre)?.libelle}</span>
          {periodeInvalide && (
            <span className="production-page__erreur">La date de début est postérieure à la date de fin.</span>
          )}
        </p>

        {filtresOuverts && (
          <div className="sn-drawer" role="dialog" aria-modal="true" aria-label="Filtres du coffre">
            <div className="sn-drawer__backdrop" aria-hidden="true" onClick={() => setFiltresOuverts(false)} />
            <div className="sn-drawer__panel">
              <header>
                <h3>
                  <SlidersHorizontal aria-hidden="true" /> Filtres
                </h3>
                <button type="button" aria-label="Fermer les filtres" onClick={() => setFiltresOuverts(false)}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="sn-drawer__body">
                <label className="sn-field">
                  <span className="sn-field__label">Du</span>
                  <input
                    type="date"
                    value={periode.debut}
                    max={periode.fin}
                    onChange={(evenement) => setPeriode((actuelle) => ({ ...actuelle, debut: evenement.target.value }))}
                  />
                </label>
                <label className="sn-field">
                  <span className="sn-field__label">Au</span>
                  <input
                    type="date"
                    value={periode.fin}
                    min={periode.debut}
                    onChange={(evenement) => setPeriode((actuelle) => ({ ...actuelle, fin: evenement.target.value }))}
                  />
                </label>
                <label className="sn-field">
                  <span className="sn-field__label">Compagnie minière</span>
                  <select value={compagnieFiltre} onChange={(evenement) => setCompagnieFiltre(evenement.target.value)}>
                    <option value="all">Toutes les compagnies</option>
                    {compagnies.map((compagnie) => (
                      <option key={compagnie.id} value={compagnie.id}>
                        {compagnie.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sn-field">
                  <span className="sn-field__label">Statut</span>
                  <select value={statutFiltre} onChange={(evenement) => setStatutFiltre(evenement.target.value)}>
                    {STATUTS_FILTRABLES.map((statut) => (
                      <option key={statut.valeur} value={statut.valeur}>
                        {statut.libelle}
                      </option>
                    ))}
                  </select>
                </label>
                {periodeInvalide && (
                  <p className="production-page__erreur">La date de début est postérieure à la date de fin.</p>
                )}
              </div>

              <footer>
                <button type="button" className="sn-btn" onClick={reinitialiser} disabled={filtresActifs === 0}>
                  <RotateCcw aria-hidden="true" /> Réinitialiser
                </button>
                <button type="button" className="sn-btn sn-btn--primary" onClick={() => setFiltresOuverts(false)}>
                  Appliquer
                </button>
              </footer>
            </div>
          </div>
        )}

        <StatGrid
          sober
          ariaLabel="Cumuls du coffre"
          items={[
            { label: 'Déclarations', value: entier.format(cumuls.declarations), icon: Factory, tone: 'neutral' },
            { label: 'Doré', value: grammes(cumuls.dore), icon: Shield, tone: 'neutral' },
            { label: 'Or fin', value: grammes(cumuls.fin), icon: Shield, tone: 'gold' },
            { label: 'Équivalent', value: onces(cumuls.oz), icon: Target, tone: 'gold' },
            {
              label: 'Titre moyen',
              value: cumuls.titreMoyen === null ? '—' : `${decimal.format(cumuls.titreMoyen)} %`,
              hint: cumuls.titreMoyen === null ? 'Aucun titre estimé renseigné' : undefined,
              icon: Target,
              tone: 'neutral',
            },
          ]}
        />

        <Section
          id="objectifs"
          icon={Target}
          title="Réalisé par rapport aux objectifs"
          description="Budget voté et prévision révisée, cumulés au prorata des jours écoulés."
        >
          <div className="production-page__objectifs">
            {[
              { cle: 'semaine', titre: 'Semaine en cours', icone: CalendarRange, bornes: parDefaut.semaine },
              { cle: 'mois', titre: 'Mois en cours', icone: CalendarDays, bornes: parDefaut.mois },
              { cle: 'annee', titre: 'Année en cours', icone: CalendarCheck, bornes: parDefaut.annee },
            ].map(({ cle, titre, icone: Icone, bornes }) => {
              const realise = realiseSur(productions, bornes);
              const budget = budgets === null ? null : cumulerObjectif(budgets, bornes);
              const prevision = previsions === null ? null : cumulerObjectif(previsions, bornes);
              const ecartBudget = budget ? ecartAuBut(realise, budget) : null;
              const ecartPrevision = prevision ? ecartAuBut(realise, prevision) : null;

              return (
                <article key={cle} className="production-page__objectif">
                  <header>
                    <Icone aria-hidden="true" />
                    <div>
                      <h4>{titre}</h4>
                      <p>
                        du {formatDate(bornes.debut)} au {formatDate(bornes.fin)}
                      </p>
                    </div>
                  </header>

                  <p className="production-page__objectif-realise">{onces(realise)}</p>

                  <dl>
                    <div>
                      <dt>Budget</dt>
                      <dd>{budget?.complet ? onces(budget.totalOz) : '—'}</dd>
                      <dd
                        className={
                          ecartBudget ? (ecartBudget.atteint ? 'est-atteint' : 'est-manque') : undefined
                        }
                      >
                        {ecartBudget
                          ? `${ecartBudget.ecartOz >= 0 ? '+' : ''}${decimal.format(ecartBudget.ecartOz)} oz · ${
                              ecartBudget.pourcentage >= 0 ? '+' : ''
                            }${ecartBudget.pourcentage} %`
                          : budgets === null
                            ? 'Source « budgets mensuels » non lue'
                            : budget && budget.moisManquants.length
                              ? `Budget non voté pour ${budget.moisManquants.map(libelleMois).join(', ')}`
                              : 'Budget non renseigné'}
                      </dd>
                    </div>

                    <div>
                      <dt>Prévision</dt>
                      <dd>{prevision?.complet ? onces(prevision.totalOz) : '—'}</dd>
                      <dd
                        className={
                          ecartPrevision ? (ecartPrevision.atteint ? 'est-atteint' : 'est-manque') : undefined
                        }
                      >
                        {ecartPrevision
                          ? `${ecartPrevision.ecartOz >= 0 ? '+' : ''}${decimal.format(ecartPrevision.ecartOz)} oz · ${
                              ecartPrevision.pourcentage >= 0 ? '+' : ''
                            }${ecartPrevision.pourcentage} %`
                          : previsions === null
                            ? 'Source « prévisions trimestrielles » non lue'
                            : prevision && prevision.moisManquants.length
                              ? `Prévision absente pour ${prevision.moisManquants.map(libelleMois).join(', ')}`
                              : 'Prévision non renseignée'}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        </Section>

        <Section
          id="declarations"
          icon={Shield}
          title="Barres au coffre"
          description="Les déclarations annulées sont exclues : elles ne sont plus au coffre."
        >
          {chargement ? (
            <p className="production-page__loading">Chargement des déclarations…</p>
          ) : productions.length === 0 ? (
            <EmptyState
              title="Aucune barre au coffre"
              description="Aucune déclaration ne répond aux critères retenus sur cette période."
            />
          ) : (
            <div className="sn-table-wrap production-page__table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Compagnie</th>
                    <th scope="col" className="is-right">Doré</th>
                    <th scope="col" className="is-right">Titre</th>
                    <th scope="col" className="is-right">Or fin</th>
                    <th scope="col" className="is-right">Équivalent</th>
                    <th scope="col">Référence</th>
                    <th scope="col">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {productions.map((ligne) => (
                    <tr
                      key={ligne.id}
                      className="is-clickable"
                      onClick={() => navigate(`/production/${ligne.id}`)}
                    >
                      <td>{formatDate(ligne.production_date)}</td>
                      <td>{nomCompagnie(ligne.mining_company_id)}</td>
                      <td className="is-right">{grammes(ligne.bullion_grams)}</td>
                      <td className="is-right">
                        {ligne.estimated_fineness_pct === null
                          ? '—'
                          : `${decimal.format(ligne.estimated_fineness_pct)} %`}
                      </td>
                      <td className="is-right">{grammes(ligne.pure_gold_grams)}</td>
                      <td className="is-right">{onces(ligne.estimated_oz)}</td>
                      <td>{ligne.bar_reference || '—'}</td>
                      <td>
                        <ProductionStatusBadge status={ligne.status as ProductionStatus} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>
                      <strong>Total</strong>
                    </td>
                    <td className="is-right">
                      <strong>{grammes(cumuls.dore)}</strong>
                    </td>
                    <td className="is-right">
                      {cumuls.titreMoyen === null ? '—' : `${decimal.format(cumuls.titreMoyen)} %`}
                    </td>
                    <td className="is-right">
                      <strong>{grammes(cumuls.fin)}</strong>
                    </td>
                    <td className="is-right">
                      <strong>{onces(cumuls.oz)}</strong>
                    </td>
                    <td colSpan={2}>
                      {cumuls.declarations} déclaration{cumuls.declarations > 1 ? 's' : ''}
                    </td>
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
