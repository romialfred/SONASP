import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CreditCard,
  Eye,
  FileText,
  Contact,
  Loader2,
  MapPin,
  Save,
  Truck,
  Upload,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Badge, ChoiceCards, Field, Note, Section, Segmented } from '@/components/ui/sn';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { carteProfessionnelleGeneratorService } from '@/services/carteProfessionnelleGeneratorService';
import type { CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import { getCitiesByRegion, getRegionsByCountry, SAHEL_COUNTRIES } from '@/data/burkinaFasoData';
import './artisan-form.css';

export type TypePersonne = 'physique' | 'morale';
export type TypeArtisan = 'exploitant' | 'collecteur' | 'intermediaire' | 'fournisseur';

export interface ArtisanFormValues {
  type_personne: TypePersonne;
  type_artisan: TypeArtisan;
  nom: string;
  prenoms: string;
  raison_sociale: string;
  date_naissance: string;
  lieu_naissance: string;
  nationalite: string;
  pays: string;
  sexe: string;
  telephone: string;
  email: string;
  adresse: string;
  commune: string;
  region: string;
  type_piece_identite: string;
  numero_piece_identite: string;
  date_delivrance_piece: string;
  date_expiration_piece: string;
  lieu_delivrance_piece: string;
  observations: string;
  photo_url: string;
  piece_identite_url: string;
}

export const EMPTY_ARTISAN_FORM: ArtisanFormValues = {
  type_personne: 'physique',
  type_artisan: 'exploitant',
  nom: '',
  prenoms: '',
  raison_sociale: '',
  date_naissance: '',
  lieu_naissance: '',
  nationalite: 'Burkinabé',
  pays: 'Burkina Faso',
  sexe: 'M',
  telephone: '',
  email: '',
  adresse: '',
  commune: '',
  region: '',
  type_piece_identite: 'CNI',
  numero_piece_identite: '',
  date_delivrance_piece: '',
  date_expiration_piece: '',
  lieu_delivrance_piece: '',
  observations: '',
  photo_url: '',
  piece_identite_url: '',
};

const TYPE_ARTISAN_OPTIONS: Array<{ value: TypeArtisan; label: string; description: string; icon: typeof UserRound }> = [
  { value: 'exploitant', label: 'Exploitant', description: 'Extrait le minerai sur site', icon: UserRound },
  { value: 'collecteur', label: 'Collecteur', description: 'Rachète l’or aux exploitants', icon: Users },
  { value: 'intermediaire', label: 'Intermédiaire', description: 'Met en relation les acteurs', icon: Truck },
  { value: 'fournisseur', label: 'Fournisseur', description: 'Approvisionne les comptoirs', icon: Building2 },
];

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PIECE_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const PIECE_TYPES = [...PHOTO_TYPES, 'application/pdf'];

/** Âge révolu à la date du jour. */
export function calculateAge(dateNaissance: string, today = new Date()): number {
  const naissance = new Date(dateNaissance);
  let age = today.getFullYear() - naissance.getFullYear();
  const mois = today.getMonth() - naissance.getMonth();
  if (mois < 0 || (mois === 0 && today.getDate() < naissance.getDate())) age -= 1;
  return age;
}

/** Première obligation non satisfaite, ou `null` si la fiche est enregistrable. */
export function validateArtisan(values: ArtisanFormValues): string | null {
  if (values.type_personne === 'morale') {
    if (!values.raison_sociale.trim()) return 'La raison sociale est obligatoire.';
  } else {
    if (!values.nom.trim()) return 'Le nom est obligatoire.';
    if (!values.date_naissance) return 'La date de naissance est obligatoire.';
    if (calculateAge(values.date_naissance) < 18) return 'L’artisan minier doit avoir au moins 18 ans.';
  }
  if (!values.region) return 'Sélectionnez la région de rattachement.';
  if (!values.commune) return 'Sélectionnez la commune de rattachement.';
  if (!values.telephone.trim()) return 'Le numéro de téléphone est obligatoire.';
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return 'L’adresse e-mail est invalide.';
  if (!values.numero_piece_identite.trim()) return 'Le numéro de pièce d’identité est obligatoire.';
  if (
    values.date_expiration_piece &&
    values.date_delivrance_piece &&
    values.date_expiration_piece < values.date_delivrance_piece
  )
    return 'L’expiration de la pièce précède sa délivrance.';
  return null;
}

/** Restitue une fiche existante dans le formulaire, sans champ `undefined`. */
export function valuesFromArtisan(artisan: Partial<ArtisanMinier> | null | undefined): ArtisanFormValues {
  if (!artisan) return EMPTY_ARTISAN_FORM;
  const entries = Object.keys(EMPTY_ARTISAN_FORM) as Array<keyof ArtisanFormValues>;
  const values = { ...EMPTY_ARTISAN_FORM };
  entries.forEach((key) => {
    const valeur = (artisan as Record<string, unknown>)[key];
    if (valeur !== null && valeur !== undefined && valeur !== '') {
      (values as Record<string, unknown>)[key] = valeur;
    }
  });
  return values;
}

/** Part des informations utiles renseignées, pour la jauge du volet latéral. */
export function completionRate(values: ArtisanFormValues): number {
  const champs =
    values.type_personne === 'morale'
      ? ['raison_sociale', 'region', 'commune', 'telephone', 'adresse', 'numero_piece_identite', 'email']
      : [
          'nom',
          'prenoms',
          'date_naissance',
          'lieu_naissance',
          'region',
          'commune',
          'telephone',
          'adresse',
          'numero_piece_identite',
          'photo_url',
        ];
  const remplis = champs.filter((champ) => String(values[champ as keyof ArtisanFormValues] || '').trim().length > 0);
  return Math.round((remplis.length / champs.length) * 100);
}

export interface ArtisanMinierFormProps {
  artisan?: Partial<ArtisanMinier> | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export function ArtisanMinierForm({ artisan, onCancel, onSuccess }: ArtisanMinierFormProps) {
  const isEditMode = Boolean(artisan?.id);
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  const [values, setValues] = useState<ArtisanFormValues>(() => valuesFromArtisan(artisan));
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(artisan?.photo_url || '');
  const [pieceFile, setPieceFile] = useState<File | null>(null);
  const [cartePreview, setCartePreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValues(valuesFromArtisan(artisan));
    setPhotoPreview(artisan?.photo_url || '');
  }, [artisan]);

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    },
    []
  );

  // Les référentiels dérivent des valeurs saisies : la fiche chargée conserve donc
  // sa région et sa commune, que l'ancien enchaînement d'effets réinitialisait.
  const regions = useMemo(() => getRegionsByCountry(values.pays), [values.pays]);
  const communes = useMemo(
    () => (values.region ? getCitiesByRegion(values.pays, values.region) : []),
    [values.pays, values.region]
  );

  const setValue = <K extends keyof ArtisanFormValues>(key: K, value: ArtisanFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handlePays = (pays: string) =>
    setValues((current) => ({ ...current, pays, region: '', commune: '' }));

  const handleRegion = (region: string) =>
    setValues((current) => ({ ...current, region, commune: '' }));

  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      showError('Format non supporté pour la photo : utilisez JPG ou PNG.');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      showError('La photo doit faire moins de 2 Mo.');
      return;
    }
    setPhotoFile(file);
    // L'aperçu reste local : l'ancienne version écrivait la photo en base64 dans la
    // colonne `photo_url` avant même de l'avoir versée au stockage.
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePiece = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!PIECE_TYPES.includes(file.type)) {
      showError('Format non supporté : utilisez JPG, PNG ou PDF.');
      return;
    }
    if (file.size > PIECE_MAX_BYTES) {
      showError('Le document ne doit pas dépasser 5 Mo.');
      return;
    }
    setPieceFile(file);
  };

  const handlePreview = async () => {
    if (!values.nom && !values.raison_sociale) {
      showError('Renseignez au minimum l’identité avant de générer l’aperçu.');
      return;
    }
    setGenerating(true);
    try {
      const apercu = await carteProfessionnelleGeneratorService.generatePreviewDataUrl(
        {
          type_personne: values.type_personne,
          type_artisan: values.type_artisan,
          nom: values.nom,
          prenoms: values.prenoms,
          raison_sociale: values.raison_sociale,
          telephone: values.telephone,
          region: values.region,
          site_exploitation: values.commune,
          photo_url: photoPreview,
          adresse_complete: values.adresse,
        } as Partial<ArtisanMinier>,
        {
          numero_carte: artisan?.numero_carte || 'SONASP/AM/APERCU',
          date_delivrance: new Date().toISOString().split('T')[0],
          date_expiration: new Date(Date.now() + 365 * 86_400_000).toISOString().split('T')[0],
          statut: 'en_cours',
          numero_securite: '0000000000',
          qr_code_data: JSON.stringify({ numero_carte: artisan?.numero_carte || 'APERCU' }),
        } as Partial<CarteProfessionnelle>
      );
      setCartePreview(apercu);
    } catch {
      showError('Erreur lors de la génération de l’aperçu de la carte');
    } finally {
      setGenerating(false);
    }
  };

  const validationError = validateArtisan(values);
  const completion = completionRate(values);
  const age = values.date_naissance ? calculateAge(values.date_naissance) : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return; // garde-fou contre la double soumission

    const message = validateArtisan(values);
    if (message) {
      showError(message);
      return;
    }

    setSaving(true);
    try {
      // La photo locale n'est pas persistée telle quelle : seul le lien de stockage l'est.
      const payload: Partial<ArtisanMinier> = { ...values, photo_url: artisan?.photo_url || '' } as Partial<ArtisanMinier>;
      const enregistre = artisan?.id
        ? await artisanMinierService.update(artisan.id, payload)
        : await artisanMinierService.create(payload);

      const artisanId = enregistre?.id || artisan?.id;
      const echecs: string[] = [];

      if (artisanId && photoFile) {
        try {
          const url = await artisanMinierService.uploadDocument(artisanId, photoFile, 'photo');
          await artisanMinierService.update(artisanId, { photo_url: url } as Partial<ArtisanMinier>);
        } catch {
          echecs.push('la photo d’identité');
        }
      }

      if (artisanId && pieceFile) {
        try {
          const url = await artisanMinierService.uploadDocument(artisanId, pieceFile, 'piece_identite');
          await artisanMinierService.update(artisanId, { piece_identite_url: url } as Partial<ArtisanMinier>);
        } catch {
          echecs.push('la pièce d’identité');
        }
      }

      if (echecs.length > 0) {
        // L'ancienne version annonçait un succès complet alors que les pièces étaient perdues.
        showError(`Fiche enregistrée, mais l’envoi de ${echecs.join(' et ')} a échoué. Reprenez le dépôt.`);
      } else {
        showSuccess(isEditMode ? 'Fiche artisan mise à jour' : 'Artisan enregistré');
      }

      redirectTimer.current = setTimeout(onSuccess, echecs.length > 0 ? 2500 : 1200);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer la fiche artisan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="artisan-form">
      <CustomAlert {...alertState} onClose={closeAlert} />

      <div className="artisan-form__layout">
        <form className="artisan-form__main" onSubmit={handleSubmit} noValidate>
          <Section
            id="identite"
            icon={UserRound}
            tone="emerald"
            title="Identité"
            description="Qualité juridique de l’artisan et état civil."
          >
            <div className="artisan-form__statut">
              <span className="sn-field__label">Qualité juridique</span>
              <Segmented
                name="type-personne"
                value={values.type_personne}
                options={[
                  { value: 'physique', label: 'Personne physique' },
                  { value: 'morale', label: 'Personne morale' },
                ]}
                onChange={(type) => setValue('type_personne', type)}
                ariaLabel="Qualité juridique"
              />
            </div>

            <ChoiceCards
              name="type-artisan"
              value={values.type_artisan}
              options={TYPE_ARTISAN_OPTIONS}
              onChange={(type) => setValue('type_artisan', type)}
              legend="Rôle dans la filière"
            />

            {values.type_personne === 'morale' ? (
              <div className="artisan-form__row is-morale">
                <Field label="Raison sociale" required htmlFor="raison-sociale">
                  <input
                    id="raison-sociale"
                    value={values.raison_sociale}
                    onChange={(event) => setValue('raison_sociale', event.target.value)}
                    placeholder="Dénomination de la structure"
                  />
                </Field>
              </div>
            ) : (
              <>
                <div className="artisan-form__row is-nom">
                  <Field label="Nom" required htmlFor="nom">
                    <input id="nom" value={values.nom} onChange={(event) => setValue('nom', event.target.value)} />
                  </Field>
                  <Field label="Prénom(s)" htmlFor="prenoms">
                    <input
                      id="prenoms"
                      value={values.prenoms}
                      onChange={(event) => setValue('prenoms', event.target.value)}
                    />
                  </Field>
                </div>

                <div className="artisan-form__row is-naissance">
                  <Field
                    label="Date de naissance"
                    required
                    htmlFor="date-naissance"
                    error={age !== null && age < 18 ? 'Minimum 18 ans requis' : undefined}
                    hint={age !== null && age >= 18 ? `${age} ans` : undefined}
                  >
                    <input
                      id="date-naissance"
                      type="date"
                      value={values.date_naissance}
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                      onChange={(event) => setValue('date_naissance', event.target.value)}
                    />
                  </Field>
                  <Field label="Lieu de naissance" htmlFor="lieu-naissance">
                    <input
                      id="lieu-naissance"
                      value={values.lieu_naissance}
                      onChange={(event) => setValue('lieu_naissance', event.target.value)}
                      placeholder="Ville, pays"
                    />
                  </Field>
                  <Field label="Sexe" htmlFor="sexe">
                    <select id="sexe" value={values.sexe} onChange={(event) => setValue('sexe', event.target.value)}>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </Field>
                  <Field label="Nationalité" htmlFor="nationalite">
                    <select
                      id="nationalite"
                      value={values.nationalite}
                      onChange={(event) => setValue('nationalite', event.target.value)}
                    >
                      <option value="Burkinabé">Burkinabé</option>
                      <option value="Malienne">Malienne</option>
                      <option value="Nigérienne">Nigérienne</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </Field>
                </div>
              </>
            )}
          </Section>

          <Section
            id="localisation"
            icon={MapPin}
            tone="blue"
            title="Rattachement et contact"
            description="Territoire d’exercice et coordonnées de l’artisan."
          >
            <div className="artisan-form__row is-territoire">
              <Field label="Pays" required htmlFor="pays">
                <select id="pays" value={values.pays} onChange={(event) => handlePays(event.target.value)}>
                  {[...SAHEL_COUNTRIES]
                    .sort((a, b) => a.priority - b.priority)
                    .map((pays) => (
                      <option key={pays.code} value={pays.name}>
                        {pays.flag} {pays.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Région" required htmlFor="region">
                <select id="region" value={values.region} onChange={(event) => handleRegion(event.target.value)}>
                  <option value="">Sélectionner une région</option>
                  {regions.map((region) => (
                    <option key={region.name} value={region.name}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Commune" required htmlFor="commune">
                <select
                  id="commune"
                  value={values.commune}
                  onChange={(event) => setValue('commune', event.target.value)}
                  disabled={!values.region}
                >
                  <option value="">{values.region ? 'Sélectionner une commune' : 'Choisir d’abord la région'}</option>
                  {communes.map((commune) => (
                    <option key={commune} value={commune}>
                      {commune}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="artisan-form__row is-contact">
              <div className="sn-field">
                <span className="sn-field__label">
                  Téléphone <i aria-hidden="true">*</i>
                </span>
                <PhoneInput
                  value={values.telephone}
                  onChange={(telephone) => setValue('telephone', telephone)}
                  defaultCountry={values.pays}
                />
              </div>
              <Field label="Adresse e-mail" htmlFor="email">
                <input
                  id="email"
                  type="email"
                  value={values.email}
                  onChange={(event) => setValue('email', event.target.value)}
                  placeholder="nom@exemple.bf"
                />
              </Field>
            </div>

            <Field label="Adresse complète" wide htmlFor="adresse">
              <input
                id="adresse"
                value={values.adresse}
                onChange={(event) => setValue('adresse', event.target.value)}
                placeholder="Quartier, secteur, repère…"
              />
            </Field>

            <Field label="Observations" wide htmlFor="observations">
              <textarea
                id="observations"
                rows={3}
                value={values.observations}
                onChange={(event) => setValue('observations', event.target.value)}
                placeholder="Éléments utiles au suivi du dossier…"
              />
            </Field>
          </Section>

          <Section
            id="piece"
            icon={Contact}
            tone="violet"
            title="Pièce d’identité"
            description="Titre d’identité présenté et copie versée au dossier."
          >
            <div className="artisan-form__row is-piece">
              <Field label="Type de pièce" required htmlFor="type-piece">
                <select
                  id="type-piece"
                  value={values.type_piece_identite}
                  onChange={(event) => setValue('type_piece_identite', event.target.value)}
                >
                  <option value="CNI">Carte nationale d’identité</option>
                  <option value="Passeport">Passeport</option>
                  <option value="Permis">Permis de conduire</option>
                  <option value="Autre">Autre</option>
                </select>
              </Field>
              <Field label="Numéro de pièce" required htmlFor="numero-piece">
                <input
                  id="numero-piece"
                  value={values.numero_piece_identite}
                  onChange={(event) => setValue('numero_piece_identite', event.target.value)}
                />
              </Field>
              <Field label="Date de délivrance" htmlFor="delivrance-piece">
                <input
                  id="delivrance-piece"
                  type="date"
                  value={values.date_delivrance_piece}
                  onChange={(event) => setValue('date_delivrance_piece', event.target.value)}
                />
              </Field>
              <Field label="Date d’expiration" htmlFor="expiration-piece">
                <input
                  id="expiration-piece"
                  type="date"
                  value={values.date_expiration_piece}
                  min={values.date_delivrance_piece || undefined}
                  onChange={(event) => setValue('date_expiration_piece', event.target.value)}
                />
              </Field>
              <Field label="Lieu de délivrance" htmlFor="lieu-piece">
                <input
                  id="lieu-piece"
                  value={values.lieu_delivrance_piece}
                  onChange={(event) => setValue('lieu_delivrance_piece', event.target.value)}
                />
              </Field>
            </div>

            <label className="artisan-form__drop" htmlFor="piece-upload">
              <Upload aria-hidden="true" />
              <strong>Joindre la copie de la pièce</strong>
              <small>JPG, PNG ou PDF — 5 Mo maximum</small>
              <input id="piece-upload" type="file" accept="image/jpeg,image/png,application/pdf" onChange={handlePiece} />
            </label>

            {pieceFile && (
              <p className="artisan-form__fichier">
                <FileText aria-hidden="true" />
                {pieceFile.name} <small>{Math.round(pieceFile.size / 1024)} Ko · à envoyer</small>
                <button type="button" aria-label="Retirer le document" onClick={() => setPieceFile(null)}>
                  <X aria-hidden="true" />
                </button>
              </p>
            )}

            {!pieceFile && values.piece_identite_url && (
              <p className="artisan-form__fichier">
                <FileText aria-hidden="true" />
                <a href={values.piece_identite_url} target="_blank" rel="noreferrer">
                  Document déjà versé au dossier
                </a>
              </p>
            )}
          </Section>

          <Section
            id="carte"
            icon={CreditCard}
            tone="amber"
            title="Photo et carte professionnelle"
            description="Photo d’identité utilisée sur la carte et aperçu du titre."
          >
            <div className="artisan-form__carte">
              <div>
                <label className="artisan-form__drop" htmlFor="photo-upload">
                  <UserRound aria-hidden="true" />
                  <strong>Photo d’identité</strong>
                  <small>JPG ou PNG — 2 Mo maximum</small>
                  <input id="photo-upload" type="file" accept="image/jpeg,image/png" onChange={handlePhoto} />
                </label>
                {photoFile && (
                  <p className="artisan-form__fichier">
                    <UserRound aria-hidden="true" />
                    {photoFile.name} <small>{Math.round(photoFile.size / 1024)} Ko · à envoyer</small>
                    <button
                      type="button"
                      aria-label="Retirer la photo"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(artisan?.photo_url || '');
                      }}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </p>
                )}
              </div>

              <div className="artisan-form__apercu">
                <button type="button" className="sn-btn" onClick={handlePreview} disabled={generating}>
                  {generating ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  Générer l’aperçu de la carte
                </button>
                {cartePreview ? (
                  <img src={cartePreview} alt="Aperçu de la carte professionnelle" />
                ) : (
                  <p className="artisan-form__apercu-vide">
                    L’aperçu reflète les informations saisies ; il ne vaut pas délivrance.
                  </p>
                )}
              </div>
            </div>
          </Section>

          <div className="sn-form-actions">
            {validationError && <span className="artisan-form__hint">{validationError}</span>}
            <button type="button" className="sn-btn" onClick={onCancel} disabled={saving}>
              <X aria-hidden="true" /> Annuler
            </button>
            <button type="submit" className="sn-btn sn-btn--primary" disabled={saving || Boolean(validationError)}>
              {saving ? (
                <>
                  <Loader2 className="sn-spin" aria-hidden="true" /> Enregistrement…
                </>
              ) : (
                <>
                  <Save aria-hidden="true" /> {isEditMode ? 'Mettre à jour la fiche' : 'Enregistrer l’artisan'}
                </>
              )}
            </button>
          </div>
        </form>

        <aside className="artisan-form__aside" aria-label="Suivi de la saisie">
          <section className="sn-card artisan-form__resume">
            <h2>
              <Contact aria-hidden="true" /> Fiche en cours
            </h2>
            {photoPreview ? (
              <img className="artisan-form__photo" src={photoPreview} alt="Photo de l’artisan" />
            ) : (
              <div className="artisan-form__photo is-vide" aria-hidden="true">
                <UserRound />
              </div>
            )}
            <p className="artisan-form__resume-nom">
              {values.type_personne === 'morale'
                ? values.raison_sociale || 'Raison sociale à renseigner'
                : [values.nom, values.prenoms].filter(Boolean).join(' ') || 'Identité à renseigner'}
            </p>
            <div className="artisan-form__badges">
              <Badge tone="info">{TYPE_ARTISAN_OPTIONS.find((o) => o.value === values.type_artisan)?.label}</Badge>
              {values.region && <Badge tone="neutral">{values.region}</Badge>}
            </div>
            <div
              className="artisan-form__jauge"
              role="progressbar"
              aria-valuenow={completion}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Complétude de la fiche"
            >
              <span style={{ width: `${completion}%` }} />
            </div>
            <p className="artisan-form__jauge-legende">Fiche complétée à {completion} %</p>
          </section>

          {isEditMode && artisan?.numero_carte && (
            <section className="sn-card artisan-form__carte-info">
              <h2>
                <CreditCard aria-hidden="true" /> Carte professionnelle
              </h2>
              <p>{artisan.numero_carte}</p>
              <small>Les modifications d’identité n’altèrent pas la carte déjà délivrée.</small>
            </section>
          )}

          <Note tone="info" icon={AlertCircle}>
            La photo et la copie de pièce ne sont envoyées qu’après l’enregistrement de la
            fiche : un échec d’envoi vous sera signalé explicitement.
          </Note>
        </aside>
      </div>
    </div>
  );
}
