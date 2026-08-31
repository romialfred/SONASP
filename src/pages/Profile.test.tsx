import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Profile } from './Profile';

const mocks = vi.hoisted(() => ({
  history: vi.fn(), update: vi.fn(), eq: vi.fn(), toast: vi.fn(), refresh: vi.fn(),
  user: { id: 'current-user', full_name: 'Compte test', email: 'user@example.invalid',
    phone: '', language: 'fr', email_notifications: true, approval_notifications: true },
}));
vi.mock('@/components/layout/MainLayout', () => ({ MainLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, refreshProfile: mocks.refresh, updatePassword: vi.fn() }) }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ addToast: mocks.toast }) }));
vi.mock('@/services/userActivityService', () => ({ userActivityService: { getActivityHistory: mocks.history } }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ update: mocks.update }) } }));

describe('Profile — données personnelles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.history.mockResolvedValue([]);
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockResolvedValue({ error: null });
  });
  it('n’enregistre que les champs personnels publiés, sans droits ni colonne fictive', async () => {
    render(<Profile />);
    fireEvent.submit(screen.getByRole('form', { name: 'Informations personnelles' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({
      full_name: 'Compte test', phone: null, language: 'fr', email_notifications: true, approval_notifications: true,
    }));
    expect(mocks.eq).toHaveBeenCalledWith('id', 'current-user');
    expect(screen.getByDisplayValue('user@example.invalid')).toHaveAttribute('readonly');
    expect(screen.queryByText('Batch status updates')).not.toBeInTheDocument();
  });
  it('affiche l’historique réellement chargé pour le titulaire, sans événements de démonstration', async () => {
    mocks.history.mockResolvedValue([{ description: 'Modification réelle du profil', created_at: '2026-08-30T10:00:00Z', ip_address: null }]);
    render(<Profile />);
    expect(await screen.findByText('Modification réelle du profil')).toBeInTheDocument();
    expect(mocks.history).toHaveBeenCalledWith('current-user', { limit: 50 });
    expect(screen.queryByText('192.168.1.1')).not.toBeInTheDocument();
  });
  it('distingue un historique indisponible d’un historique vide', async () => {
    mocks.history.mockRejectedValue(new Error('Lecture refusée'));
    render(<Profile />);
    expect(await screen.findByRole('alert')).toHaveTextContent('L’historique est indisponible');
  });
});
