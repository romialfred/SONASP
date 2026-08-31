import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
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
import { useAuth } from '@/contexts/AuthContext';
import type { ProductionStatus } from '@/constants/productionStatuses';
import type { Database } from '@/types/database';
import {
  bornesPeriodes,
  cumulerObjectif,
  dernieresRevisions,
  ecartAuBut,
  realiseSur,
  type Ecart,
  type LigneObjectif,
  type Objectif,
  type Periode,
} from './productionInSafeData';
import './production.css';

/**
 * Or en coffre — définition retenue
 *
 * L'or que la SONASP **détient encore** : entré au coffre par une déclaration de
 * production, il n'en est pas ressorti.
 *
 *   entre  — toute déclaration de production d'une mine industrielle ;
 *   reste  — tant qu'elle est « Préparée » ou « Prête pour la douane » ;
 *   sort   — quand son expédition part vers le raffineur ;
 *   jamais — les déclarations annulées n'y sont pas entrées.
 *
 * L'écran comptait auparavant **toutes** les déclarations non annulées, y
 * compris celles déjà parties : quatre barres sur dix étaient rattachées à une
 * expédition partie, dont deux déjà chez le raffineur. Le coffre affichait donc
 * de l'or qu'il ne détenait plus. Les barres sorties sont désormais retirées du
 * cumul, et l'écran dit combien il en a retiré.
 *
 * Le réalisé se compare aux objectifs **votés** — budget mensuel et prévision
 * révisée — jamais à des cibles codées en dur.
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
  status: Database['public']['Enums']['production_status_v2'];
}

type StatutProductionCoffre = Database['public']['Enums']['production_status_v2'];

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

/**
 * `production_status_v2` ne connaît que trois valeurs. « Expédié » et « Affiné »
 * y figuraient : aucune déclaration ne pouvait les porter, et les choisir vidait
 * la table sans rien expliquer. Un filtre qui ne peut rien trouver n'est pas un
 * filtre.
 */
const STATUTS_FILTRABLES: Array<{ valeur: StatutProductionCoffre | 'all'; libelle: string }> = [
  { valeur: 'all', libelle: 'Tous les statuts' },
  { valeur: 'prepared', libelle: 'Préparé' },
  { valeur: 'ready_for_customs', libelle: 'Prêt pour la douane' },
];

const estStatutProductionCoffre = (
  valeur: string
): valeur is StatutProductionCoffre | 'all' =>
  STATUTS_FILTRABLES.some((statut) => statut.valeur === valeur);

