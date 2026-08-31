import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDepositType,
  formatFcfa,
  formatGrams,
  formatPercent,
  RESERVE_STATUS_LABELS,
  RESERVE_WORKFLOW,
} from './reserveAllocationPresentation';

describe('présentation des affectations à la réserve', () => {
  it('couvre sans doublon les neuf jalons du workflow opérationnel', () => {
    expect(RESERVE_WORKFLOW.map(({ status }) => status)).toEqual([
      'DRAFT',
      'SUBMITTED',
      'VALIDATED_LEVEL_1',
      'VALIDATED_LEVEL_2',
      'TRANSFER_AUTHORIZED',
      'IN_TRANSIT',
      'RECEIVED',
      'RECONCILED',
      'ACTIVE',
    ]);
    expect(new Set(RESERVE_WORKFLOW.map(({ status }) => status)).size).toBe(9);
  });

  it('porte un libellé utilisateur pour chaque état persistant', () => {
    expect(Object.keys(RESERVE_STATUS_LABELS)).toHaveLength(14);
    expect(RESERVE_STATUS_LABELS).toMatchObject({
      DRAFT: 'Brouillon',
      VALIDATED_LEVEL_1: 'Validation 1',
      VALIDATED_LEVEL_2: 'Validation 2',
      DISCREPANCY_REVIEW: 'Analyse d’écart',
      ACTIVE: 'Affectée (active)',
    });
  });

  it('formate les quantités et valeurs selon la locale française', () => {
    expect(formatFcfa(78_411_875)).toBe('78\u202f411\u202f875 FCFA');
    expect(formatGrams(1_249.85)).toBe('1\u202f249,85 g');
    expect(formatPercent(99.99)).toBe('99,99 %');
    expect(formatDate('2026-08-28')).toBe('28/08/2026');
    expect(formatDate(null)).toBe('À définir');
    expect(formatDepositType('reserve_vault')).toBe('Coffre de réserve');
    expect(formatDepositType(null)).toBe('À définir');
  });
});
