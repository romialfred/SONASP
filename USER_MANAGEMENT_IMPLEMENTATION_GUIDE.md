# Guide d'Implémentation - Système de Gestion des Utilisateurs Professionnel

## Étapes d'Application

### Étape 1: Appliquer la Migration SQL ✅

**Fichier créé:** `/tmp/user_management_migration.sql`

**Instructions:**

1. Ouvrir **Supabase Dashboard**
2. Aller dans **SQL Editor**
3. Créer une "New Query"
4. Copier tout le contenu du fichier `/tmp/user_management_migration.sql`
5. Coller dans l'éditeur SQL
6. Cliquer sur **"Run"**
7. Vérifier les messages de succès

**Résultat attendu:**
```
✅ 11 colonnes ajoutées à user_profiles
✅ Table user_login_history créée
✅ Table user_activity_logs créée
✅ Table user_mining_company_access créée
✅ Table user_sessions créée
✅ 3 fonctions créées (log_user_activity, log_user_login, get_user_dashboard_stats)
✅ 2 vues créées (user_profiles_with_access, user_activity_summary)
✅ RLS policies configurées sur toutes les tables
```

**Vérification rapide:**
```sql
-- Vérifier que les tables existent
SELECT table_name FROM information_schema.tables
WHERE table_name IN (
  'user_login_history',
  'user_activity_logs',
  'user_mining_company_access',
  'user_sessions'
);

-- Vérifier les nouvelles colonnes dans user_profiles
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN (
  'job_title', 'department', 'manager_id',
  'last_activity_at', 'account_locked', 'timezone'
);
```

---

### Étape 2: Services TypeScript Créés ✅

Les fichiers suivants ont été créés/mis à jour:

1. **src/services/userActivityService.ts** - Service pour logger les activités
2. **src/services/userLoginService.ts** - Service pour logger les connexions
3. **src/services/userMiningAccessService.ts** - Service pour gérer les accès par site

---

### Étape 3: Composants UI À Créer 🔄

Les composants suivants doivent être créés:

1. **src/pages/admin/UserDetailsPage.tsx** - Page principale avec onglets
2. **src/components/admin/LoginHistoryTab.tsx** - Onglet historique connexions
3. **src/components/admin/ActivityHistoryTab.tsx** - Onglet historique actions
4. **src/components/admin/SiteAccessTab.tsx** - Onglet accès sites
5. **src/components/admin/SessionsTab.tsx** - Onglet sessions actives

---

### Étape 4: Intégration dans l'Application 🔄

1. Ajouter logging automatique dans tous les services
2. Mettre à jour AuthContext pour logger les connexions
3. Créer hook useActivityLogger pour simplifier le logging
4. Ajouter route /admin/users/:id pour la page détails

---

## Structure Complète des Fichiers

```
src/
├── services/
│   ├── userActivityService.ts          ✅ Créé
│   ├── userLoginService.ts             ✅ Créé
│   └── userMiningAccessService.ts      ✅ Créé
│
├── hooks/
│   └── useActivityLogger.ts            🔄 À créer
│
├── pages/
│   └── admin/
│       ├── UserManagementPage.tsx      ✅ Existe (à améliorer)
│       └── UserDetailsPage.tsx         🔄 À créer
│
└── components/
    └── admin/
        ├── LoginHistoryTab.tsx         🔄 À créer
        ├── ActivityHistoryTab.tsx      🔄 À créer
        ├── SiteAccessTab.tsx           🔄 À créer
        ├── SessionsTab.tsx             🔄 À créer
        └── UserStatsCard.tsx           🔄 À créer
```

---

## Utilisation des Services

### 1. Logger une Activité

```typescript
import { userActivityService } from '@/services/userActivityService';

// Dans n'importe quel service ou composant
await userActivityService.logActivity({
  actionType: 'create',
  moduleName: 'sales',
  resourceType: 'sale',
  resourceId: sale.id,
  description: `Created sale ${sale.reference_number}`,
  changesSummary: {
    amount: sale.amount_usd,
    customer: sale.customer_name,
  },
});
```

### 2. Logger une Connexion

```typescript
import { userLoginService } from '@/services/userLoginService';

// Dans AuthContext après login réussi
await userLoginService.logLogin({
  userId: user.id,
  success: true,
  twoFactorVerified: twoFactorEnabled,
});
```

### 3. Gérer les Accès par Site

