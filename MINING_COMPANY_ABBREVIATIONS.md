# Mining Company Abbreviations

## 📋 Liste des Abbreviations

Cette liste définit les codes à 3 lettres utilisés dans les numéros d'expédition.

### Format Expedition/Lot Number

```
HUM-{ABBREVIATION}-XXXX/YYYY

Exemple : HUM-KGM-0001/2024
```

## 🏭 Abbreviations Configurées Automatiquement

| Mine | Abbreviation | Format Exemple |
|------|--------------|----------------|
| **Kouroussa Gold Mines** | `KGM` | HUM-KGM-0001/2024 |
| **Société des Mines de Komana** | `SMK` | HUM-SMK-0001/2024 |
| **Dugbe** | `DGB` | HUM-DGB-0001/2024 |
| **Yanfolila** | `YFL` | HUM-YFL-0001/2024 |

## ➕ Ajouter une Nouvelle Abbreviation

### Via SQL

```sql
UPDATE mining_companies
SET abbreviation = 'XXX'  -- Code 3 lettres en MAJUSCULES
WHERE id = '<mining-company-id>';
```

### Recommandations

- **3 lettres** maximum (mais 10 caractères acceptés en base)
- **MAJUSCULES** pour la cohérence
- **Unique** pour chaque mine
- **Significatif** : basé sur le nom de la mine

### Exemples d'Abbreviations

| Nom Complet | Abbreviation Suggérée |
|-------------|----------------------|
| Kouroussa Gold Mines | KGM |
| Société des Mines de Komana | SMK |
| Dugbe Gold Mine | DGB |
| Yanfolila Gold Project | YFL |
| Morila Gold Mine | MGL |
| Syama Gold Mine | SYM |
| Fekola Mine | FKL |
| Gounkoto Mine | GKT |
| Sadiola Mine | SDL |
| Loulo Mine | LLO |

## 🔍 Vérifier les Abbreviations

### Lister toutes les mines avec leurs abbreviations

```sql
SELECT
  id,
  name,
  abbreviation,
  is_active,
  created_at
FROM mining_companies
ORDER BY name;
```

### Lister les mines SANS abbreviation

```sql
SELECT
  id,
  name,
  abbreviation
FROM mining_companies
WHERE is_active = true
  AND (abbreviation IS NULL OR abbreviation = '');
```

### Compter les expéditions par mine

```sql
SELECT
  mc.name,
  mc.abbreviation,
  COUNT(sp.id) as total_expeditions
FROM mining_companies mc
LEFT JOIN shipping_preparations sp ON sp.mining_company_id = mc.id
WHERE mc.is_active = true
GROUP BY mc.id, mc.name, mc.abbreviation
ORDER BY total_expeditions DESC;
```

## 🔄 Modifier une Abbreviation

**⚠️ ATTENTION** : Modifier une abbreviation n'affecte **PAS** les expéditions passées (les numéros sont déjà générés et stockés).

```sql
-- Voir l'abbreviation actuelle
SELECT name, abbreviation
FROM mining_companies
WHERE id = '<company-id>';

-- Modifier
UPDATE mining_companies
SET abbreviation = 'NEW'
WHERE id = '<company-id>';

-- Vérifier
SELECT name, abbreviation
FROM mining_companies
WHERE id = '<company-id>';
```

**Impact** :
- ✅ Futures expéditions utiliseront la nouvelle abbreviation
- ℹ️ Expéditions passées conservent leur numéro d'origine

## 📊 Statistiques par Abbreviation

### Nombre d'expéditions par abbreviation

```sql
SELECT
  SUBSTRING(expedition_lot_number FROM 'HUM-([A-Z]+)-') as abbreviation,
  COUNT(*) as total,
  MIN(created_at) as first_expedition,
  MAX(created_at) as last_expedition
FROM shipping_preparations
WHERE expedition_lot_number IS NOT NULL
GROUP BY SUBSTRING(expedition_lot_number FROM 'HUM-([A-Z]+)-')
ORDER BY total DESC;
```

### Compteurs actuels par mine

```sql
SELECT
  mc.name,
  mc.abbreviation,
  elc.year,
  elc.counter,
  elc.updated_at as last_use
FROM expedition_lot_counters elc
JOIN mining_companies mc ON mc.id = elc.mining_company_id
ORDER BY elc.year DESC, mc.name;
```

## 🛠️ Scripts de Maintenance

### Réinitialiser un compteur (si nécessaire)

```sql
-- ⚠️ DANGER : Utilisez avec précaution !
DELETE FROM expedition_lot_counters
WHERE mining_company_id = '<company-id>'
  AND year = 2024;

-- Ou réinitialiser à zéro
UPDATE expedition_lot_counters
SET counter = 0
WHERE mining_company_id = '<company-id>'
  AND year = 2024;
```

### Synchroniser les abbreviations depuis les noms

```sql
-- Si de nouvelles mines ont été ajoutées
DO $$
BEGIN
  -- Ajouter vos patterns ici
  UPDATE mining_companies
  SET abbreviation = 'XXX'
  WHERE LOWER(name) LIKE '%pattern%'
    AND (abbreviation IS NULL OR abbreviation = '');
END $$;
```

## 📝 Règles et Conventions

### Longueur
- **Recommandé** : 3 caractères (KGM, SMK, DGB)
- **Maximum** : 10 caractères (en base de données)

### Format
- **MAJUSCULES** uniquement
- **Lettres** uniquement (pas de chiffres ni caractères spéciaux)
- **Pas d'espaces**

### Unicité
- Chaque mine doit avoir une abbreviation **unique**
- Pas de doublons autorisés
- Vérifier avant d'ajouter :

```sql
SELECT abbreviation, COUNT(*)
FROM mining_companies
WHERE abbreviation IS NOT NULL
GROUP BY abbreviation
HAVING COUNT(*) > 1;
```

## ✅ Checklist Configuration

- [ ] Migration appliquée
- [ ] Colonne `abbreviation` existe dans `mining_companies`
- [ ] Toutes les mines actives ont une abbreviation
- [ ] Aucune abbreviation en double
- [ ] Fonction `get_next_expedition_lot_number` existe
- [ ] Test de génération réussi pour chaque mine
- [ ] Documentation communiquée à l'équipe

## 🎯 Impact Utilisateur

### Dans l'application

1. User sélectionne une mine
2. Abbreviation récupérée automatiquement
3. Compteur incrémenté
4. Numéro affiché : **HUM-{ABBREVIATION}-XXXX/YYYY**

### Exemple d'utilisation

```
User : "Nouvelle expédition"
Sélectionne : "Kouroussa"
→ Numéro généré : HUM-KGM-0001/2024

User : "Nouvelle expédition"
Sélectionne : "Kouroussa"
→ Numéro généré : HUM-KGM-0002/2024

User : "Nouvelle expédition"
Sélectionne : "Komana"
→ Numéro généré : HUM-SMK-0001/2024
```

---

**Gardez ce fichier à jour avec toutes les nouvelles abbreviations !** 📌
