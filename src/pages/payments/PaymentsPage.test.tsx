import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PaymentsPage,
  categoriePaiement,
  cumulsPaiements,
  echeance,
  formatDate,
  joursAvantEcheance,
  libelleEcheance,
  montant,
  type Paiement,
} from './PaymentsPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  from: vi.fn(),
  reponses: {} as Record<string, unknown[]>,
  echec: null as { message: string } | null,
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
  const resultat = mocks.echec
    ? { data: null, error: mocks.echec }
    : { data: mocks.reponses[table] || [], error: null };
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.in = vi.fn(() => Promise.resolve(resultat));
  builder.order = vi.fn(() => Promise.resolve(resultat));
  return builder;
}

const AUJOURDHUI = new Date('2026-08-19T10:00:00Z');

describe('montant', () => {
  it('écrit en français et conserve la devise', () => {
    // L'écran formatait en `en-US` et forçait le symbole « $ ».
    expect(montant(1_109_451, 'USD')).toBe('1 109 451 USD');
    expect(montant(0, 'XOF')).toBe('0 XOF');
  });
});

describe('formatDate', () => {
  it('rend une date française et supporte l’absence', () => {
    expect(formatDate('2026-01-13')).toMatch(/13 janv\.? 2026/);
    expect(formatDate(null)).toBe('—');
    expect(formatDate('pas une date')).toBe('—');
  });
});

describe('echeance', () => {
  it('ajoute trente jours à la date attendue', () => {
    expect(echeance('2025-12-14')).toBe('2026-01-13');
    expect(echeance(null)).toBeNull();
  });
});

describe('joursAvantEcheance', () => {
  it('compte les jours restants, négatifs au-delà', () => {
    expect(joursAvantEcheance('2026-08-25', AUJOURDHUI)).toBe(6);
    expect(joursAvantEcheance('2026-08-19', AUJOURDHUI)).toBe(0);
    expect(joursAvantEcheance('2026-01-13', AUJOURDHUI)).toBe(-218);
    expect(joursAvantEcheance(null, AUJOURDHUI)).toBeNull();
  });
});

describe('libelleEcheance', () => {
  it('accorde le pluriel et distingue le jour même', () => {
    expect(libelleEcheance(-218)).toBe('218 jours de retard');
    expect(libelleEcheance(-1)).toBe('1 jour de retard');
    expect(libelleEcheance(0)).toBe('Échoit aujourd’hui');
    expect(libelleEcheance(1)).toBe('1 jour');
    expect(libelleEcheance(null)).toBe('—');
  });
});

describe('categoriePaiement', () => {
  it('classe selon le statut puis l’échéance', () => {
    expect(categoriePaiement('approved', '2026-01-13', AUJOURDHUI)).toBe('paye');
    expect(categoriePaiement('rejected', null, AUJOURDHUI)).toBe('rejete');
    expect(categoriePaiement('pending', '2026-01-13', AUJOURDHUI)).toBe('en_retard');
    expect(categoriePaiement('pending', '2026-12-31', AUJOURDHUI)).toBe('en_attente');
    expect(categoriePaiement('pending', null, AUJOURDHUI)).toBe('en_attente');
    expect(categoriePaiement('draft', null, AUJOURDHUI)).toBe('inconnu');
  });
});

const ligne = (partiel: Partial<Paiement>): Paiement =>
  ({
    id: 'p1',
    sale_id: 's1',
    invoice_number: 'INV-1',
    expected_date: '2025-12-14',
    due_date: '2026-01-13',
    amount: 1000,
    currency: 'USD',
    payment_method: 'Virement bancaire',
    sale_number: 'SL-2025-003',
    client: 'Comptoir A',
    categorie: 'en_attente',
    created_at: '2025-12-14',
    ...partiel,
  }) as Paiement;

describe('cumulsPaiements', () => {
  it('additionne par catégorie quand la devise est unique', () => {
    const cumuls = cumulsPaiements([
      ligne({ id: '1', amount: 300, categorie: 'paye' }),
      ligne({ id: '2', amount: 200, categorie: 'en_attente' }),
      ligne({ id: '3', amount: 500, categorie: 'en_retard' }),
    ]);
    expect(cumuls.deviseUnique).toBe('USD');
    expect(cumuls.total).toBe(1000);
    expect(cumuls.paye).toBe(300);
    expect(cumuls.enAttente).toBe(200);
    expect(cumuls.nombreEnRetard).toBe(1);
  });

  it('refuse d’additionner des devises différentes', () => {
    // L'écran totalisait indistinctement des montants de devises différentes.
    const cumuls = cumulsPaiements([
      ligne({ id: '1', amount: 300, currency: 'USD' }),
      ligne({ id: '2', amount: 200, currency: 'XOF' }),
    ]);
    expect(cumuls.deviseUnique).toBeNull();
  });
});

