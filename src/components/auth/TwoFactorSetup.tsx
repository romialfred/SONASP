import { useState, useEffect } from 'react';
import { Shield, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState<'generate' | 'verify' | 'backup'>('generate');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (step === 'generate') {
      generateSecret();
    }
  }, [step]);

  const generateSecret = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const secret = generateBase32Secret();
      const qrCodeUrl = generateQRCodeUrl(user.email, secret);

      setSecret(secret);
      setQrCode(qrCodeUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to generate 2FA secret');
    } finally {
      setLoading(false);
    }
  };

  const generateBase32Secret = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars[Math.floor(Math.random() * chars.length)];
    }
    return secret;
  };

  const generateQRCodeUrl = (email: string, secret: string): string => {
    const issuer = 'Gold Shipper';
    const label = `${issuer}:${email}`;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
  };

  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  const handleVerify = async () => {
    if (!user || !verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const codes = generateBackupCodes();

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          two_factor_enabled: true,
          two_factor_secret: secret,
          backup_codes: codes,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await supabase.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: '2fa_enabled',
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
        p_details: { method: 'totp' },
      });

      setBackupCodes(codes);
      setStep('backup');
    } catch (err: any) {
      setError(err.message || 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    await refreshProfile();
    onComplete();
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (step === 'generate') {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary-500" />
            <CardTitle>Enable Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Scan the QR code with your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-6 rounded-lg flex flex-col items-center">
            {qrCode ? (
              <>
                <img src={qrCode} alt="QR Code" className="w-48 h-48 mb-4" />
                <p className="text-sm text-gray-600 text-center mb-2">
                  Or enter this code manually:
                </p>
                <div className="bg-white px-4 py-2 rounded border border-gray-200 font-mono text-sm">
                  {secret}
                </div>
              </>
            ) : (
              <div className="w-48 h-48 bg-gray-200 animate-pulse rounded" />
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Recommended Apps:</strong>
              <br />
              • Google Authenticator
              <br />
              • Microsoft Authenticator
              <br />
              • Authy
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep('verify')}
              disabled={!secret}
              className="flex-1"
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'verify') {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary-500" />
            <CardTitle>Verify Setup</CardTitle>
          </div>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <FormField label="Verification Code" required>
            <Input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
          </FormField>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setStep('generate')}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleVerify}
              loading={loading}
              disabled={verificationCode.length !== 6}
              className="flex-1"
            >
              Verify & Enable
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-success-500" />
          <CardTitle>2FA Enabled Successfully!</CardTitle>
        </div>
        <CardDescription>
          Save these backup codes in a secure location
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800 font-medium mb-2">
            Important: Save these backup codes
          </p>
          <p className="text-sm text-yellow-700">
            You can use these codes to access your account if you lose your authenticator device.
            Each code can only be used once.
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white p-2 rounded border border-gray-200"
              >
                <span className="font-mono text-sm">{code}</span>
                <button
                  onClick={() => copyToClipboard(code, index)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {copiedIndex === index ? (
                    <Check className="h-4 w-4 text-success-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        <Button variant="primary" onClick={handleComplete} className="w-full">
          I've Saved My Backup Codes
        </Button>
      </CardContent>
    </Card>
  );
}
