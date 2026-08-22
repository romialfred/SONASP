import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicHomePage from './PublicHomePage';
import { PublicLocaleProvider, usePublicLocale } from './PublicLocaleContext';

vi.mock('./publicNews', () => ({
  loadPublicNews: vi.fn().mockResolvedValue([]),
}));

function renderHome() {
  return render(
    <MemoryRouter>
      <PublicLocaleProvider>
        <PublicHomePage />
      </PublicLocaleProvider>
    </MemoryRouter>,
  );
}

function LocaleProbe() {
  const { locale, setLocale, content } = usePublicLocale();
  return (
    <div>
      <span>{locale}</span>
      <span>{content.hero.title}</span>
      <button type="button" onClick={() => setLocale('en')}>English</button>
    </div>
  );
}

describe('vitrine publique SONASP', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'fr';
  });

  it('présente les parcours métier essentiels et relie le CTA au portail sécurisé', async () => {
    renderHome();

    expect(screen.getByRole('heading', {
      level: 1,
      name: 'L’or du Burkina, collecté et valorisé dans un cadre souverain.',
    })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Une plateforme unique pour toute la chaîne de valeur' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Un espace sécurisé, pensé pour chaque mine' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Production & Expédition' })).toBeInTheDocument();
    expect(screen.getByText('Gestion des prévisions de production')).toBeInTheDocument();
    expect(screen.getByText('Analyse Labo')).toBeInTheDocument();
    expect(screen.getByText('Enlèvement & Expédition', { selector: '.public-feature-family__item > span:last-child' })).toBeInTheDocument();
    expect(screen.queryByText('Production et livraisons')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Une chaîne numérique continue, de la mine au paiement' })).toBeInTheDocument();
    expect(screen.getByText('Début du processus')).toBeInTheDocument();
    expect(screen.getByText('Fin du processus')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Préparer le flux' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contrôler la matière' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Finaliser l’opération' })).toBeInTheDocument();
    expect(screen.getByText('Une opération, toutes ses pièces reliées')).toBeInTheDocument();
    expect(screen.getByText('À propos de ces garanties')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'La SONASP, pivot national vers les marchés internationaux' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Production nationale' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Porte de sortie Marchés internationaux/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /accéder au portail mine/i })[0]).toHaveAttribute('href', '/portail-mine');

    await waitFor(() => {
      expect(screen.getByText('Aucune publication n’est disponible pour le moment.')).toBeInTheDocument();
    });
  });

  it('permet de sélectionner une étape du flux et expose son état actif', () => {
    renderHome();

    const analysisStep = screen.getByRole('button', { name: /Analyse Contrôle de la teneur/i });
    fireEvent.click(analysisStep);

    expect(analysisStep).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Étape suivante')).toBeInTheDocument();
  });

  it('explique le rôle de chaque acteur autour du pivot SONASP', () => {
    renderHome();

    const financeActor = screen.getByRole('button', { name: /Finance Flux financiers/i });
    fireEvent.click(financeActor);

    expect(financeActor).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Règlements, preuves et rapprochement financier.')).toBeInTheDocument();
    expect(screen.getByText('Flux financiers', { selector: '.public-ecosystem__active-link-route' })).toBeInTheDocument();
  });

  it('mémorise le choix de langue et synchronise la langue du document', async () => {
    render(
      <PublicLocaleProvider>
        <LocaleProbe />
      </PublicLocaleProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'English' }));

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
      expect(window.localStorage.getItem('sonasp-public-locale')).toBe('en');
    });
    expect(screen.getByText('Burkina Faso’s gold, collected and valued within a sovereign framework.')).toBeInTheDocument();
  });
});
