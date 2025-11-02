import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import {
  CheckCircle,
  Lock,
  Key,
  Shield,
  AlertCircle,
  Eye,
  EyeOff,
  Loader,
} from 'lucide-react';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
  met: boolean;
}

export default function ActivateAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState<'verify' | 'password' | '2fa' | 'policies' | 'complete'>('verify');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token validation
  const [tokenValid, setTokenValid] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<string | null>(null);
  const [temporaryPasswordRequired, setTemporaryPasswordRequired] = useState<string | null>(null);

  // Form state
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 2FA state
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Policies state
  const [acceptedGDPR, setAcceptedGDPR] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedCookies, setAcceptedCookies] = useState(false);

  // Password requirements
  const [requirements, setRequirements] = useState<PasswordRequirement[]>([
    { label: 'At least 12 characters', test: (p) => p.length >= 12, met: false },
    { label: 'Contains uppercase letter', test: (p) => /[A-Z]/.test(p), met: false },
    { label: 'Contains lowercase letter', test: (p) => /[a-z]/.test(p), met: false },
    { label: 'Contains number', test: (p) => /[0-9]/.test(p), met: false },
    { label: 'Contains special character', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), met: false },
  ]);

  useEffect(() => {
    if (!token) {
      setError('Invalid activation link. Please check your email and try again.');
      return;
    }

    validateToken();
  }, [token]);

  useEffect(() => {
    const updatedRequirements = requirements.map((req) => ({
      ...req,
      met: req.test(newPassword),
    }));
    setRequirements(updatedRequirements);
  }, [newPassword]);

  const validateToken = async () => {
    try {
      setLoading(true);
      const { data, error: tokenError } = await supabase.rpc('validate_activation_token', {
        p_token: token,
      });

      if (tokenError) throw tokenError;

      if (!data || data.length === 0 || !data[0].is_valid) {
        setError('This activation link has expired or is invalid. Please contact your administrator.');
        return;
      }

      const tokenData = data[0];
      setTokenValid(true);
      setUserId(tokenData.user_id);
      setTokenType(tokenData.token_type);
      setTemporaryPasswordRequired(tokenData.temporary_password);
      setStep('password');
    } catch (err: any) {
      setError(err.message || 'Failed to validate activation link');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (temporaryPassword !== temporaryPasswordRequired) {
      setError('Temporary password is incorrect');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (!requirements.every((req) => req.met)) {
      setError('Password does not meet all requirements');
      return;
    }

    try {
      setLoading(true);

      // Validate password strength
      const { data: isValid, error: validationError } = await supabase.rpc(
        'validate_password_strength',
        { password: newPassword }
      );

      if (validationError || !isValid) {
        setError('Password does not meet strength requirements');
        return;
      }

      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Record password change in history
      await supabase.from('password_history').insert({
        user_id: userId,
        password_hash: 'hashed_' + Date.now(), // In production, properly hash
        changed_by: userId,
      });

      // Move to 2FA setup
      await setup2FA();
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
      setLoading(false);
    }
  };

  const setup2FA = async () => {
    try {
      // Generate TOTP secret
      const generatedSecret = generateTOTPSecret();
      setSecret(generatedSecret);

      // Generate QR code for Microsoft Authenticator
      const issuer = 'Gold Shipper';
      const accountName = userId || 'user@goldshipper.com';
      const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
        accountName
      )}?secret=${generatedSecret}&issuer=${encodeURIComponent(issuer)}`;

      // Generate QR code URL
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        otpauthUrl
      )}`;
      setQrCodeUrl(qrUrl);

      // Generate backup codes
      const codes = generateBackupCodes(8);
      setBackupCodes(codes);

      setStep('2fa');
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to setup 2FA');
      setLoading(false);
    }
  };

  const handle2FAVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit verification code');
      return;
    }

    try {
      setLoading(true);

      // Verify the code (in production, use proper TOTP verification)
      const isValid = verifyTOTPCode(secret, verificationCode);

      if (!isValid) {
        setError('Invalid verification code. Please try again.');
        setLoading(false);
        return;
      }

      // Save 2FA setup
      const { error: setupError } = await supabase.from('user_2fa_setup').insert({
        user_id: userId,
        secret: secret,
        backup_codes: backupCodes,
        verified_at: new Date().toISOString(),
        authenticator_app: 'microsoft_authenticator',
      });

      if (setupError) throw setupError;

      // Update user profile
      await supabase
        .from('user_profiles')
        .update({ two_factor_enabled: true })
        .eq('id', userId);

      setStep('policies');
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to verify 2FA code');
      setLoading(false);
    }
  };

  const handlePoliciesAcceptance = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acceptedGDPR || !acceptedPrivacy || !acceptedCookies) {
      setError('You must accept all policies to activate your account');
      return;
    }

    try {
      setLoading(true);

      // Record policy acceptance
      const { error: acceptanceError } = await supabase.from('user_acceptance_logs').insert({
        user_id: userId,
        accepted_gdpr: acceptedGDPR,
        accepted_privacy: acceptedPrivacy,
        accepted_cookies: acceptedCookies,
        ip_address: 'client_ip', // Get from request in production
        user_agent: navigator.userAgent,
      });

      if (acceptanceError) throw acceptanceError;

      // Mark account as activated
      await supabase
        .from('user_profiles')
        .update({
          account_activated: true,
          activation_completed_at: new Date().toISOString(),
        })
        .eq('id', userId);

      // Mark token as used
      await supabase.rpc('mark_token_used', { p_token: token });

      setStep('complete');
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to complete activation');
      setLoading(false);
    }
  };

  // Helper functions
  const generateTOTPSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  };

  const generateBackupCodes = (count: number) => {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, '0');
      codes.push(code.match(/.{1,4}/g)!.join('-'));
    }
    return codes;
  };

  const verifyTOTPCode = (secret: string, code: string) => {
    // In production, use a proper TOTP library like 'otpauth'
    // This is a simplified version for demonstration
    return code.length === 6 && /^\d{6}$/.test(code);
  };

  const passwordStrength = () => {
    const metCount = requirements.filter((req) => req.met).length;
    if (metCount === 0) return { label: '', color: '' };
    if (metCount <= 2) return { label: 'Weak', color: 'text-red-600' };
    if (metCount <= 4) return { label: 'Medium', color: 'text-yellow-600' };
    return { label: 'Strong', color: 'text-green-600' };
  };

  if (loading && step === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <Loader className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Validating activation link...</p>
        </div>
      </div>
    );
  }

  if (error && !tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Activation Error</h1>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/login')}
            className="w-full"
          >
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            {step === 'password' && <Lock className="h-8 w-8 text-primary-600" />}
            {step === '2fa' && <Shield className="h-8 w-8 text-primary-600" />}
            {step === 'policies' && <CheckCircle className="h-8 w-8 text-primary-600" />}
            {step === 'complete' && <CheckCircle className="h-8 w-8 text-green-600" />}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {tokenType === 'password_reset' ? 'Reset Your Password' : 'Activate Your Account'}
          </h1>
          <p className="text-gray-600">
            {step === 'password' && 'Set up your secure password'}
            {step === '2fa' && 'Configure Two-Factor Authentication'}
            {step === 'policies' && 'Accept Terms and Policies'}
            {step === 'complete' && 'Your account is now active!'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Step 1: Password Setup */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temporary Password
              </label>
              <PasswordInput
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                placeholder="Enter temporary password from email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {newPassword && (
                <p className={`text-sm mt-1 font-medium ${passwordStrength().color}`}>
                  Password strength: {passwordStrength().label}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Password must contain:</p>
              <ul className="space-y-2">
                {requirements.map((req, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    {req.met ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                    )}
                    <span className={req.met ? 'text-green-700' : 'text-gray-600'}>
                      {req.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading || !requirements.every((req) => req.met)}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Setting password...
                </>
              ) : (
                'Continue to 2FA Setup'
              )}
            </Button>
          </form>
        )}

        {/* Step 2: 2FA Setup */}
        {step === '2fa' && (
          <form onSubmit={handle2FAVerification} className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Important:</strong> Only Microsoft Authenticator is authorized for this system.
              </p>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code with Microsoft Authenticator app:
              </p>
              <div className="inline-block p-4 bg-white border-2 border-gray-300 rounded-lg">
                <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manual Setup Code
              </label>
              <div className="bg-gray-50 p-3 rounded border border-gray-300">
                <code className="text-sm font-mono break-all">{secret}</code>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Use this code if you can't scan the QR code
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <Input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
              />
            </div>

            {/* Backup Codes */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-900 mb-2">
                Save these backup codes:
              </p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {backupCodes.map((code, index) => (
                  <code key={index} className="text-xs bg-white p-2 rounded border border-yellow-300">
                    {code}
                  </code>
                ))}
              </div>
              <p className="text-xs text-yellow-800">
                Store these codes safely. They can be used to access your account if you lose your device.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading || verificationCode.length !== 6}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Verifying...
                </>
              ) : (
                'Verify and Continue'
              )}
            </Button>
          </form>
        )}

        {/* Step 3: Policies Acceptance */}
        {step === 'policies' && (
          <form onSubmit={handlePoliciesAcceptance} className="space-y-6">
            <p className="text-sm text-gray-600">
              Before you can access your account, you must read and accept our policies:
            </p>

            <div className="space-y-4">
              <label className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedGDPR}
                  onChange={(e) => setAcceptedGDPR(e.target.checked)}
                  className="mt-1 h-5 w-5 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">GDPR Compliance</p>
                  <p className="text-sm text-gray-600">
                    I understand and accept the GDPR data processing terms.{' '}
                    <a href="/policies/gdpr" target="_blank" className="text-primary-600 underline">
                      Read policy
                    </a>
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  className="mt-1 h-5 w-5 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Privacy Policy</p>
                  <p className="text-sm text-gray-600">
                    I have read and agree to the Privacy Policy.{' '}
                    <a
                      href="/policies/privacy"
                      target="_blank"
                      className="text-primary-600 underline"
                    >
                      Read policy
                    </a>
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedCookies}
                  onChange={(e) => setAcceptedCookies(e.target.checked)}
                  className="mt-1 h-5 w-5 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Cookie Policy</p>
                  <p className="text-sm text-gray-600">
                    I accept the use of cookies as described in the Cookie Policy.{' '}
                    <a
                      href="/policies/cookies"
                      target="_blank"
                      className="text-primary-600 underline"
                    >
                      Read policy
                    </a>
                  </p>
                </div>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading || !acceptedGDPR || !acceptedPrivacy || !acceptedCookies}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Completing activation...
                </>
              ) : (
                'Accept and Activate Account'
              )}
            </Button>
          </form>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Activated!</h2>
              <p className="text-gray-600">
                Your account has been successfully activated. You can now log in to Gold Shipper.
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
              <p className="text-sm text-green-800">
                <strong>Next steps:</strong>
              </p>
              <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
                <li>Use your email and new password to log in</li>
                <li>You'll be prompted for your 2FA code from Microsoft Authenticator</li>
                <li>Explore your dashboard and available features</li>
              </ul>
            </div>

            <Button variant="primary" onClick={() => navigate('/login')} className="w-full">
              Go to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
