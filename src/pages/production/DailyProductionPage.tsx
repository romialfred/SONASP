import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, CalendarRange, Coins, Factory, Loader2, Plus, RotateCcw, Scale, SlidersHorizontal, TrendingUp, X } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { CustomConfirm } from '@/components/ui/CustomConfirm';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { dailyProductionService, type DailyProduction } from '@/services/dailyProductionService';
import { DailyProductionFormEnhanced } from '@/components/production/DailyProductionFormEnhanced';
import { ProductionTable } from '@/components/production/ProductionTable';
import { ProductionChart } from '@/components/production/ProductionChart';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { filterOperationalMiningCompanies } from '@/utils/miningCompanyFilters';
import { useAuth } from '@/contexts/AuthContext';
import { minePortalService } from '@/services/minePortalService';
import './production.css';

export interface MiningCompany {
  id: string;
  name: string;
}

export interface PeriodeProduction {
  debut: string;
  fin: string;
}

export const periodeParDefaut = (today = new Date()): PeriodeProduction => ({
  debut: new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10),
  fin: today.toISOString().slice(0, 10),
});

export const nombre = (valeur: number, decimales = 2) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(
    valeur || 0
  );

/** Date courte en français, pour le rappel de période. */
export const formatDate = (valeur: string) => {
  const date = new Date(`${valeur}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Cumuls affichés en tête de page. */
export function cumulsProduction(productions: DailyProduction[]) {
  return productions.reduce(
    (acc, production) => ({
      declarations: acc.declarations + 1,
      dore: acc.dore + Number(production.bullion_grams || 0),
      orFin: acc.orFin + Number(production.pure_gold_grams || 0),
      onces: acc.onces + Number(production.estimated_oz || 0),
    }),
    { declarations: 0, dore: 0, orFin: 0, onces: 0 }
  );
}

/** Teneur moyenne en or, pondérée par la masse de doré ; `null` sans doré pesé. */
export function titreMoyen(productions: DailyProduction[]): number | null {
  const dore = productions.reduce((somme, production) => somme + Number(production.bullion_grams || 0), 0);
  if (dore <= 0) return null;
  const orFin = productions.reduce((somme, production) => somme + Number(production.pure_gold_grams || 0), 0);
  return (orFin / dore) * 100;
}

/**
 * Lignes du fichier d'export.
 * La colonne « compagnie » recevait l'identifiant technique : l'export livrait des UUID
 * à la place des raisons sociales, et le séparateur décimal anglo-saxon.
 */
export function lignesExport(
  productions: DailyProduction[],
  compagnies: MiningCompany[]
): string[][] {
  const parId = new Map(compagnies.map((compagnie) => [compagnie.id, compagnie.name]));
  const entetes = [
    'Date',
    'Compagnie minière',
    'Doré (g)',
    'Teneur en or (%)',
    'Or fin (g)',
    'Onces troy',
    'Référence de barre',
    'Observations',
  ];
  const lignes = productions.map((production) => [
    production.production_date,
    (production.mining_company_id && parId.get(production.mining_company_id)) || 'Non renseignée',
    nombre(production.bullion_grams),
    nombre(production.estimated_fineness_pct),
    nombre(production.pure_gold_grams),
    nombre(production.estimated_oz, 4),
    production.bar_reference || '',
    production.notes || '',
  ]);
  return [entetes, ...lignes];
}

export function DailyProductionPage() {
  const { user } = useAuth();
  const mineCompanyId = user?.mining_company_id || null;
  const navigate = useNavigate();
  const emplacement = useLocation();
  // La fiche d'une déclaration renvoie ici pour la modifier : sans cela, le
  // bouton « Modifier » ouvrait la liste sans rien présélectionner.
  const declarationAModifier = (emplacement.state as { productionId?: string } | null)?.productionId;
  const {
    alertState,
    confirmState,
    showError,
    showConfirm,
    closeAlert,
    closeConfirm,
    handleConfirmAction,
  } = useCustomAlert();

  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [compagnies, setCompagnies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [periode, setPeriode] = useState<PeriodeProduction>(periodeParDefaut());
  const [compagnieFiltre, setCompagnieFiltre] = useState(mineCompanyId || 'all');
  const [formOuvert, setFormOuvert] = useState(false);
  const [selection, setSelection] = useState<DailyProduction | null>(null);
  const [filtresOuverts, setFiltresOuverts] = useState(false);

  const chargerCompagnies = useCallback(async () => {
    let query = supabase
      .from('mining_companies')
      .select('id, name, company_type')
      .eq('is_active', true)
      .order('name');
    if (mineCompanyId) query = query.eq('id', mineCompanyId);
    const { data, error } = await query;
    if (error) {
      setErreur(errorMessage(error, 'Impossible de charger les compagnies minières.'));
      return;
    }
    setCompagnies(mineCompanyId ? (data || []) : filterOperationalMiningCompanies(data || []));
  }, [mineCompanyId]);

  const chargerProductions = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      setProductions(
        await dailyProductionService.listProduction({ startDate: periode.debut, endDate: periode.fin })
      );
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger les déclarations de production.'));
      setProductions([]);
    } finally {
      setLoading(false);
    }
  }, [periode.debut, periode.fin]);

  useEffect(() => {
    void chargerCompagnies();
  }, [chargerCompagnies]);

  useEffect(() => {
    void chargerProductions();
  }, [chargerProductions]);

  useEffect(() => {
    if (!declarationAModifier) return;
    const cible = productions.find((production) => production.id === declarationAModifier);
    if (!cible) return;
    setSelection(cible);
    setFormOuvert(true);
    // L'état de navigation est consommé une fois : un retour arrière ne doit
    // pas rouvrir le formulaire.
    navigate('.', { replace: true, state: null });
  }, [declarationAModifier, productions, navigate]);

  useEffect(() => {
    if (!filtresOuverts) return;
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setFiltresOuverts(false);
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [filtresOuverts]);

  const visibles = useMemo(
    () =>
      compagnieFiltre === 'all'
        ? productions
        : productions.filter((production) => production.mining_company_id === compagnieFiltre),
    [productions, compagnieFiltre]
  );

  const parDefaut = periodeParDefaut();
  const filtresActifs =
    (!mineCompanyId && compagnieFiltre !== 'all' ? 1 : 0) +
    (periode.debut === parDefaut.debut && periode.fin === parDefaut.fin ? 0 : 1);

  const mineName = mineCompanyId
    ? compagnies.find((compagnie) => compagnie.id === mineCompanyId)?.name || 'Votre société minière'
    : null;

  const reinitialiser = () => {
    setPeriode(periodeParDefaut());
    setCompagnieFiltre(mineCompanyId || 'all');
  };

  const cumuls = useMemo(() => cumulsProduction(visibles), [visibles]);
  const titre = useMemo(() => titreMoyen(visibles), [visibles]);
  const periodeInvalide = periode.debut > periode.fin;

  const supprimer = async (id: string) => {
    // `showConfirm` attend (titre, message, options) et renvoie une promesse.
    // L'appel passait la fonction de suppression en guise de message : la promesse
    // n'etait jamais lue et **la suppression n'avait tout simplement jamais lieu**.
    const confirme = await showConfirm(
      'Supprimer cette déclaration ?',
      'Cette déclaration de production sera définitivement supprimée.',
      { type: 'danger', confirmText: 'Supprimer', cancelText: 'Annuler' }
    );
    if (!confirme) return;

    try {
      if (mineCompanyId) await minePortalService.deleteProduction(id);
      else await dailyProductionService.deleteProduction(id);
      await chargerProductions();
    } catch (reason) {
      showError(errorMessage(reason, 'Suppression impossible.'));
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page production-page">
        <CustomAlert {...alertState} onClose={closeAlert} />
        <CustomConfirm
          {...confirmState}
          onConfirm={handleConfirmAction}
          onCancel={closeConfirm}
        />

        <PageHeader
          icon={Factory}
          title="Production journalière"
          subtitle={
            mineName
              ? `Déclarations de doré et d’or fin de ${mineName}.`
              : 'Déclarations de doré et d’or fin par compagnie minière.'
          }
          breadcrumb={[{ label: 'Production' }, { label: 'Production journalière' }]}
          actions={
            <>
              {/* Le bouton menait vers `/production/budget`, route qui n'existe pas. */}
              <button
                type="button"
                className={`sn-btn${filtresActifs > 0 ? ' is-filtered' : ''}`}
                onClick={() => setFiltresOuverts(true)}
              >
                <SlidersHorizontal aria-hidden="true" /> Filtres
                {filtresActifs > 0 && <em>{filtresActifs}</em>}
              </button>
              <button type="button" className="sn-btn" onClick={() => navigate('/performance/budgets')}>
                <TrendingUp aria-hidden="true" /> Budgets et prévisions
              </button>
              {formOuvert ? (
                <button
                  type="button"
                  className="sn-btn"
                  onClick={() => {
                    setFormOuvert(false);
                    setSelection(null);
                  }}
                >
                  <X aria-hidden="true" /> Fermer le formulaire
                </button>
              ) : (
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => {
                    setSelection(null);
                    setFormOuvert(true);
                  }}
                >
                  <Plus aria-hidden="true" /> Déclarer une production
                </button>
              )}
            </>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        {formOuvert && (
          <Section
            id="saisie"
            icon={Plus}
            title={selection ? 'Modifier la production' : 'Ajouter une production'}
            description={mineName
              ? `Saisie pour ${mineName}`
              : 'Poids, teneurs et référence de barre.'}
          >
            <DailyProductionFormEnhanced
              production={selection}
              onSuccess={async () => {
                setFormOuvert(false);
                setSelection(null);
                // La période choisie par l'utilisateur était écrasée par une fenêtre
                // de 90 jours après chaque enregistrement.
                await chargerProductions();
              }}
              onCancel={() => {
                setFormOuvert(false);
                setSelection(null);
              }}
            />
          </Section>
        )}

        {filtresOuverts && (
          <div className="sn-drawer production-filter-drawer" role="dialog" aria-modal="true" aria-label="Filtres des déclarations">
            {/* Fond non focalisable : un second « Fermer les filtres » dans l'ordre de
                tabulation dupliquerait le nom accessible du bouton d'en-tête. */}
            <div className="sn-drawer__backdrop" aria-hidden="true" onClick={() => setFiltresOuverts(false)} />
            <div className="sn-drawer__panel">
              <header>
                <h3>
                  <SlidersHorizontal aria-hidden="true" /> Filtres de production
                </h3>
                <button type="button" aria-label="Fermer les filtres" onClick={() => setFiltresOuverts(false)}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="sn-drawer__body">
                <div className="production-filter-drawer__intro">
                  <CalendarRange aria-hidden="true" />
                  <div>
                    <strong>Période d’analyse</strong>
                    <span>Les indicateurs et la liste sont recalculés sur ces dates.</span>
                  </div>
                </div>
                <label className="sn-field">
                  <span className="sn-field__label">Du</span>
                  <input
                    type="date"
                    value={periode.debut}
                    max={periode.fin}
                    onChange={(event) => setPeriode((current) => ({ ...current, debut: event.target.value }))}
                  />
                </label>
                <label className="sn-field">
                  <span className="sn-field__label">Au</span>
                  <input
                    type="date"
                    value={periode.fin}
                    min={periode.debut}
                    onChange={(event) => setPeriode((current) => ({ ...current, fin: event.target.value }))}
                  />
                </label>
                {mineCompanyId ? (
                  <div className="production-filter-drawer__scope" aria-label={`Périmètre : ${mineName}`}>
                    <Building2 aria-hidden="true" />
                    <div>
                      <span>Périmètre du compte</span>
                      <strong>{mineName}</strong>
                      <small>Fixé par votre profil et appliqué côté base de données.</small>
                    </div>
                  </div>
                ) : (
                  <label className="sn-field">
                    <span className="sn-field__label">Compagnie minière</span>
                    <select value={compagnieFiltre} onChange={(event) => setCompagnieFiltre(event.target.value)}>
                      <option value="all">Toutes les compagnies</option>
                      {compagnies.map((compagnie) => (
                        <option key={compagnie.id} value={compagnie.id}>
                          {compagnie.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
          ariaLabel="Cumuls de la période"
          items={[
            { label: 'Déclarations', value: cumuls.declarations, icon: Factory, tone: 'neutral' },
            { label: 'Doré déclaré', value: `${nombre(cumuls.dore)} g`, icon: Scale, tone: 'gold' },
            {
              label: 'Or fin',
              value: `${nombre(cumuls.orFin)} g`,
              hint: `${nombre(cumuls.onces, 2)} onces troy`,
              icon: Coins,
              tone: 'green',
            },
            {
              label: 'Teneur moyenne',
              value: titre === null ? '—' : `${nombre(titre)} %`,
              hint: titre === null ? 'Aucun doré pesé' : 'Pondéré par la masse de doré',
              icon: Scale,
              tone: 'neutral',
            },
          ]}
        />

        <Section
          id="evolution"
          icon={TrendingUp}
          title="Évolution de la production"
          description="Masse déclarée sur la période retenue."
        >
          {visibles.length === 0 ? (
            <EmptyState title="Aucune déclaration" description="Aucune production déclarée sur cette période." />
          ) : (
            <ProductionChart
              productions={visibles}
              dateRange={{ startDate: periode.debut, endDate: periode.fin }}
              groupByCompany={!mineCompanyId && compagnieFiltre === 'all'}
              miningCompanies={compagnies}
            />
          )}
        </Section>

        <Section
          id="declarations"
          icon={Factory}
          title={`Déclarations (${visibles.length})`}
          description="Chaque ligne correspond à une journée de production déclarée."
        >
          {loading ? (
            <div className="production-page__loading">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des déclarations…
            </div>
          ) : visibles.length === 0 ? (
            <EmptyState
              title="Aucune déclaration"
              description={
                productions.length === 0
                  ? 'Aucune production n’a été déclarée sur cette période.'
                  : 'Aucune déclaration ne correspond à cette compagnie.'
              }
              action={
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => {
                    setSelection(null);
                    setFormOuvert(true);
                  }}
                >
                  Déclarer une production
                </button>
              }
            />
          ) : (
            <ProductionTable
              productions={visibles}
              loading={loading}
              showMiningCompany={!mineCompanyId}
              miningCompanies={compagnies}
              onEdit={(production: DailyProduction) => {
                setSelection(production);
                setFormOuvert(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onDelete={(id: string) => void supprimer(id)}
            />
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}
