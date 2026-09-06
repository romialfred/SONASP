import type {
  ArtisanMinier,
  TypeArtisan,
  TypePersonne,
} from '@/services/artisanMinierService';

export interface ResponsableArtisan {
  id?: string;
  artisan_id?: string;
  nom: string;
  prenoms: string;
  date_naissance: string;
  telephone: string;
  whatsapp: string;
  whatsapp_identique: boolean;
  email: string;
  fonction: string;
  type_piece_identite: string;
  numero_piece_identite: string;
  date_delivrance_piece: string;
  date_expiration_piece: string;
  lieu_delivrance_piece: string;
}

export const EMPTY_RESPONSABLE: ResponsableArtisan = {
  nom: '',
  prenoms: '',
  date_naissance: '',
  telephone: '',
  whatsapp: '',
  whatsapp_identique: false,
  email: '',
  fonction: '',
  type_piece_identite: 'CNI',
  numero_piece_identite: '',
  date_delivrance_piece: '',
  date_expiration_piece: '',
  lieu_delivrance_piece: '',
};

export const EMPTY_ARTISAN_FORM = {
  type_personne: 'physique' as TypePersonne,
  type_artisan: 'exploitant' as TypeArtisan,
  nom: '',
  prenoms: '',
  raison_sociale: '',
  numero_registre_commerce: '',
  numero_ifu: '',
  date_naissance: '',
  lieu_naissance: '',
  nationalite: 'Burkinabé',
  sexe: '' as '' | 'M' | 'F' | 'Autre',
  pays: 'Burkina Faso',
  region: '',
  commune: '',
  adresse: '',
  siege_pays: 'Burkina Faso',
  siege_region: '',
  siege_commune: '',
  siege_adresse: '',
  telephone: '',
  whatsapp: '',
  whatsapp_identique: false,
  email: '',
  artisanal_site_id: '',
  exploitant_id: '',
  type_piece_identite: 'CNI' as 'CNI' | 'Passeport' | 'Permis' | 'Autre',
  numero_piece_identite: '',
  date_delivrance_piece: '',
  date_expiration_piece: '',
  lieu_delivrance_piece: '',
  observations: '',
  photo_url: '',
  piece_identite_url: '',
  responsable: { ...EMPTY_RESPONSABLE },
};
export type ArtisanFormValues = typeof EMPTY_ARTISAN_FORM;
export type ArtisanDossier = ArtisanMinier & {
  numero_ifu?: string | null;
  whatsapp?: string | null;
  whatsapp_identique?: boolean;
  siege_pays?: string | null;
  siege_region?: string | null;
  siege_commune?: string | null;
  siege_adresse?: string | null;
  exploitant_id?: string | null;
  responsable?: ResponsableArtisan | null;
  dossier_version?: number;
};
export const ARTISAN_ROLE_LABELS: Record<TypeArtisan, string> = {
  exploitant: 'Exploitant',
  fournisseur: 'Fournisseur',
  aide_exploitant: 'Aide exploitant',
  intermediaire: 'Intermédiaire',
  collecteur: 'Collecteur (historique)',
};
export const EDITABLE_ARTISAN_ROLES: TypeArtisan[] = [
  'exploitant',
  'fournisseur',
  'aide_exploitant',
  'intermediaire',
];

export function valuesFromArtisan(
  artisan?: Partial<ArtisanDossier> | null,
): ArtisanFormValues {
  const values = {
    ...EMPTY_ARTISAN_FORM,
    responsable: { ...EMPTY_RESPONSABLE },
  };
  if (!artisan) return values;
  for (const key of Object.keys(values) as Array<keyof ArtisanFormValues>) {
    if (key === 'responsable') continue;
    const value = artisan[key as keyof ArtisanDossier];
    if (value !== null && value !== undefined)
      Object.assign(values, { [key]: value });
  }
  if (artisan.responsable) {
    for (const [key, value] of Object.entries(artisan.responsable)) {
      if (value != null) Object.assign(values.responsable, { [key]: value });
    }
  }
  return values;
}

