import { describe, expect, it } from 'vitest';
import {
  ageRelatif,
  BADGE_MAXIMUM,
  etatVerification,
  formaterBadge,
  LIBELLES_GRAVITE_NOTIFICATION,
  LIBELLES_TYPE_NOTIFICATION,
  MODES_CHIFFREMENT,
  modeChiffrement,
  TONS_GRAVITE_NOTIFICATION,
  type ConfigurationCourriel,
  type GraviteNotification,
  type TypeNotification,
} from './notificationsService';
import {
  forceMotDePasse,
  LIBELLES_ETAPE,
  LIBELLES_FORCE,
  secretLisible,
  versDataUri,
  type EtapeSuivante,
} from './mfaService';

describe('badge de la cloche', () => {
  it('affiche le compte exact tant qu’il reste lisible', () => {
    expect(formaterBadge(0)).toBe('0');
    expect(formaterBadge(7)).toBe('7');
    expect(formaterBadge(BADGE_MAXIMUM)).toBe('99');
  });

  it('s’arrête à 99+ : au-delà, le compte exact n’aide plus', () => {
    expect(formaterBadge(100)).toBe('99+');
    expect(formaterBadge(4213)).toBe('99+');
  });
});

describe('âge d’une notification', () => {
  const base = new Date('2026-08-21T12:00:00Z');
  const ilYA = (minutes: number) => new Date(base.getTime() - minutes * 60_000).toISOString();

  it('dit « à l’instant » pour la dernière minute', () => {
    expect(ageRelatif(ilYA(0), base)).toBe('à l’instant');
  });

  it('compte en minutes, puis en heures, puis en jours', () => {
    expect(ageRelatif(ilYA(20), base)).toBe('il y a 20 min');
    expect(ageRelatif(ilYA(180), base)).toBe('il y a 3 h');
    expect(ageRelatif(ilYA(60 * 24), base)).toBe('hier');
    expect(ageRelatif(ilYA(60 * 24 * 5), base)).toBe('il y a 5 jours');
  });

  it('repasse à la date quand la fraîcheur ne dit plus rien', () => {
    expect(ageRelatif(ilYA(60 * 24 * 90), base)).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('ne devine pas une date illisible', () => {
    expect(ageRelatif('pas une date', base)).toBe('—');
  });
});

describe('référentiels de notification', () => {
  it('nomme les sept types et les quatre gravités', () => {
    const types: TypeNotification[] = [
      'information', 'validation_attendue', 'decision', 'echeance',
      'alerte', 'paiement', 'securite',
    ];
    types.forEach((type) => expect(LIBELLES_TYPE_NOTIFICATION[type]).toBeTruthy());

    const gravites: GraviteNotification[] = ['basse', 'normale', 'haute', 'urgente'];
    gravites.forEach((gravite) => {
      expect(LIBELLES_GRAVITE_NOTIFICATION[gravite]).toBeTruthy();
      expect(TONS_GRAVITE_NOTIFICATION[gravite]).toBeTruthy();
    });
  });
});

describe('second facteur', () => {
  it('encode le QR de GoTrue en data URI', () => {
    // GoTrue rend du SVG brut, qui ne s'affiche pas dans un `<img src>`.
    expect(versDataUri('<svg></svg>')).toMatch(/^data:image\/svg\+xml;utf8,/);
    expect(versDataUri('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
  });

  it('regroupe la clé par blocs de quatre pour la recopier', () => {
    expect(secretLisible('ABCDEFGHIJKLMNOP')).toBe('ABCD EFGH IJKL MNOP');
  });

  it('pèse la longueur plus que la variété', () => {
    // « Tr0ub4dor& » se casse plus vite que quatre mots communs mis bout à bout.
    expect(forceMotDePasse('court')).toBe(0);
    expect(forceMotDePasse('Tr0ub4dor&')).toBe(2);
    expect(forceMotDePasse('correcthorsebatterystaple')).toBe(3);
    expect(forceMotDePasse('Cheval-Batterie-Agrafe-2026')).toBe(4);
  });

  it('donne un libellé à chaque niveau de force', () => {
    expect(LIBELLES_FORCE).toHaveLength(5);
    expect(LIBELLES_FORCE[forceMotDePasse('court')]).toBe('Trop court');
  });

  it('nomme les quatre étapes du parcours', () => {
    const etapes: EtapeSuivante[] = ['mot_de_passe', 'enrolement', 'verification', 'pret'];
    etapes.forEach((etape) => expect(LIBELLES_ETAPE[etape]).toBeTruthy());
  });
});

describe('paramètres de messagerie', () => {
  const jeu = (surcharge: Partial<ConfigurationCourriel> = {}): ConfigurationCourriel => ({
    uid: 'u1',
    libelle: 'Serveur principal',
    hote: 'mail.exemple.bf',
    port: 465,
    securise: true,
    identifiant: 'no-reply@exemple.bf',
    expediteur_courriel: 'no-reply@exemple.bf',
    expediteur_nom: 'Administration SONASP',
    actif: true,
    mot_de_passe_defini: true,
    mot_de_passe_modifie_le: null,
    derniere_verification: null,
    derniere_erreur: null,
    created_at: '2026-08-21T08:00:00Z',
    ...surcharge,
  });

  it('retrouve le mode de chiffrement à partir des deux valeurs enregistrées', () => {
    expect(modeChiffrement(465, true)).toBe('ssl');
    expect(modeChiffrement(587, false)).toBe('starttls');
    expect(modeChiffrement(25, false)).toBe('aucun');
    // Un port inhabituel sans TLS reste du STARTTLS : c'est le cas ordinaire.
    expect(modeChiffrement(2525, false)).toBe('starttls');
  });

  it('propose les trois modes avec leur port d’usage', () => {
    expect(MODES_CHIFFREMENT.map((mode) => mode.port)).toEqual([465, 587, 25]);
    MODES_CHIFFREMENT.forEach((mode) => {
      expect(mode.libelle).toBeTruthy();
      expect(mode.aide).toBeTruthy();
      // Le mode retrouvé depuis le couple (port, TLS) doit être celui de départ.
      expect(modeChiffrement(mode.port, mode.securise)).toBe(mode.cle);
    });
  });

  it('signale d’abord le secret manquant : rien d’autre ne peut fonctionner sans lui', () => {
    const etat = etatVerification(jeu({
      mot_de_passe_defini: false,
      derniere_verification: '2026-08-20T10:00:00Z',
    }));
    expect(etat.ton).toBe('alerte');
    expect(etat.texte).toMatch(/[Mm]ot de passe/);
  });

  it('rend le motif du serveur tel quel : « échec » ne se corrige pas', () => {
    const etat = etatVerification(jeu({ derniere_erreur: 'authentication failed' }));
    expect(etat).toEqual({ ton: 'alerte', texte: 'authentication failed' });
  });

  it('distingue « jamais vérifié » d’une vérification réussie', () => {
    expect(etatVerification(jeu()).ton).toBe('neutre');
    expect(etatVerification(jeu()).texte).toBe('Jamais vérifié');
    expect(etatVerification(jeu({ derniere_verification: '2026-08-20T10:00:00Z' })).ton)
      .toBe('succes');
  });
});
