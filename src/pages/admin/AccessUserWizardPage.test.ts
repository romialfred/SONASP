import { describe, expect, it } from 'vitest';
import type { AccessResource } from '@/types/accessGovernance';
import { resourceDetailRows } from './AccessUserWizardPage';

describe('resourceDetailRows', () => {
  it('présente uniquement les informations institutionnelles réellement disponibles', () => {
    const resource: AccessResource = {
      id: 'resource-1',
      category_code: 'comptoir',
      resource_kind: 'organization',
      display_name: 'Comptoir Burkina Or',
      secondary_name: null,
      code: 'CBO-001',
      email: 'contact@example.test',
      phone: null,
      address: 'Ouagadougou',
      representative: null,
      status: 'Actif',
      organization_id: 'resource-1',
      organization_name: 'Comptoir Burkina Or',
      details: { forme_juridique: 'SARL', region: 'Centre', site_id: 'internal-id' },
    };

    expect(resourceDetailRows(resource)).toEqual(expect.arrayContaining([
      ['Nom', 'Comptoir Burkina Or'],
      ['Code / identifiant', 'CBO-001'],
      ['Forme juridique', 'SARL'],
      ['Région', 'Centre'],
    ]));
    expect(resourceDetailRows(resource).flat()).not.toContain('internal-id');
    expect(resourceDetailRows(resource).some(([label]) => label === 'Téléphone')).toBe(false);
  });
});
