import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import PublicHomePage from './PublicHomePage';
import { PublicLocaleProvider } from './PublicLocaleContext';

function renderHome() {
  return render(<MemoryRouter><PublicLocaleProvider><PublicHomePage /></PublicLocaleProvider></MemoryRouter>);
}

describe('vitrine présidentielle Faso SANAMA', () => {
  beforeEach(() => { window.localStorage.clear(); document.documentElement.lang = 'fr'; });

  it('présente le rattachement présidentiel et un accès commun aux espaces habilités', () => {
    renderHome();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Une filière connectée.');
    expect(screen.getByText('Une plateforme de la Présidence du Faso')).toBeInTheDocument();
    expect(document.title).toContain('Faso SANAMA | Présidence du Faso');
    for (const link of screen.getAllByRole('link', { name: /Accéder à mon espace|Rejoindre mon espace sécurisé/ })) {
      expect(link).toHaveAttribute('href', '/login');
    }
    expect(screen.queryByText('Portail SONASP')).not.toBeInTheDocument();
    expect(screen.queryByText(/pivot national vers les marchés internationaux/i)).not.toBeInTheDocument();
  });

  it('expose les huit acteurs et leur dossier sans afficher de données métier', () => {
    renderHome();
    const labels = ['Présidence du Faso', 'Sociétés minières', 'Artisans et sites', 'Comptoirs d’or', 'Collecteurs', 'DGMG', 'Finances et DGI', 'SONASP'];
    expect(screen.getAllByRole('tab')).toHaveLength(labels.length);
    for (const label of labels) {
      const tab = screen.getByRole('tab', { name: new RegExp('^' + label) });
      fireEvent.click(tab);
      expect(tab).toHaveAttribute('aria-selected', 'true');
      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
      expect(document.getElementById(tab.getAttribute('aria-controls')!)).toBe(panel);
      expect(within(panel).getAllByRole('heading', { level: 4 })).toHaveLength(3);
      expect(within(panel).getByRole('link')).toHaveAttribute('href', '/login');
    }
  });

  it('distingue les contrats des mines du circuit des comptoirs et les délégations du collecteur', () => {
    renderHome();
    fireEvent.click(screen.getByRole('tab', { name: /^Sociétés minières/ }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('conditions contractuelles acceptées par la société minière');
    fireEvent.click(screen.getByRole('tab', { name: /^Comptoirs/ }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('cession de leur or à la SONASP');
    fireEvent.click(screen.getByRole('tab', { name: /^Collecteurs/ }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Règlement selon délégation');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('transmission à l’organisme responsable');
  });

  it('permet de changer de portail au clavier avec un seul onglet dans la tabulation', () => {
    renderHome();
    const first = screen.getByRole('tab', { name: /^Présidence/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    const mine = screen.getByRole('tab', { name: /^Sociétés minières/ });
    expect(mine).toHaveFocus();
    expect(mine).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(mine, { key: 'End' });
    const last = screen.getByRole('tab', { name: /^SONASP/ });
    expect(last).toHaveFocus();
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toEqual([last]);
    fireEvent.keyDown(last, { key: 'Home' });
    expect(first).toHaveFocus();
  });

  it('explique les huit étapes et conserve les justificatifs de la sélection', () => {
    renderHome();
    for (const label of ['Production', 'Collecte', 'Contrôle', 'Achat et vente', 'Stocks et lots', 'Expédition', 'Raffinage', 'Fiscalité']) {
      const button = screen.getByRole('button', { name: new RegExp(label) });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(document.getElementById('trace-detail')).toHaveAttribute('aria-live', 'polite');
    }
    expect(screen.getByText('Assiette documentée')).toBeInTheDocument();
    expect(screen.getByText('Recouvrement')).toBeInTheDocument();
  });

  it('relie chaque ancre de découverte à une section existante', () => {
    const { container } = renderHome();
    for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      expect(document.getElementById(link.hash.slice(1))).not.toBeNull();
    }
  });
});
