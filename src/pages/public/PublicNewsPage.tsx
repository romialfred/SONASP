import { ArrowRight, Newspaper } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageMetadata } from '../../components/seo/PageMetadata';
import { SectionHeading } from './PublicComponents';
import { usePublicLocale } from './PublicLocaleContext';
import { loadPublicNews, type PublicNewsItem } from './publicNews';

export default function PublicNewsPage() {
  const { content, locale } = usePublicLocale();
  const [items, setItems] = useState<PublicNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    loadPublicNews(controller.signal).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <div className="public-page">
      <PageMetadata title="Actualités et publications | SONASP" description="Communiqués, procédures, guides et informations opérationnelles publiés sur la plateforme nationale SONASP." openGraph={{ type: 'website', locale: 'fr_BF', siteName: 'SONASP' }} />
      <header className="public-page-hero">
        <div className="public-shell">
          <SectionHeading eyebrow={content.news.eyebrow} title={content.news.title} description={content.news.description} as="h1" />
        </div>
      </header>
      <section className="public-section public-page-content" aria-labelledby="publications-heading">
        <div className="public-shell">
          <h2 id="publications-heading" className="sr-only">Publications</h2>
          {loading ? (
            <p className="public-empty-state" role="status">{content.news.loading}</p>
          ) : items.length === 0 ? (
            <div className="public-page-empty"><Newspaper aria-hidden="true" /><p>{content.news.empty}</p></div>
          ) : (
            <div className="public-publications-list">
              {items.map((item) => (
                <article key={item.id}>
                  <div><span>{item.category}</span><time dateTime={item.published_at}>{new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(item.published_at))}</time></div>
                  <h3><Link to={`/actualites/${item.slug}`}>{item.title}</Link></h3>
                  <p>{item.summary}</p>
                  <Link to={`/actualites/${item.slug}`}>{locale === 'fr' ? 'Lire la publication' : 'Read publication'}<ArrowRight aria-hidden="true" /></Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
