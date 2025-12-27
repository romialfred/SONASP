# Analyse Structure - snp_carte_statistics

**Date d'analyse:** 27 Décembre 2024
**Analysé suite à:** Erreur `column "artisan_id" does not exist`

---

## 📋 Structure Complète de la Table

### Informations Générales
- **Nom:** `public.snp_carte_statistics`
- **Propriétaire:** postgres
- **Tablespace:** pg_default
- **RLS:** Activé (ENABLED)

---

## 📊 Colonnes Existantes

| Nom Colonne | Type | Nullable | Default | Description |
|-------------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | gen_random_uuid() | Identifiant unique |
| `carte_id` | uuid | NOT NULL | - | Référence carte (UNIQUE) |
| `nombre_ventes` | integer | NULL | 0 | Nombre de ventes |
| `nombre_achats` | integer | NULL | 0 | Nombre d'achats |
| `quantite_totale_grammes` | numeric(15,3) | NULL | 0 | Total grammes |
| `montant_total` | numeric(15,2) | NULL | 0 | Montant total |
| `derniere_activite` | date | NULL | - | Date dernière activité |
| `updated_at` | timestamptz | NULL | now() | Date mise à jour |

---

## ❌ Colonnes qui N'EXISTENT PAS

**ATTENTION:** Ces colonnes n'existent PAS dans la table, ne pas les utiliser:

- ❌ `artisan_id` - **N'EXISTE PAS**
- ❌ `annee` - **N'EXISTE PAS**
- ❌ `mois` - **N'EXISTE PAS**
- ❌ `montant_total_ventes` - **N'EXISTE PAS** (la colonne s'appelle `montant_total`)
- ❌ `quantite_totale_onces` - **N'EXISTE PAS**
- ❌ `nombre_collectes` - **N'EXISTE PAS**
- ❌ `nombre_depots` - **N'EXISTE PAS**
- ❌ `nombre_transactions` - **N'EXISTE PAS**
- ❌ `jours_actifs` - **N'EXISTE PAS**

Si vous avez besoin de ces colonnes, elles doivent d'abord être ajoutées avec un ALTER TABLE.

---

## 🔗 Contraintes

### Primary Key
```sql
CONSTRAINT snp_carte_statistics_pkey PRIMARY KEY (id)
```

### Unique Constraint
```sql
CONSTRAINT snp_carte_statistics_carte_id_key UNIQUE (carte_id)
```

**Important:** Une seule ligne de statistiques par carte professionnelle.

### Foreign Key

#### FK vers snp_cartes_professionnelles
```sql
CONSTRAINT snp_carte_statistics_carte_id_fkey
FOREIGN KEY (carte_id)
REFERENCES public.snp_cartes_professionnelles (id)
ON UPDATE NO ACTION
ON DELETE CASCADE
```

**Cascade DELETE:** Si la carte est supprimée, les statistiques le sont aussi.

---

## 📑 Index

### Index sur carte_id
```sql
CREATE INDEX idx_statistics_carte
ON public.snp_carte_statistics
USING btree (carte_id ASC NULLS LAST)
```

---

## 🔒 Politiques RLS

### Policy: SELECT
```sql
CREATE POLICY "Authenticated users can view statistics"
ON public.snp_carte_statistics
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);
```

### Policy: INSERT
```sql
CREATE POLICY "Authenticated users can insert statistics"
ON public.snp_carte_statistics
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);
```

### Policy: UPDATE
```sql
CREATE POLICY "Authenticated users can update statistics"
ON public.snp_carte_statistics
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
INSERT INTO snp_carte_statistics (
  carte_id,                -- uuid, NOT NULL, OBLIGATOIRE, UNIQUE
  nombre_ventes,           -- integer, nullable, DEFAULT 0
  nombre_achats,           -- integer, nullable, DEFAULT 0
  quantite_totale_grammes, -- numeric(15,3), nullable, DEFAULT 0
  montant_total,           -- numeric(15,2), nullable, DEFAULT 0
  derniere_activite        -- date, nullable
) VALUES (
  'uuid-carte',            -- carte_id
  5,                       -- nombre_ventes
  3,                       -- nombre_achats
  425.500,                 -- quantite_totale_grammes
  3500000.00,              -- montant_total
  CURRENT_DATE             -- derniere_activite
);
```

