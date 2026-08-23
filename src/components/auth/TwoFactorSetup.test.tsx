import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwoFactorSetup } from './TwoFactorSetup';

const mocks = vi.hoisted(() => ({
  commencerEnrolement: vi.fn(),
  verifierCode: vi.fn(),
  confirmerEnrolement: vi.fn(),
}));

vi.mock('@/services/mfaService', () => ({
  EMETTEUR_TOTP: 'SONASP',
  secretLisible: (secret: string) => secret,
  mfaService: mocks,
}));

describe('TwoFactorSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.commencerEnrolement.mockResolvedValue({
      facteurId: 'facteur-1',
      qrCode: 'data:image/svg+xml;base64,PHN2Zy8+',
      secret: 'SECRETSONASP',
    });
    mocks.verifierCode.mockResolvedValue(undefined);
    mocks.confirmerEnrolement.mockResolvedValue(undefined);
  });

  it('présente un parcours compact et finalise après vérification du code', async () => {
    const onComplete = vi.fn();
    render(<TwoFactorSetup obligatoire onComplete={onComplete} />);

    expect(await screen.findByRole('img', { name: 'QR code d’enrôlement' })).toHaveAttribute('width', '156');
    expect(screen.getByText('Scannez le QR code puis saisissez le code à 6 chiffres.')).toBeInTheDocument();
    expect(screen.queryByText(/Il n’y a pas de codes de secours/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Code à six chiffres'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activer' }));

    await waitFor(() => expect(mocks.verifierCode).toHaveBeenCalledWith('facteur-1', '123456'));
    expect(mocks.confirmerEnrolement).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
