import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Banknote,
  Coins,
  FileSpreadsheet,
  Landmark,
  Loader2,
  MapPin,
  PieChart as PieIcon,
  Scale,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import {
  artisanAnalyticsService,
  type ChiffreAffairesParPeriode,
  type ChiffreAffairesParRegion,
  type IndicateursCles,
  type QuantiteParType,
} from '@/services/artisanAnalyticsService';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import { defaultPeriode, formatGrammes, formatMontant, validatePeriode } from './rapportsShared';
import './rapports.css';

const COULEURS = ['#b8860b', '#0f7a56', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b'];

/** Année couverte par la période retenue, pour l'évolution mensuelle. */
export function anneeDeLaPeriode(debut: string, fin: string): number {
  const annee = Number((fin || debut).slice(0, 4));
  return Number.isFinite(annee) && annee > 1900 ? annee : new Date().getFullYear();
}

export default function CentreRapportsAnalyse() {
  const navigate = useNavigate();
  const periodeInitiale = defaultPeriode();

  const [debut, setDebut] = useState(periodeInitiale.debut);
  const [fin, setFin] = useState(periodeInitiale.fin);
  const [loading, setLoading] = useState(true);
  const [indicateurs, setIndicateurs] = useState<IndicateursCles | null>(null);
  const [parRegion, setParRegion] = useState<ChiffreAffairesParRegion[]>([]);
  const [parType, setParType] = useState<QuantiteParType[]>([]);
  const [parMois, setParMois] = useState<ChiffreAffairesParPeriode[]>([]);
  const [indisponibles, setIndisponibles] = useState<string[]>([]);

  const periodeError = validatePeriode(debut, fin);

  const charger = useCallback(async () => {
    if (validatePeriode(debut, fin)) return;
    setLoading(true);

    // Chaque source est indépendante : une requête en échec ne doit pas vider l'écran.
    const [cles, regions, types, mois] = await Promise.allSettled([
      artisanAnalyticsService.getIndicateursCles(debut, fin),
      artisanAnalyticsService.getChiffreAffairesParRegion(debut, fin),
      artisanAnalyticsService.getQuantiteParType(debut, fin),
      artisanAnalyticsService.getChiffreAffairesParMois(anneeDeLaPeriode(debut, fin)),
    ]);

    const manquants: string[] = [];
    if (cles.status === 'fulfilled') setIndicateurs(cles.value);
    else manquants.push('les indicateurs clés');
    if (regions.status === 'fulfilled') setParRegion(regions.value);
    else manquants.push('la répartition régionale');
    if (types.status === 'fulfilled') setParType(types.value);
    else manquants.push('la répartition par type d’or');
    if (mois.status === 'fulfilled') setParMois(mois.value);
    else manquants.push('l’évolution mensuelle');

    setIndisponibles(manquants);
    setLoading(false);
  }, [debut, fin]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const annee = anneeDeLaPeriode(debut, fin);
  const onces = (indicateurs?.quantite_totale_grammes || 0) / TROY_OZ_GRAMS;

  return (
    <NationalDashboardLayout>
      <div className="sn-page rapports">
        <PageHeader
          icon={BarChart3}
          title="Centre de rapports et d’analyse"
          subtitle="Indicateurs consolidés de la collecte artisanale et accès aux rapports détaillés."
          breadcrumb={[{ label: 'Artisans miniers', to: '/artisan-minier' }, { label: 'Rapports' }]}
          actions={
            <>
              <button
                type="button"
                className="sn-btn"
                onClick={() => navigate('/artisan-minier/rapports/chiffre-affaires')}
              >
                <Banknote aria-hidden="true" /> Chiffre d’affaires
              </button>
              <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/rapports/quantites')}>
                <Scale aria-hidden="true" /> Quantités
              </button>
              <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/rapports/taxes')}>
                <Landmark aria-hidden="true" /> Taxes et royalties
              </button>
            </>
          }
        />

        <section className="sn-card rapports__filtres" aria-label="Période analysée">
          <label className="sn-field">
            <span className="sn-field__label">Du</span>
            <input type="date" value={debut} max={fin} onChange={(event) => setDebut(event.target.value)} />
          </label>
          <label className="sn-field">
            <span className="sn-field__label">Au</span>
            <input type="date" value={fin} min={debut} onChange={(event) => setFin(event.target.value)} />
          </label>
          <button type="button" className="sn-btn sn-btn--primary" onClick={() => void charger()} disabled={Boolean(periodeError) || loading}>
            {loading ? <Loader2 className="sn-spin" aria-hidden="true" /> : <TrendingUp aria-hidden="true" />}
            Actualiser
          </button>
          {periodeError && <span className="rapports__erreur">{periodeError}</span>}
        </section>

        {indisponibles.length > 0 && (
          <Note tone="warning" icon={AlertCircle}>
            Données partielles : {indisponibles.join(', ')} n’ont pas pu être chargées.
          </Note>
        )}

        <StatGrid
          ariaLabel="Indicateurs de la période"
          items={[
            {
              label: 'Ventes déclarées',
              value: indicateurs?.total_ventes ?? 0,
              hint: `${indicateurs?.ventes_en_attente ?? 0} en attente de validation`,
              icon: TrendingUp,
              tone: 'blue',
            },
            {
              label: 'Chiffre d’affaires',
              value: `${formatMontant(indicateurs?.chiffre_affaires_total)} FCFA`,
              hint: `${formatMontant(indicateurs?.montant_en_attente)} FCFA en attente`,
              icon: Banknote,
              tone: 'green',
            },
            {
              label: 'Or collecté',
              value: `${formatGrammes(indicateurs?.quantite_totale_grammes)} g`,
              hint: `${onces.toFixed(2)} onces troy`,
              icon: Coins,
              tone: 'gold',
            },
            {
              label: 'Artisans actifs',
              value: indicateurs?.total_artisans_actifs ?? 0,
              hint: `${formatMontant(indicateurs?.prix_moyen_gramme)} FCFA le gramme en moyenne`,
              icon: Users,
              tone: 'violet',
            },
            {
              label: 'Taxes collectées',
              value: `${formatMontant(indicateurs?.taxes_total)} FCFA`,
              hint: 'TVA et retenue à la source facturées',
              icon: Landmark,
              tone: 'red',
            },
            {
              label: 'Taxe de développement communal',
              value: `${formatMontant(indicateurs?.royalties_total)} FCFA`,
              hint: 'Part reversée aux collectivités',
              icon: FileSpreadsheet,
              tone: 'gold',
            },
          ]}
        />

        <div className="rapports__duo">
          <Section
            id="regions"
            icon={MapPin}
            tone="blue"
            title="Chiffre d’affaires par région"
            description="Répartition territoriale de la collecte sur la période."
          >
            {parRegion.length === 0 ? (
              <EmptyState title="Aucune vente sur la période" description="Élargissez les bornes de la période." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={parRegion} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" />
                  <XAxis dataKey="region" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatMontant(value)} />
                  <Tooltip formatter={(value) => `${formatMontant(Number(value))} FCFA`} />
                  <Bar dataKey="montant_total_brut" fill="#b8860b" name="CA brut" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>

          <Section
            id="types"
            icon={PieIcon}
            tone="amber"
            title="Répartition par type d’or"
            description="Part de chaque forme collectée, en masse."
          >
            {parType.length === 0 ? (
              <EmptyState title="Aucune collecte sur la période" description="Élargissez les bornes de la période." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={parType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={92}
                    dataKey="quantite_totale_grammes"
                    nameKey="type_or"
                  >
                    {parType.map((part, index) => (
                      <Cell key={part.type_or} fill={COULEURS[index % COULEURS.length]} />
                    ))}
                  </Pie>
                  <Legend formatter={(value: string) => value} />
                  <Tooltip formatter={(value) => `${formatGrammes(Number(value))} g`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Section>
        </div>

        <Section
          id="evolution"
          icon={TrendingUp}
          tone="emerald"
          title={`Évolution mensuelle ${annee}`}
          description="Chiffre d’affaires et masse collectée, mois par mois."
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={parMois} margin={{ top: 8, right: 16, left: 8, bottom: 56 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" />
              <XAxis dataKey="periode" angle={-35} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="ca" tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatMontant(value)} />
              <YAxis yAxisId="masse" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatMontant(Number(value))} />
              <Legend />
              <Line
                yAxisId="ca"
                type="monotone"
                dataKey="montant_total_brut"
                stroke="#b8860b"
                strokeWidth={2}
                name="CA (FCFA)"
                dot={false}
              />
              <Line
                yAxisId="masse"
                type="monotone"
                dataKey="quantite_totale_grammes"
                stroke="#0f7a56"
                strokeWidth={2}
                name="Quantité (g)"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}
