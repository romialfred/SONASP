import { useState, FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Lock, Globe, Bell, Clock } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { useToast } from '@/components/ui/Toast';
import { Table, Column } from '@/components/ui/Table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { userActivityService } from '@/services/userActivityService';

interface ActivityLog {
  action: string;
  timestamp: string;
  ip: string;
}

export function Profile() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { user, updatePassword, refreshProfile } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [language, setLanguage] = useState('fr');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [approvalNotifications, setApprovalNotifications] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setName(user.full_name || '');
      setEmail(user.email);
      setPhone(user.phone || '');
      setLanguage('fr');
      setEmailNotifications(user.email_notifications);
      setApprovalNotifications(user.approval_notifications);
    }
  }, [user]);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityState, setActivityState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let current = true;
    setActivityLogs([]);
    setActivityState('loading');
    if (!user?.id) return;
    void userActivityService.getActivityHistory(user.id, { limit: 50 }).then((logs) => {
      if (!current) return;
      setActivityLogs(logs.map((log) => ({
        action: log.description,
        timestamp: log.created_at ? new Date(log.created_at).toLocaleString('fr-FR') : 'Non renseignée',
        ip: log.ip_address || 'Non collectée',
      })));
      setActivityState('ready');
    }).catch(() => { if (current) setActivityState('error'); });
    return () => { current = false; };
  }, [user?.id]);

  const activityColumns: Column<ActivityLog>[] = [
    { key: 'action', label: 'Action', sortable: true },
    { key: 'timestamp', label: 'Horodatage', sortable: true },
    { key: 'ip', label: 'Adresse IP', sortable: false },
  ];

  const validatePersonalInfo = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name) {
      newErrors.name = t('validation.required');
    }

    if (!email) {
      newErrors.email = t('validation.required');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('validation.emailInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!currentPassword) {
      newErrors.currentPassword = t('validation.required');
    }

    if (!newPassword) {
      newErrors.newPassword = t('validation.required');
    } else if (newPassword.length < 8) {
      newErrors.newPassword = t('validation.passwordTooShort');
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('validation.passwordsDoNotMatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSavePersonalInfo = async (e: FormEvent) => {
    e.preventDefault();

    if (!validatePersonalInfo()) return;

    setLoading(true);
    try {
      if (!user) return;

      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: name,
          phone: phone || null,
          language,
          email_notifications: emailNotifications,
          approval_notifications: approvalNotifications,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      addToast(t('auth.changesSaved'), 'success');
    } catch (error: any) {
      addToast(messageErreurUtilisateur(error, 'L’enregistrement des modifications a échoué.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!validatePassword()) return;

    setLoading(true);
    try {
      const result = await updatePassword(newPassword);

      if (result.error) {
        addToast(result.error, 'error');
      } else {
        addToast(t('auth.changesSaved'), 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      addToast(messageErreurUtilisateur(error, 'La modification du mot de passe a échoué.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">{t('auth.profile')}</h1>
          <p className="text-gray-600 mt-1">Gérez les paramètres et les préférences de votre compte.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary-500" />
              <CardTitle>{t('auth.personalInfo')}</CardTitle>
            </div>
            <CardDescription>Mettez à jour vos informations personnelles.</CardDescription>
          </CardHeader>
          <CardContent>
            <form aria-label="Informations personnelles" onSubmit={handleSavePersonalInfo} className="space-y-4">
              <FormField label={t('auth.name')} error={errors.name} required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={!!errors.name}
                />
              </FormField>

              <FormField label={t('auth.email')} error={errors.email} required>
                <Input
                  type="email"
                  value={email}
                  readOnly
                  aria-readonly="true"
                  error={!!errors.email}
                />
              </FormField>

              <FormField label={t('auth.phone')}>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </FormField>

              <Button type="submit" loading={loading}>
                {t('auth.saveChanges')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary-500" />
              <CardTitle>{t('auth.changePassword')}</CardTitle>
            </div>
            <CardDescription>Renouvelez régulièrement votre mot de passe pour renforcer la sécurité de votre compte.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <FormField label={t('auth.currentPassword')} error={errors.currentPassword} required>
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  error={!!errors.currentPassword}
                />
              </FormField>

              <FormField label={t('auth.newPassword')} error={errors.newPassword} required>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  error={!!errors.newPassword}
                />
              </FormField>

              <FormField label={t('auth.confirmPassword')} error={errors.confirmPassword} required>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={!!errors.confirmPassword}
                />
              </FormField>

              <Button type="submit" loading={loading}>
                {t('auth.saveChanges')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary-500" />
                <CardTitle>{t('auth.twoFactorAuth')}</CardTitle>
              </div>
              <CardDescription>Protection obligatoire de tous les comptes SONASP</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Statut du second facteur</p>
                  <p className="text-sm text-gray-600">
                    {user?.two_factor_enabled ? 'Configuré et obligatoire' : 'Enrôlement obligatoire'}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">Obligatoire</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary-500" />
                <CardTitle>{t('auth.languagePreference')}</CardTitle>
              </div>
              <CardDescription>Choisissez la langue de votre interface</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="fr">Français</option>
                <option value="en" disabled>Anglais — bientôt disponible</option>
              </Select>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary-500" />
              <CardTitle>{t('auth.notificationSettings')}</CardTitle>
            </div>
            <CardDescription>Gérez vos préférences de notification.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Notifications par courriel</span>
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Notifications d’approbation</span>
                <input
                  type="checkbox"
                  checked={approvalNotifications}
                  onChange={(e) => setApprovalNotifications(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-500" />
              <CardTitle>{t('auth.activityHistory')}</CardTitle>
            </div>
            <CardDescription>Activité récente du compte.</CardDescription>
          </CardHeader>
          <CardContent>
            {activityState === 'loading' ? <p role="status">Chargement de l’historique…</p>
              : activityState === 'error' ? <p role="alert">L’historique est indisponible. Réessayez ultérieurement.</p>
              : <Table
              data={activityLogs}
              columns={activityColumns}
              pagination={true}
              pageSize={5}
            />}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
