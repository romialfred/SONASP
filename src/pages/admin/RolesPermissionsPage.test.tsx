import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RolesPermissionsPage } from './RolesPermissionsPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  from: vi.fn(),
  listModules: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1', role: 'owner', is_active: true } }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/services/userPermissionsService', () => ({
  userPermissionsService: { listModules: mocks.listModules },
}));

function orderedResult(data: unknown[]) {
  const result = { data, error: null };
  const builder: Record<string, unknown> = {};
  builder.order = vi.fn(() => builder);
  builder.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

describe('RolesPermissionsPage', () => {
  it('compte uniquement les modules canoniques et ouvre leur édition', async () => {
    mocks.from.mockImplementation((table: string) => ({
      select: vi.fn(() => table === 'user_profiles'
        ? orderedResult([{
          id: 'admin-1', email: 'otingueri@gmail.com', full_name: 'TINGUERI Ousseni',
          role: 'admin', is_active: true,
        }])
        : Promise.resolve({
          data: [
            { user_id: 'admin-1', module_id: 'module-1', can_view: true, can_create: false, can_edit: false, can_delete: false, can_approve: false },
            { user_id: 'admin-1', module_id: 'legacy-module', can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true },
          ],
          error: null,
        })),
    }));
    mocks.listModules.mockResolvedValue({
      modules: [
        { id: 'module-1', name: 'dashboard', display_name: 'Tableau de bord' },
        { id: 'module-2', name: 'administration', display_name: 'Administration' },
      ],
    });

    render(<RolesPermissionsPage />);

    await waitFor(() => expect(screen.getByText('TINGUERI Ousseni')).toBeInTheDocument());
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('otingueri@gmail.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Modifier/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/users/edit?userId=admin-1&step=permissions');
  });
});
