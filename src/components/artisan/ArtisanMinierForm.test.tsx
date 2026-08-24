import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ArtisanMinierForm,
  EMPTY_ARTISAN_FORM,
  calculateAge,
  completionRate,
  validateArtisan,
  valuesFromArtisan,
} from './ArtisanMinierForm';
import type { ArtisanMinier } from '@/services/artisanMinierService';

const mocks = vi.hoisted(() => ({
  listerMoyens: vi.fn(),
  remplacerMoyens: vi.fn(),
  verifierMoyen: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  uploadDocument: vi.fn(),
  preview: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
  auth: {
    user: {
      id: 'admin-1',
      role: 'admin',
      is_active: true,
      capabilities: ['artisan.payment-methods.manage'],
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
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

vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: {
    create: mocks.create,
    update: mocks.update,
    uploadDocument: mocks.uploadDocument,
  },
}));

vi.mock('@/services/artisanMoyenPaiementService', async () => {
  const reel = await vi.importActual<typeof import('@/services/artisanMoyenPaiementService')>(
    '@/services/artisanMoyenPaiementService'
  );
  return {
    ...reel,
    artisanMoyenPaiementService: {
      listerParArtisan: mocks.listerMoyens,
      remplacerPourArtisan: mocks.remplacerMoyens,
      verifier: mocks.verifierMoyen,
    },
  };
});

vi.mock('@/services/carteProfessionnelleGeneratorService', () => ({
  carteProfessionnelleGeneratorService: { generatePreviewDataUrl: mocks.preview },
}));

const artisanMalien = {
  id: 'a9',
  type_personne: 'physique',
  type_artisan: 'collecteur',
  nom: 'TRAORE',
  prenoms: 'Modibo',
  date_naissance: '1990-04-12',
  pays: 'Mali',
  region: 'Kayes',
  commune: 'Kayes',
  telephone: '+223 70 00 00 01',
  numero_piece_identite: 'ML-889',
  numero_carte: 'SONASP/AM/2026/0009',
} as unknown as ArtisanMinier;

const ficheValide = {
  ...EMPTY_ARTISAN_FORM,
  nom: 'KABORE',
  date_naissance: '1990-01-01',
  region: 'Centre',
  commune: 'Ouagadougou',
  telephone: '+226 70 00 00 01',
  numero_piece_identite: 'B1234',
};

describe('validateArtisan', () => {
  it('exige les mentions obligatoires d’une personne physique', () => {
    expect(validateArtisan(EMPTY_ARTISAN_FORM)).toBe('Le nom est obligatoire.');
    expect(validateArtisan({ ...EMPTY_ARTISAN_FORM, nom: 'KABORE' })).toBe('La date de naissance est obligatoire.');
    expect(validateArtisan({ ...EMPTY_ARTISAN_FORM, nom: 'KABORE', date_naissance: '2015-01-01' })).toBe(
      'L’artisan minier doit avoir au moins 18 ans.'
    );
    expect(validateArtisan(ficheValide)).toBeNull();
  });

  it('bascule sur la raison sociale pour une personne morale', () => {
    const morale = { ...EMPTY_ARTISAN_FORM, type_personne: 'morale' as const };
    expect(validateArtisan(morale)).toBe('La raison sociale est obligatoire.');
    expect(
      validateArtisan({
        ...morale,
        raison_sociale: 'BURKINA GOLD',
        region: 'Centre',
        commune: 'Ouagadougou',
        telephone: '+226 70 00 00 01',
        numero_piece_identite: 'RCCM-1',
      })
    ).toBeNull();
  });

  it('contrôle l’e-mail et la cohérence des dates de pièce', () => {
    expect(validateArtisan({ ...ficheValide, email: 'pas-un-mail' })).toBe('L’adresse e-mail est invalide.');
    expect(
      validateArtisan({ ...ficheValide, date_delivrance_piece: '2026-01-01', date_expiration_piece: '2025-01-01' })
    ).toBe('L’expiration de la pièce précède sa délivrance.');
  });

  it('calcule l’âge révolu', () => {
    expect(calculateAge('2000-06-15', new Date('2026-06-14'))).toBe(25);
    expect(calculateAge('2000-06-15', new Date('2026-06-15'))).toBe(26);
  });

  it('mesure la complétude de la fiche', () => {
    expect(completionRate(EMPTY_ARTISAN_FORM)).toBe(0);
    expect(completionRate(ficheValide)).toBeGreaterThan(0);
    expect(completionRate(ficheValide)).toBeLessThan(100);
  });

  it('hydrate la fiche sans laisser de champ indéfini', () => {
    const values = valuesFromArtisan(artisanMalien);
    expect(values.pays).toBe('Mali');
    expect(values.region).toBe('Kayes');
    expect(values.raison_sociale).toBe('');
    expect(valuesFromArtisan(null)).toEqual(EMPTY_ARTISAN_FORM);
  });
});

describe('ArtisanMinierForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 'a1' });
    mocks.update.mockResolvedValue({ id: 'a9' });
    mocks.uploadDocument.mockResolvedValue('https://stockage/photo.jpg');
    mocks.preview.mockResolvedValue('data:image/png;base64,AAA');
    mocks.listerMoyens.mockResolvedValue([]);
    mocks.remplacerMoyens.mockResolvedValue(undefined);
    mocks.verifierMoyen.mockResolvedValue({});
    mocks.auth.user = {
      id: 'admin-1',
      role: 'admin',
      is_active: true,
      capabilities: ['artisan.payment-methods.manage'],
    };
  });

  const remplirFiche = () => {
    fireEvent.change(screen.getByLabelText(/^Nom/), { target: { value: 'KABORE' } });
    fireEvent.change(screen.getByLabelText(/Date de naissance/), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText(/^Région/), { target: { value: 'Centre' } });
    fireEvent.change(screen.getByLabelText(/^Commune/), { target: { value: 'Ouagadougou' } });
    fireEvent.change(screen.getByLabelText(/Numéro de pièce/), { target: { value: 'B1234' } });
  };

  it('conserve le rattachement territorial d’une fiche hors Burkina', async () => {
    render(<ArtisanMinierForm artisan={artisanMalien} onCancel={mocks.onCancel} onSuccess={mocks.onSuccess} />);

    // L'ancien enchaînement d'effets remettait région et commune à zéro dès que le pays
    // différait du Burkina : la fiche perdait silencieusement son territoire.
    expect(screen.getByLabelText(/^Pays/)).toHaveValue('Mali');
    expect(screen.getByLabelText(/^Région/)).toHaveValue('Kayes');
    expect(screen.getByLabelText(/^Commune/)).toHaveValue('Kayes');
    expect(screen.getByLabelText(/^Commune/)).not.toBeDisabled();
  });

  it('adapte la saisie à la qualité juridique', async () => {
    render(<ArtisanMinierForm onCancel={mocks.onCancel} onSuccess={mocks.onSuccess} />);

    expect(screen.getByLabelText(/^Nom/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Personne morale' }));

    expect(screen.queryByLabelText(/^Nom/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Raison sociale/)).toBeInTheDocument();
  });

  it('bloque l’enregistrement tant que la fiche est incomplète', () => {
    render(<ArtisanMinierForm onCancel={mocks.onCancel} onSuccess={mocks.onSuccess} />);

    const submit = screen.getByRole('button', { name: /Enregistrer l’artisan/ });
    expect(submit).toBeDisabled();
    expect(screen.getByText('Le nom est obligatoire.')).toBeInTheDocument();

    remplirFiche();
    expect(submit).toBeDisabled(); // le téléphone manque encore
    fireEvent.change(screen.getByPlaceholderText(/XX XX XX XX/), { target: { value: '70000001' } });
    expect(submit).not.toBeDisabled();
  });

  it('n’écrit jamais la photo en base64 dans la fiche', async () => {
    render(<ArtisanMinierForm onCancel={mocks.onCancel} onSuccess={mocks.onSuccess} />);

    remplirFiche();
    fireEvent.change(screen.getByPlaceholderText(/XX XX XX XX/), { target: { value: '70000001' } });

    const photo = new File(['img'], 'portrait.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Photo d’identité/), { target: { files: [photo] } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer l’artisan/ }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    // Seul le lien de stockage est persisté, dans un second temps.
    expect(mocks.create.mock.calls[0][0].photo_url).toBe('');
    await waitFor(() => expect(mocks.uploadDocument).toHaveBeenCalledWith('a1', photo, 'photo'));
    expect(mocks.update).toHaveBeenCalledWith('a1', { photo_url: 'https://stockage/photo.jpg' });
    expect(mocks.showSuccess).toHaveBeenCalledWith('Artisan enregistré');
  });

  it('signale un échec d’envoi au lieu d’annoncer un succès complet', async () => {
    mocks.uploadDocument.mockRejectedValue(new Error('stockage indisponible'));
    render(<ArtisanMinierForm onCancel={mocks.onCancel} onSuccess={mocks.onSuccess} />);

    remplirFiche();
    fireEvent.change(screen.getByPlaceholderText(/XX XX XX XX/), { target: { value: '70000001' } });
    fireEvent.change(screen.getByLabelText(/Photo d’identité/), {
      target: { files: [new File(['img'], 'portrait.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer l’artisan/ }));

    await waitFor(() =>
      expect(mocks.showError).toHaveBeenCalledWith(
        'Fiche enregistrée, mais l’envoi de la photo d’identité a échoué. Reprenez le dépôt.'
      )
    );
    expect(mocks.showSuccess).not.toHaveBeenCalled();
  });

  it('refuse une photo hors format ou trop lourde', () => {
    render(<ArtisanMinierForm onCancel={mocks.onCancel} onSuccess={mocks.onSuccess} />);

    const lourde = new File(['x'], 'portrait.png', { type: 'image/png' });
    Object.defineProperty(lourde, 'size', { value: 3 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText(/Photo d’identité/), { target: { files: [lourde] } });
    expect(mocks.showError).toHaveBeenCalledWith('La photo doit faire moins de 2 Mo.');

    fireEvent.change(screen.getByLabelText(/Photo d’identité/), {
      target: { files: [new File(['x'], 'scan.pdf', { type: 'application/pdf' })] },
    });
    expect(mocks.showError).toHaveBeenCalledWith('Format non supporté pour la photo : utilisez JPG ou PNG.');
  });

  it('suit la complétude dans le volet latéral', () => {
    render(<ArtisanMinierForm onCancel={mocks.onCancel} onSuccess={mocks.onSuccess} />);
    const volet = within(screen.getByRole('complementary', { name: 'Suivi de la saisie' }));

    expect(volet.getByText('Identité à renseigner')).toBeInTheDocument();
    expect(volet.getByRole('progressbar', { name: 'Complétude de la fiche' })).toHaveAttribute('aria-valuenow', '0');

    remplirFiche();

    expect(volet.getByText('KABORE')).toBeInTheDocument();
    expect(
      Number(volet.getByRole('progressbar', { name: 'Complétude de la fiche' }).getAttribute('aria-valuenow'))
    ).toBeGreaterThan(0);
  });

  it('rend les coordonnées en lecture seule sans capability AAL2 et ne tente aucune mutation', async () => {
    mocks.auth.user = {
      id: 'admin-aal1',
      role: 'admin',
      is_active: true,
      capabilities: [],
    };
    mocks.listerMoyens.mockResolvedValue([{
      id: 'm1',
      artisan_id: 'a9',
      type: 'orange_money',
      titulaire: 'TRAORE Modibo',
      numero_telephone: '+22370000001',
      est_principal: true,
      actif: true,
      verifie_le: null,
    }]);

    render(<ArtisanMinierForm artisan={artisanMalien} onCancel={mocks.onCancel} onSuccess={mocks.onSuccess} />);

    await waitFor(() => expect(screen.getByText(/Consultation uniquement/)).toBeInTheDocument());
    expect(screen.getByDisplayValue('TRAORE Modibo')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Vérifier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter un moyen/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mettre à jour la fiche/ }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.remplacerMoyens).not.toHaveBeenCalled();
  });

  it('expose l’état de vérification et relaie le refus serveur de double contrôle', async () => {
    mocks.listerMoyens.mockResolvedValue([{
      id: 'm1',
      artisan_id: 'a9',
      type: 'orange_money',
      titulaire: 'TRAORE Modibo',
      numero_telephone: '+22370000001',
      est_principal: true,
      actif: true,
      verifie_le: null,
    }]);
    mocks.verifierMoyen.mockRejectedValueOnce(
      new Error('Double contrôle requis : le saisissant ne vérifie pas sa coordonnée.'),
    );

    render(<ArtisanMinierForm artisan={artisanMalien} onCancel={mocks.onCancel} onSuccess={mocks.onSuccess} />);
    await waitFor(() => expect(screen.getByText('À vérifier')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));

    await waitFor(() => expect(mocks.verifierMoyen).toHaveBeenCalledWith('m1', true, undefined));
    expect(mocks.showError).toHaveBeenCalledWith(
      'Double contrôle requis : le saisissant ne vérifie pas sa coordonnée.',
    );
  });

  it('affiche l’état vérifié confirmé par la RPC et retire les actions de revue', async () => {
    const moyen = {
      id: 'm1',
      artisan_id: 'a9',
      type: 'orange_money',
      titulaire: 'TRAORE Modibo',
      numero_telephone: '+22370000001',
      est_principal: true,
      actif: true,
      verifie_le: null,
    };
    mocks.listerMoyens.mockResolvedValue([moyen]);
    mocks.verifierMoyen.mockResolvedValueOnce({
      ...moyen,
      verifie_le: '2026-08-24T20:00:00Z',
      verifie_par: 'controleur-2',
    });

    render(<ArtisanMinierForm artisan={artisanMalien} onCancel={mocks.onCancel} onSuccess={mocks.onSuccess} />);
    await waitFor(() => expect(screen.getByText('À vérifier')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));

    await waitFor(() => expect(screen.getByText('Vérifié')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Vérifier' })).not.toBeInTheDocument();
    expect(mocks.showSuccess).toHaveBeenCalledWith('Moyen de paiement vérifié');
  });
});
