# 🗑️ Guide de Nettoyage des Données de Shipping

## 📋 Vue d'ensemble

Le script `cleanup-all-shipping-data.js` permet de supprimer **toutes** les données liées au système de shipping dans votre application Gold Shipper.

**⚠️ ATTENTION** : Cette opération est **IRRÉVERSIBLE** !

---

## 🎯 Ce Qui Est Supprimé

### Tables de Base de Données (5)
1. **shipping_documents** - Documents liés aux préparations
2. **shipping_signatories** - Signataires des expéditions
3. **shipping_ingots** - Lingots inclus dans les préparations
4. **shipping_production_items** - Items de production sélectionnés
5. **shipping_preparations** - Préparations d'expédition principales

### Fichiers Storage
- **Bucket** : `shipping-documents`
- Tous les fichiers PDF (Packing Lists)
- Tous les dossiers créés

---

## 🚀 Utilisation

### Mode Aperçu (Dry-Run) - RECOMMANDÉ D'ABORD

**Affiche ce qui serait supprimé SANS supprimer réellement** :

```bash
npm run cleanup:shipping:preview
```

**OU**

```bash
npm run cleanup:shipping -- --dry-run
```

**Résultat** :
```
📊 STATISTIQUES ACTUELLES

  shipping_preparations: 15
  shipping_production_items: 45
  shipping_ingots: 0
  shipping_signatories: 30
  shipping_documents: 15
  Fichiers storage: 15 dans 15 dossier(s)

  TOTAL : 120 éléments

🔍 APERÇU DES SUPPRESSIONS (DRY-RUN)
[DRY-RUN] Suppression de 15 enregistrement(s) de shipping_documents
[DRY-RUN] Suppression de 30 enregistrement(s) de shipping_signatories
...
```

### Mode Suppression Réelle - ⚠️ DANGEREUX

**Supprime réellement toutes les données** :

```bash
npm run cleanup:shipping -- --confirm
```

**Ce qui se passe** :
1. Affiche les statistiques actuelles
2. Supprime les tables enfants d'abord (documents, signataires, etc.)
3. Supprime la table parent (preparations)
4. Nettoie tous les fichiers du storage
5. Affiche un résumé final

---

## 📊 Exemple de Sortie

### Aperçu (Dry-Run)

```
======================================================================
🗑️  NETTOYAGE COMPLET DES DONNÉES DE SHIPPING
======================================================================

⚠ MODE DRY-RUN : Aucune suppression réelle ne sera effectuée
ℹ Pour exécuter le nettoyage réel, utilisez : npm run cleanup:shipping -- --confirm

📊 STATISTIQUES ACTUELLES

  shipping_preparations: 8
  shipping_production_items: 24
  shipping_ingots: 0
  shipping_signatories: 16
  shipping_documents: 8
  Fichiers storage: 8 dans 8 dossier(s)

  TOTAL : 64 éléments

🔍 APERÇU DES SUPPRESSIONS (DRY-RUN)

📄 Étape 1/6 : shipping_documents
⚠ [DRY-RUN] Suppression de 8 enregistrement(s) de shipping_documents

✍️  Étape 2/6 : shipping_signatories
⚠ [DRY-RUN] Suppression de 16 enregistrement(s) de shipping_signatories

🪙  Étape 3/6 : shipping_ingots
ℹ Table shipping_ingots : déjà vide

📦 Étape 4/6 : shipping_production_items
⚠ [DRY-RUN] Suppression de 24 enregistrement(s) de shipping_production_items

📋 Étape 5/6 : shipping_preparations
⚠ [DRY-RUN] Suppression de 8 enregistrement(s) de shipping_preparations

💾 Étape 6/6 : Fichiers storage
⚠ [DRY-RUN] Suppression de 8 fichier(s) dans folder-uuid-1
⚠ [DRY-RUN] Suppression de 8 fichier(s) dans folder-uuid-2
...

======================================================================
📊 RÉSUMÉ DU NETTOYAGE
======================================================================

  Total éléments supprimés: 64

⚠️  Ceci était un DRY-RUN - Aucune suppression réelle effectuée

Pour exécuter le nettoyage réel :
  npm run cleanup:shipping -- --confirm

======================================================================
```

### Suppression Réelle (--confirm)

```
======================================================================
🗑️  NETTOYAGE COMPLET DES DONNÉES DE SHIPPING
======================================================================

✗ ⚠️  ATTENTION : MODE SUPPRESSION RÉELLE ACTIVÉ ⚠️
✗ Cette opération est IRRÉVERSIBLE !

📊 STATISTIQUES ACTUELLES

  shipping_preparations: 8
  shipping_production_items: 24
  shipping_ingots: 0
  shipping_signatories: 16
  shipping_documents: 8
  Fichiers storage: 8 dans 8 dossier(s)

  TOTAL : 64 éléments

🗑️  DÉBUT DU NETTOYAGE

📄 Étape 1/6 : shipping_documents
✓ Table shipping_documents : 8 enregistrement(s) supprimé(s)

✍️  Étape 2/6 : shipping_signatories
✓ Table shipping_signatories : 16 enregistrement(s) supprimé(s)

🪙  Étape 3/6 : shipping_ingots
ℹ Table shipping_ingots : déjà vide

📦 Étape 4/6 : shipping_production_items
ℹ shipping_production_items : 24/24 supprimés...
✓ Table shipping_production_items : 24 enregistrement(s) supprimé(s)

📋 Étape 5/6 : shipping_preparations
✓ Table shipping_preparations : 8 enregistrement(s) supprimé(s)

💾 Étape 6/6 : Fichiers storage
✓ Supprimé 1 fichier(s) dans folder-uuid-1
✓ Supprimé 1 fichier(s) dans folder-uuid-2
...

======================================================================
📊 RÉSUMÉ DU NETTOYAGE
======================================================================

  Total éléments supprimés: 64

✓ Nettoyage terminé avec succès !
✓ Toutes les tables de shipping sont maintenant vides

======================================================================
```

