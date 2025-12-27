# Module Artisans Miniers - Documentation Complète

## ⚠️ Problème Résolu: Erreur "relation does not exist"

### Cause de l'Erreur
PostgreSQL est **sensible à la casse** quand on utilise des guillemets doubles:
- ❌ `"SNP_artisans_miniers"` → Cherche une table avec EXACTEMENT cette casse
- ✅ `snp_artisans_miniers` → Fonctionne (sans guillemets)
- ✅ `public.snp_artisans_miniers` → Fonctionne (avec schéma)

### Solution Appliquée
Tous les `INSERT INTO "SNP_artisans_miniers"` ont été corrigés en:
```sql
INSERT INTO public.snp_artisans_miniers
```

## 📋 Installation - 2 Étapes

### ÉTAPE 1: Ajouter les Colonnes Manquantes

**Fichier:** `supabase/migrations/20251227_002_add_missing_columns_artisans.sql`

**Dans Supabase SQL Editor**, collez et exécutez le contenu du fichier.

Cette migration ajoute:
- ✅ `updated_by` (audit trail)
- ✅ `telephone_secondaire` (contact alternatif)
- ✅ `numero_registre_commerce` (pour personnes morales)
- ✅ Élargit la liste des pays (9 pays au lieu de 3)
- ✅ Ajoute 'Autre' dans les options de sexe
- ✅ Crée les index manquants

**Durée:** 30 secondes

### ÉTAPE 2: Insérer les Données de Test

**Fichier:** `scripts/insert-artisans-burkina-final.sql`

**Dans Supabase SQL Editor**, collez et exécutez le contenu du fichier.

Ce script insère 20 artisans du Burkina Faso.

**Durée:** 1 minute

## ✅ Vérification

```sql
-- Compter les artisans
SELECT COUNT(*) FROM public.snp_artisans_miniers;
-- Résultat: 20

-- Par type
SELECT type_artisan, COUNT(*) as total
FROM public.snp_artisans_miniers
GROUP BY type_artisan;
```

## 🎯 Résultat

Après l'installation:
- ✅ 20 artisans de test
- ✅ Support 9 pays du Sahel
- ✅ Génération automatique des numéros de carte
- ✅ Système 100% opérationnel
