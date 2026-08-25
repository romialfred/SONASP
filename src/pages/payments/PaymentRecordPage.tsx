import { PaymentCreate } from './PaymentCreate';

/**
 * Ancien point d'entrée conservé pour les favoris et liens historiques.
 * Le formulaire canonique est unique afin qu'aucun ancien écran ne puisse
 * réintroduire un INSERT de paiement ou une analyse FX hors transaction 4H.
 */
export function PaymentRecordPage() {
  return <PaymentCreate />;
}
