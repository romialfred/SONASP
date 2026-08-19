import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RefineryForm,
  EMPTY_REFINERY_FORM,
  buildRefineryPayload,
  validateRefinery,
} from './RefineryForm';
import {
  TransportCompanyForm,
  EMPTY_TRANSPORT_FORM,
  buildTransportPayload,
  validateTransport,
} from './TransportCompanyForm';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: {} as { id?: string },
  from: vi.fn(),
  succes: vi.fn(),
  erreur: vi.fn(),
  reponses: {} as Record<string, unknown[] | null>,
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({ success: mocks.succes, error: mocks.erreur }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

function stub(table: string) {
  const rows = mocks.reponses[table];
  const enEchec = rows === null;
  const resultat = enEchec ? { data: null, error: { message: 'écriture refusée' } } : { data: rows || [], error: null };
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve(enEchec ? { data: null, error: { message: 'écriture refusée' } } : { data: (rows || [])[0] ?? null, error: null })
  );
  builder.insert = vi.fn((valeurs: Record<string, unknown>[]) => {
    mocks.inserts.push(valeurs[0]);
    return builder;
  });
  builder.update = vi.fn((valeurs: Record<string, unknown>) => {
    mocks.updates.push(valeurs);
    return builder;
  });
  builder.then = (resolve: (value: typeof resultat) => unknown) => Promise.resolve(resultat).then(resolve);
  return builder;
}

const raffinerieValide = {
  ...EMPTY_REFINERY_FORM,
  name: 'Metalor',
  location: 'Neuchâtel',
  country: 'Switzerland',
  contact_person: 'Jean DUPONT',
  email: 'contact@metalor.ch',
  phone: '+41 32 000 00 00',
};

const transporteurValide = {
  ...EMPTY_TRANSPORT_FORM,
  name: 'Brinks Burkina',
  contact_person: 'Awa SAWADOGO',
  email: 'ops@brinks.bf',
  phone: '+226 25 00 00 00',
};

describe('validation des référentiels', () => {
  it('exige les mentions obligatoires d’une raffinerie', () => {
    expect(validateRefinery(EMPTY_REFINERY_FORM)).toBe('Le nom de l’établissement est obligatoire.');
    expect(validateRefinery({ ...raffinerieValide, email: 'pas-un-mail' })).toBe('L’adresse e-mail est invalide.');
    expect(validateRefinery({ ...raffinerieValide, capacity_grams_per_month: '-5' })).toBe(
      'La capacité mensuelle doit être un nombre positif.'
    );
    expect(validateRefinery(raffinerieValide)).toBeNull();
  });

  it('exige les mentions obligatoires d’un transporteur', () => {
    expect(validateTransport(EMPTY_TRANSPORT_FORM)).toBe('La raison sociale est obligatoire.');
    expect(validateTransport({ ...transporteurValide, phone: '' })).toBe('Le numéro de téléphone est obligatoire.');
    expect(validateTransport(transporteurValide)).toBeNull();
  });

  it('normalise les valeurs enregistrées', () => {
    const payload = buildRefineryPayload({ ...raffinerieValide, name: '  Metalor  ', capacity_grams_per_month: '' });
    expect(payload.name).toBe('Metalor');
    expect(payload.capacity_grams_per_month).toBeNull();

    expect(buildTransportPayload({ ...transporteurValide, address: '  ' }).address).toBeNull();
  });
});

