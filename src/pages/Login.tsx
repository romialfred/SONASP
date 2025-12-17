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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-amber-100/50"
        >
          <Globe className="h-5 w-5 text-amber-600" />
          <span className="text-sm font-semibold text-gray-700">
            {i18n.language === 'en' ? 'Français' : 'English'}
          </span>
        </button>
      </div>

      <Card className="w-full max-w-md shadow-2xl relative z-10 bg-white/95 backdrop-blur-sm border-2 border-amber-500/30">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-8">
            <img
              src="/horizontal_-_colorx10.png"
              alt="Mansa Logo"
              className="h-24 w-auto object-contain"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {t('auth.login')}
            </h1>
            <p className="text-sm font-bold text-amber-600">
              Gold Sales Management Solution
            </p>
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

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-3 border-2 hover:bg-gray-50 transition-colors"
              onClick={handleMicrosoftSSO}
              disabled={loading}
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
                <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
                <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
              </svg>
              <span className="font-medium">Sign in with Microsoft</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Copyright */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <p className="text-sm text-gray-600 font-medium">
          © {new Date().getFullYear()} Mansa Resources. All rights reserved.
        </p>
      </div>

      {/* Waves at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-0">
        <svg viewBox="0 0 1440 320" className="w-full" preserveAspectRatio="none">
          <path
            fill="#f59e0b"
            fillOpacity="0.3"
            d="M0,96L48,112C96,128,192,160,288,165.3C384,171,480,149,576,133.3C672,117,768,107,864,112C960,117,1056,139,1152,144C1248,149,1344,139,1392,133.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
        <svg viewBox="0 0 1440 320" className="w-full -mt-24" preserveAspectRatio="none">
          <path
            fill="#f97316"
            fillOpacity="0.4"
            d="M0,192L48,197.3C96,203,192,213,288,192C384,171,480,117,576,112C672,107,768,149,864,165.3C960,181,1056,171,1152,154.7C1248,139,1344,117,1392,106.7L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
        <svg viewBox="0 0 1440 320" className="w-full -mt-32" preserveAspectRatio="none">
          <path
            fill="#fb923c"
            fillOpacity="0.5"
            d="M0,288L48,272C96,256,192,224,288,197.3C384,171,480,149,576,165.3C672,181,768,235,864,234.7C960,235,1056,181,1152,144C1248,107,1344,85,1392,74.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>

      <style>{`
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
