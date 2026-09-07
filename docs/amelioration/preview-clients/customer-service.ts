// Import relatif : réutilise les vrais agrégats sans réentrer dans l'alias de ce fichier.
export { customerActivity, customerStatusLabels, paymentTermLabels } from '../../../src/services/customerDossierService';
export type { CustomerRow, CustomerSale, CustomerDossier } from '../../../src/services/customerDossierService';
import type { CustomerRow, CustomerSale } from '../../../src/services/customerDossierService';

const mode = () => new URLSearchParams(window.location.search).get('mode');
export const clientId = (index: number) => `ca000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const clients: CustomerRow[] = Array.from({ length: 25 }, (_, index) => ({
  id: clientId(index + 1), name: index === 0 ? 'QA Atlas Gold Trading SA' : index === 1 ? 'QA Akwaaba Metals Ltd' : `QA Partenaire international ${String(index + 1).padStart(2, '0')}`,
  email: `client-${index + 1}@example.test`, phone: '+226 00 00 00 00', country: ['Suisse', 'Ghana', 'Burkina Faso', 'Émirats arabes unis'][index % 4],
  address: 'Adresse fictive — immeuble de démonstration', contact_person: 'Responsable fictif', tax_id: `QA-FISCAL-${index + 1}`,
  payment_terms: index % 2 ? 'Immediate' : 'Net 30 days', credit_limit: index === 0 ? 0 : 500000,
  status: index === 24 ? null : (['active', 'pending', 'inactive'] as const)[index % 3],
  created_at: '2026-08-01T09:00:00Z', updated_at: '2026-09-01T10:00:00Z', is_active: true, company: null,
}));
const sales: CustomerSale[] = [
  { id: 'ce000000-0000-4000-8000-000000000001', customer_id: clientId(1), sale_number: 'QA-VENTE-2026-001', created_at: '2026-08-08T12:00:00Z', status: 'completed', quantity_oz: 100, final_proceeds: 320000, currency: 'USD' },
  { id: 'ce000000-0000-4000-8000-000000000002', customer_id: clientId(1), sale_number: 'QA-VENTE-2026-002', created_at: '2026-09-02T12:00:00Z', status: 'management_approved', quantity_oz: 40, final_proceeds: 125000, currency: 'USD' },
];
export async function loadCustomerDirectory() {
  if (mode() === 'error') throw new Error('Simulation : le répertoire des clients est indisponible.');
  return structuredClone(mode() === 'empty' ? [] : clients);
}
export async function loadCustomerSales(id?: string) {
  if (['error', 'sales-error'].includes(mode() || '')) throw new Error('Simulation : les données de ventes sont indisponibles.');
  return structuredClone(mode() === 'empty' ? [] : sales.filter(sale => !id || sale.customer_id === id));
}
export async function loadCustomerDossier(id: string) {
  if (mode() === 'error') throw new Error('Simulation : le dossier client est indisponible.');
  const customer = clients.find(client => client.id === id);
  if (!customer || mode() === 'empty') throw new Error('Le dossier fictif demandé est introuvable.');
  return structuredClone({ customer, banks: id === clientId(1) ? [{ id: 'cb000000-0000-4000-8000-000000000001', bankName: 'Banque fictive de présentation', country: 'Suisse', city: 'Genève', currency: 'USD', accountNumber: 'QA-0001', iban: '', swiftCode: '', isPrimary: true, isActive: true }] : [] });
}
export async function saveCustomerDossier() {
  throw new Error('Aperçu de présentation : aucune persistance disponible. L’enregistrement est indisponible et aucune donnée n’a été sauvegardée.');
}
