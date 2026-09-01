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
  return candidate.reference?.trim() || candidate.id.trim() || 'Unknown production';
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

  if (!candidate.id.trim()) add('missing-id', 'the production identifier is missing.');
  if (!expectedCompanyId || candidate.miningCompanyId !== expectedCompanyId) {
    add('wrong-company', 'the production does not belong to the selected mining company.');
  }
  if (candidate.status !== SHIPPING_ELIGIBLE_PRODUCTION_STATUS) {
    add('invalid-status', 'the production is not ready for customs preparation.');
  }
  if (candidate.alreadyAssigned) {
    add('already-assigned', 'the production is already assigned to another shipment.');
  }

  const grossWeight = candidate.grossWeightGrams;
  const netWeight = candidate.netWeightGrams;
  const pureGoldWeight = candidate.pureGoldGrams;
  const grossIsValid = isPositiveFinite(grossWeight);
  const netIsValid = isPositiveFinite(netWeight);
  const pureGoldIsValid = isPositiveFinite(pureGoldWeight);

  if (!grossIsValid) add('invalid-gross-weight', 'gross weight must be a finite value greater than zero.');
  if (!netIsValid) add('invalid-net-weight', 'net weight must be a finite value greater than zero.');
  if (grossIsValid && netIsValid && netWeight > grossWeight) {
    add('net-exceeds-gross', 'net weight cannot exceed gross weight.');
  }

  if (
    typeof candidate.finenessPercent !== 'number'
    || !Number.isFinite(candidate.finenessPercent)
    || candidate.finenessPercent < 0
    || candidate.finenessPercent > 100
  ) {
    add('invalid-fineness', 'gold purity must be between 0% and 100%.');
  }

  if (!pureGoldIsValid) add('invalid-pure-gold', 'fine gold weight must be a finite value greater than zero.');
  if (pureGoldIsValid && netIsValid && pureGoldWeight > netWeight) {
    add('pure-gold-exceeds-net', 'fine gold weight cannot exceed net weight.');
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
          message: `${productionLabel(candidate)}: the production is selected more than once.`,
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
    ? `${firstIssue.message} ${remaining} additional issue${remaining > 1 ? 's' : ''} must be corrected.`
    : firstIssue.message;
}
