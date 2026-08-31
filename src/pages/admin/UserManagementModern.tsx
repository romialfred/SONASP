import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Contact,
  Loader2,
  Lock,
  RefreshCw,
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
import { getAdministrationUserDetails } from '@/services/userAdministrationDetailsService';
import {
  EMPTY_PERMISSION,
  userPermissionsService,
  type ModulePermission,
  type PermissionModule,
} from '@/services/userPermissionsService';
import { roleLabel, roleTone, type RoleTone } from '@/lib/roleLabels';
import { canAssignRole, canManageAccount } from '@/lib/roleHierarchy';
import {
  type OperationalCapabilityMap,
} from '@/lib/capabilities';
import {
  ACCOUNT_CREATION_ROLES as POLICY_ACCOUNT_CREATION_ROLES,
  accountRolePolicy,
  availableModulesFor,
  boundPermissionToCeiling,
  defaultResponsibilitiesForRole,
  permissionCeilingFor,
  permissionsForPreset,
  responsibilitiesForRole,
  validateResponsibilities,
  type AccountCreationRole,
  type OrganizationType,
} from '@/lib/accessControl';
import { userCapabilitiesService } from '@/services/userCapabilitiesService';
import type { UserRole } from '@/types/auth';
import './admin.css';

export type AccountRoleChoice = AccountCreationRole | Exclude<UserRole, AccountCreationRole>;

export interface UserFormData {
  fullName: string;
  email: string;
  phone: string;
  role: AccountRoleChoice | '';
  miningCompanyIds: string[];
  comptoirOrganizationId: string;
  comptoirOrganizationCode: string;
  comptoirOrganizationName: string;
  organizationId: string;
  collectorId: string;
  isActive: boolean;
}

export const EMPTY_USER_FORM: UserFormData = {
  fullName: '',
  email: '',
  phone: '',
  role: '',
  miningCompanyIds: [],
  comptoirOrganizationId: '',
  comptoirOrganizationCode: '',
  comptoirOrganizationName: '',
  organizationId: '',
  collectorId: '',
  isActive: true,
};

export const NEW_COMPTOIR_VALUE = '__new_comptoir__';

/**
 * Profils proposés lors d'une nouvelle création. Les anciens profils Usine,
 * Aéroport et Manager restent lisibles en modification, mais leurs opérations
 * sont désormais portées respectivement par Société minière ou Direction.
 */
export const ACCOUNT_CREATION_ROLES: AccountRoleChoice[] = [...POLICY_ACCOUNT_CREATION_ROLES];

export const persistedRole = (role: AccountRoleChoice | ''): UserRole | '' =>
  role;

export const accountRoleLabel = (role: AccountRoleChoice): string =>
  accountRolePolicy(role)?.label ?? roleLabel(role);

export const accountRoleTone = (role: AccountRoleChoice): RoleTone =>
  accountRolePolicy(role)?.badgeTone ?? roleTone(role);

/** Vocation de chaque rôle, en français et sans référence à un module inexistant. */
export const DESCRIPTIONS_ROLE: Record<UserRole, string> = {
  owner: 'Accès complet à tous les modules, paramètres et opérations de la plateforme',
  admin: 'Administration des comptes, référentiels et paramètres',
  management: 'Pilotage national et validation des opérations',
  manager: 'Consultation consolidée sans création, modification ni validation',
  factory: 'Déclaration de la production et préparation des expéditions',
  airport: 'Réception et contrôle des expéditions au départ',
  refinery: 'Traitement des lots reçus et suivi de l’affinage',
  customer: 'Consultation de ses commandes et de ses documents',
  mine: 'Compte principal d’une société, limité à son propre périmètre',
  dgmg: 'Supervision réglementaire des opérateurs et productions minières',
  dgi: 'Contrôle fiscal, taxes, royalties et rapprochements autorisés',
  comptoir: 'Achats, collecte, stocks et ventes limités au comptoir représenté',
  collector: 'Collecte terrain limitée aux orpailleurs et zones rattachés',
};

