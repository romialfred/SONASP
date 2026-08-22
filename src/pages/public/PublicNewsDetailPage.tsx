import { ArrowLeft, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageMetadata } from '../../components/seo/PageMetadata';
import { DocumentLink } from './PublicComponents';
import { usePublicLocale } from './PublicLocaleContext';
import { loadPublicNewsBySlug, type PublicNewsItem } from './publicNews';

export default function PublicNewsDetailPage() {
  const { slug = '' } = useParams();
  const { locale } = usePublicLocale();
  const [item, setItem] = useState<PublicNewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    loadPublicNewsBySlug(slug, controller.signal).then(setItem).catch(() => setItem(null)).finally(() => setLoading(false));
    return () => controller.abort();
  }, [slug]);

  if (loading) return <div className="public-shell public-page-loading" role="status">Chargement de la publication…</div>;
  if (!item) {
    return (
      <div className="public-shell public-page-empty public-page-empty--standalone">
        <FileText aria-hidden="true" />
        <h1>{locale === 'fr' ? 'Publication introuvable' : 'Publication not found'}</h1>
        <Link to="/actualites"><ArrowLeft aria-hidden="true" />{locale === 'fr' ? 'Retour aux actualités' : 'Back to news'}</Link>
      </div>
    );
  }

  return (
    <article className="public-article">
      <PageMetadata title={`${item.title} | SONASP`} description={item.summary} openGraph={{ type: 'article', locale: 'fr_BF', siteName: 'SONASP', image: item.image_url ?? undefined }} />
      <header className="public-article__header">
        <div className="public-shell public-article__narrow">
          <Link to="/actualites"><ArrowLeft aria-hidden="true" />{locale === 'fr' ? 'Toutes les publications' : 'All publications'}</Link>
          <span>{item.category}</span>
          <h1>{item.title}</h1>
          <time dateTime={item.published_at}>{new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(item.published_at))}</time>
        </div>
      </header>
      <div className="public-shell public-article__narrow public-article__body">
        <p className="public-article__summary">{item.summary}</p>
        {item.content && <div className="public-article__content">{item.content}</div>}
        {item.document_url && <DocumentLink href={item.document_url}>{locale === 'fr' ? 'Télécharger le document joint' : 'Download attached document'}</DocumentLink>}
      </div>
    </article>
  );
}
