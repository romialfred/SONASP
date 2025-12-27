# Guide d'utilisation - Checklist Qualité SQL

## 📌 Objectif

Ce guide explique comment utiliser la checklist qualité SQL pour **éviter les erreurs récurrentes** qui apparaissent depuis le début du projet en Octobre.

## 🚨 Problème récurrent identifié

**Erreur:** `ERROR: 42601: syntax error at or near "RAISE"`

**Cause:** Utilisation de `RAISE NOTICE` en dehors d'un bloc PL/pgSQL `DO $$...$$`

**Impact:** Scripts SQL qui échouent systématiquement, perte de temps, frustration

## ✅ Solution mise en place

La checklist qualité SQL (`SQL-QUALITY-CHECKLIST.md`) documente toutes les règles à respecter pour éviter cette erreur et d'autres problèmes courants.

## 📋 Processus obligatoire pour TOUS les scripts SQL

### Étape 1: Avant d'écrire le script

1. **Exporter le DDL complet** de toutes les tables concernées depuis Supabase
2. **Documenter la structure** dans un commentaire en haut du script:

```sql
/*
  # Nom du script

  ## Structure des tables (vérifiée le YYYY-MM-DD)

  ### snp_cartes_professionnelles
  Colonnes existantes:
  - id: uuid (PK, DEFAULT gen_random_uuid())
  - artisan_id: uuid (NOT NULL, FK → snp_artisans_miniers)
  - numero_carte: text (NOT NULL, UNIQUE)
  - date_emission: date (NOT NULL, DEFAULT CURRENT_DATE)    ← Pas date_delivrance!
  - date_expiration: date (NOT NULL)
  - date_validation: date (nullable)                        ← Pas validee_le!
  - date_suspension: date (nullable)                        ← Pas suspendue_le!
  - statut: text (NOT NULL, CHECK)
  - qr_code_data: text (nullable)                           ← TEXT pas JSONB!
  - numero_securite: text (DEFAULT fonction)
  - validee_par: uuid (nullable, FK → auth.users)
  - motif_suspension: text (nullable)
  - observations: text (nullable)
  - created_at: timestamptz (DEFAULT now())
  - updated_at: timestamptz (DEFAULT now())

  Contraintes:
  - CHECK: statut IN ('en_cours', 'validee', 'en_exploitation', 'expiree', 'suspendue', 'annulee')
*/
```

### Étape 2: Pendant l'écriture

Consulter la checklist et vérifier:

- [ ] ✅ Tous les RAISE NOTICE sont dans des blocs `DO $$...$$`
- [ ] ✅ Tous les noms de colonnes correspondent au DDL réel
- [ ] ✅ Tous les types de données sont corrects
- [ ] ✅ Les contraintes NOT NULL sont respectées
- [ ] ✅ L'ordre des suppressions respecte les dépendances

### Étape 3: Après l'écriture

1. **Vérification syntaxique** contre la checklist
2. **Validation manuelle** dans un éditeur SQL
3. **Test sur un environnement de développement** si possible
4. **Exécution en production**

## 🎯 Règles d'or à respecter ABSOLUMENT

### Règle #1: RAISE NOTICE

**❌ NE JAMAIS faire:**
```sql
DELETE FROM ma_table;
RAISE NOTICE 'Terminé';  -- ❌ ERREUR GARANTIE
```

**✅ TOUJOURS faire:**
```sql
DELETE FROM ma_table;

DO $$
BEGIN
  RAISE NOTICE 'Terminé';
END $$;
```

### Règle #2: Vérification des colonnes

**❌ NE JAMAIS faire:**
```sql
-- Supposer que la colonne s'appelle "date_delivrance"
INSERT INTO snp_cartes_professionnelles (
  date_delivrance,  -- ❌ Cette colonne n'existe pas!
  validee_le,       -- ❌ Cette colonne n'existe pas!
  qr_code_data      -- ✅ Celle-ci existe mais c'est TEXT pas JSONB!
) VALUES (
  CURRENT_DATE,
  NOW(),
  jsonb_build_object('key', 'value')  -- ❌ Type incompatible!
);
```

**✅ TOUJOURS faire:**
```sql
-- 1. Vérifier le DDL
-- 2. Utiliser les VRAIS noms de colonnes

INSERT INTO snp_cartes_professionnelles (
  date_emission,     -- ✅ Nom vérifié dans le DDL
  date_validation,   -- ✅ Nom vérifié dans le DDL
  qr_code_data       -- ✅ Type TEXT vérifié
) VALUES (
  CURRENT_DATE,
  NOW(),
  'CARTE:001|ARTISAN:uuid|SEC:1234567890'  -- ✅ Texte simple
);
```

### Règle #3: Structure de script standard

**Tous les scripts doivent suivre cette structure:**

```sql
/*
  # Titre
  ## Description
  ## Structure vérifiée (avec DDL)
*/

-- ============================================================================
-- PARTIE 1: VÉRIFICATIONS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Début du script';
END $$;

-- ============================================================================
-- PARTIE 2: MODIFICATIONS DE STRUCTURE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (...) THEN
    ALTER TABLE ...;
    RAISE NOTICE 'Modification effectuée';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 3: MODIFICATIONS DE DONNÉES
-- ============================================================================

DELETE FROM ...;

DO $$
BEGIN
  RAISE NOTICE 'Suppression effectuée';
END $$;

-- Insertions dans un bloc DO $$ si besoin de RAISE NOTICE
INSERT INTO ...;

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM ...;
  RAISE NOTICE '% enregistrements insérés', v_count;
END $$;

-- ============================================================================
-- PARTIE 4: RÉSUMÉ
-- ============================================================================

DO $$
DECLARE
  v_stats RECORD;
BEGIN
  SELECT COUNT(*) as total INTO v_stats FROM ...;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSUMÉ';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total: %', v_stats.total;
  RAISE NOTICE '========================================';
END $$;
```

## 📚 Ressources

- **Checklist complète:** `scripts/SQL-QUALITY-CHECKLIST.md`
- **Documentation PostgreSQL PL/pgSQL:** https://www.postgresql.org/docs/current/plpgsql.html
- **Documentation Supabase:** https://supabase.com/docs/guides/database

## 🔄 Processus de révision

Quand vous trouvez un nouveau type d'erreur récurrente:

1. Documenter l'erreur dans la checklist
2. Ajouter un exemple ❌ MAUVAIS et ✅ CORRECT
3. Mettre à jour ce README si nécessaire
4. Informer l'équipe

## 🎓 Formation

Tous les développeurs travaillant sur les scripts SQL doivent:

1. Lire intégralement la checklist
2. Comprendre chaque règle
3. Appliquer systématiquement le processus
4. En cas de doute, consulter un pair ou la documentation

## 📞 Support

En cas de problème persistant:

1. Vérifier la checklist
2. Vérifier le DDL de la table
3. Tester le script dans un environnement de test
4. Demander une revue de code

---

**Dernière mise à jour:** 27 Décembre 2024
**Auteur:** Équipe Développement Gold Shipper
**Version:** 1.0
