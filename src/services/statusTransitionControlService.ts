/**
 * Service de Contrôle des Transitions de Statut par Module
 *
 * Ce service implémente la matrice de contrôle stricte des changements de statut
 * selon le module/phase où se trouve l'entité.
 *
 * RÈGLE FONDAMENTALE:
 * Une fois qu'une entité passe à la phase suivante, le module précédent
 * ne peut PLUS modifier son statut. Seul le module de la phase actuelle
 * peut effectuer des changements.
 */

// ProductionStatus is defined locally in this file

/**
 * Phases/Modules du système
 */
export enum WorkflowModule {
  PRODUCTION = 'production',
  SHIPPING_PREPARATION = 'shipping_preparation',
  FREIGHT_CUSTOMS = 'freight_customs',
  REFINERY = 'refinery',
  INVENTORY = 'inventory',
  SALE = 'sale'
}

/**
 * Matrice de contrôle: Quels statuts peuvent être modifiés par quel module
 *
 * BASÉ SUR LES ENUMs RÉELS DE LA BASE DE DONNÉES:
 * - production_status_v2: prepared, ready_for_customs, cancelled
 * - shipping_preparation_status: waiting_for_customs_approval, approved_by_customs, ready_for_expedition
 */
const STATUS_MODULE_CONTROL_MATRIX: Record<WorkflowModule, string[]> = {
  // MODULE PRODUCTION: Peut modifier uniquement Préparé et Prêt pour la douane
  // ENUM: production_status_v2
  [WorkflowModule.PRODUCTION]: [
    'prepared',              // Préparé
    'ready_for_customs'      // Prêt pour la Douane
  ],

  // MODULE SHIPPING PREPARATION: Prend le relais après "Prêt pour la douane"
  // ENUM: shipping_preparation_status
  [WorkflowModule.SHIPPING_PREPARATION]: [
    'waiting_for_customs_approval',  // En Attente Douane (statut initial)
    'approved_by_customs',           // Approuvé par Douane
    'ready_for_expedition'           // Prêt pour Expédition
  ],

  // MODULE FREIGHT & CUSTOMS: Gère l'expédition physique vers raffinerie
  [WorkflowModule.FREIGHT_CUSTOMS]: [
    'ready_for_expedition',    // Prêt pour Expédition
    'shipped_to_refinery'      // Expédié à la Raffinerie
  ],

  // MODULE REFINERY: Gère la réception et le raffinage
  [WorkflowModule.REFINERY]: [
    'shipped_to_refinery',  // Expédié à la Raffinerie
    'refined'               // Raffinée
  ],

  // MODULE INVENTORY: Gère le stock raffiné
  [WorkflowModule.INVENTORY]: [
    'refined',        // Raffinée
    'in_inventory'    // En Inventaire
  ],

  // MODULE SALE: Gère les ventes
  [WorkflowModule.SALE]: [
    'in_inventory',   // En Inventaire
    'in_sale',        // En Vente
    'sold',           // Vendu
    'paid'            // Payé
  ]
};

/**
 * Transitions autorisées entre statuts
 * Format: { [status_actuel]: [statuts_possibles] }
 *
 * WORKFLOW COMPLET BASÉ SUR LA CAPTURE D'ÉCRAN:
 * Production: Préparé → Prêt pour la douane
 * Shipping: Waiting for Custom approval → Approved by customs → Ready for expedition
 * Freight: Prêt pour Expédition → Expédié à la raffinerie
 * Refinery: Expédié à la raffinerie → Raffinée
 * Inventory: En inventaire
 * Sale: En vente → Vendu → Payé
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  // ===== PHASE PRODUCTION =====
  'prepared': ['ready_for_customs', 'cancelled'],
  'ready_for_customs': ['waiting_for_customs_approval', 'cancelled'],

  // ===== PHASE SHIPPING PREPARATION =====
  'waiting_for_customs_approval': ['approved_by_customs', 'cancelled'],
  'approved_by_customs': ['ready_for_expedition', 'cancelled'],

  // ===== PHASE FREIGHT & CUSTOMS =====
  'ready_for_expedition': ['shipped_to_refinery', 'cancelled'],

  // ===== PHASE REFINERY =====
  'shipped_to_refinery': ['refined', 'cancelled'],

  // ===== PHASE INVENTORY =====
  'refined': ['in_inventory'],
  'in_inventory': ['in_sale'],

  // ===== PHASE SALE =====
  'in_sale': ['sold'],
  'sold': ['paid'],
  'paid': [], // État final

  // État d'annulation (final)
  'cancelled': []
};

/**
 * Détermine le module responsable d'un statut donné
 */
export function getModuleForStatus(status: string): WorkflowModule | null {
  for (const [module, statuses] of Object.entries(STATUS_MODULE_CONTROL_MATRIX)) {
    if (statuses.includes(status)) {
      return module as WorkflowModule;
    }
  }
  return null;
}

/**
 * Vérifie si un module peut modifier un statut donné
 */
export function canModuleChangeStatus(
  module: WorkflowModule,
  currentStatus: string
): boolean {
  const allowedStatuses = STATUS_MODULE_CONTROL_MATRIX[module];
  return allowedStatuses.includes(currentStatus);
}

