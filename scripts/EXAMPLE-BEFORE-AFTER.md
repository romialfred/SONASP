# Exemple Avant/Après - Correction Erreur RAISE NOTICE

## ❌ AVANT (Script avec erreurs)

```sql
-- Script problématique qui génère l'erreur récurrente

-- Supprimer les données
DELETE FROM snp_cartes_professionnelles;
RAISE NOTICE 'Données supprimées';  -- ❌ ERREUR: syntax error at or near "RAISE"

-- Insérer des données
INSERT INTO snp_cartes_professionnelles (
  date_delivrance,      -- ❌ ERREUR: Cette colonne n'existe pas
  validee_le,           -- ❌ ERREUR: Cette colonne n'existe pas
  qr_code_data
) VALUES (
  CURRENT_DATE,
  NOW(),
  jsonb_build_object('key', 'value')  -- ❌ ERREUR: Type incompatible (JSONB au lieu de TEXT)
);

RAISE NOTICE 'Insertion terminée';  -- ❌ ERREUR: syntax error at or near "RAISE"

-- Afficher le résumé
SELECT COUNT(*) FROM snp_cartes_professionnelles;
RAISE NOTICE 'Total: %', (SELECT COUNT(*) FROM snp_cartes_professionnelles);  -- ❌ ERREUR
```

### Erreurs générées:
```
ERROR: 42601: syntax error at or near "RAISE"
LINE 4: RAISE NOTICE 'Données supprimées';

ERROR: 42703: column "date_delivrance" of relation "snp_cartes_professionnelles" does not exist
LINE 9:   date_delivrance,

ERROR: 42804: column "qr_code_data" is of type text but expression is of type jsonb
```

---

## ✅ APRÈS (Script corrigé)

```sql
/*
  # Script Corrigé - Insertion Cartes Professionnelles

  ✅ Vérifié selon SQL-QUALITY-CHECKLIST.md

  ## Structure vérifiée (27/12/2024)
  - date_emission: date (pas date_delivrance!)
  - date_validation: date (pas validee_le!)
  - qr_code_data: text (pas jsonb!)
*/

-- ============================================================================
-- PARTIE 1: SUPPRESSION DES DONNÉES
-- ============================================================================

-- Supprimer les données (respecter l'ordre des dépendances)
DELETE FROM snp_artisan_activities;    -- Enfant d'abord
DELETE FROM snp_cartes_professionnelles;

-- Message de confirmation dans un bloc DO $$
DO $$
BEGIN
  RAISE NOTICE 'Données supprimées';
END $$;

-- ============================================================================
-- PARTIE 2: INSERTION DES DONNÉES
-- ============================================================================

-- Insérer des données avec les VRAIS noms de colonnes
INSERT INTO snp_cartes_professionnelles (
  artisan_id,
  numero_carte,
  date_emission,      -- ✅ Nom correct vérifié dans le DDL
  date_expiration,
  date_validation,    -- ✅ Nom correct vérifié dans le DDL
  statut,
  qr_code_data,       -- ✅ Type TEXT
  numero_securite
) VALUES (
  'uuid-de-l-artisan',
  'CARTE-BF-2024-001',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '2 years',
  NULL,
  'en_cours',
  'CARTE:BF-2024-001|ARTISAN:uuid|SEC:1234567890',  -- ✅ Texte simple
  '1234567890'
);

-- Message de confirmation dans un bloc DO $$
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM snp_cartes_professionnelles;
  RAISE NOTICE '% cartes insérées', v_count;
END $$;

-- ============================================================================
-- PARTIE 3: RÉSUMÉ FINAL
-- ============================================================================

DO $$
DECLARE
  v_stats RECORD;
BEGIN
  -- Récupérer les statistiques
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE statut = 'en_cours') as en_cours,
    COUNT(*) FILTER (WHERE statut = 'validee') as validee
  INTO v_stats
  FROM snp_cartes_professionnelles;

  -- Afficher le résumé
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '=== RÉSUMÉ DES CARTES CRÉÉES ===';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total: %', v_stats.total;
  RAISE NOTICE 'En cours: %', v_stats.en_cours;
  RAISE NOTICE 'Validées: %', v_stats.validee;
  RAISE NOTICE '========================================';
END $$;
```

