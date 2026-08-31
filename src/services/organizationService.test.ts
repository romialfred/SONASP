import { describe, expect, it } from 'vitest';
import {
  EMPTY_ORGANIZATION_FORM,
  buildOrganizationRpcPayload,
  organizationTypeLabel,
  validateOrganization,
} from './organizationService';

const validForm = () => ({
  ...EMPTY_ORGANIZATION_FORM,
  code: 'DGI-PS',
  name: 'Perception spécialisée de la DGI',
  organizationType: 'dgi' as const,
  supervisingMinistryId: '70000000-0000-4000-8000-000000000001',
});

describe('organizationService', () => {
  it('exige toujours un ministère de tutelle', () => {
    const values = validForm();
    values.supervisingMinistryId = '';

    expect(validateOrganization(values)).toMatchObject({
      supervisingMinistryId: expect.stringContaining('obligatoire'),
    });
  });

  it('adapte les champs obligatoires au type d’organisation', () => {
    const mine = { ...validForm(), organizationType: 'mine' as const, miningCompanyId: '' };
    const collector = { ...validForm(), organizationType: 'collector' as const, sourceArtisanId: '' };

    expect(validateOrganization(mine)).toHaveProperty('miningCompanyId');
    expect(validateOrganization(collector)).toHaveProperty('sourceArtisanId');
    expect(validateOrganization(validForm())).not.toHaveProperty('miningCompanyId');
  });

  it('refuse une organisation comme son propre parent', () => {
    const values = { ...validForm(), parentOrganizationId: 'org-1' };
    expect(validateOrganization(values, 'org-1')).toHaveProperty('parentOrganizationId');
  });

  it('normalise le code et retire les rattachements incompatibles du RPC', () => {
    const payload = buildOrganizationRpcPayload({
      ...validForm(),
      code: ' dgi-ps ',
      miningCompanyId: 'mine-1',
      sourceArtisanId: 'collector-1',
      administrativeRegion: 'Centre',
    });

    expect(payload).toMatchObject({
      p_code: 'DGI-PS',
      p_mining_company_id: null,
      p_source_artisan_id: null,
      p_scope_metadata: { scope: 'territorial' },
    });
  });

  it('présente les libellés institutionnels en français', () => {
    expect(organizationTypeLabel('dgi')).toBe('Administration fiscale (DGI)');
    expect(organizationTypeLabel('public_institution')).toBe('Établissement public');
  });
});
