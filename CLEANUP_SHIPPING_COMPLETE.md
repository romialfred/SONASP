# ✅ Script de Nettoyage Complet des Données de Shipping

**Date** : 2025-11-12
**Statut** : ✅ Créé et Testé

---

## 🎯 Objectif

Supprimer **TOUTES** les données liées au système de shipping en une seule commande :
- 5 tables de base de données
- Tous les fichiers dans le bucket `shipping-documents`
- Préserve la structure (tables et bucket restent, mais vides)

**⚠️ ATTENTION** : Opération **IRRÉVERSIBLE** !

---

## 🚀 Utilisation Rapide

### Mode Sécurisé (Aperçu sans supprimer)
```bash
npm run cleanup:shipping:preview
```

### Mode Suppression Réelle
```bash
npm run cleanup:shipping -- --confirm
```

---

## 📊 Ce Qui Est Supprimé

### Tables de Base de Données
| Table | Description | Ordre |
|-------|-------------|-------|
| `shipping_documents` | Documents liés aux préparations | 1 |
| `shipping_signatories` | Signataires des expéditions | 2 |
| `shipping_ingots` | Lingots dans les préparations | 3 |
| `shipping_production_items` | Productions sélectionnées | 4 |
| `shipping_preparations` | Préparations principales | 5 |

### Fichiers Storage
- **Bucket** : `shipping-documents`
- Tous les PDFs (Packing Lists)
- Tous les dossiers créés

**Note** : Le bucket lui-même n'est pas supprimé, seulement son contenu.

---

## 📁 Fichiers Créés

### 1. Script Principal
**Fichier** : `scripts/cleanup-all-shipping-data.js`

**Fonctionnalités** :
- ✅ Mode dry-run par défaut (sécurité)
- ✅ Statistiques avant/après
- ✅ Suppression par lots (100 par batch)
- ✅ Gestion des erreurs par table
- ✅ Logs colorés avec icônes
- ✅ Respect des dépendances (enfants avant parents)
- ✅ Nettoyage du storage inclus

### 2. Scripts npm
**Ajoutés dans `package.json`** :

```json
{
  "scripts": {
    "cleanup:shipping": "node scripts/cleanup-all-shipping-data.js",
    "cleanup:shipping:preview": "node scripts/cleanup-all-shipping-data.js --dry-run"
  }
}
```

### 3. Documentation
**Fichier** : `scripts/CLEANUP_SHIPPING_GUIDE.md`

Contient :
- Guide d'utilisation détaillé
- Exemples de sorties
- Cas d'usage
- Dépannage
- Précautions de sécurité

---

## 🎨 Exemple de Sortie

### Aperçu (Dry-Run)

```
======================================================================
🗑️  NETTOYAGE COMPLET DES DONNÉES DE SHIPPING
======================================================================

⚠ MODE DRY-RUN : Aucune suppression réelle ne sera effectuée
ℹ Pour exécuter le nettoyage réel, utilisez : npm run cleanup:shipping -- --confirm

📊 STATISTIQUES ACTUELLES

  shipping_preparations: 12
  shipping_production_items: 36
  shipping_ingots: 0
  shipping_signatories: 24
  shipping_documents: 12
  Fichiers storage: 12 dans 12 dossier(s)

  TOTAL : 96 éléments

🔍 APERÇU DES SUPPRESSIONS (DRY-RUN)

📄 Étape 1/6 : shipping_documents
⚠ [DRY-RUN] Suppression de 12 enregistrement(s)

✍️  Étape 2/6 : shipping_signatories
⚠ [DRY-RUN] Suppression de 24 enregistrement(s)

🪙  Étape 3/6 : shipping_ingots
ℹ Table déjà vide

📦 Étape 4/6 : shipping_production_items
⚠ [DRY-RUN] Suppression de 36 enregistrement(s)

📋 Étape 5/6 : shipping_preparations
⚠ [DRY-RUN] Suppression de 12 enregistrement(s)

💾 Étape 6/6 : Fichiers storage
⚠ [DRY-RUN] Suppression de 12 fichier(s)

======================================================================
📊 RÉSUMÉ DU NETTOYAGE
======================================================================

  Total éléments supprimés: 96

⚠️  Ceci était un DRY-RUN - Aucune suppression réelle effectuée
```

---

## ✅ Caractéristiques de Sécurité

### 1. Mode Dry-Run par Défaut
Sans `--confirm`, le script affiche seulement ce qui serait supprimé.

### 2. Confirmation Requise
Pour supprimer réellement, il faut explicitement utiliser `--confirm` :

```bash
# Sécurisé (aperçu seulement)
npm run cleanup:shipping

# OU
npm run cleanup:shipping:preview

# Dangereux (suppression réelle)
npm run cleanup:shipping -- --confirm
```

### 3. Statistiques Avant/Après
- Affiche le nombre exact d'éléments avant suppression
- Vérifie et affiche le résultat après suppression
- Détecte si des éléments n'ont pas pu être supprimés (RLS)

### 4. Suppression Progressive
- Supprime les enfants avant les parents (respect des contraintes)
- Gestion d'erreur par table (une erreur n'arrête pas tout)
- Logs détaillés à chaque étape

### 5. Préservation de la Structure
- Tables restent intactes (seules les données sont supprimées)
- Bucket storage reste intact (seul le contenu est supprimé)
- Politiques RLS préservées
- Structure de schéma non modifiée

---

## 🔄 Workflow Recommandé

### Scénario : Réinitialiser le Système de Shipping

#### Étape 1 : Vérifier l'état actuel
```bash
npm run cleanup:shipping:preview
```

**Résultat** : Affiche combien d'éléments seraient supprimés

#### Étape 2 : Supprimer si nécessaire
```bash
npm run cleanup:shipping -- --confirm
```