describe('RefineryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = {};
    mocks.inserts = [];
    mocks.updates = [];
    mocks.reponses = { refineries: [] };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  const remplir = () => {
    fireEvent.change(screen.getByLabelText(/Nom de l’établissement/), { target: { value: 'Metalor' } });
    fireEvent.change(screen.getByLabelText(/^Ville/), { target: { value: 'Neuchâtel' } });
    fireEvent.change(screen.getByLabelText(/^Pays/), { target: { value: 'Switzerland' } });
    fireEvent.change(screen.getByLabelText(/Nom du contact/), { target: { value: 'Jean DUPONT' } });
    fireEvent.change(screen.getByLabelText(/Adresse e-mail/), { target: { value: 'contact@metalor.ch' } });
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '+41 32 000 00 00' } });
  };

  it('bloque l’enregistrement tant que la fiche est incomplète', () => {
    render(<RefineryForm />);

    const submit = screen.getByRole('button', { name: /Enregistrer la raffinerie/ });
    expect(submit).toBeDisabled();
    expect(screen.getByText('Le nom de l’établissement est obligatoire.')).toBeInTheDocument();

    remplir();
    expect(submit).not.toBeDisabled();
  });

  it('enregistre une nouvelle raffinerie en français', async () => {
    render(<RefineryForm />);
    remplir();
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer la raffinerie/ }));

    await waitFor(() => expect(mocks.inserts).toHaveLength(1));
    expect(mocks.inserts[0]).toMatchObject({ name: 'Metalor', country: 'Switzerland', is_active: true });
    expect(mocks.succes).toHaveBeenCalledWith('Raffinerie enregistrée');
    expect(screen.queryByText('New Refinery Plant')).not.toBeInTheDocument();
  });

  it('annonce une fiche introuvable au lieu d’un formulaire vide enregistrable', async () => {
    mocks.params = { id: 'inconnu' };
    render(<RefineryForm />);

    // `single()` levait une exception et laissait un formulaire vide visant une ligne absente.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Raffinerie introuvable' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Mettre à jour/ })).not.toBeInTheDocument();
  });

  it('restitue l’erreur d’écriture', async () => {
    mocks.reponses.refineries = null;
    render(<RefineryForm />);
    remplir();
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer la raffinerie/ }));

    await waitFor(() => expect(screen.getByText('écriture refusée')).toBeInTheDocument());
    expect(mocks.erreur).toHaveBeenCalledWith('écriture refusée');
  });
});

describe('TransportCompanyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = {};
    mocks.inserts = [];
    mocks.updates = [];
    mocks.reponses = { transport_companies: [] };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  const remplir = () => {
    fireEvent.change(screen.getByLabelText(/Raison sociale/), { target: { value: 'Brinks Burkina' } });
    fireEvent.change(screen.getByLabelText(/Nom du contact/), { target: { value: 'Awa SAWADOGO' } });
    fireEvent.change(screen.getByLabelText(/Adresse e-mail/), { target: { value: 'ops@brinks.bf' } });
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '+226 25 00 00 00' } });
  };

  it('propose les trois segments en français', () => {
    render(<TransportCompanyForm />);

    expect(screen.getByRole('radio', { name: /Mine → aéroport/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Chaîne complète/ })).toBeInTheDocument();
    expect(screen.queryByText('Both Routes')).not.toBeInTheDocument();
  });

  it('enregistre le segment retenu', async () => {
    render(<TransportCompanyForm />);
    remplir();
    fireEvent.click(screen.getByRole('radio', { name: /Mine → aéroport/ }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le transporteur/ }));

    await waitFor(() => expect(mocks.inserts).toHaveLength(1));
    expect(mocks.inserts[0]).toMatchObject({ name: 'Brinks Burkina', company_type: 'mine_to_airport' });
  });

  it('met à jour une fiche existante', async () => {
    mocks.params = { id: 't1' };
    mocks.reponses.transport_companies = [
      {
        id: 't1',
        name: 'Convoyage Sahel',
        email: 'ops@sahel.bf',
        phone: '+226 25 11 11 11',
        company_type: 'airport_to_refinery',
        address: null,
        contact_person: 'Ali TRAORE',
        is_active: false,
      },
    ];

    render(<TransportCompanyForm />);
    await waitFor(() => expect(screen.getByLabelText(/Raison sociale/)).toHaveValue('Convoyage Sahel'));

    expect(screen.getByRole('radio', { name: /Aéroport → raffinerie/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Mettre à jour/ }));

    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0]).toMatchObject({ name: 'Convoyage Sahel', is_active: false });
  });
});
