import { PlatformLoading } from './PlatformLoading';

export function RouteFallback() {
  return (
    <PlatformLoading
      title="Chargement de la page"
      message="Mise à disposition de vos données…"
    />
  );
}
