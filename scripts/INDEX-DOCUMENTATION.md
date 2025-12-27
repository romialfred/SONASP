# Index de la Documentation SQL - Gold Shipper

## 📚 Vue d'ensemble

Ce dossier contient tous les scripts SQL et la documentation qualité pour le projet Gold Shipper. Cette documentation a été créée pour résoudre les erreurs récurrentes rencontrées depuis Octobre 2024.

---

## 📋 Documents de Qualité (À LIRE EN PRIORITÉ)

### 1. SQL-QUALITY-CHECKLIST.md
**Objectif:** Checklist complète des règles à respecter pour tous les scripts SQL

**Contenu:**
- Liste des erreurs récurrentes et comment les éviter
- Checklist de vérification avant d'écrire un script
- Règles de syntaxe PL/pgSQL
- Templates de scripts sécurisés
- Conventions de nommage
- Bonnes pratiques RLS

**Quand l'utiliser:** AVANT d'écrire ou de modifier tout script SQL

---

### 2. README-SQL-QUALITY.md
**Objectif:** Guide d'utilisation de la checklist qualité

**Contenu:**
- Explication du problème récurrent (erreur RAISE NOTICE)
- Processus obligatoire en 3 étapes
- Règles d'or à respecter absolument
- Exemples de structure de script
- Processus de révision

**Quand l'utiliser:** Pour comprendre le processus qualité et les règles à appliquer

---

### 3. EXAMPLE-BEFORE-AFTER.md
**Objectif:** Exemple concret de correction d'un script erroné

**Contenu:**
- Script AVANT (avec toutes les erreurs)
- Script APRÈS (corrigé selon les règles)
- Comparaison des erreurs
- Leçons apprises
- Processus de correction d'un vieux script

**Quand l'utiliser:** Pour voir concrètement la différence entre un mauvais et un bon script

---

## 🔧 Scripts SQL du Projet

### Scripts Artisans Miniers

#### insert-artisans-burkina-final.sql
**Objectif:** Insertion des 20 artisans miniers du Burkina Faso

**Tables concernées:**
- snp_artisans_miniers
- snp_utilisateurs

**Utilisation:** Exécuter une seule fois pour initialiser les données

---

#### fix-cartes-table-and-generate-data.sql
**Objectif:** Corriger la table cartes et générer les données de test

**Tables concernées:**
- snp_cartes_professionnelles
- snp_artisan_activities
- snp_carte_statistics

**Utilisation:** Exécuter pour initialiser les cartes avec statuts variés

**✅ Vérifié selon SQL-QUALITY-CHECKLIST.md**

---

#### fix-missing-pays-column.sql
**Objectif:** Ajouter la colonne 'pays' manquante

**Tables concernées:**
- snp_artisans_miniers

---

#### generate-cartes-statuts.sql
**Objectif:** Générer les statuts des cartes professionnelles

**Tables concernées:**
- snp_cartes_professionnelles

---

## 📖 Guides d'Installation

### GUIDE-INSTALLATION-FINAL.md
Guide complet d'installation du module Artisan Minier

**Sections:**
1. Structure de la base de données
2. Tables et relations
3. Instructions d'installation étape par étape
4. Vérifications après installation

---

### INSTALLATION-ARTISANS.md
Instructions détaillées pour l'installation des artisans

---

### README-ARTISANS-FINAL.md
Documentation finale du module artisans miniers

---

### README-ARTISANS-INSTRUCTIONS.md
Instructions spécifiques pour les artisans

---

## 📊 Documents d'Analyse

### ANALYSE-TABLE-ARTISANS.md
Analyse détaillée de la table snp_artisans_miniers

**Contenu:**
- Structure complète
- Colonnes et types
- Contraintes
- Relations
- Index
- Politiques RLS

---

## 🎯 Workflow de Développement SQL

### Pour créer un nouveau script:

1. **Lire** `SQL-QUALITY-CHECKLIST.md`
2. **Exporter** le DDL des tables concernées
3. **Documenter** la structure en haut du script
4. **Écrire** le script en suivant les règles
5. **Vérifier** avec la checklist
6. **Tester** en développement
7. **Exécuter** en production

### Pour corriger un script existant:

1. **Lire** `EXAMPLE-BEFORE-AFTER.md`
2. **Identifier** les erreurs dans le script
3. **Exporter** le DDL des tables
4. **Corriger** selon les règles
5. **Vérifier** avec la checklist
6. **Tester** puis exécuter

---

## 🚨 Erreurs Courantes et Solutions Rapides

### Erreur: "syntax error at or near RAISE"
**Solution:** Mettre le RAISE NOTICE dans un bloc DO $$

```sql
DO $$
BEGIN
  RAISE NOTICE 'message';
END $$;
```

---

### Erreur: "column does not exist"
**Solution:** Vérifier le DDL et utiliser les vrais noms de colonnes

```sql
-- ❌ date_delivrance (n'existe pas)
-- ✅ date_emission (existe)
```

---

### Erreur: "is of type text but expression is of type jsonb"
**Solution:** Vérifier le type dans le DDL

```sql
-- ❌ jsonb_build_object(...)
-- ✅ 'texte simple'
```

---

## 📞 Support et Maintenance

### Ajouter une nouvelle erreur à la documentation:

1. Documenter l'erreur dans `SQL-QUALITY-CHECKLIST.md`
2. Ajouter un exemple dans `EXAMPLE-BEFORE-AFTER.md`
3. Mettre à jour cet index si nécessaire

### Questions fréquentes:

**Q: Dois-je vraiment vérifier le DDL à chaque fois?**
R: OUI. C'est la seule façon d'éviter les erreurs de noms de colonnes.

**Q: Puis-je utiliser RAISE NOTICE en dehors d'un bloc DO $$?**
R: NON. Cela génère systématiquement une erreur de syntaxe.

**Q: Un vieux script n'a pas de documentation, dois-je l'ajouter?**
R: OUI. Avant de modifier ou réutiliser un vieux script, ajoutez la documentation.

---

## 📅 Historique

- **27 Décembre 2024:** Création de la documentation qualité suite aux erreurs récurrentes
- **Octobre 2024:** Début du projet, premières erreurs RAISE NOTICE identifiées

---

## 🎓 Ressources Externes

- [PostgreSQL Documentation - PL/pgSQL](https://www.postgresql.org/docs/current/plpgsql.html)
- [Supabase Database Guide](https://supabase.com/docs/guides/database)
- [PostgreSQL Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)

---

**Maintenu par:** Équipe Développement Gold Shipper
**Dernière mise à jour:** 27 Décembre 2024
**Version:** 1.0
