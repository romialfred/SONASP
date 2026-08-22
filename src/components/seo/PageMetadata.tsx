import { useEffect, type ReactNode } from 'react';

export interface OpenGraphMetadata {
  title?: string;
  description?: string;
  type?: 'website' | 'article';
  url?: string;
  image?: string;
  imageAlt?: string;
  locale?: string;
  siteName?: string;
}

export interface TwitterMetadata {
  card?: 'summary' | 'summary_large_image';
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
}

export interface PageMetadataOptions {
  title: string;
  description?: string;
  canonical?: string;
  language?: string;
  robots?: string;
  openGraph?: OpenGraphMetadata;
  twitter?: TwitterMetadata;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

interface RestorableNode {
  restore: () => void;
}

const setMeta = (
  attribute: 'name' | 'property',
  key: string,
  content: string | undefined,
): RestorableNode | null => {
  if (!content) return null;

  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  const element = existing ?? document.createElement('meta');
  const previousContent = existing?.getAttribute('content');

  if (!existing) {
    element.setAttribute(attribute, key);
    element.dataset.sonaspSeo = 'page';
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);

  return {
    restore: () => {
      if (!existing) {
        element.remove();
      } else if (previousContent === null || previousContent === undefined) {
        element.removeAttribute('content');
      } else {
        element.setAttribute('content', previousContent);
      }
    },
  };
};

const setCanonical = (canonical: string | undefined): RestorableNode | null => {
  if (!canonical) return null;

  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const element = existing ?? document.createElement('link');
  const previousHref = existing?.getAttribute('href');

  if (!existing) {
    element.rel = 'canonical';
    element.dataset.sonaspSeo = 'page';
    document.head.appendChild(element);
  }

  element.href = canonical;

  return {
    restore: () => {
      if (!existing) {
        element.remove();
      } else if (previousHref === null || previousHref === undefined) {
        element.removeAttribute('href');
      } else {
        element.setAttribute('href', previousHref);
      }
    },
  };
};

const resolveCanonical = (canonical: string | undefined): string | undefined => {
  if (canonical) return canonical;

  const configuredCanonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!configuredCanonical?.href) return undefined;

  try {
    const configuredOrigin = new URL(configuredCanonical.href).origin;
    return new URL(window.location.pathname, `${configuredOrigin}/`).href;
  } catch {
    return undefined;
  }
};

const setStructuredData = (
  structuredData: PageMetadataOptions['structuredData'],
): RestorableNode | null => {
  if (!structuredData) return null;

  const existing = document.head.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"][data-sonasp-seo="structured-data"]',
  );
  const element = existing ?? document.createElement('script');
  const previousText = existing?.textContent ?? null;

  if (!existing) {
    element.type = 'application/ld+json';
    element.dataset.sonaspSeo = 'structured-data';
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(structuredData);

  return {
    restore: () => {
      if (!existing) {
        element.remove();
      } else {
        element.textContent = previousText;
      }
    },
  };
};

/**
 * Synchronise les métadonnées d'une route avec le document, puis restaure les
 * valeurs précédentes au démontage. Ainsi une actualité, une page d'assistance
 * ou une route `noindex` ne laisse pas ses balises sur la route suivante.
 *
 * L'URL canonique et les données structurées sont volontairement optionnelles :
 * elles ne doivent être renseignées qu'avec des informations institutionnelles
 * vérifiées.
 */
export function usePageMetadata({
  title,
  description,
  canonical,
  language,
  robots,
  openGraph,
  twitter,
  structuredData,
}: PageMetadataOptions): void {
  useEffect(() => {
    const previousTitle = document.title;
    const previousLanguage = document.documentElement.lang;
    const restorableNodes: RestorableNode[] = [];
    const resolvedCanonical = resolveCanonical(canonical);

    document.title = title;
    if (language) document.documentElement.lang = language;

    const nodes = [
      setMeta('name', 'description', description),
      setMeta('name', 'robots', robots),
      setMeta('property', 'og:title', openGraph?.title ?? title),
      setMeta('property', 'og:description', openGraph?.description ?? description),
      setMeta('property', 'og:type', openGraph?.type),
      setMeta('property', 'og:url', openGraph?.url ?? resolvedCanonical),
      setMeta('property', 'og:image', openGraph?.image),
      setMeta('property', 'og:image:alt', openGraph?.imageAlt),
      setMeta('property', 'og:locale', openGraph?.locale),
      setMeta('property', 'og:site_name', openGraph?.siteName),
      setMeta('name', 'twitter:card', twitter?.card),
      setMeta('name', 'twitter:title', twitter?.title ?? openGraph?.title ?? title),
      setMeta(
        'name',
        'twitter:description',
        twitter?.description ?? openGraph?.description ?? description,
      ),
      setMeta('name', 'twitter:image', twitter?.image),
      setMeta('name', 'twitter:image:alt', twitter?.imageAlt),
      setCanonical(resolvedCanonical),
      setStructuredData(structuredData),
    ];

    nodes.forEach((node) => {
      if (node) restorableNodes.push(node);
    });

    return () => {
      document.title = previousTitle;
      if (language) document.documentElement.lang = previousLanguage;
      restorableNodes.reverse().forEach((node) => node.restore());
    };
  }, [
    canonical,
    description,
    language,
    openGraph?.description,
    openGraph?.image,
    openGraph?.imageAlt,
    openGraph?.locale,
    openGraph?.siteName,
    openGraph?.title,
    openGraph?.type,
    openGraph?.url,
    robots,
    structuredData,
    title,
    twitter?.card,
    twitter?.description,
    twitter?.image,
    twitter?.imageAlt,
    twitter?.title,
  ]);
}

export function PageMetadata({
  children = null,
  ...metadata
}: PageMetadataOptions & { children?: ReactNode }): ReactNode {
  usePageMetadata(metadata);
  return children;
}
