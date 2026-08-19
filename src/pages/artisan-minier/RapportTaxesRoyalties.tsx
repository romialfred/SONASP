import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Download, Landmark, Loader2, Percent, Receipt } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { artisanAnalyticsService, type RapportTaxesRoyalties as LigneTaxes } from '@/services/artisanAnalyticsService';
import {
  defaultPeriode,
  formatMontant,
  formatTaux,
  tauxEffectif,
  telechargerRapport,
  validatePeriode,
} from './rapportsShared';
import './rapports.css';

export type Regroupement = 'mois' | 'trimestre' | 'annee';

const REGROUPEMENTS: Array<{ value: Regroupement; label: string }> = [
  { value: 'mois', label: 'Par mois' },
  { value: 'trimestre', label: 'Par trimestre' },
  { value: 'annee', label: 'Par année' },
];

export interface TotauxTaxes {
  montant_total_ventes: number;
  montant_total_tva: number;
  montant_total_retenue_source: number;
  montant_total_autres_taxes: number;
  montant_total_taxes: number;
  montant_total_royalties: number;
  nombre_factures: number;
}

export const TOTAUX_TAXES_VIDES: TotauxTaxes = {
  montant_total_ventes: 0,
  montant_total_tva: 0,
  montant_total_retenue_source: 0,
  montant_total_autres_taxes: 0,
  montant_total_taxes: 0,
  montant_total_royalties: 0,
  nombre_factures: 0,
};

/** Cumuls de toutes les périodes affichées. */
export function totauxTaxes(lignes: LigneTaxes[]): TotauxTaxes {
  return lignes.reduce<TotauxTaxes>(
    (acc, ligne) => ({
      montant_total_ventes: acc.montant_total_ventes + (ligne.montant_total_ventes || 0),
      montant_total_tva: acc.montant_total_tva + (ligne.montant_total_tva || 0),
      montant_total_retenue_source: acc.montant_total_retenue_source + (ligne.montant_total_retenue_source || 0),
      montant_total_autres_taxes: acc.montant_total_autres_taxes + (ligne.montant_total_autres_taxes || 0),
      montant_total_taxes: acc.montant_total_taxes + (ligne.montant_total_taxes || 0),
      montant_total_royalties: acc.montant_total_royalties + (ligne.montant_total_royalties || 0),
      nombre_factures: acc.nombre_factures + (ligne.nombre_factures || 0),
    }),
    { ...TOTAUX_TAXES_VIDES }
  );
}

