# 🚨 Fichiers contenant array_agg à corriger

## ⚠️ Ces fichiers doivent être corrigés ou ne JAMAIS être utilisés

### Migrations SQL (NE PAS RÉAPPLIQUER)

Ces migrations ont déjà été appliquées. **NE PAS les modifier rétroactivement.**

Si vous devez les corriger, créez une NOUVELLE migration.

1. ❌ `supabase/migrations/20251113_004_fix_shipping_status_enum.sql`
   - Ligne 59: `SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)`
   - **Action:** Laisser tel quel (déjà appliqué)

2. ❌ `supabase/migrations/20251113_005_fix_shipping_table_definitive.sql`
   - Lignes 171, 177: `SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)`
   - **Action:** Laisser tel quel (déjà appliqué)

3. ❌ `supabase/migrations/20251114_009_fix_shipping_workflow_statuses.sql`
   - Ligne 115: `SELECT array_agg(enumlabel ORDER BY enumsortorder)`
   - **Action:** Laisser tel quel (déjà appliqué)

4. ❌ `supabase/migrations/20251114_010_remove_old_shipping_constraints.sql`
   - Ligne 160: `SELECT array_agg(enumlabel ORDER BY enumsortorder)`
   - **Action:** Laisser tel quel (déjà appliqué)

5. ❌ `supabase/migrations/20251114_011_fix_shipping_enum_definitif.sql`
   - Lignes 36, 257: `SELECT array_agg(...)`
   - **Action:** Laisser tel quel (déjà appliqué)

### Scripts utilitaires (À CORRIGER ou REMPLACER)

6. ❌ `scripts/verify-shipping-enum-final.sql`
   - Ligne 15: `array_agg(enumlabel ORDER BY enumsortorder)`
   - **Action:** ✅ REMPLACÉ par `scripts/verify-shipping-enum-fixed.sql`

7. ❌ `scripts/analyze-and-generate-delete-order.sql`
   - Ligne 130: `array_agg(DISTINCT table_parent)`
   - **Action:** Utiliser `string_agg(DISTINCT table_parent, ', ')` si nécessaire

### Fichiers de documentation (À METTRE À JOUR)

Ces fichiers contiennent des exemples obsolètes avec array_agg.

8. ⚠️ `UTILISER_CE_DIAGNOSTIC.md`
   - Mention de l'erreur array_agg
   - **Action:** Ajouter un lien vers NO_ARRAY_AGG_POLICY.md

9. ⚠️ `APPLY_MIGRATION_NOW.md`
   - Ligne 140: Exemple avec array_agg
   - **Action:** Corriger l'exemple avec string_agg

10. ⚠️ `POST_MIGRATION_TEST_GUIDE.md`
    - Ligne 16: Exemple avec array_agg
    - **Action:** Corriger l'exemple avec string_agg

11. ⚠️ `INVESTIGATION_RAPPORT_COMPLET.md`
    - Lignes 254, 292: Exemples avec array_agg
    - **Action:** Corriger les exemples avec string_agg

12. ⚠️ `SHIPPING_MODULE_COMPLETE_ANALYSIS.md`
    - Lignes 346, 353: Exemples avec array_agg
    - **Action:** Corriger les exemples avec string_agg

## ✅ Fichiers de remplacement créés

- ✅ `NO_ARRAY_AGG_POLICY.md` - Politique d'interdiction de array_agg
- ✅ `CORRECTION_MIGRATIONS_ARRAY_AGG.sql` - Fonctions de remplacement
- ✅ `scripts/verify-shipping-enum-fixed.sql` - Version corrigée sans array_agg

## 🔧 Plan d'action

### Priorité 1 (IMMÉDIAT)
- [x] Créer NO_ARRAY_AGG_POLICY.md
- [x] Créer CORRECTION_MIGRATIONS_ARRAY_AGG.sql
- [x] Créer scripts/verify-shipping-enum-fixed.sql

### Priorité 2 (À faire)
- [ ] Corriger les exemples dans les fichiers de documentation
- [ ] Mettre à jour APPLY_MIGRATION_NOW.md
- [ ] Mettre à jour POST_MIGRATION_TEST_GUIDE.md
- [ ] Mettre à jour INVESTIGATION_RAPPORT_COMPLET.md
- [ ] Mettre à jour SHIPPING_MODULE_COMPLETE_ANALYSIS.md

### Priorité 3 (Optionnel)
- [ ] Supprimer ou archiver les anciens scripts obsolètes
- [ ] Créer des tests pour détecter array_agg dans les nouveaux fichiers

## 📋 Commande de vérification

Pour vérifier qu'aucun nouveau fichier n'utilise array_agg :

```bash
# Rechercher dans les migrations actives
grep -n "array_agg" supabase/migrations/*.sql

# Rechercher dans les scripts
grep -n "array_agg" scripts/*.sql

# Rechercher dans tout le projet
grep -rn "array_agg" . --include="*.sql" --include="*.md"
```

## 🚫 Règle stricte

**À partir de maintenant :**

1. ❌ JAMAIS écrire `array_agg` dans un nouveau fichier
2. ✅ TOUJOURS utiliser `string_agg` ou des alternatives
3. ✅ Vérifier NO_ARRAY_AGG_POLICY.md avant toute agrégation
4. ✅ Utiliser CORRECTION_MIGRATIONS_ARRAY_AGG.sql comme référence

---

**Date de création :** 2025-12-10
**Dernière mise à jour :** 2025-12-10
**Status :** En cours de correction
