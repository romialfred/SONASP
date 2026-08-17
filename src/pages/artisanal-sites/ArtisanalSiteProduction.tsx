import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Factory,
  Loader2,
  Plus,
  Scale,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MainLayout } from '@/components/layout/MainLayout';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import {
  artisanalSiteService,
  calculateSiteMetrics,
  summarizeSiteProduction,
} from '@/services/artisanalSiteService';
import type { ArtisanalSite, SiteProduction, SiteProductionInput } from '@/types/artisanalSite';

const inputClass =
  'mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

const createProductionForm = (): SiteProductionInput => ({
  siteId: '',
  productionDate: new Date().toISOString().slice(0, 10),
  goldWeightGrams: 0,
  revenueFcfa: 0,
  taxesFcfa: 0,
  artisanCount: 0,
  notes: '',
});

export default function ArtisanalSiteProduction() {
  const [sites, setSites] = useState<ArtisanalSite[]>([]);
  const [productions, setProductions] = useState<SiteProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SiteProductionInput>(createProductionForm);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [siteData, productionData] = await Promise.all([
        artisanalSiteService.listSites(),
        artisanalSiteService.listProductions(),
      ]);
      setSites(siteData);
      setProductions(productionData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger les productions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const metrics = useMemo(() => calculateSiteMetrics(sites, productions), [productions, sites]);
  const summaries = useMemo(() => summarizeSiteProduction(sites, productions), [productions, sites]);
  const chartData = useMemo(
    () => summaries.map((item) => ({ ...item, label: item.siteName.replace('Site artisanal de ', '') })),
    [summaries]
  );
  const siteNames = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);

  const openCreation = () => {
    const firstSite = sites.find((site) => site.status === 'active') || sites[0];
    setForm({ ...createProductionForm(), siteId: firstSite?.id || '', artisanCount: firstSite?.activeMiners || 0 });
    setError(null);
    setModalOpen(true);
  };

  const selectSite = (siteId: string) => {
    const site = sites.find((candidate) => candidate.id === siteId);
    setForm((current) => ({ ...current, siteId, artisanCount: site?.activeMiners || 0 }));
  };

  const saveProduction = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.siteId || form.goldWeightGrams <= 0) {
      setError('Sélectionnez un site et saisissez une production supérieure à zéro.');
      return;
    }
    if (form.revenueFcfa < 0 || form.taxesFcfa < 0 || form.artisanCount < 0) {
      setError('Les valeurs financières et le nombre d’artisans ne peuvent pas être négatifs.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await artisanalSiteService.addProduction(form);
      setProductions((current) => [saved, ...current]);
      setModalOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L'enregistrement de la production a échoué.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1600px] space-y-6 pb-8">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link to="/artisan-sites" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Vue d’ensemble
            </Link>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Performance des sites</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Production des sites artisanaux</h1>
            <p className="mt-2 text-sm text-slate-600">Consolidation de la production d’or, du chiffre d’affaires et des taxes par site.</p>
          </div>
          <button
            type="button"
            onClick={openCreation}
            disabled={loading || sites.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Enregistrer une production
          </button>
        </header>

        {error && !modalOpen && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicateurs de production">
          {[
            { label: 'Sites producteurs', value: summaries.filter((item) => item.productionKilograms > 0).length, icon: Factory, classes: 'bg-emerald-50 text-emerald-700' },
            { label: 'Production cumulée', value: `${metrics.productionKilograms.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`, icon: Scale, classes: 'bg-amber-50 text-amber-700' },
            { label: 'Artisans mobilisés', value: metrics.activeMinerCount.toLocaleString('fr-FR'), icon: Users, classes: 'bg-blue-50 text-blue-700' },
            { label: "Chiffre d'affaires", value: `${compact.format(metrics.revenueFcfa)} FCFA`, icon: Banknote, classes: 'bg-violet-50 text-violet-700' },
            { label: 'Taxes déclarées', value: `${compact.format(metrics.taxesFcfa)} FCFA`, icon: CircleDollarSign, classes: 'bg-rose-50 text-rose-700' },
          ].map(({ label, value, icon: Icon, classes }) => (
            <article key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${classes}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0"><p className="text-[11px] font-semibold text-slate-500">{label}</p><p className="mt-1 truncate text-lg font-bold text-slate-950">{value}</p></div>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-base font-bold text-slate-900">Production et taxes par site</h2>
              <p className="mt-1 text-xs text-slate-500">Production en kilogrammes et taxes en millions de FCFA.</p>
            </div>
            <div className="h-[330px]">
              {loading ? (
                <div className="grid h-full place-items-center text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7edf2" />
                    <XAxis dataKey="label" angle={-20} textAnchor="end" height={60} tick={{ fontSize: 11, fill: '#60738c' }} />
                    <YAxis yAxisId="kg" tick={{ fontSize: 11, fill: '#60738c' }} />
                    <YAxis yAxisId="tax" orientation="right" tickFormatter={(value) => `${Math.round(value / 1_000_000)} M`} tick={{ fontSize: 11, fill: '#60738c' }} />
                    <Tooltip formatter={(value, name) => {
                      const numericValue = Number(value ?? 0);
                      return name === 'Production (kg)'
                        ? [`${numericValue.toLocaleString('fr-FR')} kg`, name]
                        : [`${money.format(numericValue)} FCFA`, name];
                    }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="kg" dataKey="productionKilograms" name="Production (kg)" fill="#0f9f6e" radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="tax" dataKey="taxesFcfa" name="Taxes (FCFA)" fill="#d99a00" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">Classement des sites</h2>
              <p className="mt-1 text-xs text-slate-500">Selon la production enregistrée.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {summaries.slice(0, 6).map((item, index) => (
                <div key={item.siteId} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-xs text-slate-900">{item.siteName}</strong>
                    <span className="mt-1 block text-[10px] text-slate-500">CA {compact.format(item.revenueFcfa)} FCFA · Taxes {compact.format(item.taxesFcfa)} FCFA</span>
                  </div>
                  <strong className="text-sm text-emerald-700">{item.productionKilograms.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg</strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="production-history-title">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 id="production-history-title" className="text-base font-bold text-slate-900">Historique des déclarations</h2>
            <p className="mt-1 text-xs text-slate-500">Dernières productions enregistrées par les équipes de collecte.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Site</th><th className="px-5 py-3 text-right">Production</th><th className="px-5 py-3 text-right">Artisans</th><th className="px-5 py-3 text-right">Chiffre d'affaires</th><th className="px-5 py-3 text-right">Taxes</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productions.map((production) => (
                  <tr key={production.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-700">{new Date(`${production.productionDate}T12:00:00`).toLocaleDateString('fr-FR')}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{siteNames.get(production.siteId) || 'Site non référencé'}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-700">{(production.goldWeightGrams / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{production.artisanCount}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{money.format(production.revenueFcfa)} FCFA</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-amber-700">{money.format(production.taxesFcfa)} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal isOpen={modalOpen} onClose={() => !saving && setModalOpen(false)} title="Enregistrer une production" size="lg">
        <form onSubmit={saveProduction}>
          <ModalBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Site artisanal <span className="text-red-500">*</span>
                <select className={inputClass} value={form.siteId} onChange={(event) => selectSite(event.target.value)} required>
                  <option value="">Sélectionner un site</option>
                  {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Date de production <span className="text-red-500">*</span>
                <span className="relative block"><CalendarDays className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-slate-400" /><input type="date" className={`${inputClass} pl-9`} value={form.productionDate} onChange={(event) => setForm((current) => ({ ...current, productionDate: event.target.value }))} required /></span>
              </label>
              <label className="text-sm font-semibold text-slate-700">Poids d'or (grammes) <span className="text-red-500">*</span><input type="number" min="0.001" step="0.001" className={inputClass} value={form.goldWeightGrams} onChange={(event) => setForm((current) => ({ ...current, goldWeightGrams: Number(event.target.value) }))} required /></label>
              <label className="text-sm font-semibold text-slate-700">Artisans mobilisés <span className="text-red-500">*</span><input type="number" min="0" step="1" className={inputClass} value={form.artisanCount} onChange={(event) => setForm((current) => ({ ...current, artisanCount: Number(event.target.value) }))} required /></label>
              <label className="text-sm font-semibold text-slate-700">Chiffre d'affaires (FCFA) <span className="text-red-500">*</span><input type="number" min="0" step="1" className={inputClass} value={form.revenueFcfa} onChange={(event) => setForm((current) => ({ ...current, revenueFcfa: Number(event.target.value) }))} required /></label>
              <label className="text-sm font-semibold text-slate-700">Taxes et redevances (FCFA) <span className="text-red-500">*</span><input type="number" min="0" step="1" className={inputClass} value={form.taxesFcfa} onChange={(event) => setForm((current) => ({ ...current, taxesFcfa: Number(event.target.value) }))} required /></label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">Observations<textarea className={`${inputClass} min-h-24 resize-y py-3`} value={form.notes || ''} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</div>}
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</button>
          </ModalFooter>
        </form>
      </Modal>
    </MainLayout>
  );
}
