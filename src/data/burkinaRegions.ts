import { BURKINA_FASO_BOUNDARY } from '@/data/artisanalSitesData';
import { BURKINA_PROVINCES, type BurkinaProvince } from '@/data/burkinaProvinces';

export type LonLat = readonly [number, number];

export interface BurkinaRegion {
  /** Nom officiel de la région (clé de jointure avec les données métier). */
  name: string;
  /** Longitude du barycentre de ses provinces. */
  longitude: number;
  /** Latitude du barycentre de ses provinces. */
  latitude: number;
}

const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;

/** Les 13 régions administratives, positionnées au barycentre de leurs provinces. */
export const BURKINA_REGIONS: BurkinaRegion[] = [
  ...new Set(BURKINA_PROVINCES.map((province) => province.region)),
].map((name) => {
  const provinces = BURKINA_PROVINCES.filter((province) => province.region === name);
  return {
    name,
    longitude: average(provinces.map((province) => province.longitude)),
    latitude: average(provinces.map((province) => province.latitude)),
  };
});

/**
 * Découpe un polygone par un demi-plan (algorithme de Sutherland-Hodgman).
 * Le demi-plan conservé est `a * x + b * y <= c`.
 */
function clipByHalfPlane(polygon: LonLat[], a: number, b: number, c: number): LonLat[] {
  if (polygon.length === 0) return [];
  const inside = (point: LonLat) => a * point[0] + b * point[1] <= c;
  const intersect = (from: LonLat, to: LonLat): LonLat => {
    const denominator = a * (to[0] - from[0]) + b * (to[1] - from[1]);
    if (denominator === 0) return to;
    const ratio = (c - a * from[0] - b * from[1]) / denominator;
    return [from[0] + ratio * (to[0] - from[0]), from[1] + ratio * (to[1] - from[1])];
  };

  const output: LonLat[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);

    if (currentInside) {
      if (!previousInside) output.push(intersect(previous, current));
      output.push(current);
    } else if (previousInside) {
      output.push(intersect(previous, current));
    }
  }
  return output;
}

type Seed = { longitude: number; latitude: number };

/** Médiatrice entre deux germes : conserve le côté du germe de référence. */
function clipTowardsSeed(polygon: LonLat[], seed: Seed, other: Seed): LonLat[] {
  const a = 2 * (other.longitude - seed.longitude);
  const b = 2 * (other.latitude - seed.latitude);
  const c = other.longitude ** 2 - seed.longitude ** 2 + other.latitude ** 2 - seed.latitude ** 2;
  return clipByHalfPlane(polygon, a, b, c);
}

function polygonArea(polygon: LonLat[]): number {
  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[(index + 1) % polygon.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function polygonCentroid(polygon: LonLat[]): LonLat {
  let area = 0;
  let x = 0;
  let y = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[(index + 1) % polygon.length];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    x += (x1 + x2) * cross;
    y += (y1 + y2) * cross;
  }

  if (area === 0) return polygon[0] ?? [0, 0];
  return [x / (3 * area), y / (3 * area)];
}

export interface ProvinceCell extends BurkinaProvince {
  polygon: LonLat[];
  centroid: LonLat;
}

export interface RegionCell extends BurkinaRegion {
  /** Une région est l'assemblage des cellules de ses provinces. */
  polygons: LonLat[][];
  centroid: LonLat;
}

const NATIONAL_OUTLINE: LonLat[] = BURKINA_FASO_BOUNDARY.map(([longitude, latitude]) => [
  longitude,
  latitude,
]);

let cachedProvinceCells: ProvinceCell[] | null = null;
let cachedRegionCells: RegionCell[] | null = null;
let cachedRegionBoundaries: LonLat[][] | null = null;

/**
 * Cellules des 45 provinces : découpage de proximité sur les chefs-lieux, borné par la
 * frontière nationale. Chaque point du pays est rattaché au chef-lieu le plus proche,
 * ce qui garantit qu'une province contient toujours son propre chef-lieu.
 *
 * ⚠️ Découpage **indicatif** : la lecture territoriale est fidèle, mais les limites ne
 * font pas foi. Un fichier officiel (GeoJSON ADM1/ADM2) reste nécessaire pour un usage
 * réglementaire.
 */
export function getProvinceCells(): ProvinceCell[] {
  if (cachedProvinceCells) return cachedProvinceCells;

  cachedProvinceCells = BURKINA_PROVINCES.map((province) => {
    const polygon = BURKINA_PROVINCES.reduce(
      (cell, other) => (other.name === province.name ? cell : clipTowardsSeed(cell, province, other)),
      NATIONAL_OUTLINE
    );
    return { ...province, polygon, centroid: polygonCentroid(polygon) };
  });

  return cachedProvinceCells;
}

/** Régions : regroupement des cellules de provinces, avec centroïde pondéré par les aires. */
export function getRegionCells(): RegionCell[] {
  if (cachedRegionCells) return cachedRegionCells;

  const provinceCells = getProvinceCells();
  cachedRegionCells = BURKINA_REGIONS.map((region) => {
    const cells = provinceCells.filter((cell) => cell.region === region.name);
    const areas = cells.map((cell) => polygonArea(cell.polygon));
    const total = areas.reduce((sum, area) => sum + area, 0) || 1;
    return {
      ...region,
      polygons: cells.map((cell) => cell.polygon),
      centroid: [
        cells.reduce((sum, cell, index) => sum + cell.centroid[0] * areas[index], 0) / total,
        cells.reduce((sum, cell, index) => sum + cell.centroid[1] * areas[index], 0) / total,
      ] as LonLat,
    };
  });

  return cachedRegionCells;
}

/**
 * Segments de frontière régionale : arêtes de cellules dont la province voisine
 * appartient à une autre région. Permet de tracer les limites de régions par-dessus
 * le maillage des provinces.
 */
export function getRegionBoundaries(): LonLat[][] {
  if (cachedRegionBoundaries) return cachedRegionBoundaries;

  const cells = getProvinceCells();
  const segments: LonLat[][] = [];

  cells.forEach((cell) => {
    for (let index = 0; index < cell.polygon.length; index += 1) {
      const start = cell.polygon[index];
      const end = cell.polygon[(index + 1) % cell.polygon.length];
      const middle: LonLat = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];

      // Province voisine : deuxième chef-lieu le plus proche du milieu de l'arête.
      const ranked = [...BURKINA_PROVINCES].sort(
        (a, b) =>
          (a.longitude - middle[0]) ** 2 +
          (a.latitude - middle[1]) ** 2 -
          ((b.longitude - middle[0]) ** 2 + (b.latitude - middle[1]) ** 2)
      );
      const neighbour = ranked.find((province) => province.name !== cell.name);
      if (!neighbour || neighbour.region === cell.region) continue;

      // Une arête frontalière est partagée : on ne la garde qu'une fois.
      if (cell.region < neighbour.region) segments.push([start, end]);
    }
  });

  cachedRegionBoundaries = segments;
  return segments;
}

/** Province contenant un point donné (test d'appartenance au polygone). */
export function findProvinceAt(longitude: number, latitude: number): ProvinceCell | null {
  return (
    getProvinceCells().find((cell) => {
      let inside = false;
      const { polygon } = cell;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        const intersects =
          yi > latitude !== yj > latitude &&
          longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
      }
      return inside;
    }) || null
  );
}
