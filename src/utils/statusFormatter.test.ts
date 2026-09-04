import { describe, expect, it } from 'vitest';
import { formatStatusFr, STATUS_LABELS_FR } from './statusFormatter';

describe('statusFormatter — libellés métier français', () => {
  it('couvre les statuts transversaux affichés par les portails', () => {
    const statutsAttendus = [
      'prepared',
      'en_attente',
      'pending_approval',
      'UNDER_REVIEW',
      'VALIDATED_LEVEL_1',
      'shipped_to_refinery',
      'received_at_refinery',
      'processing',
      'processed',
    ];

    statutsAttendus.forEach((statut) => {
      expect(formatStatusFr(statut)).not.toBe('Statut non reconnu');
      expect(formatStatusFr(statut)).not.toContain('_');
    });
  });

  it('normalise la casse sans modifier les codes persistés', () => {
    expect(formatStatusFr('UNDER_REVIEW')).toBe('En cours de contrôle');
    expect(formatStatusFr('  PAYMENT_RECEIVED  ')).toBe('Paiement reçu');
  });

  it('utilise un repli français au lieu de réafficher un code inconnu', () => {
    expect(formatStatusFr('future_status_from_database')).toBe('Statut non reconnu');
    expect(formatStatusFr('future_status_from_database', 'Étape à qualifier')).toBe('Étape à qualifier');
    expect(formatStatusFr(null)).toBe('Statut non reconnu');
  });

  it('ne contient aucun libellé de présentation vide', () => {
    expect(Object.values(STATUS_LABELS_FR).every((label) => label.trim().length > 0)).toBe(true);
  });
});
