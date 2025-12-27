# Analyse Structure - snp_artisan_activities

**Date d'analyse:** 27 Décembre 2024
**Analysé suite à:** Erreur `column "quantite_onces" does not exist`

---

## 📋 Structure Complète de la Table

### Informations Générales
- **Nom:** `public.snp_artisan_activities`
- **Propriétaire:** postgres
- **Tablespace:** pg_default
- **RLS:** Activé (ENABLED)

---

## 📊 Colonnes Existantes

| Nom Colonne | Type | Nullable | Default | Description |
|-------------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | gen_random_uuid() | Identifiant unique |
| `artisan_id` | uuid | NOT NULL | - | Référence artisan |
| `carte_id` | uuid | NULL | - | Référence carte (optionnel) |
| `type_activite` | text | NOT NULL | - | Type d'activité |
| `description` | text | NULL | - | Description libre |
| `quantite_grammes` | numeric(10,3) | NULL | - | Quantité en grammes |
| `montant` | numeric(15,2) | NULL | - | Montant financier |
| `devise` | text | NULL | 'XOF' | Devise du montant |
| `date_activite` | date | NOT NULL | CURRENT_DATE | Date de l'activité |
| `created_at` | timestamptz | NULL | now() | Date création |
| `created_by` | uuid | NULL | - | Créé par (user) |

---

## ❌ Colonnes qui N'EXISTENT PAS

**ATTENTION:** Ces colonnes n'existent PAS dans la table, ne pas les utiliser:

- ❌ `quantite_onces` - **N'EXISTE PAS** (erreur courante)
- ❌ `site` - **N'EXISTE PAS** (erreur courante)
- ❌ `lieu` - **N'EXISTE PAS**
- ❌ `localisation` - **N'EXISTE PAS**

Si vous avez besoin de ces colonnes, elles doivent d'abord être ajoutées avec un ALTER TABLE.

---

## 🔗 Contraintes

### Primary Key
```sql
CONSTRAINT snp_artisan_activities_pkey PRIMARY KEY (id)
```

### Foreign Keys

#### FK vers snp_artisans_miniers
```sql
CONSTRAINT snp_artisan_activities_artisan_id_fkey
FOREIGN KEY (artisan_id)
REFERENCES public.snp_artisans_miniers (id)
ON UPDATE NO ACTION
ON DELETE CASCADE
```

#### FK vers snp_cartes_professionnelles
```sql
CONSTRAINT snp_artisan_activities_carte_id_fkey
FOREIGN KEY (carte_id)
REFERENCES public.snp_cartes_professionnelles (id)
ON UPDATE NO ACTION
ON DELETE SET NULL
```

#### FK vers auth.users
```sql
CONSTRAINT snp_artisan_activities_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users (id)
ON UPDATE NO ACTION
ON DELETE NO ACTION
```

### Check Constraint

**Type Activité (IMPORTANT):**
```sql
CONSTRAINT snp_artisan_activities_type_activite_check
CHECK (type_activite = ANY (ARRAY[
  'vente'::text,
  'achat'::text,
  'production'::text,
  'transport'::text,
  'autre'::text
]))
```

**⚠️ VALEURS VALIDES UNIQUEMENT:**
- ✅ `'vente'`
- ✅ `'achat'`
- ✅ `'production'`
- ✅ `'transport'`
- ✅ `'autre'`

**❌ VALEURS INVALIDES (génèrent des erreurs):**
- ❌ `'collecte'`
- ❌ `'depot'`
- ❌ `'livraison'`
- ❌ Toute autre valeur non listée

---

## 📑 Index

### Index sur artisan_id
```sql
CREATE INDEX idx_activities_artisan
ON public.snp_artisan_activities
USING btree (artisan_id ASC NULLS LAST)
```

### Index sur carte_id
```sql
CREATE INDEX idx_activities_carte
ON public.snp_artisan_activities
USING btree (carte_id ASC NULLS LAST)
```

---

## 🔒 Politiques RLS

### Policy: SELECT
```sql
CREATE POLICY "Authenticated users can view activities"
ON public.snp_artisan_activities
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);
```

### Policy: INSERT
```sql
CREATE POLICY "Authenticated users can insert activities"
ON public.snp_artisan_activities
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);
```

### Policy: UPDATE
```sql
CREATE POLICY "Authenticated users can update activities"
ON public.snp_artisan_activities
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```

**Note:** Politiques très permissives, tous les utilisateurs authentifiés peuvent lire/écrire/modifier.

---

## 🔧 Permissions

Tous les rôles ont tous les droits:
- `anon`: ALL
- `authenticated`: ALL
- `postgres`: ALL
- `service_role`: ALL

---

## ✅ Template d'INSERT Correct

```sql
-- Template vérifié selon le DDL réel
INSERT INTO snp_artisan_activities (
  artisan_id,          -- uuid, NOT NULL, OBLIGATOIRE
  carte_id,            -- uuid, nullable
  type_activite,       -- text, NOT NULL, OBLIGATOIRE, voir CHECK
  description,         -- text, nullable
  quantite_grammes,    -- numeric(10,3), nullable
  montant,             -- numeric(15,2), nullable
  devise,              -- text, nullable, DEFAULT 'XOF'
  date_activite,       -- date, NOT NULL, DEFAULT CURRENT_DATE
  created_by           -- uuid, nullable
) VALUES (
  'uuid-artisan',                    -- artisan_id
  'uuid-carte-ou-null',              -- carte_id
  'vente',                           -- type_activite (valeurs: vente, achat, production, transport, autre)
  'Description de l''activité',      -- description
  125.500,                           -- quantite_grammes
  1500000.00,                        -- montant
  'XOF',                             -- devise
  CURRENT_DATE,                      -- date_activite
  auth.uid()                         -- created_by
);
```