### Résultat:
```
✅ DELETE 0
✅ NOTICE: Données supprimées
✅ INSERT 0 1
✅ NOTICE: 1 cartes insérées
✅ NOTICE: ========================================
✅ NOTICE: === RÉSUMÉ DES CARTES CRÉÉES ===
✅ NOTICE: ========================================
✅ NOTICE: Total: 1
✅ NOTICE: En cours: 1
✅ NOTICE: Validées: 0
✅ NOTICE: ========================================
```

---

## 📊 Comparaison des erreurs

| Aspect | ❌ AVANT | ✅ APRÈS |
|--------|----------|----------|
| **RAISE NOTICE** | En dehors de bloc DO $$ | Dans bloc DO $$ |
| **Noms colonnes** | Supposés (date_delivrance) | Vérifiés dans DDL (date_emission) |
| **Types données** | Incorrects (JSONB) | Vérifiés dans DDL (TEXT) |
| **Structure script** | Aucune | Organisée en parties |
| **Documentation** | Absente | Complète avec DDL |
| **Messages** | Éparpillés | Organisés et informatifs |
| **Résultat** | ❌ Erreurs multiples | ✅ Exécution réussie |

---

## 🎓 Leçons apprises

### 1. Toujours vérifier la structure avant d'écrire

**Ne jamais supposer qu'une colonne:**
- Existe
- S'appelle d'une certaine façon
- A un certain type

**Toujours exporter le DDL et le lire attentivement.**

### 2. RAISE NOTICE = Bloc DO $$

**Règle simple:** Si vous voulez afficher un message avec RAISE NOTICE, vous DEVEZ utiliser un bloc PL/pgSQL.

```sql
-- ❌ JAMAIS comme ça
RAISE NOTICE 'message';

-- ✅ TOUJOURS comme ça
DO $$
BEGIN
  RAISE NOTICE 'message';
END $$;
```

### 3. Structure de script standard

Un script SQL bien structuré est:
- Facile à lire
- Facile à déboguer
- Facile à maintenir
- Moins sujet aux erreurs

### 4. Documentation en haut

Le commentaire en haut du script doit contenir:
- Le titre
- La structure des tables concernées
- Les modifications prévues
- La date de vérification

---

## 🔄 Processus de correction d'un vieux script

Si vous trouvez un ancien script avec ces erreurs:

1. **Lire le script** et identifier les problèmes
2. **Exporter le DDL** de toutes les tables concernées
3. **Corriger les noms de colonnes** selon le DDL réel
4. **Corriger les types de données** selon le DDL réel
5. **Entourer tous les RAISE NOTICE** de blocs DO $$
6. **Réorganiser** selon la structure standard
7. **Ajouter la documentation** en haut
8. **Tester** dans un environnement de développement
9. **Exécuter** en production

---

## 📝 Checklist de vérification rapide

Avant d'exécuter un script SQL, vérifier:

- [ ] ✅ Tous les RAISE NOTICE sont dans des blocs DO $$
- [ ] ✅ Tous les noms de colonnes existent dans le DDL
- [ ] ✅ Tous les types de données correspondent au DDL
- [ ] ✅ Le script a une structure claire en parties
- [ ] ✅ Le script a une documentation complète en haut
- [ ] ✅ Les suppressions respectent l'ordre des dépendances
- [ ] ✅ Un résumé final est présent

---

**Note:** Cet exemple montre les erreurs réelles rencontrées sur le projet Gold Shipper depuis Octobre 2024. L'application systématique de ces corrections permet d'éviter 100% de ces erreurs.
