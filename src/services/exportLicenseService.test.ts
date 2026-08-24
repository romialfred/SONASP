import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportLicenseService,
  ExportLicenseWorkflowUnavailableError,
  isExportLicenseSelectable,
  normalizeExportLicenseQuota,
  type ExportLicense,
  type MineExportLicenseRequest,
} from './exportLicenseService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  filters: [] as Array<[string, string, unknown]>,
  licenses: [] as ExportLicense[],
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { getUser: vi.fn() },
  },
}));

const license = (overrides: Partial<ExportLicense> = {}): ExportLicense => ({
  id: 'license-1',
  license_number: 'EXP-SOPAMIB-2026-001',
  mining_company_id: 'mine-1',
  request_date: '2026-01-01',
  start_date: '2026-01-02',
  end_date: '2026-12-30',
  issuing_institution: 'Ministère chargé des Mines',
  authorized_quantity_grams: 5_000_000,
  used_quantity_grams: 0,
  remaining_quantity_grams: 5_000_000,
  average_sale_price: null,
  status: 'active',
  comments: null,
  notes: null,
  created_at: '2026-08-24T06:03:20Z',
  updated_at: '2026-08-24T06:03:20Z',
  created_by: null,
  updated_by: null,
  ...overrides,
});

const request = (overrides: Partial<MineExportLicenseRequest> = {}): MineExportLicenseRequest => ({
  id: 'request-1',
  mining_company_id: 'mine-1',
  requested_quantity_grams: 120_000,
  desired_export_date: '2026-09-30',
  destination: 'Suisse',
  reason: 'Export planifié trimestriel',
  comment: 'Dossier complet',
  status: 'submitted',
  submitted_by: 'mine-user',
  submitted_at: '2026-08-24T12:00:00Z',
  created_at: '2026-08-24T12:00:00Z',
  updated_at: '2026-08-24T12:00:00Z',
  reviewed_by: null,
  reviewed_at: null,
  decision_reason: null,
  license_id: null,
  mining_company: { id: 'mine-1', name: 'Mine Exemple', code: 'MEX' },
  ...overrides,
});

describe('reliquat des licences d’exportation', () => {
  it('recalcule un reliquat NULL à partir du volume autorisé et consommé', () => {
    const normalized = normalizeExportLicenseQuota(license({
      used_quantity_grams: 125_000,
      remaining_quantity_grams: null as unknown as number,
    }));

    expect(normalized.remaining_quantity_grams).toBe(4_875_000);
  });

  it('conserve un reliquat stocké lorsqu’il est disponible', () => {
    const normalized = normalizeExportLicenseQuota(license({
      used_quantity_grams: 125_000,
      remaining_quantity_grams: 4_800_000,
    }));

    expect(normalized.remaining_quantity_grams).toBe(4_800_000);
  });

  it('ne présente jamais un reliquat négatif', () => {
    const normalized = normalizeExportLicenseQuota(license({
      authorized_quantity_grams: 100,
      used_quantity_grams: 120,
      remaining_quantity_grams: null as unknown as number,
    }));

    expect(normalized.remaining_quantity_grams).toBe(0);
  });
});

describe('licences sélectionnables pour une expédition', () => {
  it('exige le tenant, le statut actif, la période courante et un quota libre', () => {
    expect(isExportLicenseSelectable(license(), 'mine-1', '2026-08-24')).toBe(true);
    expect(isExportLicenseSelectable(license({ mining_company_id: 'mine-2' }), 'mine-1', '2026-08-24')).toBe(false);
    expect(isExportLicenseSelectable(license({ status: 'pending' }), 'mine-1', '2026-08-24')).toBe(false);
    expect(isExportLicenseSelectable(license({ start_date: '2026-09-01' }), 'mine-1', '2026-08-24')).toBe(false);
    expect(isExportLicenseSelectable(license({ end_date: '2026-08-23' }), 'mine-1', '2026-08-24')).toBe(false);
    expect(isExportLicenseSelectable(license({ remaining_quantity_grams: 0 }), 'mine-1', '2026-08-24')).toBe(false);
  });
});

