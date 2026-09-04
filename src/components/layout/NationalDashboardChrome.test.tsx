import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NationalDashboardChrome,
  NationalDashboardLayout,
  reinitialiserEtatBarre,
} from './NationalDashboardLayout';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'fr', changeLanguage: vi.fn() } }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'owner-id',
      email: 'owner@sonasp.bf',
      full_name: 'Romuald TIEGNAN',
      role: 'owner',
      mining_company_id: null,
      is_active: true,
      capabilities: [],
    },
    signOut: vi.fn(),
  }),
}));

vi.mock('@/components/ui/ProfileErrorBanner', () => ({ ProfileErrorBanner: () => null }));

vi.mock('@/services/modulesService', () => ({
  MODULE_CATALOG_UPDATED_EVENT: 'sonasp:module-catalog-updated',
  modulesService: { getNavigationAvailability: vi.fn().mockResolvedValue(null) },
}));

vi.mock('@/services/notificationsService', () => ({
  notificationsService: {
    lister: vi.fn().mockResolvedValue([]),
    resume: vi.fn().mockResolvedValue({
      non_lues: 0,
      urgentes: 0,
      hautes: 0,
      plus_ancienne: null,
    }),
    marquerLues: vi.fn().mockResolvedValue(0),
  },
}));

/** Page telle qu'elle est écrite aujourd'hui : elle rend son propre habillage. */
const PageAvecHabillage = ({ titre }: { titre: string }) => (
  <NationalDashboardLayout>
    <h2>{titre}</h2>
  </NationalDashboardLayout>
);

const rendre = (chemin: string, enfants: ReactNode) =>
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route element={<NationalDashboardChrome />}>{enfants}</Route>
      </Routes>
    </MemoryRouter>
  );

describe('NationalDashboardChrome', () => {
  beforeEach(() => reinitialiserEtatBarre());

  it('monte l’habillage une seule fois, même si la page en demande un', () => {
    const { container } = rendre(
      '/dashboard',
      <Route path="/dashboard" element={<PageAvecHabillage titre="Tableau de bord" />} />
    );

    // La page appelle `NationalDashboardLayout` ; à l'intérieur de l'habillage,
    // il devient un passe-plat. Sans cela, l'écran porterait deux barres latérales.
    expect(container.querySelectorAll('.national-shell')).toHaveLength(1);
    expect(screen.getAllByRole('complementary', { name: 'Navigation principale' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Tableau de bord' })).toBeInTheDocument();
  });

  it('rend l’Outlet quand la page n’appelle pas la mise en page', () => {
    rendre('/vue', <Route path="/vue" element={<h2>Contenu direct</h2>} />);

    expect(screen.getByRole('heading', { name: 'Contenu direct' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Navigation principale' })).toBeInTheDocument();
  });

  it('conserve l’habillage d’une page à l’autre', () => {
    const { unmount } = rendre(
      '/dashboard',
      <Route path="/dashboard" element={<PageAvecHabillage titre="Tableau de bord" />} />
    );
    const barreInitiale = screen.getByRole('complementary', { name: 'Navigation principale' });
    expect(barreInitiale).toBeInTheDocument();
    unmount();

    // L'habillage vit sur la route parente : changer d'enfant ne le détruit plus.
    rendre('/ventes', <Route path="/ventes" element={<PageAvecHabillage titre="Ventes d’or" />} />);
    expect(screen.getByRole('heading', { name: 'Ventes d’or' })).toBeInTheDocument();
    expect(screen.getAllByRole('complementary', { name: 'Navigation principale' })).toHaveLength(1);
  });

  it('garde l’en-tête et la barre hors du périmètre du repli de suspense', () => {
    const { container } = rendre('/vue', <Route path="/vue" element={<h2>Contenu</h2>} />);

    // Le repli vit dans `main` : un chargement de page n'efface plus l'écran entier.
    const contenu = container.querySelector('.national-shell__content');
    expect(contenu).not.toBeNull();
    expect(contenu?.contains(screen.getByRole('heading', { name: 'Contenu' }))).toBe(true);
    expect(contenu?.contains(screen.getByRole('complementary', { name: 'Navigation principale' }))).toBe(false);
  });
});