describe('PaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.echec = null;
    mocks.reponses = {
      payments: [
        {
          id: 'p1',
          sale_id: 's1',
          invoice_number: 'INV-20251214-C3231A4B',
          expected_date: '2025-12-14',
          amount: 1_109_451,
          currency: 'USD',
          status: 'pending',
          bank_name: 'Virement bancaire',
          created_at: '2025-12-14',
        },
        {
          id: 'p2',
          sale_id: 's2',
          invoice_number: 'INV-20251214-796F4077',
          expected_date: '2025-12-14',
          amount: 792_465,
          currency: 'USD',
          status: 'approved',
          bank_name: 'Virement bancaire',
          created_at: '2025-12-14',
        },
      ],
      sales: [
        { id: 's1', sale_number: 'SL-2025-003', customer_id: 'c1' },
        { id: 's2', sale_number: 'SL-2025-004', customer_id: 'c1' },
      ],
      customers: [{ id: 'c1', name: 'Comptoir de Ouagadougou' }],
    };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  it('affiche les règlements en français', async () => {
    render(<PaymentsPage />);

    expect(await screen.findByText('SL-2025-003')).toBeInTheDocument();
    expect(screen.getByText('INV-20251214-C3231A4B')).toBeInTheDocument();
    expect(screen.getAllByText('Comptoir de Ouagadougou')).toHaveLength(2);
    // Testing Library normalise les espaces : l'espace fine devient une espace simple.
    expect(screen.getByText('1 109 451 USD')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paiements clients' })).toBeInTheDocument();
  });

  it('rattache la vente et le client à chaque règlement', async () => {
    render(<PaymentsPage />);
    await screen.findByText('SL-2025-004');

    expect(mocks.from).toHaveBeenCalledWith('payments');
    expect(mocks.from).toHaveBeenCalledWith('sales');
    expect(mocks.from).toHaveBeenCalledWith('customers');
  });

  it('filtre sur le statut', async () => {
    render(<PaymentsPage />);
    await screen.findByText('SL-2025-003');

    fireEvent.change(screen.getByLabelText('Filtrer par statut'), { target: { value: 'paye' } });

    expect(screen.getByText('SL-2025-004')).toBeInTheDocument();
    expect(screen.queryByText('SL-2025-003')).not.toBeInTheDocument();
  });

  it('cherche sur la facture, la vente et le client', async () => {
    render(<PaymentsPage />);
    await screen.findByText('SL-2025-003');

    fireEvent.change(screen.getByLabelText('Rechercher un paiement'), { target: { value: '796F4077' } });

    expect(screen.getByText('SL-2025-004')).toBeInTheDocument();
    expect(screen.queryByText('SL-2025-003')).not.toBeInTheDocument();
  });

  it('ouvre le détail au clic sur une ligne', async () => {
    render(<PaymentsPage />);
    const ligneVente = (await screen.findByText('SL-2025-003')).closest('tr') as HTMLElement;

    fireEvent.click(ligneVente);
    expect(mocks.navigate).toHaveBeenCalledWith('/payments/p1');
  });

  it('n’expose aucun bouton d’export : ce n’est pas une page de rapport', async () => {
    render(<PaymentsPage />);
    await screen.findByText('SL-2025-003');

    expect(screen.queryByRole('button', { name: /Export/i })).not.toBeInTheDocument();
  });

  it('annonce l’échec de chargement', async () => {
    mocks.echec = { message: 'lecture refusée' };
    render(<PaymentsPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('lecture refusée'));
    expect(screen.getByText('Aucun paiement')).toBeInTheDocument();
  });

  it('signale un retard sur la colonne délai', async () => {
    render(<PaymentsPage />);
    const tableau = within((await screen.findByText('SL-2025-003')).closest('table') as HTMLElement);

    expect(tableau.getAllByText(/jours de retard/).length).toBeGreaterThan(0);
  });
});
