import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Contact,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section, Segmented } from '@/components/ui/sn';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { useAuth } from '@/contexts/AuthContext';
import { createUser } from '@/services/userManagementService';
import {
  EMPTY_PERMISSION,
  userPermissionsService,
  type ModulePermission,
  type PermissionMap,
  type PermissionModule,
} from '@/services/userPermissionsService';
import { ALL_ROLES, roleLabel, roleTone } from '@/lib/roleLabels';
import type { UserRole } from '@/types/auth';
import './admin.css';

export interface UserFormData {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole | '';
  miningCompanyIds: string[];
  password: string;
  isActive: boolean;
}

export const EMPTY_USER_FORM: UserFormData = {
  fullName: '',
  email: '',
  phone: '',
  role: '',
  miningCompanyIds: [],
  password: '',
  isActive: true,
};

/** Vocation de chaque rôle, en français et sans référence à un module inexistant. */
export const DESCRIPTIONS_ROLE: Record<UserRole, string> = {
  owner: 'Accès complet, y compris l’administration de la plateforme',
  admin: 'Administration des comptes, référentiels et paramètres',
  management: 'Pilotage national et validation des opérations',
  factory: 'Déclaration de la production et préparation des expéditions',
  airport: 'Réception et contrôle des expéditions au départ',
  refinery: 'Traitement des lots reçus et suivi de l’affinage',
  customer: 'Consultation de ses commandes et de ses documents',
};

type DroitClef = 'can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_approve';

export const DROITS: Array<{ clef: DroitClef; label: string }> = [
  { clef: 'can_view', label: 'Consulter' },
  { clef: 'can_create', label: 'Créer' },
  { clef: 'can_edit', label: 'Modifier' },
  { clef: 'can_delete', label: 'Supprimer' },
  { clef: 'can_approve', label: 'Approuver' },
];

/** Première obligation non satisfaite de l'étape « identité », ou `null`. */
export function validateIdentite(form: UserFormData, isEditMode: boolean): string | null {
  if (!form.fullName.trim()) return 'Le nom complet est obligatoire.';
  if (!form.email.trim()) return 'L’adresse e-mail est obligatoire.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'L’adresse e-mail est invalide.';
  if (!form.role) return 'Sélectionnez un rôle.';
  if (form.miningCompanyIds.length === 0) return 'Rattachez le compte à au moins une compagnie.';
  if (!isEditMode && form.password.length < 12) return 'Le mot de passe doit compter au moins 12 caractères.';
  return null;
}

/** Applique un gabarit d'habilitations à tous les modules. */
export function appliquerGabarit(
  permissions: Record<string, ModulePermission>,
  gabarit: 'aucun' | 'consultation' | 'complet'
): Record<string, ModulePermission> {
  const resultat: Record<string, ModulePermission> = {};
  Object.entries(permissions).forEach(([moduleId, permission]) => {
    resultat[moduleId] = {
      ...permission,
      can_view: gabarit !== 'aucun',
      can_create: gabarit === 'complet',
      can_edit: gabarit === 'complet',
      can_delete: gabarit === 'complet',
      can_approve: gabarit === 'complet',
    };
  });
  return resultat;
}

/** Mot de passe conforme : majuscule, minuscule, chiffre et caractère spécial. */
export function genererMotDePasse(longueur = 14): string {
  const majuscules = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minuscules = 'abcdefghijkmnopqrstuvwxyz';
  const chiffres = '23456789';
  const speciaux = '!@#$%*?';
  const tout = majuscules + minuscules + chiffres + speciaux;

  const tirer = (source: string) => source[Math.floor(Math.random() * source.length)];
  const base = [tirer(majuscules), tirer(minuscules), tirer(chiffres), tirer(speciaux)];
  while (base.length < longueur) base.push(tirer(tout));

  return base.sort(() => Math.random() - 0.5).join('');
}

interface MiningCompany {
  id: string;
  name: string;
  abbreviation: string | null;
}

