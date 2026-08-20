import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests du service d'achat industriel.
 *
 * Ils vérifient le contrat passé avec la base : quelle fonction est appelée,
 * avec quels arguments, et ce que le service en fait. Les invariants financiers
 * eux-mêmes — plafonds d'affectation, idempotence, isolation — sont posés en
 * PL/pgSQL et vérifiés là où ils s'appliquent ; les rejouer ici sur un client
 * simulé ne prouverait rien.
 */

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  reponses: {} as Record<string, { data: unknown; error: unknown }>,
  dernierInsert: null as unknown,
  dernierUpdate: null as unknown,
}));

vi.mock('@/lib/supabase', () => {
  const construire = (table: string) => {
    const resultat = () => mocks.reponses[table] || { data: [], error: null };
    const chaine: Record<string, unknown> = {
      then: (resoudre: (valeur: unknown) => unknown) => Promise.resolve(resultat()).then(resoudre),
      single: () => Promise.resolve(resultat()),
      maybeSingle: () => Promise.resolve(resultat()),
    };
    ['select', 'eq', 'neq', 'not', 'gte', 'lte', 'order', 'limit'].forEach((methode) => {
      chaine[methode] = () => chaine;
    });
    chaine.insert = (valeurs: unknown) => {
      mocks.dernierInsert = valeurs;
      return chaine;
    };
    chaine.update = (valeurs: unknown) => {
      mocks.dernierUpdate = valeurs;
      return chaine;
    };
    return chaine;
  };
  return {
    supabase: {
      from: (table: string) => construire(table),
      rpc: mocks.rpc,
      auth: { getUser: async () => ({ data: { user: { id: 'agent-1' } } }) },
    },
  };
});

import { achatsIndustrielsService, libelleMois } from './achatsIndustrielsService';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reponses = {};
  mocks.dernierInsert = null;
  mocks.dernierUpdate = null;
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

describe('plans d’achat', () => {
  it('numérote le plan sur son année et son mois', async () => {
    mocks.reponses.snp_plans_achat = { data: { id: 'p1', numero_plan: 'PA-2026-08' }, error: null };
    await achatsIndustrielsService.creerPlan({
      annee: 2026, mois: 8, mode_repartition: 'pourcentage',
      pourcentage_global: 40, prix_once_global_fcfa: 2_600_000,
    });
    expect((mocks.dernierInsert as Array<Record<string, unknown>>)[0].numero_plan).toBe('PA-2026-08');
  });

  it('n’enregistre pas de quantité cible en mode pourcentage', async () => {
    mocks.reponses.snp_plans_achat = { data: { id: 'p1' }, error: null };
    await achatsIndustrielsService.creerPlan({
      annee: 2026, mois: 8, mode_repartition: 'pourcentage',
      pourcentage_global: 40, quantite_cible_oz: 9999, prix_once_global_fcfa: 2_600_000,
    });
    const ligne = (mocks.dernierInsert as Array<Record<string, unknown>>)[0];
    // Les deux politiques s'excluent : garder l'autre valeur laisserait croire
    // qu'elle s'applique.
    expect(ligne.quantite_cible_oz).toBeNull();
    expect(ligne.pourcentage_global).toBe(40);
  });

  it('n’enregistre pas de pourcentage en mode quantité cible', async () => {
    mocks.reponses.snp_plans_achat = { data: { id: 'p1' }, error: null };
    await achatsIndustrielsService.creerPlan({
      annee: 2026, mois: 8, mode_repartition: 'quantite_cible',
      pourcentage_global: 40, quantite_cible_oz: 5000, prix_once_global_fcfa: 2_600_000,
    });
    const ligne = (mocks.dernierInsert as Array<Record<string, unknown>>)[0];
    expect(ligne.pourcentage_global).toBeNull();
    expect(ligne.quantite_cible_oz).toBe(5000);
  });

  it('délègue la répartition à la base', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ lignes_creees: 6, lignes_mises_a_jour: 0, lignes_preservees: 0 }], error: null,
    });
    const bilan = await achatsIndustrielsService.repartir('p1');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_repartir_plan', {
      p_plan_id: 'p1', p_ecraser_ajustements: false,
    });
    expect(bilan.lignes_creees).toBe(6);
  });

  it('marque la ligne comme ajustée dès qu’on la modifie', async () => {
    mocks.reponses.snp_plans_achat_lignes = { data: { id: 'l1' }, error: null };
    await achatsIndustrielsService.ajusterLigne('l1', { quantite_proposee_oz: 500 });
    expect((mocks.dernierUpdate as Record<string, unknown>).ajustee_manuellement).toBe(true);
  });

  it('remonte le nombre de demandes créées à la soumission', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ demandes_creees: 4 }], error: null });
    expect(await achatsIndustrielsService.soumettrePlan('p1')).toBe(4);
  });
});

