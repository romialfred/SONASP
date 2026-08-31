import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { moduleDomain } from '@/lib/accessControl';
import {
  PLATFORM_MODULE_BY_CODE,
  type PlatformModuleCode,
} from '@/lib/platformModuleCatalog';
import type { Json } from '@/types/database';

/**
 * Habilitations d'un utilisateur sur les modules.
 *
 * Deux écrans d'administration écrivaient dans `user_permissions` avec des jeux de
 * colonnes **différents et incompatibles** : l'un `can_read / can_write / can_delete` et
 * les permissions par champ, l'autre `can_view / can_create / can_edit / can_delete /
 * can_approve`. Chacun remplaçant l'existant, enregistrer depuis un écran effaçait
 * silencieusement ce que l'autre avait posé. Ce service porte le jeu complet et devient
 * l'unique point d'écriture.
 */

export interface FieldPermission {
  can_view: boolean;
  can_edit: boolean;
}

export interface ModulePermission {
  module_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  field_permissions: Record<string, FieldPermission>;
}

export type PermissionMap = Record<string, ModulePermission>;

export const EMPTY_PERMISSION = (moduleId: string): ModulePermission => ({
  module_id: moduleId,
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  can_approve: false,
  field_permissions: {},
});

/** Une habilitation vide n'est pas persistée : elle équivaut à une absence de droit. */
export const estAccordee = (permission: ModulePermission): boolean =>
  permission.can_view ||
  permission.can_create ||
  permission.can_edit ||
  permission.can_delete ||
  permission.can_approve ||
  Object.values(permission.field_permissions).some((champ) => champ.can_view || champ.can_edit);

/**
 * Normalise les permissions par champ.
 * Elles étaient écrites sous la forme `{ read, write }` alors que le lecteur attend
 * `{ can_view, can_edit }` : aucune permission de champ n'a donc jamais été appliquée.
 */
export function normaliserChamps(brut: unknown): Record<string, FieldPermission> {
  if (!brut || typeof brut !== 'object') return {};
  const resultat: Record<string, FieldPermission> = {};
  Object.entries(brut as Record<string, unknown>).forEach(([champ, valeur]) => {
    if (!valeur || typeof valeur !== 'object') return;
    const source = valeur as Record<string, unknown>;
    resultat[champ] = {
      can_view: Boolean(source.can_view ?? source.read),
      can_edit: Boolean(source.can_edit ?? source.write),
    };
  });
  return resultat;
}

/** Traduit une ligne de la table en habilitation applicative. */
export function versPermission(ligne: Record<string, unknown>): ModulePermission {
  const moduleId = String(ligne.module_id);
  return {
    module_id: moduleId,
    // Les colonnes historiques servent de repli tant que les deux jeux coexistent en base.
    can_view: Boolean(ligne.can_view ?? ligne.can_read),
    can_create: Boolean(ligne.can_create),
    can_edit: Boolean(ligne.can_edit ?? ligne.can_write),
    can_delete: Boolean(ligne.can_delete),
    can_approve: Boolean(ligne.can_approve),
    field_permissions: normaliserChamps(ligne.field_permissions),
  };
}

/** Ligne prête à être écrite, colonnes historiques tenues cohérentes. */
export function versLigne(permission: ModulePermission, userId: string, grantedBy?: string) {
  return {
    user_id: userId,
    module_id: permission.module_id,
    can_view: permission.can_view,
    can_create: permission.can_create,
    can_edit: permission.can_edit,
    can_delete: permission.can_delete,
    can_approve: permission.can_approve,
    can_read: permission.can_view,
    can_write: permission.can_edit,
    field_permissions: permission.field_permissions,
    granted_by: grantedBy ?? null,
  };
}

export interface PlanEcriture {
  aCreer: string[];
  aMettreAJour: string[];
  aRevoquer: string[];
}

/**
 * Compare l'état souhaité à l'état en base.
 * L'enregistrement procédait par suppression totale puis réinsertion : si l'insertion
 * échouait, l'utilisateur se retrouvait **sans aucun droit**. Le plan ne touche que les
 * lignes réellement concernées.
 */
