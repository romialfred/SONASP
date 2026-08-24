import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Download, Loader2, PieChart as PieIcon, Scale } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { artisanAnalyticsService, type QuantiteParType } from '@/services/artisanAnalyticsService';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import {
  defaultPeriode,
  formatGrammes,
  formatMontant,
  formatTaux,
  tauxEffectif,
  telechargerRapport,
  validatePeriode,
} from './rapportsShared';
import './rapports.css';

const COULEURS = ['#b8860b', '#0f7a56', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b'];

export interface TotauxQuantites {
  nombre_ventes: number;
  quantite_totale_grammes: number;
  montant_total: number;
}

/** Cumuls de la période, onces déduites du poids en grammes. */
export function totauxQuantites(lignes: QuantiteParType[]): TotauxQuantites {
  return lignes.reduce<TotauxQuantites>(
    (acc, ligne) => ({
      nombre_ventes: acc.nombre_ventes + (ligne.nombre_ventes || 0),
      quantite_totale_grammes: acc.quantite_totale_grammes + (ligne.quantite_totale_grammes || 0),
      montant_total: acc.montant_total + (ligne.montant_total || 0),
    }),
    { nombre_ventes: 0, quantite_totale_grammes: 0, montant_total: 0 }
  );
}

/** Libellé métier d'un type d'or. */
export function libelleType(type: string): string {
  const libelles: Record<string, string> = {
    poudre: 'Poudre',
    lingot: 'Lingot',
    pepites: 'Pépites',
    bijoux: 'Bijoux',
    autre: 'Autre forme',
  };
  return libelles[type] || type;
}

export default function RapportQuantites() {
  const navigate = useNavigate();
  const periodeInitiale = defaultPeriode();

  const [debut, setDebut] = useState(periodeInitiale.debut);
  const [fin, setFin] = useState(periodeInitiale.fin);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lignes, setLignes] = useState<QuantiteParType[]>([]);

  const periodeError = validatePeriode(debut, fin);

  const charger = useCallback(async () => {
    if (validatePeriode(debut, fin)) return;
    setLoading(true);
    setErreur(null);
    try {
      setLignes(await artisanAnalyticsService.getQuantiteParType(debut, fin));
    } catch (reason) {
      setErreur(reason instanceof Error ? reason.message : 'Impossible de charger ce rapport.');
    } finally {
      setLoading(false);
    }
  }, [debut, fin]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const totaux = totauxQuantites(lignes);
  const prixMoyen = totaux.quantite_totale_grammes > 0 ? totaux.montant_total / totaux.quantite_totale_grammes : 0;

  const exporter = async () => {
    const message = await telechargerRapport(
      'Quantites',
      `rapport-quantites-${debut}-${fin}.xlsx`,
      lignes.map((ligne) => ({ ...ligne, type_or: libelleType(ligne.type_or) }))
    );
    setErreur(message);
  };

  const series = lignes.map((ligne) => ({ ...ligne, libelle: libelleType(ligne.type_or) }));

  return (
    <NationalDashboardLayout>
      <div className="sn-page rapports">
        <PageHeader
          icon={Scale}
          title="Rapport quantités d’or"
          subtitle="Masse collectée par forme d’or, valorisation et prix moyen au gramme."
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: 'Rapports', to: '/artisan-minier/rapports' },
            { label: 'Quantités' },
          ]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/rapports')}>
                <ArrowLeft aria-hidden="true" /> Centre de rapports
              </button>
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => void exporter()}
                disabled={loading || lignes.length === 0}
              >
                <Download aria-hidden="true" /> Exporter en Excel
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
          {periodeError && <span className="rapports__erreur">{periodeError}</span>}
        </section>

        {erreur && (
          <Note tone="danger" icon={AlertCircle}>
            {erreur}
          </Note>
        )}

        <StatGrid
          ariaLabel="Cumuls de la période"
          items={[
            { label: 'Ventes déclarées', value: totaux.nombre_ventes, icon: Scale, tone: 'blue' },
            {
              label: 'Masse collectée',
              value: `${formatGrammes(totaux.quantite_totale_grammes)} g`,
              hint: `${(totaux.quantite_totale_grammes / TROY_OZ_GRAMS).toFixed(2)} onces troy`,
              icon: Scale,
              tone: 'gold',
            },
            {
              label: 'Valorisation',
              value: `${formatMontant(totaux.montant_total)} FCFA`,
              icon: PieIcon,
              tone: 'green',
            },
            {
              label: 'Prix moyen',
              value: `${formatMontant(prixMoyen)} FCFA/g`,
              hint: 'Toutes formes confondues',
              icon: PieIcon,
              tone: 'violet',
            },
          ]}
        />

        {loading ? (
          <div className="rapports__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Calcul du rapport…
          </div>
        ) : lignes.length === 0 ? (
          <Section id="vide" icon={Scale} tone="slate" title="Quantités par forme d’or">
            <EmptyState
              title="Aucune collecte sur la période"
              description="Aucune vente validée n’a été enregistrée entre ces deux dates."
            />
          </Section>
        ) : (
          <>
            <div className="rapports__duo">
              <Section
                id="repartition"
                icon={PieIcon}
                tone="amber"
                title="Répartition de la masse"
                description="Part de chaque forme dans la collecte totale."
              >
                <ResponsiveContainer width="100%" height={290}>
                  <PieChart>
                    <Pie
                      data={series}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={96}
                      dataKey="quantite_totale_grammes"
                      nameKey="libelle"
                    >
                      {series.map((part, index) => (
                        <Cell key={part.type_or} fill={COULEURS[index % COULEURS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(value) => `${formatGrammes(Number(value))} g`} />
                  </PieChart>
                </ResponsiveContainer>
              </Section>

              <Section
                id="valorisation"
                icon={Scale}
                tone="emerald"
                title="Valorisation par forme"
                description="Montant déclaré pour chaque forme d’or collectée."
              >
                <ResponsiveContainer width="100%" height={290}>
                  <BarChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" />
                    <XAxis dataKey="libelle" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatMontant(value)} />
                    <Tooltip formatter={(value) => `${formatMontant(Number(value))} FCFA`} />
                    <Bar dataKey="montant_total" fill="#0f7a56" name="Montant" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Section>
            </div>

            <Section
              id="detail"
              icon={Scale}
              tone="blue"
              title="Détail par forme d’or"
              description="Quantités, valorisation et prix moyen au gramme."
            >
              <div className="rapports__table-wrap">
                <table className="rapports__table">
                  <caption className="sr-only">Quantités par forme d’or</caption>
                  <thead>
                    <tr>
                      <th scope="col">Forme</th>
                      <th scope="col" className="is-num">Ventes</th>
                      <th scope="col" className="is-num">Quantité (g)</th>
                      <th scope="col" className="is-num">Onces troy</th>
                      <th scope="col" className="is-num">Part</th>
                      <th scope="col" className="is-num">Montant</th>
                      <th scope="col" className="is-num">Prix moyen /g</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((ligne) => (
                      <tr key={ligne.type_or}>
                        <td>{libelleType(ligne.type_or)}</td>
                        <td className="is-num">{ligne.nombre_ventes}</td>
                        <td className="is-num">{formatGrammes(ligne.quantite_totale_grammes)}</td>
                        <td className="is-num">{(ligne.quantite_totale_grammes / TROY_OZ_GRAMS).toFixed(2)}</td>
                        <td className="is-num">{ligne.pourcentage_total.toFixed(1)} %</td>
                        <td className="is-num is-brut">{formatMontant(ligne.montant_total)}</td>
                        <td className="is-num">{formatMontant(ligne.prix_moyen_gramme)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className="is-num">{totaux.nombre_ventes}</td>
                      <td className="is-num">{formatGrammes(totaux.quantite_totale_grammes)}</td>
                      <td className="is-num">{(totaux.quantite_totale_grammes / TROY_OZ_GRAMS).toFixed(2)}</td>
                      <td className="is-num">{formatTaux(tauxEffectif(totaux.quantite_totale_grammes, totaux.quantite_totale_grammes))}</td>
                      <td className="is-num">{formatMontant(totaux.montant_total)}</td>
                      <td className="is-num">{formatMontant(prixMoyen)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>
          </>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
