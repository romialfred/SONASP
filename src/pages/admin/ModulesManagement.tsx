import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Info, LayoutGrid, Loader2, PencilLine, Power, Save, X } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { useConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { modulesService, type Module } from '@/services/modulesService';
import { errorMessage } from '@/lib/errorMessage';
import './admin.css';

/** Aplatit la hiérarchie pour les décomptes et la recherche. */
export function aplatirModules(modules: Module[]): Module[] {
  return modules.flatMap((module) => [module, ...(module.submodules || [])]);
}

/** Conserve les modules dont le nom, le code ou la route correspond, avec leurs parents. */
export function filterModules(modules: Module[], recherche: string): Module[] {
  const terme = recherche.trim().toLowerCase();
  if (!terme) return modules;

  const correspond = (module: Module) =>
    [module.nom, module.code, module.route, module.description]
      .filter(Boolean)
      .some((valeur) => String(valeur).toLowerCase().includes(terme));

  const retenus: Module[] = [];
  modules.forEach((module) => {
    const sousModules = (module.submodules || []).filter(correspond);
    if (correspond(module)) {
      retenus.push({ ...module, submodules: module.submodules || [] });
    } else if (sousModules.length > 0) {
      retenus.push({ ...module, submodules: sousModules });
    }
  });
  return retenus;
}

export default function ModulesManagement() {
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();
  const { open: demanderConfirmation, ConfirmationDialog } = useConfirmationDialog();

  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [enEdition, setEnEdition] = useState<Module | null>(null);
  const [saving, setSaving] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      setModules(await modulesService.getHierarchy());
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger les modules.'));
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const tous = useMemo(() => aplatirModules(modules), [modules]);
  const visibles = useMemo(() => filterModules(modules, recherche), [modules, recherche]);

  const basculerActivation = async (module: Module) => {
    // Désactiver un module retire une section entière de l'application à tous les
    // utilisateurs, et emporte ses sous-modules : la manœuvre se faisait en un clic.
    const sousModules = module.submodules?.length || 0;
    const confirme = await demanderConfirmation({
      title: module.est_actif ? 'Désactiver ce module ?' : 'Réactiver ce module ?',
      message: module.est_actif
        ? `« ${module.nom} » disparaîtra de l’application pour tous les utilisateurs${
            sousModules > 0 ? `, ainsi que ses ${sousModules} sous-module(s)` : ''
          }.`
        : `« ${module.nom} » redeviendra accessible aux utilisateurs habilités.`,
      confirmText: module.est_actif ? 'Désactiver' : 'Réactiver',
      cancelText: 'Annuler',
      severity: module.est_actif ? 'danger' : 'info',
    });
    if (!confirme) return;

    setEnCours(module.id);
    try {
      await modulesService.toggleActive(module.id);
      showSuccess(module.est_actif ? 'Module désactivé' : 'Module réactivé');
      await charger();
    } catch (reason) {
      showError(errorMessage(reason, 'Impossible de modifier l’activation du module'));
    } finally {
      setEnCours(null);
    }
  };

  const basculerVisibilite = async (module: Module) => {
    setEnCours(module.id);
    try {
      await modulesService.toggleVisibility(module.id);
      showSuccess(module.est_visible_menu ? 'Module masqué du menu' : 'Module affiché dans le menu');
      await charger();
    } catch (reason) {
      showError(errorMessage(reason, 'Impossible de modifier la visibilité du module'));
    } finally {
      setEnCours(null);
    }
  };

  const enregistrer = async () => {
    if (!enEdition || saving) return;
    if (!enEdition.nom.trim()) {
      showError('Le nom du module est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      await modulesService.update(enEdition.id, {
        nom: enEdition.nom.trim(),
        description: enEdition.description,
        icone: enEdition.icone,
        route: enEdition.route,
        ordre: enEdition.ordre,
      });
      showSuccess('Module mis à jour');
      setEnEdition(null);
      await charger();
    } catch (reason) {
      showError(errorMessage(reason, 'Impossible de mettre à jour le module'));
    } finally {
      setSaving(false);
    }
  };

  const carte = (module: Module, sousModule = false) => (
    <article
      key={module.id}
      className={`modules__carte${sousModule ? ' is-enfant' : ''}${module.est_actif ? '' : ' is-inactif'}`}
    >
      {enEdition?.id === module.id ? (
        <div className="modules__edition">
          <div className="admin-form__row is-deux">
            <Field label="Nom du module" required htmlFor={`nom-${module.id}`}>
              <input
                id={`nom-${module.id}`}
                value={enEdition.nom}
                onChange={(event) => setEnEdition({ ...enEdition, nom: event.target.value })}
              />
            </Field>
            <Field label="Route" htmlFor={`route-${module.id}`} hint="Chemin ouvert par l’entrée de menu">
              <input
                id={`route-${module.id}`}
                value={enEdition.route || ''}
                onChange={(event) => setEnEdition({ ...enEdition, route: event.target.value })}
                placeholder="/chemin"
              />
            </Field>
          </div>
          <Field label="Description" wide htmlFor={`description-${module.id}`}>
            <textarea
              id={`description-${module.id}`}
              rows={2}
              value={enEdition.description || ''}
              onChange={(event) => setEnEdition({ ...enEdition, description: event.target.value })}
            />
          </Field>
          <div className="modules__edition-actions">
            <button type="button" className="sn-btn" onClick={() => setEnEdition(null)} disabled={saving}>
              <X aria-hidden="true" /> Annuler
            </button>
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => void enregistrer()} disabled={saving}>
              {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className="modules__icone" aria-hidden="true">
            <LayoutGrid />
          </span>
          <div className="modules__corps">
            <h3>
              {module.nom}
              {!module.est_actif && <Badge tone="danger">Désactivé</Badge>}
              {!module.est_visible_menu && <Badge tone="neutral">Masqué du menu</Badge>}
            </h3>
            <p>{module.description || module.code}</p>
            {module.route && <code>{module.route}</code>}
          </div>
          <div className="admin-page__actions">
            <button
              type="button"
              className="sn-btn sn-btn--icon"
              aria-label={module.est_actif ? `Désactiver ${module.nom}` : `Réactiver ${module.nom}`}
              disabled={enCours === module.id}
              onClick={() => void basculerActivation(module)}
            >
              {enCours === module.id ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Power aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="sn-btn sn-btn--icon"
              aria-label={
                module.est_visible_menu ? `Masquer ${module.nom} du menu` : `Afficher ${module.nom} dans le menu`
              }
              disabled={enCours === module.id}
              onClick={() => void basculerVisibilite(module)}
            >
              {module.est_visible_menu ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="sn-btn sn-btn--icon"
              aria-label={`Modifier ${module.nom}`}
              onClick={() => setEnEdition(module)}
            >
              <PencilLine aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </article>
  );

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page modules">
        <CustomAlert {...alertState} onClose={closeAlert} />
        <ConfirmationDialog />

        <PageHeader
          icon={LayoutGrid}
          title="Modules de la plateforme"
          subtitle="Activation, visibilité dans le menu et libellés des modules fonctionnels."
          breadcrumb={[{ label: 'Administration' }, { label: 'Modules' }]}
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <StatGrid
          ariaLabel="État des modules"
          items={[
            { label: 'Modules déclarés', value: tous.length, icon: LayoutGrid, tone: 'blue' },
            { label: 'Actifs', value: tous.filter((module) => module.est_actif).length, icon: Power, tone: 'green' },
            {
              label: 'Masqués du menu',
              value: tous.filter((module) => !module.est_visible_menu).length,
              hint: 'Actifs mais absents de la navigation',
              icon: EyeOff,
              tone: 'gold',
            },
            {
              label: 'Sous-modules',
              value: modules.reduce((somme, module) => somme + (module.submodules?.length || 0), 0),
              icon: LayoutGrid,
              tone: 'violet',
            },
          ]}
        />

        <Note tone="info" icon={Info}>
          Un module <strong>désactivé</strong> disparaît de l’application et emporte ses
          sous-modules. Un module <strong>masqué</strong> reste actif mais n’apparaît plus dans le
          menu de navigation.
        </Note>

        <section className="sn-card admin-page__filtres" aria-label="Filtres des modules">
          <label className="sn-field admin-page__filtre-large">
            <span className="sn-field__label">Rechercher</span>
            <input
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Nom, code ou route…"
            />
          </label>
          <button type="button" className="sn-btn" onClick={() => setRecherche('')} disabled={!recherche}>
            Réinitialiser
          </button>
        </section>

        <Section
          id="modules"
          icon={LayoutGrid}
          tone="emerald"
          title={`Modules (${visibles.length})`}
          description="Les sous-modules apparaissent sous leur module parent."
        >
          {loading ? (
            <div className="admin-page__loading">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des modules…
            </div>
          ) : visibles.length === 0 ? (
            <EmptyState
              title="Aucun module"
              description={
                modules.length === 0
                  ? 'Aucun module n’est déclaré dans la plateforme.'
                  : 'Aucun module ne correspond à cette recherche.'
              }
            />
          ) : (
            <div className="modules__liste">
              {visibles.map((module) => (
                <div key={module.id} className="modules__groupe">
                  {carte(module)}
                  {(module.submodules || []).map((sousModule) => carte(sousModule, true))}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}