```typescript
import { userMiningAccessService } from '@/services/userMiningAccessService';

// Accorder un accès
await userMiningAccessService.grantAccess({
  userId: user.id,
  miningCompanyId: company.id,
  accessLevel: 'write',
  isPrimary: true,
});

// Récupérer les accès d'un utilisateur
const accesses = await userMiningAccessService.getUserAccess(userId);

// Révoquer un accès
await userMiningAccessService.revokeAccess(accessId);
```

---

## Exemples d'Intégration

### Hook useActivityLogger

```typescript
// hooks/useActivityLogger.ts
import { useCallback } from 'react';
import { userActivityService } from '@/services/userActivityService';

export function useActivityLogger() {
  const logActivity = useCallback(async (params: {
    actionType: string;
    moduleName: string;
    resourceType: string;
    resourceId?: string;
    description: string;
    changesSummary?: any;
  }) => {
    try {
      await userActivityService.logActivity(params);
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Ne pas bloquer l'opération si le log échoue
    }
  }, []);

  return { logActivity };
}

// Utilisation dans un composant
const { logActivity } = useActivityLogger();

const handleCreateSale = async (data) => {
  const sale = await salesService.createSale(data);

  await logActivity({
    actionType: 'create',
    moduleName: 'sales',
    resourceType: 'sale',
    resourceId: sale.id,
    description: `Created sale ${sale.reference_number}`,
  });
};
```

### Logging Automatique dans AuthContext

```typescript
// src/contexts/AuthContext.tsx

// Après login réussi
const handleLogin = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Logger échec de connexion
    await userLoginService.logLogin({
      userId: null, // Pas d'ID car échec
      success: false,
      failureReason: error.message,
    });
    throw error;
  }

  // Logger succès de connexion
  await userLoginService.logLogin({
    userId: data.user.id,
    success: true,
    twoFactorVerified: data.user.user_metadata?.two_factor_enabled,
  });
};
```

---

## Tests à Effectuer

### Test 1: Vérifier les Logs de Connexion

```sql
-- Dans Supabase SQL Editor
SELECT * FROM user_login_history
ORDER BY login_timestamp DESC
LIMIT 10;
```

### Test 2: Vérifier les Logs d'Activité

```sql
SELECT
  u.full_name,
  ual.action_type,
  ual.module_name,
  ual.description,
  ual.created_at
FROM user_activity_logs ual
JOIN user_profiles u ON u.id = ual.user_id
ORDER BY ual.created_at DESC
LIMIT 20;
```

### Test 3: Vérifier les Accès par Site

```sql
SELECT
  u.full_name,
  mc.name AS mining_company,
  umca.access_level,
  umca.is_primary,
  umca.is_active
FROM user_mining_company_access umca
JOIN user_profiles u ON u.id = umca.user_id
JOIN mining_companies mc ON mc.id = umca.mining_company_id
WHERE umca.is_active = true;
```

### Test 4: Test de la Fonction get_user_dashboard_stats

```sql
-- Remplacer USER_ID par un vrai ID d'utilisateur
SELECT get_user_dashboard_stats('USER_ID'::uuid);
```

### Test 5: Test de la Vue user_profiles_with_access

```sql
SELECT
  full_name,
  email,
  accessible_sites_count,
  login_count_30_days,
  activity_count_30_days,
  accessible_sites
FROM user_profiles_with_access
LIMIT 10;
```

---

## Configuration Recommandée

### 1. Variables d'Environnement

Aucune nouvelle variable nécessaire - utilise les existantes:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 2. Permissions

S'assurer que le rôle `authenticated` a accès aux nouvelles tables via RLS.

### 3. Monitoring

Considérer l'ajout de:
- Alerte si nombre de connexions échouées > 10/heure
- Alerte si compte verrouillé
- Dashboard pour visualiser les stats d'utilisation

---

## Prochaines Étapes

1. **Appliquer la migration SQL** (fichier prêt)
2. **Créer les composants UI** (specs dans USER_MANAGEMENT_PROFESSIONAL_REDESIGN.md)
3. **Intégrer le logging** dans tous les services existants
4. **Tester** chaque fonctionnalité
5. **Build** et vérifier absence de régressions
6. **Former** les administrateurs sur les nouvelles fonctionnalités

---

## Support

Pour toute question ou problème:
1. Vérifier les logs Supabase
2. Consulter USER_MANAGEMENT_PROFESSIONAL_REDESIGN.md pour les spécifications complètes
3. Tester les fonctions SQL directement dans SQL Editor
