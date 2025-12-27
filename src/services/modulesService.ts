import { supabase } from '@/lib/supabase';

export interface Module {
  id: string;
  code: string;
  nom: string;
  description?: string;
  icone?: string;
  route?: string;
  parent_id?: string;
  parent_nom?: string;
  parent_code?: string;
  ordre: number;
  est_actif: boolean;
  est_visible_menu: boolean;
  permissions_requises: string[];
  created_at?: string;
  updated_at?: string;
  submodules?: Module[];
}

export const modulesService = {
  async getAll(): Promise<Module[]> {
    try {
      const { data, error } = await supabase
        .from('snp_modules')
        .select('*')
        .order('ordre', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching modules:', error);
      throw error;
    }
  },

  async getActive(): Promise<Module[]> {
    try {
      const { data, error } = await supabase
        .from('snp_modules_actifs')
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching active modules:', error);
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
      return data;
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
      return data;
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

  async getActiveHierarchy(): Promise<Module[]> {
    try {
      const allModules = await this.getActive();

      const parentModules = allModules.filter(m => !m.parent_id && m.est_actif && m.est_visible_menu);
      const childModules = allModules.filter(m => m.parent_id && m.est_actif && m.est_visible_menu);

      const hierarchy = parentModules.map(parent => ({
        ...parent,
        submodules: childModules
          .filter(child => child.parent_id === parent.id)
          .sort((a, b) => a.ordre - b.ordre)
      }));

      return hierarchy.sort((a, b) => a.ordre - b.ordre);
    } catch (error) {
      console.error('Error fetching active module hierarchy:', error);
      throw error;
    }
  },

  async create(module: Partial<Module>): Promise<Module> {
    try {
      const { data, error } = await supabase
        .from('snp_modules')
        .insert([{
          code: module.code,
          nom: module.nom,
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
      return data;
    } catch (error: any) {
      console.error('Error creating module:', error);
      throw new Error(error.message || 'Impossible de créer le module');
    }
  },

  async update(id: string, updates: Partial<Module>): Promise<Module> {
    try {
      const { data, error } = await supabase
        .from('snp_modules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating module:', error);
      throw new Error(error.message || 'Impossible de mettre à jour le module');
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
    } catch (error: any) {
      console.error('Error deleting module:', error);
      throw new Error(error.message || 'Impossible de supprimer le module');
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
      return data || [];
    } catch (error) {
      console.error('Error fetching user modules:', error);
      return await this.getActive();
    }
  }
};
