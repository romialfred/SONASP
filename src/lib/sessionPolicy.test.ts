import { describe, it, expect, beforeEach } from 'vitest';
import {
  SESSION_INACTIVITY_TIMEOUT_MS,
  SESSION_INACTIVITY_MAX_MINUTES,
  SESSION_INACTIVITY_MIN_MINUTES,
  appliquerDureeInactivite,
  dureeInactiviteMs,
  reinitialiserDureeInactivite,
} from './sessionPolicy';

describe('durée d’inactivité', () => {
  beforeEach(() => {
    reinitialiserDureeInactivite();
  });

  it('retombe sur dix minutes tant que le serveur n’a rien dit', () => {
    expect(dureeInactiviteMs()).toBe(SESSION_INACTIVITY_TIMEOUT_MS);
    expect(SESSION_INACTIVITY_TIMEOUT_MS).toBe(10 * 60 * 1000);
  });

  it('adopte la durée annoncée par le serveur', () => {
    expect(appliquerDureeInactivite(20)).toBe(20);
    expect(dureeInactiviteMs()).toBe(20 * 60 * 1000);
  });

  it('ramène une valeur trop grande à la borne haute', () => {
    expect(appliquerDureeInactivite(100_000)).toBe(SESSION_INACTIVITY_MAX_MINUTES);
    expect(dureeInactiviteMs()).toBe(SESSION_INACTIVITY_MAX_MINUTES * 60 * 1000);
  });

  it('ramène une valeur trop petite à la borne basse', () => {
    expect(appliquerDureeInactivite(1)).toBe(SESSION_INACTIVITY_MIN_MINUTES);
  });

  it('ignore une valeur qui n’est pas un nombre', () => {
    appliquerDureeInactivite(20);
    expect(appliquerDureeInactivite(Number.NaN)).toBe(20);
    expect(dureeInactiviteMs()).toBe(20 * 60 * 1000);
  });

  it('ne conserve pas la durée d’un compte après réinitialisation', () => {
    appliquerDureeInactivite(90);
    reinitialiserDureeInactivite();
    expect(dureeInactiviteMs()).toBe(SESSION_INACTIVITY_TIMEOUT_MS);
  });
});
