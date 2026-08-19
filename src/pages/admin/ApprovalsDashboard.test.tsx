import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApprovalsDashboard,
  compterParStatut,
  filtrerDemandes,
  type ApprovalRequest,
} from './ApprovalsDashboard';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  reponses: {} as Record<string, unknown[] | null>,
  filtresEnvoyes: [] as string[],
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/approval/ApprovalRequestCard', () => ({
  ApprovalRequestCard: ({ approval }: { approval: ApprovalRequest }) => <div>Demande {approval.id}</div>,
}));

vi.mock('@/components/approval/SalesApprovalCard', () => ({
  SalesApprovalCard: ({ approval }: { approval: ApprovalRequest }) => <div>Vente {approval.id}</div>,
}));

vi.mock('@/components/sales/SalesApprovalWorkflowPanel', () => ({
  SalesApprovalWorkflowPanel: ({ currentStatus }: { currentStatus: string }) => (
    <div>Circuit : {currentStatus}</div>
  ),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

function stub(table: string) {
  const rows = mocks.reponses[table];
  const resultat = rows === null ? { data: null, error: { message: 'accès refusé' } } : { data: rows || [], error: null };
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.eq = vi.fn((colonne: string, valeur: string) => {
    if (colonne === 'status') mocks.filtresEnvoyes.push(valeur);
    return builder;
  });
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: (rows || [])[0] ?? null, error: null }));
  builder.then = (resolve: (value: typeof resultat) => unknown) => Promise.resolve(resultat).then(resolve);
  return builder;
}

const demandes: ApprovalRequest[] = [
  { id: 'a1', status: 'pending', approval_type: 'sale', entity_id: 'v1', requested_at: '2026-08-10' },
  { id: 'a2', status: 'approved', approval_type: 'production', entity_id: 'p1', requested_at: '2026-08-09' },
  { id: 'a3', status: 'rejected', approval_type: 'production', entity_id: 'p2', requested_at: '2026-08-08' },
  { id: 'a4', status: 'pending', approval_type: 'production', entity_id: 'p3', requested_at: '2026-08-07' },
];

describe('décomptes des approbations', () => {
  it('compte chaque état sur l’ensemble des demandes', () => {
    expect(compterParStatut(demandes)).toEqual({ pending: 2, approved: 1, rejected: 1 });
    expect(compterParStatut([])).toEqual({ pending: 0, approved: 0, rejected: 0 });
  });

  it('n’applique le filtre qu’à l’affichage', () => {
    expect(filtrerDemandes(demandes, 'pending')).toHaveLength(2);
    expect(filtrerDemandes(demandes, 'all')).toHaveLength(4);
  });
});

describe('ApprovalsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.filtresEnvoyes = [];
    mocks.reponses = { approval_requests: demandes, sales: [{ status: 'pending_approval' }] };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  it('affiche des compteurs justes malgré le filtre actif', async () => {
    render(<ApprovalsDashboard />);
    await waitFor(() => expect(screen.getByText('Vente a1')).toBeInTheDocument());

    // Les compteurs étaient calculés sur la liste déjà filtrée : « Approuvées » et
    // « Rejetées » affichaient toujours zéro tant que le filtre « en attente » tenait.
    const indicateurs = within(screen.getByRole('region', { name: 'État des demandes' }));
    expect(within(indicateurs.getByText('En attente').closest('article') as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(within(indicateurs.getByText('Approuvées').closest('article') as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(indicateurs.getByText('Rejetées').closest('article') as HTMLElement).getByText('1')).toBeInTheDocument();

    // Aucun filtre d'état n'est poussé à la base : tout est chargé puis filtré à l'écran.
    expect(mocks.filtresEnvoyes).not.toContain('pending');
  });

  it('bascule l’affichage sans relancer de requête', async () => {
    render(<ApprovalsDashboard />);
    await waitFor(() => expect(screen.getByText('Vente a1')).toBeInTheDocument());
    const appelsInitiaux = mocks.from.mock.calls.length;

    fireEvent.click(screen.getByRole('radio', { name: 'Approuvées' }));

    expect(screen.queryByText('Vente a1')).not.toBeInTheDocument();
    expect(screen.getByText('Demande a2')).toBeInTheDocument();
    expect(mocks.from.mock.calls.length).toBe(appelsInitiaux);
  });

  it('affiche le circuit de validation de la première vente en attente', async () => {
    render(<ApprovalsDashboard />);
    await waitFor(() => expect(screen.getByText('Circuit : pending_approval')).toBeInTheDocument());
  });

  it('signale un échec de chargement', async () => {
    mocks.reponses.approval_requests = null;
    render(<ApprovalsDashboard />);

    await waitFor(() => expect(screen.getByText('accès refusé')).toBeInTheDocument());
    expect(screen.getByText('Aucune demande en attente')).toBeInTheDocument();
  });
});
