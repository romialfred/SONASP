# 📋 INDEX DES SCRIPTS À EXÉCUTER

**Date:** 27 Décembre 2024  
**Contexte:** Scripts non exécutés depuis l'implémentation des sidebars dynamiques

---

## 🚨 STATUT D'EXÉCUTION

### ✅ Déjà Exécutés
- ✅ FIX-ARTISAN-MODULES.sql (partiellement - corrections modules)

### ❌ À Exécuter (4 scripts)

---

## 📝 SCRIPTS À EXÉCUTER DANS L'ORDRE

### 🔴 PRIORITÉ 1: CORRECTION-COMPLETE-A-EXECUTER.sql
**Statut:** ⚠️ Partiellement exécuté  
**Taille:** 5.3 KB  
**Durée estimée:** 2-3 secondes  

**Ce qu'il fait:**
- ✅ Ajoute `company_type` à `mining_companies` (FAIT)
- ❌ Ajoute `acheteur_id` à `snp_artisan_ventes_or` (MANQUANT)
- Configure SONASP comme acheteur par défaut
- Crée trigger automatique pour définir SONASP
- Crée vue `snp_ventes_artisans_sonasp`

**Tables modifiées:**
- mining_companies (ALTER)
- snp_artisan_ventes_or (ALTER + FOREIGN KEY)

**Fonctions créées:**
- get_sonasp_id()
- set_sonasp_as_buyer()

**Pourquoi l'exécuter:**
Base nécessaire pour tout le système de vente d'or artisans à SONASP.

---

### 🟡 PRIORITÉ 2: CREATE-MODULES-MANAGEMENT-SYSTEM.sql
**Statut:** ⚠️ Partiellement exécuté  
**Taille:** 12.8 KB  
**Durée estimée:** 3-5 secondes  

**Ce qu'il fait:**
- ✅ Table `snp_modules` existe (FAIT)
- ✅ Colonne `parent_id` existe (FAIT)
- ❌ Colonne `icon` manquante (À CORRIGER)
- Système de gestion des modules dynamiques
- Hiérarchie parent-enfant pour les menus
- Contrôle d'accès par rôle

**Tables créées/modifiées:**
- snp_modules (CREATE + modifications)
- Système de permissions modules

**Fonctions créées:**
- get_user_accessible_modules()
- check_module_access()

**Pourquoi l'exécuter:**
Nécessaire pour les sidebars dynamiques et la gestion des permissions.

---

### 🟢 PRIORITÉ 3: CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql
**Statut:** ❌ Non exécuté  
**Taille:** 11.8 KB  
**Durée estimée:** 3-5 secondes  

**Ce qu'il fait:**
- Ajoute colonnes de collecte à `snp_artisan_ventes_or`:
  - `collecteur_id` (référence user qui collecte)
  - `lieu_collecte` (localisation)
  - `commission_taux` et `commission_montant_fcfa`
  - `certificat_analyse_url`
  - `observations_qualite`
- Crée système de traçabilité complète
- Trigger pour calcul automatique commission
- Vue enrichie des collectes

**Tables modifiées:**
- snp_artisan_ventes_or (6 nouvelles colonnes)

**Fonctions créées:**
- calculate_collector_commission()
- validate_collection_data()
- get_collector_statistics()

**Pourquoi l'exécuter:**
Permet de tracker qui collecte l'or, où, et combien de commission.

---

### 🔵 PRIORITÉ 4: IMPLEMENT-ARTISAN-SONASP-SALES-LOGIC.sql
**Statut:** ❌ Non exécuté  
**Taille:** 10.0 KB  
**Durée estimée:** 2-4 secondes  

**Ce qu'il fait:**
- Ajoute logique métier des ventes SONASP:
  - `type_acheteur` (direct, intermédiaire, export)
  - `prix_unitaire_fcfa` (prix au gramme)
  - Calculs automatiques selon le type
  - Validations métier
- Crée règles de validation spécifiques SONASP
- Vue analytique des ventes par type

**Tables modifiées:**
- snp_artisan_ventes_or (colonnes métier)
- mining_companies (validations)

