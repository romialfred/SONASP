import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Règlements : formatage des montants, contrôles de pièces, contrat avec la base.
 *
 * Les invariants financiers — plafonds d'affectation, séparation des fonctions,
 * preuve exigée avant exécution — sont posés en PL/pgSQL et vérifiés là où ils
 * s'appliquent. Ici on éprouve ce qui vit côté navigateur : la lisibilité des
 * montants, le filtrage des pièces, et les arguments envoyés à la base.
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
    chaine.insert = (valeurs: unknown) => { mocks.dernierInsert = valeurs; return chaine; };
    chaine.update = (valeurs: unknown) => { mocks.dernierUpdate = valeurs; return chaine; };
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

import {
  formaterFcfa,
  formaterMontant,
  masquerCompte,
  montantEnLettres,
  reglementsAchatService,
  TAILLE_PREUVE_MAX_OCTETS,
} from './reglementsAchatService';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reponses = {};
  mocks.dernierInsert = null;
  mocks.dernierUpdate = null;
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

describe('lisibilité des montants', () => {
  it('sépare les milliers, jusqu’au milliard', () => {
    // Un montant mal séparé se lit de travers, et un virement se trompe d'un
    // facteur dix.
    expect(formaterFcfa(25_000_000)).toMatch(/^25\s000\s000 FCFA$/);
    expect(formaterFcfa(485_750_000)).toMatch(/^485\s750\s000 FCFA$/);
    expect(formaterFcfa(1_250_000_000)).toMatch(/^1\s250\s000\s000 FCFA$/);
  });

  it('affiche « — » plutôt qu’un zéro trompeur quand la valeur manque', () => {
    expect(formaterFcfa(null)).toBe('—');
    expect(formaterFcfa(undefined)).toBe('—');
    expect(formaterFcfa(Number.NaN)).toBe('—');
  });

  it('montre les centimes quand on le demande', () => {
    expect(formaterFcfa(1234.5, true)).toMatch(/1\s234,50 FCFA/);
  });

  it('n’introduit aucune dérive sur un très grand nombre', () => {
    expect(formaterFcfa(9_876_543_210)).toMatch(/^9\s876\s543\s210 FCFA$/);
  });

  it('sait présenter un montant sans sa devise', () => {
    // Dans un tableau dont l'en-tête porte « (FCFA) », répéter l'unité à chaque
    // cellule allonge les colonnes sans rien apprendre.
    expect(formaterMontant(485_750_000)).toMatch(/^485\s750\s000$/);
    expect(formaterMontant(1234.5, true)).toMatch(/^1\s234,50$/);
  });

  it('signale la valeur absente de la même façon, avec ou sans devise', () => {
    expect(formaterMontant(null)).toBe('—');
    expect(formaterMontant(undefined)).toBe('—');
    expect(formaterMontant(Number.NaN)).toBe('—');
  });
});

describe('montant en toutes lettres', () => {
  it('écrit un montant courant', () => {
    expect(montantEnLettres(25_000_000)).toBe('vingt-cinq millions francs CFA');
  });

  it('écrit un milliard', () => {
    expect(montantEnLettres(1_250_000_000))
      .toBe('un milliard deux cent cinquante millions francs CFA');
  });

  it('gère les dizaines irrégulières du français', () => {
    expect(montantEnLettres(71)).toContain('soixante-et-onze');
    expect(montantEnLettres(80)).toContain('quatre-vingts');
    expect(montantEnLettres(91)).toContain('quatre-vingt-onze');
  });

  it('accorde le franc au singulier', () => {
    expect(montantEnLettres(1)).toBe('un franc CFA');
  });

  it('refuse de faire semblant sur zéro', () => {
    expect(montantEnLettres(0)).toBe('zéro franc CFA');
  });

  it('ignore les centimes : un ordre de virement se relit en entiers', () => {
    expect(montantEnLettres(2_500_000.87)).toBe(montantEnLettres(2_500_000));
  });
});

describe('masquage des coordonnées', () => {
  it('ne laisse lisibles que les quatre derniers chiffres', () => {
    const masque = masquerCompte('00123456789');
    expect(masque.endsWith('6789')).toBe(true);
    expect(masque).not.toContain('0012');
  });

  it('laisse un numéro très court intact plutôt que de le rendre illisible', () => {
    expect(masquerCompte('4321')).toBe('4321');
  });

  it('affiche « — » quand il n’y a pas de compte', () => {
    expect(masquerCompte(null)).toBe('—');
  });
});

