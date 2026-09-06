// Isolated visual fixtures. No database calls, financial actions or messages are sent.
import { qaRole } from './mock-auth';
import { collectorPayload } from '../../src/lib/collectorDossier';
import type { CollectorFormValues } from '../../src/lib/collectorDossier';
const sites = [{ id: 'site-a', name: 'Site artisanal Nongtaaba', locality: 'Ouagadougou', region: 'Centre' }, { id: 'site-b', name: 'Site artisanal Wend-Panga', locality: 'Ziniaré', region: 'Plateau-Central' }];
const organizations = [{ id: 'org-a', name: 'Comptoir Faso Or', code: 'CFO', organization_type: 'comptoir' }, { id: 'org-sonasp', name: 'SONASP', code: 'SONASP', organization_type: 'sonasp' }];
let rows: unknown[] = [
  { id: 'qa-incomplete', identity: { id: 'qa-incomplete', nom: 'COMPAORE', prenoms: 'Aminata', type_personne: 'physique', type_artisan: 'collecteur', telephone: '+226 74 89 01 23', commune: 'Fada N’Gourma', region: 'Est', pays: 'Burkina Faso' }, organization_id: '', organization_name: '', organization_type: null, site_ids: [], sites: [], version: 0, is_legacy: true, payment_authorized_until: null, account_user_id: null },
  { id: 'qa-complete', identity: { id: 'qa-complete', nom: 'COLLECTEUR', prenoms: 'De recette', type_personne: 'physique', type_artisan: 'collecteur', numero_carte: 'CARTE-RECETTE', date_naissance: '1990-01-01', telephone: '+226 70 00 00 00', whatsapp_identique: true, email: 'recette@example.test', commune: 'Ouagadougou', region: 'Centre', pays: 'Burkina Faso', type_piece_identite: 'CNI', numero_piece_identite: 'RECETTE' }, organization_id: organizations[0].id, organization_name: organizations[0].name, organization_type: 'comptoir', site_ids: sites.map(s => s.id), sites, version: 1, payment_authorized_until: '2027-12-31T23:59:59Z', account_user_id: 'test-collector', can_delegate_payment: true },
];
let sale = { id: 'sale-a', collector_id: 'qa-complete', artisan_id: 'artisan-a', collector_name: 'Collecteur de démonstration', artisan_name: 'Artisan de démonstration', site_name: sites[0].name, organization_name: organizations[0].name, quantity: 25, total: 1487500, status: 'submitted', date: '2026-09-06', version: 1, notifications: [] as Array<{recipient: string; status: string}> };
export const collectorService = {
  references: async () => ({ sites, organizations }), list: async () => rows,
  save: async (values: CollectorFormValues, id: string, version: number) => { const org = organizations.find(o => o.id === values.organization_id)!; const row = { id, identity: { ...collectorPayload(values).identity, id, numero_carte: null }, organization_id: org.id, organization_name: org.name, organization_type: org.organization_type, site_ids: values.site_ids, sites: sites.filter(s => values.site_ids.includes(s.id)), version: (version || 0) + 1, payment_authorized_until: null, account_user_id: null }; rows = [row]; return row; },
  sales: async () => [{ ...sale, can_approve: qaRole() !== 'collector' && sale.status === 'submitted', can_issue_invoice: qaRole() !== 'collector' && sale.status === 'approved', can_pay: false }],
  saleArtisans: async () => [{ id: 'artisan-a', name: 'Artisan de démonstration', site_id: sites[0].id, site_name: sites[0].name }],
  submitSale: async (id: string, data: { quantity: number; price: number; date: string }) => { sale = { ...sale, ...data, id, total: data.quantity * data.price / 1000 * 1.19, status: 'submitted', version: 1, notifications: [] }; return id; },
  decideSale: async (_sale: unknown, decision: string) => { sale = { ...sale, status: decision, version: 2, notifications: [{ recipient: 'Artisan', status: 'envoye' }, { recipient: 'Collecteur', status: 'envoye' }] }; },
  dispatchNotifications: async () => {}, authorizePayment: async () => {}, workspaceArtisanIds: async () => ['artisan-a'],
};
