import type { BadgeTone } from '@/components/ui/sn';
import type {
  ArtisanPaymentStatus,
  PaiementArtisan,
  TypePaiementArtisan,
} from '@/services/artisanPaiementsService';

export const ARTISAN_PAYMENT_STATUS_ORDER: ArtisanPaymentStatus[] = [
  'en_attente',
  'en_traitement',
  'valide',
  'complete',
  'annule',
  'echec',
];

export const ARTISAN_PAYMENT_ACTIVE_STATUSES: ArtisanPaymentStatus[] = [
  'en_attente',
  'en_traitement',
  'valide',
];

export const ARTISAN_PAYMENT_STATUS_LABELS: Record<ArtisanPaymentStatus, string> = {
  en_attente: 'Paiement préparé',
  en_traitement: 'À contrôler',
  valide: 'Contrôle validé',
  complete: 'Payé et clôturé',
  annule: 'Annulé',
  echec: 'Échec de versement',
};

export const ARTISAN_PAYMENT_STATUS_SHORT_LABELS: Record<ArtisanPaymentStatus, string> = {
  en_attente: 'Préparés',
  en_traitement: 'À contrôler',
  valide: 'Validés',
  complete: 'Clôturés',
  annule: 'Annulés',
  echec: 'Échecs',
};

export const ARTISAN_PAYMENT_STATUS_TONES: Record<ArtisanPaymentStatus, BadgeTone> = {
  en_attente: 'warning',
  en_traitement: 'info',
  valide: 'info',
  complete: 'success',
  annule: 'danger',
  echec: 'danger',
};

export const ARTISAN_PAYMENT_TYPE_LABELS: Record<TypePaiementArtisan, string> = {
  virement_bancaire: 'Virement bancaire',
  cash: 'Espèces',
  orange_money: 'Orange Money',
  mobile_money: 'Mobile Money',
  moov_money: 'Moov Money',
  wave: 'Wave',
  cheque: 'Chèque',
};

export interface ArtisanPaymentNextStep {
  title: string;
  description: string;
  actionLabel?: string;
  targetStatus?: ArtisanPaymentStatus;
}

export const ARTISAN_PAYMENT_NEXT_STEPS: Record<ArtisanPaymentStatus, ArtisanPaymentNextStep> = {
  en_attente: {
    title: 'Soumettre au contrôle indépendant',
    description: 'L’ordre est préparé. Vérifiez les coordonnées et transmettez-le à un second agent.',
    actionLabel: 'Transmettre au contrôle',
    targetStatus: 'en_traitement',
  },
  en_traitement: {
    title: 'Effectuer le double contrôle',
    description: 'Un agent distinct vérifie le bénéficiaire, la facture, le net à verser et le moyen de paiement.',
    actionLabel: 'Confirmer le contrôle',
    targetStatus: 'valide',
  },
  valide: {
    title: 'Attendre la confirmation du versement',
    description: 'Le contrôle est acquis. La clôture interviendra après réception de la preuve bancaire ou mobile sécurisée.',
  },
  complete: {
    title: 'Dossier terminé',
    description: 'Le versement est confirmé, la preuve est rattachée et les écritures associées sont créées.',
  },
  annule: {
    title: 'Dossier abandonné',
    description: 'Le paiement a été annulé. La facture liée peut être remise dans le circuit de règlement.',
  },
  echec: {
    title: 'Versement non abouti',
    description: 'Le canal de paiement a signalé un échec. Consultez le motif avant toute nouvelle tentative.',
  },
};

export interface ArtisanPaymentWorkflowStep {
  status: ArtisanPaymentStatus;
  title: string;
  description: string;
}

export const ARTISAN_PAYMENT_WORKFLOW: ArtisanPaymentWorkflowStep[] = [
  {
    status: 'en_attente',
    title: 'Paiement préparé',
    description: 'Ordre créé à partir de la facture et du moyen vérifié de l’artisan.',
  },
  {
    status: 'en_traitement',
    title: 'Soumis au contrôle',
    description: 'Le dossier est transmis à un second agent pour vérification.',
  },
  {
    status: 'valide',
    title: 'Contrôle validé',
    description: 'Le bénéficiaire, les montants et la facture ont été contrôlés.',
  },
  {
    status: 'complete',
    title: 'Payé et clôturé',
    description: 'La preuve de versement est reçue et les écritures sont finalisées.',
  },
];

export function artisanPaymentWorkflowIndex(status: ArtisanPaymentStatus): number {
  if (status === 'complete') return 3;
  if (status === 'valide') return 2;
  if (status === 'en_traitement') return 1;
  return 0;
}

export function artisanPaymentHolderName(
  payment: Pick<PaiementArtisan, 'artisan_id'> & {
    artisan?: { nom?: string | null; prenoms?: string | null; raison_sociale?: string | null } | null;
  },
): string {
  const artisan = payment.artisan;
  if (!artisan) return 'Artisan non renseigné';
  return artisan.raison_sociale
    || [artisan.nom, artisan.prenoms].filter(Boolean).join(' ')
    || 'Artisan non renseigné';
}

export function artisanPaymentSaleReference(payment: {
  vente?: { reference_vente?: string | null; numero_recu?: string | null } | null;
  vente_or_id: string;
}): string {
  return payment.vente?.numero_recu
    || payment.vente?.reference_vente
    || `Vente ${payment.vente_or_id.slice(0, 8)}`;
}
