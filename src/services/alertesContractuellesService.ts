import { supabase } from '@/lib/supabase';

/**
 * Alertes contractuelles.
 *
 * Les seuils sont stockés et administrables ; les alertes, elles, se calculent
 * à la lecture. Une table d'alertes matérialisées exigerait un balayage
 * périodique et finirait par montrer une alerte levée depuis une heure, ou par
 * taire une alerte apparue depuis. Ce qui se déduit ne se stocke pas.
 */

export type Gravite = 'basse' | 'moyenne' | 'haute' | 'critique';
export type DomaineAlerte = 'contrat' | 'requisition' | 'analyse';

export interface Alerte {
  cle: string;
  libelle: string;
  domaine: DomaineAlerte;
  gravite: Gravite;
  objet_id: string;
  reference: string;
  partenaire: string;
  detail: string;
  echeance: string | null;
  jours: number | null;
}

export interface ParametreAlerte {
  cle: string;
  libelle: string;
  domaine: DomaineAlerte;
  actif: boolean;
  seuil_jours: number | null;
  seuil_pourcentage: number | null;
  gravite: Gravite;
  destinataires_roles: string[];
  updated_at: string;
}

export const LIBELLES_GRAVITE: Record<Gravite, string> = {
  basse: 'Information',
  moyenne: 'À surveiller',
  haute: 'À traiter',
  critique: 'Bloquant',
};

export const TONS_GRAVITE: Record<Gravite, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  basse: 'neutral',
  moyenne: 'info',
  haute: 'warning',
  critique: 'danger',
};

/** L'ordre dans lequel une direction lit ses alertes. */
export const ORDRE_GRAVITE: Gravite[] = ['critique', 'haute', 'moyenne', 'basse'];

export const rangGravite = (gravite: Gravite) => ORDRE_GRAVITE.indexOf(gravite);

/** Chemin de l'écran qui traite une alerte, selon son domaine. */
export const cheminAlerte = (alerte: Pick<Alerte, 'domaine' | 'objet_id'>) => {
  switch (alerte.domaine) {
    case 'requisition':
      return `/requisitions/${alerte.objet_id}`;
    case 'analyse':
      return '/contrats';
    default:
      return `/contrats/${alerte.objet_id}`;
  }
};

const lancerSiErreur = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

export const alertesContractuellesService = {
  async alertes(): Promise<Alerte[]> {
    const reponse = await supabase.rpc('snp_alertes_contractuelles');
    return (lancerSiErreur(reponse) || []) as Alerte[];
  },

  async parametres(): Promise<ParametreAlerte[]> {
    const reponse = await supabase
      .from('snp_alertes_parametres')
      .select('*')
      .order('domaine')
      .order('cle');
    return (lancerSiErreur(reponse) || []) as ParametreAlerte[];
  },

  /** Les seuils se règlent : la direction décide de ce qui l'alerte, et quand. */
  async reglerSeuil(cle: string, champs: Partial<ParametreAlerte>): Promise<ParametreAlerte> {
    const reponse = await supabase
      .from('snp_alertes_parametres').update(champs).eq('cle', cle).select().single();
    return lancerSiErreur(reponse) as ParametreAlerte;
  },
};

export default alertesContractuellesService;
