import { useState } from 'react';
import { NATIONAL_ARMS_LOGO, type PortalBrand } from './usePortalBrand';

export function PortalBrandPair({ brand }: { brand: PortalBrand }) {
  const [failed, setFailed] = useState<string | null>(null);
  const logo = brand.logo && failed !== brand.logo ? brand.logo : NATIONAL_ARMS_LOGO;
  const logoLabel = logo === NATIONAL_ARMS_LOGO ? 'Armoiries du Burkina Faso' : brand.name;
  return <div className="national-brand-pair" aria-label={`FASO SANAMA — ${brand.name}`}>
    <img className="national-brand-pair__platform" src="/login-faso/faso-sanama.png" alt="FASO SANAMA" />
    <span className="national-brand-pair__separator" aria-hidden="true" />
    <div className="national-brand-pair__organization" title={brand.name}>
      <img src={logo} alt={logoLabel} onError={() => setFailed(brand.logo)} />
    </div>
  </div>;
}
