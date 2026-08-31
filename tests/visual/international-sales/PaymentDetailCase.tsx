import { useState } from 'react';
import { InternationalPaymentDetailView } from '../../../src/pages/payments/InternationalPaymentDetailView';
import { paymentDetailFixture } from '../../../src/pages/payments/internationalPaymentDetail.fixture';
export function PaymentDetailCase() {
  const [message, setMessage] = useState('');
  return <><InternationalPaymentDetailView detail={paymentDetailFixture()} onRefresh={() => setMessage('Actualisation demandée (contrôle visuel uniquement).')}
    onDownload={(doc) => { setMessage(`Téléchargement demandé : ${doc.nom}`); return Promise.resolve(); }} /><output role="status">{message}</output></>;
}
