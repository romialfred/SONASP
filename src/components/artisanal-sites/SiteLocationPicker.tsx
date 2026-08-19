import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { findProvinceAt, getProvinceCells, getRegionBoundaries } from '@/data/burkinaRegions';
import { MAP_HEIGHT, MAP_WIDTH, project, toPath, unproject } from './burkinaProjection';
import './site-location-picker.css';

interface SiteLocationPickerProps {
  latitude: number;
  longitude: number;
  /** Région et province du site : leurs mailles sont mises en évidence. */
  region?: string;
  province?: string;
  onChange: (location: {
    latitude: number;
    longitude: number;
    region?: string;
    province?: string;
  }) => void;
}

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

/**
 * Carte cliquable de positionnement : elle affiche le maillage des 45 provinces et les
 * limites des 13 régions. Le clic renvoie les coordonnées **et** le rattachement
 * territorial correspondant. Les champs latitude/longitude restent la saisie de
 * référence (accès clavier).
 */
export function SiteLocationPicker({
  latitude,
  longitude,
  region,
  province,
  onChange,
}: SiteLocationPickerProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const provinces = useMemo(
    () =>
      getProvinceCells().map((cell) => ({
        name: cell.name,
        region: cell.region,
        capital: cell.capital,
        path: toPath(cell.polygon),
        label: project(cell.centroid[0], cell.centroid[1]),
      })),
    []
  );
  const boundaries = useMemo(
    () =>
      getRegionBoundaries().map(([start, end]) => {
        const from = project(start[0], start[1]);
        const to = project(end[0], end[1]);
        return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
      }),
    []
  );

  const point = project(longitude, latitude);
  const insideFrame = point.x >= 0 && point.x <= MAP_WIDTH && point.y >= 0 && point.y <= MAP_HEIGHT;
  const hoveredProvince = provinces.find((cell) => cell.name === hovered);

  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * MAP_WIDTH;
    const y = ((event.clientY - bounds.top) / bounds.height) * MAP_HEIGHT;
    const coordinates = unproject(x, y);
    const cell = findProvinceAt(coordinates.longitude, coordinates.latitude);

    onChange({
      latitude: round(coordinates.latitude),
      longitude: round(coordinates.longitude),
      region: cell?.region,
      province: cell?.name,
    });
  };

  return (
    <div className="location-picker">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        onClick={handleClick}
        role="img"
        aria-label="Carte des régions et provinces du Burkina Faso : cliquez pour positionner le site"
      >
        {provinces.map((cell) => (
          <path
            key={cell.name}
            d={cell.path}
            className={[
              'location-picker__province',
              cell.region === region ? 'is-region' : '',
              cell.name === province ? 'is-province' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onMouseEnter={() => setHovered(cell.name)}
            onMouseLeave={() => setHovered(null)}
          >
            <title>{`${cell.name} — ${cell.region} (chef-lieu : ${cell.capital})`}</title>
          </path>
        ))}

        {boundaries.map((path) => (
          <path key={path} d={path} className="location-picker__region-line" />
        ))}

        {provinces
          .filter((cell) => cell.region === region)
          .map((cell) => (
            <text
              key={`label-${cell.name}`}
              className="location-picker__label"
              x={cell.label.x}
              y={cell.label.y}
              textAnchor="middle"
            >
              {cell.name}
            </text>
          ))}

        {insideFrame && (
          <g className="location-picker__marker">
            <circle cx={point.x} cy={point.y} r="13" />
            <circle cx={point.x} cy={point.y} r="6.5" />
          </g>
        )}
      </svg>

      <p className="location-picker__hint">
        <MapPin aria-hidden="true" />
        {hoveredProvince ? (
          <>
            <strong>{hoveredProvince.name}</strong> · {hoveredProvince.region}
          </>
        ) : (
          <>
            Cliquez sur la carte pour positionner le site — <strong>{latitude.toFixed(5)}, {longitude.toFixed(5)}</strong>
          </>
        )}
      </p>
    </div>
  );
}
