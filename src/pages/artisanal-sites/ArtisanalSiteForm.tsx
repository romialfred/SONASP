import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Compass,
  HardHat,
  Loader2,
  MapPinned,
  Save,
  UserRoundCog,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs } from '@/components/ui/Tabs';
import { BURKINA_FASO_REGIONS } from '@/data/burkinaFasoData';
import { artisanalSiteService } from '@/services/artisanalSiteService';
import type { ArtisanalSiteInput } from '@/types/artisanalSite';

const inputClass =
  'mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';

const chemicalOptions = ['Borax', 'Charbon actif', 'Cyanure', 'Mercure', 'Aucun produit chimique'];

const createDefaultForm = (): ArtisanalSiteInput => ({
  code: `SA-${new Date().getFullYear()}-`,
  name: '',
  status: 'planned',
  region: '',
  province: '',
  locality: '',
  areaHectares: 0,
  exploitationType: 'artisanale',
  authorizedMiners: 0,
  activeMiners: 0,
  averageHoleDepthMeters: 0,
  authorizedChemicals: [],
  latitude: 12.3714,
  longitude: -1.5197,
  manager: { fullName: '', phone: '', email: '' },
  collectionOfficer: { fullName: '', phone: '', email: '' },
  notes: '',
});

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
      {children}
      {hint && <span className="mt-1.5 block text-[11px] font-normal text-slate-500">{hint}</span>}
    </label>
  );
}

