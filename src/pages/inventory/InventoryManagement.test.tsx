import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STOCK_VIDE } from './inventoryOverviewData';

const mocks = vi.hoisted(() => ({
  chargerStockNational: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: mocks.useAuth }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/sn', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
  Note: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  Section: ({ title, children }: { title: string; children: ReactNode }) => <section><h2>{title}</h2>{children}</section>,
}));
vi.mock('./inventoryOverviewData', async (importOriginal) => {
  const original = await importOriginal<typeof import('./inventoryOverviewData')>();
  return { ...original, chargerStockNational: mocks.chargerStockNational };
});

import { InventoryManagement } from './InventoryManagement';

describe('InventoryManagement pour une société minière', () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({ user: { mining_company_id: 'mine-sopamib' } });
    mocks.chargerStockNational.mockResolvedValue({
      ...STOCK_VIDE,
      totalOz: 150,
      disponibleOz: 125.5,
      parMine: [{ id: 'mine-sopamib', nom: 'SOPAMIB', totalOz: 150, disponibleOz: 125.5, allloueOz: 24.5, venduOz: 0, lignes: 1 }],
      historique: [{
        id: 'stock-1',
        poste: 'disponible',
        date: '2026-08-20',
        reference: 'CERT-SOP-001',
        quantiteOz: 125.5,
        libelle: 'Stock mobilisable',
        detail: 'Coffre principal',
      }],
      tendance: [
        { cle: '2026-07', libelle: 'juil', valeurOz: 25 },
        { cle: '2026-08', libelle: 'août', valeurOz: 125 },
      ],
    });
  });

  it('masque l’origine redondante et ouvre le détail réel d’un poste', async () => {
    render(<MemoryRouter><InventoryManagement /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('SOPAMIB')).toBeInTheDocument());
    expect(screen.queryByText('Origine de la matière')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Voir l’historique : Disponible à la vente/i }));
    expect(screen.getByRole('dialog', { name: 'Disponible à la vente' })).toBeInTheDocument();
    expect(screen.getByText('CERT-SOP-001')).toBeInTheDocument();
  });
});
