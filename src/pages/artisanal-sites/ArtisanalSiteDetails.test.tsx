import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArtisanalSiteDetails from './ArtisanalSiteDetails';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';

const mocks = vi.hoisted(() => ({ status: 'planned', role: 'dgmg' }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ siteId: 'test' }), useLocation: () => ({ state: null }), Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role, is_active: true } }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useArtisanalSiteData', () => {
  let data: unknown;
  let previousStatus: string;
  return { useArtisanalSiteData: () => {
    if (!data || previousStatus !== mocks.status) {
      previousStatus = mocks.status;
      data = { sites: [{ ...DEMO_ARTISANAL_SITES[0], id: 'test', status: mocks.status, activeMiners: 80, authorizedMiners: 100, formalization: 'non_formalized', photos: [] }], productions: [], loading: false, error: null, refresh: vi.fn() };
    }
    return data;
  } };
});
vi.mock('@/services/siteAeaDocumentService', () => ({ siteAeaDocumentService: { url: vi.fn() } }));
vi.mock('@/services/sitePhotoService', () => ({ resolvePhotoUrl: vi.fn() }));
describe('Fiche du site et conformité', () => {
  beforeEach(() => { mocks.status = 'planned'; mocks.role = 'dgmg'; });
  it('explique pourquoi le site planifié n’est pas évalué et propose les quatre règles', () => {
    render(<ArtisanalSiteDetails />);
    fireEvent.click(screen.getByRole('tab', { name: 'Conformité' }));
    const panel = within(screen.getByRole('tabpanel', { name: 'Conformité' }));
    expect(panel.getByText('Non évalué')).toBeInTheDocument();
    expect(panel.getAllByText('Non appliqué')).toHaveLength(4);
    expect(panel.getByText(/L’évaluation démarre/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Modifier la fiche/ })).toHaveAttribute('href', '/artisan-sites/test/modifier');
  });
  it('affiche 70 points pour un site actif sans déclaration avec une occupation normale', () => {
    mocks.status = 'active'; render(<ArtisanalSiteDetails />);
    fireEvent.click(screen.getByRole('tab', { name: 'Conformité' }));
    const panel = within(screen.getByRole('tabpanel', { name: 'Conformité' }));
    expect(panel.getByText(/100 − 30 = 70 points/)).toBeInTheDocument();
    expect(panel.getByText('−30 pts')).toBeInTheDocument();
  });
  it('permet de naviguer au clavier entre les onglets sans donner la modification à la consultation', () => {
    mocks.role = 'management'; render(<ArtisanalSiteDetails />);
    const first = screen.getByRole('tab', { name: 'Vue d’ensemble' });
    first.focus(); fireEvent.keyDown(first, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Conformité' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Conformité' })).toBeVisible();
    expect(screen.queryByRole('link', { name: /Modifier la fiche/ })).not.toBeInTheDocument();
  });
});
