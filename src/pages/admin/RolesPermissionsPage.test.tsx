import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createBlankRoleMatrix, RolesPermissionsPage } from './RolesPermissionsPage';

const mocks = vi.hoisted(() => ({ listPortals: vi.fn(), listRoles: vi.fn(), listCategories: vi.fn(), getRoleMatrix: vi.fn(), getPortalConfiguration: vi.fn(), saveRole: vi.fn(), addToast: vi.fn() }));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ addToast: mocks.addToast }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'owner' } }) }));
vi.mock('@/services/accessGovernanceService', () => ({ accessGovernanceService: {
  listPortals: mocks.listPortals, listRoles: mocks.listRoles, listActorCategories: mocks.listCategories,
  getRoleMatrix: mocks.getRoleMatrix, getPortalConfiguration: mocks.getPortalConfiguration, saveRole: mocks.saveRole,
} }));

describe('RolesPermissionsPage', () => {
  it('affiche les rôles du portail et la matrice des seules permissions applicables', async () => {
    mocks.listPortals.mockResolvedValue([{ id: 'portal-1', code: 'dgi', name: 'Portail DGI', is_active: true }]);
    mocks.listRoles.mockResolvedValue([{ id: 'role-1', portal_id: 'portal-1', portal_code: 'dgi', portal_name: 'Portail DGI', code: 'dgi-royalties', name: 'DGI – Royalties', description: 'Contrôle fiscal', legacy_role: 'dgi', is_active: true, is_system: true, user_count: 2, category_codes: ['administrateur'] }]);
    mocks.listCategories.mockResolvedValue([{ code: 'administrateur', name: 'Administrateur', description: null, resource_kind: 'identity', legacy_role: 'admin', is_active: true, sort_order: 1 }]);
    mocks.getPortalConfiguration.mockResolvedValue({ portal: { id: 'portal-1', code: 'dgi', name: 'Portail DGI' }, groups: [], modules: [] });
    mocks.getRoleMatrix.mockResolvedValue({
      role: { id: 'role-1', portal_id: 'portal-1', code: 'dgi-royalties', name: 'DGI – Royalties', description: 'Contrôle fiscal', legacy_role: 'dgi', is_active: true, is_system: true, category_codes: ['administrateur'] },
      modules: [{ id: 'module-1', code: 'reports', name: 'Rapports institutionnels', group_name: 'Rapports', is_portal_active: true }],
      permissions: [{ module_id: 'module-1', permission_code: 'view', allowed: true }],
    });

    render(<RolesPermissionsPage />);
    await waitFor(() => expect(screen.getByText('DGI – Royalties')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /DGI – Royalties/ }));
    await waitFor(() => expect(screen.getByText('Rapports institutionnels')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Voir — Rapports institutionnels : autorisé' })).toBeInTheDocument();
    expect(screen.getAllByText('—', { selector: '.access-na' })).toHaveLength(10);
  });

  it('prépare la matrice d’un nouveau rôle avant son premier enregistrement', () => {
    const matrix = createBlankRoleMatrix('portal-1', {
      portal: null,
      groups: [],
      modules: [
        { id: 'active', code: 'reports', name: 'Rapports', description: null, route: null, parent_id: null, group_code: 'pilotage', group_name: 'Pilotage', sort_order: 1, is_globally_active: true, is_portal_active: true, is_portal_visible: true, permissions: ['view', 'export'] },
        { id: 'inactive', code: 'settings', name: 'Paramètres', description: null, route: null, parent_id: null, group_code: 'settings', group_name: 'Paramètres', sort_order: 2, is_globally_active: true, is_portal_active: false, is_portal_visible: false, permissions: ['view', 'admin'] },
      ],
    });

    expect(matrix.modules.map(({ id }) => id)).toEqual(['active']);
    expect(matrix.permissions).toEqual([
      { module_id: 'active', permission_code: 'view', allowed: false },
      { module_id: 'active', permission_code: 'export', allowed: false },
    ]);
  });
});
