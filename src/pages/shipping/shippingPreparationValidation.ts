export const SHIPPING_ELIGIBLE_PRODUCTION_STATUS = 'ready_for_customs';

export interface ShippingProductionCandidate {
  id: string;
  reference?: string | null;
  miningCompanyId: string | null;
  status: string | null | undefined;
  grossWeightGrams: number | null | undefined;
  netWeightGrams: number | null | undefined;
  pureGoldGrams: number | null | undefined;
  finenessPercent: number | null | undefined;
  alreadyAssigned?: boolean;
}

export type ShippingProductionIssueCode =
  | 'missing-id'
  | 'wrong-company'
  | 'invalid-status'
  | 'already-assigned'
  | 'invalid-gross-weight'
  | 'invalid-net-weight'
  | 'net-exceeds-gross'
  | 'invalid-fineness'
  | 'invalid-pure-gold'
  | 'pure-gold-exceeds-net'
  | 'duplicate-production';

export interface ShippingProductionIssue {
  code: ShippingProductionIssueCode;
  productionId: string;
  message: string;
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function productionLabel(candidate: ShippingProductionCandidate) {
  return candidate.reference?.trim() || candidate.id.trim() || 'Production inconnue';
}

export function validateShippingProduction(
  candidate: ShippingProductionCandidate,
  expectedCompanyId: string,
): ShippingProductionIssue[] {
  const issues: ShippingProductionIssue[] = [];
  const label = productionLabel(candidate);
  const add = (code: ShippingProductionIssueCode, message: string) => {
    issues.push({ code, productionId: candidate.id, message: `${label}: ${message}` });
  };

  if (!candidate.id.trim()) add('missing-id', 'l’identifiant de la production est manquant.');
  if (!expectedCompanyId || candidate.miningCompanyId !== expectedCompanyId) {
    add('wrong-company', 'la production n’appartient pas à la société minière sélectionnée.');
  }
  if (candidate.status !== SHIPPING_ELIGIBLE_PRODUCTION_STATUS) {
    add('invalid-status', 'la production n’est pas prête pour la préparation douanière.');
  }
  if (candidate.alreadyAssigned) {
    add('already-assigned', 'la production est déjà affectée à une autre expédition.');
  }

  const grossWeight = candidate.grossWeightGrams;
  const netWeight = candidate.netWeightGrams;
  const pureGoldWeight = candidate.pureGoldGrams;
  const grossIsValid = isPositiveFinite(grossWeight);
  const netIsValid = isPositiveFinite(netWeight);
  const pureGoldIsValid = isPositiveFinite(pureGoldWeight);

  if (!grossIsValid) add('invalid-gross-weight', 'le poids brut doit être un nombre fini supérieur à zéro.');
  if (!netIsValid) add('invalid-net-weight', 'le poids net doit être un nombre fini supérieur à zéro.');
  if (grossIsValid && netIsValid && netWeight > grossWeight) {
    add('net-exceeds-gross', 'le poids net ne peut pas dépasser le poids brut.');
  }

  if (
    typeof candidate.finenessPercent !== 'number'
    || !Number.isFinite(candidate.finenessPercent)
    || candidate.finenessPercent < 0
    || candidate.finenessPercent > 100
  ) {
    add('invalid-fineness', 'la pureté de l’or doit être comprise entre 0 % et 100 %.');
  }

  if (!pureGoldIsValid) add('invalid-pure-gold', 'le poids d’or fin doit être un nombre fini supérieur à zéro.');
  if (pureGoldIsValid && netIsValid && pureGoldWeight > netWeight) {
    add('pure-gold-exceeds-net', 'le poids d’or fin ne peut pas dépasser le poids net.');
  }

  return issues;
}

export function validateShippingProductionSelection(
  candidates: ShippingProductionCandidate[],
  expectedCompanyId: string,
): ShippingProductionIssue[] {
  const issues = candidates.flatMap((candidate) =>
    validateShippingProduction(candidate, expectedCompanyId));
  const seen = new Set<string>();

  candidates.forEach((candidate) => {
    if (!candidate.id || seen.has(candidate.id)) {
      if (candidate.id) {
        issues.push({
          code: 'duplicate-production',
          productionId: candidate.id,
          message: `${productionLabel(candidate)} : la production est sélectionnée plusieurs fois.`,
        });
      }
      return;
    }
    seen.add(candidate.id);
  });

  return issues;
}

export function summarizeShippingProductionIssues(issues: ShippingProductionIssue[]) {
  if (issues.length === 0) return '';
  const [firstIssue] = issues;
  const remaining = issues.length - 1;
  return remaining > 0
    ? `${firstIssue.message} ${remaining} autre${remaining > 1 ? 's' : ''} anomalie${remaining > 1 ? 's' : ''} doi${remaining > 1 ? 'vent' : 't'} être corrigée${remaining > 1 ? 's' : ''}.`
    : firstIssue.message;
}