export function planifier(existant: PermissionMap, souhaite: PermissionMap): PlanEcriture {
  const accordees = Object.values(souhaite).filter(estAccordee);
  const clefsAccordees = new Set(accordees.map((permission) => permission.module_id));

  return {
    aCreer: accordees.filter((p) => !existant[p.module_id]).map((p) => p.module_id),
    aMettreAJour: accordees
      .filter((p) => existant[p.module_id] && JSON.stringify(existant[p.module_id]) !== JSON.stringify(p))
      .map((p) => p.module_id),
    aRevoquer: Object.keys(existant).filter((moduleId) => !clefsAccordees.has(moduleId)),
  };
}

export interface PermissionModule {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  category: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  /** Domaine versionné en base ; une valeur absente/inconnue est refusée. */
  access_domain?: string | null;
}

export const userPermissionsService = {
  /**
   * Modules sur lesquels des habilitations peuvent être posées.
   *
   * `user_permissions.module_id` référence la table `modules` — c'est sur elle que le
   * lecteur d'habilitations effectue sa jointure. Un écran d'administration alimentait
   * pourtant ses cases à cocher depuis `snp_modules`, un référentiel distinct : les
   * droits ainsi accordés portaient des identifiants que rien ne pouvait résoudre.
   */
  async listModules(includeInactive = false): Promise<{ modules: PermissionModule[]; error?: string }> {
    let query = (supabase as any)
      .from('modules')
      .select('id, name, display_name, description, category, sort_order, access_domain, is_active');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query
      .in('name', [...PLATFORM_MODULE_BY_CODE.keys()])
      .order('category')
      .order('sort_order');
    if (error) {
      return { modules: [], error: errorMessage(error, 'Impossible de charger la liste des modules.') };
    }
    return {
      modules: ((data || []) as PermissionModule[])
        // Les capacités techniques historiques restent en base pour préserver
        // les comptes existants, mais seules les unités fonctionnelles de la
        // sidebar sont attribuables aux nouveaux comptes.
        .filter((module) => PLATFORM_MODULE_BY_CODE.has(module.name as PlatformModuleCode))
        .map((module) => ({
          ...module,
          access_domain: moduleDomain(module),
        })),
    };
  },

  /** Habilitations persistées, ou une erreur explicite si la lecture échoue. */
  async load(userId: string): Promise<{ permissions: PermissionMap; error?: string }> {
    const { data, error } = await supabase.from('user_permissions').select('*').eq('user_id', userId);
    if (error) {
      return { permissions: {}, error: errorMessage(error, 'Impossible de charger les habilitations.') };
    }
    const permissions: PermissionMap = {};
    (data || []).forEach((ligne) => {
      const permission = versPermission(ligne as Record<string, unknown>);
      permissions[permission.module_id] = permission;
    });
    return { permissions };
  },

  /**
   * Enregistre les habilitations souhaitées.
   * `existant` doit provenir d'un chargement réussi : sans lui, un écran vide issu d'une
   * lecture en échec révoquerait tous les droits de l'utilisateur.
   */
  async save(
    userId: string,
    _existant: PermissionMap,
    souhaite: PermissionMap,
    _grantedBy?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const habilitations = Object.values(souhaite)
        .filter(estAccordee)
        .map((permission) => ({
          module_id: permission.module_id,
          can_view: permission.can_view,
          can_create: permission.can_create,
          can_edit: permission.can_edit,
          can_delete: permission.can_delete,
          can_approve: permission.can_approve,
          field_permissions: permission.field_permissions as unknown as Json,
        }));

      // Le remplacement est effectué dans une transaction côté base. Une
      // erreur ne peut donc plus laisser le compte sans aucune habilitation.
      const { error } = await supabase.rpc('snp_remplacer_habilitations_compte', {
        p_user_id: userId,
        p_habilitations: habilitations,
      });
      if (error) throw error;

      return { success: true };
    } catch (reason) {
      return { success: false, error: errorMessage(reason, 'Enregistrement des habilitations impossible.') };
    }
  },
};
