import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Ban,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  Upload,
  ExternalLink,
  Pickaxe,
  Compass,
  HardHat,
  ImagePlus,
  Images,
  Info,
  Loader2,
  Lock,
  MapPinned,
  Phone,
  Save,
  Search,
  StickyNote,
  Trash2,
  RefreshCw,
  UserRoundCog,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { SiteLocationPicker } from '@/components/artisanal-sites/SiteLocationPicker';
import { BURKINA_FASO_REGIONS } from '@/data/burkinaFasoData';
import { artisanalSiteService } from '@/services/artisanalSiteService';
import { generateSiteCode } from '@/services/artisanalSiteCode';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { MAX_SITE_PHOTOS, removeUnattachedSitePhoto, uploadSitePhoto } from '@/services/sitePhotoService';
import { SitePhotoPreview } from '@/components/artisanal-sites/SitePhotoPreview';
import type { ArtisanalSite, ArtisanalSiteInput, ArtisanalSiteStatus } from '@/types/artisanalSite';
import { useAuth } from '@/contexts/AuthContext';
import { canManageMiningRegistry } from '@/lib/miningRegistryAccess';
import { aeaExpiryDate, emptyAea, validateSiteAea } from '@/lib/siteFormalization';
import { siteAeaDocumentService, validateAeaFile } from '@/services/siteAeaDocumentService';
import './artisanal-site-form.css';
import './artisanal-site-details.css';

const CHEMICAL_OPTIONS = ['Borax', 'Charbon actif', 'Cyanure', 'Mercure', 'Aucun produit chimique'];

const STATUS_LABELS: Record<ArtisanalSiteStatus, string> = {
  active: 'Actif',
  planned: 'Planifié',
  suspended: 'Suspendu',
};

/** Statuts proposés en contrôle segmenté plutôt qu'en liste déroulante. */
const STATUS_OPTIONS = [
  { value: 'planned' as const, label: 'Planifié', icon: Clock3 },
  { value: 'active' as const, label: 'Actif', icon: CheckCircle2 },
  { value: 'suspended' as const, label: 'Suspendu', icon: Ban },
];

/** Champs obligatoires, base du taux de complétude affiché en en-tête. */
const REQUIRED_FIELDS: Array<(form: ArtisanalSiteInput) => boolean> = [
  (form) => form.name.trim() !== '',
  (form) => form.region !== '',
  (form) => form.province !== '',
  (form) => form.locality.trim() !== '',
  (form) => form.areaHectares > 0,
  (form) => form.authorizedMiners >= 0,
  (form) => form.activeMiners >= 0 && form.activeMiners <= form.authorizedMiners,
  (form) => Boolean(form.formalization),
  (form) => form.manager.fullName.trim() !== '',
  (form) => form.manager.phone.trim() !== '',
  (form) => form.collectionOfficer.fullName.trim() !== '',
  (form) => form.collectionOfficer.phone.trim() !== '',
];

interface SectionProps {
  id: string;
  title: string;
  description: string;
  icon: typeof ClipboardList;
  tone: 'emerald' | 'blue' | 'amber' | 'violet' | 'slate';
  children: ReactNode;
}

function Section({ id, title, description, icon: Icon, tone, children }: SectionProps) {
  return (
    <section className="site-form__section" aria-labelledby={`${id}-title`}>
      <header className={`site-form__section-head is-${tone}`}>
        <span className="site-form__section-icon"><Icon aria-hidden="true" /></span>
        <div>
          <h3 id={`${id}-title`}>{title}</h3>
          <p>{description}</p>
        </div>
      </header>
      <div className="site-form__section-body">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
  wide,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`site-form__field${wide ? ' is-wide' : ''}`}>
      <span className="site-form__label">
        {label}
        {required && <i aria-hidden="true">*</i>}
      </span>
      {children}
    </label>
  );
}

const initials = (fullName: string) =>
  fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('fr'))
    .join('') || '—';

