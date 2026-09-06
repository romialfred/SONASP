import fiscalReference from "@/data/comptoirTaxOffices.json";

export const COMPTOIR_TAX_OFFICES = fiscalReference.offices;
export const COMPTOIR_LEGAL_FORMS = [
  { value: "SARL", label: "SARL — Société à responsabilité limitée" },
  { value: "SA", label: "SA — Société anonyme" },
  { value: "EI", label: "Entreprise individuelle" },
  { value: "SAS", label: "SAS — Société par actions simplifiée" },
  { value: "SNC", label: "SNC — Société en nom collectif" },
  { value: "SCS", label: "SCS — Société en commandite simple" },
] as const;
export const COMPTOIR_TAX_REGIMES = [
  { value: "RNI", label: "Réel normal d’imposition (RNI)" },
  { value: "RSI", label: "Réel simplifié d’imposition (RSI)" },
  { value: "CME", label: "Contribution des micro-entreprises (CME)" },
] as const;
export const COMPTOIR_DOCUMENT_KINDS = [
  { value: "logo", label: "Logo de la société", image: true },
  { value: "rccm", label: "Extrait RCCM", image: false },
  { value: "ifu", label: "Attestation IFU", image: false },
  {
    value: "purchase_authorization",
    label: "Autorisation d’achat d’or",
    image: false,
  },
  {
    value: "representative_identity",
    label: "Pièce d’identité du responsable",
    image: false,
  },
  {
    value: "representative_photo",
    label: "Photo d’identité du responsable",
    image: true,
  },
  { value: "other", label: "Autre justificatif de la société", image: false },
] as const;
export type ComptoirDocumentKind =
  (typeof COMPTOIR_DOCUMENT_KINDS)[number]["value"];
export const COMPTOIR_SECTIONS = [
  "Société",
  "Immatriculation et fiscalité",
  "Autorisation d’achat",
  "Adresse et contacts",
  "Premier responsable",
  "Documents complémentaires",
] as const;
export function emptyComptoir() {
  return {
    name: "",
    short_name: "",
    legal_form: "",
    capital: "",
    rccm_number: "",
    rccm_issued_on: "",
    ifu_number: "",
    ifu_issued_on: "",
    tax_regime: "",
    tax_office_code: "",
    authorization_number: "",
    authorization_issuer: "",
    authorization_issued_on: "",
    authorization_expires_on: "",
    country: "BF",
    region: "",
    city: "",
    district: "",
    street: "",
    postal_address: "",
    phone: "",
    email: "",
    website: "",
    representative_last_name: "",
    representative_first_name: "",
    representative_position: "",
    representative_phone: "",
    representative_email: "",
    representative_identity_type: "",
    representative_identity_number: "",
    representative_identity_issued_on: "",
    representative_identity_expires_on: "",
    notes: "",
  };
}
export type ComptoirValues = ReturnType<typeof emptyComptoir>;
export type ComptoirKey = keyof ComptoirValues;
export const COMPTOIR_FIELD_LABELS: Record<ComptoirKey, string> = {
  name: "Dénomination sociale",
  short_name: "Sigle / nom commercial",
  legal_form: "Type d’entreprise",
  capital: "Capital social (FCFA)",
  rccm_number: "Numéro RCCM",
  rccm_issued_on: "Date d’immatriculation",
  ifu_number: "Numéro IFU",
  ifu_issued_on: "Date de délivrance de l’IFU",
  tax_regime: "Régime d’imposition",
  tax_office_code: "Direction / centre DGI de rattachement",
  authorization_number: "Numéro de l’autorisation",
  authorization_issuer: "Autorité de délivrance",
  authorization_issued_on: "Date de délivrance de l’autorisation",
  authorization_expires_on: "Date d’expiration de l’autorisation",
  country: "Pays",
  region: "Région",
  city: "Ville / commune",
  district: "Quartier / secteur",
  street: "Rue, porte et repère",
  postal_address: "Adresse postale",
  phone: "Téléphone de la société",
  email: "E-mail de la société",
  website: "Site internet",
  representative_last_name: "Nom du responsable",
  representative_first_name: "Prénom(s) du responsable",
  representative_position: "Fonction",
  representative_phone: "Téléphone du responsable",
  representative_email: "E-mail du responsable",
  representative_identity_type: "Type de pièce d’identité",
  representative_identity_number: "Numéro de pièce d’identité",
  representative_identity_issued_on: "Date de délivrance de la pièce",
  representative_identity_expires_on: "Date d’expiration de la pièce",
  notes: "Observations",
};
export const COMPTOIR_REQUIRED_FIELDS: ComptoirKey[] = [
  "name",
  "legal_form",
  "rccm_number",
  "ifu_number",
  "tax_regime",
  "tax_office_code",
  "authorization_number",
  "authorization_issuer",
  "authorization_issued_on",
  "authorization_expires_on",
  "city",
  "district",
  "phone",
  "representative_last_name",
  "representative_first_name",
  "representative_position",
  "representative_phone",
  "representative_email",
  "representative_identity_type",
  "representative_identity_number",
];
export const COMPTOIR_REQUIRED_DOCUMENTS: ComptoirDocumentKind[] = [
  "rccm",
  "ifu",
  "purchase_authorization",
  "representative_identity",
  "representative_photo",
];
export function validComptoirDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01" ||
    value > "9999-12-31"
  )
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function authorizationDays(
  values: Pick<
    ComptoirValues,
    "authorization_issued_on" | "authorization_expires_on"
  >,
) {
  const start = values.authorization_issued_on,
    end = values.authorization_expires_on;
  if (!validComptoirDate(start) || !validComptoirDate(end) || end < start)
    return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}
