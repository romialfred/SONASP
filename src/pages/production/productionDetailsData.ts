import { supabase } from '@/lib/supabase';
import type { StatusHistoryEntry } from '@/services/productionStatusService';

/**
 * Historique des changements de statut d'une déclaration de production.
 *
 * L'écran interrogeait la table `profiles`, qui n'existe pas dans ce schéma :
 * chaque requête échouait en silence et **toute** modification était attribuée à
 * « Système ». Une piste d'audit qui ne nomme jamais son auteur ne vaut rien.
 * Le référentiel des comptes est `user_profiles`.
 *
 * Les auteurs sont résolus en une seule requête : un appel par ligne d'historique
 * multipliait les aller-retours et n'en donnait pas davantage.
 */

export const AUTEUR_INCONNU = 'Auteur inconnu';
export const AUTEUR_SYSTEME = 'Système';

export interface LigneHistoriqueBrute {
  id: string;
  entity_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  notes?: string | null;
  action_description?: string | null;
}

/**
 * Rattache chaque changement à son auteur.
 * Un changement sans auteur vient d'un déclencheur : il est dit « Système ».
 * Un auteur absent du référentiel est dit inconnu, jamais confondu avec lui.
 */
export function composerHistorique(
  lignes: LigneHistoriqueBrute[],
  comptes: Array<{ id: string; email: string | null; full_name?: string | null }>
): StatusHistoryEntry[] {
  const parId = new Map(comptes.map((compte) => [compte.id, compte]));

  return lignes.map((ligne) => {
    const compte = ligne.changed_by ? parId.get(ligne.changed_by) : undefined;
    const auteur = !ligne.changed_by
      ? AUTEUR_SYSTEME
      : compte?.full_name || compte?.email || AUTEUR_INCONNU;

    return {
      id: ligne.id,
      production_id: ligne.entity_id,
      old_status: ligne.old_status,
      new_status: ligne.new_status,
      changed_by: ligne.changed_by || '',
      changed_at: ligne.changed_at,
      notes: ligne.notes || ligne.action_description,
      user_email: auteur,
    } as StatusHistoryEntry;
  });
}

/** Historique d'une déclaration, auteurs résolus. */
export async function chargerHistorique(productionId: string): Promise<StatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from('unified_status_history')
    .select('id, entity_id, old_status, new_status, changed_by, changed_at, notes, action_description')
    .eq('entity_type', 'production')
    .eq('entity_id', productionId)
    .order('changed_at', { ascending: false });

  if (error) throw error;
  const lignes = (data || []) as LigneHistoriqueBrute[];
  if (!lignes.length) return [];

  const identifiants = [...new Set(lignes.map((ligne) => ligne.changed_by).filter(Boolean))] as string[];
  if (!identifiants.length) return composerHistorique(lignes, []);

  const { data: comptes, error: erreurComptes } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .in('id', identifiants);

  // Un référentiel illisible ne doit pas emporter l'historique : les auteurs
  // s'affichent alors comme inconnus, ce qui est vrai.
  return composerHistorique(lignes, erreurComptes ? [] : comptes || []);
}

export interface Composition {
  orPct: number;
  argentPct: number;
  impuretesPct: number;
  orGrammes: number;
  argentGrammes: number;
  impuretesGrammes: number;
}

/**
 * Décomposition d'une barre de doré. Les impuretés sont le complément à 100 % ;
 * un titre incohérent — somme supérieure à 100 — ne produit pas d'impuretés
 * négatives, il les ramène à zéro et se lit dans les deux autres parts.
 */
export function composerBarre(
  doreGrammes: number,
  titreOrPct: number,
  titreArgentPct: number | null | undefined
): Composition {
  const dore = Math.max(0, Number(doreGrammes) || 0);
  const orPct = Math.max(0, Number(titreOrPct) || 0);
  const argentPct = Math.max(0, Number(titreArgentPct) || 0);
  const impuretesPct = Math.max(0, 100 - orPct - argentPct);
  const part = (pourcentage: number) => Math.round(((dore * pourcentage) / 100) * 100) / 100;

  return {
    orPct,
    argentPct,
    impuretesPct: Math.round(impuretesPct * 100) / 100,
    orGrammes: part(orPct),
    argentGrammes: part(argentPct),
    impuretesGrammes: part(impuretesPct),
  };
}
