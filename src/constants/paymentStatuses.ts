export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  WAITING_FOR_PAYMENT: 'waiting_for_payment',
  VIRTUAL_PAYMENT: 'virtual_payment',
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_VERIFIED: 'payment_verified',
  PAYMENT_REJECTED: 'payment_rejected',
  COMPLETED: 'completed'
} as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUSES.PENDING]: 'En Attente',
  [PAYMENT_STATUSES.WAITING_FOR_PAYMENT]: 'Attente de Paiement',
  [PAYMENT_STATUSES.VIRTUAL_PAYMENT]: 'Paiement Virtuel',
  [PAYMENT_STATUSES.PAYMENT_RECEIVED]: 'Paiement Reçu',
  [PAYMENT_STATUSES.PAYMENT_VERIFIED]: 'Paiement Vérifié',
  [PAYMENT_STATUSES.PAYMENT_REJECTED]: 'Paiement Rejeté',
  [PAYMENT_STATUSES.COMPLETED]: 'Complété'
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUSES.PENDING]: 'bg-gray-100 text-gray-800 border-gray-300',
  [PAYMENT_STATUSES.WAITING_FOR_PAYMENT]: 'bg-blue-100 text-blue-800 border-blue-300',
  [PAYMENT_STATUSES.VIRTUAL_PAYMENT]: 'bg-slate-100 text-slate-800 border-slate-300',
  [PAYMENT_STATUSES.PAYMENT_RECEIVED]: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  [PAYMENT_STATUSES.PAYMENT_VERIFIED]: 'bg-green-100 text-green-800 border-green-300',
  [PAYMENT_STATUSES.PAYMENT_REJECTED]: 'bg-red-100 text-red-800 border-red-300',
  [PAYMENT_STATUSES.COMPLETED]: 'bg-gray-100 text-gray-800 border-gray-300'
};

export const PAYMENT_STATUS_DESCRIPTIONS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUSES.PENDING]: 'Paiement en attente d\'initialisation',
  [PAYMENT_STATUSES.WAITING_FOR_PAYMENT]: 'En attente du paiement du client',
  [PAYMENT_STATUSES.VIRTUAL_PAYMENT]: 'Paiement virtuel enregistré',
  [PAYMENT_STATUSES.PAYMENT_RECEIVED]: 'Paiement reçu, en attente de vérification',
  [PAYMENT_STATUSES.PAYMENT_VERIFIED]: 'Paiement vérifié et validé',
  [PAYMENT_STATUSES.PAYMENT_REJECTED]: 'Paiement rejeté ou annulé',
  [PAYMENT_STATUSES.COMPLETED]: 'Transaction de paiement complétée'
};

export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PAYMENT_STATUSES.PENDING]: [PAYMENT_STATUSES.WAITING_FOR_PAYMENT],
  [PAYMENT_STATUSES.WAITING_FOR_PAYMENT]: [
    PAYMENT_STATUSES.VIRTUAL_PAYMENT,
    PAYMENT_STATUSES.PAYMENT_RECEIVED,
    PAYMENT_STATUSES.PAYMENT_REJECTED
  ],
  [PAYMENT_STATUSES.VIRTUAL_PAYMENT]: [PAYMENT_STATUSES.PAYMENT_VERIFIED, PAYMENT_STATUSES.PAYMENT_REJECTED],
  [PAYMENT_STATUSES.PAYMENT_RECEIVED]: [PAYMENT_STATUSES.PAYMENT_VERIFIED, PAYMENT_STATUSES.PAYMENT_REJECTED],
  [PAYMENT_STATUSES.PAYMENT_VERIFIED]: [PAYMENT_STATUSES.COMPLETED],
  [PAYMENT_STATUSES.PAYMENT_REJECTED]: [],
  [PAYMENT_STATUSES.COMPLETED]: []
};