describe('contrôle des pièces justificatives', () => {
  it('accepte un PDF de taille raisonnable', () => {
    expect(reglementsAchatService.validerPreuve({
      type: 'application/pdf', size: 180_000, name: 'mt103.pdf',
    })).toBeNull();
  });

  it('refuse un format non autorisé', () => {
    expect(reglementsAchatService.validerPreuve({
      type: 'application/x-msdownload', size: 1000, name: 'virement.exe',
    })).toMatch(/Format refusé/);
  });

  it('refuse un fichier sans type déclaré', () => {
    expect(reglementsAchatService.validerPreuve({
      type: '', size: 1000, name: 'preuve',
    })).toMatch(/Format refusé/);
  });

  it('refuse un fichier au-delà du plafond', () => {
    expect(reglementsAchatService.validerPreuve({
      type: 'application/pdf', size: TAILLE_PREUVE_MAX_OCTETS + 1, name: 'gros.pdf',
    })).toMatch(/trop volumineux/);
  });

  it('refuse un fichier vide', () => {
    expect(reglementsAchatService.validerPreuve({
      type: 'image/png', size: 0, name: 'vide.png',
    })).toMatch(/vide/);
  });

  it('compose un nom de stockage sans chemin ni extension trompeuse', () => {
    const nom = reglementsAchatService.nomSecurise('REG-2026-0001', '../../etc/passwd.pdf');
    expect(nom.startsWith('preuves/REG-2026-0001/')).toBe(true);
    expect(nom).not.toContain('..');
    expect(nom.endsWith('.pdf')).toBe(true);
  });

  it('ne laisse pas passer une extension exotique dans le nom de stockage', () => {
    const nom = reglementsAchatService.nomSecurise('REG-2026-0001', 'preuve.p<df>');
    expect(nom).not.toMatch(/[<>]/);
  });
});

describe('contrat avec la base', () => {
  it('n’interroge que les sociétés réellement débitrices', async () => {
    await reglementsAchatService.societesEligibles();
    expect(mocks.rpc).toHaveBeenCalledWith('snp_societes_eligibles_paiement');
  });

  it('demande les factures d’une société dans sa devise', async () => {
    await reglementsAchatService.facturesEligibles('m1', 'XOF');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_factures_eligibles', {
      p_mining_company_id: 'm1', p_devise: 'XOF',
    });
  });

  it('prépare le règlement et ses affectations d’un seul appel', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ r_reglement_id: 'r1', r_reference: 'REG-2026-0001', r_affecte: 800, r_non_affecte: 200 }],
      error: null,
    });
    const resultat = await reglementsAchatService.preparer({
      mining_company_id: 'm1',
      compte_bancaire_id: 'b1',
      montant_fcfa: 1000,
      affectations: [{ facture_id: 'f1', montant: 500 }, { facture_id: 'f2', montant: 300 }],
      objet: 'Règlement de juillet',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_preparer_reglement', expect.objectContaining({
      p_montant: 1000,
      p_affectations: [
        { facture_id: 'f1', montant: 500 },
        { facture_id: 'f2', montant: 300 },
      ],
    }));
    expect(resultat?.r_non_affecte).toBe(200);
  });

  it('transmet le motif d’un rejet de règlement', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ r_reglement_id: 'r1', r_statut: 'rejete' }], error: null });
    await reglementsAchatService.changerStatut('r1', 'rejete', 'Coordonnées bancaires obsolètes.');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_changer_statut_reglement', {
      p_reglement_id: 'r1', p_statut: 'rejete', p_motif: 'Coordonnées bancaires obsolètes.',
    });
  });

  it('écarte un compte dont la validité a expiré', async () => {
    const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    mocks.reponses.stakeholder_bank_accounts = {
      data: [
        { id: 'b1', bank_name: 'Coris', valid_to: null, is_primary: true },
        { id: 'b2', bank_name: 'Ecobank', valid_to: hier, is_primary: false },
      ],
      error: null,
    };
    const comptes = await reglementsAchatService.comptesBancaires('m1');
    expect(comptes.map((compte) => compte.id)).toEqual(['b1']);
  });

  it('remonte l’erreur de la base plutôt qu’une liste vide', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'permission refusée' } });
    await expect(reglementsAchatService.societesEligibles()).rejects.toMatchObject({
      message: 'permission refusée',
    });
  });
});
