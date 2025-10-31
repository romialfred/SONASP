export const SALES_STATUSES = {
  CREATE_SALES: 'create_sales',
  PENDING_APPROVAL: 'pending_approval',
  CUSTOMER_REJECTED: 'customer_rejected',
  CUSTOMER_APPROVED: 'customer_approved',
  WAITING_FOR_PAYMENT: 'waiting_for_payment',
  VIRTUAL_PAYMENT: 'virtual_payment',
  PAYMENT_RECEIVED: 'payment_received',
  COMPLETED: 'completed'
} as const;

export type SalesStatus = typeof SALES_STATUSES[keyof typeof SALES_STATUSES];

export const INITIAL_SALE_STATUS = SALES_STATUSES.PENDING_APPROVAL;

export const STATUS_LABELS: Record<SalesStatus, string> = {
  [SALES_STATUSES.CREATE_SALES]: 'Draft',
  [SALES_STATUSES.PENDING_APPROVAL]: 'Pending Approval',
  [SALES_STATUSES.CUSTOMER_REJECTED]: 'Customer Rejected',
  [SALES_STATUSES.CUSTOMER_APPROVED]: 'Customer Approved',
  [SALES_STATUSES.WAITING_FOR_PAYMENT]: 'Awaiting Payment',
  [SALES_STATUSES.VIRTUAL_PAYMENT]: 'Virtual Payment',
  [SALES_STATUSES.PAYMENT_RECEIVED]: 'Payment Received',
  [SALES_STATUSES.COMPLETED]: 'Completed'
};

export const STATUS_COLORS: Record<SalesStatus, string> = {
  [SALES_STATUSES.CREATE_SALES]: 'bg-gray-100 text-gray-800 border-gray-300',
  [SALES_STATUSES.PENDING_APPROVAL]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  [SALES_STATUSES.CUSTOMER_REJECTED]: 'bg-red-100 text-red-800 border-red-300',
  [SALES_STATUSES.CUSTOMER_APPROVED]: 'bg-green-100 text-green-800 border-green-300',
  [SALES_STATUSES.WAITING_FOR_PAYMENT]: 'bg-blue-100 text-blue-800 border-blue-300',
  [SALES_STATUSES.VIRTUAL_PAYMENT]: 'bg-purple-100 text-purple-800 border-purple-300',
  [SALES_STATUSES.PAYMENT_RECEIVED]: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  [SALES_STATUSES.COMPLETED]: 'bg-gray-100 text-gray-800 border-gray-300'
};
