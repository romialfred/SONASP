import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { artisanalSiteService, SITE_DATA_CHANGED } from '@/services/artisanalSiteService';
import type { ArtisanalSite, SiteProduction } from '@/types/artisanalSite';

/** Recharge au retour de navigation, au retour dans l'onglet et après une mutation. */
export function useArtisanalSiteData(errorMessage = 'Les données des sites sont momentanément indisponibles.') {
  const location = useLocation();
  const [revision, setRevision] = useState(0);
  const [sites, setSites] = useState<ArtisanalSite[]>([]);
  const [productions, setProductions] = useState<SiteProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    window.addEventListener(SITE_DATA_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(SITE_DATA_CHANGED, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    artisanalSiteService.loadSiteData().then(data => {
      if (current) { setSites(data.sites); setProductions(data.productions); }
    }).catch(() => {
      if (current) setError(errorMessage);
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [location.key, revision, errorMessage]);

  return { sites, productions, loading, error, refresh };
}
