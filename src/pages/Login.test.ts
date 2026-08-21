import { describe, expect, it } from 'vitest';
import { messageConnexion } from './Login';

describe('message d’échec de connexion', () => {
  const secours = 'Une erreur inattendue s’est produite';

  it('traduit le refus d’identifiants, qui s’affichait en anglais', () => {
    // GoTrue répond « Invalid login credentials » : la phrase partait telle
    // quelle à l'écran d'un agent de la SONASP.
    expect(messageConnexion('Invalid login credentials', secours))
      .toBe('Identifiant ou mot de passe incorrect.');
  });

  it('reconnaît le motif quelle que soit la casse', () => {
    expect(messageConnexion('INVALID LOGIN CREDENTIALS', secours))
      .toBe('Identifiant ou mot de passe incorrect.');
  });

  it('distingue les refus qui appellent une action différente', () => {
    expect(messageConnexion('Email not confirmed', secours)).toMatch(/confirmé/);
    expect(messageConnexion('Too many requests', secours)).toMatch(/tentatives/);
    expect(messageConnexion('User is banned', secours)).toMatch(/plus actif/);
    expect(messageConnexion('Failed to fetch', secours)).toMatch(/injoignable/);
  });

  it('garde le message d’origine plutôt que d’en inventer un', () => {
    // Un motif inconnu reste lisible pour qui doit diagnostiquer ; le remplacer
    // par une phrase générique effacerait la seule piste disponible.
    expect(messageConnexion('Database connection pool exhausted', secours))
      .toBe('Database connection pool exhausted');
  });

  it('retombe sur le message de secours quand le serveur ne dit rien', () => {
    expect(messageConnexion('', secours)).toBe(secours);
  });
});