export function calculateAge(value: string, today = new Date()): number {
  const birth = new Date(`${value}T12:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    age--;
  return age;
}

export interface DossierRequirement {
  key: string;
  label: string;
  section: string;
  value: string;
}
export function dossierRequirements(
  v: ArtisanFormValues,
): DossierRequirement[] {
  const list: DossierRequirement[] = [];
  const add = (key: keyof ArtisanFormValues, label: string, section: string) =>
    list.push({ key, label, section, value: String(v[key]) });
  add('type_personne', 'Qualité juridique', 'profil');
  add('type_artisan', 'Rôle', 'profil');
  if (v.type_personne === 'physique') {
    add('nom', 'Nom', 'identite');
    add('date_naissance', 'Date de naissance', 'identite');
    add('type_piece_identite', 'Type de pièce', 'piece');
    add('numero_piece_identite', 'Numéro de pièce', 'piece');
  } else {
    add('raison_sociale', 'Raison sociale', 'societe');
    add('numero_registre_commerce', 'RCCM', 'societe');
    add('numero_ifu', 'IFU', 'societe');
    add('siege_pays', 'Pays du siège', 'societe');
    add('siege_region', 'Région du siège', 'societe');
    add('siege_commune', 'Commune du siège', 'societe');
    add('siege_adresse', 'Adresse du siège', 'societe');
    for (const [key, label] of Object.entries({
      nom: 'Nom',
      prenoms: 'Prénom(s)',
      date_naissance: 'Date de naissance',
      telephone: 'Téléphone',
      fonction: 'Fonction',
      type_piece_identite: 'Type de pièce',
      numero_piece_identite: 'Numéro de pièce',
    })) {
      list.push({
        key: `responsable.${key}`,
        label: `${label} du responsable`,
        section: 'responsable',
        value: String(v.responsable[key as keyof ResponsableArtisan] || ''),
      });
    }
  }
  add('pays', 'Pays', 'localisation');
  add('region', 'Région', 'localisation');
  add('commune', 'Commune', 'localisation');
  add(
    'telephone',
    v.type_personne === 'morale' ? 'Téléphone de la société' : 'Téléphone',
    'coordonnees',
  );
  if (v.type_artisan === 'aide_exploitant')
    add('exploitant_id', 'Exploitant de rattachement', 'localisation');
  return list;
}

export function artisanErrors(v: ArtisanFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of dossierRequirements(v))
    if (!field.value.trim())
      errors[field.key] = `${field.label} : champ obligatoire.`;
  const today = new Date().toISOString().slice(0, 10);
  const contact = (
    prefix: string,
    obj: {
      telephone: string;
      whatsapp: string;
      whatsapp_identique: boolean;
      email: string;
    },
  ) => {
    for (const key of ['telephone', 'whatsapp'] as const) {
      const value =
        key === 'whatsapp' && obj.whatsapp_identique ? obj.telephone : obj[key];
      if (value && !/^\+[1-9]\d{6,14}$/.test(value.replace(/[\s().-]/g, '')))
        errors[`${prefix}${key}`] =
          'Saisissez un numéro international valide avec indicatif.';
    }
    if (obj.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(obj.email))
      errors[`${prefix}email`] = 'L’adresse e-mail est invalide.';
  };
  const identity = (
    prefix: string,
    obj: Pick<
      ResponsableArtisan,
      'date_naissance' | 'date_delivrance_piece' | 'date_expiration_piece'
    >,
    adult: boolean,
  ) => {
    if (
      obj.date_naissance &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(obj.date_naissance) ||
        !Number.isFinite(Date.parse(obj.date_naissance)) ||
        obj.date_naissance > today)
    )
      errors[`${prefix}date_naissance`] =
        'La date de naissance est invalide ou future.';
    else if (
      adult &&
      obj.date_naissance &&
      calculateAge(obj.date_naissance) < 18
    )
      errors[`${prefix}date_naissance`] =
        'L’artisan minier doit avoir au moins 18 ans.';
    if (obj.date_delivrance_piece > today)
      errors[`${prefix}date_delivrance_piece`] =
        'La délivrance ne peut pas être future.';
    if (
      obj.date_expiration_piece &&
      obj.date_delivrance_piece &&
      obj.date_expiration_piece < obj.date_delivrance_piece
    )
      errors[`${prefix}date_expiration_piece`] =
        'L’expiration de la pièce précède sa délivrance.';
  };
  contact('', v);
  if (v.type_personne === 'morale') {
    contact('responsable.', v.responsable);
    identity('responsable.', v.responsable, false);
  } else identity('', v, true);
  return errors;
}
export function validateArtisan(v: ArtisanFormValues): string | null {
  return Object.values(artisanErrors(v))[0] || null;
}
export function completionRate(v: ArtisanFormValues): number {
  const required = dossierRequirements(v);
  const errors = artisanErrors(v);
  return Math.round(
    (100 * required.filter((f) => !errors[f.key]).length) / required.length,
  );
}

/** Only the active legal branch is transmitted. Drafts remain in component memory. */
export function artisanDossierPayload(v: ArtisanFormValues) {
  const common = {
    type_personne: v.type_personne,
    type_artisan: v.type_artisan,
    pays: v.pays,
    region: v.region,
    commune: v.commune,
    adresse: v.adresse,
    telephone: v.telephone,
    email: v.email,
    observations: v.observations,
    whatsapp: v.whatsapp_identique ? v.telephone : v.whatsapp,
    whatsapp_identique: v.whatsapp_identique,
    artisanal_site_id:
      v.type_artisan === 'aide_exploitant' ? null : v.artisanal_site_id || null,
    exploitant_id:
      v.type_artisan === 'aide_exploitant' ? v.exploitant_id || null : null,
  };
  return v.type_personne === 'morale'
    ? {
        ...common,
        raison_sociale: v.raison_sociale,
        numero_registre_commerce: v.numero_registre_commerce,
        numero_ifu: v.numero_ifu,
        siege_pays: v.siege_pays,
        siege_region: v.siege_region,
        siege_commune: v.siege_commune,
        siege_adresse: v.siege_adresse,
        responsable: {
          ...v.responsable,
          whatsapp: v.responsable.whatsapp_identique
            ? v.responsable.telephone
            : v.responsable.whatsapp,
        },
      }
    : {
        ...common,
        nom: v.nom,
        prenoms: v.prenoms,
        date_naissance: v.date_naissance || null,
        lieu_naissance: v.lieu_naissance,
        nationalite: v.nationalite,
        sexe: v.sexe || null,
        type_piece_identite: v.type_piece_identite,
        numero_piece_identite: v.numero_piece_identite,
        date_delivrance_piece: v.date_delivrance_piece || null,
        date_expiration_piece: v.date_expiration_piece || null,
        lieu_delivrance_piece: v.lieu_delivrance_piece,
      };
}