const createDefaultForm = (): ArtisanalSiteInput => ({
  code: '',
  name: '',
  status: 'planned',
  region: '',
  province: '',
  locality: '',
  areaHectares: 0,
  exploitationType: 'artisanale',
  formalization: null,
  aea: null,
  authorizedMiners: 0,
  activeMiners: 0,
  averageHoleDepthMeters: 0,
  authorizedChemicals: [],
  latitude: 12.3714,
  longitude: -1.5197,
  photos: [],
  manager: { fullName: '', phone: '', email: '' },
  collectionOfficer: { fullName: '', phone: '', email: '' },
  notes: '',
});

export default function ArtisanalSiteForm() {
  const { siteId } = useParams<{ siteId: string }>();
  const { user } = useAuth();
  const contextKey = JSON.stringify([siteId, user?.id, user?.organization_id, user?.mining_company_id, user?.access_role_id, user?.role, user?.organization_type, user?.is_active, user?.access_portal_id, user?.access_portal_code, user?.actor_category_code, [...(user?.capabilities || [])].sort(), [...(user?.module_codes || [])].sort(), [...(user?.site_ids || [])].sort(), [...(user?.responsibilities || [])].sort(), [...(user?.module_domains || [])].sort(), user && 'account_type' in user ? user.account_type : undefined]);
  return <ArtisanalSiteFormContent key={contextKey} />;
}

type PendingPhoto = { id: number; file: File; failed: boolean };

