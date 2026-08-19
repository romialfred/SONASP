import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, CalendarRange, Factory, Loader2, Package, TrendingUp } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { nombre } from './roleDashboardData';
import {
  EMPTY_PRODUCTION_DASHBOARD,
  loadProductionDashboard,
  titreMoyenSerie,
  totalOnces,
  type ProductionDashboardData,
} from './productionDashboardData';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import './role-dashboard.css';

/** Libellé de la sélection ; « all » couvre l'ensemble des compagnies suivies. */
export function libelleSelection(data: ProductionDashboardData, selection: string): string {
  if (selection === 'all') return 'Toutes les compagnies';
  return data.compagnies.find((compagnie) => compagnie.id === selection)?.name || 'Compagnie inconnue';
}

export function ProductionDashboardModern() {
  const navigate = useNavigate();
  const [data, setData] = useState<ProductionDashboardData>(EMPTY_PRODUCTION_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState('all');

  const charger = useCallback(async () => {
    setLoading(true);
    setData(await loadProductionDashboard());
    setLoading(false);
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const serie = useMemo(() => data.parCompagnie[selection] || [], [data, selection]);
  const titre = titreMoyenSerie(serie);

  return (
    <NationalDashboardLayout>
      <div className="sn-page role-dashboard">
        <PageHeader
          icon={Factory}
          title="Tableau de bord production"
          subtitle="Production déclarée par compagnie minière et état des expéditions en cours."
          breadcrumb={[{ label: 'Tableaux de bord', to: '/dashboard' }, { label: 'Production' }]}
          actions={
            <>
              <label className="sn-field production-dashboard__filtre">
                <span className="sn-field__label">Compagnie</span>
                <select value={selection} onChange={(event) => setSelection(event.target.value)}>
                  {/* Le consolidé s'intitulait « Groupe Mansa Resources », sans rapport avec la SONASP. */}
                  <option value="all">Toutes les compagnies</option>
                  {data.compagnies.map((compagnie) => (
                    <option key={compagnie.id} value={compagnie.id}>
                      {compagnie.abbreviation ? `${compagnie.abbreviation} — ` : ''}
                      {compagnie.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/production/daily')}>
                Ouvrir la production
              </button>
            </>
          }
        />

        {data.unavailable.length > 0 && (
          <Note tone="warning" icon={AlertTriangle}>
            Données partielles : {data.unavailable.join(', ')} n’ont pas pu être chargées. Les
            indicateurs concernés restent vides plutôt que d’afficher une estimation.
          </Note>
        )}

        {loading ? (
          <div className="role-dashboard__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement de la production…
          </div>
        ) : (
          <>
            <StatGrid
              ariaLabel="Indicateurs de production"
              items={[
                {
                  label: 'Production de l’année',
                  value: `${nombre(data.productionAnnee)} oz`,
                  hint: `${nombre(data.productionAnnee * TROY_OZ_GRAMS)} g`,
                  icon: TrendingUp,
                  tone: 'green',
                },
                {
                  // L'ancienne carte portait un badge « MTD » sur le mois précédent.
                  label: 'Mois précédent',
                  value: `${nombre(data.productionMoisPrecedent)} oz`,
                  hint: `${nombre(data.productionMoisPrecedent * TROY_OZ_GRAMS)} g`,
                  icon: CalendarRange,
                  tone: 'blue',
                },
                {
                  label: 'Expéditions actives',
                  value: data.expeditionsActives,
                  hint: 'En préparation, en douane ou en transit',
                  icon: Package,
                  tone: 'violet',
                },
                {
                  label: 'Compagnies suivies',
                  value: data.compagnies.length,
                  hint: titre === null ? 'Aucun titre déclaré' : `Titre moyen ${nombre(titre)} %`,
                  icon: Factory,
                  tone: 'gold',
                },
              ]}
            />

            <div className="production-dashboard__grid">
              <Section
                id="evolution"
                icon={BarChart3}
                tone="emerald"
                title={`Production mensuelle — ${libelleSelection(data, selection)}`}
                description="Onces produites et titre moyen constaté sur les douze derniers mois."
              >
                {totalOnces(serie) === 0 ? (
                  <EmptyState
                    title="Aucune production déclarée"
                    description="Aucune déclaration journalière sur les douze derniers mois pour cette sélection."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={330}>
                    <ComposedChart data={serie} margin={{ top: 8, right: 12, left: 8, bottom: 40 }}>
                      <defs>
                        <linearGradient id="productionFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#b8860b" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#b8860b" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#e7edf2" strokeDasharray="2 3" />
                      <XAxis dataKey="mois" angle={-35} textAnchor="end" height={62} tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="onces" tick={{ fontSize: 10 }} width={46} />
                      <YAxis yAxisId="titre" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} width={40} />
                      <Tooltip formatter={(value) => nombre(Number(value))} />
                      <Legend />
                      <Area
                        yAxisId="onces"
                        type="monotone"
                        dataKey="onces"
                        stroke="#b8860b"
                        strokeWidth={2}
                        fill="url(#productionFill)"
                        name="Production (oz)"
                      />
                      <Line
                        yAxisId="titre"
                        type="monotone"
                        dataKey="titreMoyen"
                        stroke="#0f7a56"
                        strokeWidth={2}
                        name="Titre moyen (%)"
                        connectNulls
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </Section>

              <Section
                id="expeditions"
                icon={Package}
                tone="violet"
                title="État des expéditions"
                description="Répartition des préparations actives par étape."
              >
                {data.expeditions.length === 0 ? (
                  <EmptyState title="Aucune expédition active" description="Aucune préparation en cours de traitement." />
                ) : (
                  <ul className="production-dashboard__etats">
                    {data.expeditions.map((etat) => (
                      <li key={etat.statut}>
                        <div>
                          <span className="production-dashboard__puce" style={{ background: etat.couleur }} aria-hidden="true" />
                          <span>{etat.libelle}</span>
                          <strong>
                            {etat.nombre} <small>({Math.round(etat.part)} %)</small>
                          </strong>
                        </div>
                        <div
                          className="production-dashboard__barre"
                          role="progressbar"
                          aria-valuenow={Math.round(etat.part)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Part des expéditions au statut ${etat.libelle}`}
                        >
                          <span style={{ width: `${etat.part}%`, background: etat.couleur }} />
                        </div>
                        <small>{nombre(etat.onces)} oz</small>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            <Section
              id="compagnies"
              icon={Factory}
              tone="blue"
              title="Production par compagnie"
              description="Cumul sur douze mois et titre moyen constaté ; sélectionnez une ligne pour filtrer le graphique."
            >
              {data.compagnies.length === 0 ? (
                <EmptyState title="Aucune compagnie minière enregistrée" />
              ) : (
                <div className="role-dashboard__table-wrap">
                  <table className="role-dashboard__table">
                    <caption className="sr-only">Production par compagnie minière</caption>
                    <thead>
                      <tr>
                        <th scope="col">Compagnie</th>
                        <th scope="col">Sigle</th>
                        <th scope="col" className="is-num">Production 12 mois</th>
                        <th scope="col" className="is-num">Déclarations</th>
                        <th scope="col" className="is-num">Titre moyen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.compagnies.map((compagnie) => {
                        const serieCompagnie = data.parCompagnie[compagnie.id] || [];
                        const titreCompagnie = titreMoyenSerie(serieCompagnie);
                        return (
                          <tr
                            key={compagnie.id}
                            onClick={() => setSelection(compagnie.id)}
                            className={selection === compagnie.id ? 'is-selected' : ''}
                          >
                            <td>
                              <strong>{compagnie.name}</strong>
                            </td>
                            <td>{compagnie.abbreviation || '—'}</td>
                            <td className="is-num">{nombre(totalOnces(serieCompagnie))} oz</td>
                            <td className="is-num">
                              {serieCompagnie.reduce((somme, mois) => somme + mois.declarations, 0)}
                            </td>
                            {/* Le titre était moyenné sur douze mois, zéros compris. */}
                            <td className="is-num">{titreCompagnie === null ? '—' : `${nombre(titreCompagnie)} %`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
