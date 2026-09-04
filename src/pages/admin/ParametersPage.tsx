import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Loader2,
  Save,
  Scale,
  Settings,
  Shield,
  ShieldCheck,
  Timer,
  UserRound,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section } from '@/components/ui/sn';
import { Toggle } from '@/components/ui/Toggle';
import { NotificationDialog, useNotification } from '@/components/ui/NotificationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { roleLabel, roleTone } from '@/lib/roleLabels';
import { hasCapability, CAPABILITIES } from '@/lib/capabilities';
import {
  parametresPlateformeService,
  type ParametresSession,
} from '@/services/parametresPlateformeService';
import './admin.css';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  two_factor_enabled: boolean | null;
  is_active: boolean;
}

export interface BusinessRule {
  id: string;
  rule_key: string;
  rule_name: string;
  rule_value: number;
  rule_category: string;
  description: string | null;
  unit: string | null;
  updated_at: string | null;
}

type OngletId = 'preferences' | 'regles' | 'authentification' | 'notifications';

const ONGLETS: Array<{ id: OngletId; label: string; icon: typeof Settings }> = [
  { id: 'preferences', label: 'Préférences', icon: Settings },
  { id: 'regles', label: 'Règles métier', icon: Scale },
  { id: 'authentification', label: 'Double authentification', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

/** Fuseaux proposés ; Ouagadougou manquait à la liste sur une plateforme burkinabè. */
export const FUSEAUX = [
  { value: 'Africa/Ouagadougou', label: 'Ouagadougou (GMT+0)' },
  { value: 'Africa/Abidjan', label: 'Abidjan (GMT+0)' },
  { value: 'Africa/Bamako', label: 'Bamako (GMT+0)' },
  { value: 'Africa/Niamey', label: 'Niamey (GMT+1)' },
  { value: 'UTC', label: 'UTC' },
];

export const LANGUES = [
  { value: 'fr', label: 'Français', disabled: false },
  { value: 'en', label: 'Anglais — bientôt disponible', disabled: true },
];

export interface PreferencesNotification {
  email_notifications: boolean;
  batch_notifications: boolean;
  approval_notifications: boolean;
}

export const NOTIFICATIONS: Array<{ clef: keyof PreferencesNotification; label: string; description: string }> = [
  {
    clef: 'email_notifications',
    label: 'Notifications par courriel',
    description: 'Recevoir un courriel pour les évènements qui vous concernent',
  },
  {
    clef: 'batch_notifications',
    label: 'Suivi des lots',
    description: 'Être averti des changements d’état d’un lot',
  },
  {
    clef: 'approval_notifications',
    label: 'Demandes d’approbation',
    description: 'Être averti des validations qui vous sont soumises',
  },
];

/** Regroupe les règles par catégorie, sans catégorie codée en dur. */
export function grouperRegles(regles: BusinessRule[]): Array<{ categorie: string; regles: BusinessRule[] }> {
  const groupes = new Map<string, BusinessRule[]>();
  regles.forEach((regle) => {
    const categorie = regle.rule_category?.trim() || 'Autres règles';
    groupes.set(categorie, [...(groupes.get(categorie) || []), regle]);
  });
  return Array.from(groupes.entries())
    .map(([categorie, liste]) => ({ categorie, regles: liste }))
    .sort((a, b) => a.categorie.localeCompare(b.categorie, 'fr'));
}

/** Valeur affichée d'une règle : `0` est une valeur légitime, pas une absence. */
export const valeurRegle = (editees: Record<string, number>, regle: BusinessRule): number =>
  editees[regle.rule_key] ?? regle.rule_value;

export function ParametersPage() {
  const { user, refreshProfile } = useAuth();
  const { notification, showSuccess, showError, closeNotification } = useNotification();

  const [onglet, setOnglet] = useState<OngletId>('preferences');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [comptes, setComptes] = useState<UserProfile[]>([]);
  const [regles, setRegles] = useState<BusinessRule[]>([]);
  const [reglesEditees, setReglesEditees] = useState<Record<string, number>>({});
  const [parametresSession, setParametresSession] = useState<ParametresSession | null>(null);
  const [dureeSaisie, setDureeSaisie] = useState('');
  const [langue, setLangue] = useState('fr');
  const [fuseau, setFuseau] = useState('Africa/Ouagadougou');
  const [prefsChargees, setPrefsChargees] = useState(false);
  const [notifications, setNotifications] = useState<PreferencesNotification>({
    email_notifications: true,
    batch_notifications: true,
    approval_notifications: true,
  });

  // Les dépendances portent sur des valeurs primitives : dépendre de l'objet `user`
  // entier relançait le chargement à chaque rendu dès que le contexte recréait l'objet.
  const userId = user?.id;
  const prefEmail = user?.email_notifications !== false;
  const prefLots = user?.batch_notifications !== false;
  const prefApprobations = user?.approval_notifications !== false;

  const chargerPreferences = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErreur(null);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('language_preference, timezone')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        // L'ancienne préférence anglaise est conservée en base pour la future
        // phase bilingue, mais la version privée courante reste en français.
        setLangue('fr');
        setFuseau(data.timezone || 'Africa/Ouagadougou');
      }
      setPrefsChargees(true);
      setNotifications({
        email_notifications: prefEmail,
        batch_notifications: prefLots,
        approval_notifications: prefApprobations,
      });
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger vos préférences.'));
    } finally {
      setLoading(false);
    }
  }, [userId, prefEmail, prefLots, prefApprobations]);

  const chargerComptes = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, two_factor_enabled, is_active')
        .order('full_name');
      if (error) throw error;
      setComptes(data || []);
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger les comptes.'));
      setComptes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const chargerRegles = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const { data, error } = await supabase
        .from('business_rules')
        .select('*')
        .order('rule_category', { ascending: true })
        .order('rule_name', { ascending: true });
      if (error) throw error;
      setRegles(data || []);
      setReglesEditees({});
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger les règles métier.'));
      setRegles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const chargerParametresSession = useCallback(async () => {
    try {
      setParametresSession(await parametresPlateformeService.lireParametresSession());
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de lire la durée de session.'));
      setParametresSession(null);
    }
  }, []);

  useEffect(() => {
    if (onglet === 'authentification') {
      void chargerComptes();
      void chargerParametresSession();
    }
    else if (onglet === 'regles') void chargerRegles();
    else if (onglet === 'preferences' || onglet === 'notifications') void chargerPreferences();
  }, [onglet, chargerComptes, chargerRegles, chargerPreferences, chargerParametresSession]);

  // La valeur saisie suit celle du serveur tant que l'utilisateur n'y touche pas.
  useEffect(() => {
    if (parametresSession) setDureeSaisie(String(parametresSession.inactiviteMinutes));
  }, [parametresSession]);

  const peutModifierParametres = hasCapability(user, CAPABILITIES.PLATFORM_SETTINGS_MANAGE);
  const groupes = useMemo(() => grouperRegles(regles), [regles]);
  const reglesModifiees = Object.keys(reglesEditees).length > 0;

  const enregistrerDureeSession = async () => {
    if (saving) return;
    const minutes = Number(dureeSaisie);
    if (!Number.isInteger(minutes)) {
      showError('Valeur invalide', 'Saisissez un nombre entier de minutes.');
      return;
    }
    setSaving(true);
    setErreur(null);
    try {
      const misAJour = await parametresPlateformeService.definirDureeSession(minutes);
      setParametresSession(misAJour);
      showSuccess(
        'Durée de session enregistrée',
        `Durée d'inactivité fixée à ${misAJour.inactiviteMinutes} minutes. Elle s'applique dès la prochaine mesure d'activité.`,
      );
    } catch (reason) {
      showError('Enregistrement impossible', errorMessage(reason, 'La durée de session n’a pas pu être enregistrée.'));
    } finally {
      setSaving(false);
    }
  };

  const enregistrerPreferences = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      // L'onglet n'enregistrait rien : ses listes déroulantes n'avaient ni valeur ni
      // gestionnaire, et le bouton « Save Preferences » aucun `onClick`.
      const { error } = await supabase
        .from('user_profiles')
        .update({ language_preference: langue, timezone: fuseau })
        .eq('id', userId);
      if (error) throw error;
      await refreshProfile();
      showSuccess('Préférences enregistrées', 'Vos préférences d’affichage ont été mises à jour.');
    } catch (reason) {
      showError('Enregistrement impossible', errorMessage(reason, 'Vos préférences n’ont pas été modifiées.'));
    } finally {
      setSaving(false);
    }
  };

  const enregistrerNotifications = async (suivant: PreferencesNotification) => {
    if (saving) return;
    setSaving(true);
    const precedent = notifications;
    setNotifications(suivant);
    try {
      // Les interrupteurs étaient figés sur « activé » avec un gestionnaire vide.
      const { error } = await supabase.auth.updateUser({ data: suivant });
      if (error) throw error;
      await refreshProfile();
      showSuccess('Notifications enregistrées', 'Vos préférences de notification ont été mises à jour.');
    } catch (reason) {
      setNotifications(precedent);
      showError('Enregistrement impossible', errorMessage(reason, 'Vos préférences n’ont pas été modifiées.'));
    } finally {
      setSaving(false);
    }
  };

  const enregistrerRegles = async () => {
    if (saving || !reglesModifiees) return;
    setSaving(true);
    try {
      for (const regle of regles) {
        const valeur = valeurRegle(reglesEditees, regle);
        if (valeur === regle.rule_value) continue;
        const { error } = await supabase.from('business_rules').update({ rule_value: valeur }).eq('id', regle.id);
        if (error) throw error;
      }
      await chargerRegles();
      showSuccess('Règles enregistrées', 'Les règles métier ont été mises à jour.');
    } catch (reason) {
      showError('Enregistrement impossible', errorMessage(reason, 'Les règles n’ont pas été modifiées.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page parametres">
        <NotificationDialog {...notification} onClose={closeNotification} />

        <PageHeader
          icon={Settings}
          title="Paramètres"
          subtitle="Préférences personnelles, règles métier et exigences d’authentification."
          breadcrumb={[{ label: 'Administration' }, { label: 'Paramètres' }]}
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <div className="user-detail__tabs" role="tablist" aria-label="Sections des paramètres">
          {ONGLETS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={onglet === item.id}
                className={onglet === item.id ? 'is-active' : ''}
                onClick={() => setOnglet(item.id)}
              >
                <Icon aria-hidden="true" /> {item.label}
              </button>
            );
          })}
        </div>

        {onglet === 'preferences' && (
          <Section
            id="preferences"
            icon={Settings}
            tone="emerald"
            title="Préférences d’affichage"
            description="Réglages personnels appliqués à votre compte."
          >
            {loading ? (
              <div className="admin-page__loading">
                <Loader2 className="sn-spin" aria-hidden="true" /> Chargement de vos préférences…
              </div>
            ) : (
              <>
                <div className="admin-form__row is-deux">
                  <Field label="Langue de l’interface" htmlFor="langue">
                    <select id="langue" value={langue} onChange={(event) => setLangue(event.target.value)}>
                      {LANGUES.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Fuseau horaire" htmlFor="fuseau">
                    <select id="fuseau" value={fuseau} onChange={(event) => setFuseau(event.target.value)}>
                      {FUSEAUX.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Devise et unité de poids n'avaient aucun stockage : les proposer
                    revenait à promettre un réglage qui n'existait pas. */}
                <Note tone="info" icon={Settings}>
                  Franc CFA, grammes et onces troy : unités non paramétrables.
                </Note>

                <div className="sn-form-actions">
                  <button
                    type="button"
                    className="sn-btn sn-btn--primary"
                    onClick={() => void enregistrerPreferences()}
                    disabled={saving || !prefsChargees}
                  >
                    {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                    Enregistrer mes préférences
                  </button>
                </div>
              </>
            )}
          </Section>
        )}

        {onglet === 'regles' && (
          <>
            {loading ? (
              <Section id="regles" icon={Scale} tone="blue" title="Règles métier">
                <div className="admin-page__loading">
                  <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des règles…
                </div>
              </Section>
            ) : groupes.length === 0 ? (
              <Section id="regles" icon={Scale} tone="blue" title="Règles métier">
                <EmptyState
                  title="Aucune règle métier"
                  description="Aucune règle n’est déclarée dans le référentiel."
                />
              </Section>
            ) : (
              <>
                {groupes.map((groupe) => (
                  <Section
                    key={groupe.categorie}
                    id={`regles-${groupe.categorie}`}
                    icon={Scale}
                    tone="blue"
                    title={groupe.categorie}
                    description={`${groupe.regles.length} règle(s) de cette catégorie.`}
                  >
                    <ul className="parametres__regles">
                      {groupe.regles.map((regle) => (
                        <li key={regle.id}>
                          <div>
                            <strong>{regle.rule_name}</strong>
                            {regle.description && <small>{regle.description}</small>}
                          </div>
                          <div className="parametres__regle-valeur">
                            <input
                              type="number"
                              step="0.0001"
                              aria-label={regle.rule_name}
                              // `||` renvoyait l'ancienne valeur dès que l'on saisissait 0.
                              value={valeurRegle(reglesEditees, regle)}
                              onChange={(event) =>
                                setReglesEditees((current) => ({
                                  ...current,
                                  [regle.rule_key]: Number(event.target.value),
                                }))
                              }
                            />
                            {regle.unit && <span>{regle.unit}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Section>
                ))}

                <div className="sn-form-actions">
                  <button
                    type="button"
                    className="sn-btn sn-btn--primary"
                    onClick={() => void enregistrerRegles()}
                    disabled={saving || !reglesModifiees}
                  >
                    {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                    Enregistrer les règles
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {onglet === 'authentification' && (
          <Section
            id="duree-session"
            icon={Timer}
            tone="violet"
            title="Durée des sessions"
            description="Temps d’inactivité au terme duquel un compte est déconnecté. Le serveur applique cette durée ; il ne se contente pas de l’afficher."
          >
            {!parametresSession ? (
              <div className="admin-page__loading">
                <Loader2 className="sn-spin" aria-hidden="true" /> Lecture du paramètre…
              </div>
            ) : (
              <>
                <Field
                  label="Inactivité avant déconnexion"
                  hint={`Entre ${parametresSession.minimumMinutes} et ${parametresSession.maximumMinutes} minutes.`}
                >
                  <div className="parametres__duree">
                    <input
                      type="number"
                      className="sn-input"
                      inputMode="numeric"
                      min={parametresSession.minimumMinutes}
                      max={parametresSession.maximumMinutes}
                      step={1}
                      value={dureeSaisie}
                      disabled={!peutModifierParametres || saving}
                      onChange={(event) => setDureeSaisie(event.target.value)}
                    />
                    <span>minutes</span>
                  </div>
                </Field>

                {peutModifierParametres ? (
                  <div className="sn-form-actions">
                    <button
                      type="button"
                      className="sn-btn sn-btn--primary"
                      onClick={() => void enregistrerDureeSession()}
                      disabled={saving || dureeSaisie === String(parametresSession.inactiviteMinutes)}
                    >
                      {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                      Enregistrer la durée
                    </button>
                  </div>
                ) : (
                  <Note tone="info">
                    Vous consultez ce paramètre. Sa modification demande l’habilitation correspondante.
                  </Note>
                )}

                <Note tone="info" icon={ShieldCheck}>
                  Un avertissement est affiché une minute avant l’échéance. La durée retenue ne
                  dépasse jamais la validité du jeton d’authentification.
                </Note>
              </>
            )}
          </Section>
        )}

        {onglet === 'authentification' && (
          <Section
            id="authentification"
            icon={Shield}
            tone="violet"
            title="Double authentification"
            description="Le second facteur est exigé pour tous les comptes, sans exception ni désactivation libre-service."
          >
            {loading ? (
              <div className="admin-page__loading">
                <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des comptes…
              </div>
            ) : comptes.length === 0 ? (
              <EmptyState title="Aucun compte" description="Aucun compte n’est enregistré." />
            ) : (
              <div className="admin-page__table-wrap">
                <table className="admin-page__table">
                  <caption className="sr-only">Double authentification par compte</caption>
                  <thead>
                    <tr>
                      <th scope="col">Compte</th>
                      <th scope="col">Rôle</th>
                      <th scope="col">État du compte</th>
                      <th scope="col">Second facteur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comptes.map((compte) => (
                      <tr key={compte.id}>
                        <td>
                          <strong>{compte.full_name || 'Nom non renseigné'}</strong>
                          <small>{compte.email}</small>
                        </td>
                        <td>
                          <Badge tone={roleTone(compte.role)} icon={UserRound}>
                            {roleLabel(compte.role)}
                          </Badge>
                        </td>
                        <td>
                          <Badge tone={compte.is_active ? 'success' : 'danger'}>
                            {compte.is_active ? 'Actif' : 'Désactivé'}
                          </Badge>
                        </td>
                        <td>
                          <Badge tone={compte.two_factor_enabled ? 'success' : 'warning'} icon={ShieldCheck}>
                            {compte.two_factor_enabled ? 'Configuré' : 'Enrôlement requis'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {onglet === 'notifications' && (
          <Section
            id="notifications"
            icon={Bell}
            tone="amber"
            title="Mes notifications"
            description="Évènements pour lesquels vous souhaitez être averti."
          >
            <ul className="parametres__notifications">
              {NOTIFICATIONS.map((item) => (
                <li key={item.clef}>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </div>
                  <Toggle
                    checked={notifications[item.clef]}
                    disabled={saving}
                    ariaLabel={item.label}
                    onChange={(valeur) => void enregistrerNotifications({ ...notifications, [item.clef]: valeur })}
                  />
                </li>
              ))}
            </ul>
            <Note tone="info" icon={ShieldCheck}>
              Ces réglages ne concernent que votre compte et s’appliquent immédiatement.
            </Note>
          </Section>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
