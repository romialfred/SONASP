import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Certification DGI.
 *
 * Le point vérifié ici est le seul qui compte vraiment : **aucun chemin de code
 * ne doit produire une facture certifiée sans référence renvoyée par le service
 * fiscal**. Ni l'absence de configuration, ni une réponse incomplète, ni une
 * panne réseau.
 */

const mocks = vi.hoisted(() => ({
  inserts: [] as unknown[],
  updates: [] as unknown[],
  lectureTentatives: { data: [] as unknown[], error: null as unknown },
}));

vi.mock('@/lib/supabase', () => {
  const construire = (table: string) => {
    const chaine: Record<string, unknown> = {
      then: (resoudre: (valeur: unknown) => unknown) =>
        Promise.resolve(
          table === 'snp_factures_certification' ? mocks.lectureTentatives : { data: [], error: null }
        ).then(resoudre),
    };
    ['select', 'eq', 'order', 'limit'].forEach((methode) => {
      chaine[methode] = () => chaine;
    });
    chaine.insert = (valeurs: unknown) => {
      mocks.inserts.push({ table, valeurs });
      return Promise.resolve({ data: null, error: null });
    };
    chaine.update = (valeurs: unknown) => {
      mocks.updates.push({ table, valeurs });
      return chaine;
    };
    return chaine;
  };
  return {
    supabase: {
      from: (table: string) => construire(table),
      auth: { getUser: async () => ({ data: { user: { id: 'agent-1' } } }) },
    },
  };
});

import { certifier, empreinte, estRaccordee, MOTIF_NON_RACCORDEE } from './certificationDgiService';

const facture = {
  id: 'f1',
  numero_facture: 'FA-2026-0001',
  date_emission: '2026-08-20',
  montant_ht_fcfa: 1_000_000,
  tva_montant_fcfa: 180_000,
  montant_ttc_fcfa: 1_190_000,
  devise: 'XOF',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inserts = [];
  mocks.updates = [];
  mocks.lectureTentatives = { data: [], error: null };
});

describe('raccordement', () => {
  it('se déclare non raccordée sans configuration', () => {
    expect(estRaccordee()).toBe(false);
  });
});

describe('certification', () => {
  it('refuse de certifier tant que le service fiscal n’est pas raccordé', async () => {
    const resultat = await certifier(facture);
    expect(resultat.statut).toBe('echec');
    expect(resultat).toMatchObject({ code: 'NON_RACCORDEE', message: MOTIF_NON_RACCORDEE });
  });

  it('inscrit la facture en échec, jamais en certifiée', async () => {
    await certifier(facture);
    const misesAJour = mocks.updates as Array<{ valeurs: Record<string, unknown> }>;
    expect(misesAJour).toHaveLength(1);
    expect(misesAJour[0].valeurs.statut_certification).toBe('echec');
    // Aucune référence n'est posée : la contrainte de base l'interdirait de
    // toute façon, mais le service ne doit même pas l'essayer.
    expect(misesAJour[0].valeurs).not.toHaveProperty('certification_reference');
  });

  it('journalise chaque tentative, y compris les échecs', async () => {
    await certifier(facture);
    const traces = mocks.inserts as Array<{ table: string; valeurs: Array<Record<string, unknown>> }>;
    expect(traces).toHaveLength(1);
    expect(traces[0].table).toBe('snp_factures_certification');
    expect(traces[0].valeurs[0].reponse_code).toBe('NON_RACCORDEE');
    expect(traces[0].valeurs[0].tentative).toBe(1);
  });

  it('numérote la tentative à la suite des précédentes', async () => {
    mocks.lectureTentatives = { data: [{ tentative: 3 }], error: null };
    await certifier(facture);
    const traces = mocks.inserts as Array<{ valeurs: Array<Record<string, unknown>> }>;
    expect(traces[0].valeurs[0].tentative).toBe(4);
  });

  it('journalise une empreinte, non le contenu de la requête', async () => {
    await certifier(facture);
    const traces = mocks.inserts as Array<{ valeurs: Array<Record<string, unknown>> }>;
    const trace = String(traces[0].valeurs[0].requete_empreinte ?? '');
    expect(trace.length).toBeGreaterThan(0);
    // Ni le numéro de facture ni les montants ne doivent apparaître en clair.
    expect(trace).not.toContain('FA-2026-0001');
    expect(trace).not.toContain('1190000');
  });
});

describe('empreinte', () => {
  it('donne le même condensat pour la même charge', async () => {
    const a = await empreinte({ numero: 'FA-1', ttc: 100 });
    const b = await empreinte({ numero: 'FA-1', ttc: 100 });
    expect(a).toBe(b);
  });

  it('change dès qu’un montant change', async () => {
    const a = await empreinte({ numero: 'FA-1', ttc: 100 });
    const b = await empreinte({ numero: 'FA-1', ttc: 101 });
    expect(a).not.toBe(b);
  });
});