export const DESCRIPTION_COMPTOIR =
  'Achats aux orpailleurs, facturation DGI, paiements, taxes et vente à la SONASP';

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
  if (!accountRolePolicy(form.role)) {
    return 'Remplacez ce rôle historique par un rôle institutionnel avant d’enregistrer.';
  }
  if (form.role === 'mine' && form.miningCompanyIds.length !== 1) return 'Rattachez le compte Société minière à une compagnie unique.';
  if (form.role === 'mine') {
    const indisponibilite = indisponibilites.get(form.miningCompanyIds[0]);
    if (indisponibilite) return indisponibilite;
  }
  if (form.role === 'comptoir') {
    if (!form.comptoirOrganizationId) return 'Sélectionnez ou créez le comptoir représenté.';
    if (form.comptoirOrganizationId === NEW_COMPTOIR_VALUE) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,19}$/.test(form.comptoirOrganizationCode.trim())) {
        return 'Le code du comptoir doit contenir 2 à 20 lettres, chiffres, tirets ou tirets bas.';
      }
      if (form.comptoirOrganizationName.trim().length < 3) {
        return 'Le nom du comptoir doit contenir au moins 3 caractères.';
      }
    }
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

export interface ComptoirOrganization {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface AccessOrganization extends ComptoirOrganization {
  organization_type: OrganizationType;
}

export interface CollectorProfile {
  id: string;
  display_name: string;
  organization_id: string | null;
  organization_name: string | null;
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
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const isEditMode = pathname === '/users/edit' || Boolean(userId);
  const requestKey = isEditMode ? `edit:${userId ?? ''}` : 'new';
  const requestedStep = searchParams.get('step') === 'permissions' ? 2 : 1;

  const [loading, setLoading] = useState(true);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const [saving, setSaving] = useState(false);
  const [etape, setEtape] = useState<1 | 2>(requestedStep);
  const [erreur, setErreur] = useState<string | null>(null);

  const [form, setForm] = useState<UserFormData>(EMPTY_USER_FORM);
  const [roleInitial, setRoleInitial] = useState<UserRole | null>(null);
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({});
  const [capacites, setCapacites] = useState<OperationalCapabilityMap>(
    defaultResponsibilitiesForRole(''),
  );
  const [compagnies, setCompagnies] = useState<MiningCompany[]>([]);
  const [comptesCompagnies, setComptesCompagnies] = useState<MiningCompanyAccount[]>([]);
  const [comptoirs, setComptoirs] = useState<ComptoirOrganization[]>([]);
  const [organizations, setOrganizations] = useState<AccessOrganization[]>([]);
  const [collectors, setCollectors] = useState<CollectorProfile[]>([]);

