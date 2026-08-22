import { describe, expect, it } from 'vitest';
import { type AssistancePayload, validateAssistance } from './publicSupport';

const validPayload = (): AssistancePayload => ({
  name: 'Awa Traoré',
  email: 'awa@example.com',
  company: 'Mine exemple',
  category: 'operation',
  subject: 'Question sur une livraison',
  message: 'Je souhaite obtenir une précision sur le suivi de notre livraison.',
  website: '',
  startedAt: Date.now() - 3_000,
});

describe('validateAssistance', () => {
  it('accepte une demande complète', () => {
    expect(validateAssistance(validPayload())).toEqual({});
  });

  it('rejette les champs invalides et le leurre anti-robot', () => {
    expect(validateAssistance({
      ...validPayload(),
      name: 'A',
      email: 'adresse-invalide',
      category: '',
      subject: 'Aide',
      message: 'Trop court',
      website: 'https://spam.example',
    })).toMatchObject({
      name: expect.any(String),
      email: expect.any(String),
      category: expect.any(String),
      subject: expect.any(String),
      message: expect.any(String),
      website: expect.any(String),
    });
  });
});
