import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Eye,
  EyeOff,
  Power,
  PowerOff,
  Edit,
  Save,
  X
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { modulesService, Module } from '@/services/modulesService';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';

export default function ModulesManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [savingModule, setSavingModule] = useState(false);
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      setLoading(true);
      const hierarchy = await modulesService.getHierarchy();
      setModules(hierarchy);
    } catch (error) {
      console.error('Error loading modules:', error);
      showError('Impossible de charger les modules');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (moduleId: string) => {
    try {
      await modulesService.toggleActive(moduleId);
      showSuccess('Statut du module modifié');
      await loadModules();
    } catch (error) {
      showError('Impossible de modifier le statut');
    }
  };

  const handleToggleVisibility = async (moduleId: string) => {
    try {
      await modulesService.toggleVisibility(moduleId);
      showSuccess('Visibilité du module modifiée');
      await loadModules();
    } catch (error) {
      showError('Impossible de modifier la visibilité');
    }
  };

  const handleSaveModule = async () => {
    if (!editingModule) return;

    try {
      setSavingModule(true);
      await modulesService.update(editingModule.id, {
        nom: editingModule.nom,
        description: editingModule.description,
        icone: editingModule.icone,
        route: editingModule.route,
        ordre: editingModule.ordre
      });
      showSuccess('Module mis à jour avec succès');
      setEditingModule(null);
      await loadModules();
    } catch (error: any) {
      showError(error.message || 'Impossible de mettre à jour le module');
    } finally {
      setSavingModule(false);
    }
  };

  const renderModuleCard = (module: Module, isSubmodule: boolean = false) => (
    <Card
      key={module.id}
      className={`${isSubmodule ? 'ml-8 bg-gray-50' : ''} ${
        !module.est_actif ? 'opacity-60' : ''
      }`}
    >
      <div className="p-4">
        {editingModule?.id === module.id ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nom du module
              </label>
              <Input
                value={editingModule.nom}
                onChange={(e) =>
                  setEditingModule({ ...editingModule, nom: e.target.value })
                }
                placeholder="Nom du module"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Description
              </label>
              <TextArea
                value={editingModule.description || ''}
                onChange={(e) =>
                  setEditingModule({ ...editingModule, description: e.target.value })
                }
                placeholder="Description du module"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Icône (Lucide)
                </label>
                <Input
                  value={editingModule.icone || ''}
                  onChange={(e) =>
                    setEditingModule({ ...editingModule, icone: e.target.value })
                  }
                  placeholder="Ex: Grid, Users"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Route
                </label>
                <Input
                  value={editingModule.route || ''}
                  onChange={(e) =>
                    setEditingModule({ ...editingModule, route: e.target.value })
                  }
                  placeholder="/chemin"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveModule}
                disabled={savingModule}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs"
              >
                <Save className="w-3 h-3 mr-1" />
                Enregistrer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingModule(null)}
                className="text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div
                className={`p-2 rounded-lg ${
                  module.est_actif ? 'bg-emerald-100' : 'bg-gray-200'
                }`}
              >
                <Grid className={`h-5 w-5 ${module.est_actif ? 'text-emerald-600' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{module.nom}</h3>
                  {!module.est_visible_menu && (
                    <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                      Masqué
                    </span>
                  )}
                  {!module.est_actif && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">
                      Désactivé
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {module.description || module.code}
                </p>
                {module.route && (
                  <p className="text-xs text-blue-600 mt-0.5">{module.route}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleActive(module.id)}
                className={`p-2 rounded-lg transition-colors ${
                  module.est_actif
                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-600'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                }`}
                title={module.est_actif ? 'Désactiver' : 'Activer'}
              >
                {module.est_actif ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleToggleVisibility(module.id)}
                className={`p-2 rounded-lg transition-colors ${
                  module.est_visible_menu
                    ? 'bg-blue-100 hover:bg-blue-200 text-blue-600'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                }`}
                title={module.est_visible_menu ? 'Masquer du menu' : 'Afficher dans le menu'}
              >
                {module.est_visible_menu ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setEditingModule(module)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-600"
                title="Modifier"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-96">
          <Loading />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <CustomAlert {...alertState} onClose={closeAlert} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Modules</h1>
            <p className="text-sm text-gray-600 mt-1">
              Activer ou désactiver les modules de l'application
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Grid className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Comment fonctionne la gestion des modules ?
              </h3>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>
                  <strong>Actif/Désactif</strong> : Un module désactivé n'apparaît plus dans l'application
                </li>
                <li>
                  <strong>Visible/Masqué</strong> : Un module masqué reste actif mais n'apparaît pas dans le menu
                </li>
                <li>
                  <strong>Sous-modules</strong> : La désactivation d'un module parent désactive tous ses sous-modules
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {modules.map((module) => (
            <div key={module.id} className="space-y-2">
              {renderModuleCard(module)}
              {module.submodules && module.submodules.length > 0 && (
                <div className="space-y-2">
                  {module.submodules.map((submodule) => renderModuleCard(submodule, true))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
