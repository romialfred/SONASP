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
import { supabase } from '@/lib/supabase';

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

  const handleMicrosoftSSO = async () => {
    setLoading(true);
    setErrors({});

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email openid profile',
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setErrors({ general: error.message });
      }
    } catch (error: any) {
      setErrors({ general: error.message || 'SSO authentication failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-100 flex items-start justify-center pt-4 pb-80 p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-emerald-100/50"
        >
          <Globe className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-semibold text-gray-700">
            {i18n.language === 'en' ? 'Français' : 'English'}
          </span>
        </button>
      </div>

      <div className="w-full max-w-md relative z-10">
        <Card className="w-full shadow-2xl bg-white/95 backdrop-blur-sm border-2 border-emerald-500/30">
          <CardHeader className="text-center pb-4">
            <div className="space-y-4">
              <div className="flex justify-center mb-3">
                <img
                  src="/logo_transparent_sonasp.png"
                  alt="SONASP Logo"
                  className="h-24 w-auto object-contain drop-shadow-lg"
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('auth.login')}
              </h1>
              <div className="text-center">
                <p className="text-base font-bold text-emerald-600 leading-tight">
                  Système National de Collecte
                </p>
                <p className="text-base font-bold text-emerald-600 leading-tight">
                  et de la Traçabilité des Substances Précieuses
                </p>
              </div>
            </div>
          </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{errors.general}</p>
              </div>
            )}

            <FormField
              label={t('auth.username')}
              error={errors.email}
              required
            >
              <Input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!errors.email}
                placeholder={t('auth.username').toLowerCase()}
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

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{t('auth.rememberMe')}</span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading}
            >
              {loading ? t('auth.loggingIn') : t('auth.loginButton')}
            </Button>

            <div className="text-center mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-700 mb-1 font-medium">
                Forgot Password?
              </p>
              <p className="text-xs text-gray-600">
                Please{' '}
                <a
                  href="mailto:admin@sonasp.ml"
                  className="font-semibold hover:underline"
                >
                  <span className="text-emerald-600">contact</span>{' '}
                  <span className="text-blue-600">Administrator</span>
                </a>
              </p>
            </div>
          </form>
        </CardContent>

        {/* Footer with copyright inside card */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <p className="text-xs text-center text-gray-600">
            © {new Date().getFullYear()} SONASP. Tous droits réservés.
          </p>
        </div>
      </Card>
      </div>

      {/* Waves at bottom - using green waves */}
      <div className="absolute bottom-0 left-0 right-0 z-0 opacity-80">
        <img
          src="/waves-footer-green.svg"
          alt="Waves"
          className="w-full h-auto object-cover"
          style={{ maxHeight: '250px' }}
        />
      </div>

      <style>{`
        body {
          overflow: hidden;
        }
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
