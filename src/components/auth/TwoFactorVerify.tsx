import { useState } from 'react';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';

interface TwoFactorVerifyProps {
  onVerify: (code: string) => Promise<{ error?: string }>;
  onCancel: () => void;
}

export function TwoFactorVerify({ onVerify, onCancel }: TwoFactorVerifyProps) {
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || (code.length !== 6 && !useBackupCode)) {
      setError('Veuillez saisir un code valide.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await onVerify(code);
      if (result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'La vérification a échoué.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary-500" />
          <CardTitle>Authentification à deux facteurs</CardTitle>
        </div>
        <CardDescription>
          {useBackupCode
            ? 'Saisissez l’un de vos codes de récupération.'
            : 'Saisissez le code à 6 chiffres généré par votre application d’authentification.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <FormField label={useBackupCode ? 'Code de récupération' : 'Code de vérification'} required>
            <Input
              type="text"
              value={code}
              onChange={(e) => {
                const value = useBackupCode
                  ? e.target.value.toUpperCase()
                  : e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(value);
              }}
              placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
              maxLength={useBackupCode ? 8 : 6}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </FormField>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={!code || (code.length !== 6 && !useBackupCode)}
              className="flex-1"
            >
              Vérifier
            </Button>
          </div>

          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setCode('');
              setError('');
            }}
            className="w-full text-sm text-primary-600 hover:text-primary-700"
          >
            {useBackupCode ? 'Utiliser l’application d’authentification' : 'Utiliser plutôt un code de récupération'}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
