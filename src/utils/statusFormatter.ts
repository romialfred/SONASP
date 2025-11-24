/**
 * Formate un status technique en texte lisible pour l'utilisateur
 * Exemples:
 * - ready_for_expedition → Ready for Expedition
 * - in_safe → In Safe
 * - approved_by_customs → Approved by Customs
 */
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
 * Formate un status avec traduction française si disponible
 */
export function formatStatusFr(status: string): string {
  const translations: Record<string, string> = {
    // Production statuses
    'prepared': 'Préparé',
    'in_safe': 'En Coffre',
    'ready_for_shipping': 'Prêt pour Expédition',
    'shipped': 'Expédié',
    'received_at_refinery': 'Reçu à la Raffinerie',
    'refined': 'Raffiné',
    'in_sale': 'En Vente',
    'sold': 'Vendu',
    
    // Shipping statuses
    'pending': 'En Attente',
    'ready_for_customs': 'Prêt pour Douane',
    'approved_by_customs': 'Approuvé par Douane',
    'ready_for_expedition': 'Prêt pour Expédition',
    'shipped_to_refinery': 'Expédié vers Raffinerie',
    
    // Freight statuses
    'approved': 'Approuvé',
    'received': 'Reçu',
    
    // Sales statuses
    'draft': 'Brouillon',
    'awaiting_approval': 'En Attente d\'Approbation',
    'approved': 'Approuvé',
    'rejected': 'Rejeté',
    'completed': 'Terminé',
    'cancelled': 'Annulé',
  };
  
  return translations[status] || formatStatus(status);
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