---

## ❌ Erreurs Courantes

### Erreur 1: Column does not exist
```sql
-- ❌ MAUVAIS
INSERT INTO snp_artisan_activities (quantite_onces, site)
VALUES (3.5, 'Ouagadougou');

-- Erreur: column "quantite_onces" does not exist
-- Erreur: column "site" does not exist
```

**Solution:**
```sql
-- ✅ CORRECT
INSERT INTO snp_artisan_activities (quantite_grammes)
VALUES (100.500);
```

### Erreur 2: Type Activité Invalide
```sql
-- ❌ MAUVAIS
INSERT INTO snp_artisan_activities (type_activite)
VALUES ('collecte');

-- Erreur: failing row contains value 'collecte'
-- Erreur: violates check constraint "snp_artisan_activities_type_activite_check"
```

**Solution:**
```sql
-- ✅ CORRECT (utiliser une valeur valide)
INSERT INTO snp_artisan_activities (type_activite)
VALUES ('achat');  -- ou 'vente', 'production', 'transport', 'autre'
```

### Erreur 3: NOT NULL Violation
```sql
-- ❌ MAUVAIS
INSERT INTO snp_artisan_activities (description)
VALUES ('Une activité');

-- Erreur: null value in column "artisan_id"
-- Erreur: violates not-null constraint
```

**Solution:**
```sql
-- ✅ CORRECT (fournir artisan_id et type_activite)
INSERT INTO snp_artisan_activities (artisan_id, type_activite, description)
VALUES ('uuid-valide', 'vente', 'Une activité');
```

---

## 🎯 Checklist avant INSERT

Avant d'insérer dans `snp_artisan_activities`, vérifier:

- [ ] ✅ `artisan_id` fourni et valide (uuid existant dans snp_artisans_miniers)
- [ ] ✅ `type_activite` fourni et dans la liste valide
- [ ] ✅ `type_activite` est l'une des valeurs: vente, achat, production, transport, autre
- [ ] ✅ Si `carte_id` fourni, il doit exister dans snp_cartes_professionnelles
- [ ] ✅ `quantite_grammes` utilisé (PAS quantite_onces)
- [ ] ✅ Aucune colonne inexistante (site, quantite_onces, etc.)
- [ ] ✅ `montant` au format NUMERIC(15,2) si fourni
- [ ] ✅ `quantite_grammes` au format NUMERIC(10,3) si fourni

---

## 📝 Exemples d'INSERT Réels

### Exemple 1: Vente simple
```sql
INSERT INTO snp_artisan_activities (
  artisan_id,
  type_activite,
  description,
  montant,
  quantite_grammes
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'vente',
  'Vente d''or au comptoir SONASP',
  2500000.00,
  75.250
);
```

### Exemple 2: Production avec carte
```sql
INSERT INTO snp_artisan_activities (
  artisan_id,
  carte_id,
  type_activite,
  description,
  quantite_grammes,
  date_activite
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'production',
  'Production mensuelle novembre 2024',
  125.750,
  '2024-11-30'
);
```

### Exemple 3: Insertion multiple depuis SELECT
```sql
INSERT INTO snp_artisan_activities (
  artisan_id,
  carte_id,
  type_activite,
  description,
  montant,
  quantite_grammes,
  created_at
)
SELECT
  c.artisan_id,
  c.id,
  'vente',
  'Vente d''or aurifère',
  (500000 + random() * 5000000)::NUMERIC(15,2),
  (50 + random() * 500)::NUMERIC(10,3),
  CURRENT_DATE - (random() * 90)::INTEGER * INTERVAL '1 day'
FROM snp_cartes_professionnelles c
WHERE c.statut = 'en_exploitation'
LIMIT 30;
```

---

## 🔄 Conversions Utiles

### Grammes vers Onces (si nécessaire)
```sql
-- Calculer les onces à partir des grammes
-- 1 once troy = 31.1034768 grammes
SELECT
  quantite_grammes,
  (quantite_grammes / 31.1034768)::NUMERIC(10,4) as quantite_onces_calculee
FROM snp_artisan_activities;
```

### Agrégations par artisan
```sql
-- Total production par artisan
SELECT
  artisan_id,
  type_activite,
  COUNT(*) as nombre_activites,
  SUM(quantite_grammes) as total_grammes,
  SUM(montant) as total_montant
FROM snp_artisan_activities
GROUP BY artisan_id, type_activite
ORDER BY total_grammes DESC;
```

---

## 📅 Historique des Modifications

| Date | Modification | Raison |
|------|--------------|--------|
| 27/12/2024 | Analyse initiale | Erreur quantite_onces |

---

**Maintenu par:** Équipe Développement Gold Shipper
**Document de référence pour:** Scripts SQL utilisant snp_artisan_activities
**À consulter AVANT:** Tout INSERT, UPDATE ou requête sur cette table
