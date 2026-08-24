import {
  CAPABILITIES,
  hasAnyCapability,
  type CapabilityCode,
} from '@/lib/capabilities';
import type { UserProfile } from '@/types/auth';

/** Capacités qui donnent accès à la file des cessions Comptoir → SONASP. */
export const SONASP_COMPTOIR_INBOX_CAPABILITIES: CapabilityCode[] = [
  CAPABILITIES.SONASP_PREPARE,
  CAPABILITIES.SONASP_APPROVE,
  CAPABILITIES.FINANCE_EXECUTE,
  CAPABILITIES.FINANCE_RECONCILE,
];

export function canAccessSonaspComptoirInbox(user: UserProfile | null | undefined): boolean {
  return hasAnyCapability(user, SONASP_COMPTOIR_INBOX_CAPABILITIES);
}
