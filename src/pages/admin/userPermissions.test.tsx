import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserPermissionsPage, compterAccordees, grouperParCategorie } from './UserPermissionsPage';
import {
  EMPTY_PERMISSION,
  estAccordee,
  normaliserChamps,
  planifier,
  versLigne,
  versPermission,
  type PermissionMap,
} from '@/services/userPermissionsService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { userId: 'u1' as string | undefined },
  listModules: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  from: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  confirmer: vi.fn(),
  profil: null as Record<string, unknown> | null,
  profilErreur: null as { message: string } | null,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/NotificationDialog', () => ({
  NotificationDialog: () => null,
  useNotification: () => ({
    notification: { isOpen: false, title: '', message: '', type: 'info' },
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    closeNotification: vi.fn(),
  }),
}));

vi.mock('@/components/ui/ConfirmationDialog', () => ({
  useConfirmationDialog: () => ({ open: mocks.confirmer, ConfirmationDialog: () => null }),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));

vi.mock('@/services/userPermissionsService', async () => {
  const reel = await vi.importActual<typeof import('@/services/userPermissionsService')>(
    '@/services/userPermissionsService'
  );
  return {
    ...reel,
    userPermissionsService: { listModules: mocks.listModules, load: mocks.load, save: mocks.save },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: mocks.profil, error: mocks.profilErreur }),
        }),
      }),
    }),
  },
}));

const modules = [
  { id: 'm1', name: 'sales_view', display_name: 'Consultation des ventes', description: 'Lecture des ventes', category: 'Ventes' },
  { id: 'm2', name: 'sales_create', display_name: 'Création de ventes', description: null, category: 'Ventes' },
  { id: 'm3', name: 'audit', display_name: 'Journal d’audit', description: null, category: null },
];

const permissionAccordee = { ...EMPTY_PERMISSION('m1'), can_view: true, can_edit: true };

describe('service des habilitations', () => {
  it('normalise les permissions par champ vers la forme attendue du lecteur', () => {
    // Elles étaient écrites `{ read, write }` et lues `{ can_view, can_edit }` :
    // aucune permission de champ n'a jamais pu s'appliquer.
    expect(normaliserChamps({ montant: { read: true, write: false } })).toEqual({
      montant: { can_view: true, can_edit: false },
    });
    expect(normaliserChamps({ montant: { can_view: true, can_edit: true } })).toEqual({
      montant: { can_view: true, can_edit: true },
    });
    expect(normaliserChamps(null)).toEqual({});
  });

  it('lit les deux jeux de colonnes historiques', () => {
    // Un écran écrivait `can_read/can_write`, l'autre `can_view/can_edit`.
    expect(versPermission({ module_id: 'm1', can_read: true, can_write: true })).toMatchObject({
      can_view: true,
      can_edit: true,
    });
    expect(versPermission({ module_id: 'm1', can_view: true, can_approve: true })).toMatchObject({
      can_view: true,
      can_approve: true,
    });
  });

  it('écrit les deux jeux de colonnes pour rester cohérent', () => {
    const ligne = versLigne(permissionAccordee, 'u1', 'admin');
    expect(ligne).toMatchObject({ can_view: true, can_read: true, can_edit: true, can_write: true, granted_by: 'admin' });
  });

  it('ne persiste pas une habilitation vide', () => {
    expect(estAccordee(EMPTY_PERMISSION('m1'))).toBe(false);
    expect(estAccordee(permissionAccordee)).toBe(true);
  });

  it('n’écrit que les différences', () => {
    const existant: PermissionMap = { m1: permissionAccordee, m2: { ...EMPTY_PERMISSION('m2'), can_view: true } };
    const souhaite: PermissionMap = {
      m1: permissionAccordee,
      m2: EMPTY_PERMISSION('m2'),
      m3: { ...EMPTY_PERMISSION('m3'), can_view: true },
    };

    // L'enregistrement supprimait tout puis réinsérait : un échec laissait l'utilisateur
    // sans le moindre droit.
    expect(planifier(existant, souhaite)).toEqual({
      aCreer: ['m3'],
      aMettreAJour: [],
      aRevoquer: ['m2'],
    });
  });
});

describe('regroupement des modules', () => {
  it('déduit les catégories du référentiel', () => {
    // Les cinq catégories étaient codées en dur (« Batches Management »…).
    const groupes = grouperParCategorie(modules);
    expect(groupes.map((groupe) => groupe.categorie)).toEqual(['Autres modules', 'Ventes']);
    expect(groupes[1].modules).toHaveLength(2);
  });

  it('compte les modules réellement ouverts', () => {
    expect(compterAccordees({ m1: permissionAccordee, m2: EMPTY_PERMISSION('m2') })).toBe(1);
  });
});