---

## 🔧 Cas d'Usage

### 1. Développement / Tests
Vous voulez réinitialiser complètement le système de shipping pour tester depuis zéro :

```bash
# Voir ce qui sera supprimé
npm run cleanup:shipping:preview

# Confirmer et supprimer
npm run cleanup:shipping -- --confirm
```

### 2. Migration de Données
Avant d'importer de nouvelles données de shipping :

```bash
npm run cleanup:shipping -- --confirm
# Puis importer vos nouvelles données
```

### 3. Nettoyage après Erreur
Si vous avez des données corrompues ou incohérentes :

```bash
npm run cleanup:shipping -- --confirm
# Puis recréer les préparations correctement
```

---

## ⚠️ Avertissements et Précautions

### 1. Sauvegarde Recommandée
Avant de supprimer, **exportez vos données** si nécessaire :

```bash
# Via Supabase Dashboard > Database > Backups
# OU utilisez pg_dump si vous avez accès direct
```

### 2. Ordre de Suppression
Le script respecte l'ordre des dépendances :
1. Tables enfants (documents, signataires, etc.) d'abord
2. Table parent (preparations) ensuite
3. Fichiers storage à la fin

### 3. Contraintes RLS
Si vous avez des **politiques RLS strictes**, certains enregistrements peuvent ne pas être supprimés. Dans ce cas :

**Option A** : Désactiver temporairement RLS (via SQL Editor)
```sql
ALTER TABLE shipping_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_signatories DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_ingots DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_production_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_preparations DISABLE ROW LEVEL SECURITY;

-- Exécuter le script cleanup

-- Réactiver RLS après
ALTER TABLE shipping_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_ingots ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_preparations ENABLE ROW LEVEL SECURITY;
```

**Option B** : Utiliser un script SQL direct (plus puissant)
```sql
-- Via Supabase Dashboard > SQL Editor
DELETE FROM shipping_documents;
DELETE FROM shipping_signatories;
DELETE FROM shipping_ingots;
DELETE FROM shipping_production_items;
DELETE FROM shipping_preparations;
```

### 4. Bucket Storage
Le bucket `shipping-documents` lui-même **n'est PAS supprimé**, seulement son contenu.

---

## 🧪 Workflow Recommandé

### Étape 1 : Aperçu
```bash
npm run cleanup:shipping:preview
```
**Vérifiez** les statistiques affichées

### Étape 2 : Confirmation
Si vous êtes sûr, exécutez :
```bash
npm run cleanup:shipping -- --confirm
```

### Étape 3 : Vérification
Vérifiez que tout est propre :
```bash
node scripts/verify-shipping-setup.js
```

---

## 🐛 Dépannage

### Erreur : "Variables d'environnement requises"
**Solution** : Vérifiez votre fichier `.env`
```bash
# Le fichier .env doit contenir :
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon
```

### Erreur : "Permission denied"
**Cause** : Politiques RLS trop restrictives

**Solution** :
1. Utiliser la clé service role au lieu de anon key
2. OU désactiver temporairement RLS (voir section Précautions)
3. OU utiliser directement SQL via Dashboard

### Certains enregistrements restent
**Cause** : Contraintes de clés étrangères ou RLS

**Solution** :
```bash
# Vérifier les enregistrements restants
node scripts/check-existing-shipping-tables.js

# Si nécessaire, supprimer manuellement via SQL Editor
```

---

## 📝 Notes Techniques

### Performance
- Suppression par **lots de 100** pour éviter les timeouts
- Affichage de progression pour les grandes tables
- Gestion des erreurs par table (une erreur n'arrête pas tout)

### Sécurité
- **Mode dry-run par défaut** (--confirm requis pour supprimer)
- Confirmation visuelle avant suppression
- Résumé détaillé après chaque opération

### Logs
- Codes couleur pour clarté :
  - 🔵 Bleu = Information
  - ✅ Vert = Succès
  - ⚠️  Jaune = Avertissement
  - ❌ Rouge = Erreur

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez d'abord avec `--dry-run`
2. Consultez les logs d'erreur détaillés
3. Vérifiez les politiques RLS dans Supabase Dashboard
4. Utilisez SQL Editor comme alternative

---

**Date de création** : 2025-11-12
**Version** : 1.0
**Auteur** : Gold Shipper Development Team
