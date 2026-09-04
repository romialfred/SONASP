import { describe, expect, it } from 'vitest';
import { SALES_STATUSES, STATUS_LABELS } from './salesStatuses';

describe('référentiel des statuts de vente', () => {
  it('fournit un libellé français pour chaque code persistant', () => {
    const codes = Object.values(SALES_STATUSES);

    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...codes].sort());
    codes.forEach((code) => {
      expect(STATUS_LABELS[code]).toBeTruthy();
      expect(STATUS_LABELS[code]).not.toContain('_');
      expect(STATUS_LABELS[code]).not.toBe('Statut non reconnu');
    });
  });

  it('présente les étapes structurantes en français', () => {
    expect(STATUS_LABELS.pending_management_approval).toBe('En attente d’approbation de la direction');
    expect(STATUS_LABELS.payment_received).toBe('Paiement reçu');
    expect(STATUS_LABELS.completed).toBe('Terminé');
  });
});
