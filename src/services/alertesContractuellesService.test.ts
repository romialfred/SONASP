import { describe, expect, it } from 'vitest';
import {
  cheminAlerte,
  LIBELLES_GRAVITE,
  ORDRE_GRAVITE,
  rangGravite,
  TONS_GRAVITE,
  type Gravite,
} from './alertesContractuellesService';
import {
  formaterTaille,
} from '@/components/contrats/PiecesContractuelles';
import { nomSecurise, validerPiece } from './piecesContractuellesService';

describe('gravité des alertes', () => {
  it('classe du bloquant vers l’information', () => {
    expect(ORDRE_GRAVITE).toEqual(['critique', 'haute', 'moyenne', 'basse']);
    expect(rangGravite('critique')).toBeLessThan(rangGravite('basse'));
  });

  it('nomme chaque niveau par ce qu’il demande, non par sa couleur', () => {
    const niveaux: Gravite[] = ['basse', 'moyenne', 'haute', 'critique'];
    niveaux.forEach((niveau) => {
      expect(LIBELLES_GRAVITE[niveau]).toBeTruthy();
      expect(TONS_GRAVITE[niveau]).toBeTruthy();
    });
    expect(LIBELLES_GRAVITE.critique).toBe('Bloquant');
  });
});

describe('destination d’une alerte', () => {
  it('mène à la pièce qui la lève', () => {
    // Une alerte qu'on ne peut pas traiter d'un clic finit ignorée.
    expect(cheminAlerte({ domaine: 'contrat', objet_id: 'abc' })).toBe('/contrats/abc');
    expect(cheminAlerte({ domaine: 'requisition', objet_id: 'def' })).toBe('/requisitions/def');
  });
});

describe('versement d’une pièce', () => {
  const fichier = (nom: string, type: string, taille: number) =>
    ({ name: nom, type, size: taille } as File);

  it('accepte un PDF de taille raisonnable', () => {
    expect(validerPiece(fichier('contrat.pdf', 'application/pdf', 2_000_000))).toBeNull();
  });

  it('refuse un format que le dépôt n’accepte pas', () => {
    const refus = validerPiece(fichier('script.exe', 'application/x-msdownload', 1000));
    expect(refus).toContain('Format refusé');
  });

  it('nomme la limite quand le fichier est trop lourd', () => {
    // « Trop volumineux » sans le poids admis n'aide personne à recommencer.
    const refus = validerPiece(fichier('scan.pdf', 'application/pdf', 40 * 1024 * 1024));
    expect(refus).toContain('25 Mo');
  });

  it('refuse un fichier vide', () => {
    expect(validerPiece(fichier('vide.pdf', 'application/pdf', 0))).toBe('Ce fichier est vide.');
  });

  it('assainit le nom pour un chemin de stockage', () => {
    expect(nomSecurise('Contrat signé (final).pdf')).toBe('Contrat_signe_final_.pdf');
    expect(nomSecurise('../../etc/passwd')).toBe('.._.._etc_passwd');
  });

  it('affiche le poids dans l’unité qui se lit', () => {
    expect(formaterTaille(512)).toBe('512 o');
    expect(formaterTaille(2048)).toBe('2 Ko');
    expect(formaterTaille(3 * 1024 * 1024)).toBe('3.0 Mo');
    expect(formaterTaille(null)).toBe('—');
  });
});
