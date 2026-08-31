import type { DetailPayment, InternationalPaymentDetail } from '@/services/internationalPaymentDetailService';

/** Test/isolated visual harness only. Never imported by the application route. */
export function detailPaymentFixture(overrides: Partial<DetailPayment> = {}): DetailPayment {
  return { id: 'payment-a', sale_id: 'sale-a', amount: 2041278.86, currency: 'USD', status: 'approved', is_virtual: false,
    expected_date: '2026-06-09', due_date: '2026-06-09', actual_date: '2026-06-09',
    created_at: '2026-06-09T15:45:00Z', created_by: 'author-a', executed_at: '2026-06-09T15:45:00Z', executed_by: 'author-a',
    approved_at: '2026-06-09T16:05:00Z', approved_by: 'reviewer-a', verified_at: '2026-06-09T16:05:00Z', verified_by: 'reviewer-a',
    rejected_at: null, rejection_reason: null, cancelled_at: null, cancellation_reason: null,
    invoice_number: 'FACT-2026-004', reference_number: 'TRF-2026-0609-001', transaction_id: 'FT20260609001532',
    payment_method: 'bank_transfer', payment_type: 'actual', bank_name: 'Banque de démonstration', account_number: null,
    customer_bank_id: 'bank-a', seller_bank_id: 'receiver-a', received_amount: 2041278.86, payment_currency: 'USD', receiving_currency: 'USD',
    fx_rate: 1, fx_rate_date: '2026-06-09', fx_rate_source: 'Devise identique', notes: 'Paiement final correspondant à la facture FACT-2026-004.',
    proof_url: 'payment-a/confirmation.pdf', payment_proof_url: null, ...overrides };
}
export function paymentDetailFixture(): InternationalPaymentDetail {
  const payment = detailPaymentFixture();
  return { payment,
    sale: { id: 'sale-a', sale_number: 'SL-2026-004', final_proceeds: 4204127.86, currency: 'USD', customer_id: 'customer-a', status: 'payment_received', seller_type: 'sonasp',
      customer: { id: 'customer-a', name: 'Gold Trade Space', country: 'Suisse', email: 'client@example.test', phone: '+41 00 000 00 00' } },
    payments: [detailPaymentFixture({ id: 'advance-a', reference_number: 'TRF-2026-0521-001', amount: 1500000, actual_date: '2026-05-21', approved_at: '2026-05-21T11:20:00Z' }), detailPaymentFixture({ id: 'advance-b', reference_number: 'TRF-2026-0528-001', amount: 662849, actual_date: '2026-05-28', approved_at: '2026-05-28T14:10:00Z' }), payment],
    customerBank: { id: 'bank-a', customer_id: 'customer-a', bank_name: 'Banque de démonstration', account_number: 'Compte de test', iban: 'IBAN de démonstration', swift_code: 'BIC de test', currency: 'USD' },
    receivingBank: { id: 'receiver-a', bank_name: 'Banque SONASP — test', account_name: 'SONASP — Opérations internationales', account_number: 'Compte de test', iban: null, swift_code: null, account_currency: 'USD' },
    actors: { 'author-a': 'TIEGNAN Romuald', 'reviewer-a': 'Responsable du rapprochement' }, unavailable: [],
    dossier: { ancre: { type: 'paiement', id: payment.id },
      chaine: { expeditions: [{ id: 'shipment-a', reference: 'EXP-2026-004', raffinerie: 'Raffinerie de démonstration' }],
        analyses: [{ id: 'analysis-a', reference: 'CERT-2026-004', date: '2026-05-07', laboratoire: 'Laboratoire de démonstration', or_pct: 99.99 }],
        conciliation: { id: 'conciliation-a', reference: 'CONC-2026-004', statut: 'validee', ca_initial: 4210000, ca_final: 4204127.86, devise: 'USD', valide_le: '2026-05-09T10:00:00Z' },
        vente: { id: 'sale-a', reference: 'SL-2026-004' } },
      documents: [
        { id: 'doc-proof', source: 'snp_payment_proofs', etape: 'paiement', nom: 'Confirmation bancaire.pdf', chemin: 'payment-a/confirmation.pdf', date: '2026-06-09T15:45:00Z', type_mime: 'application/pdf', taille: 190464 },
        { id: 'doc-sale', source: 'sales_documents', etape: 'vente', nom: 'Facture commerciale.pdf', chemin: 'sale-a/facture.pdf', date: '2026-05-10T08:30:00Z', type_mime: 'application/pdf', taille: 253952 },
        { id: 'doc-refining', source: 'assay_certificates', etape: 'analyse', nom: 'Certificat d’analyse.pdf', chemin: 'analysis-a/certificat.pdf', date: '2026-05-07T10:30:00Z', type_mime: 'application/pdf', taille: 128000 },
        { id: 'doc-shipping', source: 'shipping_documents', etape: 'expedition', nom: 'Bordereau d’expédition.pdf', chemin: 'shipment-a/bordereau.pdf', date: '2026-05-01T09:00:00Z', type_mime: 'application/pdf', taille: 145000 },
      ],
      chronologie: [
        { etape: 'expedition', date: '2026-05-01T09:00:00Z', titre: 'Expédition vers la raffinerie', detail: 'EXP-2026-004' },
        { etape: 'analyse', date: '2026-05-07T10:30:00Z', titre: 'Résultats de raffinage reçus', detail: 'CERT-2026-004' },
        { etape: 'conciliation', date: '2026-05-09T10:00:00Z', titre: 'Conciliation validée', detail: 'CONC-2026-004', acteur: 'Responsable du contrôle' },
        { etape: 'vente', date: '2026-05-10T08:30:00Z', titre: 'Vente créée', detail: 'SL-2026-004' },
        { etape: 'paiement', date: '2026-05-21T11:20:00Z', titre: 'Premier versement confirmé', detail: '1 500 000 USD' },
        { etape: 'paiement', date: '2026-05-28T14:10:00Z', titre: 'Deuxième versement confirmé', detail: '662 849 USD' },
        { etape: 'paiement', date: '2026-06-09T16:05:00Z', titre: 'Solde confirmé', detail: '2 041 278,86 USD', acteur: 'Responsable du rapprochement' },
      ], comptes: {},
    },
  };
}
