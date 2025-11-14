/**
 * Hook React pour le Contrôle des Transitions de Statut
 *
 * Fournit une interface simple pour vérifier les permissions
 * de changement de statut dans les composants React.
 */

import { useMemo } from 'react';
import {
  WorkflowModule,
  canModuleChangeStatus,
  canModuleTransitionStatus,
  getAvailableTransitions,
  shouldShowStatusChangeButton,
  getModuleResponsibilityMessage,
  getNextRecommendedStatus,
  isFinalStatus
} from '@/services/statusTransitionControlService';

// Ré-exporter WorkflowModule pour faciliter l'import
export { WorkflowModule } from '@/services/statusTransitionControlService';

interface StatusTransitionControl {
  // Permissions
  canChangeStatus: boolean;
  canTransitionTo: (newStatus: string) => { allowed: boolean; reason?: string };
  shouldShowButton: boolean;

  // Transitions disponibles
  availableTransitions: string[];
  nextRecommendedStatus: string | null;

  // Information
  isFinished: boolean;
  responsibilityMessage: string;

  // Fonctions utilitaires
  checkTransition: (newStatus: string) => boolean;
}

/**
 * Hook pour contrôler les transitions de statut
 *
 * @param module - Module actuel (production, shipping_preparation, etc.)
 * @param currentStatus - Statut actuel de l'entité
 * @returns Objet de contrôle des transitions
 *
 * @example
 * ```tsx
 * const control = useStatusTransitionControl(
 *   WorkflowModule.PRODUCTION,
 *   'ready_for_customs'
 * );
 *
 * if (control.canChangeStatus) {
 *   // Afficher les boutons de changement
 * }
 *
 * control.availableTransitions.forEach(status => {
 *   // Afficher les options disponibles
 * });
 * ```
 */
export function useStatusTransitionControl(
  module: WorkflowModule,
  currentStatus: string
): StatusTransitionControl {
  return useMemo(() => {
    const canChange = canModuleChangeStatus(module, currentStatus);
    const available = getAvailableTransitions(module, currentStatus);
    const shouldShow = shouldShowStatusChangeButton(module, currentStatus);
    const nextStatus = getNextRecommendedStatus(currentStatus);
    const isFinished = isFinalStatus(currentStatus);
    const responsibility = getModuleResponsibilityMessage(currentStatus);

    return {
      // Permissions
      canChangeStatus: canChange,
      canTransitionTo: (newStatus: string) =>
        canModuleTransitionStatus(module, currentStatus, newStatus),
      shouldShowButton: shouldShow,

      // Transitions disponibles
      availableTransitions: available,
      nextRecommendedStatus: nextStatus,

      // Information
      isFinished,
      responsibilityMessage: responsibility,

      // Fonction utilitaire simplifiée
      checkTransition: (newStatus: string) =>
        canModuleTransitionStatus(module, currentStatus, newStatus).allowed
    };
  }, [module, currentStatus]);
}

/**
 * Hook pour obtenir le module actif basé sur le statut
 */
export function useActiveModuleForStatus(status: string): WorkflowModule | null {
  return useMemo(() => {
    // Déterminer le module responsable du statut
    if (['prepared', 'ready_for_customs'].includes(status)) {
      return WorkflowModule.PRODUCTION;
    }
    if (['ready_for_customs', 'customs_approved', 'ready_for_expedition'].includes(status)) {
      // Note: ready_for_customs est partagé mais géré par Shipping après création
      if (status === 'ready_for_customs') {
        return WorkflowModule.SHIPPING_PREPARATION;
      }
      return WorkflowModule.SHIPPING_PREPARATION;
    }
    if (['ready_for_expedition', 'shipped_to_refinery'].includes(status)) {
      return WorkflowModule.FREIGHT_CUSTOMS;
    }
    if (['shipped_to_refinery', 'refined'].includes(status)) {
      return WorkflowModule.REFINERY;
    }
    if (['refined', 'in_inventory'].includes(status)) {
      return WorkflowModule.INVENTORY;
    }
    if (['in_inventory', 'in_sale', 'sold', 'paid'].includes(status)) {
      return WorkflowModule.SALE;
    }
    return null;
  }, [status]);
}

/**
 * Hook pour vérifier si on est dans le bon module pour modifier un statut
 */
export function useIsCorrectModuleForStatus(
  currentModule: WorkflowModule,
  status: string
): boolean {
  return useMemo(() => {
    return canModuleChangeStatus(currentModule, status);
  }, [currentModule, status]);
}
