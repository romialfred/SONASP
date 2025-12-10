# 🛡️ Protection contre les Doublons - Gold Sales Settings

## 📋 Vue d'ensemble

Cette mise à jour empêche la création de configurations de vente en double pour la même combinaison Mine-Client. Une seule configuration est autorisée par couple Mine → Client.

## 🎯 Fonctionnalités

### 1. **Contrainte de Base de Données**
- Contrainte unique sur `(mining_company_id, customer_id)`
- Empêche l'insertion de doublons au niveau de la base de données
- Nettoyage automatique des doublons existants (garde le plus récent)

### 2. **Validation Côté Frontend**
- Vérification en temps réel lors de la sélection Mine + Client
- Message d'avertissement visuel si un doublon est détecté
- Désactivation automatique du bouton d'enregistrement
- Indication claire pour l'utilisateur

### 3. **Double Validation**
- Validation avant insertion dans le service
- Message d'erreur explicite si tentative de création de doublon
- Protection complète contre les erreurs utilisateur

## 🚀 Installation

### Étape 1 : Appliquer la Migration SQL

1. **Ouvrir Supabase Dashboard**
   - Aller sur https://supabase.com
   - Sélectionner votre projet
   - Aller dans **SQL Editor**

2. **Exécuter la Migration**
   - Ouvrir le fichier `ADD_UNIQUE_CONSTRAINT_GOLD_SALES.sql`
   - Copier tout le contenu
   - Coller dans SQL Editor
   - Cliquer sur **Run** (ou appuyer sur Ctrl+Enter)

3. **Vérifier les Résultats**
   Dans les logs, vous devriez voir :
   ```
   ✅ Aucun doublon trouvé
   (ou)
   ✅ Total de X doublons supprimés

   ✅ Contrainte unique ajoutée: gold_sales_settings_mining_company_customer_unique
   ✅ ✅ MIGRATION RÉUSSIE - Contrainte unique et index créés
   ```

### Étape 2 : Vérification

Après l'application de la migration, vérifiez que :

1. **La contrainte existe**
   ```sql
   SELECT conname, contype
   FROM pg_constraint
   WHERE conname = 'gold_sales_settings_mining_company_customer_unique';
   ```
   Résultat attendu : 1 ligne avec `contype = 'u'`

2. **L'index existe**
   ```sql
   SELECT indexname
   FROM pg_indexes
   WHERE indexname = 'idx_gold_sales_settings_mining_customer';
   ```
   Résultat attendu : 1 ligne

## 🎨 Interface Utilisateur

### Comportement lors de la Création

1. **Sélection Mine et Client**
   - L'utilisateur sélectionne une mine
   - L'utilisateur sélectionne un client
   - Le système vérifie automatiquement si la combinaison existe déjà

2. **Si Doublon Détecté**
   - 🔴 Message d'avertissement rouge s'affiche :
     ```
     ⚠️ Une configuration existe déjà pour [Mine] → [Client].
     Vous ne pouvez pas créer de doublon.
     ```
   - 🚫 Le bouton "Créer le paramétrage" est désactivé
   - 💡 Suggestion : Modifier la configuration existante ou choisir une autre combinaison

3. **Si Aucun Doublon**
   - ✅ Aucun message d'avertissement
   - ✅ Bouton "Créer le paramétrage" activé
   - ✅ Création autorisée

### Comportement lors de la Modification

En mode édition, la vérification **exclut** l'enregistrement actuel.
Cela permet de modifier les autres paramètres sans être bloqué.

## 🔒 Sécurité et Validation

### Niveaux de Protection

1. **Niveau Frontend (UX)**
   - Vérification en temps réel
   - Message d'avertissement
   - Désactivation du bouton

2. **Niveau Service (Business Logic)**
   - Validation avant insertion
   - Retour d'erreur explicite

3. **Niveau Base de Données (Data Integrity)**
   - Contrainte unique
   - Protection ultime contre les doublons

### Messages d'Erreur

