import { describe, expect, it } from 'vitest';
import { messageConnexion } from './Login';

describe('message d’échec de connexion', () => {
  const secours = 'Une erreur inattendue s’est produite';

  it('traduit le refus d’identifiants, qui s’affichait en anglais', () => {
    // GoTrue répond « Invalid login credentials » : la phrase partait telle
    // quelle à l'écran d'un agent de la SONASP.
    expect(messageConnexion('Invalid login credentials', secours))
      .toBe('Nom d’utilisateur ou mot de passe incorrect.');
  });

  it('reconnaît le motif quelle que soit la casse', () => {
    expect(messageConnexion('INVALID LOGIN CREDENTIALS', secours))
      .toBe('Nom d’utilisateur ou mot de passe incorrect.');
  });

  it('distingue les refus qui appellent une action différente', () => {
    expect(messageConnexion('Email not confirmed', secours)).toMatch(/confirmé/);
    expect(messageConnexion('Too many requests', secours)).toMatch(/tentatives/);
    expect(messageConnexion('User is banned', secours)).toMatch(/pas autorisé/);
    expect(messageConnexion('ACCOUNT_NOT_AUTHORIZED', secours)).toMatch(/pas autorisé/);
    expect(messageConnexion('Failed to fetch', secours)).toMatch(/momentanément indisponible/);
  });

  it('ne divulgue pas un message technique inattendu', () => {
    expect(messageConnexion('Database connection pool exhausted', secours))
      .toBe(secours);
  });

  it('retombe sur le message de secours quand le serveur ne dit rien', () => {
    expect(messageConnexion('', secours)).toBe(secours);
  });
});
