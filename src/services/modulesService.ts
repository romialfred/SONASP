import { supabase } from '@/lib/supabase';
import {
  PLATFORM_MODULE_BY_CODE,
  type ModuleAvailabilityMap,
  type PlatformModuleCode,
} from '@/lib/platformModuleCatalog';

export const MODULE_CATALOG_UPDATED_EVENT = 'sonasp:module-catalog-updated';

function notifierMiseAJourCatalogue() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MODULE_CATALOG_UPDATED_EVENT));
  }
}

export interface Module {
  id: string;
  code: string;
  nom: string;
  description?: string | null;
  icone?: string | null;
  route?: string | null;
  parent_id?: string | null;
  parent_nom?: string;
  parent_code?: string;
  ordre: number;
  est_actif: boolean;
  est_visible_menu: boolean;
  permissions_requises: string[];
  created_at?: string;
  updated_at?: string;
  permission_module_id?: string | null;
  access_domain?: string | null;
  catalog_consistent?: boolean;
  submodules?: Module[];
}

function normaliserModule(source: Record<string, unknown>): Module {
  return {
    ...source,
    id: String(source.id),
    code: String(source.code),
    nom: String(source.nom),
    route: typeof source.route === 'string' ? source.route : null,
    parent_id: typeof source.parent_id === 'string' ? source.parent_id : null,
    ordre: typeof source.ordre === 'number' ? source.ordre : 0,
    est_actif: source.est_actif !== false,
    est_visible_menu: source.est_visible_menu !== false,
    permissions_requises: Array.isArray(source.permissions_requises)
      ? source.permissions_requises.filter((permission): permission is string => typeof permission === 'string')
      : [],
  } as Module;
}

export const modulesService = {
  async getAll(): Promise<Module[]> {
    try {
      const { data, error } = await (supabase as any)
        .from('snp_module_catalog_admin')
        .select('*')
        .order('ordre', { ascending: true });

      if (error) throw error;
      const allModules = ((data || []) as Record<string, unknown>[]).map(normaliserModule);
      const canonicalRootIds = new Set(allModules
        .filter((module) => !module.parent_id && PLATFORM_MODULE_BY_CODE.has(module.code as PlatformModuleCode))
        .map((module) => module.id));

      return allModules.filter((module) => (
        module.parent_id
          ? canonicalRootIds.has(module.parent_id)
          : PLATFORM_MODULE_BY_CODE.has(module.code as PlatformModuleCode)
      ));
    } catch (error) {
      console.error('Error fetching modules:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Module | null> {
    try {
      const { data, error } = await supabase
        .from('snp_modules')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data ? normaliserModule(data as Record<string, unknown>) : null;
    } catch (error) {
      console.error('Error fetching module:', error);
      throw error;
    }
  },

  async getByCode(code: string): Promise<Module | null> {
    try {
      const { data, error} = await supabase
        .from('snp_modules')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (error) throw error;
      return data ? normaliserModule(data as Record<string, unknown>) : null;
    } catch (error) {
      console.error('Error fetching module by code:', error);
      throw error;
    }
  },

  async getHierarchy(): Promise<Module[]> {
    try {
      const allModules = await this.getAll();

      const parentModules = allModules.filter(m => !m.parent_id);
      const childModules = allModules.filter(m => m.parent_id);

      const hierarchy = parentModules.map(parent => ({
        ...parent,
        submodules: childModules
          .filter(child => child.parent_id === parent.id)
          .sort((a, b) => a.ordre - b.ordre)
      }));

      return hierarchy.sort((a, b) => a.ordre - b.ordre);
    } catch (error) {
      console.error('Error fetching module hierarchy:', error);
      throw error;
    }
  },
  async getActive(): Promise<Module[]> {
    return (await this.getAll()).filter((module) => module.est_actif);
  },

  /** État autoritatif utilisé par la sidebar pour éviter les liens fantômes. */
  async getNavigationAvailability(): Promise<ModuleAvailabilityMap> {
    const { data, error } = await supabase
      .from('snp_modules')
      .select('code, est_actif, est_visible_menu');

    if (error) throw error;
    return Object.fromEntries((data || []).map((module) => [
      module.code,
      {
        isActive: module.est_actif !== false,
        isVisibleInMenu: module.est_visible_menu !== false,
      },
    ]));
  },
  async create(module: Partial<Module>): Promise<Module> {
    try {
      if (!module.code?.trim() || !module.nom?.trim()) {
        throw new Error('Le code et le nom du module sont obligatoires.');
      }
      const { data, error } = await supabase
        .from('snp_modules')
        .insert([{
          code: module.code.trim(),
          nom: module.nom.trim(),
          description: module.description,
          icone: module.icone,
          route: module.route,
          parent_id: module.parent_id,
          ordre: module.ordre || 0,
          est_actif: module.est_actif !== undefined ? module.est_actif : true,
          est_visible_menu: module.est_visible_menu !== undefined ? module.est_visible_menu : true,
          permissions_requises: module.permissions_requises || []
        }])
        .select()
        .single();

      if (error) throw error;
      notifierMiseAJourCatalogue();
      return normaliserModule(data as Record<string, unknown>);
    } catch (error: any) {
      console.error('Error creating module:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Module>): Promise<Module> {
    try {
      // Le RPC met à jour dans une même transaction `snp_modules` (menu) et
      // `modules` (habilitations). Une bascule ne peut donc plus laisser les
      // deux écrans d'administration dans des états contradictoires.
      const { data, error } = await (supabase as any).rpc('snp_update_module_catalog', {
        p_module_id: id,
        p_nom: updates.nom,
        p_description: updates.description,
        p_route: updates.route,
        p_ordre: updates.ordre,
        p_est_actif: updates.est_actif,
        p_est_visible_menu: updates.est_visible_menu,
      });

      if (error) throw error;
      notifierMiseAJourCatalogue();
      return data as Module;
    } catch (error: any) {
      console.error('Error updating module:', error);
      throw error;
    }
  },

  async toggleActive(id: string): Promise<Module> {
    try {
      const module = await this.getById(id);
      if (!module) throw new Error('Module non trouvé');

      return await this.update(id, {
        est_actif: !module.est_actif
      });
    } catch (error: any) {
      console.error('Error toggling module active state:', error);
      throw error;
    }
  },

  async toggleVisibility(id: string): Promise<Module> {
    try {
      const module = await this.getById(id);
      if (!module) throw new Error('Module non trouvé');

      return await this.update(id, {
        est_visible_menu: !module.est_visible_menu
      });
    } catch (error: any) {
      console.error('Error toggling module visibility:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('snp_modules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      notifierMiseAJourCatalogue();
    } catch (error: any) {
      console.error('Error deleting module:', error);
      throw error;
    }
  },

  async reorder(moduleId: string, newOrder: number): Promise<void> {
    try {
      await this.update(moduleId, { ordre: newOrder });
    } catch (error) {
      console.error('Error reordering module:', error);
      throw error;
    }
  },

  async getUserModules(userId: string): Promise<Module[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_modules', { user_id: userId });

      if (error) throw error;
      return ((data || []) as Record<string, unknown>[]).map(normaliserModule);
    } catch (error) {
      console.error('Error fetching user modules:', error);
      return await this.getActive();
    }
  }
};
