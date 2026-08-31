import type { InternationalSaleDetail } from '@/services/internationalSaleDetailService';

/** Test-only fixture: never imported by a production page or service. */
export function detailFixture(): InternationalSaleDetail {
  return {
    sale: { id: 'sale-a', sale_number: 'VE-2026-00038', status: 'virtual_payment', created_at: '2026-08-20T10:24:00Z', updated_at: '2026-08-28T14:30:00Z', created_by: 'author-a',
      sale_date: '2026-08-20', customer_id: 'customer-a', seller_id: 'sonasp-a', seller_type: 'sonasp', quantity_oz: 20,
      london_am_rate: 2500, final_price_per_oz: 2500, gross_proceeds: 50000, freight_cost: 500, other_costs: 100, net_proceeds: 49400,
      royalty_amount: 1400, final_proceeds: 48000, currency: 'USD', payment_method: 'bank_transfer', payment_terms: 'À réception', mechanism_type: 'spot',
      payment_amount: 28000, payment_received_at: null, shipping_preparation_id: 'shipment-a', management_approved_at: '2026-08-21T10:00:00Z', customer_approved_at: '2026-08-22T14:00:00Z',
      management_rejected_at: null, customer_rejected_at: null, completed_at: null,
      customer: { id: 'customer-a', name: 'Gold Trade Space', country: 'Suisse', email: 'client@example.test', phone: null } },
    payments: [
      { id: 'payment-a', sale_id: 'sale-a', amount: 24000, currency: 'USD', status: 'approved', is_virtual: false, invoice_number: 'FACT-2026-00891', expected_date: '2026-08-21', actual_date: '2026-08-21', created_at: '2026-08-21T10:00:00Z', approved_at: '2026-08-22T11:00:00Z', executed_at: '2026-08-21T11:00:00Z', reference_number: 'BANK-2026-0001', payment_type: 'actual', version: 2 },
      { id: 'payment-b', sale_id: 'sale-a', amount: 4000, currency: 'USD', status: 'processing', is_virtual: false, invoice_number: null, expected_date: '2026-08-25', actual_date: '2026-08-25', created_at: '2026-08-25T10:00:00Z', approved_at: null, executed_at: '2026-08-25T11:00:00Z', reference_number: 'BANK-2026-0002', payment_type: 'actual', version: 1 },
      { id: 'payment-c', sale_id: 'sale-a', amount: 20000, currency: 'USD', status: 'pending', is_virtual: true, invoice_number: null, expected_date: '2026-08-30', actual_date: null, created_at: '2026-08-26T10:00:00Z', approved_at: null, executed_at: null, reference_number: null, payment_type: 'virtual', version: 3 },
    ],
    documents: ['Facture commerciale.pdf', 'Bordereau d’expédition.pdf', 'Certificat d’origine.pdf', 'Certificat d’affinage.pdf', 'Assurance.pdf'].map((label, i) => ({ documentId: `doc-${i}`, type: i === 0 ? 'invoice' : 'other', label, description: i === 0 ? 'Référence FACT-2026-00891' : 'Pièce rattachée à cette vente', available: true, generatedDate: '2026-08-27T10:00:00Z', fileName: label, icon: 'FileText', color: '', bgColor: '' })),
    shipment: { id: 'shipment-a', expedition_lot_number: 'LOT-2026-038', shipped_at: '2026-08-27T10:00:00Z', prepared_at: '2026-08-25T10:00:00Z', export_license_id: 'license-a', license_id: null, status: 'ready_for_expedition', shipped_to_company: 'Gold Trade Space', shipped_to_country: 'Suisse', shipped_to_address: 'Genève', total_boxes: 2, total_gross_weight_grams: 630, total_net_weight_grams: 622.07, seal_number: 'SC-2026-001' },
    companyName: 'SONASP', creatorName: 'TIEGNAN Romuald', licenseNumber: 'L-2026-001',
    conciliations: [{ id: 'conciliation-a', sale_id: 'sale-a', reference: 'CONC-2026-038', statut: 'analyse_recue', ca_initial: 50000, ca_final: 49000, devise_initiale: 'USD', devise_finale: 'USD', or_fin_initial_g: 622.069536, or_fin_final_g: 610, created_at: '2026-08-27T12:00:00Z', updated_at: '2026-08-28T12:00:00Z' }],
    origins: [{ source_type: 'achat_mine', source_id: 'purchase-a', reference: 'ACH-2026-001', origine: 'Mine Alpha', quantite_oz: 20 }], unavailable: [],
  };
}
