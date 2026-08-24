import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Contact,
  Loader2,
  Lock,
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
import { assignableRoles, canAssignRole, canManageAccount } from '@/lib/roleHierarchy';
import {
  OPERATIONAL_CAPABILITY_OPTIONS,
  operationalCapabilitiesForRole,
  type OperationalCapabilityMap,
} from '@/lib/capabilities';
import { userCapabilitiesService } from '@/services/userCapabilitiesService';
import type { UserRole } from '@/types/auth';
import './admin.css';

export interface UserFormData {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole | '';
  miningCompanyIds: string[];
  isActive: boolean;
}

export const EMPTY_USER_FORM: UserFormData = {
  fullName: '',
  email: '',
  phone: '',
  role: '',
  miningCompanyIds: [],
  isActive: true,
};

/** Vocation de chaque rôle, en français et sans référence à un module inexistant. */
export const DESCRIPTIONS_ROLE: Record<UserRole, string> = {
  owner: 'Accès complet, y compris l’administration de la plateforme',
  admin: 'Administration des comptes, référentiels et paramètres',
  management: 'Pilotage national et validation des opérations',
  manager: 'Consultation consolidée sans création, modification ni validation',
  factory: 'Déclaration de la production et préparation des expéditions',
  airport: 'Réception et contrôle des expéditions au départ',
  refinery: 'Traitement des lots reçus et suivi de l’affinage',
  customer: 'Consultation de ses commandes et de ses documents',
  mine: 'Compte principal d’une société, limité à son propre périmètre',
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
export function validateIdentite(
  form: UserFormData,
  _isEditMode: boolean,
  indisponibilites: ReadonlyMap<string, string> = new Map(),
): string | null {
  if (!form.fullName.trim()) return 'Le nom complet est obligatoire.';
  if (!form.email.trim()) return 'L’adresse e-mail est obligatoire.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'L’adresse e-mail est invalide.';
  if (!form.role) return 'Sélectionnez un rôle.';
  if (form.role === 'mine' && form.miningCompanyIds.length !== 1) return 'Rattachez le compte Société minière à une compagnie unique.';
  if (form.role === 'mine') {
    const indisponibilite = indisponibilites.get(form.miningCompanyIds[0]);
    if (indisponibilite) return indisponibilite;
  }
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

export interface MiningCompany {
  id: string;
  name: string;
  abbreviation: string | null;
  is_active: boolean;
}

export interface MiningCompanyAccount {
  id: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  mining_company_id: string;
}

export function indisponibiliteSocieteMiniere(
  compagnie: MiningCompany,
  comptes: MiningCompanyAccount[],
  utilisateurModifie?: string | null,
): { message: string; compte: MiningCompanyAccount | null } | null {
  if (compagnie.is_active === false) {
    return { message: 'La société minière sélectionnée est inactive.', compte: null };
  }

  const compte = comptes.find((candidat) =>
    candidat.mining_company_id === compagnie.id && candidat.id !== utilisateurModifie
  ) ?? null;

  return compte
    ? { message: 'Cette société minière possède déjà un compte.', compte }
    : null;
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
  const [roleInitial, setRoleInitial] = useState<UserRole | null>(null);
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [permissionsEnBase, setPermissionsEnBase] = useState<PermissionMap>({});
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({});
  const [capacitesEnBase, setCapacitesEnBase] = useState<OperationalCapabilityMap>(
    operationalCapabilitiesForRole(''),
  );
  const [capacites, setCapacites] = useState<OperationalCapabilityMap>(
    operationalCapabilitiesForRole(''),
  );
  const [compagnies, setCompagnies] = useState<MiningCompany[]>([]);
  const [comptesCompagnies, setComptesCompagnies] = useState<MiningCompanyAccount[]>([]);

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const [resultatSocietes, resultatComptesCompagnies] = await Promise.all([
        supabase
          .from('mining_companies')
          .select('id, name, abbreviation, is_active')
          .order('name'),
        supabase
          .from('user_profiles')
          .select('id, full_name, email, is_active, mining_company_id')
          .eq('role', 'mine')
          .not('mining_company_id', 'is', null),
      ]);
      const { data: societes, error: erreurSocietes } = resultatSocietes;
      if (erreurSocietes) throw erreurSocietes;
      setCompagnies((societes || []).map((societe) => ({
        ...societe,
        // Une valeur historique nulle ne doit jamais rendre une société sélectionnable.
        is_active: societe.is_active === true,
      })));
      const { data: comptesMines, error: erreurComptesMines } = resultatComptesCompagnies;
      if (erreurComptesMines) throw erreurComptesMines;
      setComptesCompagnies((comptesMines || []) as MiningCompanyAccount[]);

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
        if (!profil) throw new Error('Le compte demandé est introuvable.');

        setRoleInitial((profil.role as UserRole) || null);

        setForm({
          fullName: profil?.full_name || '',
          email: profil?.email || '',
          phone: profil?.phone || '',
          role: (profil?.role as UserRole) || '',
          miningCompanyIds: profil?.mining_company_id ? [profil.mining_company_id] : [],
          isActive: profil?.is_active !== false,
        });

        const capacitesRole = operationalCapabilitiesForRole((profil.role as UserRole) || '');
        const { overrides, error: erreurCapacites } = await userCapabilitiesService.load(userId);
        if (erreurCapacites) setErreur(erreurCapacites);
        const capacitesEffectives = { ...capacitesRole, ...overrides };
        setCapacitesEnBase(capacitesEffectives);
        setCapacites(capacitesEffectives);

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

  const setRole = (role: UserRole) => {
    setForm((current) => ({
      ...current,
      role,
      miningCompanyIds: role === 'mine' && current.role === 'mine'
        ? current.miningCompanyIds
        : [],
    }));
    const defaults = operationalCapabilitiesForRole(role);
    setCapacites(defaults);
    if (!isEditMode) setCapacitesEnBase(defaults);
  };

  const indisponibilitesCompagnies = useMemo(() => new Map(
    compagnies.flatMap((compagnie) => {
      const indisponibilite = indisponibiliteSocieteMiniere(
        compagnie,
        comptesCompagnies,
        userId,
      );
      return indisponibilite ? [[compagnie.id, indisponibilite.message] as const] : [];
    }),
  ), [compagnies, comptesCompagnies, userId]);
  const erreurIdentite = validateIdentite(form, isEditMode, indisponibilitesCompagnies);
  const editionPropreCompte = Boolean(userId && utilisateurCourant?.id === userId);
  const peutAdministrerCompte = !isEditMode || Boolean(
    roleInitial
    && canManageAccount(utilisateurCourant?.role, roleInitial, utilisateurCourant?.id, userId),
  );
  const rolesDisponibles = useMemo(
    () => assignableRoles(utilisateurCourant?.role, ALL_ROLES),
    [utilisateurCourant?.role],
  );
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
    const message = validateIdentite(form, isEditMode, indisponibilitesCompagnies);
    if (message) {
      setErreur(message);
      setEtape(1);
      return;
    }
    if (!utilisateurCourant?.id) {
      setErreur('Session expirée : reconnectez-vous avant d’enregistrer.');
      return;
    }
    if (editionPropreCompte) {
      setErreur('Vous ne pouvez pas administrer votre propre compte depuis cet écran.');
      return;
    }
    if (!peutAdministrerCompte) {
      setErreur('Votre rôle ne permet pas d’administrer ce compte.');
      return;
    }
    if (!canAssignRole(utilisateurCourant.role, form.role as UserRole)) {
      setErreur('Vous ne pouvez pas attribuer un rôle supérieur au vôtre.');
      setEtape(1);
      return;
    }

    setSaving(true);
    setErreur(null);
    try {
      let identifiant = userId;
      const permissionsEnregistrees = form.role === 'manager'
        ? appliquerGabarit(permissions, 'consultation')
        : permissions;

      if (!isEditMode) {
        const resultat = await createUser({
          email: form.email,
          full_name: form.fullName,
          phone: form.phone,
          role: form.role as UserRole,
          is_active: form.isActive,
          mining_company_id: form.role === 'mine' ? form.miningCompanyIds[0] : null,
          permissions: permissionsEnregistrees,
          capabilities: capacites,
        });
        if (!resultat.success || !resultat.user) {
          throw new Error(resultat.error || 'La création du compte a échoué.');
        }
        identifiant = resultat.user.id;
      } else {
        if (!identifiant) {
          throw new Error('Le compte à modifier est introuvable.');
        }
        const { error } = await supabase.rpc('snp_configurer_compte_portail', {
          p_user_id: identifiant,
          p_full_name: form.fullName,
          p_phone: form.phone || null,
          p_role: form.role,
          p_is_active: form.isActive,
          p_mining_company_id: form.role === 'mine' ? form.miningCompanyIds[0] : null,
        });
        if (error) throw error;
      }

      // Pour une création, le serveur enregistre profil et habilitations dans
      // la même opération et annule l'ensemble si le courriel échoue. En
      // modification seulement, les droits sont mis à jour séparément.
      if (identifiant && isEditMode) {
        const resultat = await userPermissionsService.save(
          identifiant,
          permissionsEnBase,
          permissionsEnregistrees,
          utilisateurCourant.id
        );
        if (!resultat.success) throw new Error(resultat.error);

        const resultatCapacites = await userCapabilitiesService.save(
          identifiant,
          capacitesEnBase,
          capacites,
        );
        if (!resultatCapacites.success) throw new Error(resultatCapacites.error);
      }

      addToast(
        isEditMode ? 'Compte mis à jour' : 'Compte créé — courriel de bienvenue envoyé',
        'success'
      );
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
                  disabled={Boolean(erreurIdentite) || editionPropreCompte || !peutAdministrerCompte}
                >
                  Habilitations <ArrowRight aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => void enregistrer()}
                  disabled={saving || editionPropreCompte || !peutAdministrerCompte}
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

        {editionPropreCompte && (
          <Note tone="warning" icon={Lock}>
            Votre propre rôle, votre état et vos habilitations ne peuvent pas être modifiés depuis
            l’administration. Cette séparation empêche toute auto‑promotion. Utilisez « Mon profil »
            uniquement pour vos coordonnées personnelles.
          </Note>
        )}

        {isEditMode && !editionPropreCompte && !peutAdministrerCompte && (
          <Note tone="danger" icon={Lock}>
            Ce compte possède un niveau supérieur au vôtre. Sa modification est réservée à un compte
            disposant d’un niveau au moins équivalent.
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
                    disabled={editionPropreCompte || !peutAdministrerCompte}
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
                {rolesDisponibles.map((role) => (
                  <li key={role}>
                    <label className={form.role === role ? 'is-checked' : ''}>
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={form.role === role}
                        disabled={editionPropreCompte || !peutAdministrerCompte}
                        onChange={() => setRole(role)}
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

            {form.role === 'mine' && <Section
              id="rattachement"
              icon={Building2}
              tone="blue"
              title="Société représentée"
              description="Une seule société définit le périmètre autoritatif de ce compte."
            >
              {compagnies.length === 0 ? (
                <EmptyState
                  title="Aucune compagnie minière"
                  description="Aucune compagnie n’est enregistrée : le rattachement est impossible."
                />
              ) : (
                <>
                  <div className="compte__disponibilite" aria-live="polite">
                    <strong>
                      {compagnies.length - indisponibilitesCompagnies.size} disponible(s)
                    </strong>
                    <span>sur {compagnies.length} société(s) minière(s)</span>
                  </div>
                  <ul className="compte__compagnies">
                    {compagnies.map((compagnie) => {
                      const retenue = form.miningCompanyIds.includes(compagnie.id);
                      const indisponibilite = indisponibiliteSocieteMiniere(
                        compagnie,
                        comptesCompagnies,
                        userId,
                      );
                      const indisponible = Boolean(indisponibilite);
                      return (
                        <li key={compagnie.id}>
                          <label className={[
                            retenue ? 'is-checked' : '',
                            indisponible ? 'is-unavailable' : '',
                          ].filter(Boolean).join(' ')}>
                            <input
                              type="radio"
                              name="mining-company"
                              checked={retenue}
                              disabled={
                                indisponible
                                || editionPropreCompte
                                || !peutAdministrerCompte
                              }
                              onChange={() => setValue('miningCompanyIds', [compagnie.id])}
                            />
                            <span>
                              <strong>{compagnie.name}</strong>
                              {indisponibilite?.compte ? (
                                <small>
                                  Compte : {indisponibilite.compte.full_name || indisponibilite.compte.email}
                                </small>
                              ) : compagnie.abbreviation ? <small>{compagnie.abbreviation}</small> : null}
                            </span>
                            {indisponible ? (
                              <Badge tone="neutral">
                                {indisponibilite?.compte ? 'Compte déjà créé' : 'Inactive'}
                              </Badge>
                            ) : (
                              <Badge tone="success">Disponible</Badge>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Section>}

            {!isEditMode && (
              <Section
                id="acces"
                icon={ShieldCheck}
                tone="amber"
                title="Activation sécurisée"
                description="Le titulaire définit lui-même ses accès ; aucun mot de passe ne vous est communiqué."
              >
                <Note tone="info" icon={ShieldCheck}>
                  Après la création, un courriel individuel sera envoyé à <strong>{form.email || 'l’adresse renseignée'}</strong>.
                  Son lien à usage unique permettra de définir un mot de passe personnel. L’enrôlement à
                  l’authentification à deux facteurs sera ensuite obligatoire avant l’ouverture des données.
                </Note>
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
            <div className="compte__responsabilites">
              <div>
                <strong>Responsabilités métier</strong>
                <p>
                  Elles complètent le rôle de portail. Le serveur contrôle chaque étape et interdit
                  l’auto-approbation, même si plusieurs responsabilités sont cochées.
                </p>
              </div>
              {form.role === 'manager' && (
                <Note tone="info" icon={Lock}>
                  Le profil Manager reste strictement en lecture seule : aucune responsabilité
                  opérationnelle ne peut lui être attribuée.
                </Note>
              )}
              <ul className="compte__roles">
                {OPERATIONAL_CAPABILITY_OPTIONS.map((option) => (
                  <li key={option.code}>
                    <label className={capacites[option.code] ? 'is-checked' : ''}>
                      <input
                        type="checkbox"
                        checked={capacites[option.code]}
                        disabled={
                          form.role === 'manager'
                          || editionPropreCompte
                          || !peutAdministrerCompte
                        }
                        onChange={() => setCapacites((current) => ({
                          ...current,
                          [option.code]: !current[option.code],
                        }))}
                        aria-label={option.label}
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="compte__gabarits">
              <span className="sn-field__label">Gabarits</span>
              <button type="button" className="sn-btn sn-btn--sm" disabled={!peutAdministrerCompte || editionPropreCompte} onClick={() => setPermissions(appliquerGabarit(permissions, 'aucun'))}>
                Aucun droit
              </button>
              <button type="button" className="sn-btn sn-btn--sm" disabled={!peutAdministrerCompte || editionPropreCompte} onClick={() => setPermissions(appliquerGabarit(permissions, 'consultation'))}>
                Consultation seule
              </button>
              <button type="button" className="sn-btn sn-btn--sm" disabled={!peutAdministrerCompte || editionPropreCompte} onClick={() => setPermissions(appliquerGabarit(permissions, 'complet'))}>
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
                                disabled={!peutAdministrerCompte || editionPropreCompte}
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
