import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicLayout from './PublicLayout';

vi.mock('@/hooks/useCoursOr', () => ({
  useCoursOr: () => ({
    cours: { changePercent24h: 0.42 },
    prixGrammeFcfa: 52_430,
    derniereMaj: new Date('2026-08-23T08:15:00Z'),
    chargement: false,
  }),
}));

describe('header de la vitrine publique', () => {
  beforeEach(() => window.localStorage.setItem('sonasp-public-locale', 'fr'));
  it('conserve quatre menus sur le header et un seul accès principal au Portail SONASP', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<div>Accueil de test</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const header = screen.getByRole('banner');
    const navigation = within(header).getByRole('navigation', { name: 'Navigation principale' });

    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'La plateforme',
      'Espace Mines',
      'Processus',
      'Sécurité',
    ]);
    expect(within(header).queryByRole('link', { name: 'Actualités' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Connexion' })).not.toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Portail SONASP' }))
      .toHaveAttribute('href', '/login');
    const portalButton = within(header).getByRole('link', { name: 'Portail SONASP' });
    expect(portalButton).toHaveClass('public-portal-button');
    expect(portalButton.querySelector('.public-portal-button__label')).toHaveTextContent('Portail SONASP');
    expect(portalButton.querySelector('.public-portal-button__icon')).toHaveAttribute('aria-hidden', 'true');
    expect(portalButton.querySelector('.public-portal-button__arrow')).toHaveAttribute('aria-hidden', 'true');
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Portail Mine' }))
      .toHaveAttribute('href', '/portail-mine');
    expect(within(navigation).getByRole('link', { name: 'La plateforme' }))
      .toHaveAttribute('aria-current', 'location');
    expect(screen.getByLabelText('Cours indicatif de l’or 24 carats')).toHaveTextContent('52 430 FCFA / g');
    expect(screen.getByLabelText('Cours indicatif de l’or 24 carats')).toHaveTextContent('+0,42 %');

    // jsdom ne calcule pas les media queries : inspecter aussi le menu mobile.
    const menuButton = within(header).getByLabelText('Ouvrir le menu');
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const mobileNavigation = document.getElementById('navigation-mobile');
    expect(mobileNavigation).toBeInTheDocument();
    const mobilePortal = within(mobileNavigation!).getByText('Portail SONASP').closest('a');
    expect(mobilePortal).toHaveAttribute('href', '/login');
    expect(mobilePortal).toHaveClass('public-portal-button');
    expect(mobilePortal?.querySelector('.public-portal-button__icon')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveFocus();

    fireEvent.change(screen.getByLabelText('Choisir la langue'), { target: { value: 'en' } });
    expect(within(header).getByRole('link', { name: 'SONASP Portal' })).toHaveAttribute('href', '/login');
  });
});
