import { ArrowLeft, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageMetadata } from '../../components/seo/PageMetadata';

export default function PublicNotFoundPage() {
  return (
    <div className="public-not-found">
      <PageMetadata title="Page introuvable | Faso SANAMA" description="La page demandée n’est pas disponible." robots="noindex, nofollow" />
      <div className="public-shell">
        <SearchX aria-hidden="true" />
        <span>Erreur 404</span>
        <h1>Cette page n’existe pas</h1>
        <p>Le contenu demandé a peut-être été déplacé ou n’est pas accessible depuis la vitrine publique.</p>
        <Link className="public-button public-button--primary" to="/"><ArrowLeft aria-hidden="true" />Revenir à l’accueil</Link>
      </div>
    </div>
  );
}
