import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSessionSummary } from '@/services/userSessionService';
import SessionsTab from './SessionsTab';

const mocks = vi.hoisted(() => ({
  getActiveSessions: vi.fn(),
  terminateSession: vi.fn(),
  terminateAllSessions: vi.fn(),
}));

vi.mock('@/services/userLoginService', () => ({
  userLoginService: mocks,
}));

const USER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const session: UserSessionSummary = {
  id: SESSION_ID,
  user_id: USER_ID,
  ip_address: '192.0.2.10',
  user_agent: 'Navigateur de test',
  device_type: 'desktop',
  browser: 'Firefox',
  location_country: 'Burkina Faso',
  last_activity_at: '2099-08-24T21:00:00.000Z',
  expires_at: '2099-08-24T21:10:00.000Z',
  is_active: true,
  is_current: true,
  created_at: '2099-08-24T20:55:00.000Z',
  revoked_at: null,
  revoked_by: null,
  revocation_reason: null,
};

describe('SessionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveSessions.mockResolvedValue([session]);
    mocks.terminateSession.mockResolvedValue({ ...session, is_active: false });
    mocks.terminateAllSessions.mockResolvedValue(1);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('affiche uniquement le résumé sanitizé et jamais un token renvoyé par erreur', async () => {
    mocks.getActiveSessions.mockResolvedValue([{
      ...session,
      session_token: 'secret-qui-ne-doit-jamais-être-rendu',
    }]);

    render(<SessionsTab userId={USER_ID} />);

    expect(await screen.findByText('Firefox')).toBeInTheDocument();
    expect(screen.getByText('Session courante')).toBeInTheDocument();
    expect(screen.queryByText('secret-qui-ne-doit-jamais-être-rendu')).not.toBeInTheDocument();
  });

  it('efface la liste et affiche un état fermé lorsque la lecture réseau échoue', async () => {
    mocks.getActiveSessions.mockRejectedValue(new Error('network'));

    render(<SessionsTab userId={USER_ID} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/ne peuvent pas être vérifiées/i);
    expect(screen.getByText('Aucune session active')).toBeInTheDocument();
  });

  it('révoque une session puis recharge exclusivement depuis le serveur', async () => {
    mocks.getActiveSessions
      .mockResolvedValueOnce([session])
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<SessionsTab userId={USER_ID} />);

    await user.click(await screen.findByTitle('Terminer cette session'));

    expect(mocks.terminateSession).toHaveBeenCalledWith(SESSION_ID);
    await waitFor(() => expect(mocks.getActiveSessions).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Aucune session active')).toBeInTheDocument();
  });

  it('masque toute donnée périmée si la révocation ne peut pas être confirmée', async () => {
    mocks.terminateSession.mockRejectedValue(new Error('forbidden'));
    const user = userEvent.setup();
    render(<SessionsTab userId={USER_ID} />);

    await user.click(await screen.findByTitle('Terminer cette session'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/n’a pas pu être confirmée/i);
    expect(screen.getByText('Aucune session active')).toBeInTheDocument();
  });

  it('ignore une réponse tardive appartenant à l’utilisateur précédemment affiché', async () => {
    let resolvePrevious: ((value: UserSessionSummary[]) => void) | undefined;
    const previous = new Promise<UserSessionSummary[]>((resolve) => {
      resolvePrevious = resolve;
    });
    mocks.getActiveSessions.mockImplementation((userId: string) => userId === USER_ID
      ? previous
      : Promise.resolve([{
        ...session,
        id: '55555555-5555-4555-8555-555555555555',
        user_id: OTHER_USER_ID,
        browser: 'Edge cible actuelle',
        is_current: false,
      }]));

    const { rerender } = render(<SessionsTab userId={USER_ID} />);
    rerender(<SessionsTab userId={OTHER_USER_ID} />);
    expect(await screen.findByText('Edge cible actuelle')).toBeInTheDocument();

    resolvePrevious?.([{ ...session, browser: 'Firefox réponse obsolète' }]);
    await Promise.resolve();
    expect(screen.queryByText('Firefox réponse obsolète')).not.toBeInTheDocument();
  });
});
