import {
  EMPTY_ARTISAN_FORM,
  artisanErrors,
  artisanDossierPayload,
  type ArtisanFormValues,
} from "./artisanDossier";

export type CollectorFormValues = ArtisanFormValues & {
  organization_id: string;
  site_ids: string[];
};
export const emptyCollector = (): CollectorFormValues => ({
  ...EMPTY_ARTISAN_FORM,
  type_artisan: "collecteur",
  type_personne: "physique",
  organization_id: "",
  site_ids: [],
  responsable: { ...EMPTY_ARTISAN_FORM.responsable },
});
export const COLLECTOR_SECTIONS = [
  "Identité du collecteur",
  "Coordonnées et adresse",
  "Sites de collecte",
  "Organisme de rattachement",
  "Pièces justificatives",
  "Photo et observations",
];
export function collectorRequirements(v: CollectorFormValues) {
  return [
    { key: "nom", label: "Nom", section: 1, filled: !!v.nom.trim() },
    {
      key: "date_naissance",
      label: "Date de naissance",
      section: 1,
      filled: !!v.date_naissance,
    },
    {
      key: "telephone",
      label: "Téléphone",
      section: 2,
      filled: !!v.telephone.replace(/\D/g, "").match(/^\d{7,15}$/),
    },
    { key: "pays", label: "Pays", section: 2, filled: !!v.pays },
    { key: "region", label: "Région", section: 2, filled: !!v.region },
    { key: "commune", label: "Commune", section: 2, filled: !!v.commune },
    {
      key: "site_ids",
      label: "Au moins un site",
      section: 3,
      filled: v.site_ids.length > 0,
    },
    {
      key: "organization_id",
      label: "Comptoir ou SONASP",
      section: 4,
      filled: !!v.organization_id,
    },
    {
      key: "type_piece_identite",
      label: "Type de pièce",
      section: 5,
      filled: !!v.type_piece_identite,
    },
    {
      key: "numero_piece_identite",
      label: "Numéro de pièce",
      section: 5,
      filled: !!v.numero_piece_identite.trim(),
    },
  ];
}
export function collectorErrors(
  v: CollectorFormValues,
): Record<string, string> {
  // The shared identity rules remain unchanged; collector-only invariants are additive.
  const errors = artisanErrors({
    ...v,
    type_artisan: "exploitant",
    type_personne: "physique",
  });
  if (v.type_personne !== "physique")
    errors.type_personne = "Un collecteur est une personne physique.";
  if (!v.organization_id)
    errors.organization_id = "Choisissez un comptoir ou la SONASP.";
  if (!v.site_ids.length)
    errors.site_ids = "Ajoutez au moins un site de collecte.";
  return errors;
}
export function collectorPayload(v: CollectorFormValues) {
  return {
    identity: artisanDossierPayload({
      ...v,
      type_personne: "physique",
      type_artisan: "collecteur",
      artisanal_site_id: "",
    }),
    organization_id: v.organization_id,
    site_ids: [...new Set(v.site_ids)],
  };
}
