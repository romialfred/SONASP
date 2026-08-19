import { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { getRegionCells } from '@/data/burkinaRegions';
import { MAP_HEIGHT as HEIGHT, MAP_WIDTH as WIDTH, project, toPath } from './burkinaProjection';
import './burkina-territory-map.css';

export type TerritoryStatus = 'active' | 'planned' | 'watch' | 'suspended';

export interface TerritorySite {
  id: string;
  name: string;
  region: string;
  longitude: number;
  latitude: number;
  status: TerritoryStatus;
  /** Lignes affichées dans l'infobulle, sous le nom du site. */
  details: string[];
}

export interface TerritoryRegionValue {
  artisans: number;
  sites: number;
}

interface BurkinaTerritoryMapProps {
  /** `sites` : implantation par statut. `density` : choroplèthe par nombre d'artisans. */
  variant: 'sites' | 'density';
  sites: TerritorySite[];
  regionValues?: Record<string, TerritoryRegionValue>;
  /** Région mise en avant à l'ouverture (infobulle pré-affichée). */
  defaultHighlight?: string;
}

const ZOOM_LEVELS = [1, 1.35, 1.8];

export const STATUS_COLORS: Record<TerritoryStatus, string> = {
  active: '#0f9f6e',
  planned: '#d99a00',
  watch: '#f08a24',
  suspended: '#e4453d',
};

export const STATUS_LABELS: Record<TerritoryStatus, string> = {
  active: 'Actif',
  planned: 'Planifié',
  watch: 'Sous surveillance',
  suspended: 'Suspendu',
};

const DENSITY_SCALE = [
  { limit: 50, fill: '#e6f5ec', label: '0 – 50' },
  { limit: 100, fill: '#bfe6d1', label: '51 – 100' },
  { limit: 200, fill: '#79c79d', label: '101 – 200' },
  { limit: Infinity, fill: '#137a55', label: '+ 200' },
];

const densityFill = (artisans: number) =>
  DENSITY_SCALE.find((step) => artisans <= step.limit)?.fill || DENSITY_SCALE[0].fill;

const integer = new Intl.NumberFormat('fr-FR');

export function BurkinaTerritoryMap({
  variant,
  sites,
  regionValues,
  defaultHighlight,
}: BurkinaTerritoryMapProps) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(defaultHighlight || null);
  const zoom = ZOOM_LEVELS[zoomIndex];

  const cells = useMemo(
    () =>
      getRegionCells().map((cell) => {
        const points = cell.polygons.flatMap((polygon) =>
          polygon.map(([longitude, latitude]) => project(longitude, latitude))
        );
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        return {
          ...cell,
          // Une région = plusieurs sous-tracés (ses provinces) dans un seul chemin.
          path: cell.polygons.map((polygon) => toPath(polygon)).join(' '),
          label: project(cell.centroid[0], cell.centroid[1]),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };
      }),
    []
  );

  const plotted = useMemo(
    () => sites.map((site) => ({ ...site, ...project(site.longitude, site.latitude) })),
    [sites]
  );

  /** Applique le zoom (mise à l'échelle autour du centre) pour positionner l'infobulle HTML. */
  const scaled = (point: { x: number; y: number }) => ({
    x: WIDTH / 2 + (point.x - WIDTH / 2) * zoom,
    y: HEIGHT / 2 + (point.y - HEIGHT / 2) * zoom,
  });

  const activeSite = plotted.find((site) => site.id === activeSiteId) || null;
  const activeCell = cells.find((cell) => cell.name === activeRegion) || null;
  const tooltipAnchor = activeSite
    ? scaled({ x: activeSite.x, y: activeSite.y })
    : activeCell
      ? scaled(activeCell.label)
      : null;

  return (
    <div className={`territory-map territory-map--${variant}`}>
      <div className="territory-map__canvas">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Carte des régions du Burkina Faso">
          <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${zoom}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>
            {cells.map((cell) => {
              const value = regionValues?.[cell.name];
              const isActive = activeRegion === cell.name;
              return (
                <path
                  key={cell.name}
                  d={cell.path}
                  className={`territory-map__region${isActive ? ' is-active' : ''}`}
                  fill={variant === 'density' ? densityFill(value?.artisans || 0) : '#f2faf5'}
                  onMouseEnter={() => variant === 'density' && setActiveRegion(cell.name)}
                  onMouseLeave={() => variant === 'density' && setActiveRegion(defaultHighlight || null)}
                >
                  <title>{`${cell.name}${value ? ` — ${integer.format(value.artisans)} artisans` : ''}`}</title>
                </path>
              );
            })}

            {cells
              .filter((cell) => cell.width > 58 && cell.height > 34)
              .map((cell) => (
                <text
                  key={`label-${cell.name}`}
                  className="territory-map__region-label"
                  x={cell.label.x}
                  y={cell.label.y}
                  textAnchor="middle"
                  fontSize={variant === 'sites' ? 9.5 : 10.5}
                >
                  {variant === 'sites' ? cell.name.toLocaleUpperCase('fr') : cell.name}
                </text>
              ))}

            {plotted.map((site) => (
              <g
                key={site.id}
                className="territory-map__site"
                role="button"
                tabIndex={0}
                aria-label={`${site.name}, ${site.region}`}
                onMouseEnter={() => setActiveSiteId(site.id)}
                onMouseLeave={() => setActiveSiteId(null)}
                onFocus={() => setActiveSiteId(site.id)}
                onBlur={() => setActiveSiteId(null)}
              >
                <circle
                  cx={site.x}
                  cy={site.y}
                  r={activeSiteId === site.id ? 8.5 : 6}
                  fill={variant === 'density' ? '#e2a000' : STATUS_COLORS[site.status]}
                  stroke="#fff"
                  strokeWidth={2}
                />
                <title>{site.name}</title>
              </g>
            ))}
          </g>
        </svg>

        <div className="territory-map__zoom">
          <button
            type="button"
            onClick={() => setZoomIndex((index) => Math.min(index + 1, ZOOM_LEVELS.length - 1))}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            aria-label="Agrandir la carte"
          >
            <Plus aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoomIndex((index) => Math.max(index - 1, 0))}
            disabled={zoomIndex === 0}
            aria-label="Réduire la carte"
          >
            <Minus aria-hidden="true" />
          </button>
        </div>

        {tooltipAnchor && (activeSite || activeCell) && (
          <div
            className="territory-map__tooltip"
            style={{
              left: `${(tooltipAnchor.x / WIDTH) * 100}%`,
              top: `${(tooltipAnchor.y / HEIGHT) * 100}%`,
            }}
            role="status"
          >
            {activeSite ? (
              <>
                <strong>
                  {activeSite.name} <span>· {activeSite.region}</span>
                </strong>
                {activeSite.details.map((detail) => (
                  <span key={detail}>{detail}</span>
                ))}
              </>
            ) : (
              activeCell && (
                <>
                  <strong>{activeCell.name}</strong>
                  <span>{integer.format(regionValues?.[activeCell.name]?.artisans || 0)} artisans</span>
                  <span>{integer.format(regionValues?.[activeCell.name]?.sites || 0)} sites actifs</span>
                </>
              )
            )}
          </div>
        )}
      </div>

      <div className="territory-map__legend">
        {variant === 'sites'
          ? (Object.keys(STATUS_LABELS) as TerritoryStatus[]).map((status) => (
              <span key={status}>
                <i style={{ background: STATUS_COLORS[status] }} aria-hidden="true" />
                {STATUS_LABELS[status]}
              </span>
            ))
          : (
              <>
                <span className="territory-map__legend-title">Nombre d’artisans</span>
                {DENSITY_SCALE.map((step) => (
                  <span key={step.label}>
                    <i className="is-square" style={{ background: step.fill }} aria-hidden="true" />
                    {step.label}
                  </span>
                ))}
                <span>
                  <i style={{ background: '#e2a000' }} aria-hidden="true" />
                  Site minier actif
                </span>
              </>
            )}
      </div>
    </div>
  );
}