#### Frontend (Avertissement Préventif)
```
⚠️ Une configuration existe déjà pour [Mine] → [Client].
Vous ne pouvez pas créer de doublon.
```

#### Service (Si validation contournée)
```
Une configuration existe déjà pour ce couple Mine-Client.
Vous ne pouvez pas créer de doublon.
```

#### Base de Données (Si contrainte violée)
```
Une configuration existe déjà pour ce couple Mine-Client.
```

## 📊 Exemples

### Exemple 1 : Création Valide
```
Mine: Dugbe (DGB)
Client: YHAN Henri AKA
✅ Aucune configuration existante → Création autorisée
```

### Exemple 2 : Tentative de Doublon
```
Mine: Dugbe (DGB)
Client: Mansa Resources SA
❌ Configuration déjà existante → Création bloquée
```

Résultat :
- Message d'avertissement rouge affiché
- Bouton désactivé
- Suggestion de modifier la configuration existante

## 🧪 Tests

### Test 1 : Création Normale
1. Aller dans **Admin → Gold Sales Settings**
2. Cliquer sur "Créer le paramétrage"
3. Sélectionner une mine et un client non encore configurés
4. ✅ Aucun avertissement
5. Remplir le formulaire
6. ✅ Création réussie

### Test 2 : Tentative de Doublon
1. Aller dans **Admin → Gold Sales Settings**
2. Noter une combinaison existante (ex: Dugbe → Mansa Resources)
3. Cliquer sur "Créer le paramétrage"
4. Sélectionner la même mine et le même client
5. ❌ Avertissement rouge affiché
6. ❌ Bouton "Créer le paramétrage" désactivé
7. ✅ Impossible de créer le doublon

### Test 3 : Modification Existante
1. Cliquer sur "Modifier" une configuration existante
2. ✅ Aucun avertissement (modification autorisée)
3. Modifier les paramètres (ex: pourcentage, frais)
4. ✅ Mise à jour réussie

## 🔧 Maintenance

### Vérifier l'Absence de Doublons
```sql
SELECT
  mining_company_id,
  customer_id,
  COUNT(*) as count
FROM gold_sales_settings
GROUP BY mining_company_id, customer_id
HAVING COUNT(*) > 1;
```
Résultat attendu : 0 lignes (aucun doublon)

### Lister toutes les Configurations
```sql
SELECT
  mc.name as mine,
  c.name as client,
  gss.is_active,
  gss.max_stock_percentage,
  gss.sale_method
FROM gold_sales_settings gss
JOIN mining_companies mc ON gss.mining_company_id = mc.id
JOIN customers c ON gss.customer_id = c.id
ORDER BY mc.name, c.name;
```

## 📝 Fichiers Modifiés

### Backend / Base de données
- `ADD_UNIQUE_CONSTRAINT_GOLD_SALES.sql` - Migration SQL (nouveau)

### Services
- `src/services/goldSalesSettingsService.ts`
  - Nouvelle fonction : `checkDuplicateGoldSalesSetting()`
  - Fonction `createGoldSalesSetting()` : Validation pré-insertion ajoutée

### Composants
- `src/components/admin/GoldSalesSettingFormPanel.tsx`
  - Vérification en temps réel des doublons
  - Message d'avertissement visuel
  - Désactivation du bouton si doublon

## ✅ Checklist de Déploiement

- [ ] Migration SQL appliquée dans Supabase
- [ ] Contrainte unique vérifiée
- [ ] Index créé et vérifié
- [ ] Frontend mis à jour
- [ ] Test de création normale
- [ ] Test de tentative de doublon
- [ ] Test de modification
- [ ] Documentation mise à jour

## 📞 Support

En cas de problème :

1. **Vérifier la migration** : Les logs Supabase doivent confirmer le succès
2. **Vérifier la contrainte** : Exécuter la requête de vérification
3. **Vider le cache** : Rafraîchir l'application (Ctrl+F5)
4. **Consulter les logs** : Console navigateur pour les erreurs frontend

---

**Date :** 2025-12-10
**Version :** 1.0
**Status :** ✅ Prêt pour Production
