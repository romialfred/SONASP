import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  composerNumeroRecu,
  compteurSuivant,
  convertirNumeroHerite,
  decomposerNumeroRecu,
  estNumeroRecuValide,
  genererNumeroRecu,
  periodeRecu,
  prefixePourPeriode,
} from './venteRecuNumberService';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

const instant = new Date(2025, 11, 28, 14, 30);

describe('période', () => {
  it('retient l’année d’émission', () => {
    expect(periodeRecu(instant)).toBe('2025');
    expect(periodeRecu(new Date(2026, 0, 5))).toBe('2026');
    expect(prefixePourPeriode(instant)).toBe('VE-OR-2025');
  });
});

describe('composition', () => {
  it('respecte le format VE-OR-AAAA-NNNNN', () => {
    expect(composerNumeroRecu(instant, 1)).toBe('VE-OR-2025-00001');
    expect(composerNumeroRecu(instant, 34)).toBe('VE-OR-2025-00034');
  });

  it('reconnaît et décompose un numéro valide', () => {
    expect(estNumeroRecuValide('VE-OR-2025-00034')).toBe(true);
    expect(decomposerNumeroRecu('VE-OR-2025-00034')).toEqual({ periode: '2025', compteur: 34 });
  });

  it('rejette les numéros hérités', () => {
    // L'ancien format comportait des barres obliques.
    expect(estNumeroRecuValide('VENTE/OR/2025/12/0002')).toBe(false);
    expect(decomposerNumeroRecu('VENTE/OR/2025/12/0002')).toBeNull();
  });
});

describe('convertirNumeroHerite', () => {
  it('transpose l’ancien format', () => {
    // Le mois disparaît : le compteur est annuel.
    expect(convertirNumeroHerite('VENTE/OR/2025/12/0002')).toBe('VE-OR-2025-00002');
    expect(convertirNumeroHerite('VENTE/OR/2026/1/34')).toBe('VE-OR-2026-00034');
  });

  it('laisse tel quel ce qu’il ne reconnaît pas', () => {
    // Mieux vaut ne rien faire que déformer un numéro de pièce comptable.
    expect(convertirNumeroHerite('REC-001')).toBeNull();
    expect(convertirNumeroHerite('VE-OR-2025-00002')).toBeNull();
  });
});

describe('compteur', () => {
  it('démarre à 1 et suit le plus grand attribué', () => {
    expect(compteurSuivant([], 'VE-OR-2025')).toBe(1);
    expect(compteurSuivant(['VE-OR-2025-00001', 'VE-OR-2025-00004'], 'VE-OR-2025')).toBe(5);
  });

  it('ignore les numéros d’une autre année', () => {
    // Le compteur est propre à l’année : 2026 repart de 1.
    expect(compteurSuivant(['VE-OR-2026-00009'], 'VE-OR-2025')).toBe(1);
  });
});

describe('genererNumeroRecu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: 'VE-OR-2025-00001', error: null });
  });

  it('réserve le numéro atomiquement auprès de la base', async () => {
    expect(await genererNumeroRecu()).toBe('VE-OR-2025-00001');
    expect(mocks.rpc).toHaveBeenCalledWith('generate_numero_recu_vente_or');
  });

  it('accepte la référence suivante renvoyée par le compteur serveur', async () => {
    mocks.rpc.mockResolvedValue({ data: 'VE-OR-2025-00003', error: null });
    expect(await genererNumeroRecu()).toBe('VE-OR-2025-00003');
  });

  it('rejette une réponse serveur qui ne respecte pas le format comptable', async () => {
    mocks.rpc.mockResolvedValue({ data: 'VENTE-3', error: null });
    await expect(genererNumeroRecu()).rejects.toThrow('référence de vente invalide');
  });

  it('remonte une erreur du compteur au lieu d’inventer une référence', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'réservation refusée' } });
    await expect(genererNumeroRecu()).rejects.toMatchObject({ message: 'réservation refusée' });
  });
});
