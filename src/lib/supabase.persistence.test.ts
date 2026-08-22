import { beforeEach, describe, expect, it } from 'vitest';
import { configureAuthPersistence } from './supabase';

const authKey = 'gold-shipper-auth';
const preferenceKey = 'sonasp-auth-persistence';

describe('persistance de la session d’authentification', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('conserve une session non mémorisée uniquement pour l’onglet courant', () => {
    window.localStorage.setItem(authKey, 'session-existante');

    configureAuthPersistence(false);

    expect(window.localStorage.getItem(preferenceKey)).toBe('session');
    expect(window.localStorage.getItem(authKey)).toBeNull();
    expect(window.sessionStorage.getItem(authKey)).toBe('session-existante');
  });

  it('déplace la session vers le stockage persistant quand la case est cochée', () => {
    window.sessionStorage.setItem(authKey, 'session-courante');

    configureAuthPersistence(true);

    expect(window.localStorage.getItem(preferenceKey)).toBe('local');
    expect(window.localStorage.getItem(authKey)).toBe('session-courante');
    expect(window.sessionStorage.getItem(authKey)).toBeNull();
  });
});
