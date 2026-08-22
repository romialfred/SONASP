import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import PublicLayout from './PublicLayout';

describe('header de la vitrine publique', () => {
  it('conserve quatre menus sur le header et un seul accès principal au Portail Mine', () => {
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
    expect(within(header).getByRole('link', { name: 'Accéder au Portail Mine' }))
      .toHaveAttribute('href', '/portail-mine');
    expect(within(navigation).getByRole('link', { name: 'La plateforme' }))
      .toHaveAttribute('aria-current', 'location');
  });
});
