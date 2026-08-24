import { describe, expect, it } from 'vitest';
import {
  normalizeMailAction,
  requiredCapabilityForMailAction,
} from './mail-action-policy';

describe('capacités des actions de messagerie', () => {
  it('réserve la configuration et son essai à la capacité SMTP dédiée', () => {
    expect(requiredCapabilityForMailAction('test')).toBe('email.settings.manage');
  });

  it('lie les courriels de comptes à la gestion des comptes', () => {
    expect(requiredCapabilityForMailAction('bienvenue')).toBe('accounts.manage');
    expect(requiredCapabilityForMailAction('reinitialisation')).toBe('accounts.manage');
  });

  it('refuse une action inconnue au lieu de la traiter comme une vidange de file', () => {
    expect(normalizeMailAction('relai-libre')).toBeNull();
    expect(normalizeMailAction({})).toBeNull();
  });

  it('conserve la file comme action par défaut pour la compatibilité', () => {
    expect(normalizeMailAction(undefined)).toBe('file');
    expect(requiredCapabilityForMailAction('file')).toBe('sonasp.workflow.read');
  });
});
