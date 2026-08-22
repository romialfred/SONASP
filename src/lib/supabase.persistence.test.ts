import { beforeEach, describe, expect, it } from 'vitest';
import { configureAuthPersistence } from './supabase';

const authKey = 'gold-shipper-auth';
const preferenceKey = 'sonasp-auth-persistence';

describe('persistance de la session d’authentification', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('supprime toute ancienne session persistée au-delà de l’onglet', () => {
    window.localStorage.setItem(authKey, 'session-existante');
    window.localStorage.setItem(preferenceKey, 'local');

    configureAuthPersistence();

    expect(window.localStorage.getItem(preferenceKey)).toBeNull();
    expect(window.localStorage.getItem(authKey)).toBeNull();
    expect(window.sessionStorage.getItem(authKey)).toBeNull();
  });

  it('conserve uniquement la session de l’onglet courant', () => {
    window.sessionStorage.setItem(authKey, 'session-courante');

    configureAuthPersistence();

    expect(window.localStorage.getItem(preferenceKey)).toBeNull();
    expect(window.localStorage.getItem(authKey)).toBeNull();
    expect(window.sessionStorage.getItem(authKey)).toBe('session-courante');
  });
});
