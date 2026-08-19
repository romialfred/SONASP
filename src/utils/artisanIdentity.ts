import type { ArtisanMinier } from '@/services/artisanMinierService';

/**
 * Libellé d'identité d'un artisan minier.
 * Une personne morale est désignée par sa raison sociale, une personne physique
 * par « NOM Prénoms ». Les libellés de repli évitent les lignes vides à l'écran.
 */
export function artisanFullName(artisan: Pick<ArtisanMinier, 'type_personne' | 'nom' | 'prenoms' | 'raison_sociale'> | null | undefined): string {
  if (!artisan) return 'Artisan inconnu';
  return artisan.type_personne === 'morale'
    ? artisan.raison_sociale || 'Société sans raison sociale'
    : [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') || 'Artisan sans nom';
}
