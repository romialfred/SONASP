import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import Button from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute } from '@/lib/permissions';

export function Login() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(newLang);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = t('validation.required');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('validation.emailInvalid');
    }

    if (!password) {
      newErrors.password = t('validation.required');
    } else if (password.length < 8) {
      newErrors.password = t('validation.passwordTooShort');
    }

    if (showTwoFactor && !twoFactorCode) {
      newErrors.twoFactorCode = t('validation.required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const result = await signIn(email, password);

      if (result.error) {
        setErrors({ general: result.error });
      }
    } catch (error: any) {
      setErrors({ general: error.message || 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-amber-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <Globe className="h-4 w-4" />
          <span className="text-sm font-medium">
            {i18n.language === 'en' ? 'Français' : 'English'}
          </span>
        </button>
      </div>

      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/image.png"
              alt="Mansa Logo"
              className="h-24 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Mansa Gold Tracker</CardTitle>
          <CardDescription>Gold Sales Management Solution - {t('auth.login')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{errors.general}</p>
              </div>
            )}

            <FormField
              label={t('auth.email')}
              error={errors.email}
              required
            >
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!errors.email}
                placeholder="user@example.com"
              />
            </FormField>

            <FormField
              label={t('auth.password')}
              error={errors.password}
              required
            >
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!errors.password}
                placeholder="••••••••"
              />
            </FormField>

            {showTwoFactor && (
              <FormField
                label={t('auth.twoFactorCode')}
                error={errors.twoFactorCode}
                required
              >
                <Input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  error={!!errors.twoFactorCode}
                  placeholder="000000"
                  maxLength={6}
                />
              </FormField>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{t('auth.rememberMe')}</span>
              </label>

              <a
                href="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {t('auth.forgotPassword')}
              </a>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading}
            >
              {loading ? t('auth.loggingIn') : t('auth.loginButton')}
            </Button>

            {!showTwoFactor && (
              <button
                type="button"
                onClick={() => setShowTwoFactor(true)}
                className="w-full text-sm text-gray-600 hover:text-gray-800"
              >
                Enable 2FA for this login
              </button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
