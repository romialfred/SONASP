import { z } from 'zod';

const numericField = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const parsed = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(parsed) ? parsed : 0;
  });

const saleCustomerSchema = z
  .object({
    id: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
  })
  .optional()
  .nullable();

export const saleSummarySchema = z.object({
  id: z.string(),
  sale_number: z.string(),
  status: z.string().optional().nullable(),
  created_at: z.string(),
  quantity_oz: numericField,
  final_proceeds: numericField,
  royalty_amount: numericField,
  customer: saleCustomerSchema,
});

export const saleDetailSchema = saleSummarySchema.extend({
  london_am_rate: numericField,
  freight_cost: numericField,
  other_costs: numericField,
  gross_proceeds: numericField,
  net_proceeds: numericField,
  royalty_amount: numericField,
  notes: z.string().optional().nullable(),
  mechanism_type: z.string().optional().nullable(),
});

export const saleSummaryListSchema = z.array(saleSummarySchema);

export type SaleSummaryRecord = z.infer<typeof saleSummarySchema>;
export type SaleDetailRecord = z.infer<typeof saleDetailSchema>;

export type SaleStatus =
  | 'create_sales'
  | 'pending_management_approval'
  | 'management_approved'
  | 'management_rejected'
  | 'pending_for_customer_approval'
  | 'customer_approved'
  | 'customer_rejected'
  | 'waiting_for_payment'
  | 'virtual_payment'
  | 'payment_received'
  | 'completed'
  | 'pending'
  | 'approved'
  | 'rejected';

const SALE_STATUS_MAP: Partial<Record<string, SaleStatus>> = {
  create_sales: 'create_sales',
  pending_management_approval: 'pending_management_approval',
  management_approved: 'management_approved',
  management_rejected: 'management_rejected',
  pending_for_customer_approval: 'pending_for_customer_approval',
  customer_approved: 'customer_approved',
  customer_rejected: 'customer_rejected',
  waiting_for_payment: 'waiting_for_payment',
  virtual_payment: 'virtual_payment',
  payment_received: 'payment_received',
  completed: 'completed',
  pending: 'pending_management_approval',
  pending_approval: 'pending_management_approval',
  awaiting_approval: 'pending_management_approval',
  approved: 'management_approved',
  customerapproval: 'customer_approved',
  paid: 'payment_received',
  finished: 'completed',
  closed: 'completed',
  rejected: 'management_rejected',
  declined: 'management_rejected',
  cancelled: 'management_rejected',
};

export function normalizeSaleStatus(rawStatus: string | null | undefined): SaleStatus {
  if (!rawStatus) {
    return 'pending_management_approval';
  }

  const normalized = rawStatus.toLowerCase().replace(/\s+/g, '_');
  const mappedStatus = SALE_STATUS_MAP[normalized];

  if (mappedStatus) {
    return mappedStatus;
  }

  // If status not in map, return as-is if it's a valid SaleStatus
  const validStatuses: SaleStatus[] = [
    'create_sales',
    'pending_management_approval',
    'management_approved',
    'management_rejected',
    'pending_for_customer_approval',
    'customer_approved',
    'customer_rejected',
    'waiting_for_payment',
    'virtual_payment',
    'payment_received',
    'completed',
    'pending',
    'approved',
    'rejected'
  ];

  if (validStatuses.includes(normalized as SaleStatus)) {
    return normalized as SaleStatus;
  }

  return 'pending_management_approval';
}

export function extractCustomerName(customer: SaleSummaryRecord['customer']): string {
  if (!customer) {
    return 'Unknown Customer';
  }

  const name = customer.name?.trim();
  if (name && name.length > 0) {
    return name;
  }

  return 'Unknown Customer';
}
