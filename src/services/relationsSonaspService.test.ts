import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contratsService } from './contratsService';
import { requisitionsService } from './requisitionsService';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  inserted: [] as unknown[],
  filters: [] as Array<[string, unknown]>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
    auth: { getUser: mocks.getUser },
  },
}));

describe('relations Mine avec la SONASP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inserted = [];
    mocks.filters = [];
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'mine-user-1' } } });
    mocks.rpc.mockResolvedValue({ data: { id: 'req-1', statut: 'accusee' }, error: null });
    mocks.from.mockImplementation(() => {
      const query: Record<string, unknown> = {};
      query.insert = vi.fn((payload: unknown) => {
        mocks.inserted.push(payload);
        return query;
      });
      query.select = vi.fn(() => query);
      query.eq = vi.fn((column: string, value: unknown) => {
        mocks.filters.push([column, value]);
        return query;
      });
      query.maybeSingle = vi.fn(async () => ({ data: { id: 'resource-1' }, error: null }));
      query.single = vi.fn(async () => ({ data: { id: 'ctr-1', statut: 'soumis' }, error: null }));
      return query;
    });
  });

  it('transmet la réponse commentée de la mine par la RPC sécurisée', async () => {
    await requisitionsService.repondreMine('req-1', 'approuver', '  Accord après vérification  ');

    expect(mocks.rpc).toHaveBeenCalledWith('snp_portail_mine_repondre_requisition', {
      p_requisition_id: 'req-1',
      p_decision: 'approuver',
      p_commentaire: 'Accord après vérification',
    });
  });

  it('refuse une réponse insuffisamment motivée avant tout appel réseau', async () => {
    await expect(requisitionsService.repondreMine('req-1', 'contester', 'non'))
      .rejects.toThrow('au moins 5 caractères');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('ajoute le tenant autoritatif à la lecture d’une réquisition', async () => {
    await requisitionsService.requisition('req-1', 'mine-1');

    expect(mocks.from).toHaveBeenCalledWith('snp_requisitions');
    expect(mocks.filters).toEqual([
      ['id', 'req-1'],
      ['mining_company_id', 'mine-1'],
    ]);
  });

  it('ajoute le tenant autoritatif à la lecture d’un contrat', async () => {
    await contratsService.contrat('ctr-1', 'mine-1');

    expect(mocks.from).toHaveBeenCalledWith('snp_contrats');
    expect(mocks.filters).toEqual([
      ['id', 'ctr-1'],
      ['mining_company_id', 'mine-1'],
    ]);
  });

  it('force une proposition de contrat au statut soumis et à l’auteur connecté', async () => {
    await contratsService.proposerMine({
      intitule: 'Contrat de fourniture',
      numero_contrat: 'CTR-MINE-2026-001',
      partenaire_type: 'mine_industrielle',
      date_debut: '2026-09-01',
      date_fin: '2027-08-31',
      statut: 'brouillon',
      created_by: 'identité-usurpée',
    });

    expect(mocks.from).toHaveBeenCalledWith('snp_contrats');
    expect(mocks.inserted).toEqual([expect.objectContaining({
      intitule: 'Contrat de fourniture',
      statut: 'soumis',
      created_by: 'mine-user-1',
      updated_by: 'mine-user-1',
    })]);
  });

  it('refuse une proposition si la session a expiré', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    await expect(contratsService.proposerMine({
      intitule: 'Sans session',
      numero_contrat: 'CTR-MINE-2026-002',
      partenaire_type: 'mine_industrielle',
      date_debut: '2026-09-01',
      date_fin: '2027-08-31',
    }))
      .rejects.toThrow('Votre session a expiré');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