---

## 🔄 UPSERT Pattern (Recommandé)

Comme `carte_id` est UNIQUE, utilisez `ON CONFLICT` pour mettre à jour:

```sql
-- Pattern recommandé pour incrémenter les statistiques
INSERT INTO snp_carte_statistics (
  carte_id,
  nombre_ventes,
  quantite_totale_grammes,
  montant_total,
  derniere_activite
) VALUES (
  'uuid-carte',
  1,
  50.250,
  500000.00,
  CURRENT_DATE
)
ON CONFLICT (carte_id) DO UPDATE SET
  nombre_ventes = snp_carte_statistics.nombre_ventes + EXCLUDED.nombre_ventes,
  quantite_totale_grammes = snp_carte_statistics.quantite_totale_grammes + EXCLUDED.quantite_totale_grammes,
  montant_total = snp_carte_statistics.montant_total + EXCLUDED.montant_total,
  derniere_activite = GREATEST(snp_carte_statistics.derniere_activite, EXCLUDED.derniere_activite),
  updated_at = now();
```

---

## ❌ Erreurs Courantes

### Erreur 1: Column does not exist
```sql
-- ❌ MAUVAIS
INSERT INTO snp_carte_statistics (artisan_id, annee, mois)
VALUES ('uuid', 2024, 12);

-- Erreur: column "artisan_id" does not exist
-- Erreur: column "annee" does not exist
-- Erreur: column "mois" does not exist
```

**Solution:**
```sql
-- ✅ CORRECT (utiliser seulement les colonnes existantes)
INSERT INTO snp_carte_statistics (carte_id)
VALUES ('uuid-carte');
```

### Erreur 2: Duplicate Key Violation
```sql
-- ❌ MAUVAIS (si carte_id existe déjà)
INSERT INTO snp_carte_statistics (carte_id)
VALUES ('uuid-existant');

-- Erreur: duplicate key value violates unique constraint
-- Erreur: "snp_carte_statistics_carte_id_key"
```

**Solution:**
```sql
-- ✅ CORRECT (utiliser ON CONFLICT)
INSERT INTO snp_carte_statistics (carte_id)
VALUES ('uuid-existant')
ON CONFLICT (carte_id) DO NOTHING;

-- ou pour mettre à jour:
INSERT INTO snp_carte_statistics (carte_id, nombre_ventes)
VALUES ('uuid-existant', 1)
ON CONFLICT (carte_id) DO UPDATE SET
  nombre_ventes = snp_carte_statistics.nombre_ventes + 1,
  updated_at = now();
```

### Erreur 3: Foreign Key Violation
```sql
-- ❌ MAUVAIS (carte_id n'existe pas dans snp_cartes_professionnelles)
INSERT INTO snp_carte_statistics (carte_id)
VALUES ('uuid-inexistant');

-- Erreur: insert or update violates foreign key constraint
-- Erreur: "snp_carte_statistics_carte_id_fkey"
```

**Solution:**
```sql
-- ✅ CORRECT (vérifier que carte_id existe)
INSERT INTO snp_carte_statistics (carte_id)
SELECT id FROM snp_cartes_professionnelles
WHERE id = 'uuid-valide';
```

---

## 🎯 Checklist avant INSERT

Avant d'insérer dans `snp_carte_statistics`, vérifier:

- [ ] ✅ `carte_id` fourni et valide (uuid existant dans snp_cartes_professionnelles)
- [ ] ✅ `carte_id` unique (pas déjà dans la table, ou utiliser ON CONFLICT)
- [ ] ✅ Aucune colonne inexistante (artisan_id, annee, mois, etc.)
- [ ] ✅ Numériques au bon format:
  - `quantite_totale_grammes` → NUMERIC(15,3)
  - `montant_total` → NUMERIC(15,2)
- [ ] ✅ Utiliser ON CONFLICT pour les upserts

---

## 📝 Exemples d'INSERT Réels

