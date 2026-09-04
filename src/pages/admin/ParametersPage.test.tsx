import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ParametersPage,
  FUSEAUX,
  grouperRegles,
  valeurRegle,
  type BusinessRule,
} from './ParametersPage';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  updateUser: vi.fn(),
  refreshProfile: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  confirmer: vi.fn(),
  reponses: {} as Record<string, unknown[] | null>,
  updates: [] as Array<{ table: string; valeurs: Record<string, unknown> }>,
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

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'moi',
      email_notifications: true,
      batch_notifications: false,
      approval_notifications: true,
    },
    refreshProfile: mocks.refreshProfile,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, auth: { updateUser: mocks.updateUser } },
}));

function stub(table: string) {
  const rows = mocks.reponses[table];
  const enEchec = rows === null;
  const resultat = enEchec ? { data: null, error: { message: 'accès refusé' } } : { data: rows || [], error: null };
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve(enEchec ? { data: null, error: { message: 'accès refusé' } } : { data: (rows || [])[0] ?? null, error: null })
  );
  builder.update = vi.fn((valeurs: Record<string, unknown>) => {
    mocks.updates.push({ table, valeurs });
    return builder;
  });
  builder.then = (resolve: (value: typeof resultat) => unknown) => Promise.resolve(resultat).then(resolve);
  return builder;
}

const regles = [
  {
    id: 'r1',
    rule_key: 'troy_ounce_grams',
    rule_name: 'Once troy en grammes',
    rule_value: 31.1035,
    rule_category: 'conversion',
    description: 'Masse d’une once troy',
    unit: 'g',
    updated_at: '2026-01-01',
  },
  {
    id: 'r2',
    rule_key: 'weight_variance_pct',
    rule_name: 'Tolérance de pesée',
    rule_value: 2,
    rule_category: 'variance',
    description: null,
    unit: '%',
    updated_at: '2026-01-01',
  },
] as BusinessRule[];

describe('règles métier', () => {
  it('regroupe par catégorie du référentiel', () => {
    const groupes = grouperRegles(regles);
    expect(groupes.map((groupe) => groupe.categorie)).toEqual(['conversion', 'variance']);
    expect(grouperRegles([{ ...regles[0], rule_category: '' }])[0].categorie).toBe('Autres règles');
  });

  it('accepte zéro comme valeur légitime', () => {
    // `||` renvoyait l'ancienne valeur : une règle ramenée à 0 revenait aussitôt.
    expect(valeurRegle({ weight_variance_pct: 0 }, regles[1])).toBe(0);
    expect(valeurRegle({}, regles[1])).toBe(2);
  });

  it('propose Ouagadougou parmi les fuseaux', () => {
    // La liste offrait UTC, Abidjan, Conakry et Bamako sur une plateforme burkinabè.
    expect(FUSEAUX.map((fuseau) => fuseau.value)).toContain('Africa/Ouagadougou');
  });
});

describe('ParametersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updates = [];
    mocks.confirmer.mockResolvedValue(true);
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.reponses = {
      user_profiles: [
        { id: 'moi', language_preference: 'fr', timezone: 'Africa/Ouagadougou', email: 'moi@sonasp.bf', full_name: 'Moi', role: 'admin', two_factor_enabled: false, is_active: true },
      ],
      business_rules: regles,
    };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  it('enregistre réellement les préférences d’affichage', async () => {
    render(<ParametersPage />);
    await waitFor(() => expect(screen.getByLabelText('Fuseau horaire')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Fuseau horaire'), { target: { value: 'Africa/Niamey' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer mes préférences/ }));

    // Les listes n'avaient ni valeur ni gestionnaire, et le bouton aucun `onClick`.
    await waitFor(() =>
      expect(mocks.updates).toContainEqual({
        table: 'user_profiles',
        valeurs: { language_preference: 'fr', timezone: 'Africa/Niamey' },
      })
    );
    expect(mocks.showSuccess).toHaveBeenCalledWith('Préférences enregistrées', expect.any(String));
  });

  it('ne promet pas de réglage de devise ni d’unité', async () => {
    render(<ParametersPage />);
    await waitFor(() => expect(screen.getByLabelText('Fuseau horaire')).toBeInTheDocument());

    expect(screen.queryByLabelText(/Devise/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Unité de poids/)).not.toBeInTheDocument();
    expect(screen.getByText(/unités non paramétrables/)).toBeInTheDocument();
  });

  it('reflète et persiste les préférences de notification', async () => {
    render(<ParametersPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Notifications/ }));

    // Les interrupteurs étaient figés sur « activé » avec un gestionnaire vide.
    const suiviLots = await screen.findByRole('switch', { name: 'Suivi des lots' });
    expect(suiviLots).not.toBeChecked();

    fireEvent.click(suiviLots);

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({
        data: { email_notifications: true, batch_notifications: true, approval_notifications: true },
      })
    );
  });

  it('n’enregistre les règles que si elles ont changé', async () => {
    render(<ParametersPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Règles métier/ }));
    await waitFor(() => expect(screen.getByLabelText('Tolérance de pesée')).toBeInTheDocument());

    const bouton = screen.getByRole('button', { name: /Enregistrer les règles/ });
    expect(bouton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Tolérance de pesée'), { target: { value: '0' } });
    expect(screen.getByLabelText('Tolérance de pesée')).toHaveValue(0);
    expect(bouton).not.toBeDisabled();

    fireEvent.click(bouton);
    await waitFor(() =>
      expect(mocks.updates).toContainEqual({ table: 'business_rules', valeurs: { rule_value: 0 } })
    );
  });

  it('présente la double authentification comme une obligation non désactivable', async () => {
    render(<ParametersPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Double authentification/ }));
    await waitFor(() => expect(screen.getByText('Moi')).toBeInTheDocument());

    const tableau = within(screen.getByRole('table'));
    expect(tableau.getByText('Administrateur')).toBeInTheDocument();

    expect(tableau.getByText('Enrôlement requis')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Double authentification pour Moi/ })).not.toBeInTheDocument();
    expect(mocks.updates).not.toContainEqual({ table: 'user_profiles', valeurs: { two_factor_enabled: true } });
  });

  it('signale un échec de chargement des règles', async () => {
    mocks.reponses.business_rules = null;
    render(<ParametersPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Règles métier/ }));

    // Le message PostgREST brut n'est plus divulgué : un repli propre est affiché.
    await waitFor(() => expect(screen.getByText('Impossible de charger les règles métier.')).toBeInTheDocument());
    expect(screen.getByText('Aucune règle métier')).toBeInTheDocument();
  });
});
