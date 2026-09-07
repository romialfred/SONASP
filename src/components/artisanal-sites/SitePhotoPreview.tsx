import { useEffect, useState } from 'react';
import { ImageOff, Loader2, RefreshCw } from 'lucide-react';
import { resolvePhotoUrl } from '@/services/sitePhotoService';

type Props = { reference: string; label: string; contextKey: string; height?: number };

/** Le changement de référence/périmètre efface immédiatement l'ancienne URL signée. */
export function SitePhotoPreview(props: Props) {
  return <PhotoContent key={JSON.stringify([props.contextKey, props.reference])} {...props} />;
}

function PhotoContent({ reference, label, height = 132 }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    void resolvePhotoUrl(reference).then(value => {
      if (!current) return;
      if (value) setUrl(value); else setError(true);
    }, () => { if (current) setError(true); });
    return () => { current = false; };
  }, [reference, attempt]);

  return <div style={{ width: '100%', minHeight: height, display: 'grid', placeItems: 'center', borderRadius: 10, overflow: 'hidden', background: 'var(--sn-bg, #f6f8fa)' }}>
    {error ? <div style={{ padding: 12, textAlign: 'center', fontSize: 12 }}>
      <p role="alert" style={{ margin: '0 0 8px' }}><ImageOff size={18} aria-hidden="true" /> {label} : aperçu indisponible.</p>
      <button type="button" className="site-detail-button" aria-label={`Réessayer ${label.toLocaleLowerCase('fr')}`} style={{ position: 'static', display: 'inline-flex', gap: 6, width: 'auto', height: 'auto', padding: '6px 10px', background: 'white', color: 'var(--sn-navy, #10243e)' }} onClick={() => {
        setUrl(null); setError(false); setAttempt(value => value + 1);
      }}><RefreshCw size={14} aria-hidden="true" /> Réessayer</button>
    </div> : url ? <img src={url} alt={label} onError={() => { setUrl(null); setError(true); }} style={{ width: '100%', height, objectFit: 'cover' }} />
      : <p role="status" style={{ fontSize: 12, padding: 12 }}><Loader2 size={18} aria-hidden="true" /> Chargement de {label.toLocaleLowerCase('fr')}…</p>}
  </div>;
}
