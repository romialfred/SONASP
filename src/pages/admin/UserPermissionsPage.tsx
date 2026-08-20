import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, KeyRound, Loader2, Save, ShieldCheck, UserRound } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { useConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { NotificationDialog, useNotification } from '@/components/ui/NotificationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { roleLabel, roleTone } from '@/lib/roleLabels';
import {
  EMPTY_PERMISSION,
  estAccordee,
  userPermissionsService,
  type ModulePermission,
  type PermissionMap,
  type PermissionModule,
} from '@/services/userPermissionsService';
import './admin.css';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

type DroitClef = 'can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_approve';

export const DROITS: Array<{ clef: DroitClef; label: string; description: string }> = [
  { clef: 'can_view', label: 'Consulter', description: 'Accéder au module et lire ses données' },
  { clef: 'can_create', label: 'Créer', description: 'Enregistrer de nouveaux éléments' },
  { clef: 'can_edit', label: 'Modifier', description: 'Mettre à jour les éléments existants' },
  { clef: 'can_delete', label: 'Supprimer', description: 'Retirer définitivement des éléments' },
  { clef: 'can_approve', label: 'Approuver', description: 'Valider les demandes soumises à contrôle' },
];

/** Regroupe les modules par catégorie, sans catégorie codée en dur. */
export function grouperParCategorie(modules: PermissionModule[]): Array<{ categorie: string; modules: PermissionModule[] }> {
  const groupes = new Map<string, PermissionModule[]>();
  modules.forEach((module) => {
    const categorie = module.category?.trim() || 'Autres modules';
    groupes.set(categorie, [...(groupes.get(categorie) || []), module]);
  });
  return Array.from(groupes.entries())
    .map(([categorie, liste]) => ({ categorie, modules: liste }))
    .sort((a, b) => a.categorie.localeCompare(b.categorie, 'fr'));
}

export const compterAccordees = (permissions: PermissionMap): number =>
  Object.values(permissions).filter(estAccordee).length;

export function UserPermissionsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: utilisateurCourant } = useAuth();
  const { notification, showSuccess, showError, closeNotification } = useNotification();
  const { open: demanderConfirmation, ConfirmationDialog } = useConfirmationDialog();

  const [profil, setProfil] = useState<UserProfile | null>(null);
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [enBase, setEnBase] = useState<PermissionMap>({});
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Sans chargement fiable, aucun enregistrement : sinon un écran vide révoque tout. */
  const [chargementFiable, setChargementFiable] = useState(false);

  const charger = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErreur(null);
    setChargementFiable(false);

    const [compte, listeModules, habilitations] = await Promise.all([
      supabase.from('user_profiles').select('id, email, full_name, role, is_active').eq('id', userId).maybeSingle(),
      userPermissionsService.listModules(),
      userPermissionsService.load(userId),
    ]);

    if (compte.error) {
      setErreur(errorMessage(compte.error, 'Impossible de charger ce compte.'));
    } else {
      setProfil(compte.data);
    }

    if (listeModules.error) {
      setErreur(listeModules.error);
      setModules([]);
    } else {
      setModules(listeModules.modules);
    }

    if (habilitations.error) {
      setErreur(habilitations.error);
    } else {
      setEnBase(habilitations.permissions);
      setPermissions(habilitations.permissions);
      // L'enregistrement n'est autorisé que si l'état de départ est connu avec certitude.
      setChargementFiable(!listeModules.error);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const groupes = useMemo(() => grouperParCategorie(modules), [modules]);
  const accordees = compterAccordees(permissions);
  const modifie = useMemo(() => JSON.stringify(enBase) !== JSON.stringify(permissions), [enBase, permissions]);

  const basculer = (moduleId: string, droit: DroitClef, valeur: boolean) =>
    setPermissions((current) => {
      const base = current[moduleId] || EMPTY_PERMISSION(moduleId);
      const suivant: ModulePermission = { ...base, [droit]: valeur };
      // Retirer la consultation retire tout le reste : les autres droits n'ont pas de sens sans elle.
      if (droit === 'can_view' && !valeur) {
        suivant.can_create = false;
        suivant.can_edit = false;
        suivant.can_delete = false;
        suivant.can_approve = false;
      }
      if (droit !== 'can_view' && valeur) suivant.can_view = true;
      return { ...current, [moduleId]: suivant };
    });

  const enregistrer = async () => {
    if (!userId || saving || !chargementFiable) return;

    const perdus = Object.keys(enBase).filter((moduleId) => !estAccordee(permissions[moduleId] || EMPTY_PERMISSION(moduleId)));
    const confirme = await demanderConfirmation({
      title: 'Appliquer ces habilitations ?',
      message: `${accordees} module(s) resteront accessibles à ${profil?.full_name || profil?.email}.${
        perdus.length > 0 ? ` ${perdus.length} habilitation(s) seront retirées.` : ''
      }`,
      confirmText: 'Appliquer',
      cancelText: 'Annuler',
      severity: perdus.length > 0 ? 'danger' : 'info',
    });
    if (!confirme) return;

    setSaving(true);
    const resultat = await userPermissionsService.save(userId, enBase, permissions, utilisateurCourant?.id);
    setSaving(false);

    if (resultat.success) {
      setEnBase(permissions);
      showSuccess('Habilitations enregistrées', `Les droits de ${profil?.full_name || profil?.email} ont été mis à jour.`);
    } else {
      showError('Enregistrement impossible', resultat.error || 'Les habilitations n’ont pas été modifiées.');
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page permissions">
        <NotificationDialog {...notification} onClose={closeNotification} />
        <ConfirmationDialog />

        <PageHeader
          icon={KeyRound}
          title="Habilitations"
          subtitle={
            profil
              ? `Droits accordés à ${profil.full_name || profil.email} sur les modules de la plateforme.`
              : 'Droits accordés sur les modules de la plateforme.'
          }
          breadcrumb={[
            { label: 'Administration' },
            { label: 'Utilisateurs', to: '/admin/users' },
            { label: 'Habilitations' },
          ]}
          aside={
            profil && (
              <div className="user-detail__badges">
                <Badge tone={roleTone(profil.role)} icon={ShieldCheck}>
                  {roleLabel(profil.role)}
                </Badge>
                <Badge tone={profil.is_active ? 'success' : 'danger'}>
                  {profil.is_active ? 'Compte actif' : 'Compte désactivé'}
                </Badge>
              </div>
            )
          }
          actions={
            <>
              <button
                type="button"
                className="sn-btn"
                onClick={() => navigate(userId ? `/users/${userId}` : '/admin/users')}
              >
                <ArrowLeft aria-hidden="true" /> Retour au dossier
              </button>
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => void enregistrer()}
                disabled={saving || !chargementFiable || !modifie}
              >
                {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                Appliquer les habilitations
              </button>
            </>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        {!loading && !chargementFiable && (
          <Note tone="warning" icon={AlertTriangle}>
            Habilitations illisibles : enregistrement désactivé par sécurité.
          </Note>
        )}

        <StatGrid
          ariaLabel="Portée des habilitations"
          items={[
            { label: 'Modules ouverts', value: accordees, icon: KeyRound, tone: 'green' },
            { label: 'Modules disponibles', value: modules.length, icon: ShieldCheck, tone: 'blue' },
            {
              label: 'Droits d’approbation',
              value: Object.values(permissions).filter((permission) => permission.can_approve).length,
              hint: 'Validation des demandes soumises à contrôle',
              icon: UserRound,
              tone: 'violet',
            },
            {
              label: 'Droits de suppression',
              value: Object.values(permissions).filter((permission) => permission.can_delete).length,
              icon: AlertTriangle,
              tone: 'red',
            },
          ]}
        />

        {loading ? (
          <div className="admin-page__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des habilitations…
          </div>
        ) : groupes.length === 0 ? (
          <Section id="vide" icon={KeyRound} tone="slate" title="Habilitations">
            <EmptyState
              title="Aucun module habilitable"
              description="Aucun module actif n’est déclaré : les habilitations ne peuvent pas être attribuées."
            />
          </Section>
        ) : (
          groupes.map((groupe) => (
            <Section
              key={groupe.categorie}
              id={`categorie-${groupe.categorie}`}
              icon={KeyRound}
              tone="emerald"
              title={groupe.categorie}
              description={`${groupe.modules.length} module(s) de cette catégorie.`}
            >
              <div className="admin-page__table-wrap">
                <table className="admin-page__table permissions__table">
                  <caption className="sr-only">Habilitations sur les modules de {groupe.categorie}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Module</th>
                      {DROITS.map((droit) => (
                        <th key={droit.clef} scope="col" className="is-centre" title={droit.description}>
                          {droit.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupe.modules.map((module) => {
                      const permission = permissions[module.id] || EMPTY_PERMISSION(module.id);
                      return (
                        <tr key={module.id}>
                          <td>
                            <strong>{module.display_name || module.name}</strong>
                            {module.description && <small>{module.description}</small>}
                          </td>
                          {DROITS.map((droit) => (
                            <td key={droit.clef} className="is-centre">
                              <input
                                type="checkbox"
                                checked={permission[droit.clef]}
                                aria-label={`${droit.label} — ${module.display_name || module.name}`}
                                onChange={(event) => basculer(module.id, droit.clef, event.target.checked)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          ))
        )}
      </div>
    </NationalDashboardLayout>
  );
}
