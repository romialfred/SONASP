import { useState } from 'react';
import type { PortalBrand } from './usePortalBrand';

export function PortalBrandPair({ brand }: { brand: PortalBrand }) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = brand.shortName.split(/\s+/).filter(Boolean).map(word => word[0]).slice(0, 3).join('').toUpperCase();
  return <div className="national-brand-pair" aria-label={`FASO SANAMA — ${brand.name}`}>
    <img className="national-brand-pair__platform" src="/login-faso/faso-sanama.png" alt="FASO SANAMA" />
    <span className="national-brand-pair__separator" aria-hidden="true" />
    <div className="national-brand-pair__organization" title={brand.name}>
      {brand.logo && failed !== brand.logo
        ? <img src={brand.logo} alt={brand.name} onError={() => setFailed(brand.logo)} />
        : <span className="national-brand-pair__fallback"><b aria-hidden="true">{initials}</b><span>{brand.shortName}</span></span>}
    </div>
  </div>;
}
