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
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';

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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [language, setLanguage] = useState('en');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [batchNotifications, setBatchNotifications] = useState(true);
  const [approvalNotifications, setApprovalNotifications] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [show2FASetup, setShow2FASetup] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.full_name || '');
      setEmail(user.email);
      setPhone(user.phone || '');
      setTwoFactorEnabled(user.two_factor_enabled);
      setLanguage(user.language);
      setEmailNotifications(user.email_notifications);
      setBatchNotifications(user.batch_notifications);
      setApprovalNotifications(user.approval_notifications);
    }
  }, [user]);

  /**
   * Desactiver soi-meme son second facteur annulerait la protection d'un simple
   * clic, y compris depuis une session volee. La levee passe par un
   * administrateur, qui la motive et la trace.
   */
  const handleDisable2FA = () => {
    addToast(
      'Le second facteur ne se desactive pas depuis votre profil. '
      + 'En cas de perte de votre appareil, un administrateur le reinitialise.',
      'error'
    );
  };

  const activityLogs: ActivityLog[] = [
    { action: 'Login', timestamp: '2025-10-24 10:30:00', ip: '192.168.1.1' },
    { action: 'Updated profile', timestamp: '2025-10-23 15:45:00', ip: '192.168.1.1' },
    { action: 'Changed password', timestamp: '2025-10-20 09:15:00', ip: '192.168.1.1' },
  ];

  const activityColumns: Column<ActivityLog>[] = [
    { key: 'action', label: 'Action', sortable: true },
    { key: 'timestamp', label: 'Timestamp', sortable: true },
    { key: 'ip', label: 'IP Address', sortable: false },
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
          batch_notifications: batchNotifications,
          approval_notifications: approvalNotifications,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      addToast(t('auth.changesSaved'), 'success');
    } catch (error: any) {
      addToast(error.message || 'Failed to save changes', 'error');
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
      addToast(error.message || 'Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">{t('auth.profile')}</h1>
          <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary-500" />
              <CardTitle>{t('auth.personalInfo')}</CardTitle>
            </div>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSavePersonalInfo} className="space-y-4">
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
                  onChange={(e) => setEmail(e.target.value)}
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
            <CardDescription>Update your password regularly for security</CardDescription>
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
              <CardDescription>Add an extra layer of security</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">2FA Status</p>
                  <p className="text-sm text-gray-600">
                    {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <Button
                  variant={twoFactorEnabled ? 'danger' : 'success'}
                  size="sm"
                  onClick={() => twoFactorEnabled ? handleDisable2FA() : setShow2FASetup(true)}
                  loading={loading}
                >
                  {twoFactorEnabled ? t('auth.disable2FA') : t('auth.enable2FA')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Modal
            isOpen={show2FASetup}
            onClose={() => setShow2FASetup(false)}
            title=""
          >
            <TwoFactorSetup
              onComplete={() => {
                setShow2FASetup(false);
                addToast('Two-factor authentication enabled successfully', 'success');
              }}
              onCancel={() => setShow2FASetup(false)}
            />
          </Modal>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary-500" />
                <CardTitle>{t('auth.languagePreference')}</CardTitle>
              </div>
              <CardDescription>Choose your preferred language</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="fr">Français</option>
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
            <CardDescription>Manage your notification preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Email notifications</span>
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Batch status updates</span>
                <input
                  type="checkbox"
                  checked={batchNotifications}
                  onChange={(e) => setBatchNotifications(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Approval notifications</span>
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
            <CardDescription>Recent account activity</CardDescription>
          </CardHeader>
          <CardContent>
            <Table
              data={activityLogs}
              columns={activityColumns}
              pagination={true}
              pageSize={5}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
