import type { DetailPayment, InternationalPaymentDetail } from '@/services/internationalPaymentDetailService';
import { paymentDocumentLocation, paymentDocuments } from '@/services/internationalPaymentDetailService';
import { internationalPaymentBalance } from '@/services/internationalPaymentBalance';
import type { DocumentDossier, EvenementDossier } from '@/services/dossierService';
import { paymentAmount, paymentMoney } from './internationalPaymentsList';

export const paymentReference = (payment: DetailPayment) => payment.reference_number || payment.transaction_id || payment.id;
export function detailDate(value?: string | null, withTime = false): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Non renseignée';
  // A date-only banking value does not imply a midnight transaction time.
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', ...(withTime && value.includes('T') ? { timeStyle: 'short' as const } : {}), timeZone: 'Africa/Abidjan' }).format(new Date(value));
}
export function detailStatus(payment: DetailPayment) {
  if (payment.status === 'approved' && payment.is_virtual === false) return { label: 'Payé', tone: 'success' as const, title: 'Paiement confirmé', description: 'Ce versement a été confirmé dans la plateforme.' };
  if (payment.status === 'processing' && payment.is_virtual === false) return { label: 'À rapprocher', tone: 'info' as const, title: 'Rapprochement en attente', description: 'Le versement est enregistré. Sa confirmation reste à effectuer.' };
  if (payment.status === 'pending') return { label: 'En attente', tone: 'warning' as const, title: 'Paiement attendu', description: 'Cet engagement ne constitue pas encore un encaissement confirmé.' };
  if (payment.status === 'rejected') return { label: 'Rejeté', tone: 'danger' as const, title: 'Paiement rejeté', description: payment.rejection_reason || 'Ce paiement n’est pas comptabilisé comme encaissé.' };
  if (payment.status === 'cancelled') return { label: 'Annulé', tone: 'neutral' as const, title: 'Paiement annulé', description: payment.cancellation_reason || 'Ce paiement n’est pas comptabilisé comme encaissé.' };
  if (payment.status === 'failed') return { label: 'Échec', tone: 'danger' as const, title: 'Échec du paiement', description: 'Ce paiement n’est pas comptabilisé comme encaissé.' };
  return { label: 'À vérifier', tone: 'neutral' as const, title: 'Statut à vérifier', description: 'Les informations disponibles ne permettent pas de confirmer ce versement.' };
}
export function paymentFinance(detail: InternationalPaymentDetail) {
  const { payment, payments, sale } = detail;
  const balance = payments ? internationalPaymentBalance(sale.final_proceeds, sale.currency, payments)
    : { confirmed: null, processing: null, outstanding: null, available: null };
  const confirmedCurrent = payment.status === 'approved' && payment.is_virtual === false && payment.currency === sale.currency;
  const current = paymentAmount(payment.amount);
  const otherConfirmed = balance.confirmed !== null && current !== null ? Math.round((balance.confirmed - (confirmedCurrent ? current : 0)) * 100) / 100 : null;
  const share = current !== null && sale.final_proceeds > 0 && payment.currency === sale.currency ? current / sale.final_proceeds * 100 : null;
  return { ...balance, otherConfirmed, share, settled: balance.outstanding !== null && Math.abs(balance.outstanding) < 0.005 };
}
export function currentPaymentEvents(payment: DetailPayment): EvenementDossier[] {
  const status = detailStatus(payment);
  return [
    [payment.created_at, 'Paiement enregistré'],
    [payment.actual_date, 'Date de paiement déclarée'],
    [payment.executed_at, 'Exécution enregistrée'],
    [payment.approved_at, 'Paiement confirmé'],
    [payment.rejected_at, 'Paiement rejeté'],
    [payment.cancelled_at, 'Paiement annulé'],
  ].filter(([date, title]) => date && (title !== 'Paiement confirmé' || status.label === 'Payé'))
    .map(([date, titre]) => ({ etape: 'paiement' as const, date, titre: titre!, detail: `${paymentReference(payment)} · ${paymentMoney(paymentAmount(payment.amount), payment.currency)}` }));
}
export function paymentHistory(detail: InternationalPaymentDetail): EvenementDossier[] {
  const history = [...(detail.dossier?.chronologie || [])];
  if (!history.some((event) => event.etape === 'paiement')) history.push(...(detail.payments || [detail.payment]).flatMap(currentPaymentEvents));
  return history.sort((a, b) => (a.date ? Date.parse(a.date) || 0 : 0) - (b.date ? Date.parse(b.date) || 0 : 0));
}
export function paymentOverviewTimeline(detail: InternationalPaymentDetail): EvenementDossier[] {
  const history = paymentHistory(detail);
  const stages = ['expedition', 'analyse', 'conciliation', 'vente'] as const;
  const events = stages.flatMap((stage) => history.filter((event) => event.etape === stage).slice(-1));
  const current = currentPaymentEvents(detail.payment).sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!));
  events.push(...current.slice(-1));
  return events.sort((a, b) => (Date.parse(a.date || '') || 0) - (Date.parse(b.date || '') || 0));
}
export function currentPaymentProof(detail: InternationalPaymentDetail): DocumentDossier | undefined {
  const references = [detail.payment.proof_url, detail.payment.payment_proof_url].filter(Boolean).map((chemin) => paymentDocumentLocation({ id: '', etape: 'paiement', source: 'payments', nom: null, chemin: chemin! })?.path).filter(Boolean);
  return paymentDocuments(detail).find((doc) => {
    const location = paymentDocumentLocation(doc);
    return location?.bucket === 'payment-proofs' && references.includes(location.path);
  });
}
