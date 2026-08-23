import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Gavel,
  HandHelping,
  Loader2,
  Paperclip,
  Save,
  ScrollText,
  ShieldQuestion,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, ChoiceCards, Field, Note, PageHeader, Section, Segmented } from '@/components/ui/sn';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import {
  artisanInfractionsService,
  type ArtisanInfraction,
  type ConclusionInfraction,
  type CreateInfractionData,
  type StatutTraitementInfraction,
} from '@/services/artisanInfractionsService';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { artisanFullName } from '@/utils/artisanIdentity';
import './infraction-form.css';

/** Qualifications prévues par le dispositif de contrôle ; « Autre » ouvre une saisie libre. */
export const TYPES_INFRACTION = [
  'Non-déclaration de production',
  'Vente illégale',
  'Exploitation sans autorisation',
  'Non-respect des normes environnementales',
  'Travail des enfants',
  'Conditions de travail dangereuses',
  'Non-paiement des taxes',
  'Falsification de documents',
  'Trafic illégal',
] as const;

export const AUTRE_TYPE = 'Autre';

const CONCLUSION_OPTIONS: Array<{
  value: ConclusionInfraction;
  label: string;
  description: string;
  icon: typeof Gavel;
}> = [
  { value: 'reconnu', label: 'Reconnu', description: 'Les faits sont établis', icon: Gavel },
  { value: 'soupçonne', label: 'Soupçonné', description: 'Faisceau d’indices, preuve incomplète', icon: ShieldQuestion },
  { value: 'complice', label: 'Complice', description: 'Participation indirecte établie', icon: HandHelping },
  { value: 'innocente', label: 'Innocenté', description: 'Mis hors de cause', icon: CheckCircle2 },
];

const STATUT_OPTIONS: Array<{ value: StatutTraitementInfraction; label: string }> = [
  { value: 'en_cours', label: 'Instruction en cours' },
  { value: 'cloture', label: 'Dossier clôturé' },
];

/** 10 Mo : plafond annoncé à l'agent, désormais réellement appliqué. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface PendingFile {
  file: File;
  preview: string;
}

export interface InfractionDraft {
  date_infraction: string;
  type_infraction: string;
  custom_type: string;
  lieu: string;
  description: string;
  remarques: string;
  statut_traitement: StatutTraitementInfraction;
  conclusion: ConclusionInfraction | '';
  date_cloture: string;
}

export const EMPTY_DRAFT: InfractionDraft = {
  date_infraction: new Date().toISOString().split('T')[0],
  type_infraction: '',
  custom_type: '',
  lieu: '',
  description: '',
  remarques: '',
  statut_traitement: 'en_cours',
  conclusion: '',
  date_cloture: '',
};

/**
 * Restitue un constat existant dans le formulaire.
 * Une qualification hors nomenclature doit revenir sur « Autre » avec sa saisie libre,
 * faute de quoi le select s'affichait vide et la qualification était perdue à l'enregistrement.
 */
export function draftFromInfraction(infraction: ArtisanInfraction): InfractionDraft {
  const connu = (TYPES_INFRACTION as readonly string[]).includes(infraction.type_infraction);
  return {
    date_infraction: infraction.date_infraction,
    type_infraction: connu ? infraction.type_infraction : AUTRE_TYPE,
    custom_type: connu ? '' : infraction.type_infraction,
    lieu: infraction.lieu || '',
    description: infraction.description,
    remarques: infraction.remarques || '',
    statut_traitement: infraction.statut_traitement,
    conclusion: infraction.conclusion || '',
    date_cloture: infraction.date_cloture || '',
  };
}

