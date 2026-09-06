// Isolated visual fixtures. No database calls, financial actions or messages are sent.
import { qaRole } from './mock-auth';
import { collectorPayload } from '../../src/lib/collectorDossier';
import type { CollectorFormValues } from '../../src/lib/collectorDossier';
const sites = [{ id: 'site-a', name: 'Site artisanal Nongtaaba', locality: 'Ouagadougou', region: 'Centre' }, { id: 'site-b', name: 'Site artisanal Wend-Panga', locality: 'Ziniaré', region: 'Plateau-Central' }];
const organizations = [{ id: 'org-a', name: 'Comptoir Faso Or', code: 'CFO', organization_type: 'comptoir' }, { id: 'org-sonasp', name: 'SONASP', code: 'SONASP', organization_type: 'sonasp' }];
let rows: unknown[] = [];
let sale = { id: 'sale-a', collector_name: 'Collecteur de démonstration', artisan_name: 'Artisan de démonstration', site_name: sites[0].name, organization_name: organizations[0].name, quantity: 25, total: 1487500, status: 'submitted', date: '2026-09-06', version: 1, notifications: [] as Array<{recipient: string; status: string}> };
export const collectorService = {
  references: async () => ({ sites, organizations }), list: async () => rows,
  save: async (values: CollectorFormValues, id: string, version: number) => { const org = organizations.find(o => o.id === values.organization_id)!; const row = { id, identity: { ...collectorPayload(values).identity, id, numero_carte: null }, organization_id: org.id, organization_name: org.name, organization_type: org.organization_type, site_ids: values.site_ids, sites: sites.filter(s => values.site_ids.includes(s.id)), version: (version || 0) + 1, payment_authorized_until: null, account_user_id: null }; rows = [row]; return row; },
  sales: async () => [{ ...sale, can_approve: qaRole() !== 'collector' && sale.status === 'submitted', can_issue_invoice: qaRole() !== 'collector' && sale.status === 'approved', can_pay: false }],
  saleArtisans: async () => [{ id: 'artisan-a', name: 'Artisan de démonstration', site_id: sites[0].id, site_name: sites[0].name }],
  submitSale: async (id: string, data: { quantity: number; price: number; date: string }) => { sale = { ...sale, ...data, id, total: data.quantity * data.price / 1000 * 1.19, status: 'submitted', version: 1, notifications: [] }; return id; },
  decideSale: async (_sale: unknown, decision: string) => { sale = { ...sale, status: decision, version: 2, notifications: [{ recipient: 'Artisan', status: 'envoye' }, { recipient: 'Collecteur', status: 'envoye' }] }; },
  dispatchNotifications: async () => {}, authorizePayment: async () => {}, workspaceArtisanIds: async () => ['artisan-a'],
};
