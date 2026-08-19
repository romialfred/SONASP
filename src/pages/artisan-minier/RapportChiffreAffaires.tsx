import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Banknote, CalendarRange, Download, Loader2, MapPin, UserRound } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Note, PageHeader, Section } from '@/components/ui/sn';
import {
  artisanAnalyticsService,
  type ChiffreAffairesParArtisan,
  type ChiffreAffairesParPeriode,
  type ChiffreAffairesParRegion,
} from '@/services/artisanAnalyticsService';
import { BURKINA_FASO_REGIONS } from '@/data/burkinaFasoData';
import {
  defaultPeriode,
  formatGrammes,
  formatMontant,
  telechargerRapport,
  validatePeriode,
} from './rapportsShared';
import './rapports.css';

export type AxeRapport = 'region' | 'artisan' | 'mensuel' | 'trimestriel' | 'annuel';

const AXES: Array<{ value: AxeRapport; label: string }> = [
  { value: 'region', label: 'Par région' },
  { value: 'artisan', label: 'Par artisan' },
  { value: 'mensuel', label: 'Mensuel' },
  { value: 'trimestriel', label: 'Trimestriel' },
  { value: 'annuel', label: 'Annuel' },
];

/** Un axe temporel se pilote par année, les axes région et artisan par période libre. */
export const axeTemporel = (axe: AxeRapport) => axe === 'mensuel' || axe === 'trimestriel' || axe === 'annuel';

/** Cumul d'une colonne sur les lignes affichées. */
export function totaliser<T>(lignes: T[], champ: (ligne: T) => number): number {
  return lignes.reduce((somme, ligne) => somme + (champ(ligne) || 0), 0);
}