  const charger = useCallback(async () => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const { signal } = controller;
    setLoading(true);
    setLoadError(null);
    setErreur(null);
    setEtape(requestedStep);
    setRoleInitial(null);
    setForm(EMPTY_USER_FORM);
    setPermissions({});
    setCapacites(defaultResponsibilitiesForRole(''));
    try {
      if (isEditMode && !userId?.trim()) {
        throw new Error('La référence du compte à modifier est absente.');
      }
      const [resultatSocietes, resultatComptesCompagnies, resultatOrganizations, resultatCollectors] = await Promise.all([
        supabase
          .from('mining_companies')
          .select('id, name, abbreviation, is_active')
          .order('name'),
        supabase
          .from('user_profiles')
          .select('id, full_name, email, is_active, mining_company_id')
          .eq('role', 'mine')
          .not('mining_company_id', 'is', null),
        (supabase as any)
          .from('snp_organizations')
          .select('id, code, name, organization_type, is_active')
          .eq('is_active', true)
          .order('name'),
        (supabase as any)
          .from('snp_artisans_miniers')
          .select('id, nom, prenoms, raison_sociale, artisanal_site_id, actif')
          .eq('type_artisan', 'collecteur')
          .eq('actif', true)
          .order('nom'),
      ]);
      if (signal.aborted) return;
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
      if (resultatOrganizations.error) {
        if (isEditMode) throw new Error('Impossible de charger le référentiel des organisations. Réessayez avant de modifier le compte.');
        // La création des autres profils reste disponible sur un environnement
        // où le référentiel Comptoir n'aurait pas encore été migré.
        console.warn('[Comptes] Référentiel des organisations indisponible.', resultatOrganizations.error);
        setOrganizations([]);
        setComptoirs([]);
      } else {
        const activeOrganizations = (resultatOrganizations.data || []) as AccessOrganization[];
        setOrganizations(activeOrganizations);
        setComptoirs(activeOrganizations.filter(({ organization_type }) => organization_type === 'comptoir'));
      }
      if (resultatCollectors.error) {
        if (isEditMode) throw new Error('Impossible de charger le référentiel des collecteurs. Réessayez avant de modifier le compte.');
        console.warn('[Comptes] Référentiel des collecteurs indisponible.', resultatCollectors.error);
        setCollectors([]);
      } else {
        setCollectors((resultatCollectors.data || []).map((collector: any) => ({
          id: collector.id,
          display_name: collector.raison_sociale || [collector.prenoms, collector.nom].filter(Boolean).join(' ') || 'Collecteur',
          organization_id: null,
          organization_name: null,
        })));
      }

      // `user_permissions.module_id` référence `modules`, et non `snp_modules` comme
      // cet écran le faisait : les droits accordés portaient alors des identifiants
      // qu'aucun lecteur ne pouvait résoudre.
      const listeModules = await userPermissionsService.listModules(true);
      if (signal.aborted) return;
      if (listeModules.error) throw new Error(listeModules.error);
      setModules(listeModules.modules);

      const initiales: Record<string, ModulePermission> = {};
      listeModules.modules.forEach((module) => {
        initiales[module.id] = EMPTY_PERMISSION(module.id);
      });

      if (userId) {
        // Même lecture autoritative que la fiche : la RLS historique des profils
        // ne permet pas au navigateur Owner de lire directement les autres comptes.
        // Le service contrôle session, AAL2 et hiérarchie sans élargir cette RLS.
        const { profile: profil } = await getAdministrationUserDetails(userId, signal);
        if (signal.aborted) return;
        if (profil.id !== userId) throw new Error('La fiche reçue ne correspond pas au compte demandé.');

        setRoleInitial((profil.role as UserRole) || null);

        setForm({
          fullName: profil?.full_name || '',
          email: profil?.email || '',
          phone: profil?.phone || '',
          role: (profil?.role as UserRole) || '',
          miningCompanyIds: profil?.mining_company_id ? [profil.mining_company_id] : [],
          comptoirOrganizationId: '',
          comptoirOrganizationCode: '',
          comptoirOrganizationName: '',
          organizationId: '',
          collectorId: '',
          isActive: profil?.is_active !== false,
        });

        const roleCompte = (profil.role as UserRole) || '';
        const capacitesRole = defaultResponsibilitiesForRole(roleCompte);
        const { data: responsibilitiesData, error: responsibilitiesError } = await (supabase as any)
          .from('snp_user_responsibilities')
          .select('responsibility_code')
          .eq('user_id', userId);
        if (signal.aborted) return;
        let capacitesEffectives = { ...capacitesRole };
        if (!responsibilitiesError && responsibilitiesData) {
          const compatible = new Set(responsibilitiesForRole(roleCompte).map(({ code }) => code));
          responsibilitiesData.forEach(({ responsibility_code }: { responsibility_code: keyof OperationalCapabilityMap }) => {
            if (compatible.has(responsibility_code)) capacitesEffectives[responsibility_code] = true;
          });
        } else {
          // Lecture de compatibilité tant que la migration IAM n'a pas encore été appliquée.
          const { overrides, error: erreurCapacites } = await userCapabilitiesService.load(userId);
          if (signal.aborted) return;
          if (erreurCapacites) throw new Error(erreurCapacites);
          const compatible = new Set(responsibilitiesForRole(roleCompte).map(({ code }) => code));
          Object.entries(overrides).forEach(([code, allowed]) => {
            if (compatible.has(code as keyof OperationalCapabilityMap)) {
              capacitesEffectives[code as keyof OperationalCapabilityMap] = allowed;
            }
          });
        }
        setCapacites(capacitesEffectives);

        const { permissions: persistees, error: erreurPermissions } = await userPermissionsService.load(userId);
        if (signal.aborted) return;
        if (erreurPermissions) throw new Error(erreurPermissions);
        setPermissions({ ...initiales, ...persistees });

        const { data: membership, error: membershipError } = await (supabase as any)
          .from('snp_user_organization_memberships')
          .select('organization_id, snp_organizations(id, code, name, organization_type)')
          .eq('user_id', userId)
          .eq('is_primary', true)
          .is('valid_until', null)
          .maybeSingle();
        if (signal.aborted) return;
        if (membershipError) throw new Error('Impossible de charger le rattachement du compte. Réessayez avant de modifier ses accès.');
        if (membership?.organization_id) {
          setForm((current) => ({
            ...current,
            organizationId: membership.organization_id,
            comptoirOrganizationId: membership.snp_organizations?.organization_type === 'comptoir'
              ? membership.organization_id
              : current.comptoirOrganizationId,
          }));
        }
        if (roleCompte === 'collector') {
          const { data: collectorAccount, error: collectorAccountError } = await (supabase as any)
            .from('snp_collector_accounts')
            .select('collector_id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();
          if (signal.aborted) return;
          if (collectorAccountError) throw new Error('Impossible de charger le profil collecteur rattaché au compte.');
          setForm((current) => ({ ...current, collectorId: collectorAccount?.collector_id || '' }));
        }
      } else {
        setPermissions(initiales);
      }
    } catch (reason) {
      if (!signal.aborted) setLoadError(errorMessage(reason, 'Impossible de charger les données du compte.'));
    } finally {
      if (!signal.aborted) {
        setLoadedKey(requestKey);
        setLoading(false);
      }
    }
  }, [isEditMode, requestKey, requestedStep, userId]);