/**
 * Vérifie si une transition de statut est autorisée
 */
export function isTransitionAllowed(
  fromStatus: string,
  toStatus: string
): boolean {
  const allowedNextStatuses = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowedNextStatuses.includes(toStatus);
}

/**
 * Vérifie si un module peut effectuer une transition de statut
 *
 * @param module - Module qui tente de faire le changement
 * @param currentStatus - Statut actuel de l'entité
 * @param newStatus - Nouveau statut souhaité
 * @returns { allowed: boolean, reason?: string }
 */
export function canModuleTransitionStatus(
  module: WorkflowModule,
  currentStatus: string,
  newStatus: string
): { allowed: boolean; reason?: string } {
  // Vérifier si le module peut modifier le statut actuel
  if (!canModuleChangeStatus(module, currentStatus)) {
    const responsibleModule = getModuleForStatus(currentStatus);
    return {
      allowed: false,
      reason: `Le statut "${currentStatus}" ne peut être modifié que par le module ${responsibleModule}. Module actuel: ${module}.`
    };
  }

  // Vérifier si la transition est autorisée
  if (!isTransitionAllowed(currentStatus, newStatus)) {
    const allowedTransitions = ALLOWED_TRANSITIONS[currentStatus] || [];
    return {
      allowed: false,
      reason: `Transition non autorisée de "${currentStatus}" vers "${newStatus}". Transitions possibles: ${allowedTransitions.join(', ')}`
    };
  }

  // Vérifier si le nouveau statut est dans la portée du module
  if (!canModuleChangeStatus(module, newStatus)) {
    return {
      allowed: false,
      reason: `Le module ${module} ne peut pas définir le statut "${newStatus}". Ce statut est géré par un autre module.`
    };
  }

  return { allowed: true };
}

/**
 * Obtient les transitions possibles pour un statut donné dans un module
 */
export function getAvailableTransitions(
  module: WorkflowModule,
  currentStatus: string
): string[] {
  // Si le module ne peut pas modifier ce statut, aucune transition possible
  if (!canModuleChangeStatus(module, currentStatus)) {
    return [];
  }

  // Filtrer les transitions autorisées pour ne garder que celles
  // que le module peut effectuer
  const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] || [];
  const moduleStatuses = STATUS_MODULE_CONTROL_MATRIX[module];

  return allowedNextStatuses.filter(status =>
    moduleStatuses.includes(status) || status === 'cancelled'
  );
}

/**
 * Vérifie si un statut est un état final (aucune transition possible)
 */
export function isFinalStatus(status: string): boolean {
  const transitions = ALLOWED_TRANSITIONS[status] || [];
  return transitions.length === 0;
}

/**
 * Obtient le message d'information sur le module responsable
 */
export function getModuleResponsibilityMessage(status: string): string {
  const module = getModuleForStatus(status);

  const moduleLabels: Record<WorkflowModule, string> = {
    [WorkflowModule.PRODUCTION]: 'Production',
    [WorkflowModule.SHIPPING_PREPARATION]: 'Préparation d\'Expédition',
    [WorkflowModule.FREIGHT_CUSTOMS]: 'Fret & Douanes',
    [WorkflowModule.REFINERY]: 'Raffinerie',
    [WorkflowModule.INVENTORY]: 'Inventaire',
    [WorkflowModule.SALE]: 'Vente'
  };

  if (!module) {
    return 'Statut non géré';
  }

  return `Ce statut est géré par le module: ${moduleLabels[module]}`;
}

/**
 * Détermine si le bouton de modification doit être affiché
 * dans un module donné pour un statut donné
 */
export function shouldShowStatusChangeButton(
  module: WorkflowModule,
  currentStatus: string
): boolean {
  if (isFinalStatus(currentStatus)) {
    return false;
  }

  return canModuleChangeStatus(module, currentStatus);
}

/**
 * Obtient le statut suivant recommandé dans le workflow
 */
export function getNextRecommendedStatus(currentStatus: string): string | null {
  const transitions = ALLOWED_TRANSITIONS[currentStatus] || [];

  // Exclure 'cancelled' des recommandations
  const validTransitions = transitions.filter(s => s !== 'cancelled');

  // Retourner la première transition valide (chemin heureux)
  return validTransitions.length > 0 ? validTransitions[0] : null;
}

/**
 * Classe d'erreur pour les transitions non autorisées
 */
export class StatusTransitionError extends Error {
  constructor(
    public module: WorkflowModule,
    public currentStatus: string,
    public attemptedStatus: string,
    message: string
  ) {
    super(message);
    this.name = 'StatusTransitionError';
  }
}

/**
 * Valide une transition et lance une erreur si elle n'est pas autorisée
 */
export function validateTransition(
  module: WorkflowModule,
  currentStatus: string,
  newStatus: string
): void {
  const result = canModuleTransitionStatus(module, currentStatus, newStatus);

  if (!result.allowed) {
    throw new StatusTransitionError(
      module,
      currentStatus,
      newStatus,
      result.reason || 'Transition non autorisée'
    );
  }
}