export function comptoirErrors(
  v: ComptoirValues,
): Partial<Record<ComptoirKey, string>> {
  const errors: Partial<Record<ComptoirKey, string>> = {};
  // Un dossier incomplet peut être enregistré ; les anomalies présentes ne le peuvent pas.
  for (const key of ["name", "legal_form", "city"] as ComptoirKey[])
    if (!v[key].trim())
      errors[key] = "Ce champ est obligatoire pour enregistrer le dossier.";
  if (v.name.trim() && (v.name.trim().length < 3 || v.name.trim().length > 180))
    errors.name = "Saisissez entre 3 et 180 caractères.";
  if (!COMPTOIR_LEGAL_FORMS.some((o) => o.value === v.legal_form))
    errors.legal_form = "Sélectionnez un type d’entreprise.";
  if (v.country !== "BF")
    errors.country = "Le siège du comptoir doit être au Burkina Faso.";
  if (
    v.tax_regime &&
    !COMPTOIR_TAX_REGIMES.some((o) => o.value === v.tax_regime)
  )
    errors.tax_regime = "Sélectionnez un régime dans la liste.";
  if (
    v.tax_office_code &&
    !COMPTOIR_TAX_OFFICES.some((o) => o.code === v.tax_office_code)
  )
    errors.tax_office_code = "Sélectionnez une structure DGI dans la liste.";
  if (
    v.representative_identity_type &&
    !["CNIB", "PASSPORT", "RESIDENCE_PERMIT"].includes(
      v.representative_identity_type,
    )
  )
    errors.representative_identity_type =
      "Sélectionnez une pièce dans la liste.";
  for (const key of Object.keys(v) as ComptoirKey[]) {
    if (v[key].length > (key === "notes" ? 4000 : 250))
      errors[key] = "Le texte est trop long.";
    if (key.endsWith("_on") && v[key] && !validComptoirDate(v[key]))
      errors[key] = "Saisissez une date valide.";
  }
  for (const key of ["email", "representative_email"] as const)
    if (v[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v[key]))
      errors[key] = "Saisissez une adresse e-mail valide.";
  for (const key of ["phone", "representative_phone"] as const)
    if (v[key] && !/^\+?[\d ()-]{8,25}$/.test(v[key]))
      errors[key] = "Saisissez un téléphone valide, avec son indicatif.";
  if (v.website && !/^https?:\/\/[^\s]+$/i.test(v.website))
    errors.website = "L’adresse doit commencer par https:// ou http://.";
  if (v.capital && !/^\d{1,15}$/.test(v.capital))
    errors.capital = "Saisissez un montant entier positif en FCFA.";
  for (const [start, end] of [
    ["authorization_issued_on", "authorization_expires_on"],
    ["representative_identity_issued_on", "representative_identity_expires_on"],
  ] as const) {
    if (v[end] && !v[start])
      errors[start] = "Renseignez la date de délivrance.";
    if (v[start] && v[end] && v[end] < v[start])
      errors[end] = "L’expiration doit suivre la délivrance.";
  }
  return errors;
}
export function comptoirCompletion(
  v: ComptoirValues,
  kinds: readonly string[],
) {
  const errors = comptoirErrors(v);
  const fields = COMPTOIR_REQUIRED_FIELDS.map((key) => ({
    label: COMPTOIR_FIELD_LABELS[key],
    filled: !!v[key].trim() && !errors[key],
    key,
  }));
  const documents = COMPTOIR_REQUIRED_DOCUMENTS.map((kind) => ({
    label: COMPTOIR_DOCUMENT_KINDS.find((d) => d.value === kind)!.label,
    filled: kinds.includes(kind),
    key: kind,
  }));
  const items = [...fields, ...documents];
  return {
    items,
    filled: items.filter((i) => i.filled).length,
    total: items.length,
    percent: Math.round(
      (100 * items.filter((i) => i.filled).length) / items.length,
    ),
  };
}
export function authorizationStatus(
  v: ComptoirValues,
  today = new Date().toISOString().slice(0, 10),
) {
  if (authorizationDays(v) === null || !v.authorization_number)
    return { label: "À renseigner", tone: "neutral" as const };
  if (v.authorization_expires_on < today)
    return { label: "Expirée", tone: "danger" as const };
  if (v.authorization_issued_on > today)
    return { label: "À venir", tone: "warning" as const };
  if (
    Date.parse(v.authorization_expires_on) - Date.parse(today) <=
    30 * 86400000
  )
    return { label: "Expire bientôt", tone: "warning" as const };
  return { label: "Période en cours", tone: "success" as const };
}