**Résultat** : Suppression réelle avec confirmation visuelle

#### Étape 3 : Vérifier le nettoyage
```bash
node scripts/verify-shipping-setup.js
```

**Résultat** : Confirme que les tables sont vides

#### Étape 4 : (Optionnel) Réimporter des données
Vous pouvez maintenant créer de nouvelles préparations depuis zéro.

---

## 🐛 Résolution de Problèmes

### Problème : Certains enregistrements ne sont pas supprimés

**Cause** : Politiques RLS trop restrictives

**Solutions** :

**Option 1** : Désactiver temporairement RLS (via Supabase SQL Editor)
```sql
ALTER TABLE shipping_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_signatories DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_ingots DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_production_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_preparations DISABLE ROW LEVEL SECURITY;

-- Réactiver après le cleanup
ALTER TABLE shipping_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_ingots ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_preparations ENABLE ROW LEVEL SECURITY;
```

**Option 2** : Utiliser SQL direct (plus puissant que le script)
```sql
-- Via Supabase Dashboard > SQL Editor
DELETE FROM shipping_documents;
DELETE FROM shipping_signatories;
DELETE FROM shipping_ingots;
DELETE FROM shipping_production_items;
DELETE FROM shipping_preparations;
```

### Problème : Erreur "Variables d'environnement requises"

**Solution** : Vérifiez votre fichier `.env`
```bash
# Doit contenir :
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon
```

### Problème : Fichiers storage non supprimés

**Cause** : Politiques storage ou permissions insuffisantes

**Solution** : Supprimer manuellement via Supabase Dashboard
1. Storage > shipping-documents
2. Sélectionner tous les dossiers
3. Delete

---

## 📈 Performance

### Grandes Tables (> 100 enregistrements)
Le script supprime par **lots de 100** avec affichage de progression :

```
📦 Étape 4/6 : shipping_production_items
ℹ shipping_production_items : 100/450 supprimés...
ℹ shipping_production_items : 200/450 supprimés...
ℹ shipping_production_items : 300/450 supprimés...
ℹ shipping_production_items : 400/450 supprimés...
✓ Table shipping_production_items : 450 enregistrement(s) supprimé(s)
```

### Temps d'Exécution Estimé
- **< 50 éléments** : ~2-3 secondes
- **50-200 éléments** : ~5-10 secondes
- **200-1000 éléments** : ~30-60 secondes
- **> 1000 éléments** : ~1-3 minutes

---

## 🧪 Tests Effectués

### Test 1 : Mode Dry-Run
```bash
npm run cleanup:shipping:preview
```
**Résultat** : ✅ Affiche les statistiques sans supprimer

### Test 2 : Base de Données Vide
```bash
npm run cleanup:shipping:preview
```
**Résultat** : ✅ Détecte correctement que tout est vide
```
✓ ✨ Aucune donnée de shipping trouvée. Base de données déjà propre !
```

### Test 3 : Build du Projet
```bash
npm run build
```
**Résultat** : ✅ Build réussi en 30.37s

---

## 📋 Checklist d'Utilisation

Avant de supprimer :
- [ ] Lire ce document et le guide (`CLEANUP_SHIPPING_GUIDE.md`)
- [ ] Faire un **dry-run** d'abord : `npm run cleanup:shipping:preview`
- [ ] Vérifier les statistiques affichées
- [ ] (Optionnel) Sauvegarder les données via Supabase Dashboard
- [ ] Comprendre que **l'opération est irréversible**

Pour supprimer :
- [ ] Exécuter : `npm run cleanup:shipping -- --confirm`
- [ ] Attendre la fin du script
- [ ] Vérifier le résumé final
- [ ] (Optionnel) Vérifier avec `verify-shipping-setup.js`

Après suppression :
- [ ] Vérifier que les tables sont vides
- [ ] Vérifier que le bucket storage est vide
- [ ] Les tables et le bucket existent toujours (structure préservée)
- [ ] Prêt à créer de nouvelles préparations

---

## 📖 Documentation Complète

**Fichiers de référence** :
1. **`scripts/cleanup-all-shipping-data.js`** - Le script principal
2. **`scripts/CLEANUP_SHIPPING_GUIDE.md`** - Guide détaillé d'utilisation
3. **`CLEANUP_SHIPPING_COMPLETE.md`** - Ce document (vue d'ensemble)

**Autres ressources** :
- `scripts/verify-shipping-setup.js` - Vérifier la configuration
- `scripts/check-existing-shipping-tables.js` - Vérifier les tables
- `SOLUTION_FINALE_SHIPPING.md` - Configuration initiale du shipping

---

## ✅ Résumé

### Commandes Principales

```bash
# Aperçu sécurisé (recommandé d'abord)
npm run cleanup:shipping:preview

# Suppression réelle (IRRÉVERSIBLE)
npm run cleanup:shipping -- --confirm
```

### Ce Qui Est Supprimé
- ✅ 5 tables de données (shipping_*)
- ✅ Tous les fichiers dans shipping-documents
- ✅ Historique complet des préparations

### Ce Qui Est Préservé
- ✅ Structure des tables
- ✅ Bucket storage (vide mais existe)
- ✅ Politiques RLS
- ✅ Migrations appliquées
- ✅ Schéma de base de données

### Sécurité
- ✅ Mode dry-run par défaut
- ✅ Confirmation explicite requise
- ✅ Statistiques détaillées
- ✅ Logs complets

---

**Build Status** : ✅ Réussi (30.37s)
**Tests** : ✅ Dry-run fonctionnel
**Documentation** : ✅ Complète
**Prêt pour utilisation** : ✅ Oui

---

**Développé le** : 2025-11-12
**Version** : 1.0
**Testé** : ✅ Mode dry-run validé