export default function RapportTaxesRoyalties() {
  const navigate = useNavigate();
  const periodeInitiale = defaultPeriode();

  const [debut, setDebut] = useState(periodeInitiale.debut);
  const [fin, setFin] = useState(periodeInitiale.fin);
  const [regroupement, setRegroupement] = useState<Regroupement>('mois');
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lignes, setLignes] = useState<LigneTaxes[]>([]);

  const periodeError = validatePeriode(debut, fin);

  const charger = useCallback(async () => {
    if (validatePeriode(debut, fin)) return;
    setLoading(true);
    setErreur(null);
    try {
      setLignes(await artisanAnalyticsService.getRapportTaxesRoyalties(debut, fin, regroupement));
    } catch (reason) {
      setErreur(reason instanceof Error ? reason.message : 'Impossible de charger ce rapport.');
    } finally {
      setLoading(false);
    }
  }, [debut, fin, regroupement]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const totaux = totauxTaxes(lignes);

  const exporter = async () => {
    const message = await telechargerRapport(
      `Taxes_${regroupement}`,
      `rapport-taxes-${regroupement}-${debut}-${fin}.xlsx`,
      lignes
    );
    setErreur(message);
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page rapports">
        <PageHeader
          icon={Landmark}
          title="Rapport taxes et royalties"
          subtitle="TVA, retenue à la source et taxe de développement communal issues des factures émises."
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: 'Rapports', to: '/artisan-minier/rapports' },
            { label: 'Taxes et royalties' },
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

        <section className="sn-card rapports__filtres" aria-label="Paramètres du rapport">
          <label className="sn-field">
            <span className="sn-field__label">Du</span>
            <input type="date" value={debut} max={fin} onChange={(event) => setDebut(event.target.value)} />
          </label>
          <label className="sn-field">
            <span className="sn-field__label">Au</span>
            <input type="date" value={fin} min={debut} onChange={(event) => setFin(event.target.value)} />
          </label>
          <label className="sn-field sn-field--large">
            <span className="sn-field__label">Regroupement</span>
            <select
              value={regroupement}
              onChange={(event) => setRegroupement(event.target.value as Regroupement)}
            >
              {REGROUPEMENTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
            { label: 'Factures émises', value: totaux.nombre_factures, icon: Receipt, tone: 'blue' },
            {
              label: 'TVA collectée',
              value: `${formatMontant(totaux.montant_total_tva)} FCFA`,
              icon: Landmark,
              tone: 'red',
            },
            {
              label: 'Retenue à la source',
              value: `${formatMontant(totaux.montant_total_retenue_source)} FCFA`,
              icon: Landmark,
              tone: 'gold',
            },
            {
              label: 'Taxe de développement communal',
              value: `${formatMontant(totaux.montant_total_royalties)} FCFA`,
              hint: 'Part reversée aux collectivités',
              icon: Percent,
              tone: 'violet',
            },
          ]}
        />

        {loading ? (
          <div className="rapports__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Calcul du rapport…
          </div>
        ) : lignes.length === 0 ? (
          <Section id="vide" icon={Landmark} tone="slate" title="Taxes et royalties">
            <EmptyState
              title="Aucune facture émise sur la période"
              description="Les taxes ne sont consolidées qu’à partir des factures définitives."
            />
          </Section>
        ) : (
          <>
            <Section
              id="evolution"
              icon={Landmark}
              tone="blue"
              title="Évolution des prélèvements"
              description="TVA, retenue à la source et taxe communale par période."
            >
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={lignes} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" />
                  <XAxis dataKey="periode" angle={-35} textAnchor="end" height={72} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatMontant(value)} />
                  <Tooltip formatter={(value) => `${formatMontant(Number(value))} FCFA`} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="montant_total_tva"
                    stackId="taxes"
                    stroke="#ef4444"
                    fill="#fca5a5"
                    name="TVA"
                  />
                  <Area
                    type="monotone"
                    dataKey="montant_total_retenue_source"
                    stackId="taxes"
                    stroke="#b8860b"
                    fill="#fcd9a0"
                    name="Retenue à la source"
                  />
                  <Area
                    type="monotone"
                    dataKey="montant_total_royalties"
                    stackId="taxes"
                    stroke="#8b5cf6"
                    fill="#ddd0fb"
                    name="Taxe communale"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Section>

            <Section
              id="assiette"
              icon={Receipt}
              tone="emerald"
              title="Assiette et prélèvements"
              description="Chiffre d’affaires facturé comparé au total des taxes."
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={lignes} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" />
                  <XAxis dataKey="periode" angle={-35} textAnchor="end" height={72} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatMontant(value)} />
                  <Tooltip formatter={(value) => `${formatMontant(Number(value))} FCFA`} />
                  <Legend />
                  <Bar dataKey="montant_total_ventes" fill="#0f7a56" name="CA facturé" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="montant_total_taxes" fill="#ef4444" name="Total taxes" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section
              id="detail"
              icon={Landmark}
              tone="violet"
              title="Détail par période"
              description="Ligne à ligne, tel que porté par les factures définitives."
            >
              <div className="rapports__table-wrap">
                <table className="rapports__table">
                  <caption className="sr-only">Taxes et royalties par période</caption>
                  <thead>
                    <tr>
                      <th scope="col">Période</th>
                      <th scope="col" className="is-num">Factures</th>
                      <th scope="col" className="is-num">CA facturé</th>
                      <th scope="col" className="is-num">TVA</th>
                      <th scope="col" className="is-num">Retenue source</th>
                      <th scope="col" className="is-num">Autres taxes</th>
                      <th scope="col" className="is-num">Total taxes</th>
                      <th scope="col" className="is-num">Taxe communale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((ligne) => (
                      <tr key={ligne.periode}>
                        <td>{ligne.periode}</td>
                        <td className="is-num">{ligne.nombre_factures}</td>
                        <td className="is-num is-brut">{formatMontant(ligne.montant_total_ventes)}</td>
                        <td className="is-num is-taxe">{formatMontant(ligne.montant_total_tva)}</td>
                        <td className="is-num">{formatMontant(ligne.montant_total_retenue_source)}</td>
                        <td className="is-num">{formatMontant(ligne.montant_total_autres_taxes)}</td>
                        <td className="is-num is-brut">{formatMontant(ligne.montant_total_taxes)}</td>
                        <td className="is-num">{formatMontant(ligne.montant_total_royalties)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className="is-num">{totaux.nombre_factures}</td>
                      <td className="is-num">{formatMontant(totaux.montant_total_ventes)}</td>
                      <td className="is-num is-taxe">{formatMontant(totaux.montant_total_tva)}</td>
                      <td className="is-num">{formatMontant(totaux.montant_total_retenue_source)}</td>
                      <td className="is-num">{formatMontant(totaux.montant_total_autres_taxes)}</td>
                      <td className="is-num">{formatMontant(totaux.montant_total_taxes)}</td>
                      <td className="is-num">{formatMontant(totaux.montant_total_royalties)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>

            <Section
              id="recapitulatif"
              icon={Percent}
              tone="amber"
              title="Récapitulatif de la période"
              description="Montants consolidés et taux effectifs constatés."
            >
              <div className="rapports__recap">
                <div>
                  <h3>Montants</h3>
                  <dl>
                    <div>
                      <dt>Chiffre d’affaires facturé</dt>
                      <dd>{formatMontant(totaux.montant_total_ventes)} FCFA</dd>
                    </div>
                    <div>
                      <dt>TVA collectée</dt>
                      <dd className="is-taxe">{formatMontant(totaux.montant_total_tva)} FCFA</dd>
                    </div>
                    <div>
                      <dt>Retenue à la source</dt>
                      <dd className="is-taxe">{formatMontant(totaux.montant_total_retenue_source)} FCFA</dd>
                    </div>
                    <div className="is-total">
                      <dt>Total des taxes</dt>
                      <dd>{formatMontant(totaux.montant_total_taxes)} FCFA</dd>
                    </div>
                    <div>
                      <dt>Taxe de développement communal</dt>
                      <dd className="is-royalty">{formatMontant(totaux.montant_total_royalties)} FCFA</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h3>Taux effectifs</h3>
                  {/* Sans facture sur la période, les ratios affichaient « NaN% ». */}
                  <dl>
                    <div>
                      <dt>Taux de TVA constaté</dt>
                      <dd>{formatTaux(tauxEffectif(totaux.montant_total_tva, totaux.montant_total_ventes))}</dd>
                    </div>
                    <div>
                      <dt>Taux de retenue constaté</dt>
                      <dd>
                        {formatTaux(tauxEffectif(totaux.montant_total_retenue_source, totaux.montant_total_ventes))}
                      </dd>
                    </div>
                    <div className="is-total">
                      <dt>Taux de prélèvement global</dt>
                      <dd>{formatTaux(tauxEffectif(totaux.montant_total_taxes, totaux.montant_total_ventes))}</dd>
                    </div>
                    <div>
                      <dt>Part communale du CA</dt>
                      <dd className="is-royalty">
                        {formatTaux(tauxEffectif(totaux.montant_total_royalties, totaux.montant_total_ventes))}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
