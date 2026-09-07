import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import CollectorsPage from '@/pages/collector/CollectorsPage';
import ComptoirsPage from '@/pages/collector/ComptoirsPage';
import { emptyComptoir } from '@/lib/comptoirDossier';

const mocks = vi.hoisted(() => ({ user: {} as Record<string, unknown>, collectors: vi.fn(), comptoirs: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/services/collectorService', () => ({ collectorService: { list: mocks.collectors } }));
vi.mock('@/services/comptoirService', () => ({ comptoirService: { list: mocks.comptoirs } }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const cases = ['collecteurs', 'comptoirs'] as const;
type Kind = typeof cases[number];
const list = (kind: Kind) => kind === 'collecteurs' ? mocks.collectors : mocks.comptoirs;
const view = (kind: Kind) => <MemoryRouter initialEntries={[`/artisan-minier/${kind}`]}>{kind === 'collecteurs' ? <CollectorsPage /> : <ComptoirsPage />}</MemoryRouter>;
const rows = (kind: Kind, scope: string) => kind === 'collecteurs' ? [{
  id: `collector-${scope}`, identity: { nom: `COLLECTEUR PÉRIMÈTRE ${scope}`, prenoms: '', telephone: '', type_personne: 'physique' },
  organization_id: `org-${scope}`, organization_name: `Organisme ${scope}`, organization_type: 'comptoir', site_ids: [],
  version: 1, payment_authorized_until: null, account_user_id: null,
}] : [{ id: `comptoir-${scope}`, name: `COMPTOIR PÉRIMÈTRE ${scope}`, code: `CPT-${scope}`, documents: [], values: emptyComptoir() }];
const name = (kind: Kind, scope: string) => `${kind === 'collecteurs' ? 'COLLECTEUR' : 'COMPTOIR'} PÉRIMÈTRE ${scope}`;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { id: 'meme-utilisateur', role: 'owner', is_active: true, organization_id: 'org-A', access_role_id: 'role-A' };
});

it.each(cases)('%s : masque les lignes du précédent organisme sans changement d’utilisateur ni navigation', async kind => {
  list(kind).mockResolvedValue(rows(kind, 'A'));
  const { rerender } = render(view(kind));
  await screen.findByText(name(kind, 'A'));
  list(kind).mockImplementation(() => new Promise(() => {}));
  mocks.user = { ...mocks.user, organization_id: 'org-B' };
  rerender(view(kind));
  expect(screen.queryByText(name(kind, 'A'))).not.toBeInTheDocument();
  expect(list(kind)).toHaveBeenCalledTimes(2);
});

it.each(cases)('%s : ignore une réponse de l’ancien rôle après une lecture du nouveau rôle', async kind => {
  let resolveOld!: (value: unknown) => void;
  list(kind).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const { rerender } = render(view(kind));
  mocks.user = { ...mocks.user, access_role_id: 'role-B' };
  list(kind).mockResolvedValue(rows(kind, 'B'));
  rerender(view(kind));
  await screen.findByText(name(kind, 'B'));
  await act(async () => resolveOld(rows(kind, 'A')));
  expect(screen.queryByText(name(kind, 'A'))).not.toBeInTheDocument();
  expect(screen.getByText(name(kind, 'B'))).toBeInTheDocument();
});
