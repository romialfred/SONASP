# Système de Gestion des Utilisateurs - Refonte Professionnelle

## Vue d'Ensemble

Ce document décrit la refonte complète du module de gestion des utilisateurs pour Gold Shipper, incluant:

1. **Historique des connexions** - Tracking complet de toutes les sessions
2. **Historique des actions** - Audit trail détaillé de toutes les activités
3. **Gestion des accès par site minier** - Contrôle granulaire par mining company
4. **Interface utilisateur moderne** - Design professionnel avec onglets et visualisations
5. **Rapports et statistiques** - Analytics sur l'utilisation du système

---

## Architecture de la Base de Données

### 1. Table `user_profiles` (Enrichie)

**Nouvelles colonnes ajoutées:**

```sql
- created_by UUID           -- Qui a créé cet utilisateur
- updated_by UUID           -- Qui a modifié cet utilisateur
- job_title TEXT            -- Titre du poste
- department TEXT           -- Département
- manager_id UUID           -- Manager direct
- profile_picture_url TEXT  -- Photo de profil
- timezone TEXT             -- Fuseau horaire
- language_preference TEXT  -- fr/en
- last_activity_at TIMESTAMPTZ
- account_locked BOOLEAN
- failed_login_attempts INTEGER
```

### 2. Table `user_login_history` (Nouvelle)

**Colonnes:**
```sql
- id UUID PRIMARY KEY
- user_id UUID → user_profiles
- login_timestamp TIMESTAMPTZ
- logout_timestamp TIMESTAMPTZ
- session_duration_seconds INTEGER
- ip_address INET
- user_agent TEXT
- device_type TEXT (desktop/mobile/tablet)
- browser TEXT
- operating_system TEXT
- location_country TEXT
- location_city TEXT
- login_method TEXT (email/sso/api_key)
- success BOOLEAN
- failure_reason TEXT
- two_factor_verified BOOLEAN
```

**Index:**
- user_id
- login_timestamp DESC
- ip_address
- success

**RLS:**
- Management: Vue complète
- Users: Vue de leur propre historique uniquement

### 3. Table `user_activity_logs` (Nouvelle)

**Colonnes:**
```sql
- id UUID PRIMARY KEY
- user_id UUID → user_profiles
- action_type TEXT (create/update/delete/view/export/approve/reject)
- module_name TEXT (production/sales/shipping/inventory/...)
- resource_type TEXT (batch/sale/shipment/payment/...)
- resource_id TEXT
- description TEXT
- changes_summary JSONB (avant/après)
- ip_address INET
- user_agent TEXT
- status TEXT (success/failed/pending)
- error_message TEXT
- duration_ms INTEGER
- created_at TIMESTAMPTZ
```

**Index:**
- user_id
- created_at DESC
- action_type
- module_name
- resource_type + resource_id

**RLS:**
- Management: Vue complète
- Users: Vue de leurs propres actions

### 4. Table `user_mining_company_access` (Nouvelle)

