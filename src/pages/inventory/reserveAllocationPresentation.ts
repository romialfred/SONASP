import type { BadgeTone } from '@/components/ui/sn';
import type { ReserveAllocationStatus } from '@/services/reserveAllocationService';

export const RESERVE_STATUS_LABELS: Record<ReserveAllocationStatus, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumise',
  UNDER_REVIEW: 'En attente de validation',
  VALIDATED_LEVEL_1: 'Validation 1',
  VALIDATED_LEVEL_2: 'Validation 2',
  TRANSFER_AUTHORIZED: 'Transfert autorisé',
  IN_TRANSIT: 'En transit',
  RECEIVED: 'Réception en attente',
  RECONCILIATION_PENDING: 'Rapprochement',
  RECONCILED: 'Rapprochée',
  ACTIVE: 'Affectée (active)',
  REJECTED: 'Rejetée',
  CANCELLED: 'Annulée',
  DISCREPANCY_REVIEW: 'Analyse d’écart',
};

export const RESERVE_STATUS_TONES: Record<ReserveAllocationStatus, BadgeTone> = {
  DRAFT: 'warning',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  VALIDATED_LEVEL_1: 'info',
  VALIDATED_LEVEL_2: 'info',
  TRANSFER_AUTHORIZED: 'info',
  IN_TRANSIT: 'info',
  RECEIVED: 'warning',
  RECONCILIATION_PENDING: 'warning',
  RECONCILED: 'success',
  ACTIVE: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  DISCREPANCY_REVIEW: 'danger',
};

export const RESERVE_DEPOSIT_TYPE_LABELS: Record<string, string> = {
  reserve_vault: 'Coffre de réserve',
  sovereign_vault: 'Coffre souverain SONASP',
  custody_account: 'Compte de conservation',
};

export const formatDepositType = (value?: string | null) => value
  ? RESERVE_DEPOSIT_TYPE_LABELS[value] || value
  : 'À définir';

export const RESERVE_WORKFLOW: Array<{
  status: ReserveAllocationStatus;
  label: string;
}> = [
  { status: 'DRAFT', label: 'Créée' },
  { status: 'SUBMITTED', label: 'Soumise' },
  { status: 'VALIDATED_LEVEL_1', label: 'Validation 1' },
  { status: 'VALIDATED_LEVEL_2', label: 'Validation 2' },
  { status: 'TRANSFER_AUTHORIZED', label: 'Transfert autorisé' },
  { status: 'IN_TRANSIT', label: 'En transit' },
  { status: 'RECEIVED', label: 'Réception' },
  { status: 'RECONCILED', label: 'Rapprochement' },
  { status: 'ACTIVE', label: 'Affectée (active)' },
];

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatFcfa = (value: number) => `${fcfa.format(value || 0)} FCFA`;
export const formatGrams = (value: number) => `${decimal.format(value || 0)} g`;
export const formatPercent = (value: number) => `${decimal.format(value || 0)} %`;
export const formatUsd = (value: number) => `${currency.format(value || 0)} USD`;
export const formatEur = (value: number) => `${currency.format(value || 0)} EUR`;
export const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('fr-FR').format(new Date(`${value.slice(0, 10)}T00:00:00`))
  : 'À définir';
export const formatDateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';
