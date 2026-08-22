import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasGlobalPlatformAccess } from '@/lib/permissions';
import {
  MinePortalDataError,
  minePortalService,
  type MinePortalCompany,
} from '@/services/minePortalService';

/**
 * Sélecteur transversal réservé à l'Owner.
 *
 * La mine choisie est portée par l'URL et non par un stockage navigateur : le
 * lien reste explicite, partageable et vérifiable. La base demeure l'autorité
 * d'accès ; ce contrôle ne fait que choisir le périmètre à consulter.
 */
export function OwnerMineSwitcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [companies, setCompanies] = useState<MinePortalCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOwner = hasGlobalPlatformAccess(user);

  const selectedCompanyId = useMemo(() => {
    if (!location.pathname.startsWith('/portail-mine')) return '';
    return new URLSearchParams(location.search).get('mine') || '';
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isOwner) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    void minePortalService.listCompanies()
      .then((availableCompanies) => {
        if (active) setCompanies(availableCompanies);
      })
      .catch((loadError) => {
        if (!active) return;
        setCompanies([]);
        setError(loadError instanceof MinePortalDataError
          ? loadError.message
          : 'Sociétés minières indisponibles');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOwner]);

  if (!isOwner) return null;

  return (
    <label className="national-header__mine-switcher" title={error || 'Consulter le portail d’une mine'}>
      <Building2 aria-hidden="true" />
      <span className="sr-only">Choisir une société minière</span>
      <select
        aria-label="Choisir une société minière"
        value={selectedCompanyId}
        disabled={loading || companies.length === 0}
        onChange={(event) => {
          const companyId = event.target.value;
          if (companyId) navigate(`/portail-mine?mine=${encodeURIComponent(companyId)}`);
        }}
      >
        <option value="">{loading ? 'Chargement des mines…' : 'Consulter une mine'}</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}{company.code ? ` · ${company.code}` : ''}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" />
    </label>
  );
}
