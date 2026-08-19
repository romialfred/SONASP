import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALPHABET_36,
  ALPHABET_60,
  composerNumero,
  compteurSuivant,
  decomposerNumero,
  encoderInstant,
  estNumeroValide,
  genererNumeroCarte,
  prefixePourInstant,
} from './carteNumberService';

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
    const lignes = mocks.numeros
      .filter((numero) => numero.startsWith(prefixe))
      .map((numero) => ({ numero_carte: numero }));
    return Promise.resolve(
      mocks.enEchec ? { data: null, error: { message: 'lecture refusée' } } : { data: lignes, error: null }
    );
  });
  return builder;
}

/** 14 mars 2026 à 09h07 → jour E, mois 3, heure 9, minute 7. */
const instant = new Date(2026, 2, 14, 9, 7);

describe('alphabets', () => {
  it('couvre exactement les valeurs possibles', () => {
    expect(ALPHABET_36).toHaveLength(36);
    // Les minutes vont jusqu'à 59 : il faut 60 symboles distincts.
    expect(ALPHABET_60).toHaveLength(60);
    expect(new Set(ALPHABET_60).size).toBe(60);
  });

  it('écarte les caractères qui se confondent à l’impression', () => {
    expect(ALPHABET_60).not.toContain('l');
    expect(ALPHABET_60).not.toContain('o');
  });
});

describe('encodage de l’instant', () => {
  it('place jour, mois, heure et minute sur quatre caractères', () => {
    expect(encoderInstant(instant)).toBe('E397');
    expect(encoderInstant(instant)).toHaveLength(4);
  });

  it('couvre les bornes du calendrier', () => {
    expect(encoderInstant(new Date(2026, 0, 1, 0, 0))).toBe('1100');
    // 31 décembre à 23h59 : jour V, mois C, heure N, minute z.
    expect(encoderInstant(new Date(2026, 11, 31, 23, 59))).toBe('VCNz');
  });

  it('distingue deux minutes consécutives', () => {
    expect(encoderInstant(new Date(2026, 2, 14, 9, 35))).not.toBe(encoderInstant(new Date(2026, 2, 14, 9, 36)));
  });
});

describe('composition du numéro', () => {
  it('respecte le format BF-AM-AAAA-XZTM-NNNN', () => {
    expect(composerNumero(instant, 1)).toBe('BF-AM-2026-E397-0001');
    expect(composerNumero(instant, 42)).toBe('BF-AM-2026-E397-0042');
    expect(prefixePourInstant(instant)).toBe('BF-AM-2026-E397');
  });

  it('reconnaît et décompose un numéro valide', () => {
    expect(estNumeroValide('BF-AM-2026-E397-0007')).toBe(true);
    expect(decomposerNumero('BF-AM-2026-E397-0007')).toEqual({ annee: 2026, instant: 'E397', compteur: 7 });
  });

  it('rejette les numéros hérités', () => {
    // L'ancien format comportait des barres obliques.
    expect(estNumeroValide('SONASP/AM/2025/000063')).toBe(false);
    expect(decomposerNumero('SONASP/AM/2025/000063')).toBeNull();
  });
});

describe('compteur', () => {
  it('démarre à 1 et suit le plus grand attribué', () => {
    expect(compteurSuivant([], 'BF-AM-2026-E397')).toBe(1);
    expect(compteurSuivant(['BF-AM-2026-E397-0001', 'BF-AM-2026-E397-0004'], 'BF-AM-2026-E397')).toBe(5);
  });

  it('ignore les numéros d’un autre instant', () => {
    // Le compteur est propre à un XZTM : une autre minute repart de 1.
    expect(compteurSuivant(['BF-AM-2026-E398-0009'], 'BF-AM-2026-E397')).toBe(1);
  });
});

describe('genererNumeroCarte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.numeros = [];
    mocks.motifs = [];
    mocks.enEchec = false;
    mocks.from.mockImplementation(() => stub());
  });

  it('attribue le premier numéro de la minute', async () => {
    expect(await genererNumeroCarte(instant)).toBe('BF-AM-2026-E397-0001');
    expect(mocks.motifs[0]).toBe('BF-AM-2026-E397-%');
  });

  it('incrémente à l’intérieur de la même minute', async () => {
    mocks.numeros = ['BF-AM-2026-E397-0001', 'BF-AM-2026-E397-0002'];
    expect(await genererNumeroCarte(instant)).toBe('BF-AM-2026-E397-0003');
  });

  it('repart de 0001 à la minute suivante', async () => {
    mocks.numeros = ['BF-AM-2026-E397-0003'];
    expect(await genererNumeroCarte(new Date(2026, 2, 14, 9, 8))).toBe('BF-AM-2026-E398-0001');
  });

  it('remonte une erreur de lecture au lieu d’attribuer un doublon', async () => {
    mocks.enEchec = true;
    await expect(genererNumeroCarte(instant)).rejects.toMatchObject({ message: 'lecture refusée' });
  });
});