/** Première obligation non satisfaite, ou `null` si le constat est enregistrable. */
export function validateDraft(draft: InfractionDraft): string | null {
  if (!draft.date_infraction) return 'La date du constat est obligatoire.';
  if (draft.date_infraction > new Date().toISOString().split('T')[0])
    return 'La date du constat ne peut pas être postérieure à aujourd’hui.';
  if (!draft.type_infraction) return 'Sélectionnez la qualification de l’infraction.';
  if (draft.type_infraction === AUTRE_TYPE && !draft.custom_type.trim())
    return 'Précisez la qualification retenue.';
  if (draft.description.trim().length < 20)
    return 'Décrivez les faits constatés (20 caractères minimum).';
  if (draft.statut_traitement === 'cloture') {
    if (!draft.conclusion) return 'Une clôture exige une conclusion.';
    if (!draft.date_cloture) return 'Renseignez la date de clôture.';
    if (draft.date_cloture < draft.date_infraction)
      return 'La clôture ne peut pas précéder le constat.';
  }
  return null;
}

/**
 * Traduit le brouillon en enregistrement.
 * Un dossier rouvert perd sa conclusion et sa date de clôture : les conserver laissait
 * en base une instruction « en cours » portant un verdict.
 */
export function buildInfractionPayload(
  draft: InfractionDraft,
  artisanId: string,
  documents: string[]
): CreateInfractionData {
  const cloture = draft.statut_traitement === 'cloture';
  return {
    artisan_id: artisanId,
    date_infraction: draft.date_infraction,
    type_infraction: draft.type_infraction === AUTRE_TYPE ? draft.custom_type.trim() : draft.type_infraction,
    description: draft.description.trim(),
    lieu: draft.lieu.trim() || undefined,
    statut_traitement: draft.statut_traitement,
    conclusion: cloture ? (draft.conclusion as ConclusionInfraction) : undefined,
    date_cloture: cloture ? draft.date_cloture : undefined,
    remarques: draft.remarques.trim() || undefined,
    documents,
  };
}