export function ProductionInSafe() {
  const { user } = useAuth();
  const mineCompanyId = user?.mining_company_id || null;
  const navigate = useNavigate();

  const [productions, setProductions] = useState<LigneProduction[]>([]);
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);
  const [budgets, setBudgets] = useState<LigneObjectif[] | null>(null);
  /** Barres rattachées à une expédition déjà partie : elles ont quitté le coffre. */
  const [sorties, setSorties] = useState<Set<string>>(new Set());
  const [sortiesLues, setSortiesLues] = useState(true);
  const [previsions, setPrevisions] = useState<LigneObjectif[] | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [compagnieFiltre, setCompagnieFiltre] = useState(mineCompanyId || 'all');
  const [statutFiltre, setStatutFiltre] = useState<StatutProductionCoffre | 'all'>('all');

  const parDefaut = useMemo(() => bornesPeriodes(), []);
  const [periode, setPeriode] = useState<Periode>(parDefaut.annee);

  const periodeInvalide = periode.debut > periode.fin;

  const chargerCompagnies = useCallback(async () => {
    let query = supabase
      .from('mining_companies')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (mineCompanyId) query = query.eq('id', mineCompanyId);
    const { data, error } = await query;
    if (error) throw error;
    setCompagnies(data || []);
  }, [mineCompanyId]);

  /**
   * Une barre quitte le coffre au départ de son expédition. Le rattachement seul
   * ne suffit pas : tant que l'expédition n'est pas partie, l'or est encore là.
   */
  const chargerSorties = useCallback(async () => {
    const { data, error } = await supabase
      .from('freight_shipment_productions')
      .select('production_id, expedition:freight_shipments!inner(shipped_at)')
      .not('freight_shipments.shipped_at', 'is', null);

    if (error) {
      // Sans cette lecture, le coffre serait surestimé sans le dire. L'écran
      // préfère l'annoncer plutôt que de présenter un cumul qu'il sait faux.
      setSortiesLues(false);
      setSorties(new Set());
      return;
    }

    setSortiesLues(true);
    setSorties(
      new Set(
        (data || [])
          .filter((ligne: Record<string, any>) => ligne.expedition?.shipped_at)
          .map((ligne: Record<string, any>) => String(ligne.production_id))
      )
    );
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
      await Promise.all([
        chargerCompagnies(),
        chargerProductions(),
        chargerObjectifs(),
        chargerSorties(),
      ]);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les déclarations du coffre.'));
      setProductions([]);
    } finally {
      setChargement(false);
    }
  }, [periodeInvalide, chargerCompagnies, chargerProductions, chargerObjectifs, chargerSorties]);

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

  /** Ce qui est encore au coffre, une fois les barres parties écartées. */
  const auCoffre = useMemo(
    () => productions.filter((ligne) => !sorties.has(ligne.id)),
    [productions, sorties]
  );

  const nombreSorties = productions.length - auCoffre.length;

  const cumuls = useMemo(() => {
    const dore = auCoffre.reduce((total, ligne) => total + Number(ligne.bullion_grams || 0), 0);
    const fin = auCoffre.reduce((total, ligne) => total + Number(ligne.pure_gold_grams || 0), 0);
    const oz = auCoffre.reduce((total, ligne) => total + Number(ligne.estimated_oz || 0), 0);
    const titres = auCoffre
      .map((ligne) => Number(ligne.estimated_fineness_pct || 0))
      .filter((titre) => titre > 0);
    return {
      declarations: auCoffre.length,
      dore,
      fin,
      oz,
      titreMoyen: titres.length ? titres.reduce((a, b) => a + b, 0) / titres.length : null,
    };
  }, [auCoffre]);

  const nomCompagnie = useCallback(
    (id: string | null) => (id ? compagnies.find((c) => c.id === id)?.name || 'Société inconnue' : '—'),
    [compagnies]
  );

  const filtresActifs =
    (!mineCompanyId && compagnieFiltre !== 'all' ? 1 : 0) +
    (statutFiltre === 'all' ? 0 : 1) +
    (periode.debut === parDefaut.annee.debut && periode.fin === parDefaut.annee.fin ? 0 : 1);
  const mineName = mineCompanyId
    ? compagnies.find((compagnie) => compagnie.id === mineCompanyId)?.name || 'Votre société minière'
    : null;

  const reinitialiser = () => {
    setCompagnieFiltre(mineCompanyId || 'all');
    setStatutFiltre('all');
    setPeriode(parDefaut.annee);
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page production-page">
        <PageHeader
          icon={Shield}
          title="Or en coffre"
          subtitle={mineName
            ? `Stock physique issu des productions de ${mineName}, avant expédition.`
            : 'L’or déclaré par les mines et encore détenu par la SONASP : entré au coffre, pas encore expédié.'}
          breadcrumb={[{ label: mineName ? 'Mon espace' : 'Mines industrielles' }, { label: 'Or en coffre' }]}
          info={{
            titre: 'Ce que contient le coffre',
            contenu:
              'Une barre entre à sa déclaration de production et en sort au départ de son expédition vers le raffineur. Les déclarations annulées n’y entrent jamais.',
          }}
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

        {/* Les trois pastilles qui répétaient ici les filtres actifs ont été
            retirées : les filtres vivent dans le panneau de droite, dont le
            bouton porte déjà leur compte. La place revient à la définition, qui
            manquait. */}
        {periodeInvalide && (
          <Note tone="danger" icon={AlertTriangle}>
            La date de début est postérieure à la date de fin.
          </Note>
        )}

        {!sortiesLues && (
          <Note tone="warning" icon={AlertTriangle}>
            Expéditions illisibles : les cumuls sont probablement surestimés.
          </Note>
        )}

        {filtresOuverts && (
          <div className="sn-drawer production-filter-drawer" role="dialog" aria-modal="true" aria-label="Filtres du coffre">
            <div className="sn-drawer__backdrop" aria-hidden="true" onClick={() => setFiltresOuverts(false)} />
            <div className="sn-drawer__panel">
              <header>
                <h3>
                  <SlidersHorizontal aria-hidden="true" /> Filtres du coffre
                </h3>
                <button type="button" aria-label="Fermer les filtres" onClick={() => setFiltresOuverts(false)}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="sn-drawer__body">
                <div className="production-filter-drawer__intro">
                  <CalendarRange aria-hidden="true" />
                  <div>
                    <strong>Période et statut</strong>
                    <span>Affinez la situation du stock sans changer votre périmètre société.</span>
                  </div>
                </div>
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
                {mineCompanyId ? (
                  <div className="production-filter-drawer__scope" aria-label={`Périmètre : ${mineName}`}>
                    <Building2 aria-hidden="true" />
                    <div>
                      <span>Périmètre du compte</span>
                      <strong>{mineName}</strong>
                      <small>Ce périmètre est verrouillé par le profil connecté.</small>
                    </div>
                  </div>
                ) : (
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
                )}
                <label className="sn-field">
                  <span className="sn-field__label">Statut</span>
                  <select
                    value={statutFiltre}
                    onChange={(evenement) => {
                      if (estStatutProductionCoffre(evenement.target.value)) {
                        setStatutFiltre(evenement.target.value);
                      }
                    }}
                  >
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
            { label: 'Or fin', value: grammes(cumuls.fin), icon: Shield, tone: 'gold' },
            { label: 'Équivalent', value: onces(cumuls.oz), icon: Target, tone: 'gold' },
            {
              label: 'Teneur moyenne',
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
          title="Production réalisée par rapport aux objectifs"
          description="Budget et prévision révisée, au prorata des jours écoulés."
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

              /**
               * La jauge dit d'un coup d'œil ce que trois nombres disaient mal :
               * la part de l'objectif atteinte. L'écart chiffré reste dessous,
               * pour qui veut le montant exact.
               */
              const jauge = (ecart: Ecart | null) =>
                ecart === null ? null : (
                  <div
                    className="production-page__jauge"
                    role="img"
                    aria-label={`${ecart.tauxAtteinte} % de l’objectif atteint`}
                  >
                    <span
                      className={ecart.atteint ? 'est-atteint' : 'est-manque'}
                      style={{ width: `${ecart.tauxAtteinte}%` }}
                    />
                  </div>
                );

              const cible = (
                clef: string,
                libelle: string,
                objectif: Objectif | null,
                ecart: Ecart | null,
                absence: string
              ) => (
                <div key={clef} className="production-page__cible">
                  <div className="production-page__cible-tete">
                    <dt>{libelle}</dt>
                    <dd>{objectif?.complet ? onces(objectif.totalOz) : '—'}</dd>
                  </div>
                  {jauge(ecart)}
                  <dd className={ecart ? (ecart.atteint ? 'est-atteint' : 'est-manque') : 'est-absent'}>
                    {ecart
                      ? `${ecart.atteint ? '+' : ''}${decimal.format(ecart.ecartOz)} oz · ${ecart.tauxAtteinte} % de l’objectif`
                      : absence}
                  </dd>
                </div>
              );

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

                  <p className="production-page__objectif-realise">
                    {decimal.format(realise)} <span>oz produites</span>
                  </p>

                  <dl>
                    {cible(
                      'budget',
                      'Budget',
                      budget,
                      ecartBudget,
                      budgets === null ? 'Source illisible' : 'Budget non renseigné'
                    )}
                    {cible(
                      'prevision',
                      'Prévision révisée',
                      prevision,
                      ecartPrevision,
                      previsions === null ? 'Source illisible' : 'Prévision non saisie'
                    )}
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
          description={
            nombreSorties > 0
              ? `${nombreSorties} barre${nombreSorties > 1 ? 's' : ''} expédiée${nombreSorties > 1 ? 's' : ''}, écartée${nombreSorties > 1 ? 's' : ''} du coffre.`
              : 'Toutes les barres listées sont encore détenues.'
          }
        >
          {chargement ? (
            <p className="production-page__loading">Chargement des déclarations…</p>
          ) : auCoffre.length === 0 ? (
            <EmptyState
              title="Aucune barre au coffre"
              description="Aucune déclaration sur cette période."
            />
          ) : (
            <div className="sn-table-wrap production-page__table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    {!mineCompanyId && <th scope="col">Compagnie</th>}
                    <th scope="col" className="is-right">Doré</th>
                    <th scope="col" className="is-right">Teneur</th>
                    <th scope="col" className="is-right">Or fin</th>
                    <th scope="col" className="is-right">Équivalent</th>
                    <th scope="col">Référence</th>
                    <th scope="col">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {auCoffre.map((ligne) => (
                    <tr
                      key={ligne.id}
                      className="is-clickable"
                      onClick={() => navigate(`/production/${ligne.id}`)}
                    >
                      <td>{formatDate(ligne.production_date)}</td>
                      {!mineCompanyId && <td>{nomCompagnie(ligne.mining_company_id)}</td>}
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
                    <td colSpan={mineCompanyId ? 1 : 2}>
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
