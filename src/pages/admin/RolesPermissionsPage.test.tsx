import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RolesPermissionsPage } from './RolesPermissionsPage';

const mocks = vi.hoisted(() => ({ listPortals: vi.fn(), listRoles: vi.fn(), listCategories: vi.fn(), getRoleMatrix: vi.fn(), saveRole: vi.fn(), addToast: vi.fn() }));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ addToast: mocks.addToast }) }));
vi.mock('@/services/accessGovernanceService', () => ({ accessGovernanceService: {
  listPortals: mocks.listPortals, listRoles: mocks.listRoles, listActorCategories: mocks.listCategories,
  getRoleMatrix: mocks.getRoleMatrix, saveRole: mocks.saveRole,
} }));

describe('RolesPermissionsPage', () => {
  it('affiche les rôles du portail et la matrice des seules permissions applicables', async () => {
    mocks.listPortals.mockResolvedValue([{ id: 'portal-1', code: 'dgi', name: 'Portail DGI', is_active: true }]);
    mocks.listRoles.mockResolvedValue([{ id: 'role-1', portal_id: 'portal-1', portal_code: 'dgi', portal_name: 'Portail DGI', code: 'dgi-royalties', name: 'DGI – Royalties', description: 'Contrôle fiscal', legacy_role: 'dgi', is_active: true, is_system: true, user_count: 2, category_codes: ['administrateur'] }]);
    mocks.listCategories.mockResolvedValue([{ code: 'administrateur', name: 'Administrateur', description: null, resource_kind: 'identity', legacy_role: 'admin', is_active: true, sort_order: 1 }]);
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
});
