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
  from: vi.fn(),
  numeros: [] as string[],
  motifs: [] as string[],
  enEchec: false,
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

function stub() {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.like = vi.fn((_colonne: string, motif: string) => {
    mocks.motifs.push(motif);
    const prefixe = motif.replace(/%$/, '');
    return Promise.resolve(
      mocks.enEchec
        ? { data: null, error: { message: 'lecture refusée' } }
        : {
            data: mocks.numeros
              .filter((numero) => numero.startsWith(prefixe))
              .map((numero) => ({ numero_recu: numero })),
            error: null,
          }
    );
  });
  return builder;
}

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
    mocks.numeros = [];
    mocks.motifs = [];
    mocks.enEchec = false;
    mocks.from.mockImplementation(() => stub());
  });

  it('attribue le premier numéro de l’année', async () => {
    expect(await genererNumeroRecu(instant)).toBe('VE-OR-2025-00001');
    expect(mocks.motifs[0]).toBe('VE-OR-2025-%');
  });

  it('incrémente à l’intérieur de la même année', async () => {
    mocks.numeros = ['VE-OR-2025-00001', 'VE-OR-2025-00002'];
    expect(await genererNumeroRecu(instant)).toBe('VE-OR-2025-00003');
  });

  it('repart de 00001 à l’année suivante', async () => {
    mocks.numeros = ['VE-OR-2025-00003'];
    expect(await genererNumeroRecu(new Date(2026, 0, 4))).toBe('VE-OR-2026-00001');
  });

  it('remonte une erreur de lecture au lieu d’attribuer un doublon', async () => {
    mocks.enEchec = true;
    await expect(genererNumeroRecu(instant)).rejects.toMatchObject({ message: 'lecture refusée' });
  });
});