export default function ArtisanalSiteForm() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('identity');
  const [form, setForm] = useState<ArtisanalSiteInput>(createDefaultForm);
  const [loading, setLoading] = useState(Boolean(siteId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let mounted = true;
    artisanalSiteService
      .getSite(siteId)
      .then((site) => {
        if (!mounted) return;
        if (!site) {
          setError('Ce site artisanal est introuvable.');
          return;
        }
        setForm({
          id: site.id,
          code: site.code,
          name: site.name,
          status: site.status,
          region: site.region,
          province: site.province,
          locality: site.locality,
          areaHectares: site.areaHectares,
          exploitationType: site.exploitationType,
          authorizedMiners: site.authorizedMiners,
          activeMiners: site.activeMiners,
          averageHoleDepthMeters: site.averageHoleDepthMeters,
          authorizedChemicals: site.authorizedChemicals,
          latitude: site.latitude,
          longitude: site.longitude,
          manager: site.manager,
          collectionOfficer: site.collectionOfficer,
          notes: site.notes,
        });
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Impossible de charger le site.'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [siteId]);

  const selectedRegion = useMemo(
    () => BURKINA_FASO_REGIONS.find((region) => region.name === form.region),
    [form.region]
  );

  const setValue = <K extends keyof ArtisanalSiteInput>(key: K, value: ArtisanalSiteInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleChemical = (chemical: string) => {
    setForm((current) => {
      if (chemical === 'Aucun produit chimique') {
        return { ...current, authorizedChemicals: current.authorizedChemicals.includes(chemical) ? [] : [chemical] };
      }
      const withoutNone = current.authorizedChemicals.filter((item) => item !== 'Aucun produit chimique');
      return {
        ...current,
        authorizedChemicals: withoutNone.includes(chemical)
          ? withoutNone.filter((item) => item !== chemical)
          : [...withoutNone, chemical],
      };
    });
  };

  const validate = () => {
    if (!form.code.trim() || !form.name.trim()) return 'Le code et le nom du site sont obligatoires.';
    if (!form.region || !form.province || !form.locality.trim()) return 'La région, la province et la localité sont obligatoires.';
    if (form.areaHectares <= 0) return 'La superficie doit être supérieure à zéro.';
    if (form.authorizedMiners < 0 || form.activeMiners < 0) return "Le nombre d'artisans ne peut pas être négatif.";
    if (form.activeMiners > form.authorizedMiners) return "Le nombre d'artisans actifs ne peut pas dépasser la capacité autorisée.";
    if (form.latitude < 9 || form.latitude > 16 || form.longitude < -6 || form.longitude > 3) return 'Les coordonnées doivent se situer au Burkina Faso.';
    if (!form.manager.fullName.trim() || !form.manager.phone.trim()) return 'Le responsable du site et son téléphone sont obligatoires.';
    if (!form.collectionOfficer.fullName.trim() || !form.collectionOfficer.phone.trim()) return 'Le chargé de la collecte et son téléphone sont obligatoires.';
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await artisanalSiteService.saveSite(form);
      navigate('/artisan-sites');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L'enregistrement du site a échoué.");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'identity', label: 'Identification', icon: ClipboardList },
    { id: 'operation', label: 'Exploitation', icon: HardHat },
    { id: 'location', label: 'Géolocalisation', icon: Compass },
    { id: 'team', label: 'Responsables', icon: UserRoundCog },
  ];

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl pb-8">
        <button
          type="button"
          onClick={() => navigate('/artisan-sites')}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour aux sites
        </button>

        <div className="mb-6 flex items-start gap-4">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <MapPinned className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Fiche du site</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{siteId ? 'Modifier le site artisanal' : 'Ajouter un site artisanal'}</h1>
            <p className="mt-2 text-sm text-slate-600">Renseignez les informations réglementaires, opérationnelles et humaines du site.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 pt-2">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
              {(tab) => (
                <div className="pb-6">
                  {loading ? (
                    <div className="grid min-h-64 place-items-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Chargement…</div>
                  ) : (
                    <>
                      {tab === 'identity' && (
                        <section className="grid gap-5 md:grid-cols-2" aria-label="Identification du site">
                          <Field label="Code du site" required hint="Identifiant unique utilisé dans les rapports.">
                            <input className={inputClass} value={form.code} onChange={(event) => setValue('code', event.target.value)} placeholder="SA-2026-007" required />
                          </Field>
                          <Field label="Nom du site" required>
                            <input className={inputClass} value={form.name} onChange={(event) => setValue('name', event.target.value)} placeholder="Site artisanal de…" required />
                          </Field>
                          <Field label="Statut" required>
                            <select className={inputClass} value={form.status} onChange={(event) => setValue('status', event.target.value as ArtisanalSiteInput['status'])}>
                              <option value="planned">Planifié</option>
                              <option value="active">Actif</option>
                              <option value="suspended">Suspendu</option>
                            </select>
                          </Field>
                          <Field label="Type d'exploitation" required>
                            <select className={inputClass} value={form.exploitationType} onChange={(event) => setValue('exploitationType', event.target.value as ArtisanalSiteInput['exploitationType'])}>
                              <option value="artisanale">Artisanale</option>
                              <option value="semi_mecanisee">Semi-mécanisée</option>
                              <option value="mixte">Mixte</option>
                            </select>
                          </Field>
                          <div className="md:col-span-2">
                            <Field label="Notes et observations">
                              <textarea className={`${inputClass} min-h-28 resize-y py-3`} value={form.notes || ''} onChange={(event) => setValue('notes', event.target.value)} placeholder="Contraintes, conditions particulières, historique…" />
                            </Field>
                          </div>
                        </section>
                      )}

                      {tab === 'operation' && (
                        <section className="space-y-6" aria-label="Paramètres d'exploitation">
                          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                            <Field label="Superficie (hectares)" required>
                              <input type="number" min="0.01" step="0.01" className={inputClass} value={form.areaHectares} onChange={(event) => setValue('areaHectares', Number(event.target.value))} required />
                            </Field>
                            <Field label="Artisans autorisés" required>
                              <input type="number" min="0" step="1" className={inputClass} value={form.authorizedMiners} onChange={(event) => setValue('authorizedMiners', Number(event.target.value))} required />
                            </Field>
                            <Field label="Artisans actifs" required hint="Valeur affichée sur la carte.">
                              <input type="number" min="0" step="1" className={inputClass} value={form.activeMiners} onChange={(event) => setValue('activeMiners', Number(event.target.value))} required />
                            </Field>
                            <Field label="Profondeur moyenne (m)" required>
                              <input type="number" min="0" step="0.1" className={inputClass} value={form.averageHoleDepthMeters} onChange={(event) => setValue('averageHoleDepthMeters', Number(event.target.value))} required />
                            </Field>
                          </div>
                          <fieldset>
                            <legend className="text-sm font-semibold text-slate-700">Produits chimiques autorisés</legend>
                            <p className="mt-1 text-xs text-slate-500">Sélection administrative uniquement ; les règles de sécurité applicables restent obligatoires.</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                              {chemicalOptions.map((chemical) => (
                                <label key={chemical} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60">
                                  <input type="checkbox" checked={form.authorizedChemicals.includes(chemical)} onChange={() => toggleChemical(chemical)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                                  {chemical}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        </section>
                      )}

                      {tab === 'location' && (
                        <section className="grid gap-5 md:grid-cols-2" aria-label="Localisation du site">
                          <Field label="Région" required>
                            <select
                              className={inputClass}
                              value={form.region}
                              onChange={(event) => setForm((current) => ({ ...current, region: event.target.value, province: '', locality: '' }))}
                              required
                            >
                              <option value="">Sélectionner une région</option>
                              {BURKINA_FASO_REGIONS.map((region) => <option key={region.name} value={region.name}>{region.name}</option>)}
                            </select>
                          </Field>
                          <Field label="Province" required>
                            <select className={inputClass} value={form.province} onChange={(event) => setValue('province', event.target.value)} disabled={!selectedRegion} required>
                              <option value="">Sélectionner une province</option>
                              {selectedRegion?.provinces?.map((province) => <option key={province} value={province}>{province}</option>)}
                            </select>
                          </Field>
                          <Field label="Localité" required>
                            <input list="site-localities" className={inputClass} value={form.locality} onChange={(event) => setValue('locality', event.target.value)} placeholder="Village, commune ou localité" required />
                            <datalist id="site-localities">{selectedRegion?.cities.map((city) => <option key={city} value={city} />)}</datalist>
                          </Field>
                          <div className="hidden md:block" />
                          <Field label="Latitude" required hint="Limites usuelles du Burkina : 9 à 16° N.">
                            <input type="number" min="9" max="16" step="0.000001" className={inputClass} value={form.latitude} onChange={(event) => setValue('latitude', Number(event.target.value))} required />
                          </Field>
                          <Field label="Longitude" required hint="Limites usuelles du Burkina : 6° O à 3° E.">
                            <input type="number" min="-6" max="3" step="0.000001" className={inputClass} value={form.longitude} onChange={(event) => setValue('longitude', Number(event.target.value))} required />
                          </Field>
                          <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                            Point cartographique : <strong>{form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}</strong>
                          </div>
                        </section>
                      )}

                      {tab === 'team' && (
                        <section className="grid gap-5 lg:grid-cols-2" aria-label="Responsables du site">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <h2 className="font-bold text-slate-900">Responsable du site</h2>
                            <div className="mt-4 space-y-4">
                              <Field label="Nom complet" required><input className={inputClass} value={form.manager.fullName} onChange={(event) => setValue('manager', { ...form.manager, fullName: event.target.value })} required /></Field>
                              <Field label="Téléphone" required><input type="tel" className={inputClass} value={form.manager.phone} onChange={(event) => setValue('manager', { ...form.manager, phone: event.target.value })} placeholder="+226 …" required /></Field>
                              <Field label="Adresse e-mail"><input type="email" className={inputClass} value={form.manager.email || ''} onChange={(event) => setValue('manager', { ...form.manager, email: event.target.value })} /></Field>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <h2 className="font-bold text-slate-900">Chargé de la collecte</h2>
                            <div className="mt-4 space-y-4">
                              <Field label="Nom complet" required><input className={inputClass} value={form.collectionOfficer.fullName} onChange={(event) => setValue('collectionOfficer', { ...form.collectionOfficer, fullName: event.target.value })} required /></Field>
                              <Field label="Téléphone" required><input type="tel" className={inputClass} value={form.collectionOfficer.phone} onChange={(event) => setValue('collectionOfficer', { ...form.collectionOfficer, phone: event.target.value })} placeholder="+226 …" required /></Field>
                              <Field label="Adresse e-mail"><input type="email" className={inputClass} value={form.collectionOfficer.email || ''} onChange={(event) => setValue('collectionOfficer', { ...form.collectionOfficer, email: event.target.value })} /></Field>
                            </div>
                          </div>
                        </section>
                      )}
                    </>
                  )}
                </div>
              )}
            </Tabs>
          </div>

          {error && <div className="mx-6 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}
          <footer className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row">
            <button type="button" onClick={() => navigate('/artisan-sites')} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Annuler</button>
            <button type="submit" disabled={saving || loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {saving ? 'Enregistrement…' : 'Enregistrer le site'}
            </button>
          </footer>
        </form>
      </div>
    </MainLayout>
  );
}
