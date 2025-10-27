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
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Granite texture background */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900"
        style={{
          backgroundImage: `
            url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.25'/%3E%3C/svg%3E"),
            radial-gradient(circle at 20% 30%, rgba(139, 116, 96, 0.15), transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(120, 100, 80, 0.1), transparent 40%)
          `,
          backgroundBlendMode: 'overlay, normal, normal',
        }}
      />

      {/* Subtle golden veins pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(184, 134, 11, 0.3) 35px, rgba(184, 134, 11, 0.3) 36px),
            repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(184, 134, 11, 0.2) 35px, rgba(184, 134, 11, 0.2) 36px)
          `,
        }}
      />

      {/* Language toggle with glass effect */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-lg hover:bg-white/20 transition-all text-white"
        >
          <Globe className="h-4 w-4" />
          <span className="text-sm font-medium">
            {i18n.language === 'en' ? 'Français' : 'English'}
          </span>
        </button>
      </div>

      {/* Engraved card with glass morphism */}
      <div className="w-full max-w-md relative z-10">
        {/* Outer shadow for depth */}
        <div className="absolute inset-0 bg-black/40 rounded-2xl blur-2xl transform translate-y-4"></div>

        {/* Engraved effect container */}
        <div className="relative bg-gradient-to-br from-gray-800/60 via-gray-900/60 to-gray-800/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Inner shadow for engraved effect */}
          <div className="absolute inset-0 rounded-2xl shadow-inner pointer-events-none" style={{
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), inset 0 -2px 8px rgba(255,255,255,0.05)'
          }}></div>

          {/* Gold accent top border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>

          <Card className="bg-transparent border-0 shadow-none">
        <CardHeader className="text-center relative">
          <div className="flex justify-center mb-4">
            <div className="relative">
              {/* Glow effect around logo */}
              <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full"></div>
              <img
                src="/image.png"
                alt="Mansa Logo"
                className="h-24 w-auto object-contain relative z-10 drop-shadow-2xl"
              />
            </div>
          </div>
          <CardTitle className="text-2xl text-white font-bold tracking-wide drop-shadow-lg">
            Mansa Gold Tracker
          </CardTitle>
          <CardDescription className="text-gray-300 mt-2 font-medium">
            Gold Sales Management Solution - {t('auth.login')}
          </CardDescription>
        </CardHeader>

        <CardContent className="relative">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="p-3 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-200 font-medium">{errors.general}</p>
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
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-500 bg-gray-800/50 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-800"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{t('auth.rememberMe')}</span>
              </label>

              <a
                href="/forgot-password"
                className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors"
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
                className="w-full text-sm text-gray-400 hover:text-amber-400 transition-colors"
              >
                Enable 2FA for this login
              </button>
            )}
          </form>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
