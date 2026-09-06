import '@/public-loading.css';

interface PlatformLoadingProps {
  title?: string;
  message?: string;
}

export function PlatformLoading({
  title = 'Initialisation de la plateforme',
  message = 'Connexion aux services sécurisés Faso SANAMA…',
}: PlatformLoadingProps) {
  return (
    <div className="sonasp-loading" role="status" aria-live="polite" aria-label={`${title}. ${message}`}>
      <div className="sonasp-loading__flag" aria-hidden="true"><span /><span /><span /></div>
      <div className="sonasp-loading__panel">
        <img className="sonasp-loading__logo" src="/login-faso/faso-sanama.png" alt="Faso SANAMA" width="1536" height="1024" />
        <div className="sonasp-hourglass" aria-hidden="true">
          <span className="sonasp-hourglass__bar sonasp-hourglass__bar--top" />
          <span className="sonasp-hourglass__glass">
            <i className="sonasp-hourglass__sand sonasp-hourglass__sand--top" />
            <i className="sonasp-hourglass__stream" />
            <i className="sonasp-hourglass__sand sonasp-hourglass__sand--bottom" />
          </span>
          <span className="sonasp-hourglass__bar sonasp-hourglass__bar--bottom" />
        </div>
        <div className="sonasp-loading__copy">
          <strong>{title}</strong>
          <span>{message}</span>
        </div>
        <div className="sonasp-loading__progress" aria-hidden="true"><span /></div>
        <small>Plateforme nationale de traçabilité du secteur minier</small>
      </div>
    </div>
  );
}