export default function InfractionForm() {
  const navigate = useNavigate();
  const { artisanId, infractionId } = useParams();
  const isEditMode = Boolean(infractionId);
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<InfractionDraft>(EMPTY_DRAFT);
  const [artisan, setArtisan] = useState<ArtisanMinier | null>(null);
  const [historique, setHistorique] = useState<ArtisanInfraction[]>([]);
  /** URLs déjà stockées : conservées telles quelles, sinon un nouvel envoi les effaçait. */
  const [storedDocuments, setStoredDocuments] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const [dossier, constats, existant] = await Promise.allSettled([
        artisanId ? artisanMinierService.getById(artisanId) : Promise.resolve(null),
        artisanId ? artisanInfractionsService.getByArtisanId(artisanId) : Promise.resolve([]),
        infractionId ? artisanInfractionsService.getById(infractionId) : Promise.resolve(null),
      ]);
      if (!active) return;

      if (dossier.status === 'fulfilled') setArtisan(dossier.value);
      if (constats.status === 'fulfilled') setHistorique(constats.value || []);

      if (infractionId) {
        if (existant.status === 'fulfilled' && existant.value) {
          setDraft(draftFromInfraction(existant.value));
          setStoredDocuments(existant.value.documents || []);
        } else {
          showError("Impossible de charger ce constat d'infraction");
        }
      }
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [artisanId, infractionId]);

  // Les aperçus locaux sont révoqués à la sortie : sans cela les blobs restaient en mémoire.
  useEffect(
    () => () => {
      pendingFiles.forEach((item) => URL.revokeObjectURL(item.preview));
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    },
    [pendingFiles]
  );

  const retour = artisanId ? `/artisan-minier/${artisanId}` : '/artisan-minier/liste';

  const enCours = useMemo(
    () => historique.filter((item) => item.statut_traitement === 'en_cours' && item.id !== infractionId),
    [historique, infractionId]
  );
  const anterieurs = useMemo(
    () => historique.filter((item) => item.id !== infractionId).slice(0, 4),
    [historique, infractionId]
  );

  const setValue = <K extends keyof InfractionDraft>(key: K, value: InfractionDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const handleStatut = (statut: StatutTraitementInfraction) =>
    setDraft((current) => ({
      ...current,
      statut_traitement: statut,
      date_cloture:
        statut === 'cloture'
          ? current.date_cloture || new Date().toISOString().split('T')[0]
          : '',
      conclusion: statut === 'cloture' ? current.conclusion : '',
    }));

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const trop = files.filter((file) => file.size > MAX_FILE_BYTES);
    const retenus = files.filter((file) => file.size <= MAX_FILE_BYTES);

    if (trop.length > 0) {
      showError(`Fichier trop volumineux (10 Mo maximum) : ${trop.map((file) => file.name).join(', ')}`);
    }
    setPendingFiles((current) => [
      ...current,
      ...retenus.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
    event.target.value = '';
  };

  const removePending = (index: number) =>
    setPendingFiles((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, position) => position !== index);
    });

  const removeStored = (url: string) =>
    setStoredDocuments((current) => current.filter((item) => item !== url));

  const validationError = validateDraft(draft);
  const documentsCount = storedDocuments.length + pendingFiles.length;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || uploading) return; // garde-fou contre la double soumission

    const message = validateDraft(draft);
    if (message) {
      showError(message);
      return;
    }
    if (!artisanId) {
      showError("Aucun artisan n'est associé à ce constat.");
      return;
    }

    setSaving(true);
    try {
      let documents = storedDocuments;
      if (pendingFiles.length > 0) {
        setUploading(true);
        const cible = infractionId || artisanId;
        const uploaded: string[] = [];
        for (const item of pendingFiles) {
          uploaded.push(await artisanInfractionsService.uploadDocument(item.file, cible));
        }
        // Les pièces déjà versées sont préservées : l'ancienne version les remplaçait.
        documents = [...storedDocuments, ...uploaded];
        setUploading(false);
      }

      const payload = buildInfractionPayload(draft, artisanId, documents);

      if (isEditMode && infractionId) {
        await artisanInfractionsService.update(infractionId, payload);
        showSuccess('Constat mis à jour');
      } else {
        await artisanInfractionsService.create(payload);
        showSuccess('Constat enregistré');
      }

      pendingFiles.forEach((item) => URL.revokeObjectURL(item.preview));
      setPendingFiles([]);
      setStoredDocuments(documents);
      redirectTimer.current = setTimeout(() => navigate(retour), 1200);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Erreur lors de l'enregistrement");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page infraction-form">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={AlertTriangle}
          title={isEditMode ? 'Modifier le constat d’infraction' : 'Nouveau constat d’infraction'}
          subtitle={
            artisan
              ? `Dossier de ${artisanFullName(artisan)}${artisan.numero_carte ? ` · ${artisan.numero_carte}` : ''}`
              : 'Manquement constaté sur le circuit artisanal'
          }
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: artisanFullName(artisan), to: retour },
            { label: isEditMode ? 'Modification du constat' : 'Nouveau constat' },
          ]}
          actions={
            <button type="button" className="sn-btn" onClick={() => navigate(retour)}>
              <ArrowLeft aria-hidden="true" /> Retour au dossier
            </button>
          }
        />

        {loading ? (
          <div className="infraction-form__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du constat…
          </div>
        ) : (
          <div className="infraction-form__layout">
            <form className="infraction-form__main" onSubmit={handleSubmit} noValidate>
              <Section
                id="constat"
                icon={ScrollText}
                tone="amber"
                title="Constat"
                description="Quand et où les faits ont été relevés."
              >
                <div className="infraction-form__row is-constat">
                  <Field label="Date du constat" required htmlFor="date-infraction">
                    <input
                      id="date-infraction"
                      type="date"
                      value={draft.date_infraction}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(event) => setValue('date_infraction', event.target.value)}
                    />
                  </Field>
                  <Field label="Lieu du constat" htmlFor="lieu-infraction">
                    <input
                      id="lieu-infraction"
                      value={draft.lieu}
                      onChange={(event) => setValue('lieu', event.target.value)}
                      placeholder="Site, village, commune…"
                    />
                  </Field>
                </div>
              </Section>

              <Section
                id="qualification"
                icon={Gavel}
                tone="violet"
                title="Qualification et faits"
                description="Nature du manquement et description circonstanciée."
              >
                <div className={`infraction-form__row ${draft.type_infraction === AUTRE_TYPE ? 'is-qualif-libre' : 'is-qualif'}`}>
                  <Field label="Qualification retenue" required htmlFor="type-infraction">
                    <select
                      id="type-infraction"
                      value={draft.type_infraction}
                      onChange={(event) => setValue('type_infraction', event.target.value)}
                    >
                      <option value="">Sélectionner une qualification</option>
                      {TYPES_INFRACTION.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                      <option value={AUTRE_TYPE}>{AUTRE_TYPE}</option>
                    </select>
                  </Field>
                  {draft.type_infraction === AUTRE_TYPE && (
                    <Field label="Qualification libre" required htmlFor="custom-type">
                      <input
                        id="custom-type"
                        value={draft.custom_type}
                        onChange={(event) => setValue('custom_type', event.target.value)}
                        placeholder="Formuler la qualification retenue"
                      />
                    </Field>
                  )}
                </div>

                <Field label="Faits constatés" required wide htmlFor="description">
                  <textarea
                    id="description"
                    rows={7}
                    value={draft.description}
                    onChange={(event) => setValue('description', event.target.value)}
                    placeholder="Circonstances, personnes présentes, quantités en cause, déclarations recueillies…"
                  />
                </Field>

                <Field label="Observations de l’agent" wide htmlFor="remarques">
                  <textarea
                    id="remarques"
                    rows={4}
                    value={draft.remarques}
                    onChange={(event) => setValue('remarques', event.target.value)}
                    placeholder="Suites proposées, mesures conservatoires, recommandations…"
                  />
                </Field>
              </Section>

              <Section
                id="instruction"
                icon={CheckCircle2}
                tone="emerald"
                title="Instruction"
                description="État du dossier et, s’il est clos, verdict retenu."
              >
                <div className="infraction-form__statut">
                  <span className="sn-field__label">État du dossier</span>
                  <Segmented
                    name="statut-infraction"
                    value={draft.statut_traitement}
                    options={STATUT_OPTIONS}
                    onChange={handleStatut}
                    ariaLabel="État du dossier"
                  />
                </div>

                {draft.statut_traitement === 'cloture' ? (
                  <>
                    <ChoiceCards
                      name="conclusion"
                      value={draft.conclusion as ConclusionInfraction}
                      options={CONCLUSION_OPTIONS}
                      onChange={(conclusion) => setValue('conclusion', conclusion)}
                      legend="Conclusion de l’instruction"
                    />
                    <div className="infraction-form__row is-cloture">
                      <Field label="Date de clôture" required htmlFor="date-cloture">
                        <input
                          id="date-cloture"
                          type="date"
                          value={draft.date_cloture}
                          min={draft.date_infraction}
                          onChange={(event) => setValue('date_cloture', event.target.value)}
                        />
                      </Field>
                    </div>
                  </>
                ) : (
                  <Note tone="info" icon={AlertCircle}>
                    Le dossier reste ouvert : la conclusion et la date de clôture ne seront
                    demandées qu’au moment de le clore.
                  </Note>
                )}
              </Section>

              <Section
                id="pieces"
                icon={Paperclip}
                tone="blue"
                title="Pièces du dossier"
                description="Photographies, procès-verbaux et documents justificatifs."
              >
                <label className="infraction-form__drop" htmlFor="pieces-jointes">
                  <Upload aria-hidden="true" />
                  <strong>Joindre des pièces</strong>
                  <small>Images, PDF ou Word — 10 Mo par fichier</small>
                  <input
                    id="pieces-jointes"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFiles}
                  />
                </label>

                {documentsCount > 0 && (
                  <ul className="infraction-form__pieces">
                    {storedDocuments.map((url) => (
                      <li key={url}>
                        <FileText aria-hidden="true" />
                        <a href={url} target="_blank" rel="noreferrer">
                          {decodeURIComponent(url.split('/').pop() || 'Pièce jointe')}
                        </a>
                        <button
                          type="button"
                          aria-label="Retirer cette pièce du dossier"
                          onClick={() => removeStored(url)}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                    {pendingFiles.map((item, index) => (
                      <li key={`${item.file.name}-${index}`} className="is-pending">
                        <Paperclip aria-hidden="true" />
                        <span>
                          {item.file.name} <small>{Math.round(item.file.size / 1024)} Ko · à envoyer</small>
                        </span>
                        <button
                          type="button"
                          aria-label={`Retirer ${item.file.name}`}
                          onClick={() => removePending(index)}
                        >
                          <X aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <div className="sn-form-actions">
                {validationError && <span className="infraction-form__hint">{validationError}</span>}
                <button type="button" className="sn-btn" onClick={() => navigate(retour)} disabled={saving}>
                  Annuler
                </button>
                <button
                  type="submit"
                  className="sn-btn sn-btn--primary"
                  disabled={saving || uploading || Boolean(validationError)}
                >
                  {saving || uploading ? (
                    <>
                      <Loader2 className="sn-spin" aria-hidden="true" />
                      {uploading ? 'Envoi des pièces…' : 'Enregistrement…'}
                    </>
                  ) : (
                    <>
                      <Save aria-hidden="true" /> {isEditMode ? 'Mettre à jour le constat' : 'Enregistrer le constat'}
                    </>
                  )}
                </button>
              </div>
            </form>

            <aside className="infraction-form__aside" aria-label="Contexte du dossier">
              <section className="sn-card infraction-form__artisan">
                <h2>
                  <UserRound aria-hidden="true" /> Artisan mis en cause
                </h2>
                {artisan ? (
                  <>
                    <p className="infraction-form__artisan-name">{artisanFullName(artisan)}</p>
                    <dl>
                      <div>
                        <dt>Carte professionnelle</dt>
                        <dd>{artisan.numero_carte || 'Non attribuée'}</dd>
                      </div>
                      <div>
                        <dt>Localisation</dt>
                        <dd>{[artisan.commune, artisan.region].filter(Boolean).join(' · ') || 'Non renseignée'}</dd>
                      </div>
                      <div>
                        <dt>Téléphone</dt>
                        <dd>{artisan.telephone || 'Non renseigné'}</dd>
                      </div>
                    </dl>
                    {enCours.length > 0 && (
                      <Badge tone="danger" icon={AlertTriangle}>
                        {enCours.length} dossier(s) déjà en cours
                      </Badge>
                    )}
                  </>
                ) : (
                  <p className="infraction-form__empty">
                    Dossier artisan indisponible — le constat reste enregistrable.
                  </p>
                )}
              </section>

              <section className="sn-card infraction-form__historique">
                <h2>
                  <ScrollText aria-hidden="true" /> Antécédents
                </h2>
                {anterieurs.length === 0 ? (
                  <p className="infraction-form__empty">Aucun constat antérieur pour cet artisan.</p>
                ) : (
                  <ul>
                    {anterieurs.map((item) => (
                      <li key={item.id}>
                        <span className="infraction-form__historique-date">
                          {new Date(item.date_infraction).toLocaleDateString('fr-FR')}
                        </span>
                        <strong>{item.type_infraction}</strong>
                        <Badge tone={item.statut_traitement === 'cloture' ? 'neutral' : 'warning'}>
                          {item.statut_traitement === 'cloture' ? 'Clôturé' : 'En cours'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Note tone="warning" icon={AlertTriangle}>
                Un constat engage l’administration. Vérifiez les faits et joignez les pièces
                justificatives avant l’enregistrement.
              </Note>
            </aside>
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
