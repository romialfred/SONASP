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
});

export const saleSummaryListSchema = z.array(saleSummarySchema);

export type SaleSummaryRecord = z.infer<typeof saleSummarySchema>;
export type SaleDetailRecord = z.infer<typeof saleDetailSchema>;

export type SaleStatus =
  | 'pending'
  | 'approved'
  | 'customer_approved'
  | 'payment_received'
  | 'completed'
  | 'rejected';

const SALE_STATUS_MAP: Record<string, SaleStatus> = {
  pending: 'pending',
  pending_approval: 'pending',
  awaiting_approval: 'pending',
  approved: 'approved',
  management_approved: 'approved',
  customer_approved: 'customer_approved',
  customerapproval: 'customer_approved',
  payment_received: 'payment_received',
  paid: 'payment_received',
  completed: 'completed',
  finished: 'completed',
  closed: 'completed',
  rejected: 'rejected',
  declined: 'rejected',
  cancelled: 'rejected',
};

export function normalizeSaleStatus(rawStatus: string | null | undefined): SaleStatus {
  if (!rawStatus) {
    return 'pending';
  }

  const normalized = rawStatus.toLowerCase().replace(/\s+/g, '_');
  return SALE_STATUS_MAP[normalized] ?? 'pending';
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
