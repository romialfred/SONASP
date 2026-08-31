import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@/types/auth';
import { CAPABILITIES, hasCapability, hasSensitiveCapability } from './capabilities';

const profile = (overrides: Partial<UserProfile>): UserProfile => ({
  id: 'user-id',
  email: 'user@sonasp.invalid',
  full_name: 'Compte test',
  phone: null,
  role: 'manager',
  mining_company_id: null,
  site_ids: [],
  is_active: true,
  is_sales_approver: false,
  two_factor_enabled: true,
  language: 'fr',
  email_notifications: true,
  batch_notifications: true,
  approval_notifications: true,
  created_at: '2026-08-23T00:00:00.000Z',
  updated_at: '2026-08-23T00:00:00.000Z',
  ...overrides,
});

describe('capacités frontend', () => {
  it('utilise la matrice conservatrice seulement si le serveur est indisponible', () => {
    const manager = profile({ role: 'manager', capabilities: undefined });
    expect(hasCapability(manager, CAPABILITIES.REPORTS_READ)).toBe(true);
    expect(hasCapability(manager, CAPABILITIES.SONASP_APPROVE)).toBe(false);
  });

  it('respecte une liste serveur vide sans réintroduire les droits du rôle', () => {
    const management = profile({ role: 'management', capabilities: [] });
    expect(hasCapability(management, CAPABILITIES.SONASP_PREPARE)).toBe(false);
  });

  it('accorde toutes les capacités fonctionnelles au Owner actif', () => {
    const owner = profile({ role: 'owner', capabilities: [] });
    expect(hasCapability(owner, CAPABILITIES.SONASP_PREPARE)).toBe(true);
    expect(hasCapability(owner, CAPABILITIES.DGMG_SUPERVISE)).toBe(true);
  });

  it('reflète exactement un override serveur ciblé', () => {
    const approver = profile({ role: 'manager', capabilities: [CAPABILITIES.SONASP_APPROVE] });
    expect(hasCapability(approver, CAPABILITIES.SONASP_APPROVE)).toBe(true);
    expect(hasCapability(approver, CAPABILITIES.SONASP_PREPARE)).toBe(false);
  });

  it('refuse toute capacité à un compte désactivé, même si elle est renvoyée', () => {
    const inactive = profile({ is_active: false, capabilities: [CAPABILITIES.ACCOUNTS_MANAGE] });
    expect(hasCapability(inactive, CAPABILITIES.ACCOUNTS_MANAGE)).toBe(false);
  });

  it('ne déduit jamais les capabilities artisan sensibles du seul rôle admin', () => {
    const adminAal1 = profile({ role: 'admin', capabilities: undefined });
    expect(hasCapability(adminAal1, CAPABILITIES.ARTISAN_CARDS_MANAGE)).toBe(false);
    expect(hasCapability(adminAal1, CAPABILITIES.ARTISAN_PAYMENT_METHODS_MANAGE)).toBe(false);

    const adminAal2 = profile({
      role: 'admin',
      capabilities: [
        CAPABILITIES.ARTISAN_CARDS_MANAGE,
        CAPABILITIES.ARTISAN_PAYMENT_METHODS_MANAGE,
      ],
    });
    expect(hasCapability(adminAal2, CAPABILITIES.ARTISAN_CARDS_MANAGE)).toBe(true);
    expect(hasCapability(adminAal2, CAPABILITIES.ARTISAN_PAYMENT_METHODS_MANAGE)).toBe(true);
  });

  it('exige une capability autoritative même pour Owner sur une opération sensible', () => {
    const ownerAal1 = profile({ role: 'owner', capabilities: undefined });
    expect(hasSensitiveCapability(ownerAal1, CAPABILITIES.ARTISAN_CARDS_MANAGE)).toBe(false);

    const ownerAal2 = profile({ role: 'owner', capabilities: [CAPABILITIES.ARTISAN_CARDS_MANAGE] });
    expect(hasSensitiveCapability(ownerAal2, CAPABILITIES.ARTISAN_CARDS_MANAGE)).toBe(true);
  });
});
