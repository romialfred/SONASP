# 🎯 Guide d'Implémentation - Module de Paramétrage des Ventes d'Or

## Vue d'ensemble

Ce module permet de configurer des règles de vente spécifiques pour chaque couple Mine-Client, incluant :
- Clients autorisés par mine
- Pourcentage maximum de stock par transaction
- Méthode de vente (standard, consignation, vente à terme, spot)
- Répartition des frais de raffinage et transport

## 📁 Fichiers Créés

### 1. Base de Données
- **GOLD_SALES_SETTINGS_MIGRATION.sql** - Migration SQL complète

### 2. Services
- **src/services/goldSalesSettingsService.ts** - Service de gestion des paramètres

### 3. Composants
- **src/pages/admin/GoldSalesSettingsPage.tsx** - Page d'administration
- **src/components/admin/GoldSalesSettingForm.tsx** - Formulaire de configuration

## 🚀 Étape 1 : Appliquer la Migration SQL

### Instructions

1. Allez sur Supabase: https://boolqagzdqbahqnpawpb.supabase.co
2. Cliquez sur **SQL Editor** → **New Query**
3. Copiez **tout** le contenu du fichier `GOLD_SALES_SETTINGS_MIGRATION.sql`
4. Exécutez la requête
5. Vérifiez les messages de confirmation

### Ce qui est créé

La migration crée :
- ✅ Table `gold_sales_settings`
- ✅ Vue `gold_sales_settings_view` (avec jointures)
- ✅ Fonction `get_authorized_customers_for_mine()`
- ✅ Fonction `check_sale_authorization()`
- ✅ Politiques RLS pour la sécurité
- ✅ Triggers pour `updated_at`

## 🔗 Étape 2 : Ajouter la Route dans le Menu

### Fichier à modifier : `src/components/layout/Sidebar.tsx`

Ajoutez cette entrée dans le menu Administration :

```typescript
{
  label: 'Gold Sales Settings',
  icon: Settings,
  path: '/admin/gold-sales-settings',
  roles: ['management', 'admin']
}
```

### Exemple complet du menu Administration :

```typescript
{
  label: 'Administration',
  icon: ShieldAlert,
  items: [
    {
      label: 'User Management',
      icon: Users,
      path: '/admin/users',
      roles: ['admin']
    },
    {
      label: 'Gold Sales Settings', // <- NOUVELLE ENTRÉE
      icon: Settings,
      path: '/admin/gold-sales-settings',
      roles: ['management', 'admin']
    },
    {
      label: 'System Settings',
      icon: Settings,
      path: '/admin/settings',
      roles: ['admin']
    }
  ]
}
```

## 🛣️ Étape 3 : Ajouter la Route dans React Router

### Fichier à modifier : `src/App.tsx` (ou votre fichier de routes)

Ajoutez cette route :

```typescript
import GoldSalesSettingsPage from '@/pages/admin/GoldSalesSettingsPage';

// Dans votre configuration de routes :
<Route
  path="/admin/gold-sales-settings"
  element={<GoldSalesSettingsPage />}
/>
```

## 💼 Étape 4 : Intégration dans le Module de Vente

### 4.1 Filtrer les Clients Autorisés

Modifiez le fichier `src/pages/sales/SaleCreate.tsx` (ou équivalent) :

```typescript
import { getAuthorizedCustomersForMine } from '@/services/goldSalesSettingsService';

// Dans votre composant :
const [authorizedCustomers, setAuthorizedCustomers] = useState([]);
const [miningCompanyId, setMiningCompanyId] = useState('');

// Charger les clients autorisés quand une mine est sélectionnée
useEffect(() => {
  if (miningCompanyId) {
    loadAuthorizedCustomers();
  }
}, [miningCompanyId]);

async function loadAuthorizedCustomers() {
  const result = await getAuthorizedCustomersForMine(miningCompanyId);

  if (result.success) {
    if (result.data.length > 0) {
      // Des paramètres existent : utiliser seulement les clients autorisés
      setAuthorizedCustomers(result.data.map(c => ({
        id: c.customer_id,
        name: c.customer_name,
        settings: {
          max_stock_percentage: c.max_stock_percentage,
          sale_method: c.sale_method,
          refining_fees_paid_by_customer: c.refining_fees_paid_by_customer,
          transport_fees_paid_by_customer: c.transport_fees_paid_by_customer
        }
      })));
    } else {
      // Aucun paramètre : comportement par défaut (tous les clients)
      loadAllCustomers();
    }
  }
}
```

### 4.2 Vérifier l'Autorisation de Vente

Avant de créer une vente :

```typescript
import { checkSaleAuthorization } from '@/services/goldSalesSettingsService';

async function handleSubmitSale() {
  // Vérifier l'autorisation
  const authResult = await checkSaleAuthorization(
    miningCompanyId,
    customerId,
    quantityOz,
    availableStockOz
  );

  if (!authResult.success) {
    // Erreur technique
    showError(authResult.error.message);
    return;
  }

  const authorization = authResult.data;

  if (!authorization.is_authorized) {
    // Vente non autorisée
    showWarning(
      `Vente refusée: ${authorization.reason}`,
      `Maximum autorisé: ${authorization.max_allowed_oz.toFixed(2)} oz`
    );
    return;
  }

  // Vente autorisée : appliquer les paramètres
  const settings = authorization.settings;

  if (settings) {
    // Appliquer la méthode de vente
    saleData.sale_method = settings.sale_method;

    // Appliquer la répartition des frais
    if (settings.refining_fees_paid_by_customer) {
      saleData.refining_fees_charged_to_customer = true;
    }

    if (settings.transport_fees_paid_by_customer) {
      saleData.transport_fees_charged_to_customer = true;
    }
  }

  // Procéder à la création de la vente
  await createSale(saleData);
}
```

