import { useMemo, useState } from 'react';
import { MapPin, Users } from 'lucide-react';
import { BURKINA_FASO_BOUNDARY } from '@/data/artisanalSitesData';
import type { ArtisanalSite, SiteProduction } from '@/types/artisanalSite';

interface BurkinaSitesMapProps {
  sites: ArtisanalSite[];
  productions: SiteProduction[];
}

const WIDTH = 720;
const HEIGHT = 460;
const PADDING = 34;
const LONGITUDE_MIN = -5.6;
const LONGITUDE_MAX = 2.5;
const LATITUDE_MIN = 9.35;
const LATITUDE_MAX = 15.2;

const project = (longitude: number, latitude: number) => ({
  x:
    PADDING +
    ((longitude - LONGITUDE_MIN) / (LONGITUDE_MAX - LONGITUDE_MIN)) *
      (WIDTH - PADDING * 2),
  y:
    PADDING +
    ((LATITUDE_MAX - latitude) / (LATITUDE_MAX - LATITUDE_MIN)) *
      (HEIGHT - PADDING * 2),
});

const compactNumber = new Intl.NumberFormat('fr-FR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const siteStatusColor: Record<ArtisanalSite['status'], string> = {
  active: '#0f9f6e',
  planned: '#d99a00',
  suspended: '#e44b4b',
};

export function BurkinaSitesMap({ sites, productions }: BurkinaSitesMapProps) {
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const boundaryPath = useMemo(
    () =>
      BURKINA_FASO_BOUNDARY.map(([longitude, latitude], index) => {
        const point = project(longitude, latitude);
        return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }).join(' ') + ' Z',
    []
  );

  const plottedSites = useMemo(
    () =>
      sites.map((site) => ({
        ...site,
        ...project(site.longitude, site.latitude),
        productionKg:
          productions
            .filter((production) => production.siteId === site.id)
            .reduce((total, production) => total + production.goldWeightGrams, 0) / 1000,
        revenueFcfa: productions
          .filter((production) => production.siteId === site.id)
          .reduce((total, production) => total + production.revenueFcfa, 0),
        taxesFcfa: productions
          .filter((production) => production.siteId === site.id)
          .reduce((total, production) => total + production.taxesFcfa, 0),
      })),
    [productions, sites]
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="sites-map-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 id="sites-map-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <MapPin className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Carte des sites artisanaux
          </h2>
          <p className="mt-1 text-xs text-slate-500">Survolez ou sélectionnez un site pour afficher ses indicateurs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600" aria-label="Légende des statuts">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Actif</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Planifié</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-500" /> Suspendu</span>
        </div>
      </div>

      <div className="bg-[radial-gradient(circle_at_50%_45%,#f0fdf4_0,#f8fafc_68%)] p-3 sm:p-5">
        <svg
          className="h-auto w-full"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Carte du Burkina Faso présentant les sites artisanaux"
        >
          <defs>
            <filter id="map-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#123b35" floodOpacity="0.13" />
            </filter>
            <linearGradient id="country-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ecfdf5" />
              <stop offset="1" stopColor="#dff5ea" />
            </linearGradient>
          </defs>
          <path d={boundaryPath} fill="url(#country-fill)" stroke="#78bfa5" strokeWidth="2.5" filter="url(#map-shadow)" />
          <text x="360" y="230" textAnchor="middle" fill="#1f6b56" opacity="0.14" fontSize="27" fontWeight="700">
            BURKINA FASO
          </text>

          {plottedSites.map((site) => {
            const active = activeSiteId === site.id;
            const radius = Math.max(8, Math.min(16, 8 + site.activeMiners / 30));
            const tooltipX = Math.max(8, Math.min(WIDTH - 235, site.x + 18));
            const tooltipY = Math.max(8, Math.min(HEIGHT - 132, site.y - 62));
            return (
              <g key={site.id}>
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`${site.name}, ${site.activeMiners} artisans actifs`}
                  onMouseEnter={() => setActiveSiteId(site.id)}
                  onMouseLeave={() => setActiveSiteId(null)}
                  onFocus={() => setActiveSiteId(site.id)}
                  onBlur={() => setActiveSiteId(null)}
                  onClick={() => setActiveSiteId(active ? null : site.id)}
                  className="cursor-pointer outline-none"
                >
                  <circle cx={site.x} cy={site.y} r={radius + 6} fill={siteStatusColor[site.status]} opacity={active ? 0.2 : 0.1} />
                  <circle cx={site.x} cy={site.y} r={radius} fill={siteStatusColor[site.status]} stroke="#fff" strokeWidth="4" />
                  <text x={site.x} y={site.y + 4} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">
                    {site.activeMiners}
                  </text>
                  <title>{`${site.name} — ${site.activeMiners} artisans actifs`}</title>
                </g>

                {active && (
                  <g transform={`translate(${tooltipX} ${tooltipY})`} pointerEvents="none">
                    <rect width="226" height="124" rx="12" fill="#10243e" opacity="0.97" />
                    <text x="14" y="23" fill="#fff" fontSize="12" fontWeight="700">{site.name}</text>
                    <text x="14" y="42" fill="#b8c8da" fontSize="10">{site.locality} · {site.province}</text>
                    <text x="14" y="67" fill="#dffbf0" fontSize="11" fontWeight="600">{site.activeMiners} artisans actifs</text>
                    <text x="14" y="87" fill="#fff" fontSize="10">Production : {site.productionKg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg</text>
                    <text x="14" y="104" fill="#fff" fontSize="10">CA : {compactNumber.format(site.revenueFcfa)} FCFA</text>
                    <text x="14" y="119" fill="#f8d873" fontSize="10">Taxes : {compactNumber.format(site.taxesFcfa)} FCFA</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50 sm:grid-cols-4">
        {plottedSites
          .filter((site) => site.status === 'active')
          .slice(0, 4)
          .map((site) => (
            <button
              type="button"
              key={site.id}
              onMouseEnter={() => setActiveSiteId(site.id)}
              onMouseLeave={() => setActiveSiteId(null)}
              onFocus={() => setActiveSiteId(site.id)}
              onBlur={() => setActiveSiteId(null)}
              className="flex min-w-0 items-center gap-2 border-r border-slate-100 px-3 py-3 text-left hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
            >
              <Users className="h-4 w-4 flex-none text-emerald-600" aria-hidden="true" />
              <span className="min-w-0">
                <strong className="block truncate text-[11px] text-slate-800">{site.locality}</strong>
                <small className="text-[10px] text-slate-500">{site.activeMiners} artisans</small>
              </span>
            </button>
          ))}
      </div>
    </section>
  );
}
