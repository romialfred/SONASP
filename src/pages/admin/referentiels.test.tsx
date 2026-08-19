import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefineriesPage, filterRefineries, formatCapacite, type Refinery } from './RefineriesPage';
import {
  TransportCompaniesPage,
  filterCompanies,
  typeTransport,
  type TransportCompany,
} from './TransportCompaniesPage';
import { errorMessage } from '@/lib/errorMessage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  from: vi.fn(),
  reponses: {} as Record<string, unknown[] | null>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

function stub(table: string) {
  const rows = mocks.reponses[table];
  const resultat = rows === null ? { data: null, error: { message: 'connexion refusée' } } : { data: rows || [], error: null };
  const builder: Record<string, unknown> = {};
  ['select', 'order', 'eq'].forEach((methode) => {
    builder[methode] = vi.fn(() => builder);
  });
  builder.then = (resolve: (value: typeof resultat) => unknown) => Promise.resolve(resultat).then(resolve);
  return builder;
}

const raffineries: Refinery[] = [
  {
    id: 'r1',
    name: 'Metalor Technologies',
    location: 'Neuchâtel',
    country: 'Suisse',
    email: 'contact@metalor.ch',
    phone: '+41 32 000 00 00',
    contact_person: 'Jean DUPONT',
    capacity_grams_per_month: 250_000,
    is_active: true,
    created_at: '2026-01-01',
  },
  {
    // Établissement dont les champs facultatifs sont vides : la recherche plantait dessus.
    id: 'r2',
    name: 'Raffinerie régionale',
    location: null,
    country: null,
    email: null,
    phone: null,
    contact_person: null,
    capacity_grams_per_month: null,
    is_active: false,
    created_at: '2026-02-01',
  },
];

const transporteurs: TransportCompany[] = [
  {
    id: 't1',
    name: 'Brinks Burkina',
    email: 'ops@brinks.bf',
    phone: '+226 25 00 00 00',
    company_type: 'both',
    address: 'Zone industrielle, Ouagadougou',
    contact_person: 'Awa SAWADOGO',
    is_active: true,
    created_at: '2026-01-01',
  },
  {
    id: 't2',
    name: 'Convoyage Sahel',
    email: null,
    phone: null,
    company_type: 'mine_to_airport',
    address: null,
    contact_person: null,
    is_active: false,
    created_at: '2026-02-01',
  },
];

describe('utilitaires des référentiels', () => {
  it('formate la capacité déclarée', () => {
    expect(formatCapacite(250_000)).toBe('250 kg/mois');
    expect(formatCapacite(null)).toBe('—');
    expect(formatCapacite(0)).toBe('—');
  });

  it('recherche sans planter sur les champs vides', () => {
    // `location.toLowerCase()` levait une exception sur un établissement incomplet.
    expect(() => filterRefineries(raffineries, 'suisse')).not.toThrow();
    expect(filterRefineries(raffineries, 'suisse')).toHaveLength(1);
    expect(filterRefineries(raffineries, 'régionale')).toHaveLength(1);
    expect(filterRefineries(raffineries, '')).toHaveLength(2);

    expect(() => filterCompanies(transporteurs, 'sahel')).not.toThrow();
    expect(filterCompanies(transporteurs, 'awa')).toHaveLength(1);
  });

  it('nomme les segments de transport en français', () => {
    expect(typeTransport('both')).toBe('Chaîne complète');
    expect(typeTransport('mine_to_airport')).toBe('Mine → aéroport');
    expect(typeTransport(null)).toBe('Type non défini');
  });

  it('restitue le message d’erreur réel', () => {
    // Les erreurs Supabase ne sont pas des instances d'Error : elles étaient masquées.
    expect(errorMessage({ message: 'permission denied' }, 'repli')).toBe('permission denied');
    expect(errorMessage(new Error('réseau'), 'repli')).toBe('réseau');
    expect(errorMessage(null, 'repli')).toBe('repli');
  });
});

describe('RefineriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reponses = { refineries: raffineries };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  it('liste les établissements en français', async () => {
    render(<RefineriesPage />);
    await waitFor(() => expect(screen.getByText('Metalor Technologies')).toBeInTheDocument());

    const tableau = within(screen.getByRole('table'));
    expect(tableau.getByText('250 kg/mois')).toBeInTheDocument();
    expect(tableau.getByText('Contact non renseigné')).toBeInTheDocument();
    expect(tableau.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Refinery Plants')).not.toBeInTheDocument();
  });

  it('distingue un référentiel vide d’une requête en échec', async () => {
    mocks.reponses.refineries = null;
    render(<RefineriesPage />);

    // Un échec de requête rendait un tableau vide, sans le moindre message.
    await waitFor(() => expect(screen.getByText('connexion refusée')).toBeInTheDocument());
    expect(screen.getByText('Aucune raffinerie')).toBeInTheDocument();
  });

  it('filtre sur la recherche saisie', async () => {
    render(<RefineriesPage />);
    await waitFor(() => expect(screen.getByText('Metalor Technologies')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'régionale' } });

    expect(screen.queryByText('Metalor Technologies')).not.toBeInTheDocument();
    expect(screen.getByText('Raffinerie régionale')).toBeInTheDocument();
  });
});

describe('TransportCompaniesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reponses = { transport_companies: transporteurs };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  it('liste les sociétés et leur segment', async () => {
    render(<TransportCompaniesPage />);
    await waitFor(() => expect(screen.getByText('Brinks Burkina')).toBeInTheDocument());

    const tableau = within(screen.getByRole('table'));
    expect(tableau.getByText('Chaîne complète')).toBeInTheDocument();
    expect(tableau.getByText('Mine → aéroport')).toBeInTheDocument();
    expect(tableau.getByText('Inactif')).toBeInTheDocument();
  });

  it('filtre sur le segment desservi', async () => {
    render(<TransportCompaniesPage />);
    await waitFor(() => expect(screen.getByText('Brinks Burkina')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Segment desservi'), { target: { value: 'mine_to_airport' } });

    expect(screen.queryByText('Brinks Burkina')).not.toBeInTheDocument();
    expect(screen.getByText('Convoyage Sahel')).toBeInTheDocument();
  });

  it('signale une requête en échec', async () => {
    mocks.reponses.transport_companies = null;
    render(<TransportCompaniesPage />);

    await waitFor(() => expect(screen.getByText('connexion refusée')).toBeInTheDocument());
    expect(screen.getByText('Aucun transporteur')).toBeInTheDocument();
  });
});
