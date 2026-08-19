import type { LonLat } from '@/data/burkinaRegions';

export const MAP_WIDTH = 760;
export const MAP_HEIGHT = 380;

const PADDING = 16;
const LONGITUDE_MIN = -5.6;
const LONGITUDE_MAX = 2.5;
const LATITUDE_MIN = 9.35;
const LATITUDE_MAX = 15.2;

/** Échelle uniforme : le pays garde ses proportions réelles, centré dans le cadre. */
const SCALE = Math.min(
  (MAP_WIDTH - PADDING * 2) / (LONGITUDE_MAX - LONGITUDE_MIN),
  (MAP_HEIGHT - PADDING * 2) / (LATITUDE_MAX - LATITUDE_MIN)
);
const OFFSET_X = (MAP_WIDTH - (LONGITUDE_MAX - LONGITUDE_MIN) * SCALE) / 2;
const OFFSET_Y = (MAP_HEIGHT - (LATITUDE_MAX - LATITUDE_MIN) * SCALE) / 2;

/** Coordonnées géographiques → repère du `viewBox` SVG. */
export const project = (longitude: number, latitude: number) => ({
  x: OFFSET_X + (longitude - LONGITUDE_MIN) * SCALE,
  y: OFFSET_Y + (LATITUDE_MAX - latitude) * SCALE,
});

/** Repère du `viewBox` SVG → coordonnées géographiques (clic sur la carte). */
export const unproject = (x: number, y: number) => ({
  longitude: LONGITUDE_MIN + (x - OFFSET_X) / SCALE,
  latitude: LATITUDE_MAX - (y - OFFSET_Y) / SCALE,
});

/** Contour d'un polygone géographique en commande `d` SVG. */
export const toPath = (polygon: LonLat[]) =>
  `${polygon
    .map(([longitude, latitude], index) => {
      const point = project(longitude, latitude);
      return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(' ')} Z`;