### 4.3 Afficher les Informations dans le Formulaire

```typescript
// Afficher un message si des restrictions s'appliquent
{selectedCustomerSettings && (
  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h4 className="font-semibold text-blue-900 mb-2">
      Paramètres de vente configurés
    </h4>
    <ul className="text-sm text-blue-800 space-y-1">
      <li>
        ✓ Maximum autorisé: {selectedCustomerSettings.max_stock_percentage}% du stock
        ({(availableStock * selectedCustomerSettings.max_stock_percentage / 100).toFixed(2)} oz)
      </li>
      <li>
        ✓ Méthode: {selectedCustomerSettings.sale_method}
      </li>
      <li>
        ✓ Frais de raffinage: {selectedCustomerSettings.refining_fees_paid_by_customer ? 'Client' : 'Vendeur'}
      </li>
      <li>
        ✓ Frais de transport: {selectedCustomerSettings.transport_fees_paid_by_customer ? 'Client' : 'Vendeur'}
      </li>
    </ul>
  </div>
)}
```

## 🔄 Comportement par Défaut (Rétrocompatibilité)

### Important : Pas de Régression

Si aucune configuration n'existe pour un couple Mine-Client :
- ✅ **Tous les clients** restent disponibles
- ✅ **100% du stock** peut être vendu
- ✅ Méthode de vente : **standard**
- ✅ Frais : à la charge du **vendeur** (comportement actuel)

### Test de Rétrocompatibilité

```typescript
// La fonction check_sale_authorization retourne :
{
  is_authorized: true,
  reason: "No configuration found - default behavior",
  max_allowed_oz: available_stock_oz, // Tout le stock
  settings: null // Pas de paramètres spéciaux
}
```

## 📊 Utilisation de la Page d'Administration

### Créer une Configuration

1. Accédez à **Administration > Gold Sales Settings**
2. Cliquez sur **"Nouveau paramétrage"**
3. Remplissez le formulaire :
   - **Mine** : Sélectionnez la mine
   - **Client** : Sélectionnez le client autorisé
   - **Max Stock %** : Pourcentage maximum (1-100)
   - **Méthode de vente** : Standard, Consignation, etc.
   - **Frais** : Cochez si à la charge du client
   - **Notes** : Commentaires optionnels
4. Cliquez sur **"Créer"**

### Modifier une Configuration

1. Cliquez sur l'icône ✏️ (Edit) dans la ligne
2. Modifiez les valeurs
3. Cliquez sur **"Mettre à jour"**

### Désactiver Temporairement

1. Éditez la configuration
2. Décochez **"Configuration active"**
3. Sauvegardez → La configuration sera ignorée sans être supprimée

### Supprimer une Configuration

1. Cliquez sur l'icône 🗑️ (Trash)
2. Confirmez la suppression

## 🔐 Sécurité et Permissions

### Accès à la Page d'Administration

- **Lecture** : Tous les utilisateurs authentifiés
- **Création/Modification** : Management et Admin uniquement
- **Suppression** : Admin uniquement

### Row Level Security (RLS)

Toutes les opérations sont protégées par RLS au niveau de la base de données.

## 🧪 Tests Recommandés

### Test 1 : Sans Configuration (Défaut)

1. Ne créez aucune configuration
2. Tentez de créer une vente
3. ✅ Tous les clients doivent être disponibles
4. ✅ 100% du stock peut être vendu

### Test 2 : Avec Configuration Restrictive

1. Créez une config : Mine A → Client X, Max 50%
2. Stock disponible : 100 oz
3. Tentez de vendre 60 oz au Client X
4. ✅ Doit être refusé avec message clair
5. ✅ Peut vendre 50 oz maximum

### Test 3 : Frais à la Charge du Client

1. Créez une config avec frais → Client
2. Créez une vente
3. ✅ Les frais doivent être ajoutés au calcul du client

### Test 4 : Client Non Autorisé

1. Créez une config : Mine A → Client X seulement
2. Tentez de vendre à Client Y
3. ✅ Client Y ne doit pas apparaître dans la liste

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez que la migration SQL a bien été appliquée
2. Vérifiez les logs de la console navigateur
3. Consultez la section "Détails techniques" des messages d'erreur

## ✅ Checklist de Déploiement

- [ ] Migration SQL appliquée avec succès
- [ ] Route ajoutée dans le menu Sidebar
- [ ] Route ajoutée dans React Router
- [ ] Tests de création/modification/suppression
- [ ] Tests d'intégration avec module de vente
- [ ] Tests de rétrocompatibilité
- [ ] Documentation utilisateur créée
- [ ] Formation des utilisateurs planifiée