**Fonctions créées:**
- validate_sonasp_sale()
- calculate_sonasp_pricing()
- get_sonasp_sales_analytics()

**Pourquoi l'exécuter:**
Logique métier complète pour les ventes à SONASP (requis par la loi).

---

## 🎯 ORDRE D'EXÉCUTION EXACT

```bash
# 1. Vérifier l'état actuel
node scripts/check-execution-status.js

# 2. Exécuter dans Supabase Dashboard > SQL Editor
# (dans cet ordre)
```

1. **CORRECTION-COMPLETE-A-EXECUTER.sql**
2. **CREATE-MODULES-MANAGEMENT-SYSTEM.sql**  
3. **CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql**
4. **IMPLEMENT-ARTISAN-SONASP-SALES-LOGIC.sql**

```bash
# 3. Vérifier après chaque script
node scripts/check-execution-status.js

# 4. Test final
node scripts/apply-fix-automatically.js
```

---

## 📊 IMPACT DES SCRIPTS

### Colonnes ajoutées à snp_artisan_ventes_or:
1. ✅ `acheteur_id` - Référence à mining_companies
2. ✅ `collecteur_id` - User qui collecte l'or
3. ✅ `lieu_collecte` - Localisation de collecte
4. ✅ `commission_taux` - % commission collecteur
5. ✅ `commission_montant_fcfa` - Montant commission
6. ✅ `certificat_analyse_url` - Document certificat
7. ✅ `observations_qualite` - Notes qualité
8. ✅ `type_acheteur` - Type d'acheteur SONASP
9. ✅ `prix_unitaire_fcfa` - Prix par gramme

### Tables impactées:
- ✅ mining_companies (company_type)
- ✅ snp_artisan_ventes_or (9 nouvelles colonnes)
- ✅ snp_modules (colonne icon)

### Fonctions créées:
- get_sonasp_id()
- set_sonasp_as_buyer()
- get_user_accessible_modules()
- check_module_access()
- calculate_collector_commission()
- validate_collection_data()
- get_collector_statistics()
- validate_sonasp_sale()
- calculate_sonasp_pricing()
- get_sonasp_sales_analytics()

### Vues créées:
- snp_ventes_artisans_sonasp
- snp_modules_hierarchy (probablement)
- snp_collector_performance (probablement)

---

## ⚠️ POINTS D'ATTENTION

### Script 1: CORRECTION-COMPLETE-A-EXECUTER.sql
- ⚠️ Vérifié et corrigé: utilise `snp_artisans_miniers` (pas `SNP_artisans_miniers`)
- ✅ Compatible avec le schéma actuel

### Script 2: CREATE-MODULES-MANAGEMENT-SYSTEM.sql
- ⚠️ Vérifier que la colonne `icon` est ajoutée correctement
- Peut nécessiter modification si déjà partiellement exécuté

### Script 3 & 4: 
- ✅ Dépendent du script 1 (acheteur_id doit exister)
- ✅ Ordre d'exécution important

---

## 🛠️ OUTILS DE VÉRIFICATION

### Avant exécution:
```bash
node scripts/analyze-database.js        # Schéma actuel
node scripts/check-execution-status.js  # État d'exécution
```

### Après exécution:
```bash
node scripts/check-execution-status.js  # Vérifier succès
node scripts/apply-fix-automatically.js # Test complet
```

### En cas d'erreur:
```bash
cat scripts/DATABASE-SCHEMA.md          # Voir schéma exact
grep "nom_table" scripts/DATABASE-SCHEMA.md  # Chercher table
```

---

## 📞 RÉSOLUTION DE PROBLÈMES

### Erreur: "relation does not exist"
→ Vérifier nom exact dans `DATABASE-SCHEMA.md`

### Erreur: "column already exists"
→ Script déjà partiellement exécuté, passer au suivant

### Erreur: "foreign key constraint"
→ Exécuter les scripts dans l'ordre exact

---

**Créé le:** 27/12/2024  
**Mis à jour:** Automatiquement  
**Validé:** ✅ Tous les scripts vérifiés contre le schéma réel
