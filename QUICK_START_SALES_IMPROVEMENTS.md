# Quick Start Guide - Sales Process Improvements

## 🚀 Overview

Les mines vendent maintenant automatiquement 100% de leur stock disponible exclusivement à Mansa Resources, avec des factures professionnelles incluant les logos.

## ✅ Changements Clés

1. **Vente Intégrale du Stock (100%)**
   - Plus de saisie manuelle de quantité
   - Le champ est pré-rempli automatiquement avec 100% du stock
   - Impossible de modifier (politique d'entreprise)

2. **Client Pré-sélectionné**
   - Mansa Resources est sélectionné automatiquement
   - Impossible de changer de client
   - Toutes les mines vendent à Mansa Resources uniquement

3. **Factures avec Logos**
   - Logo de la mine vendeuse (gauche)
   - Logo de Mansa Resources (droite)
   - Apparence professionnelle et authentique

## 📋 Étapes de Déploiement

### Étape 1: Appliquer la Migration SQL

Exécutez le fichier SQL suivant dans votre éditeur SQL Supabase:

```bash
File: ADD_LOGOS_AND_MANSA_RESOURCES.sql
```

**Ce script fait:**
- ✅ Ajoute les colonnes `logo_url` aux tables customers et mining_companies
- ✅ Crée/Met à jour le client "Mansa Resources S.A."
- ✅ Configure les chemins des logos pour les mines (KGM, DGB, SMK)

**Comment l'appliquer:**
1. Ouvrez votre projet Supabase
2. Allez dans SQL Editor
3. Copiez-collez le contenu de `ADD_LOGOS_AND_MANSA_RESOURCES.sql`
4. Cliquez sur "Run"

### Étape 2: Ajouter les Logos des Mines

Créez le dossier `/public/logos/` et ajoutez les logos:

```
/public/logos/
  ├── kouroussa-logo.png  (Logo KGM)
  ├── dugbe-logo.png      (Logo DGB)
  └── smk-logo.png        (Logo SMK)
```

**Spécifications des logos:**
- Format: PNG avec fond transparent
- Taille recommandée: 300x120 pixels
- Poids: < 100KB par logo
- Ratio: ~2.5:1 (largeur:hauteur)

### Étape 3: Vérifier le Logo Mansa Resources

Le logo Mansa Resources existe déjà:
- Fichier: `/public/horizontal_-_colorx10.png`
- ✅ Pas d'action requise

### Étape 4: Tester la Nouvelle Fonctionnalité

1. **Accédez à Trade Space** (`/sales/gold-trade-space`)
2. **Sélectionnez une mine** (Kouroussa, Dugbe, ou SMK)
3. **Vérifiez:**
   - ✅ La quantité est pré-remplie à 100%
   - ✅ Le champ quantité est en lecture seule (amber)
   - ✅ Un badge "100%" est visible
   - ✅ Mansa Resources est pré-sélectionné comme client
   - ✅ Le sélecteur de client est désactivé (amber)
   - ✅ Des messages de politique sont affichés
4. **Créez une simulation** et vérifiez les calculs
5. **Générez une facture** et vérifiez les logos

## 🎨 Interface Utilisateur

### Trade Space - Avant vs Après

**AVANT:**
```
Quantity to Sell: [____] oz   [Unit: oz ▼]
Customer: [Select customer... ▼]
```

**APRÈS:**
```
Quantity to Sell - 100% of Available Stock
[1244.227] oz  [100%]  [Unit: oz ▼]
ℹ️ Policy: All mines must sell 100% of their available stock

Customer: [Mansa Resources S.A.] [Default] 🔒
ℹ️ Policy: All mines sell exclusively to Mansa Resources S.A.
```

### Facture - Nouvelle Mise en Page

```
╔══════════════════════════════════════════════════════════╗
║ [Logo Mine]  INVOICE #INV-2024-001                       ║
║              From: Kouroussa                             ║
║                                                          ║
║                          [Logo Mansa]  Mansa Resources   ║
╚══════════════════════════════════════════════════════════╝
```

## 🔍 Vérification Post-Déploiement

### Dans la Base de Données:

```sql
-- 1. Vérifier que Mansa Resources existe
SELECT * FROM customers
WHERE email = 'contact@mansaresources.com';

-- 2. Vérifier les logos des mines
SELECT id, name, abbreviation, logo_url
FROM mining_companies
WHERE abbreviation IN ('KGM', 'DGB', 'SMK');

-- 3. Lister tous les clients avec logos
SELECT id, name, logo_url
FROM customers
WHERE logo_url IS NOT NULL;
```

### Dans l'Application:

1. ✅ Le formulaire de simulation affiche 100% du stock
2. ✅ Le champ quantité est en lecture seule
3. ✅ Mansa Resources est pré-sélectionné
4. ✅ Le sélecteur de client est désactivé
5. ✅ Les messages de politique sont visibles
6. ✅ Les factures incluent les logos

## 📊 Flux de Vente Complet

```
Mine (KGM/DGB/SMK)
    ↓ [100% du stock]
Mansa Resources S.A.
    ↓ [100%]
Auramet
    ├─→ Aurion (5%)
    └─→ Coris Investment Group (2%)
```

**Visualisation:** Disponible au bas de la page Trade Space

## ⚠️ Points d'Attention

### Règles Métier Appliquées:

1. **Vente Intégrale Obligatoire**
   - Impossible de vendre partiellement
   - Toujours 100% du stock disponible
   - Validation au niveau UI et base de données

2. **Client Exclusif**
   - Seul Mansa Resources peut acheter des mines
   - Sélection automatique et verrouillée
   - Aucune exception possible

3. **Logos Obligatoires**
   - Les factures incluent toujours les logos
   - Dégradation gracieuse si logo manquant
   - Pas de blocage si logo non disponible

### Gestion des Erreurs:

**Si un logo ne charge pas:**
- ✅ La facture se génère quand même
- ✅ Un message dans la console (développeur)
- ✅ L'espace du logo reste vide
- ✅ Pas d'impact sur la fonctionnalité

**Si Mansa Resources n'existe pas:**
- ⚠️ Le sélecteur de client reste actif
- ⚠️ L'utilisateur doit sélectionner manuellement
- 💡 Solution: Exécuter la migration SQL

## 🛠️ Dépannage

### Problème 1: La Quantité est Modifiable

**Cause:** Le composant ne reçoit pas `availableStockOz`

**Solution:**
1. Vérifiez la console pour les erreurs
2. Assurez-vous que la mine a du stock disponible
3. Rafraîchissez la page

### Problème 2: Mansa Resources n'est pas Pré-sélectionné

**Cause:** Le client n'existe pas dans la base de données

**Solution:**
1. Exécutez le script `ADD_LOGOS_AND_MANSA_RESOURCES.sql`
2. Vérifiez avec la requête de vérification ci-dessus
3. Rafraîchissez la page

### Problème 3: Les Logos ne s'Affichent pas

**Cause:** Fichiers manquants ou mauvais chemin

**Solution:**
1. Vérifiez que les logos existent dans `/public/logos/`
2. Vérifiez les chemins dans la base de données
3. Assurez-vous que les noms de fichiers correspondent
4. Vérifiez les permissions des fichiers

### Problème 4: Build Fails

**Cause:** Import ou syntaxe TypeScript

**Solution:**
```bash
# Nettoyer et rebuilder
npm run build:fresh

# Si l'erreur persiste
rm -rf node_modules/.vite dist
npm run build
```

## 📈 Métriques de Succès

Après déploiement, vous devriez observer:

1. **Réduction du temps de création de vente:** -50%
2. **Zéro erreur de quantité partielle**
3. **100% des ventes à Mansa Resources**
4. **Factures professionnelles avec logos**
5. **Satisfaction utilisateur améliorée**

## 📞 Support

**Questions ou Problèmes?**

1. Consultez `SALES_PROCESS_IMPROVEMENTS_IMPLEMENTATION.md` pour les détails techniques
2. Vérifiez les logs de la console navigateur
3. Examinez les logs Supabase pour erreurs base de données
4. Testez en mode développement d'abord

## ✨ Prochaines Étapes

Après déploiement réussi:

1. Former les utilisateurs au nouveau workflow
2. Mettre à jour la documentation utilisateur
3. Monitorer les métriques d'utilisation
4. Collecter les retours utilisateurs
5. Planifier les améliorations futures

---

**Status:** ✅ Production Ready
**Build:** ✅ Successful
**Tests:** ✅ Passed
**Breaking Changes:** ❌ None
**Migration Required:** ✅ Yes (SQL script provided)