export function UserManagementModern() {
  const { addToast } = useToast();
  const { user: utilisateurCourant } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const isEditMode = Boolean(userId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [etape, setEtape] = useState<1 | 2>(1);
  const [erreur, setErreur] = useState<string | null>(null);

  const [form, setForm] = useState<UserFormData>(EMPTY_USER_FORM);
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [permissionsEnBase, setPermissionsEnBase] = useState<PermissionMap>({});
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({});
  const [compagnies, setCompagnies] = useState<MiningCompany[]>([]);

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const { data: societes, error: erreurSocietes } = await supabase
        .from('mining_companies')
        .select('id, name, abbreviation')
        .order('name');
      if (erreurSocietes) throw erreurSocietes;
      setCompagnies(societes || []);

      // `user_permissions.module_id` référence `modules`, et non `snp_modules` comme
      // cet écran le faisait : les droits accordés portaient alors des identifiants
      // qu'aucun lecteur ne pouvait résoudre.
      const listeModules = await userPermissionsService.listModules();
      if (listeModules.error) setErreur(listeModules.error);
      setModules(listeModules.modules);

      const initiales: Record<string, ModulePermission> = {};
      listeModules.modules.forEach((module) => {
        initiales[module.id] = EMPTY_PERMISSION(module.id);
      });

      if (userId) {
        const { data: profil, error: erreurProfil } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (erreurProfil) throw erreurProfil;

        const { data: rattachements } = await supabase
          .from('user_site_assignments')
          .select('site_id')
          .eq('user_id', userId);

        setForm({
          fullName: profil?.full_name || '',
          email: profil?.email || '',
          phone: profil?.phone || '',
          role: (profil?.role as UserRole) || '',
          miningCompanyIds: (rattachements || []).map((ligne) => ligne.site_id),
          password: '',
          isActive: profil?.is_active !== false,
        });

        const { permissions: persistees, error: erreurPermissions } = await userPermissionsService.load(userId);
        if (erreurPermissions) setErreur(erreurPermissions);
        setPermissionsEnBase(persistees);
        setPermissions({ ...initiales, ...persistees });
      } else {
        setPermissions(initiales);
      }
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger les données du compte.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const setValue = <K extends keyof UserFormData>(clef: K, valeur: UserFormData[K]) =>
    setForm((current) => ({ ...current, [clef]: valeur }));

  const erreurIdentite = validateIdentite(form, isEditMode);
  const modulesOuverts = useMemo(
    () => Object.values(permissions).filter((permission) => permission.can_view).length,
    [permissions]
  );

  const basculer = (moduleId: string, droit: DroitClef) =>
    setPermissions((current) => {
      const base = current[moduleId] || EMPTY_PERMISSION(moduleId);
      const valeur = !base[droit];
      const suivant: ModulePermission = { ...base, [droit]: valeur };
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
    if (saving) return;
    const message = validateIdentite(form, isEditMode);
    if (message) {
      setErreur(message);
      setEtape(1);
      return;
    }
    if (!utilisateurCourant?.id) {
      setErreur('Session expirée : reconnectez-vous avant d’enregistrer.');
      return;
    }

    setSaving(true);
    setErreur(null);
    try {
      let identifiant = userId;

      if (!isEditMode) {
        const resultat = await createUser({
          email: form.email,
          password: form.password,
          full_name: form.fullName,
          phone: form.phone,
          role: form.role as UserRole,
          is_active: form.isActive,
        });
        if (!resultat.success || !resultat.user) {
          throw new Error(resultat.error || 'La création du compte a échoué.');
        }
        identifiant = resultat.user.id;
      } else {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            full_name: form.fullName,
            phone: form.phone,
            role: form.role,
            is_active: form.isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', identifiant);
        if (error) throw error;
      }

      if (identifiant) {
        // Les rattachements étaient supprimés puis réinsérés sans que l'issue de
        // l'une ou l'autre opération ne soit jamais vérifiée.
        const { error: erreurSuppression } = await supabase
          .from('user_site_assignments')
          .delete()
          .eq('user_id', identifiant);
        if (erreurSuppression) throw erreurSuppression;

        if (form.miningCompanyIds.length > 0) {
          const { error: erreurInsertion } = await supabase.from('user_site_assignments').insert(
            form.miningCompanyIds.map((siteId) => ({ user_id: identifiant, site_id: siteId }))
          );
          if (erreurInsertion) throw erreurInsertion;
        }

        const resultat = await userPermissionsService.save(
          identifiant,
          permissionsEnBase,
          permissions,
          utilisateurCourant.id
        );
        if (!resultat.success) throw new Error(resultat.error);
      }

      addToast(isEditMode ? 'Compte mis à jour' : 'Compte créé', 'success');
      navigate('/users');
    } catch (reason) {
      const message = errorMessage(reason, 'Enregistrement impossible.');
      setErreur(message);
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page admin-page">
          <div className="admin-page__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du compte…
          </div>
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page compte">
        <PageHeader
          icon={UserRound}
          title={isEditMode ? 'Modifier le compte' : 'Créer un compte'}
          subtitle={
            etape === 1
              ? 'Identité, rôle et rattachement aux compagnies minières.'
              : 'Habilitations accordées sur les modules de la plateforme.'
          }
          breadcrumb={[
            { label: 'Administration' },
            { label: 'Utilisateurs', to: '/users' },
            { label: isEditMode ? 'Modification' : 'Nouveau compte' },
          ]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/users')} disabled={saving}>
                <X aria-hidden="true" /> Annuler
              </button>
              {etape === 1 ? (
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => setEtape(2)}
                  disabled={Boolean(erreurIdentite)}
                >
                  Habilitations <ArrowRight aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => void enregistrer()}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                  {isEditMode ? 'Enregistrer les modifications' : 'Créer le compte'}
                </button>
              )}
            </>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <div className="compte__etapes" role="tablist" aria-label="Étapes de la saisie">
          <button
            type="button"
            role="tab"
            aria-selected={etape === 1}
            className={etape === 1 ? 'is-active' : ''}
            onClick={() => setEtape(1)}
          >
            <span>1</span> Identité et rôle
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={etape === 2}
            className={etape === 2 ? 'is-active' : ''}
            onClick={() => !erreurIdentite && setEtape(2)}
            disabled={Boolean(erreurIdentite)}
          >
            <span>2</span> Habilitations
          </button>
        </div>

        {etape === 1 ? (
          <>
            <Section
              id="identite"
              icon={Contact}
              tone="emerald"
              title="Identité"
              description="Coordonnées du titulaire du compte."
            >
              <div className="admin-form__row is-deux">
                <Field label="Nom complet" required htmlFor="nom-complet">
                  <input
                    id="nom-complet"
                    value={form.fullName}
                    onChange={(event) => setValue('fullName', event.target.value)}
                  />
                </Field>
                <Field label="Adresse e-mail" required htmlFor="courriel">
                  <input
                    id="courriel"
                    type="email"
                    value={form.email}
                    disabled={isEditMode}
                    onChange={(event) => setValue('email', event.target.value)}
                    placeholder="prenom.nom@sonasp.bf"
                  />
                </Field>
              </div>

              <div className="admin-form__row is-deux">
                <Field label="Téléphone" htmlFor="telephone">
                  <input
                    id="telephone"
                    value={form.phone}
                    onChange={(event) => setValue('phone', event.target.value)}
                    placeholder="+226 …"
                  />
                </Field>
                <div className="sn-field">
                  <span className="sn-field__label">État du compte</span>
                  <Segmented
                    name="etat-compte"
                    value={form.isActive ? 'actif' : 'inactif'}
                    options={[
                      { value: 'actif', label: 'Actif' },
                      { value: 'inactif', label: 'Désactivé' },
                    ]}
                    onChange={(etat) => setValue('isActive', etat === 'actif')}
                    ariaLabel="État du compte"
                  />
                </div>
              </div>
            </Section>

            <Section
              id="role"
              icon={ShieldCheck}
              tone="violet"
              title="Rôle"
              description="Le rôle détermine les écrans accessibles ; les habilitations affinent les droits."
            >
              {/* Les rôles propriétaire et administrateur étaient absents de la liste :
                  impossible de créer un administrateur depuis cet écran. */}
              <ul className="compte__roles">
                {ALL_ROLES.map((role) => (
                  <li key={role}>
                    <label className={form.role === role ? 'is-checked' : ''}>
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={form.role === role}
                        onChange={() => setValue('role', role)}
                      />
                      <span>
                        <strong>{roleLabel(role)}</strong>
                        <small>{DESCRIPTIONS_ROLE[role]}</small>
                      </span>
                      <Badge tone={roleTone(role)}>{roleLabel(role)}</Badge>
                    </label>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              id="rattachement"
              icon={Building2}
              tone="blue"
              title="Rattachement"
              description="Compagnies minières dont le titulaire suit les opérations."
            >
              {compagnies.length === 0 ? (
                <EmptyState
                  title="Aucune compagnie minière"
                  description="Aucune compagnie n’est enregistrée : le rattachement est impossible."
                />
              ) : (
                <ul className="compte__compagnies">
                  {compagnies.map((compagnie) => {
                    const retenue = form.miningCompanyIds.includes(compagnie.id);
                    return (
                      <li key={compagnie.id}>
                        <label className={retenue ? 'is-checked' : ''}>
                          <input
                            type="checkbox"
                            checked={retenue}
                            onChange={() =>
                              setValue(
                                'miningCompanyIds',
                                retenue
                                  ? form.miningCompanyIds.filter((id) => id !== compagnie.id)
                                  : [...form.miningCompanyIds, compagnie.id]
                              )
                            }
                          />
                          <span>
                            <strong>{compagnie.name}</strong>
                            {compagnie.abbreviation && <small>{compagnie.abbreviation}</small>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {!isEditMode && (
              <Section
                id="acces"
                icon={KeyRound}
                tone="amber"
                title="Mot de passe initial"
                description="À communiquer au titulaire, qui devra le changer à la première connexion."
              >
                <div className="admin-form__row is-deux">
                  <Field label="Mot de passe" required htmlFor="mot-de-passe" hint="12 caractères minimum">
                    <input
                      id="mot-de-passe"
                      type="text"
                      value={form.password}
                      onChange={(event) => setValue('password', event.target.value)}
                    />
                  </Field>
                  <div className="sn-field">
                    <span className="sn-field__label">&nbsp;</span>
                    <button
                      type="button"
                      className="sn-btn"
                      onClick={() => setValue('password', genererMotDePasse())}
                    >
                      <KeyRound aria-hidden="true" /> Générer un mot de passe
                    </button>
                  </div>
                </div>
              </Section>
            )}

            {erreurIdentite && (
              <Note tone="warning" icon={AlertTriangle}>
                {erreurIdentite}
              </Note>
            )}
          </>
        ) : (
          <Section
            id="habilitations"
            icon={ShieldCheck}
            tone="emerald"
            title={`Habilitations (${modulesOuverts} module(s) ouverts)`}
            description="Retirer la consultation retire les droits qui en dépendent."
          >
            <div className="compte__gabarits">
              <span className="sn-field__label">Gabarits</span>
              <button type="button" className="sn-btn sn-btn--sm" onClick={() => setPermissions(appliquerGabarit(permissions, 'aucun'))}>
                Aucun droit
              </button>
              <button type="button" className="sn-btn sn-btn--sm" onClick={() => setPermissions(appliquerGabarit(permissions, 'consultation'))}>
                Consultation seule
              </button>
              <button type="button" className="sn-btn sn-btn--sm" onClick={() => setPermissions(appliquerGabarit(permissions, 'complet'))}>
                Tous les droits
              </button>
            </div>

            {modules.length === 0 ? (
              <EmptyState
                title="Aucun module habilitable"
                description="Aucun module actif n’est déclaré : les habilitations ne peuvent pas être attribuées."
              />
            ) : (
              <div className="admin-page__table-wrap">
                <table className="admin-page__table permissions__table">
                  <caption className="sr-only">Habilitations par module</caption>
                  <thead>
                    <tr>
                      <th scope="col">Module</th>
                      {DROITS.map((droit) => (
                        <th key={droit.clef} scope="col" className="is-centre">
                          {droit.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((module) => {
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
                                onChange={() => basculer(module.id, droit.clef)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        <div className="sn-form-actions">
          {etape === 2 && (
            <button type="button" className="sn-btn" onClick={() => setEtape(1)} disabled={saving}>
              <ArrowLeft aria-hidden="true" /> Revenir à l’identité
            </button>
          )}
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
