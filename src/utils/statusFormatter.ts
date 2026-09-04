/** Formate un identifiant technique en texte lisible (usage interne uniquement). */
export function formatStatus(status: string): string {
  if (!status) return '';
  
  // Remplace les underscores par des espaces
  // Met en majuscule la première lettre de chaque mot
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Référentiel transversal des libellés de statuts persistés.
 *
 * Les clés sont les codes de la base, normalisés en minuscules uniquement pour
 * la recherche. Les appels continuent de transmettre et de persister les codes
 * originaux ; cette table n'intervient que dans la présentation.
 */
export const STATUS_LABELS_FR: Readonly<Record<string, string>> = {
  // États transversaux et tableaux de bord
  created: 'Créé',
  draft: 'Brouillon',
  pending: 'En attente',
  pending_approval: 'À approuver',
  awaiting_approval: 'En attente d’approbation',
  submitted: 'Soumis',
  under_review: 'En cours de contrôle',
  in_progress: 'En cours',
  processing: 'En cours de traitement',
  processed: 'Traité',
  prepared: 'Préparé',
  approved: 'Approuvé',
  validated: 'Validé',
  completed: 'Terminé',
  rejected: 'Rejeté',
  cancelled: 'Annulé',
  alert: 'Alerte',
  active: 'Actif',
  inactive: 'Inactif',
  suspended: 'Suspendu',

  // Production, acheminement, raffinage et stock
  in_safe: 'En coffre',
  ready_for_shipping: 'Prêt pour expédition',
  waiting_for_customs_approval: 'En attente d’approbation douanière',
  ready_for_customs: 'Prêt pour la douane',
  approved_by_customs: 'Approuvé par la douane',
  ready_for_expedition: 'Prêt pour expédition',
  validated_for_refinery: 'Validé pour la raffinerie',
  shipped: 'Expédié',
  shipped_refinery: 'Expédié à la raffinerie',
  shipped_to_refinery: 'Expédié à la raffinerie',
  in_transit: 'En transit',
  received: 'Reçu',
  received_airport: 'Reçu à l’aéroport',
  received_refinery: 'Reçu à la raffinerie',
  received_at_refinery: 'Reçu à la raffinerie',
  refined: 'Raffiné',
  in_inventory: 'En stock',
  in_sale: 'En vente',
  ready_for_sale: 'Prêt pour la vente',
  sold: 'Vendu',
  paid: 'Payé',

  // Vente internationale
  create_sales: 'Brouillon',
  pending_management_approval: 'En attente d’approbation de la direction',
  management_approved: 'Approuvée par la direction',
  management_rejected: 'Rejetée par la direction',
  pending_for_customer_approval: 'En attente d’approbation du client',
  customer_approved: 'Approuvée par le client',
  customer_rejected: 'Rejetée par le client',
  waiting_for_payment: 'En attente de paiement',
  virtual_payment: 'Paiement virtuel',
  payment_received: 'Paiement reçu',

  // Collecte artisanale et cessions de comptoir
  en_attente: 'En attente',
  en_traitement: 'En cours de traitement',
  accepted: 'Accepté',
  validee: 'Validée',
  valide: 'Validé',
  payee: 'Payée',
  complete: 'Terminé',
  annulee: 'Annulée',
  annule: 'Annulé',
  echec: 'Échec',

  // Achats, contrats, factures, règlements et analyses SONASP
  brouillon: 'Brouillon',
  pret_soumission: 'Prêt pour soumission',
  prete: 'Prête',
  soumis: 'Soumis',
  soumise: 'Soumise',
  partiellement_approuve: 'Partiellement approuvé',
  approuve: 'Approuvé',
  approuvee: 'Approuvée',
  rejete: 'Rejeté',
  rejetee: 'Rejetée',
  en_execution: 'En cours d’exécution',
  cloture: 'Clôturé',
  cloturee: 'Clôturée',
  modification_demandee: 'Modification demandée',
  expiree: 'Expirée',
  emise: 'Émise',
  certifiee: 'Certifiée',
  echec_certification: 'Échec de certification',
  partiellement_payee: 'Partiellement payée',
  contestee: 'Contestée',
  suspendue: 'Suspendue',
  enregistre: 'Enregistré',
  revue_juridique: 'Revue juridique',
  validation_metier: 'Validation métier',
  validation_financiere: 'Validation financière',
  signe: 'Signé',
  actif: 'Actif',
  suspendu: 'Suspendu',
  echu: 'Échu',
  resilie: 'Résilié',
  analysee: 'Analysée',
  contre_analyse_requise: 'Contre-analyse requise',
  laboratoire_independant_requis: 'Laboratoire indépendant requis',
  tranchee: 'Tranchée',
  non_conforme: 'Non conforme',

  // Réserve nationale (les vues spécialisées peuvent préciser le genre)
  validated_level_1: 'Validation de niveau 1',
  validated_level_2: 'Validation de niveau 2',
  transfer_authorized: 'Transfert autorisé',
  reconciliation_pending: 'Rapprochement en attente',
  reconciled: 'Rapproché',
  discrepancy_review: 'Analyse d’écart',
};

/**
 * Retourne toujours un libellé de présentation français.
 * Un code inconnu n'est jamais réaffiché brut dans l'interface.
 */
export function formatStatusFr(
  status?: string | null,
  unknownLabel = 'Statut non reconnu',
): string {
  const normalizedStatus = status?.trim().toLocaleLowerCase('fr-FR');
  return normalizedStatus ? STATUS_LABELS_FR[normalizedStatus] || unknownLabel : unknownLabel;
}

/**
 * Obtient la couleur du badge selon le status
 */
export function getStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    // Statuses positifs/complétés
    'approved': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    'completed': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    'sold': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    'refined': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    'received': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    'received_at_refinery': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    'approved_by_customs': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    
    // Statuses en cours
    'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    'in_safe': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    'ready_for_shipping': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    'ready_for_customs': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    'ready_for_expedition': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    'awaiting_approval': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    'in_sale': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    
    // Statuses expédition
    'shipped': { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
    'shipped_to_refinery': { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
    
    // Statuses négatifs
    'rejected': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    'cancelled': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
    
    // Statuses brouillon
    'draft': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
    'prepared': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
  };
  
  return colorMap[status] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };
}