describe('exportLicenseService sécurisé', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.filters = [];
    mocks.licenses = [license()];
    mocks.from.mockImplementation(() => {
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn((column: string, value: unknown) => {
        mocks.filters.push(['eq', column, value]);
        return query;
      });
      query.lte = vi.fn((column: string, value: unknown) => {
        mocks.filters.push(['lte', column, value]);
        return query;
      });
      query.gte = vi.fn((column: string, value: unknown) => {
        mocks.filters.push(['gte', column, value]);
        return query;
      });
      query.order = vi.fn(async () => ({ data: mocks.licenses, error: null }));
      return query;
    });
  });

  it('charge seulement les licences actives du tenant et réapplique les invariants', async () => {
    mocks.licenses = [
      license(),
      license({ id: 'other', mining_company_id: 'mine-2' }),
      license({ id: 'pending', status: 'pending' }),
      license({ id: 'empty', remaining_quantity_grams: 0 }),
    ];

    const result = await exportLicenseService.getActiveLicensesByCompany('mine-1');

    expect(result.map((item) => item.id)).toEqual(['license-1']);
    expect(mocks.filters).toEqual(expect.arrayContaining([
      ['eq', 'mining_company_id', 'mine-1'],
      ['eq', 'status', 'active'],
      ['lte', 'start_date', expect.any(String)],
      ['gte', 'end_date', expect.any(String)],
    ]));
  });

  it('utilise exclusivement la RPC pour vérifier le quota', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ is_available: true, remaining_quantity: 2500, message: 'Disponible' }],
      error: null,
    });

    await expect(exportLicenseService.checkLicenseAvailability('license-1', 1000))
      .resolves.toEqual({ is_available: true, remaining_quantity: 2500, message: 'Disponible' });
    expect(mocks.rpc).toHaveBeenCalledWith('check_license_availability', {
      p_license_id: 'license-1',
      p_required_quantity: 1000,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('propage un refus RPC sans vérification locale de secours', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Conflit de quota' } });

    await expect(exportLicenseService.checkLicenseAvailability('license-1', 1000))
      .rejects.toMatchObject({ message: 'Conflit de quota' });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('soumet la demande Mine par la signature RPC sans tenant ni statut client', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: request(),
      error: null,
    });

    await exportLicenseService.submitMineLicenseRequest({
      requestedQuantityGrams: 120_000,
      desiredExportDate: '2026-09-30',
      destination: '  Suisse  ',
      reason: '  Export planifié trimestriel  ',
      comment: '  Traitement prioritaire  ',
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      'snp_portail_mine_soumettre_demande_licence_export',
      {
        p_quantite_demandee_grammes: 120_000,
        p_date_export_souhaitee: '2026-09-30',
        p_destination: 'Suisse',
        p_motif: 'Export planifié trimestriel',
        p_commentaire: 'Traitement prioritaire',
      },
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('autorise une demande exclusivement par la RPC SONASP sans acteur ni tenant client', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: request({ status: 'approved', license_id: 'license-1' }),
      error: null,
    });

    await expect(exportLicenseService.decideMineLicenseRequest({
      requestId: ' request-1 ',
      decision: 'approved',
      licenseNumber: ' EXP-2026-001 ',
      startDate: '2026-08-24',
      endDate: '2027-08-23',
      issuingInstitution: ' SONASP ',
      authorizedQuantityGrams: 100_000,
      decisionReason: ' Autorisation conforme ',
      comments: ' Dossier complet ',
    })).resolves.toMatchObject({ status: 'approved', license_id: 'license-1' });

    expect(mocks.rpc).toHaveBeenCalledWith(
      'snp_sonasp_decider_demande_licence_export',
      {
        p_demande_id: 'request-1',
        p_decision: 'approved',
        p_numero_licence: 'EXP-2026-001',
        p_date_debut: '2026-08-24',
        p_date_fin: '2027-08-23',
        p_institution_emettrice: 'SONASP',
        p_quantite_autorisee_grammes: 100_000,
        p_motif_decision: 'Autorisation conforme',
        p_commentaires: 'Dossier complet',
      },
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('charge la boîte SONASP en lecture seule et normalise les quantités numériques', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [request({ requested_quantity_grams: '120000' as unknown as number })],
      error: null,
    });
    const select = vi.fn(() => ({ order }));
    mocks.from.mockReturnValueOnce({ select });

    await expect(exportLicenseService.getSonaspLicenseRequests())
      .resolves.toEqual([expect.objectContaining({ id: 'request-1', requested_quantity_grams: 120_000 })]);

    expect(mocks.from).toHaveBeenCalledWith('snp_export_license_requests');
    expect(select).toHaveBeenCalledWith(expect.stringContaining('mining_company:mining_companies'));
    expect(order).toHaveBeenCalledWith('submitted_at', { ascending: false });
    const query = mocks.from.mock.results.at(-1)?.value as Record<string, unknown>;
    expect(query).not.toHaveProperty('insert');
    expect(query).not.toHaveProperty('update');
    expect(query).not.toHaveProperty('delete');
  });

  it('échoue fermé quand la boîte SONASP ne renvoie pas une liste exploitable', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: null });
    mocks.from.mockReturnValueOnce({ select: vi.fn(() => ({ order })) });

    await expect(exportLicenseService.getSonaspLicenseRequests())
      .rejects.toBeInstanceOf(ExportLicenseWorkflowUnavailableError);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('bloque un rejet sans motif suffisant avant tout appel réseau', async () => {
    await expect(exportLicenseService.decideMineLicenseRequest({
      requestId: 'request-1',
      decision: 'rejected',
      decisionReason: 'Incomplet',
    })).rejects.toThrow('au moins 10 caractères');

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('signale une RPC de décision absente sans fallback DML', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42883', message: 'function does not exist' },
    });

    await expect(exportLicenseService.decideMineLicenseRequest({
      requestId: 'request-1',
      decision: 'approved',
      licenseNumber: 'EXP-2026-001',
      startDate: '2026-08-24',
      endDate: '2027-08-23',
      issuingInstitution: 'SONASP',
      authorizedQuantityGrams: 100_000,
    })).rejects.toBeInstanceOf(ExportLicenseWorkflowUnavailableError);

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('signale explicitement une RPC de demande absente sans fallback DML', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42883', message: 'function does not exist' },
    });

    await expect(exportLicenseService.submitMineLicenseRequest({
      requestedQuantityGrams: 120_000,
      desiredExportDate: '2026-09-30',
      destination: 'Suisse',
      reason: 'Export planifié trimestriel',
    })).rejects.toBeInstanceOf(ExportLicenseWorkflowUnavailableError);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
