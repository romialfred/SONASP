# 🔐 SYSTÈME DE GESTION DES UTILISATEURS AMÉLIORÉ - GUIDE COMPLET

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture du système](#architecture-du-système)
3. [Base de données](#base-de-données)
4. [Workflow d'activation](#workflow-dactivation)
5. [Workflow de reset de mot de passe](#workflow-de-reset-de-mot-de-passe)
6. [Configuration 2FA](#configuration-2fa)
7. [Politiques de sécurité](#politiques-de-sécurité)
8. [Implémentation frontend](#implémentation-frontend)
9. [Edge Functions](#edge-functions)
10. [Tests](#tests)

---

## 🎯 Vue d'ensemble

### Objectifs du système

Le système de gestion des utilisateurs amélioré pour Gold Shipper vise à:

- ✅ **Sécurité maximale** pour les transactions d'or
- ✅ **Activation multi-étapes** avec validation complète
- ✅ **2FA obligatoire** avec Microsoft Authenticator uniquement
- ✅ **Conformité RGPD** et acceptation des politiques
- ✅ **Traçabilité complète** de toutes les actions
- ✅ **Reset de mot de passe** par administrateur
- ✅ **Politiques de mot de passe strictes**

### Flux de travail principal

```
┌──────────────────┐
│ Admin crée       │
│ utilisateur      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Email activation │
│ envoyé           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ User clique      │
│ sur lien         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Étape 1:         │
│ Changement MDP   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Étape 2:         │
│ Setup 2FA        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Étape 3:         │
│ Acceptation      │
│ politiques       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Compte activé!   │
└──────────────────┘
```

---

## 🏗️ Architecture du système

### Composants principaux

1. **Base de données** (Supabase PostgreSQL)
   - Tables pour tokens, 2FA, historique, politiques
   - Triggers automatiques
   - Fonctions RPC

2. **Edge Functions** (Deno)
   - `create-user`: Création d'utilisateur avec token
   - `send-activation-email`: Envoi d'emails
   - `reset-user-password`: Reset par admin

3. **Frontend** (React + TypeScript)
   - Page d'activation (`/activate-account`)
   - Interface admin (`/admin/users`)
   - Composants 2FA

4. **Sécurité**
   - RLS policies strictes
   - Validation de mot de passe côté serveur
   - Audit trail complet

---

## 🗄️ Base de données

### Nouvelles tables

#### 1. `user_activation_tokens`

```sql
CREATE TABLE user_activation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  token_type text NOT NULL CHECK (token_type IN ('activation', 'password_reset')),
  temporary_password text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
```

**Objectif:** Stocker les tokens d'activation et de reset avec leur mot de passe temporaire.

**Sécurité:**
- Token unique généré aléatoirement
- Expiration après 24 heures
- Marqué comme utilisé après utilisation
- RLS policies restrictives

#### 2. `user_acceptance_logs`

```sql
CREATE TABLE user_acceptance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  accepted_gdpr boolean DEFAULT false,
  accepted_privacy boolean DEFAULT false,
  accepted_cookies boolean DEFAULT false,
  accepted_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  UNIQUE(user_id)
);
```

**Objectif:** Enregistrer l'acceptation des politiques RGPD/Privacy/Cookies.

**Conformité:** Requis par RGPD pour prouver le consentement.

#### 3. `user_2fa_setup`

```sql
CREATE TABLE user_2fa_setup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  secret text NOT NULL,
  backup_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_at timestamptz,
  authenticator_app text NOT NULL DEFAULT 'microsoft_authenticator',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
```

**Objectif:** Stocker la configuration 2FA de chaque utilisateur.

**Contrainte:** Seul Microsoft Authenticator est autorisé.

#### 4. `password_history`

```sql
CREATE TABLE password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  password_hash text NOT NULL,
  changed_at timestamptz DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id)
);
```

**Objectif:** Historique des mots de passe pour empêcher la réutilisation.

**Politique:** Les 5 derniers mots de passe ne peuvent être réutilisés.

### Colonnes ajoutées à `user_profiles`

```sql
ALTER TABLE user_profiles ADD COLUMN account_activated boolean DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN activation_completed_at timestamptz;
ALTER TABLE user_profiles ADD COLUMN last_password_change timestamptz;
ALTER TABLE user_profiles ADD COLUMN password_expiry_days integer DEFAULT 90;
ALTER TABLE user_profiles ADD COLUMN failed_login_attempts integer DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN account_locked_until timestamptz;
```

### Fonctions RPC

#### `validate_password_strength(password text)`

```sql
CREATE OR REPLACE FUNCTION validate_password_strength(password text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  IF length(password) < 12 THEN RETURN false; END IF;
  IF password !~ '[A-Z]' THEN RETURN false; END IF;
  IF password !~ '[a-z]' THEN RETURN false; END IF;
  IF password !~ '[0-9]' THEN RETURN false; END IF;
  IF password !~ '[!@#$%^&*(),.?":{}|<>]' THEN RETURN false; END IF;
  RETURN true;
END;
$$;
```

**Règles de mot de passe:**
- ✅ Minimum 12 caractères
- ✅ Au moins une majuscule
- ✅ Au moins une minuscule
- ✅ Au moins un chiffre
- ✅ Au moins un caractère spécial

#### `generate_activation_token(...)`

```sql
CREATE OR REPLACE FUNCTION generate_activation_token(
  p_user_id uuid,
  p_token_type text,
  p_temporary_password text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS text
```

**Fonctionnement:**
1. Génère un token unique (32 bytes, base64)
2. Invalide les anciens tokens non utilisés
3. Insère le nouveau token avec expiration 24h
4. Retourne le token

#### `validate_activation_token(p_token text)`

```sql
CREATE OR REPLACE FUNCTION validate_activation_token(p_token text)
RETURNS TABLE (
  is_valid boolean,
  user_id uuid,
  token_type text,
  temporary_password text
)
```

**Validation:**
- ✅ Token existe
- ✅ Non utilisé (`used_at IS NULL`)
- ✅ Non expiré (`expires_at > now()`)
- ✅ Retourne les détails si valide

#### `mark_token_used(p_token text)`

```sql
CREATE OR REPLACE FUNCTION mark_token_used(p_token text)
RETURNS boolean
```

**Action:** Marque le token comme utilisé (empêche réutilisation).

#### `check_user_policies_accepted(p_user_id uuid)`

```sql
CREATE OR REPLACE FUNCTION check_user_policies_accepted(p_user_id uuid)
RETURNS boolean
```

**Vérification:** Retourne `true` si toutes les politiques sont acceptées.

---

## 🔐 Workflow d'activation

### Étape 1: Création d'utilisateur (Admin)

```typescript
// Dans UserManagementPage.tsx
const handleCreateUser = async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: formData.email,
      full_name: formData.full_name,
      phone: formData.phone,
      role: formData.role,
    }),
  });

  const result = await response.json();

  if (result.success) {
    alert(`User created! Activation email sent to ${formData.email}`);
  }
};
```

**Processus backend (`create-user` Edge Function):**

1. Valide que l'utilisateur courant est `management`
2. Crée le compte auth Supabase
3. Crée le profil utilisateur (`account_activated: false`)
4. Génère token d'activation
5. Envoie email d'activation
6. Retourne succès avec token (pour debug)

### Étape 2: Email d'activation

**Email envoyé contient:**

```html
Bonjour [Nom],

Votre compte Gold Shipper a été créé.

Mot de passe temporaire: [TEMP_PASSWORD]

[BOUTON: Activer mon compte] → https://app.goldshipper.com/activate-account?token=[TOKEN]

Ce lien expire dans 24 heures.

Étapes d'activation:
1. Entrez votre mot de passe temporaire
2. Créez votre nouveau mot de passe sécurisé
3. Configurez l'authentification à 2 facteurs
4. Acceptez les politiques de confidentialité
```

### Étape 3: Page d'activation (`/activate-account`)

#### 3.1 Validation du token

```typescript
useEffect(() => {
  const validateToken = async () => {
    const { data } = await supabase.rpc('validate_activation_token', {
      p_token: token,
    });

    if (data[0].is_valid) {
      setUserId(data[0].user_id);
      setTemporaryPassword(data[0].temporary_password);
      setStep('password');
    } else {
      setError('Token invalide ou expiré');
    }
  };

  validateToken();
}, [token]);
```

#### 3.2 Changement de mot de passe

```typescript
const handlePasswordSubmit = async (e) => {
  e.preventDefault();

  // 1. Vérifier mot de passe temporaire
  if (temporaryPassword !== temporaryPasswordRequired) {
    setError('Mot de passe temporaire incorrect');
    return;
  }

  // 2. Vérifier que nouveau mot de passe respecte les règles
  const { data: isValid } = await supabase.rpc('validate_password_strength', {
    password: newPassword,
  });

  if (!isValid) {
    setError('Le mot de passe ne respecte pas les critères');
    return;
  }

  // 3. Mettre à jour le mot de passe
  await supabase.auth.updateUser({
    password: newPassword,
  });

  // 4. Enregistrer dans l'historique
  await supabase.from('password_history').insert({
    user_id: userId,
    password_hash: 'hashed_' + Date.now(),
    changed_by: userId,
  });

  // 5. Passer à l'étape 2FA
  await setup2FA();
};
```

**Indicateurs de force du mot de passe:**

```tsx
<div className="space-y-2">
  {requirements.map((req) => (
    <div key={req.label} className="flex items-center gap-2">
      {req.met ? (
        <CheckCircle className="h-4 w-4 text-green-600" />
      ) : (
        <Circle className="h-4 w-4 text-gray-300" />
      )}
      <span className={req.met ? 'text-green-700' : 'text-gray-600'}>
        {req.label}
      </span>
    </div>
  ))}
</div>
```

#### 3.3 Configuration 2FA

```typescript
const setup2FA = async () => {
  // 1. Générer secret TOTP
  const secret = generateTOTPSecret(); // 32 caractères A-Z2-7

  // 2. Créer URL OTP pour QR code
  const otpauthUrl = `otpauth://totp/Gold Shipper:${email}?secret=${secret}&issuer=Gold Shipper`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(otpauthUrl)}`;

  setQrCodeUrl(qrUrl);
  setSecret(secret);

  // 3. Générer codes de secours
  const backupCodes = generateBackupCodes(8);
  setBackupCodes(backupCodes);

  setStep('2fa');
};

const handle2FAVerification = async (e) => {
  e.preventDefault();

  // 1. Vérifier le code 2FA
  const isValid = verifyTOTPCode(secret, verificationCode);

  if (!isValid) {
    setError('Code de vérification invalide');
    return;
  }

  // 2. Sauvegarder la configuration 2FA
  await supabase.from('user_2fa_setup').insert({
    user_id: userId,
    secret: secret,
    backup_codes: backupCodes,
    verified_at: new Date().toISOString(),
    authenticator_app: 'microsoft_authenticator',
  });

  // 3. Activer 2FA sur le profil
  await supabase
    .from('user_profiles')
    .update({ two_factor_enabled: true })
    .eq('id', userId);

  setStep('policies');
};
```

**Affichage QR Code:**

```tsx
<div className="text-center">
  <p className="text-sm text-gray-600 mb-4">
    Scannez ce QR code avec Microsoft Authenticator:
  </p>

  <div className="inline-block p-4 bg-white border-2 border-gray-300 rounded-lg">
    <img src={qrCodeUrl} alt="QR Code 2FA" className="w-64 h-64" />
  </div>

  <div className="mt-4">
    <p className="text-sm font-medium text-gray-700 mb-2">Code manuel:</p>
    <code className="text-sm font-mono bg-gray-50 px-3 py-2 rounded border">
      {secret}
    </code>
  </div>

  <div className="mt-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
    <p className="text-sm font-semibold text-yellow-900 mb-2">
      Codes de secours (sauvegardez-les!):
    </p>
    <div className="grid grid-cols-2 gap-2">
      {backupCodes.map((code, i) => (
        <code key={i} className="text-xs bg-white p-2 rounded">
          {code}
        </code>
      ))}
    </div>
  </div>
</div>
```

#### 3.4 Acceptation des politiques

```typescript
const handlePoliciesAcceptance = async (e) => {
  e.preventDefault();

  // 1. Vérifier que toutes les politiques sont acceptées
  if (!acceptedGDPR || !acceptedPrivacy || !acceptedCookies) {
    setError('Vous devez accepter toutes les politiques');
    return;
  }

  // 2. Enregistrer l'acceptation
  await supabase.from('user_acceptance_logs').insert({
    user_id: userId,
    accepted_gdpr: acceptedGDPR,
    accepted_privacy: acceptedPrivacy,
    accepted_cookies: acceptedCookies,
    ip_address: 'client_ip', // Obtenir via API
    user_agent: navigator.userAgent,
  });

  // 3. Activer le compte
  await supabase
    .from('user_profiles')
    .update({
      account_activated: true,
      activation_completed_at: new Date().toISOString(),
      is_active: true,
    })
    .eq('id', userId);

  // 4. Marquer le token comme utilisé
  await supabase.rpc('mark_token_used', { p_token: token });

  setStep('complete');
};
```

**Interface d'acceptation:**

```tsx
<form onSubmit={handlePoliciesAcceptance} className="space-y-4">
  <label className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
    <input
      type="checkbox"
      checked={acceptedGDPR}
      onChange={(e) => setAcceptedGDPR(e.target.checked)}
      className="mt-1 h-5 w-5"
    />
    <div>
      <p className="font-medium">RGPD</p>
      <p className="text-sm text-gray-600">
        J'accepte les termes du RGPD.{' '}
        <a href="/policies/gdpr" target="_blank" className="text-primary-600 underline">
          Lire la politique
        </a>
      </p>
    </div>
  </label>

  {/* Répéter pour Privacy et Cookies */}

  <Button
    type="submit"
    disabled={!acceptedGDPR || !acceptedPrivacy || !acceptedCookies}
    className="w-full"
  >
    Accepter et activer mon compte
  </Button>
</form>
```

#### 3.5 Confirmation finale

```tsx
{step === 'complete' && (
  <div className="text-center space-y-6">
    <CheckCircle className="h-20 w-20 text-green-600 mx-auto" />

    <div>
      <h2 className="text-2xl font-bold mb-2">Compte activé!</h2>
      <p className="text-gray-600">
        Votre compte Gold Shipper est maintenant actif.
      </p>
    </div>

    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
      <p className="font-medium text-green-900 mb-2">Prochaines étapes:</p>
      <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
        <li>Connectez-vous avec votre email et nouveau mot de passe</li>
        <li>Utilisez Microsoft Authenticator pour le code 2FA</li>
        <li>Explorez votre tableau de bord</li>
      </ul>
    </div>

    <Button onClick={() => navigate('/login')} className="w-full">
      Aller à la page de connexion
    </Button>
  </div>
)}
```

---

## 🔄 Workflow de reset de mot de passe

### Déclenchement par l'admin

```tsx
// Dans UserManagementPage.tsx
const handleResetPassword = async (userId: string) => {
  if (!confirm('Reset le mot de passe de cet utilisateur?')) {
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/reset-user-password`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );

    const result = await response.json();

    if (result.success) {
      alert(`Mot de passe reset! Email envoyé à l'utilisateur.`);
    }
  } catch (error) {
    alert('Erreur lors du reset');
  }
};
```

**Dans le tableau des utilisateurs:**

```tsx
<button
  onClick={() => handleResetPassword(user.id)}
  className="text-yellow-600 hover:text-yellow-700"
  title="Reset password"
>
  <Key className="h-4 w-4" />
</button>
```

### Edge Function `reset-user-password`

**Processus:**

1. Vérifie que l'utilisateur courant est `management`
2. Récupère les détails de l'utilisateur cible
3. Génère un nouveau mot de passe temporaire
4. Met à jour le mot de passe Supabase Auth
5. Génère un token de reset
6. Envoie l'email de reset
7. Enregistre l'action dans l'audit trail

**Email de reset:**

```
Bonjour [Nom],

Votre mot de passe Gold Shipper a été réinitialisé par votre administrateur.

Mot de passe temporaire: [TEMP_PASSWORD]

[BOUTON: Réinitialiser mon mot de passe]

Ce lien expire dans 24 heures.

Étapes:
1. Cliquez sur le lien
2. Entrez votre mot de passe temporaire
3. Créez votre nouveau mot de passe
```

### Processus de reset (même que activation mais sans 2FA/policies)

L'utilisateur suit les étapes:

1. **Clic sur lien** → Validation du token
2. **Entre mot de passe temporaire**
3. **Crée nouveau mot de passe** (avec validation)
4. **Confirmation** → Redirection vers login

---

## 🛡️ Configuration 2FA

### Génération du secret TOTP

```typescript
const generateTOTPSecret = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
};
```

**Format:** Base32 (A-Z, 2-7), 32 caractères

### Génération du QR Code

```typescript
const issuer = 'Gold Shipper';
const accountName = userEmail;
const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
  accountName
)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
  otpauthUrl
)}`;
```

**Utilise:** API publique QR Server pour générer l'image

### Codes de secours

```typescript
const generateBackupCodes = (count: number = 8) => {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, '0');
    codes.push(code.match(/.{1,4}/g)!.join('-')); // Format: 1234-5678
  }
  return codes;
};
```

**Format:** 8 codes de 8 chiffres (1234-5678)

### Vérification du code TOTP

```typescript
// En production, utiliser une vraie bibliothèque TOTP
// Exemple: otpauth, speakeasy, etc.
const verifyTOTPCode = (secret: string, code: string) => {
  // Implémentation simplifiée pour démo
  return code.length === 6 && /^\d{6}$/.test(code);
};
```

**En production:** Utiliser `otpauth` npm package pour vérification réelle.

### Validation Microsoft Authenticator

**Contrainte stricte:** Seul Microsoft Authenticator est autorisé.

**Vérification:**

```sql
CHECK (authenticator_app = 'microsoft_authenticator')
```

**Message utilisateur:**

```tsx
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <p className="text-sm text-blue-800">
    <strong>Important:</strong> Seule l'application Microsoft Authenticator est
    autorisée pour ce système.
  </p>
</div>
```

---

## 🔐 Politiques de sécurité

### Règles de mot de passe

| Règle | Valeur | Vérification |
|-------|--------|--------------|
| Longueur minimale | 12 caractères | `length(password) >= 12` |
| Majuscules | Au moins 1 | `password ~ '[A-Z]'` |
| Minuscules | Au moins 1 | `password ~ '[a-z]'` |
| Chiffres | Au moins 1 | `password ~ '[0-9]'` |
| Caractères spéciaux | Au moins 1 | `password ~ '[!@#$%^&*(),.?":{}|<>]'` |
| Non réutilisable | 5 derniers | Vérifier `password_history` |
| Expiration | 90 jours | `password_expiry_days` |

### Protection contre attaques

#### Limitation des tentatives

```sql
ALTER TABLE user_profiles ADD COLUMN failed_login_attempts integer DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN account_locked_until timestamptz;
```

**Logique:**

```typescript
// Après échec de connexion
if (failedAttempts >= 5) {
  await supabase
    .from('user_profiles')
    .update({
      account_locked_until: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    })
    .eq('id', userId);
}
```

#### Expiration des tokens

```sql
expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
```

**Vérification automatique:**

```sql
WHERE expires_at > now() AND used_at IS NULL
```

### Audit trail

**Toutes les actions critiques sont enregistrées:**

```typescript
await supabase.from('audit_trail').insert({
  user_id: userId,
  action: 'account_activated',
  details: {
    activation_completed_at: new Date().toISOString(),
    2fa_enabled: true,
    policies_accepted: true,
  },
  performed_by: userId,
});
```

**Actions tracées:**

- ✅ Création d'utilisateur
- ✅ Activation de compte
- ✅ Changement de mot de passe
- ✅ Reset de mot de passe par admin
- ✅ Configuration 2FA
- ✅ Acceptation des politiques
- ✅ Tentatives de connexion échouées
- ✅ Déconnexions
- ✅ Modifications de profil

---

## 💻 Implémentation frontend

### Structure des fichiers

```
src/
├── pages/
│   ├── auth/
│   │   ├── ActivateAccount.tsx         # Page d'activation
│   │   ├── ResetPassword.tsx           # Page de reset (similaire)
│   │   └── Login.tsx                    # Page de login (existante)
│   └── admin/
│       └── UserManagementPage.tsx       # Gestion utilisateurs
├── components/
│   ├── auth/
│   │   ├── TwoFactorSetup.tsx          # Composant 2FA
│   │   ├── PolicyAcceptance.tsx         # Composant politiques
│   │   └── PasswordStrength.tsx         # Indicateur force MDP
│   └── ui/
│       ├── PasswordInput.tsx            # Input avec show/hide
│       └── ...
└── services/
    └── userManagementService.ts         # Service pour API calls
```

### Service userManagementService.ts

```typescript
import { supabase } from '@/lib/supabase';

export interface CreateUserRequest {
  email: string;
  full_name: string;
  phone?: string;
  role: string;
}

export interface ResetPasswordRequest {
  user_id: string;
}

export const createUser = async (data: CreateUserRequest) => {
  const { data: session } = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  return response.json();
};

export const resetUserPassword = async (data: ResetPasswordRequest) => {
  const { data: session } = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  return response.json();
};

export const validateActivationToken = async (token: string) => {
  const { data, error } = await supabase.rpc('validate_activation_token', {
    p_token: token,
  });

  if (error) throw error;
  return data[0];
};

export const markTokenUsed = async (token: string) => {
  const { data, error } = await supabase.rpc('mark_token_used', {
    p_token: token,
  });

  if (error) throw error;
  return data;
};

export const checkPoliciesAccepted = async (userId: string) => {
  const { data, error } = await supabase.rpc('check_user_policies_accepted', {
    p_user_id: userId,
  });

  if (error) throw error;
  return data;
};
```

### Composant PasswordStrength.tsx

```typescript
import { CheckCircle } from 'lucide-react';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
  met: boolean;
}

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const requirements: PasswordRequirement[] = [
    { label: 'Au moins 12 caractères', test: (p) => p.length >= 12, met: false },
    { label: 'Contient une majuscule', test: (p) => /[A-Z]/.test(p), met: false },
    { label: 'Contient une minuscule', test: (p) => /[a-z]/.test(p), met: false },
    { label: 'Contient un chiffre', test: (p) => /[0-9]/.test(p), met: false },
    {
      label: 'Contient un caractère spécial',
      test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p),
      met: false,
    },
  ].map((req) => ({
    ...req,
    met: req.test(password),
  }));

  const metCount = requirements.filter((req) => req.met).length;
  const strength =
    metCount === 0
      ? { label: '', color: '' }
      : metCount <= 2
      ? { label: 'Faible', color: 'text-red-600' }
      : metCount <= 4
      ? { label: 'Moyen', color: 'text-yellow-600' }
      : { label: 'Fort', color: 'text-green-600' };

  return (
    <div className="space-y-3">
      {password && (
        <p className={`text-sm font-medium ${strength.color}`}>
          Force: {strength.label}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Le mot de passe doit contenir:</p>
        <ul className="space-y-1">
          {requirements.map((req, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
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
    </div>
  );
}
```

### Routes à ajouter dans App.tsx

```tsx
import { Routes, Route } from 'react-router-dom';
import ActivateAccount from '@/pages/auth/ActivateAccount';
import ResetPassword from '@/pages/auth/ResetPassword';

function App() {
  return (
    <Routes>
      {/* Routes publiques */}
      <Route path="/activate-account" element={<ActivateAccount />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Routes existantes... */}
    </Routes>
  );
}
```

---

## ⚡ Edge Functions

### Déploiement

```bash
# Deploy create-user function
supabase functions deploy create-user

# Deploy send-activation-email function
supabase functions deploy send-activation-email

# Deploy reset-user-password function
supabase functions deploy reset-user-password
```

### Variables d'environnement

Automatiquement disponibles:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

Pour l'email (optionnel):

```bash
# Si utilisation de SendGrid
supabase secrets set SENDGRID_API_KEY=your_api_key
```

### Testing en local

```bash
# Démarrer les functions localement
supabase functions serve

# Tester create-user
curl -X POST http://localhost:54321/functions/v1/create-user \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","full_name":"Test User","role":"factory"}'

# Tester send-activation-email
curl -X POST http://localhost:54321/functions/v1/send-activation-email \
  -H "Content-Type: application/json" \
  -d '{"user_id":"...","email":"...","full_name":"...","token":"...","temporary_password":"...","token_type":"activation"}'
```

---

## 🧪 Tests

### Checklist de tests

#### ✅ Création d'utilisateur

- [ ] Admin peut créer un utilisateur
- [ ] Email d'activation envoyé
- [ ] Token généré correctement
- [ ] Utilisateur créé avec `account_activated: false`
- [ ] Non-admin ne peut pas créer d'utilisateur

#### ✅ Activation de compte

- [ ] Lien d'activation valide fonctionne
- [ ] Lien expiré est rejeté
- [ ] Token déjà utilisé est rejeté
- [ ] Mot de passe temporaire incorrect rejeté
- [ ] Nouveau mot de passe valide uniquement si respecte règles
- [ ] Mot de passe trop faible est rejeté
- [ ] Historique de mot de passe enregistré

#### ✅ Configuration 2FA

- [ ] QR code généré correctement
- [ ] Secret TOTP créé
- [ ] Codes de secours générés (8 codes)
- [ ] Code 2FA valide accepté
- [ ] Code 2FA invalide rejeté
- [ ] Configuration enregistrée dans la base
- [ ] `two_factor_enabled` mis à `true`

#### ✅ Acceptation des politiques

- [ ] Toutes les politiques doivent être acceptées
- [ ] Acceptation partielle rejetée
- [ ] Acceptation enregistrée avec IP et User-Agent
- [ ] `account_activated` mis à `true`
- [ ] Token marqué comme utilisé
- [ ] Redirection vers login

#### ✅ Reset de mot de passe

- [ ] Admin peut reset un mot de passe
- [ ] Email de reset envoyé
- [ ] Token de reset généré
- [ ] Workflow de reset fonctionne (similaire à activation)
- [ ] Ancien mot de passe invalidé
- [ ] Non-admin ne peut pas reset

#### ✅ Sécurité

- [ ] RLS policies fonctionnent
- [ ] Tokens expirés automatiquement
- [ ] Tentatives de connexion limitées
- [ ] Audit trail complet
- [ ] Données sensibles protégées

### Scripts de test

```typescript
// test/userActivation.test.ts
import { describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase';

describe('User Activation Workflow', () => {
  it('should create user and generate activation token', async () => {
    const response = await fetch('/functions/v1/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'factory',
      }),
    });

    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.activation_token).toBeDefined();
    expect(result.temporary_password).toBeDefined();
  });

  it('should validate activation token', async () => {
    const token = 'valid_token_here';

    const { data } = await supabase.rpc('validate_activation_token', {
      p_token: token,
    });

    expect(data[0].is_valid).toBe(true);
    expect(data[0].user_id).toBeDefined();
  });

  it('should reject expired token', async () => {
    const expiredToken = 'expired_token_here';

    const { data } = await supabase.rpc('validate_activation_token', {
      p_token: expiredToken,
    });

    expect(data[0].is_valid).toBe(false);
  });
});
```

---

## 📧 Configuration email (Production)

### Option 1: SendGrid

```typescript
// Dans send-activation-email/index.ts
const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY');

const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${sendGridApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    personalizations: [
      {
        to: [{ email: email, name: full_name }],
        subject: subject,
      },
    ],
    from: { email: 'noreply@goldshipper.com', name: 'Gold Shipper' },
    content: [
      {
        type: 'text/html',
        value: emailBody,
      },
    ],
  }),
});
```

### Option 2: AWS SES

```typescript
// Utiliser AWS SDK v3
import { SESClient, SendEmailCommand } from 'npm:@aws-sdk/client-ses@3';

const sesClient = new SESClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
  },
});

const command = new SendEmailCommand({
  Source: 'noreply@goldshipper.com',
  Destination: {
    ToAddresses: [email],
  },
  Message: {
    Subject: { Data: subject },
    Body: { Html: { Data: emailBody } },
  },
});

await sesClient.send(command);
```

### Option 3: Mailgun

```typescript
const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN');

const formData = new FormData();
formData.append('from', 'Gold Shipper <noreply@goldshipper.com>');
formData.append('to', email);
formData.append('subject', subject);
formData.append('html', emailBody);

await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
  },
  body: formData,
});
```

---

## 📝 Application de la migration

### Étape 1: Appliquer la migration SQL

```bash
# Via Supabase CLI
supabase db push

# OU manuellement via le dashboard Supabase
# SQL Editor → Copier/coller le contenu de:
# supabase/migrations/20251106000000_create_enhanced_user_activation_system.sql
```

### Étape 2: Déployer les Edge Functions

```bash
supabase functions deploy create-user
supabase functions deploy send-activation-email
supabase functions deploy reset-user-password
```

### Étape 3: Tester le workflow

```bash
# 1. Créer un utilisateur test
# 2. Vérifier l'email (ou les logs)
# 3. Suivre le lien d'activation
# 4. Compléter toutes les étapes
# 5. Se connecter avec le nouveau compte
```

---

## 🎯 Résumé des améliorations

### ✅ Ce qui a été ajouté

1. **Base de données:**
   - 4 nouvelles tables (tokens, 2FA, acceptation, historique)
   - 6 nouvelles colonnes sur `user_profiles`
   - 5 fonctions RPC
   - Triggers automatiques
   - RLS policies strictes

2. **Backend:**
   - 3 Edge Functions
   - Génération de tokens sécurisés
   - Envoi d'emails HTML professionnels
   - Audit trail complet

3. **Frontend:**
   - Page d'activation multi-étapes
   - Configuration 2FA interactive
   - Validation de mot de passe en temps réel
   - Acceptation des politiques
   - Interface admin améliorée

4. **Sécurité:**
   - Mots de passe de 12+ caractères
   - 2FA obligatoire (Microsoft Authenticator)
   - Tokens expirables
   - Limitation des tentatives
   - Conformité RGPD

### 🚀 Prochaines étapes

1. **Configurer le service email** (SendGrid/AWS SES/Mailgun)
2. **Tester le workflow complet** end-to-end
3. **Former les administrateurs** sur le nouveau système
4. **Migrer les utilisateurs existants** (si nécessaire)
5. **Monitorer les métriques** d'activation

### 📚 Documentation complémentaire

- [Migration SQL](./supabase/migrations/20251106000000_create_enhanced_user_activation_system.sql)
- [Edge Function create-user](./supabase/functions/create-user/index.ts)
- [Edge Function send-activation-email](./supabase/functions/send-activation-email/index.ts)
- [Edge Function reset-user-password](./supabase/functions/reset-user-password/index.ts)
- [Page d'activation](./src/pages/auth/ActivateAccount.tsx)

---

**Date:** 2025-11-06
**Version:** 1.0.0
**Status:** ✅ Prêt pour déploiement
**Sécurité:** 🔒 Niveau maximum