### Exemple 1: Insertion simple
```sql
INSERT INTO snp_carte_statistics (
  carte_id,
  nombre_ventes,
  nombre_achats,
  quantite_totale_grammes,
  montant_total,
  derniere_activite
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  10,
  5,
  825.500,
  8500000.00,
  CURRENT_DATE
)
ON CONFLICT (carte_id) DO NOTHING;
```

### Exemple 2: Création initiale pour toutes les cartes
```sql
INSERT INTO snp_carte_statistics (
  carte_id,
  nombre_ventes,
  nombre_achats,
  quantite_totale_grammes,
  montant_total,
  derniere_activite
)
SELECT
  c.id,
  0,
  0,
  0,
  0,
  NULL
FROM snp_cartes_professionnelles c
ON CONFLICT (carte_id) DO NOTHING;
```

### Exemple 3: Création avec données aléatoires
```sql
INSERT INTO snp_carte_statistics (
  carte_id,
  nombre_ventes,
  nombre_achats,
  quantite_totale_grammes,
  montant_total,
  derniere_activite
)
SELECT
  c.id,
  (1 + random() * 5)::INTEGER,
  (1 + random() * 3)::INTEGER,
  (100 + random() * 800)::NUMERIC(15,3),
  (200000 + random() * 3000000)::NUMERIC(15,2),
  CURRENT_DATE - (random() * 30)::INTEGER * INTERVAL '1 day'
FROM snp_cartes_professionnelles c
WHERE c.statut = 'en_exploitation'
ON CONFLICT (carte_id) DO NOTHING;
```

### Exemple 4: Mise à jour incrémentale (après une vente)
```sql
-- Après une vente, mettre à jour les statistiques
INSERT INTO snp_carte_statistics (
  carte_id,
  nombre_ventes,
  quantite_totale_grammes,
  montant_total,
  derniere_activite
)
SELECT
  carte_id,
  1,
  quantite_grammes,
  montant,
  date_activite
FROM snp_artisan_activities
WHERE type_activite = 'vente'
  AND date_activite = CURRENT_DATE
ON CONFLICT (carte_id) DO UPDATE SET
  nombre_ventes = snp_carte_statistics.nombre_ventes + EXCLUDED.nombre_ventes,
  quantite_totale_grammes = snp_carte_statistics.quantite_totale_grammes + EXCLUDED.quantite_totale_grammes,
  montant_total = snp_carte_statistics.montant_total + EXCLUDED.montant_total,
  derniere_activite = GREATEST(snp_carte_statistics.derniere_activite, EXCLUDED.derniere_activite),
  updated_at = now();
```

---

## 🔄 Requêtes Utiles

### Statistiques globales
```sql
SELECT
  COUNT(*) as total_cartes,
  SUM(nombre_ventes) as total_ventes,
  SUM(nombre_achats) as total_achats,
  SUM(quantite_totale_grammes) as total_grammes,
  SUM(montant_total) as total_montant,
  AVG(nombre_ventes) as moyenne_ventes,
  AVG(montant_total) as moyenne_montant
FROM snp_carte_statistics;
```

### Cartes les plus actives
```sql
SELECT
  cs.*,
  c.numero_carte,
  a.nom,
  a.prenom
FROM snp_carte_statistics cs
JOIN snp_cartes_professionnelles c ON cs.carte_id = c.id
JOIN snp_artisans_miniers a ON c.artisan_id = a.id
ORDER BY cs.nombre_ventes DESC
LIMIT 10;
```

### Statistiques par statut de carte
```sql
SELECT
  c.statut,
  COUNT(*) as nombre_cartes,
  SUM(cs.nombre_ventes) as total_ventes,
  SUM(cs.quantite_totale_grammes) as total_grammes,
  AVG(cs.montant_total) as moyenne_montant
FROM snp_carte_statistics cs
JOIN snp_cartes_professionnelles c ON cs.carte_id = c.id
GROUP BY c.statut
ORDER BY total_ventes DESC;
```

---

## 📅 Historique des Modifications

| Date | Modification | Raison |
|------|--------------|--------|
| 27/12/2024 | Analyse initiale | Erreur artisan_id |

---

**Maintenu par:** Équipe Développement Gold Shipper
**Document de référence pour:** Scripts SQL utilisant snp_carte_statistics
**À consulter AVANT:** Tout INSERT, UPDATE ou requête sur cette table
