import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageMetadata } from './PageMetadata';

const getMeta = (attribute: 'name' | 'property', key: string) =>
  document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

describe('PageMetadata', () => {
  beforeEach(() => {
    document.title = 'Titre statique SONASP';
    document.documentElement.lang = 'fr';
    document.head
      .querySelectorAll('[data-sonasp-seo], link[rel="canonical"]')
      .forEach((element) => element.remove());

    let description = getMeta('name', 'description');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = 'Description statique SONASP';
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
  });

  it('applique les métadonnées vérifiées de la route', () => {
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'SONASP',
    };

    render(
      <PageMetadata
        title="Actualités | SONASP"
        description="Les publications institutionnelles de la SONASP."
        canonical="https://sonasp.example/actualites"
        language="fr-BF"
        robots="index, follow"
        openGraph={{
          type: 'website',
          locale: 'fr_BF',
          siteName: 'SONASP',
          image: 'https://sonasp.example/partage.png',
          imageAlt: 'Logo de la SONASP',
        }}
        twitter={{ card: 'summary_large_image' }}
        structuredData={structuredData}
      />,
    );

    expect(document.title).toBe('Actualités | SONASP');
    expect(document.documentElement.lang).toBe('fr-BF');
    expect(getMeta('name', 'description')?.content).toBe(
      'Les publications institutionnelles de la SONASP.',
    );
    expect(getMeta('name', 'robots')?.content).toBe('index, follow');
    expect(getMeta('property', 'og:title')?.content).toBe('Actualités | SONASP');
    expect(getMeta('property', 'og:locale')?.content).toBe('fr_BF');
    expect(getMeta('name', 'twitter:card')?.content).toBe('summary_large_image');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://sonasp.example/actualites',
    );
    expect(
      JSON.parse(
        document.head.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}',
      ),
    ).toEqual(structuredData);
  });

  it('nettoie les balises optionnelles et restaure les valeurs statiques à la navigation', () => {
    const { rerender, unmount } = render(
      <PageMetadata
        title="Publication A | SONASP"
        description="Description A"
        canonical="https://sonasp.example/publication-a"
        openGraph={{ type: 'article', image: 'https://sonasp.example/a.png' }}
        twitter={{ card: 'summary_large_image' }}
      />,
    );

    rerender(
      <PageMetadata
        title="Assistance | SONASP"
        description="Description assistance"
        robots="noindex, follow"
      />,
    );

    expect(document.title).toBe('Assistance | SONASP');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(getMeta('property', 'og:image')).toBeNull();
    expect(getMeta('name', 'twitter:card')).toBeNull();
    expect(getMeta('name', 'robots')?.content).toBe('noindex, follow');

    unmount();

    expect(document.title).toBe('Titre statique SONASP');
    expect(document.documentElement.lang).toBe('fr');
    expect(getMeta('name', 'description')?.content).toBe('Description statique SONASP');
    expect(getMeta('name', 'robots')).toBeNull();
    expect(getMeta('property', 'og:title')).toBeNull();
  });

  it("déduit la canonique de la route uniquement lorsqu'une origine officielle est configurée", () => {
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = 'https://sonasp.example/';
    document.head.appendChild(canonical);
    window.history.replaceState({}, '', '/actualites');

    const { unmount } = render(
      <PageMetadata
        title="Actualités | SONASP"
        description="Les publications institutionnelles de la SONASP."
      />,
    );

    expect(canonical.href).toBe('https://sonasp.example/actualites');
    expect(getMeta('property', 'og:url')?.content).toBe('https://sonasp.example/actualites');

    unmount();

    expect(canonical.href).toBe('https://sonasp.example/');
    expect(getMeta('property', 'og:url')).toBeNull();
  });
});