export default function RapportChiffreAffaires() {
  const navigate = useNavigate();
  const periodeInitiale = defaultPeriode();

  const [axe, setAxe] = useState<AxeRapport>('region');
  const [debut, setDebut] = useState(periodeInitiale.debut);
  const [fin, setFin] = useState(periodeInitiale.fin);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [regions, setRegions] = useState<ChiffreAffairesParRegion[]>([]);
  const [artisans, setArtisans] = useState<ChiffreAffairesParArtisan[]>([]);
  const [periodes, setPeriodes] = useState<ChiffreAffairesParPeriode[]>([]);

  const periodeError = validatePeriode(debut, fin);
  const annees = useMemo(
    () => Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index),
    []
  );

  const charger = useCallback(async () => {
    if (!axeTemporel(axe) && validatePeriode(debut, fin)) return;
    setLoading(true);
    setErreur(null);
    try {
      switch (axe) {
        case 'region':
          // Les bornes de période sont désormais transmises : l'écran ignorait le filtre.
          setRegions(await artisanAnalyticsService.getChiffreAffairesParRegion(debut, fin));
          break;
        case 'artisan':
          setArtisans(
            await artisanAnalyticsService.getChiffreAffairesParArtisan(debut, fin, region || undefined)
          );
          break;
        case 'mensuel':
          setPeriodes(await artisanAnalyticsService.getChiffreAffairesParMois(annee));
          break;
        case 'trimestriel':
          setPeriodes(await artisanAnalyticsService.getChiffreAffairesParTrimestre(annee));
          break;
        case 'annuel':
          setPeriodes(await artisanAnalyticsService.getChiffreAffairesParAnnee(annee - 4, annee));
          break;
      }
    } catch (reason) {
      setErreur(reason instanceof Error ? reason.message : 'Impossible de charger ce rapport.');
    } finally {
      setLoading(false);
    }
  }, [axe, annee, debut, fin, region]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const lignesExport =
    axe === 'region' ? regions : axe === 'artisan' ? artisans : periodes;

  const exporter = async () => {
    const suffixe = axeTemporel(axe) ? String(annee) : `${debut}_${fin}`;
    const message = await telechargerRapport(
      `CA_${axe}`,
      `rapport-ca-${axe}-${suffixe}.xlsx`,
      lignesExport as unknown[]
    );
    setErreur(message);
  };

  const topArtisans = artisans.slice(0, 20);

  return (
    <NationalDashboardLayout>
      <div className="sn-page rapports">
        <PageHeader
          icon={Banknote}
          title="Rapport chiffre d’affaires"
          subtitle="Ventes déclarées analysées par territoire, par artisan ou par période."
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: 'Rapports', to: '/artisan-minier/rapports' },
            { label: 'Chiffre d’affaires' },
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
                disabled={loading || lignesExport.length === 0}
              >
                <Download aria-hidden="true" /> Exporter en Excel
              </button>
            </>
          }
        />

        <section className="sn-card rapports__filtres" aria-label="Paramètres du rapport">
          <label className="sn-field sn-field--large">
            <span className="sn-field__label">Axe d’analyse</span>
            <select value={axe} onChange={(event) => setAxe(event.target.value as AxeRapport)}>
              {AXES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {axeTemporel(axe) ? (
            <label className="sn-field">
              <span className="sn-field__label">Année</span>
              <select value={annee} onChange={(event) => setAnnee(Number(event.target.value))}>
                {annees.map((valeur) => (
                  <option key={valeur} value={valeur}>
                    {valeur}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="sn-field">
                <span className="sn-field__label">Du</span>
                <input type="date" value={debut} max={fin} onChange={(event) => setDebut(event.target.value)} />
              </label>
              <label className="sn-field">
                <span className="sn-field__label">Au</span>
                <input type="date" value={fin} min={debut} onChange={(event) => setFin(event.target.value)} />
              </label>
            </>
          )}

          {axe === 'artisan' && (
            <label className="sn-field sn-field--large">
              <span className="sn-field__label">Région</span>
              {/* Le référentiel national remplace une liste de cinq régions codées en dur. */}
              <select value={region} onChange={(event) => setRegion(event.target.value)}>
                <option value="">Toutes les régions</option>
                {BURKINA_FASO_REGIONS.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {periodeError && !axeTemporel(axe) && <span className="rapports__erreur">{periodeError}</span>}
        </section>

        {erreur && (
          <Note tone="danger" icon={AlertCircle}>
            {erreur}
          </Note>
        )}

        {loading ? (
          <div className="rapports__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Calcul du rapport…
          </div>
        ) : axe === 'region' ? (
          <Section
            id="par-region"
            icon={MapPin}
            tone="blue"
            title="Chiffre d’affaires par région"
            description="Brut déclaré, taxes facturées et net versé aux artisans."
          >
            {regions.length === 0 ? (
              <EmptyState title="Aucune vente sur la période" description="Élargissez les bornes de la période." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={regions} margin={{ top: 8, right: 8, left: 8, bottom: 56 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" />
                    <XAxis dataKey="region" angle={-35} textAnchor="end" height={78} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatMontant(value)} />
                    <Tooltip formatter={(value) => `${formatMontant(Number(value))} FCFA`} />
                    <Legend />
                    <Bar dataKey="montant_total_brut" fill="#b8860b" name="CA brut" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="montant_total_taxes" fill="#ef4444" name="Taxes" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="montant_total_net" fill="#0f7a56" name="CA net" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="rapports__table-wrap">
                  <table className="rapports__table">
                    <caption className="sr-only">Chiffre d’affaires par région</caption>
                    <thead>
                      <tr>
                        <th scope="col">Région</th>
                        <th scope="col" className="is-num">Ventes</th>
                        <th scope="col" className="is-num">Artisans</th>
                        <th scope="col" className="is-num">Quantité (g)</th>
                        <th scope="col" className="is-num">CA brut</th>
                        <th scope="col" className="is-num">Taxes</th>
                        <th scope="col" className="is-num">CA net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regions.map((ligne) => (
                        <tr key={ligne.region}>
                          <td>{ligne.region}</td>
                          <td className="is-num">{ligne.nombre_ventes}</td>
                          <td className="is-num">{ligne.nombre_artisans}</td>
                          <td className="is-num">{formatGrammes(ligne.quantite_totale_grammes)}</td>
                          <td className="is-num is-brut">{formatMontant(ligne.montant_total_brut)}</td>
                          <td className="is-num is-taxe">{formatMontant(ligne.montant_total_taxes)}</td>
                          <td className="is-num is-net">{formatMontant(ligne.montant_total_net)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td className="is-num">{totaliser(regions, (l) => l.nombre_ventes)}</td>
                        {/* Un artisan peut déclarer dans plusieurs régions : la somme ne vaut pas effectif national. */}
                        <td className="is-num">—</td>
                        <td className="is-num">{formatGrammes(totaliser(regions, (l) => l.quantite_totale_grammes))}</td>
                        <td className="is-num">{formatMontant(totaliser(regions, (l) => l.montant_total_brut))}</td>
                        <td className="is-num is-taxe">{formatMontant(totaliser(regions, (l) => l.montant_total_taxes))}</td>
                        <td className="is-num is-net">{formatMontant(totaliser(regions, (l) => l.montant_total_net))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="rapports__note-total">
                  Les effectifs d’artisans ne sont pas totalisés : un même artisan peut déclarer dans
                  plusieurs régions.
                </p>
              </>
            )}
          </Section>
        ) : axe === 'artisan' ? (
          <Section
            id="par-artisan"
            icon={UserRound}
            tone="emerald"
            title="Chiffre d’affaires par artisan"
            description={`Vingt premiers contributeurs${region ? ` de la région ${region}` : ''}.`}
          >
            {topArtisans.length === 0 ? (
              <EmptyState title="Aucun artisan déclarant" description="Élargissez la période ou retirez le filtre régional." />
            ) : (
              <div className="rapports__table-wrap">
                <table className="rapports__table">
                  <caption className="sr-only">Chiffre d’affaires par artisan</caption>
                  <thead>
                    <tr>
                      <th scope="col">N° carte</th>
                      <th scope="col">Artisan</th>
                      <th scope="col">Région</th>
                      <th scope="col" className="is-num">Ventes</th>
                      <th scope="col" className="is-num">Quantité (g)</th>
                      <th scope="col" className="is-num">CA brut</th>
                      <th scope="col" className="is-num">CA net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topArtisans.map((ligne) => (
                      <tr key={ligne.artisan_id}>
                        <td>{ligne.numero_carte}</td>
                        <td>{ligne.nom_complet}</td>
                        <td>{ligne.region}</td>
                        <td className="is-num">{ligne.nombre_ventes}</td>
                        <td className="is-num">{formatGrammes(ligne.quantite_totale_grammes)}</td>
                        <td className="is-num is-brut">{formatMontant(ligne.montant_total_brut)}</td>
                        <td className="is-num is-net">{formatMontant(ligne.montant_total_net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {artisans.length > topArtisans.length && (
              <p className="rapports__note-total">
                {artisans.length} artisans déclarants sur la période ; les 20 premiers sont affichés,
                l’export Excel contient la totalité.
              </p>
            )}
          </Section>
        ) : (
          <Section
            id="par-periode"
            icon={CalendarRange}
            tone="violet"
            title="Évolution du chiffre d’affaires"
            description="Brut et net consolidés par période."
          >
            {periodes.length === 0 ? (
              <EmptyState title="Aucune donnée sur cet exercice" description="Choisissez une autre année." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={periodes} margin={{ top: 8, right: 8, left: 8, bottom: 56 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" />
                    <XAxis dataKey="periode" angle={-35} textAnchor="end" height={82} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatMontant(value)} />
                    <Tooltip formatter={(value) => `${formatMontant(Number(value))} FCFA`} />
                    <Legend />
                    <Bar dataKey="montant_total_brut" fill="#b8860b" name="CA brut" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="montant_total_net" fill="#0f7a56" name="CA net" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="rapports__table-wrap">
                  <table className="rapports__table">
                    <caption className="sr-only">Chiffre d’affaires par période</caption>
                    <thead>
                      <tr>
                        <th scope="col">Période</th>
                        <th scope="col" className="is-num">Ventes</th>
                        <th scope="col" className="is-num">Artisans actifs</th>
                        <th scope="col" className="is-num">Quantité (g)</th>
                        <th scope="col" className="is-num">CA brut</th>
                        <th scope="col" className="is-num">CA net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodes.map((ligne) => (
                        <tr key={ligne.periode}>
                          <td>{ligne.periode}</td>
                          <td className="is-num">{ligne.nombre_ventes}</td>
                          <td className="is-num">{ligne.nombre_artisans_actifs}</td>
                          <td className="is-num">{formatGrammes(ligne.quantite_totale_grammes)}</td>
                          <td className="is-num is-brut">{formatMontant(ligne.montant_total_brut)}</td>
                          <td className="is-num is-net">{formatMontant(ligne.montant_total_net)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td className="is-num">{totaliser(periodes, (l) => l.nombre_ventes)}</td>
                        <td className="is-num">—</td>
                        <td className="is-num">{formatGrammes(totaliser(periodes, (l) => l.quantite_totale_grammes))}</td>
                        <td className="is-num">{formatMontant(totaliser(periodes, (l) => l.montant_total_brut))}</td>
                        <td className="is-num is-net">{formatMontant(totaliser(periodes, (l) => l.montant_total_net))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="rapports__note-total">
                  Les artisans actifs ne sont pas totalisés : un même artisan déclare généralement sur
                  plusieurs périodes.
                </p>
              </>
            )}
          </Section>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