**Colonnes:**
```sql
- id UUID PRIMARY KEY
- user_id UUID → user_profiles
- mining_company_id UUID → mining_companies
- access_level TEXT (read/write/admin/full)
- is_primary BOOLEAN (site principal)
- granted_by UUID → user_profiles
- granted_at TIMESTAMPTZ
- expires_at TIMESTAMPTZ (NULL = jamais)
- notes TEXT
- is_active BOOLEAN
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

**Contraintes:**
- UNIQUE(user_id, mining_company_id, is_active) - Un seul accès actif par site

**Index:**
- user_id
- mining_company_id
- is_active

**RLS:**
- Management: Gestion complète
- Users: Vue de leurs propres accès

### 5. Table `user_sessions` (Nouvelle)

**Colonnes:**
```sql
- id UUID PRIMARY KEY
- user_id UUID → user_profiles
- session_token TEXT UNIQUE
- ip_address INET
- user_agent TEXT
- device_type TEXT
- browser TEXT
- location_country TEXT
- last_activity_at TIMESTAMPTZ
- expires_at TIMESTAMPTZ
- is_active BOOLEAN
- created_at TIMESTAMPTZ
```

---

## Fonctions SQL

### 1. `log_user_activity()`

```sql
log_user_activity(
  p_user_id UUID,
  p_action_type TEXT,
  p_module_name TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_changes_summary JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID
```

**Utilisation:**
```typescript
await supabase.rpc('log_user_activity', {
  p_user_id: userId,
  p_action_type: 'create',
  p_module_name: 'sales',
  p_resource_type: 'sale',
  p_resource_id: saleId,
  p_description: 'Created new sale for customer XYZ',
  p_changes_summary: { amount: 1000000, status: 'pending' }
});
```

### 2. `log_user_login()`

```sql
log_user_login(
  p_user_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_failure_reason TEXT DEFAULT NULL,
  p_two_factor_verified BOOLEAN DEFAULT false
) RETURNS UUID
```

**Utilisation:**
```typescript
await supabase.rpc('log_user_login', {
  p_user_id: userId,
  p_ip_address: req.ip,
  p_user_agent: req.headers['user-agent'],
  p_success: true,
  p_two_factor_verified: true
});
```

### 3. `get_user_dashboard_stats()`

```sql
get_user_dashboard_stats(p_user_id UUID) RETURNS JSON
```

**Retourne:**
```json
{
  "total_logins": 150,
  "logins_last_30_days": 25,
  "total_actions": 1250,
  "actions_last_30_days": 320,
  "accessible_sites": 3,
  "last_login": "2025-12-17T10:30:00Z",
  "account_status": {
    "is_active": true,
    "account_locked": false,
    "two_factor_enabled": true,
    "failed_login_attempts": 0
  }
}
```

---

## Vues SQL

### 1. `user_profiles_with_access`

Vue enrichie combinant profil utilisateur + accès sites + statistiques

**Colonnes:**
- Toutes les colonnes de user_profiles
- accessible_sites_count INTEGER
- accessible_sites JSON (liste des sites avec détails)
- last_successful_login TIMESTAMPTZ
- login_count_30_days INTEGER
- activity_count_30_days INTEGER

### 2. `user_activity_summary`

Résumé de l'activité par utilisateur

**Colonnes:**
- user_id, full_name, email, role
- total_actions INTEGER
- actions_last_7_days INTEGER
- actions_last_30_days INTEGER
- create_actions INTEGER
- update_actions INTEGER
- delete_actions INTEGER
- view_actions INTEGER
- approve_actions INTEGER
- top_modules_30_days JSON
- last_action_at TIMESTAMPTZ

---

## Interface Utilisateur - Design Refondé

### Page Principale: `/admin/users`

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ 👥 Gestion des Utilisateurs                   [+ Créer] │
│ Gérer les comptes, permissions et accès             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🔍 [Rechercher...]  [▼ Rôle: Tous] [▼ Statut: Tous]│
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Photo │ Utilisateur    │ Rôle    │ Sites │ Actions │
│  ├───────┼───────────────┼─────────┼───────┼─────────┤
│  │  👤   │ John Doe      │ 🛡️ Mgt  │  3   │ [•••]   │
│  │       │ john@gold.ci  │         │      │         │
│  │       │ 📱 +225...    │         │      │         │
│  │       │ 🟢 Actif • Dernière connexion: 5m │      │
│  ├───────┼───────────────┼─────────┼───────┼─────────┤
│  │  ...                                           │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Statistiques en haut:**
- Total Utilisateurs: 45
- Actifs: 42
- Connectés maintenant: 12
- Nouveaux ce mois: 3

### Page Détails Utilisateur: `/admin/users/:id`

**Onglets:**

#### 1️⃣ Onglet "Vue d'ensemble"
```
┌─────────────────────────────────────────┐
│ 👤 John Doe                    [⚙️ Modifier] │
│ john.doe@goldshipper.com               │
│ 📱 +225 0767 344 711                   │
├─────────────────────────────────────────┤
│                                         │
│ 📊 Statistiques                         │
│ ┌──────────┬──────────┬──────────┐      │
│ │ 150      │ 1,250    │ 3        │      │
│ │ Connexions│ Actions │ Sites    │      │
│ └──────────┴──────────┴──────────┘      │
│                                         │
│ 👔 Informations Professionnelles       │
│ • Poste: Directeur des Opérations      │
│ • Département: Production               │
│ • Manager: Jane Smith                   │
│                                         │
│ 🏢 Sites Miniers Accessibles           │
│ ┌─────────────────────────────────┐    │
│ │ ⭐ YANFOLILA (Mali) - Accès: Full│    │
│ │    MORILA (Mali) - Accès: Read  │    │
│ │    TONGON (CI) - Accès: Write   │    │
│ └─────────────────────────────────┘    │
│                                         │
│ 🔒 Sécurité                             │
│ • 2FA: ✅ Activé                        │
│ • Dernier changement mot de passe: 30j │
│ • Tentatives échouées: 0                │
│ • Compte: 🟢 Actif, Déverrouillé       │
└─────────────────────────────────────────┘
```

#### 2️⃣ Onglet "Historique des Connexions"
```
┌─────────────────────────────────────────┐
│ 🔐 Historique des Connexions           │
├─────────────────────────────────────────┤
│ [▼ 30 derniers jours] [🔍 Filtrer]      │
│                                         │
│ Timeline View:                          │
│ ┌─────────────────────────────────┐    │
│ │ 📅 17 Déc 2025                  │    │
│ │                                 │    │
│ │ 10:30 ✅ Connexion réussie     │    │
│ │ 💻 Windows • Chrome             │    │
│ │ 🌍 Abidjan, Côte d'Ivoire      │    │
│ │ 🔗 196.168.1.100                │    │
│ │ ⏱️ Session: 2h 15m              │    │
│ │                                 │    │
│ │ 08:45 ✅ Connexion réussie     │    │
│ │ 📱 Android • Mobile Chrome      │    │
│ │ 🌍 Bamako, Mali                 │    │
│ │ 🔗 196.168.1.50                 │    │
│ │ ⏱️ Session: 45m                 │    │
│ ├─────────────────────────────────┤    │
│ │ 📅 16 Déc 2025                  │    │
│ │ ...                             │    │
│ └─────────────────────────────────┘    │
│                                         │
│ 📊 Statistiques:                        │
│ • Connexions ce mois: 45                │
│ • Dispositifs uniques: 3                │
│ • Emplacements: Abidjan (70%), Bamako  │
│ • Heures préférées: 8h-12h, 14h-18h    │
└─────────────────────────────────────────┘
```

#### 3️⃣ Onglet "Historique des Actions"
```
┌─────────────────────────────────────────┐
│ 📋 Historique des Actions               │
├─────────────────────────────────────────┤
│ [▼ Module] [▼ Type] [▼ Période]        │
│                                         │
│ Filtres:                                │
│ ☑️ Create  ☑️ Update  ☑️ Delete         │
│ ☑️ Approve ☑️ Export                    │
│                                         │
│ ┌─────────────────────────────────┐    │
│ │ 🕐 17 Déc 10:45                 │    │
│ │ ✅ APPROVE • Module: Sales      │    │
│ │ Approved sale #SAL-2025-001     │    │
│ │ Amount: $125,000                │    │
│ │ [Voir détails]                  │    │
│ ├─────────────────────────────────┤    │
│ │ 🕐 17 Déc 10:30                 │    │
│ │ ✏️ UPDATE • Module: Production  │    │
│ │ Updated batch #BAT-2025-150     │    │
│ │ Changed status: prepared→shipped│    │
│ │ [Voir détails]                  │    │
│ ├─────────────────────────────────┤    │
│ │ 🕐 17 Déc 09:15                 │    │
│ │ ➕ CREATE • Module: Shipping    │    │
│ │ Created shipment #SHP-2025-080  │    │
│ │ Destination: Rand Refinery      │    │
│ │ [Voir détails]                  │    │
│ └─────────────────────────────────┘    │
│                                         │
│ 📊 Actions par module (30j):            │
│ ▓▓▓▓▓▓▓▓▓▓ Sales (45%)                 │
│ ▓▓▓▓▓▓ Production (30%)                │
│ ▓▓▓▓ Shipping (20%)                    │
│ ▓▓ Inventory (5%)                      │
└─────────────────────────────────────────┘
```

#### 4️⃣ Onglet "Permissions"
```
┌─────────────────────────────────────────┐
│ 🔐 Permissions et Accès                 │
├─────────────────────────────────────────┤
│                                         │
│ Permissions par Module:                 │
│                                         │
│ ▼ 📦 Production                         │
│   ☑️ Voir  ☑️ Créer  ☑️ Modifier  ☐ Supprimer │
│   ☑️ Approuver                          │
│                                         │
│ ▼ 💰 Sales                              │
│   ☑️ Voir  ☑️ Créer  ☑️ Modifier  ☐ Supprimer │
│   ☑️ Approuver                          │
│                                         │
│ ▼ 🚚 Shipping                           │
│   ☑️ Voir  ☑️ Créer  ☑️ Modifier  ☐ Supprimer │
│   ☐ Approuver                           │
│                                         │
│ ▼ 📊 Inventory                          │
│   ☑️ Voir  ☐ Créer  ☐ Modifier  ☐ Supprimer │
│   ☐ Approuver                           │
│                                         │
│ [💾 Enregistrer les permissions]        │
└─────────────────────────────────────────┘
```

#### 5️⃣ Onglet "Accès aux Sites"
```
┌─────────────────────────────────────────┐
│ 🏢 Gestion des Accès par Site          │
├─────────────────────────────────────────┤
│ [+ Ajouter un accès]                    │
│                                         │
│ ┌─────────────────────────────────┐    │
│ │ ⭐ YANFOLILA (Mali)             │    │
│ │ Code: YANF • Accès: Full        │    │
│ │ 🟢 Actif • Site principal       │    │
│ │ Accordé par: Admin • 15/01/2025 │    │
│ │ Expire: Jamais                  │    │
│ │ [Modifier] [Révoquer]           │    │
│ ├─────────────────────────────────┤    │
│ │ MORILA (Mali)                   │    │
│ │ Code: MORL • Accès: Read        │    │
│ │ 🟢 Actif                        │    │
│ │ Accordé par: Manager • 20/02/25 │    │
│ │ Expire: 31/12/2025              │    │
│ │ [Modifier] [Révoquer]           │    │
│ ├─────────────────────────────────┤    │
│ │ TONGON (Côte d'Ivoire)         │    │
│ │ Code: TONG • Accès: Write       │    │
│ │ 🟢 Actif                        │    │
│ │ Accordé par: Admin • 10/03/2025 │    │
│ │ Expire: Jamais                  │    │
│ │ [Modifier] [Révoquer]           │    │
│ └─────────────────────────────────┘    │
│                                         │
│ 💡 Niveaux d'accès:                     │
│ • Read: Lecture seule                   │
│ • Write: Lecture + Modification         │
│ • Admin: Full + Gestion utilisateurs    │
│ • Full: Tous les droits                 │
└─────────────────────────────────────────┘
```

#### 6️⃣ Onglet "Sessions Actives"
```
┌─────────────────────────────────────────┐
│ 💻 Sessions Actives                     │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────┐    │
│ │ 🟢 Session Active               │    │
│ │ 💻 Windows 11 • Chrome 120      │    │
│ │ 🌍 Abidjan, Côte d'Ivoire      │    │
│ │ 🔗 196.168.1.100                │    │
│ │ ⏰ Démarrée: 10:30 (2h 15m)     │    │
│ │ 🔄 Dernière activité: 2m        │    │
│ │ [🚪 Déconnecter]                │    │
│ ├─────────────────────────────────┤    │
│ │ 🟢 Session Active               │    │
│ │ 📱 Android • Mobile Chrome      │    │
│ │ 🌍 Bamako, Mali                 │    │
│ │ 🔗 196.168.1.50                 │    │
│ │ ⏰ Démarrée: 08:45 (3h 45m)     │    │
│ │ 🔄 Dernière activité: 15m       │    │
│ │ [🚪 Déconnecter]                │    │
│ └─────────────────────────────────┘    │
│                                         │
│ [🚪 Déconnecter toutes les sessions]   │
└─────────────────────────────────────────┘
```

---

## Composants TypeScript

### 1. UserDetailsPage.tsx (Nouveau)

```typescript
interface UserDetailsTab {
  id: 'overview' | 'login-history' | 'activity-history' |
       'permissions' | 'site-access' | 'sessions';
  label: string;
  icon: LucideIcon;
}

const TABS: UserDetailsTab[] = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: User },
  { id: 'login-history', label: 'Connexions', icon: LogIn },
  { id: 'activity-history', label: 'Actions', icon: Activity },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'site-access', label: 'Sites', icon: Building2 },
  { id: 'sessions', label: 'Sessions', icon: Monitor },
];
```

### 2. LoginHistoryTab.tsx (Nouveau)

Affiche l'historique des connexions avec timeline

### 3. ActivityHistoryTab.tsx (Nouveau)

Affiche l'historique des actions avec filtres

### 4. SiteAccessTab.tsx (Nouveau)

Gère les accès par site minier

### 5. Services TypeScript

```typescript
// userActivityService.ts
export const userActivityService = {
  async logActivity(params: {
    actionType: string;
    moduleName: string;
    resourceType: string;
    resourceId?: string;
    description: string;
    changesSummary?: any;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc('log_user_activity', {
      p_user_id: user.id,
      p_action_type: params.actionType,
      p_module_name: params.moduleName,
      p_resource_type: params.resourceType,
      p_resource_id: params.resourceId,
      p_description: params.description,
      p_changes_summary: params.changesSummary,
    });
  },

  async getActivityHistory(userId: string, filters: {
    moduleNames?: string[];
    actionTypes?: string[];
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Activity[]> {
    let query = supabase
      .from('user_activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters.moduleNames?.length) {
      query = query.in('module_name', filters.moduleNames);
    }
    if (filters.actionTypes?.length) {
      query = query.in('action_type', filters.actionTypes);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
};
```

---

## Utilisation dans l'Application

### Logging Automatique

```typescript
// Dans chaque service, ajouter logging automatique
// Exemple dans salesService.ts:

async createSale(data: SaleData): Promise<Sale> {
  // Créer la vente
  const { data: sale, error } = await supabase
    .from('gold_sales')
    .insert(data)
    .select()
    .single();

  if (error) throw error;

  // Logger l'action
  await userActivityService.logActivity({
    actionType: 'create',
    moduleName: 'sales',
    resourceType: 'sale',
    resourceId: sale.id,
    description: `Created sale ${sale.reference_number} for ${sale.customer_name}`,
    changesSummary: {
      amount_usd: sale.amount_usd,
      quantity_oz: sale.quantity_oz,
      status: sale.status,
    },
  });

  return sale;
}
```

### Hook de Logging Global

```typescript
// hooks/useActivityLogger.ts
export function useActivityLogger() {
  const logActivity = useCallback(async (params) => {
    await userActivityService.logActivity(params);
  }, []);

  return { logActivity };
}

// Utilisation:
const { logActivity } = useActivityLogger();

const handleApprove = async () => {
  await approveSale(saleId);
  await logActivity({
    actionType: 'approve',
    moduleName: 'sales',
    resourceType: 'sale',
    resourceId: saleId,
    description: `Approved sale ${saleReference}`,
  });
};
```

---

## Règles Métier

### Gestion des Accès par Site

1. **Site Principal** - Un utilisateur doit avoir UN site principal
2. **Accès Multiple** - Un utilisateur peut avoir accès à plusieurs sites
3. **Niveaux d'Accès:**
   - **Read**: Voir les données du site
   - **Write**: Read + Modifier/Créer
   - **Admin**: Write + Gérer les utilisateurs du site
   - **Full**: Tous les droits

4. **Expiration** - Les accès peuvent expirer automatiquement
5. **Révocation** - Management peut révoquer à tout moment

### Sécurité des Connexions

1. **Blocage après 5 échecs** - Compte automatiquement verrouillé
2. **2FA Obligatoire** - Pour rôle Management
3. **Sessions Multiples** - Autorisées mais trackées
4. **Timeout Inactivité** - 2h sans activité = déconnexion

### Audit Trail

1. **Immuable** - Logs ne peuvent jamais être supprimés
2. **Rétention** - Conservation 2 ans minimum
3. **Export** - Management peut exporter les logs
4. **Anonymisation** - Pour conformité RGPD si nécessaire

---

## Checklist d'Implémentation

### Phase 1: Base de Données ✅
- [x] Migration SQL complète
- [x] Tables: login_history, activity_logs, mining_access, sessions
- [x] Fonctions: log_activity, log_login, get_stats
- [x] Vues: profiles_with_access, activity_summary
- [x] RLS policies sur toutes les tables

### Phase 2: Services TypeScript
- [ ] userActivityService.ts
- [ ] userLoginService.ts
- [ ] userMiningAccessService.ts
- [ ] userSessionService.ts

### Phase 3: Composants UI
- [ ] UserDetailsPage.tsx (page principale)
- [ ] LoginHistoryTab.tsx
- [ ] ActivityHistoryTab.tsx
- [ ] SiteAccessTab.tsx
- [ ] SessionsTab.tsx
- [ ] Améliorer UserManagementPage.tsx

### Phase 4: Intégration
- [ ] Hook useActivityLogger
- [ ] Ajouter logging dans tous les services existants
- [ ] AuthContext - tracking login/logout
- [ ] Middleware pour tracking automatique

### Phase 5: Tests
- [ ] Tests RLS policies
- [ ] Tests fonctions SQL
- [ ] Tests UI components
- [ ] Tests end-to-end

---

## Bénéfices

1. **Transparence Totale** - Audit trail complet de toutes les actions
2. **Sécurité Renforcée** - Tracking des connexions suspectes
3. **Conformité** - Répond aux exigences réglementaires
4. **Contrôle Granulaire** - Accès par site minier
5. **Expérience Professionnelle** - Interface moderne et intuitive
6. **Analytics** - Statistiques d'utilisation du système