function ArtisanalSiteFormContent() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [aeaFile, setAeaFile] = useState<File | null>(null);
  const [aeaUrl, setAeaUrl] = useState<string | null>(null);
  const [form, setForm] = useState<ArtisanalSiteInput>(createDefaultForm);
  const [sites, setSites] = useState<ArtisanalSite[]>([]);
  const [siteSearch, setSiteSearch] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cleaningPhotos, setCleaningPhotos] = useState(false);
  const photoOperation = useRef(false);
  const nextPhotoId = useRef(0);
  const mounted = useRef(true);
  const freshPhotos = useRef(new Set<string>());
  // Après un appel de sauvegarde, un échec réseau ne prouve pas l'absence de rattachement.
  const submittedPhotos = useRef(new Set<string>());
  const [loading, setLoading] = useState(Boolean(siteId));
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    const fresh = freshPhotos.current;
    const submitted = submittedPhotos.current;
    return () => {
      mounted.current = false;
      for (const path of fresh) if (!submitted.has(path)) {
        void removeUnattachedSitePhoto(path).catch(() => {
          console.warn('Le nettoyage d’une photo non enregistrée n’a pas pu être confirmé.');
        });
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    artisanalSiteService
      .listSites()
      .then((data) => mounted && setSites(data))
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setAeaFile(null);
    setLoadFailed(false);
    setError(null);
    if (!siteId) {
      setForm(createDefaultForm());
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    artisanalSiteService
      .getSite(siteId)
      .then((site) => {
        if (!mounted) return;
        if (!site) {
          setLoadFailed(true);
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
          exploitationType: 'artisanale',
          formalization: site.formalization || null,
          aea: site.aea || null,
          authorizedMiners: site.authorizedMiners,
          activeMiners: site.activeMiners,
          averageHoleDepthMeters: site.averageHoleDepthMeters,
          authorizedChemicals: site.authorizedChemicals,
          latitude: site.latitude,
          longitude: site.longitude,
          photos: site.photos || [],
          manager: site.manager,
          collectionOfficer: site.collectionOfficer,
          notes: site.notes,
        });
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setLoadFailed(true);
        setError(messageErreurUtilisateur(reason));
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [siteId]);

  /** Le code est calculé, jamais saisi : il suit la région et le compteur national. */
  useEffect(() => {
    if (siteId) return;
    setForm((current) => ({ ...current, code: generateSiteCode(current.region, sites) }));
  }, [form.region, siteId, sites]);

  useEffect(() => {
    let current = true;
    setAeaUrl(null);
    if (form.aea?.documentPath) siteAeaDocumentService.url(form.aea.documentPath)
      .then(url => { if (current) setAeaUrl(url); }).catch(() => undefined);
    return () => { current = false; };
  }, [form.aea?.documentPath]);

  const selectedRegion = useMemo(
    () => BURKINA_FASO_REGIONS.find((region) => region.name === form.region),
    [form.region]
  );

  const filteredSites = useMemo(() => {
    const query = siteSearch.trim().toLocaleLowerCase('fr');
    if (!query) return sites;
    return sites.filter((site) =>
      [site.name, site.code, site.region, site.locality]
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(query)
    );
  }, [siteSearch, sites]);

  const occupancy =
    form.authorizedMiners > 0 ? Math.round((form.activeMiners / form.authorizedMiners) * 100) : 0;

  const completion = useMemo(() => {
    const fields = REQUIRED_FIELDS.map(isFilled => isFilled(form));
    if (form.formalization === 'formalized') fields.push(
      Boolean(form.aea?.number.trim()), Boolean(form.aea && aeaExpiryDate(form.aea.issuedOn, form.aea.durationMonths)),
      Boolean(aeaFile || form.aea?.documentPath),
    );
    return Math.round(fields.filter(Boolean).length / fields.length * 100);
  }, [form, aeaFile]);

  const setValue = <K extends keyof ArtisanalSiteInput>(key: K, value: ArtisanalSiteInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleChemical = (chemical: string) => {
    setForm((current) => {
      if (chemical === 'Aucun produit chimique') {
        return {
          ...current,
          authorizedChemicals: current.authorizedChemicals.includes(chemical) ? [] : [chemical],
        };
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

  const uploadPhotos = async (entries: PendingPhoto[]) => {
    if (photoOperation.current || saving || loading || loadFailed || !canManageMiningRegistry(user)) return;
    photoOperation.current = true;
    setUploading(true); setPhotoError(null);
    const selected = new Set(entries.map(entry => entry.id));
    setPendingPhotos(current => current.map(entry => selected.has(entry.id) ? { ...entry, failed: false } : entry));
    const results = await Promise.allSettled(entries.map(entry => uploadSitePhoto(entry.file)));
    const successes = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    if (!mounted.current) {
      await Promise.allSettled(successes.map(path => removeUnattachedSitePhoto(path).catch(() => {
        console.warn('Le nettoyage d’une photo non enregistrée n’a pas pu être confirmé.');
      })));
      return;
    }
    successes.forEach(path => freshPhotos.current.add(path));
    setForm(current => ({ ...current, photos: [...current.photos, ...successes] }));
    const succeeded = new Set(entries.filter((_, index) => results[index].status === 'fulfilled').map(entry => entry.id));
    setPendingPhotos(current => current.filter(entry => !succeeded.has(entry.id)).map(entry => selected.has(entry.id) ? { ...entry, failed: true } : entry));
    if (results.some(result => result.status === 'rejected')) setPhotoError('Certaines photos n’ont pas été déposées. Réessayez ou retirez les fichiers en échec avant d’enregistrer le site.');
    photoOperation.current = false;
    setUploading(false);
  };

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (files.length === 0 || photoOperation.current || saving || loading || loadFailed || !canManageMiningRegistry(user)) return;

    const room = MAX_SITE_PHOTOS - form.photos.length - pendingPhotos.length;
    if (files.length > room) {
      setPhotoError(`Trois photos au maximum par site. Sélectionnez au plus ${Math.max(0, room)} fichier(s) supplémentaire(s).`);
      return;
    }
    const entries = files.map(file => ({ id: ++nextPhotoId.current, file, failed: false }));
    setPendingPhotos(current => [...current, ...entries]);
    void uploadPhotos(entries);
  };

  const removePhoto = async (reference: string, index: number) => {
    if (photoOperation.current || saving) return;
    photoOperation.current = true; setCleaningPhotos(true); setPhotoError(null);
    try {
      if (freshPhotos.current.has(reference) && !submittedPhotos.current.has(reference)) {
        await removeUnattachedSitePhoto(reference);
        freshPhotos.current.delete(reference);
      }
      if (mounted.current) setForm(current => ({ ...current, photos: current.photos.filter((_, position) => position !== index) }));
    } catch {
      if (mounted.current) setPhotoError('Le retrait de la photo a échoué. Elle est conservée dans le formulaire ; réessayez.');
    } finally {
      photoOperation.current = false;
      if (mounted.current) setCleaningPhotos(false);
    }
  };

  const leaveForm = async (destination: string) => {
    if (photoOperation.current || saving) return;
    photoOperation.current = true; setCleaningPhotos(true); setPhotoError(null);
    const paths = [...freshPhotos.current].filter(path => !submittedPhotos.current.has(path));
    const outcomes = await Promise.allSettled(paths.map(removeUnattachedSitePhoto));
    const removed = new Set(paths.filter((_, index) => outcomes[index].status === 'fulfilled'));
    removed.forEach(path => freshPhotos.current.delete(path));
    if (!mounted.current) return;
    setForm(current => ({ ...current, photos: current.photos.filter(path => !removed.has(path)) }));
    photoOperation.current = false; setCleaningPhotos(false);
    if (outcomes.some(result => result.status === 'rejected')) {
      setPhotoError('Le retrait des photos non enregistrées a échoué. Réessayez avant de quitter.');
      return;
    }
    navigate(destination);
  };

  const validate = () => {
    if (!form.formalization) return 'Choisissez la catégorie du site.';
    if (form.formalization === 'formalized') {
      const aeaError = validateSiteAea(form.aea, Boolean(aeaFile));
      if (aeaError) return aeaError;
    }
    if (!form.name.trim()) return 'Le nom du site est obligatoire.';
    if (!form.region || !form.province || !form.locality.trim())
      return 'La région, la province et la localité sont obligatoires.';
    if (form.areaHectares <= 0) return 'La superficie doit être supérieure à zéro.';
    if (form.authorizedMiners < 0 || form.activeMiners < 0)
      return "Le nombre d'artisans ne peut pas être négatif.";
    if (form.activeMiners > form.authorizedMiners)
      return "Le nombre d'artisans actifs ne peut pas dépasser la capacité autorisée.";
    if (form.latitude < 9 || form.latitude > 16 || form.longitude < -6 || form.longitude > 3)
      return 'Les coordonnées doivent se situer au Burkina Faso.';
    if (!form.manager.fullName.trim() || !form.manager.phone.trim())
      return 'Le responsable du site et son téléphone sont obligatoires.';
    if (!form.collectionOfficer.fullName.trim() || !form.collectionOfficer.phone.trim())
      return 'Le chargé de la collecte et son téléphone sont obligatoires.';
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || photoOperation.current || loading || loadFailed || !canManageMiningRegistry(user)) return;
    if (pendingPhotos.length) {
      setError('Réessayez ou retirez les photos en échec avant d’enregistrer le site.');
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      form.photos.forEach(path => { if (freshPhotos.current.has(path)) submittedPhotos.current.add(path); });
      const saved = await artisanalSiteService.saveSite(form, aeaFile);
      freshPhotos.current.clear();
      if (!mounted.current) return;
      navigate(`/artisan-sites/${saved.id}`, { state: { saved: true } });
    } catch (reason) {
      if (!mounted.current) return;
      setError(messageErreurUtilisateur(reason));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const contacts = [
    {
      key: 'manager' as const,
      title: 'Responsable du site',
      role: 'Autorité de terrain, garant de l’exploitation',
      tone: 'is-emerald',
      contact: form.manager,
    },
    {
      key: 'collectionOfficer' as const,
      title: 'Chargé de la collecte',
      role: 'Interlocuteur SONASP pour la remontée de l’or',
      tone: 'is-blue',
      contact: form.collectionOfficer,
    },
  ];

  if (!canManageMiningRegistry(user)) return <NationalDashboardLayout><div className="site-form__error" role="alert">La création et la modification des sites sont réservées à la DGMG et à l’administrateur.</div></NationalDashboardLayout>;

  return (
    <NationalDashboardLayout>
      <div className="site-form">
        <header className="site-form__intro">
          <span className="site-form__intro-icon"><MapPinned aria-hidden="true" /></span>
          <div>
            <h2>{siteId ? 'Modifier le site artisanal' : 'Ajouter un site artisanal'}</h2>
            <p className="site-form__subtitle">
              Renseignez les informations réglementaires, opérationnelles et humaines du site.
            </p>
          </div>

          <div className="site-form__meta">
            <div className="site-form__meta-tile is-code">
              <p><Lock aria-hidden="true" /> Code du site</p>
              <output>{form.code || 'SA-XXX-AAAA-NNNN'}</output>
              <small>Attribué automatiquement</small>
            </div>

            <div className="site-form__meta-tile">
              <p>Fiche complétée</p>
              <output>{completion} %</output>
              <i><b style={{ width: `${completion}%` }} /></i>
            </div>

            <div className={`site-form__meta-tile${occupancy > 100 ? ' is-over' : ''}`}>
              <p>Taux d’occupation</p>
              <output>{occupancy} %</output>
              <i><b style={{ width: `${Math.min(100, occupancy)}%` }} /></i>
              <small>
                {occupancy > 100
                  ? 'Capacité dépassée'
                  : `${form.activeMiners.toLocaleString('fr-FR')} / ${form.authorizedMiners.toLocaleString('fr-FR')} artisans`}
              </small>
            </div>
          </div>
        </header>

        {error && <div className="site-form__error" role="alert">{error}</div>}

        <div className="site-form__layout">
          <form onSubmit={handleSubmit} className="site-form__main">
            {loading ? (
              <div className="site-form__loading"><Loader2 aria-hidden="true" /> Chargement de la fiche…</div>
            ) : (
              <>
                <Section
                  id="identity"
                  title="Identification"
                  description="Références administratives du site et régime d’exploitation."
                  icon={ClipboardList}
                  tone="emerald"
                >
                  <div className="site-form__row is-name">
                    <Field label="Nom du site" required>
                      <input
                        className="is-lead"
                        value={form.name}
                        onChange={(event) => setValue('name', event.target.value)}
                        placeholder="Site artisanal de…"
                        required
                      />
                    </Field>

                    <div className="site-form__field">
                      <span className="site-form__label">Statut <i aria-hidden="true">*</i></span>
                      <div className="site-form__segmented" role="radiogroup" aria-label="Statut du site">
                        {STATUS_OPTIONS.map(({ value, label, icon: Icon }) => (
                          <label key={value} className={form.status === value ? `is-active is-${value}` : ''}>
                            <input
                              type="radio"
                              name="site-status"
                              value={value}
                              checked={form.status === value}
                              onChange={() => setValue('status', value)}
                            />
                            <Icon aria-hidden="true" />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="site-fixed-type"><Pickaxe aria-hidden="true" /><span><small>Type d’exploitation</small><strong>Site artisanal</strong></span></div>
                  <fieldset className="site-form__choices site-category-choices">
                    <legend>Catégorie du site <i aria-hidden="true">*</i></legend>
                    <div>
                      {([
                        ['formalized', 'Site formalisé', 'Dispose d’une attestation d’exploitation artisanale (AEA).'],
                        ['non_formalized', 'Site non formalisé', 'Ne dispose pas d’une AEA.'],
                      ] as const).map(([value, label, description]) => (
                        <label key={value} className={form.formalization === value ? 'is-checked' : ''}>
                          <input type="radio" name="formalization" value={value} required checked={form.formalization === value}
                            onChange={() => setForm(current => ({ ...current, formalization: value, aea: current.aea || emptyAea() }))} />
                          <span className="site-form__choice-icon">{value === 'formalized' ? <FileCheck2 aria-hidden="true" /> : <Pickaxe aria-hidden="true" />}</span>
                          <span><strong>{label}</strong><small>{description}</small></span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </Section>

                {form.formalization === 'formalized' && (
                  <Section id="aea" title="Attestation d’exploitation artisanale" description="Références et justificatif de l’AEA du site." icon={FileCheck2} tone="emerald">
                    <div className="site-aea-fields">
                      <Field label="Numéro de l’AEA" required>
                        <input value={form.aea?.number || ''} maxLength={120} required placeholder="Référence de l’attestation"
                          onChange={event => setValue('aea', { ...(form.aea || emptyAea()), number: event.target.value })} />
                      </Field>
                      <Field label="Date d’émission" required>
                        <input type="date" required value={form.aea?.issuedOn || ''}
                          onChange={event => setValue('aea', { ...(form.aea || emptyAea()), issuedOn: event.target.value })} />
                      </Field>
                      <Field label="Durée de validité (mois)" required>
                        <input type="number" min={1} max={1200} step={1} required value={form.aea?.durationMonths || ''}
                          onChange={event => setValue('aea', { ...(form.aea || emptyAea()), durationMonths: Number(event.target.value) })} />
                      </Field>
                    </div>
                    <p className="site-aea-expiry">Date d’expiration calculée : <strong>{form.aea && aeaExpiryDate(form.aea.issuedOn, form.aea.durationMonths)
                      ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(aeaExpiryDate(form.aea.issuedOn, form.aea.durationMonths)!)) : 'À renseigner'}</strong></p>
                    <div className="site-aea-upload">
                      <Upload aria-hidden="true" />
                      <div><label htmlFor="aea-file"><strong>{aeaFile || form.aea?.documentPath ? 'Remplacer le justificatif AEA' : 'Joindre le justificatif AEA'}</strong></label>
                        <p>PDF, JPEG ou PNG · 10 Mo maximum</p>
                        <input id="aea-file" type="file" accept="application/pdf,image/jpeg,image/png" disabled={saving}
                          onChange={event => {
                            const file = event.target.files?.[0]; event.target.value = '';
                            if (!file) return;
                            try { validateAeaFile(file); setAeaFile(file); setError(null); }
                            catch (reason) { setError(messageErreurUtilisateur(reason)); }
                          }} />
                        {(aeaFile || form.aea?.documentName) && <p className="site-aea-filename">{aeaFile?.name || form.aea?.documentName}</p>}
                        {aeaFile && <button type="button" className="site-text-button" onClick={() => setAeaFile(null)}>Annuler le remplacement</button>}
                        {aeaUrl && <a href={aeaUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" /> Consulter le document enregistré</a>}
                      </div>
                    </div>
                  </Section>
                )}

                <Section
                  id="location"
                  title="Localisation"
                  description="Rattachement territorial et point cartographique du périmètre."
                  icon={Compass}
                  tone="blue"
                >
                  <div className="site-form__row is-territory">
                    <Field label="Région" required>
                      <select
                        value={form.region}
                        onChange={(event) => setForm((current) => ({ ...current, region: event.target.value, province: '', locality: '' }))}
                        required
                      >
                        <option value="">Sélectionner une région</option>
                        {BURKINA_FASO_REGIONS.map((region) => (
                          <option key={region.name} value={region.name}>{region.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Province" required>
                      <select value={form.province} onChange={(event) => setValue('province', event.target.value)} disabled={!selectedRegion} required>
                        <option value="">Sélectionner une province</option>
                        {selectedRegion?.provinces?.map((province) => (
                          <option key={province} value={province}>{province}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Localité" required>
                      <input list="site-localities" value={form.locality} onChange={(event) => setValue('locality', event.target.value)} placeholder="Village, commune ou localité" required />
                      <datalist id="site-localities">
                        {selectedRegion?.cities.map((city) => <option key={city} value={city} />)}
                      </datalist>
                    </Field>
                  </div>

                  <div className="site-form__map-block">
                    <SiteLocationPicker
                      latitude={form.latitude}
                      longitude={form.longitude}
                      region={form.region}
                      province={form.province}
                      onChange={({ latitude, longitude, region, province }) =>
                        setForm((current) => ({
                          ...current,
                          latitude,
                          longitude,
                          // Le clic fait foi : il renseigne aussi le rattachement territorial.
                          region: region || current.region,
                          province: province || current.province,
                        }))
                      }
                    />

                    <div className="site-form__map-side">
                      <Field label="Superficie (hectares)" required>
                        <input type="number" min="0.01" step="0.01" value={form.areaHectares} onChange={(event) => setValue('areaHectares', Number(event.target.value))} required />
                      </Field>
                      <Field label="Latitude" required>
                        <input type="number" min="9" max="16" step="0.000001" value={form.latitude} onChange={(event) => setValue('latitude', Number(event.target.value))} required />
                      </Field>
                      <Field label="Longitude" required>
                        <input type="number" min="-6" max="3" step="0.000001" value={form.longitude} onChange={(event) => setValue('longitude', Number(event.target.value))} required />
                      </Field>
                      <p className="site-form__map-tip">
                        Cliquez sur la carte : la région, la province et les coordonnées se
                        renseignent ensemble.
                      </p>
                    </div>
                  </div>
                </Section>

                <Section
                  id="operation"
                  title="Capacité d’exploitation"
                  description="Effectifs autorisés, profondeur des puits et produits chimiques admis."
                  icon={HardHat}
                  tone="amber"
                >
                  <div className="site-form__row is-capacity">
                    <Field label="Artisans autorisés" required>
                      <input type="number" min="0" step="1" value={form.authorizedMiners} onChange={(event) => setValue('authorizedMiners', Number(event.target.value))} required />
                    </Field>
                    <Field label="Artisans actifs" required>
                      <input type="number" min="0" step="1" value={form.activeMiners} onChange={(event) => setValue('activeMiners', Number(event.target.value))} required />
                    </Field>
                    <Field label="Profondeur moyenne (m)" required>
                      <input type="number" min="0" step="0.1" value={form.averageHoleDepthMeters} onChange={(event) => setValue('averageHoleDepthMeters', Number(event.target.value))} required />
                    </Field>
                  </div>

                  <fieldset className="site-form__chemicals">
                    <legend>Produits chimiques autorisés</legend>
                    <div>
                      {CHEMICAL_OPTIONS.map((chemical) => (
                        <label key={chemical} className={form.authorizedChemicals.includes(chemical) ? 'is-checked' : ''}>
                          <input type="checkbox" checked={form.authorizedChemicals.includes(chemical)} onChange={() => toggleChemical(chemical)} />
                          {chemical}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <p className="site-form__note">
                    <Info aria-hidden="true" />
                    La production du site n’est pas saisie ici : elle est consolidée automatiquement à
                    partir des ventes d’or déclarées par les artisans rattachés au site.
                  </p>
                </Section>

                <Section
                  id="photos"
                  title="Photos du site"
                  description={`Jusqu’à ${MAX_SITE_PHOTOS} vues : accès, puits, aire de traitement.`}
                  icon={Images}
                  tone="slate"
                >
                  <div className="site-form__photos">
                    {form.photos.map((reference, index) => (
                      <figure key={`${reference}:${index}`} className="site-form__photo">
                        <SitePhotoPreview reference={reference} label={`Photo ${index + 1} du site`} contextKey={siteId || 'new'} />
                        <button type="button" onClick={() => void removePhoto(reference, index)} aria-label={`Retirer la photo ${index + 1}`} disabled={uploading || cleaningPhotos || saving}>
                          <Trash2 aria-hidden="true" />
                        </button>
                      </figure>
                    ))}

                    {pendingPhotos.map(entry => <div key={entry.id} className="site-form__photo-add" style={{ cursor: 'default', minWidth: 0, padding: 8, borderColor: entry.failed ? '#b3261e' : undefined }}>
                      <span title={entry.file.name} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.file.name}</span>
                      <small role={entry.failed ? 'alert' : 'status'}>{entry.failed ? 'Dépôt échoué' : 'Dépôt en cours…'}</small>
                      {entry.failed && <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="site-text-button" onClick={() => void uploadPhotos([entry])} disabled={uploading || cleaningPhotos || saving} aria-label={`Réessayer le dépôt de ${entry.file.name}`}><RefreshCw size={14} aria-hidden="true" /> Réessayer</button>
                        <button type="button" className="site-text-button" disabled={uploading || cleaningPhotos || saving} onClick={() => { setPendingPhotos(current => current.filter(photo => photo.id !== entry.id)); setPhotoError(null); }} aria-label={`Retirer le fichier ${entry.file.name}`}>Retirer</button>
                      </div>}
                    </div>)}
                    {form.photos.length + pendingPhotos.length < MAX_SITE_PHOTOS && (
                      <label className="site-form__photo-add">
                        {uploading ? <Loader2 className="is-spinning" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
                        <span>{uploading ? 'Traitement…' : 'Ajouter une photo'}</span>
                        <small>JPEG ou PNG · {form.photos.length}/{MAX_SITE_PHOTOS}</small>
                        <input type="file" accept="image/*" multiple aria-label="Ajouter des photos du site" onChange={addPhotos} disabled={uploading || cleaningPhotos || saving || loading || loadFailed} />
                      </label>
                    )}
                  </div>
                  {photoError && <p className="site-form__error" role="alert">{photoError}</p>}
                  {pendingPhotos.length > 0 && <p className="site-form__note">Les photos réussies sont conservées. Les fichiers en échec doivent être repris ou retirés avant la sauvegarde.</p>}
                </Section>

                <Section
                  id="team"
                  title="Responsables"
                  description="Interlocuteurs SONASP pour le suivi et la collecte sur le terrain."
                  icon={UserRoundCog}
                  tone="violet"
                >
                  <div className="site-form__contacts">
                    {contacts.map(({ key, title, role, tone, contact }) => (
                      <article key={key} className={`site-form__contact ${tone}`}>
                        <header>
                          <span className="site-form__avatar">{initials(contact.fullName)}</span>
                          <div>
                            <h4>{title}</h4>
                            <p>{role}</p>
                          </div>
                        </header>
                        <div className="site-form__contact-fields">
                          <Field label="Nom complet" required>
                            <input value={contact.fullName} onChange={(event) => setValue(key, { ...contact, fullName: event.target.value })} placeholder="Prénom et nom" required />
                          </Field>
                          <Field label="Téléphone" required>
                            <span className="site-form__input-icon">
                              <Phone aria-hidden="true" />
                              <input type="tel" value={contact.phone} onChange={(event) => setValue(key, { ...contact, phone: event.target.value })} placeholder="+226 …" required />
                            </span>
                          </Field>
                          <Field label="Adresse e-mail">
                            <input type="email" value={contact.email || ''} onChange={(event) => setValue(key, { ...contact, email: event.target.value })} placeholder="prenom.nom@sonasp.bf" />
                          </Field>
                        </div>
                      </article>
                    ))}
                  </div>
                </Section>

                <Section
                  id="notes"
                  title="Observations"
                  description="Contraintes, conditions particulières et historique du site."
                  icon={StickyNote}
                  tone="slate"
                >
                  <Field label="Notes et observations" wide>
                    <textarea value={form.notes || ''} onChange={(event) => setValue('notes', event.target.value)} placeholder="Contraintes, conditions particulières, historique…" />
                  </Field>
                </Section>

                <footer className="site-form__actions">
                  <button type="button" onClick={() => void leaveForm('/artisan-sites')} disabled={saving || uploading || cleaningPhotos}>Annuler</button>
                  <button type="submit" className="is-primary" disabled={saving || uploading || cleaningPhotos || loading || loadFailed}>
                    {saving ? <Loader2 className="is-spinning" aria-hidden="true" /> : <Save aria-hidden="true" />}
                    {saving ? 'Enregistrement…' : 'Enregistrer le site'}
                  </button>
                </footer>
              </>
            )}
          </form>

          <aside className="site-form__aside" aria-label="Sites référencés et définitions">
            <section className="site-form__card">
              <header>
                <span className="site-form__card-icon is-emerald"><MapPinned aria-hidden="true" /></span>
                <div>
                  <h3>Sites artisanaux</h3>
                  <p>{sites.length} site(s) référencé(s)</p>
                </div>
              </header>
              <label className="site-form__search">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={siteSearch}
                  onChange={(event) => setSiteSearch(event.target.value)}
                  placeholder="Rechercher un site"
                  aria-label="Rechercher un site référencé"
                />
              </label>
              <ul className="site-form__site-list">
                {filteredSites.map((site) => (
                  <li key={site.id}>
                    <button
                      type="button"
                      className={site.id === siteId ? 'is-current' : ''}
                      onClick={() => void leaveForm(`/artisan-sites/${site.id}`)}
                    >
                      <span className="site-form__site-head">
                        <strong>{site.name}</strong>
                        <em className={`site-form__chip is-${site.status}`}>{STATUS_LABELS[site.status]}</em>
                      </span>
                      <span className="site-form__site-meta">{site.code} · {site.region}</span>
                      <span className="site-form__site-meta">
                        {site.activeMiners.toLocaleString('fr-FR')} / {site.authorizedMiners.toLocaleString('fr-FR')} artisans
                      </span>
                    </button>
                  </li>
                ))}
                {filteredSites.length === 0 && <li className="site-form__empty">Aucun site ne correspond.</li>}
              </ul>
            </section>

          </aside>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
