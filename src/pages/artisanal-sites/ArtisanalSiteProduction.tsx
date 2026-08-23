import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  CircleDollarSign,
  Factory,
  Plus,
  RotateCw,
  Scale,
  Users,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  artisanalSiteService,
  calculateSiteMetrics,
  summarizeSiteProduction,
} from '@/services/artisanalSiteService';
import type { ArtisanalSite, SiteProduction } from '@/types/artisanalSite';
import './artisanal-sites-dashboard.css';

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = (value: number, digits = 1) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

export default function ArtisanalSiteProduction() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<ArtisanalSite[]>([]);
  const [productions, setProductions] = useState<SiteProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    artisanalSiteService
      .loadSiteData()
      .then(({ sites: siteData, productions: productionData }) => {
        if (!mounted) return;
        setSites(siteData);
        setProductions(productionData);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Les données de production sont momentanément indisponibles.');
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  const metrics = useMemo(() => calculateSiteMetrics(sites, productions), [productions, sites]);
  const summaries = useMemo(() => summarizeSiteProduction(sites, productions), [productions, sites]);
  const chartData = useMemo(
    () =>
      summaries.map((item) => ({
        ...item,
        label: item.siteName.replace('Site artisanal de ', ''),
      })),
    [summaries]
  );
  const siteNames = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);
  const recentProductions = useMemo(() => productions.slice(0, 20), [productions]);

  return (
    <NationalDashboardLayout>
      <div className="sites-dashboard">
        <header className="sites-dashboard__intro">
          <div>
            <Link to="/artisan-sites" className="sites-backlink">
              <ArrowLeft aria-hidden="true" /> Vue d’ensemble
            </Link>
            <p className="sites-dashboard__eyebrow">Performance des sites</p>
            <h2>Production des sites artisanaux</h2>
            <p className="sites-dashboard__subtitle">
              Consolidation de la production d’or, du chiffre d’affaires et des taxes par site.
            </p>
          </div>
          <div className="sites-dashboard__actions">
            <button type="button" className="sites-button sites-button--gold" onClick={() => navigate('/artisan-sites/nouveau')}>
              <Plus aria-hidden="true" /> Ajouter un site
            </button>
          </div>
        </header>

        {error ? (
          <div className="sites-dashboard__error" role="alert">
            <span>{error}</span>
            <button type="button" className="sites-button" onClick={() => setReloadKey((current) => current + 1)}>
              <RotateCw aria-hidden="true" /> Réessayer
            </button>
          </div>
        ) : <>

        <section className="sites-dashboard__metrics" aria-label="Indicateurs de production">
          {[
            { label: 'Sites producteurs', value: String(summaries.filter((item) => item.productionKilograms > 0).length), icon: Factory, tone: 'is-green' },
            { label: 'Production cumulée', value: `${decimal(metrics.productionKilograms)} kg`, icon: Scale, tone: 'is-gold' },
            { label: 'Artisans mobilisés', value: metrics.activeMinerCount.toLocaleString('fr-FR'), icon: Users, tone: 'is-green' },
            { label: "Chiffre d'affaires", value: `${compact.format(metrics.revenueFcfa)} FCFA`, icon: Banknote, tone: 'is-gold' },
            { label: 'Taxes déclarées', value: `${compact.format(metrics.taxesFcfa)} FCFA`, icon: CircleDollarSign, tone: 'is-green' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <article key={label} className="sites-metric">
              <span className={`sites-metric__icon ${tone}`}><Icon aria-hidden="true" /></span>
              <div>
                <h3>{label}</h3>
                <strong>{value}</strong>
              </div>
            </article>
          ))}
        </section>

        <section className="sites-production-grid">
          <article className="sites-panel">
            <div className="sites-panel__header sites-panel__header--stacked">
              <div>
                <h3>Production et taxes par site</h3>
                <p className="sites-panel__hint">Production en kilogrammes et taxes en millions de FCFA.</p>
              </div>
            </div>
            <div className="sites-production-chart">
              {loading ? (
                <p className="sites-table__empty">Chargement des productions…</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7edf2" />
                    <XAxis dataKey="label" angle={-18} textAnchor="end" height={56} tick={{ fontSize: 10, fill: '#60738c' }} />
                    <YAxis yAxisId="kg" tick={{ fontSize: 10, fill: '#60738c' }} />
                    <YAxis yAxisId="tax" orientation="right" tickFormatter={(value: number) => `${Math.round(value / 1_000_000)} M`} tick={{ fontSize: 10, fill: '#60738c' }} />
                    <Tooltip
                      formatter={(value, name) =>
                        name === 'Production (kg)'
                          ? [`${decimal(Number(value ?? 0))} kg`, name]
                          : [`${money.format(Number(value ?? 0))} FCFA`, name]
                      }
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2eaf0', fontSize: 11 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="kg" dataKey="productionKilograms" name="Production (kg)" fill="#0f9f6e" radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="tax" dataKey="taxesFcfa" name="Taxes (FCFA)" fill="#d99a00" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          <article className="sites-panel">
            <div className="sites-panel__header sites-panel__header--stacked">
              <div>
                <h3>Classement des sites</h3>
                <p className="sites-panel__hint">Selon la production consolidée des artisans.</p>
              </div>
            </div>
            <ol className="sites-ranking">
              {summaries.slice(0, 6).map((item, index) => (
                <li key={item.siteId}>
                  <span className="sites-top__rank">{index + 1}</span>
                  <span className="sites-top__label">
                    <strong>{item.siteName}</strong>
                    <small>CA {compact.format(item.revenueFcfa)} FCFA · Taxes {compact.format(item.taxesFcfa)} FCFA</small>
                  </span>
                  <b>{decimal(item.productionKilograms)} kg</b>
                </li>
              ))}
              {!loading && summaries.length === 0 && <li className="sites-ranking__empty">Aucun site référencé.</li>}
            </ol>
          </article>
        </section>

        <section className="sites-panel sites-table-panel" aria-labelledby="production-history-title">
          <div className="sites-panel__header sites-panel__header--stacked">
            <div>
              <h3 id="production-history-title">
                Ventes d’or consolidées <span className="sites-badge">{productions.length} déclarations</span>
              </h3>
              <p className="sites-panel__hint">Ventes déclarées par les artisans, rattachées à leur site d’exploitation.</p>
            </div>
          </div>
          <div className="sites-table-wrap">
            <table className="sites-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Site</th>
                  <th>Production</th>
                  <th>Artisans</th>
                  <th>Chiffre d’affaires</th>
                  <th>Taxes</th>
                </tr>
              </thead>
              <tbody>
                {recentProductions.map((production) => (
                  <tr key={production.id}>
                    <td>{production.productionDate ? new Date(`${production.productionDate}T12:00:00`).toLocaleDateString('fr-FR') : '—'}</td>
                    <td><strong>{siteNames.get(production.siteId) || 'Site non référencé'}</strong></td>
                    <td>{decimal(production.goldWeightGrams / 1000, 2)} kg</td>
                    <td>{production.artisanCount}</td>
                    <td>{money.format(production.revenueFcfa)} FCFA</td>
                    <td>{money.format(production.taxesFcfa)} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && recentProductions.length === 0 && (
              <p className="sites-table__empty">
                Aucune vente d’or n’a encore été déclarée par les artisans rattachés à ces sites.
              </p>
            )}
            {loading && <p className="sites-table__empty">Chargement des déclarations…</p>}
          </div>
        </section>
        </>}
      </div>
    </NationalDashboardLayout>
  );
}