  useEffect(() => {
    void charger();
    return () => loadController.current?.abort();
  }, [charger]);

  const setValue = <K extends keyof UserFormData>(clef: K, valeur: UserFormData[K]) =>
    setForm((current) => ({ ...current, [clef]: valeur }));

  const setRole = (role: AccountRoleChoice) => {
    const roleTechnique = persistedRole(role);
    setForm((current) => ({
      ...current,
      role,
      miningCompanyIds: role === 'mine' && current.role === 'mine'
        ? current.miningCompanyIds
        : [],
      comptoirOrganizationId: role === 'comptoir'
        ? current.comptoirOrganizationId
        : '',
      comptoirOrganizationCode: role === 'comptoir'
        ? current.comptoirOrganizationCode
        : '',
      comptoirOrganizationName: role === 'comptoir'
        ? current.comptoirOrganizationName
        : '',
      organizationId: current.role === role ? current.organizationId : '',
      collectorId: role === 'collector' && current.role === 'collector' ? current.collectorId : '',
    }));
    const defaults = defaultResponsibilitiesForRole(roleTechnique);
    setCapacites(defaults);
    setPermissions(permissionsForPreset(roleTechnique, defaults, modules, 'recommended'));
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
  const erreurResponsabilites = validateResponsibilities(form.role, capacites);
  const policy = accountRolePolicy(form.role);
  const organizationOptions = useMemo(() => {
    if (!policy?.organizationType) return [];
    if (form.role === 'collector') {
      return organizations.filter(({ organization_type }) => organization_type === 'comptoir');
    }
    return organizations.filter(({ organization_type }) => organization_type === policy.organizationType);
  }, [form.role, organizations, policy?.organizationType]);
  const erreurRattachement = useMemo(() => {
    if (!form.role || form.role === 'mine' || form.role === 'comptoir') return null;
    if (policy?.organizationRequired && !form.organizationId) {
      return `Sélectionnez l’organisation de rattachement pour le rôle ${policy.label}.`;
    }
    if (form.role === 'collector' && !form.collectorId) {
      return 'Sélectionnez le profil collecteur rattaché à ce compte.';
    }
    return null;
  }, [form.collectorId, form.organizationId, form.role, policy]);
  const erreurEtapeIdentite = erreurIdentite || erreurResponsabilites || erreurRattachement;
  const editionPropreCompte = Boolean(userId && utilisateurCourant?.id === userId);
  const peutAdministrerCompte = !isEditMode || Boolean(
    roleInitial
    && canManageAccount(utilisateurCourant?.role, roleInitial, utilisateurCourant?.id, userId),
  );
  const rolesDisponibles = useMemo(
    () => {
      const rolesCreation = ACCOUNT_CREATION_ROLES.filter((role) => {
        const roleTechnique = persistedRole(role);
        return Boolean(roleTechnique && canAssignRole(utilisateurCourant?.role, roleTechnique));
      });
      if (!isEditMode || !roleInitial || rolesCreation.includes(roleInitial)) return rolesCreation;
      // Compatibilité : un ancien compte Usine, Aéroport ou Manager reste
      // administrable sans réintroduire ce profil dans les nouvelles créations.
      return [...rolesCreation, roleInitial];
    },
    [isEditMode, roleInitial, utilisateurCourant?.role],
  );
  const modulesDisponibles = useMemo(
    () => availableModulesFor(form.role, capacites, modules)
      .filter((module) => form.role === 'owner' || module.is_active !== false),
    [capacites, form.role, modules],
  );
  const modulesOuverts = useMemo(
    () => form.role === 'owner' ? modulesDisponibles.length : modulesDisponibles.filter((module) => permissions[module.id]?.can_view).length,
    [form.role, modulesDisponibles, permissions]
  );

  const basculer = (moduleId: string, droit: DroitClef) =>
    setPermissions((current) => {
      const module = modules.find(({ id }) => id === moduleId);
      if (!module) return current;
      const ceiling = permissionCeilingFor(form.role, capacites, module);
      if (!ceiling[droit]) return current;
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
      return { ...current, [moduleId]: boundPermissionToCeiling(suivant, ceiling) };
    });

  const basculerResponsabilite = (code: keyof OperationalCapabilityMap) => {
    setCapacites((current) => {
      const next = { ...current, [code]: !current[code] };
      const validation = validateResponsibilities(form.role, next);
      if (validation) {
        setErreur(validation);
        return current;
      }
      setErreur(null);
      setPermissions((currentPermissions) => Object.fromEntries(
        availableModulesFor(form.role, next, modules).map((module) => [
          module.id,
          boundPermissionToCeiling(
            currentPermissions[module.id] || EMPTY_PERMISSION(module.id),
            permissionCeilingFor(form.role, next, module),
          ),
        ]),
      ));
      return next;
    });
  };

  const enregistrer = async () => {
    if (saving || loading || loadError || loadedKey !== requestKey) return;
    const message = validateIdentite(form, isEditMode, indisponibilitesCompagnies)
      || validateResponsibilities(form.role, capacites)
      || erreurRattachement;
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
    const roleTechnique = persistedRole(form.role);
    if (!roleTechnique || !canAssignRole(utilisateurCourant.role, roleTechnique)) {
      setErreur('Vous ne pouvez pas attribuer un rôle supérieur au vôtre.');
      setEtape(1);
      return;
    }

    setSaving(true);
    setErreur(null);
    try {
      let identifiant = userId;
      const permissionsEnregistrees = Object.fromEntries(modulesDisponibles.map((module) => [
        module.id,
        boundPermissionToCeiling(
          permissions[module.id] || EMPTY_PERMISSION(module.id),
          permissionCeilingFor(form.role, capacites, module),
        ),
      ]));

      if (!isEditMode) {
        const resultat = await createUser({
          email: form.email,
          full_name: form.fullName,
          phone: form.phone,
          role: roleTechnique,
          is_active: form.isActive,
          mining_company_id: form.role === 'mine' ? form.miningCompanyIds[0] : null,
          account_type: form.role,
          organization_id: form.role === 'comptoir' && form.comptoirOrganizationId !== NEW_COMPTOIR_VALUE
            ? form.comptoirOrganizationId
            : form.organizationId || undefined,
          organization_code: form.role === 'comptoir' && form.comptoirOrganizationId === NEW_COMPTOIR_VALUE
            ? form.comptoirOrganizationCode.trim().toUpperCase()
            : undefined,
          organization_name: form.role === 'comptoir' && form.comptoirOrganizationId === NEW_COMPTOIR_VALUE
            ? form.comptoirOrganizationName.trim()
            : undefined,
          permissions: permissionsEnregistrees,
          capabilities: capacites,
          responsibilities: capacites,
          collector_id: form.role === 'collector' ? form.collectorId : undefined,
        });
        if (!resultat.success || !resultat.user) {
          throw new Error(resultat.error || 'La création du compte a échoué.');
        }
        identifiant = resultat.user.id;
      } else {
        if (!identifiant) {
          throw new Error('Le compte à modifier est introuvable.');
        }
        const { error } = await (supabase as any).rpc('snp_configurer_acces_compte', {
          p_user_id: identifiant,
          p_full_name: form.fullName,
          p_phone: form.phone || null,
          p_role: form.role,
          p_is_active: form.isActive,
          p_mining_company_id: form.role === 'mine' ? form.miningCompanyIds[0] : null,
          p_organization_id: form.role === 'comptoir' ? form.comptoirOrganizationId : form.organizationId || null,
          p_collector_id: form.role === 'collector' ? form.collectorId : null,
          p_responsibilities: capacites,
          p_permissions: Object.values(permissionsEnregistrees),
        });
        if (error) throw error;
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

  if (loading || loadedKey !== requestKey) {
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

  if (loadError) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page admin-page compte">
          <PageHeader
            icon={UserRound}
            title={isEditMode ? 'Modifier le compte' : 'Créer un compte'}
            breadcrumb={[
              { label: 'Administration' },
              { label: 'Utilisateurs', to: '/users' },
              { label: isEditMode ? 'Modification' : 'Nouveau compte' },
            ]}
          />
          <Note tone="danger" icon={AlertTriangle}>{loadError}</Note>
          <EmptyState
            title="Le formulaire n’est pas disponible"
            description="Les données nécessaires n’ont pas pu être chargées. Aucune modification n’a été enregistrée."
            action={(
              <div className="flex flex-wrap gap-3">
                <button type="button" className="sn-btn" onClick={() => navigate('/users')}>
                  <ArrowLeft aria-hidden="true" /> Retour à la liste
                </button>
                <button type="button" className="sn-btn sn-btn--primary" onClick={() => void charger()}>
                  <RefreshCw aria-hidden="true" /> Réessayer
                </button>
              </div>
            )}
          />
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
              ? 'Identité, rôle, responsabilités et périmètre organisationnel.'
              : 'Modules réellement disponibles dans le plafond de ce profil.'
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
                  disabled={Boolean(erreurEtapeIdentite) || editionPropreCompte || !peutAdministrerCompte}
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
            {roleInitial === 'owner'
              ? 'Seul un autre Owner peut administrer ce compte.'
              : 'Votre rôle ne permet pas de modifier ce compte. Un administrateur ne peut gérer que les comptes de niveau inférieur.'}
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
            onClick={() => !erreurEtapeIdentite && setEtape(2)}
            disabled={Boolean(erreurEtapeIdentite) || editionPropreCompte || !peutAdministrerCompte}
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
                        <strong>{accountRoleLabel(role)}</strong>
                        <small>{accountRolePolicy(role)?.description ?? DESCRIPTIONS_ROLE[role]}</small>
                      </span>
                      <Badge tone={accountRoleTone(role)}>{accountRoleLabel(role)}</Badge>
                    </label>
                  </li>
                ))}
              </ul>
            </Section>

            {form.role && responsibilitiesForRole(form.role).length > 0 && (
              <Section
                id="responsabilites"
                icon={ShieldCheck}
                tone="emerald"
                title="Responsabilités métier"
                description="Elles déterminent les opérations autorisées. Les combinaisons incompatibles sont bloquées immédiatement."
              >
                <ul className="compte__roles compte__responsabilites-grid">
                  {responsibilitiesForRole(form.role).map((option) => {
                    const mandatory = option.requiredFor.includes(form.role as AccountCreationRole);
                    return (
                      <li key={option.code}>
                        <label className={capacites[option.code] ? 'is-checked' : ''}>
                          <input
                            type="checkbox"
                            checked={capacites[option.code]}
                            disabled={mandatory || editionPropreCompte || !peutAdministrerCompte}
                            onChange={() => basculerResponsabilite(option.code)}
                            aria-label={option.label}
                          />
                          <span>
                            <strong>{option.label}</strong>
                            <small>{option.description}</small>
                          </span>
                          {mandatory && <Badge tone="success">Obligatoire</Badge>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <Note tone="info" icon={Lock}>
                  Le serveur applique le même plafond et interdit l’auto‑approbation, même en cas de requête forgée.
                </Note>
              </Section>
            )}

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

            {form.role === 'comptoir' && <Section
              id="rattachement-comptoir"
              icon={Building2}
              tone="amber"
              title="Comptoir représenté"
              description="Le compte ouvre uniquement les opérations du comptoir sélectionné."
            >
              <ul className="compte__compagnies">
                {comptoirs.map((comptoir) => (
                  <li key={comptoir.id}>
                    <label className={form.comptoirOrganizationId === comptoir.id ? 'is-checked' : ''}>
                      <input
                        type="radio"
                        name="comptoir-organization"
                        checked={form.comptoirOrganizationId === comptoir.id}
                        disabled={editionPropreCompte || !peutAdministrerCompte}
                        onChange={() => setValue('comptoirOrganizationId', comptoir.id)}
                      />
                      <span>
                        <strong>{comptoir.name}</strong>
                        <small>{comptoir.code}</small>
                      </span>
                      <Badge tone="success">Actif</Badge>
                    </label>
                  </li>
                ))}
                <li>
                  <label className={form.comptoirOrganizationId === NEW_COMPTOIR_VALUE ? 'is-checked' : ''}>
                    <input
                      type="radio"
                      name="comptoir-organization"
                      checked={form.comptoirOrganizationId === NEW_COMPTOIR_VALUE}
                      disabled={editionPropreCompte || !peutAdministrerCompte}
                      onChange={() => setValue('comptoirOrganizationId', NEW_COMPTOIR_VALUE)}
                    />
                    <span>
                      <strong>Nouveau comptoir</strong>
                      <small>Créer son périmètre sécurisé avec ce compte</small>
                    </span>
                    <Badge tone="warning">Nouveau</Badge>
                  </label>
                </li>
              </ul>

              {form.comptoirOrganizationId === NEW_COMPTOIR_VALUE && (
                <div className="admin-form__row is-deux">
                  <Field label="Code du comptoir" required htmlFor="comptoir-code">
                    <input
                      id="comptoir-code"
                      value={form.comptoirOrganizationCode}
                      maxLength={20}
                      onChange={(event) => setValue('comptoirOrganizationCode', event.target.value.toUpperCase())}
                      placeholder="NAFO"
                    />
                  </Field>
                  <Field label="Nom du comptoir" required htmlFor="comptoir-nom">
                    <input
                      id="comptoir-nom"
                      value={form.comptoirOrganizationName}
                      maxLength={160}
                      onChange={(event) => setValue('comptoirOrganizationName', event.target.value)}
                      placeholder="Comptoir d’or NAFO"
                    />
                  </Field>
                </div>
              )}
            </Section>}

            {form.role && !['mine', 'comptoir'].includes(form.role) && policy?.organizationRequired && (
              <Section
                id="rattachement-organisation"
                icon={Building2}
                tone="amber"
                title={form.role === 'collector' ? 'Périmètre du collecteur' : 'Organisation représentée'}
                description="Ce rattachement autoritatif borne toutes les lectures et mutations côté serveur."
              >
                {organizationOptions.length === 0 ? (
                  <EmptyState
                    title="Aucune organisation compatible"
                    description={`Créez d’abord une organisation de type ${form.role === 'collector' ? 'comptoir' : policy.organizationType}.`}
                    action={(
                      <button
                        type="button"
                        className="sn-btn sn-btn--primary"
                        onClick={() => navigate(`/stakeholders/organizations/new?type=${form.role === 'collector' ? 'comptoir' : policy.organizationType}`)}
                      >
                        <Building2 aria-hidden="true" /> Créer l’organisation
                      </button>
                    )}
                  />
                ) : (
                  <ul className="compte__compagnies">
                    {organizationOptions.map((organization) => (
                      <li key={organization.id}>
                        <label className={form.organizationId === organization.id ? 'is-checked' : ''}>
                          <input
                            type="radio"
                            name="access-organization"
                            checked={form.organizationId === organization.id}
                            disabled={editionPropreCompte || !peutAdministrerCompte}
                            onChange={() => setValue('organizationId', organization.id)}
                          />
                          <span>
                            <strong>{organization.name}</strong>
                            <small>{organization.code}</small>
                          </span>
                          <Badge tone="success">Actif</Badge>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}

                {form.role === 'collector' && (
                  <Field label="Profil collecteur" required htmlFor="collector-profile">
                    <select
                      id="collector-profile"
                      value={form.collectorId}
                      disabled={editionPropreCompte || !peutAdministrerCompte}
                      onChange={(event) => setValue('collectorId', event.target.value)}
                    >
                      <option value="">Sélectionner un collecteur…</option>
                      {collectors.map((collector) => (
                        <option key={collector.id} value={collector.id}>{collector.display_name}</option>
                      ))}
                    </select>
                  </Field>
                )}
              </Section>
            )}

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

            {erreurEtapeIdentite && (
              <Note tone="warning" icon={AlertTriangle}>
                {erreurEtapeIdentite}
              </Note>
            )}
          </>
        ) : (
          <Section
            id="habilitations"
            icon={ShieldCheck}
            tone="emerald"
            title={`Habilitations (${modulesOuverts} module(s) ouverts)`}
            description="Seuls les modules compatibles avec le rôle et les responsabilités sont présentés."
          >
            {form.role === 'admin' && (
              <Note tone="info" icon={ShieldCheck}>
                L’Owner peut attribuer les droits de chaque module à cet Administrateur.
                Les validations sensibles restent soumises aux habilitations métier et à la séparation des fonctions.
                L’Administrateur ne peut pas modifier ses propres droits ni ceux d’un Owner.
              </Note>
            )}
            {form.role === 'owner' ? (
              <Note tone="info" icon={ShieldCheck}>
                Le rôle Owner conserve tous les droits sur tous les modules, même désactivés.
                Ces droits ne peuvent pas être retirés individuellement. L’auto-modification reste interdite.
              </Note>
            ) : <div className="compte__gabarits">
              <span className="sn-field__label">Gabarits</span>
              <button type="button" className="sn-btn sn-btn--sm" disabled={!peutAdministrerCompte || editionPropreCompte} onClick={() => setPermissions(permissionsForPreset(form.role, capacites, modules, 'none'))}>
                Aucun droit
              </button>
              <button type="button" className="sn-btn sn-btn--sm" disabled={!peutAdministrerCompte || editionPropreCompte} onClick={() => setPermissions(permissionsForPreset(form.role, capacites, modules, 'read'))}>
                Consultation seule
              </button>
              <button type="button" className="sn-btn sn-btn--sm sn-btn--primary" disabled={!peutAdministrerCompte || editionPropreCompte} onClick={() => setPermissions(permissionsForPreset(form.role, capacites, modules, 'recommended'))}>
                Droits recommandés
              </button>
              {form.role === 'admin' && (
                <button type="button" className="sn-btn sn-btn--sm" disabled={!peutAdministrerCompte || editionPropreCompte} onClick={() => setPermissions(permissionsForPreset(form.role, capacites, modules, 'all'))}>
                  Tous les droits sur les modules
                </button>
              )}
            </div>}

            {modulesDisponibles.length === 0 ? (
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
                    {modulesDisponibles.map((module) => {
                      const permission = permissions[module.id] || EMPTY_PERMISSION(module.id);
                      const ceiling = permissionCeilingFor(form.role, capacites, module);
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
                                checked={form.role === 'owner' || permission[droit.clef]}
                                disabled={form.role === 'owner' || !peutAdministrerCompte || editionPropreCompte || !ceiling[droit.clef]}
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
            <>
              <button type="button" className="sn-btn" onClick={() => setEtape(1)} disabled={saving}>
                <ArrowLeft aria-hidden="true" /> Revenir à l’identité
              </button>
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => void enregistrer()}
                disabled={saving || editionPropreCompte || !peutAdministrerCompte}
              >
                {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                {isEditMode ? 'Enregistrer les modifications' : 'Créer le compte'}
              </button>
            </>
          )}
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
