import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtisanMinierForm, valuesFromArtisan } from './ArtisanMinierForm';
import type { ArtisanMinier } from '@/services/artisanMinierService';
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  getById: vi.fn(),
  upload: vi.fn(),
  documents: vi.fn(),
  remove: vi.fn(),
  search: vi.fn(),
  listerMoyens: vi.fn(),
  remplacerMoyens: vi.fn(),
  verifierMoyen: vi.fn(),
  preview: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
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
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));
vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: {},
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));
vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getById: mocks.getById },
}));
vi.mock('@/services/artisanDossierService', () => ({
  artisanDossierService: {
    save: mocks.save,
    searchExploitants: mocks.search,
    getExploitant: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock('@/services/artisanDocumentService', () => ({
  artisanDocumentService: {
    list: mocks.documents,
    upload: mocks.upload,
    remove: mocks.remove,
    photoUrl: vi.fn().mockResolvedValue(''),
    url: vi.fn(),
  },
}));
vi.mock('@/services/artisanalSiteService', () => ({
  artisanalSiteService: { listSites: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/artisanMoyenPaiementService', async () => ({
  ...(await vi.importActual<
    typeof import('@/services/artisanMoyenPaiementService')
  >('@/services/artisanMoyenPaiementService')),
  artisanMoyenPaiementService: {
    listerParArtisan: mocks.listerMoyens,
    remplacerPourArtisan: mocks.remplacerMoyens,
    verifier: mocks.verifierMoyen,
  },
}));
vi.mock('@/services/carteProfessionnelleGeneratorService', () => ({
  carteProfessionnelleGeneratorService: {
    generatePreviewDataUrl: mocks.preview,
  },
}));
const artisanMalien = {
  ...valuesFromArtisan(null),
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
  numero_carte: 'CARTE-009',
} as ArtisanMinier;
describe('ArtisanMinierForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mocks.save.mockImplementation(async (v) => ({
      id: 'a1',
      updated_at: '2026-09-06T00:00:00Z',
      ...v,
    }));
    mocks.getById.mockResolvedValue({
      id: 'a1',
      updated_at: '2026-09-06T00:00:01Z',
    });
    mocks.documents.mockResolvedValue([]);
    mocks.remove.mockResolvedValue(undefined);
    mocks.upload.mockImplementation(async (id, d) => ({
      id: d.id,
      artisan_id: id,
      owner_kind: d.owner,
      type_document: d.type,
      titre: d.title,
      nom_fichier: d.file.name,
      storage_bucket: 'artisan-dossiers',
    }));
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
  const change = (id: string, value: string) =>
    fireEvent.change(document.getElementById(id)!, { target: { value } });
  const remplirFiche = () => {
    change('nom', 'KABORE');
    change('date_naissance', '1990-01-01');
    change('region', 'Centre');
    change('commune', 'Ouagadougou');
    change('numero_piece_identite', 'B1234');
    change('telephone', '70000001');
  };
  it('conserve la région étrangère et le rôle historique en modification', () => {
    render(
      <ArtisanMinierForm
        artisan={artisanMalien}
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );
    expect(screen.getByLabelText(/^Pays/)).toHaveValue('Mali');
    expect(screen.getByLabelText(/^Région/)).toHaveValue('Kayes');
    expect(screen.getByLabelText(/^Commune/)).toHaveValue('Kayes');
    expect(
      screen.queryByRole('radio', { name: /Collecteur/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Rôle actuel : Collecteur/)).toBeInTheDocument();
  });
  it('préserve les brouillons de chaque qualité et retire les champs inactifs', () => {
    render(
      <ArtisanMinierForm
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );
    change('nom', 'Mon brouillon');
    fireEvent.click(screen.getByRole('radio', { name: 'Personne morale' }));
    change('raison_sociale', 'Société brouillon');
    expect(document.getElementById('nom')).toBeNull();
    expect(document.getElementById('responsable.nom')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Personne physique' }));
    expect(document.getElementById('nom')).toHaveValue('Mon brouillon');
    fireEvent.click(screen.getByRole('radio', { name: 'Personne morale' }));
    expect(document.getElementById('raison_sociale')).toHaveValue(
      'Société brouillon',
    );
  });
  it('guide vers le premier champ invalide et calcule une progression réelle', async () => {
    render(
      <ArtisanMinierForm
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '40');
    fireEvent.click(
      screen.getByRole('button', { name: /Enregistrer l’artisan/ }),
    );
    expect(mocks.save).not.toHaveBeenCalled();
    expect(document.getElementById('nom')).toHaveFocus();
    remplirFiche();
    expect(progress).toHaveAttribute('aria-valuenow', '100');
  });
  it('transmet le dossier une seule fois lors d’une double soumission', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    mocks.save.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(
      <ArtisanMinierForm
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );
    remplirFiche();
    fireEvent.submit(document.querySelector('form')!);
    fireEvent.submit(document.querySelector('form')!);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    resolve({ id: 'a1', updated_at: '2026-09-06T00:00:00Z' });
    await waitFor(() => expect(mocks.onSuccess).toHaveBeenCalled());
  });
  it('reprend une pièce échouée sans recréer le dossier ni renvoyer la pièce réussie', async () => {
    mocks.upload
      .mockImplementationOnce(async (id, d) => ({
        id: d.id,
        artisan_id: id,
        owner_kind: d.owner,
        type_document: d.type,
        titre: d.title,
        nom_fichier: d.file.name,
        storage_bucket: 'artisan-dossiers',
      }))
      .mockRejectedValueOnce(new Error('réseau'));
    render(
      <ArtisanMinierForm
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );
    remplirFiche();
    fireEvent.change(screen.getByLabelText('Pièces de l’artisan'), {
      target: {
        files: [
          new File(['pdf'], 'recto.pdf', { type: 'application/pdf' }),
          new File(['pdf'], 'verso.pdf', { type: 'application/pdf' }),
        ],
      },
    });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() =>
      expect(mocks.showError).toHaveBeenCalledWith(
        expect.stringContaining('Fiche enregistrée. À reprendre'),
      ),
    );
    expect(mocks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.showSuccess).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(mocks.onSuccess).toHaveBeenCalled());
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(mocks.upload.mock.calls[1][1].id).toBe(
      mocks.upload.mock.calls[2][1].id,
    );
  });
  it('exige un parent pour un aide et propose une recherche bornée', async () => {
    mocks.search.mockResolvedValue([
      {
        id: 'p1',
        type_personne: 'physique',
        nom: 'Parent',
        prenoms: 'Essai',
        numero_carte: 'P-1',
        site_name: null,
      },
    ]);
    render(
      <ArtisanMinierForm
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );
    remplirFiche();
    fireEvent.click(screen.getByRole('radio', { name: 'Aide exploitant' }));
    fireEvent.submit(document.querySelector('form')!);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(document.getElementById('artisanal_site_id')).toBeNull();
    change('exploitant_id', 'Parent');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Parent Essai/ }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /Parent Essai/ }));
    expect(
      screen.getByText('Site de l’exploitant à renseigner'),
    ).toBeInTheDocument();
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({ exploitant_id: 'p1' }),
        expect.anything(),
      ),
    );
  });
  it('refuse les fichiers surdimensionnés et les faux formats côté client', () => {
    render(
      <ArtisanMinierForm
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );
    const heavy = new File(['x'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(heavy, 'size', { value: 3 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText('Photo d’identité'), {
      target: { files: [heavy] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('2 Mo');
    fireEvent.change(screen.getByLabelText('Photo d’identité'), {
      target: {
        files: [new File(['x'], 'scan.pdf', { type: 'application/pdf' })],
      },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG ou PNG');
  });
  it('ne remplace pas les coordonnées financières lorsqu’elles n’ont pas été chargées', async () => {
    mocks.listerMoyens.mockRejectedValue(new Error('offline'));
    render(
      <ArtisanMinierForm
        artisan={artisanMalien}
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );
    await waitFor(() => expect(mocks.showError).toHaveBeenCalled());
    fireEvent.submit(document.querySelector('form')!);
    expect(mocks.remplacerMoyens).not.toHaveBeenCalled();
  });
  it('rend les coordonnées en lecture seule sans capability AAL2 et ne tente aucune mutation', async () => {
    mocks.auth.user = {
      id: 'admin-aal1',
      role: 'admin',
      is_active: true,
      capabilities: [],
    };
    mocks.listerMoyens.mockResolvedValue([
      {
        id: 'm1',
        artisan_id: 'a9',
        type: 'orange_money',
        titulaire: 'TRAORE Modibo',
        numero_telephone: '+22370000001',
        est_principal: true,
        actif: true,
        verifie_le: null,
      },
    ]);

    render(
      <ArtisanMinierForm
        artisan={artisanMalien}
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/Consultation uniquement/)).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue('TRAORE Modibo')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Vérifier' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Ajouter un moyen/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Mettre à jour la fiche/ }),
    );
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(mocks.remplacerMoyens).not.toHaveBeenCalled();
  });

  it('expose l’état de vérification et relaie le refus serveur de double contrôle', async () => {
    mocks.listerMoyens.mockResolvedValue([
      {
        id: 'm1',
        artisan_id: 'a9',
        type: 'orange_money',
        titulaire: 'TRAORE Modibo',
        numero_telephone: '+22370000001',
        est_principal: true,
        actif: true,
        verifie_le: null,
      },
    ]);
    mocks.verifierMoyen.mockRejectedValueOnce(
      new Error(
        'Double contrôle requis : le saisissant ne vérifie pas sa coordonnée.',
      ),
    );

    render(
      <ArtisanMinierForm
        artisan={artisanMalien}
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('À vérifier')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));

    await waitFor(() =>
      expect(mocks.verifierMoyen).toHaveBeenCalledWith('m1', true, undefined),
    );
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

    render(
      <ArtisanMinierForm
        artisan={artisanMalien}
        onCancel={mocks.onCancel}
        onSuccess={mocks.onSuccess}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('À vérifier')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));

    await waitFor(() =>
      expect(screen.getByText('Vérifié')).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: 'Vérifier' }),
    ).not.toBeInTheDocument();
    expect(mocks.showSuccess).toHaveBeenCalledWith('Moyen de paiement vérifié');
  });
});