describe('demandes', () => {
  it('transmet le motif avec un rejet', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ r_demande_id: 'd1' }], error: null });
    await achatsIndustrielsService.repondreDemande('d1', 'rejetee', 'Stock déjà engagé.');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_repondre_demande', {
      p_demande_id: 'd1', p_decision: 'rejetee', p_motif: 'Stock déjà engagé.',
    });
  });

  it('n’invente pas de motif pour une approbation', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ r_demande_id: 'd1', r_facture_id: 'f1' }], error: null });
    await achatsIndustrielsService.repondreDemande('d1', 'approuvee');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_repondre_demande', {
      p_demande_id: 'd1', p_decision: 'approuvee', p_motif: null,
    });
  });

  it('remonte la facture née de l’approbation', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ r_demande_id: 'd1', r_achat_id: 'a1', r_facture_id: 'f1', r_numero_facture: 'FA-2026-0001' }],
      error: null,
    });
    const resultat = await achatsIndustrielsService.repondreDemande('d1', 'approuvee');
    expect(resultat?.r_numero_facture).toBe('FA-2026-0001');
  });
});

describe('factures', () => {
  it('déduit le reste dû des montants tenus par la base', async () => {
    mocks.reponses.snp_factures_achat = {
      data: [{
        id: 'f1', numero_facture: 'FA-2026-0001',
        montant_ttc_fcfa: 1000, montant_ajustements_fcfa: 100, montant_paye_fcfa: 300,
      }],
      error: null,
    };
    const [facture] = await achatsIndustrielsService.listerFactures();
    expect(facture.reste_du_fcfa).toBe(600);
  });

  it('ne descend jamais le reste dû sous zéro', async () => {
    mocks.reponses.snp_factures_achat = {
      data: [{ id: 'f1', montant_ttc_fcfa: 500, montant_ajustements_fcfa: 0, montant_paye_fcfa: 900 }],
      error: null,
    };
    const [facture] = await achatsIndustrielsService.listerFactures();
    expect(facture.reste_du_fcfa).toBe(0);
  });
});

describe('règlements', () => {
  it('passe l’imputation automatique en option de l’enregistrement', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ reglement_id: 'r1', reference: 'REG-2026-0001', montant_affecte: 0, solde_non_affecte: 500 }],
      error: null,
    });
    await achatsIndustrielsService.enregistrerReglement({
      mining_company_id: 'm1', montant_fcfa: 500, date_reglement: '2026-08-20',
      mode_reglement: 'virement', affecter_fifo: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_enregistrer_reglement', expect.objectContaining({
      p_montant: 500, p_affecter_fifo: true,
    }));
  });

  it('n’impute rien par défaut : l’affectation est une décision', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ reglement_id: 'r1' }], error: null });
    await achatsIndustrielsService.enregistrerReglement({
      mining_company_id: 'm1', montant_fcfa: 500, date_reglement: '2026-08-20',
      mode_reglement: 'virement',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_enregistrer_reglement', expect.objectContaining({
      p_affecter_fifo: false,
    }));
  });

  it('remonte le solde resté sans affectation', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ factures_soldees: 2, montant_affecte: 800, solde_non_affecte: 200 }], error: null,
    });
    const bilan = await achatsIndustrielsService.affecterFifo('r1');
    expect(bilan.factures_soldees).toBe(2);
    expect(bilan.solde_non_affecte).toBe(200);
  });

  it('exige un motif pour annuler une affectation', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ affectation_id: 'a1' }], error: null });
    await achatsIndustrielsService.annulerAffectation('a1', 'Erreur de saisie du bénéficiaire.');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_annuler_affectation', {
      p_affectation_id: 'a1', p_motif: 'Erreur de saisie du bénéficiaire.',
    });
  });
});

describe('suivi comptable', () => {
  it('interroge la balance âgée à la date demandée', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await achatsIndustrielsService.balanceAgee('m1', '2026-08-20');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_balance_agee', {
      p_date: '2026-08-20', p_mining_company_id: 'm1',
    });
  });

  it('interroge toutes les sociétés quand aucune n’est choisie', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await achatsIndustrielsService.balanceAgee('all', '2026-08-20');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_balance_agee', {
      p_date: '2026-08-20', p_mining_company_id: null,
    });
  });

  it('écarte des sélecteurs les sociétés qui ne produisent pas', async () => {
    mocks.reponses.mining_companies = {
      data: [
        { id: 'm1', name: 'Essakane', company_type: 'production_mine' },
        { id: 'm2', name: 'SONASP', company_type: 'institution' },
        { id: 'm3', name: 'SOPAMIB', company_type: 'parent_company' },
      ],
      error: null,
    };
    const societes = await achatsIndustrielsService.societesProductrices();
    expect(societes.map((societe) => societe.name)).toEqual(['Essakane']);
  });
});

describe('erreurs', () => {
  it('remonte l’erreur de la base plutôt que de rendre une liste vide', async () => {
    mocks.reponses.snp_plans_achat = { data: null, error: { message: 'permission refusée' } };
    await expect(achatsIndustrielsService.listerPlans()).rejects.toMatchObject({
      message: 'permission refusée',
    });
  });
});

describe('libellés', () => {
  it('nomme les mois en français', () => {
    expect(libelleMois(1)).toBe('Janvier');
    expect(libelleMois(8)).toBe('Août');
    expect(libelleMois(12)).toBe('Décembre');
  });
});
