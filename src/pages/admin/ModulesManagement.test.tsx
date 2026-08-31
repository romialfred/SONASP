import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModulesManagement, { aplatirModules, filterModules } from './ModulesManagement';
import type { Module } from '@/services/modulesService';

const mocks = vi.hoisted(() => ({
  getHierarchy: vi.fn(),
  toggleActive: vi.fn(),
  toggleVisibility: vi.fn(),
  update: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  confirmer: vi.fn(),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/components/ui/ConfirmationDialog', () => ({
  useConfirmationDialog: () => ({ open: mocks.confirmer, ConfirmationDialog: () => null }),
}));

vi.mock('@/services/modulesService', () => ({
  modulesService: {
    getHierarchy: mocks.getHierarchy,
    toggleActive: mocks.toggleActive,
    toggleVisibility: mocks.toggleVisibility,
    update: mocks.update,
  },
}));

const hierarchie = [
  {
    id: 'm1',
    code: 'artisans',
    nom: 'Artisans miniers',
    description: 'Suivi des artisans',
    route: '/artisan-minier',
    est_actif: true,
    est_visible_menu: true,
    ordre: 1,
    submodules: [
      {
        id: 'm1a',
        code: 'cartes',
        nom: 'Cartes professionnelles',
        route: '/artisan-minier/cartes/validation',
        est_actif: true,
        est_visible_menu: false,
        ordre: 1,
        submodules: [],
      },
    ],
  },
  {
    id: 'm2',
    code: 'ventes',
    nom: 'Ventes',
    route: '/sales',
    est_actif: false,
    est_visible_menu: true,
    ordre: 2,
    submodules: [],
  },
] as unknown as Module[];

describe('hiérarchie des modules', () => {
  it('aplatit modules et sous-modules', () => {
    expect(aplatirModules(hierarchie).map((module) => module.id)).toEqual(['m1', 'm1a', 'm2']);
    expect(aplatirModules([])).toEqual([]);
  });

  it('conserve le parent d’un sous-module trouvé', () => {
    const resultat = filterModules(hierarchie, 'cartes');
    expect(resultat).toHaveLength(1);
    expect(resultat[0].id).toBe('m1');
    expect(resultat[0].submodules).toHaveLength(1);

    expect(filterModules(hierarchie, '/sales')[0].id).toBe('m2');
    expect(filterModules(hierarchie, 'inexistant')).toHaveLength(0);
    expect(filterModules(hierarchie, '')).toHaveLength(2);
  });
});

describe('ModulesManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirmer.mockResolvedValue(true);
    mocks.getHierarchy.mockResolvedValue(hierarchie);
    mocks.toggleActive.mockResolvedValue(undefined);
    mocks.toggleVisibility.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue(undefined);
  });

  it('présente la hiérarchie et ses états', async () => {
    render(<ModulesManagement />);
    await waitFor(() => expect(screen.getByText('Artisans miniers')).toBeInTheDocument());

    expect(screen.getByText('Cartes professionnelles')).toBeInTheDocument();
    expect(screen.getAllByText('Désactivé').length).toBeGreaterThan(0);
    expect(screen.getByText('Masqué du menu')).toBeInTheDocument();
    expect(screen.getByText('Le Owner conserve toujours l’accès à tous les modules et sous-modules'))
      .toBeInTheDocument();

    const indicateurs = within(screen.getByRole('region', { name: 'État des modules' }));
    expect(within(indicateurs.getByText('Modules déclarés').closest('article') as HTMLElement).getByText('3')).toBeInTheDocument();
  });

  it('exige une confirmation avant de désactiver un module', async () => {
    render(<ModulesManagement />);
    await waitFor(() => expect(screen.getByText('Artisans miniers')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver Artisans miniers' }));

    // La désactivation retirait une section entière de l'application en un clic.
    await waitFor(() => expect(mocks.confirmer).toHaveBeenCalled());
    expect(mocks.confirmer.mock.calls[0][0].message).toMatch(/1 sous-module/);
    expect(mocks.confirmer.mock.calls[0][0].message).toContain('Le Owner conserve tous ses accès.');
    await waitFor(() => expect(mocks.toggleActive).toHaveBeenCalledWith('m1'));
  });

  it('n’applique rien si la confirmation est refusée', async () => {
    mocks.confirmer.mockResolvedValue(false);
    render(<ModulesManagement />);
    await waitFor(() => expect(screen.getByText('Artisans miniers')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver Artisans miniers' }));

    await waitFor(() => expect(mocks.confirmer).toHaveBeenCalled());
    expect(mocks.toggleActive).not.toHaveBeenCalled();
  });

  it('bascule la visibilité sans confirmation', async () => {
    render(<ModulesManagement />);
    await waitFor(() => expect(screen.getByText('Artisans miniers')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Masquer Artisans miniers du menu' }));

    await waitFor(() => expect(mocks.toggleVisibility).toHaveBeenCalledWith('m1'));
    expect(mocks.confirmer).not.toHaveBeenCalled();
  });

  it('filtre la hiérarchie sur la recherche', async () => {
    render(<ModulesManagement />);
    await waitFor(() => expect(screen.getByText('Ventes')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'cartes' } });

    expect(screen.queryByText('Ventes')).not.toBeInTheDocument();
    expect(screen.getByText('Cartes professionnelles')).toBeInTheDocument();
  });

  it('signale un échec de chargement', async () => {
    mocks.getHierarchy.mockRejectedValue({ message: 'table absente' });
    render(<ModulesManagement />);

    await waitFor(() => expect(screen.getByText('table absente')).toBeInTheDocument());
    expect(screen.getByText('Aucun module')).toBeInTheDocument();
  });
});
