import { useState } from 'react';
import { InternationalPaymentsView } from '../../../src/pages/payments/InternationalPaymentsView';
import { internationalPaymentFixture } from '../../../src/pages/payments/internationalPayments.fixture';

const names = ['StoneX Financial Inc.', 'Auramet Trading LLC', 'Mansa Resources SA'];
const countries = ['Suisse', 'Émirats Arabes Unis', 'Royaume-Uni'];
const statuses = ['pending', 'approved', 'pending', 'processing', 'pending', 'approved'];
const payments = Array.from({ length: 28 }, (_, i) => {
  const status = statuses[i % statuses.length];
  return internationalPaymentFixture({
    id: `visual-payment-${i}`, sale_id: `visual-sale-${i}`, amount: [2041279.25, 2252130, 2984612, 3438687, 2445296, 2622296][i % 6],
    invoice_number: i % 4 === 0 ? `INV-20260820-${i}D3F41B9` : `FA-2026-${String(i + 1).padStart(3, '0')}`,
    status, is_virtual: status === 'pending', due_date: i % 4 === 0 ? '2026-09-21' : `2026-${String(8 - i % 6).padStart(2, '0')}-15`,
    actual_date: status === 'approved' ? `2026-${String(8 - i % 6).padStart(2, '0')}-20` : null,
    created_at: `2026-08-${String(28 - i).padStart(2, '0')}T09:00:00Z`, bank_name: i % 3 ? 'Coris Bank International' : 'Banque Atlantique',
    sale: { ...internationalPaymentFixture().sale!, id: `visual-sale-${i}`, sale_number: `SL-2026-${String(i + 1).padStart(3, '0')}`, customer_id: `client-${i % 3}`, customer: { id: `client-${i % 3}`, name: names[i % 3], country: countries[i % 3] } },
  });
});
export function PaymentsListCase() {
  const [message, setMessage] = useState('');
  return <><InternationalPaymentsView payments={payments} today="2026-08-30" canCreate
    onRefresh={() => setMessage('Actualisation demandée (contrôle local).')}
    onOpenPayment={(id) => setMessage(`Détail du paiement : ${id}`)}
    onOpenSale={(id) => setMessage(`Détail de la vente : ${id}`)}
    onCreate={(id) => setMessage(`Formulaire de versement : ${id || 'sélection libre'}`)} />
    {message && <p role="status">{message}</p>}</>;
}
