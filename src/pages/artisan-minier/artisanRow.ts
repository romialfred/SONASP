import type { ArtisanMinier } from '@/services/artisanMinierService';
import type { Tables } from '@/types/database';

type ArtisanRow = Tables<'snp_artisans_miniers'>;
type SexeArtisan = NonNullable<ArtisanMinier['sexe']>;
type PieceIdentite = NonNullable<ArtisanMinier['type_piece_identite']>;

const SEXES: readonly SexeArtisan[] = ['M', 'F', 'Autre'];
const PIECES_IDENTITE: readonly PieceIdentite[] = ['CNI', 'Passeport', 'Permis', 'Autre'];

function estSexeArtisan(value: string): value is SexeArtisan {
  return SEXES.some((candidate) => candidate === value);
}

function estPieceIdentite(value: string): value is PieceIdentite {
  return PIECES_IDENTITE.some((candidate) => candidate === value);
}

/**
 * Adapte les deux anciens champs texte encore ouverts en base au contrat fermé
 * consommé par les écrans. Une valeur historique inconnue reste visible sous
 * « Autre » au lieu de rendre tout le dossier inutilisable.
 */
export function normaliserArtisan(row: ArtisanRow): ArtisanMinier {
  return {
    ...row,
    sexe: row.sexe === null ? null : estSexeArtisan(row.sexe) ? row.sexe : 'Autre',
    type_piece_identite: row.type_piece_identite === null
      ? null
      : estPieceIdentite(row.type_piece_identite)
        ? row.type_piece_identite
        : 'Autre',
  };
}
