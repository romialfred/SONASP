export type SectorIndicator = {
  id: string;
  label: string;
  definition: string;
  value: number | null;
  unit: string;
  date: string | null;
  scope: string;
  population: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  updatedAt: string | null;
  estimated: boolean;
};

// No national aggregate approved for public disclosure exists in the current services.
// Keep missing data distinct from zero. Never query private registries from this page.
export const sectorIndicators: SectorIndicator[] = [
  {
    id: "industrial",
    label: "Mines d’or industrielles en production",
    definition:
      "Mines distinctes effectivement en production ; ne désigne ni le nombre de sociétés ni celui des permis.",
    population: "Mines en production",
  },
  {
    id: "semi-mechanized",
    label: "Mines d’or semi-mécanisées",
    definition:
      "Sites de la catégorie officielle semi-mécanisée ; les sites artisanaux ne sont pas assimilés à cette catégorie.",
    population: "Mines semi-mécanisées",
  },
  {
    id: "trading-houses",
    label: "Comptoirs d’achat",
    definition:
      "Comptoirs disposant d’un agrément en cours de validité à la date de référence.",
    population: "Comptoirs agréés actifs",
  },
  {
    id: "collectors",
    label: "Collecteurs d’or",
    definition:
      "Personnes physiques distinctes ; une personne intervenant sur plusieurs sites ne compte qu’une fois.",
    population: "Collecteurs distincts",
  },
  {
    id: "artisans",
    label: "Orpailleurs artisanaux",
    definition:
      "Population nationale des orpailleurs, à distinguer du nombre de dossiers enregistrés sur la plateforme.",
    population: "Orpailleurs à l’échelle nationale",
  },
].map((entry) => ({
  ...entry,
  value: null,
  unit: "nombre",
  date: null,
  scope: "Burkina Faso",
  sourceTitle: null,
  sourceUrl: null,
  updatedAt: null,
  estimated: false,
}));

export function hasPublishableValue(indicator: SectorIndicator) {
  return (
    indicator.value !== null &&
    Number.isFinite(indicator.value) &&
    indicator.value >= 0 &&
    Boolean(
      indicator.date &&
        indicator.sourceTitle &&
        indicator.scope &&
        indicator.population,
    )
  );
}