describe('UserPermissionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params.userId = 'u1';
    mocks.profil = { id: 'u1', email: 'awa@sonasp.bf', full_name: 'Awa KABORE', role: 'factory', is_active: true };
    mocks.profilErreur = null;
    mocks.confirmer.mockResolvedValue(true);
    mocks.listModules.mockResolvedValue({ modules });
    mocks.load.mockResolvedValue({ permissions: { m1: permissionAccordee } });
    mocks.save.mockResolvedValue({ success: true });
  });

  it('présente les modules groupés et les droits en français', async () => {
    render(<UserPermissionsPage />);
    await waitFor(() => expect(screen.getByText('Consultation des ventes')).toBeInTheDocument());

    expect(screen.getByRole('heading', { name: 'Ventes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Autres modules' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Approuver' }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Consulter — Consultation des ventes')).toBeChecked();
    expect(screen.queryByText('User Permissions')).not.toBeInTheDocument();
  });

  it('impose la consultation aux autres droits', async () => {
    render(<UserPermissionsPage />);
    await waitFor(() => expect(screen.getByText('Création de ventes')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Créer — Création de ventes'));
    expect(screen.getByLabelText('Consulter — Création de ventes')).toBeChecked();

    // Retirer la consultation retire les droits qui en dépendent.
    fireEvent.click(screen.getByLabelText('Consulter — Création de ventes'));
    expect(screen.getByLabelText('Créer — Création de ventes')).not.toBeChecked();
  });

  it('confirme avant d’appliquer et annonce les retraits', async () => {
    render(<UserPermissionsPage />);
    await waitFor(() => expect(screen.getByText('Consultation des ventes')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Consulter — Consultation des ventes'));
    fireEvent.click(screen.getByRole('button', { name: /Appliquer les habilitations/ }));

    await waitFor(() => expect(mocks.confirmer).toHaveBeenCalled());
    expect(mocks.confirmer.mock.calls[0][0]).toMatchObject({ severity: 'danger' });
    expect(mocks.confirmer.mock.calls[0][0].message).toMatch(/1 habilitation\(s\) seront retirées/);
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
  });

  it('désactive l’enregistrement quand l’état de départ est inconnu', async () => {
    mocks.load.mockResolvedValue({ permissions: {}, error: 'lecture refusée' });
    render(<UserPermissionsPage />);

    // Un écran vide issu d'une lecture en échec aurait révoqué tous les droits.
    await waitFor(() => expect(screen.getByText('lecture refusée')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Appliquer les habilitations/ })).toBeDisabled();
    expect(screen.getByText(/l’enregistrement est\s+désactivé/)).toBeInTheDocument();
  });

  it('n’enregistre rien tant que rien n’a changé', async () => {
    render(<UserPermissionsPage />);
    await waitFor(() => expect(screen.getByText('Consultation des ventes')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Appliquer les habilitations/ })).toBeDisabled();
  });

  it('restitue un échec d’enregistrement', async () => {
    mocks.save.mockResolvedValue({ success: false, error: 'écriture refusée' });
    render(<UserPermissionsPage />);
    await waitFor(() => expect(screen.getByText('Consultation des ventes')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Supprimer — Consultation des ventes'));
    fireEvent.click(screen.getByRole('button', { name: /Appliquer les habilitations/ }));

    await waitFor(() => expect(mocks.showError).toHaveBeenCalledWith('Enregistrement impossible', 'écriture refusée'));
  });

  it('compte les droits sensibles', async () => {
    mocks.load.mockResolvedValue({
      permissions: {
        m1: { ...EMPTY_PERMISSION('m1'), can_view: true, can_delete: true },
        m2: { ...EMPTY_PERMISSION('m2'), can_view: true, can_approve: true },
      },
    });

    render(<UserPermissionsPage />);
    await waitFor(() => expect(screen.getByText('Consultation des ventes')).toBeInTheDocument());

    const indicateurs = within(screen.getByRole('region', { name: 'Portée des habilitations' }));
    expect(within(indicateurs.getByText('Droits de suppression').closest('article') as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(indicateurs.getByText('Droits d’approbation').closest('article') as HTMLElement).getByText('1')).toBeInTheDocument();
  });
});
