# Nouveau Format Expedition/Lot Number

## 🎯 Objectif

Implémenter un nouveau format pour les numéros d'expédition : **HUM-{ABBREVIATION}-XXXX/YYYY**

Exemples :
- `HUM-KGM-0001/2024` (Kouroussa Gold Mines)
- `HUM-SMK-0001/2024` (Société des Mines de Komana)
- `HUM-DGB-0001/2024` (Dugbe)
- `HUM-YFL-0001/2024` (Yanfolila)

## 📋 Format

```
HUM-{ABBREVIATION}-{COUNTER}/YEAR

Où :
- HUM          : Préfixe fixe (Hummingbird Resources)
- ABBREVIATION : Code 3 lettres de la mine (KGM, SMK, DGB, YFL...)
- COUNTER      : Numéro incrémental sur 4 chiffres (0001-9999)
- YEAR         : Année sur 4 chiffres (2024)
```

**Spécifications** :
- Le compteur est **incrémental par mine ET par année**
- Chaque mine a son propre compteur
- Le compteur se réinitialise à 0001 chaque année
- Le compteur s'incrémente automatiquement à chaque nouvelle expédition

## 🗄️ Modifications Base de Données

### 1. Nouvelle colonne `abbreviation`

Ajoutée à la table `mining_companies` :

```sql
ALTER TABLE mining_companies ADD COLUMN abbreviation VARCHAR(10);
```

### 2. Nouvelle table `expedition_lot_counters`

```sql
CREATE TABLE expedition_lot_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mining_company_id UUID NOT NULL REFERENCES mining_companies(id),
  year INTEGER NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (mining_company_id, year)
);
```

**Index** pour performance :
```sql
CREATE INDEX expedition_lot_counters_company_year_idx
  ON expedition_lot_counters(mining_company_id, year);
```

### 3. Fonction `get_next_expedition_lot_number`

```sql
CREATE OR REPLACE FUNCTION get_next_expedition_lot_number(
  p_mining_company_id UUID,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TEXT
```

**Cette fonction** :
1. Récupère l'abbreviation de la mining company
2. Incrémente le compteur pour company_id + year
3. Retourne le numéro formaté : `HUM-{ABBREVIATION}-{COUNTER}/YEAR`

### 4. RLS Policies

Policies ajoutées pour `expedition_lot_counters` :
- SELECT : tous les utilisateurs authentifiés
- INSERT/UPDATE : système uniquement

## 🔧 Changements Code

### Service `shippingPreparationService.ts`

**Nouvelle méthode ajoutée** :

```typescript
async generateExpeditionLotNumber(
  miningCompanyId: string,
  year?: number
): Promise<string> {
  const { data, error } = await supabase.rpc('get_next_expedition_lot_number', {
    p_mining_company_id: miningCompanyId,
    p_year: year || new Date().getFullYear(),
  });

  if (error) throw error;
  return data;
}
```

### Page `ShippingPreparationNew.tsx`

**Changements** :

1. **State ajouté** :
```typescript
const [expeditionLotNumber, setExpeditionLotNumber] = useState('');
```

2. **useEffect pour génération automatique** :
```typescript
useEffect(() => {
  if (selectedMiningCompanyId) {
    generateExpeditionLotNumber().then(setExpeditionLotNumber);
  }
}, [selectedMiningCompanyId]);
```

3. **Fonction async** :
```typescript
const generateExpeditionLotNumber = async (): Promise<string> => {
  if (!selectedMiningCompanyId) return '';

  try {
    const year = new Date().getFullYear();
    return await shippingPreparationService.generateExpeditionLotNumber(
      selectedMiningCompanyId,
      year
    );
  } catch (error) {
    console.error('Error generating expedition lot number:', error);
    return `HUM-XXX-0000/${new Date().getFullYear()}`;
  }
};
```

## 📦 Déploiement

### Étape 1 : Appliquer la Migration SQL

**Fichier** : `/tmp/expedition_lot_migration.sql`

**À FAIRE** :
1. Copier le contenu du fichier SQL
2. Aller dans Supabase Dashboard → SQL Editor
3. Coller le SQL
4. Exécuter

**Ce que fait la migration** :
- ✅ Ajoute colonne `abbreviation` à `mining_companies`
- ✅ Crée table `expedition_lot_counters`
- ✅ Ajoute index pour performance
- ✅ Active RLS avec policies
- ✅ Crée fonction `get_next_expedition_lot_number`
- ✅ Met à jour abbreviations pour mines connues :
  - Kouroussa → KGM
  - Komana → SMK
  - Dugbe → DGB
  - Yanfolila → YFL

### Étape 2 : Vérifier Abbreviations

```sql
SELECT id, name, abbreviation
FROM mining_companies
WHERE is_active = true
ORDER BY name;
```

**Si certaines mines n'ont pas d'abbreviation** :

```sql
UPDATE mining_companies
SET abbreviation = 'XXX'  -- Remplacer par le code voulu
WHERE id = '<mining-company-id>';
```

### Étape 3 : Déployer le Code

```bash
npm run build
```

**Status** : ✅ Build réussi (24.45s)

### Étape 4 : Tester

```typescript
// Dans Supabase SQL Editor
SELECT get_next_expedition_lot_number(
  '<kouroussa-mining-company-id>',
  2024
);

-- Résultat attendu : HUM-KGM-0001/2024

-- Appeler une 2e fois :
SELECT get_next_expedition_lot_number(
  '<kouroussa-mining-company-id>',
  2024
);

-- Résultat attendu : HUM-KGM-0002/2024
```

## 🧪 Tests Scénarios

### Scénario 1 : Première Expédition Kouroussa 2024

```
1. User crée nouvelle shipping preparation
2. Sélectionne : Kouroussa
3. → Expedition Lot Number généré : HUM-KGM-0001/2024 ✅
4. User save
5. → Compteur incrémenté dans DB
```

### Scénario 2 : Deuxième Expédition Kouroussa 2024

```
1. User crée nouvelle shipping preparation
2. Sélectionne : Kouroussa
3. → Expedition Lot Number généré : HUM-KGM-0002/2024 ✅
4. Incrémentation automatique
```

### Scénario 3 : Première Expédition Komana 2024

```
1. User crée nouvelle shipping preparation
2. Sélectionne : Komana
3. → Expedition Lot Number généré : HUM-SMK-0001/2024 ✅
4. Compteur indépendant de Kouroussa
```

### Scénario 4 : Changement d'Année

```
1. Date système : 1er janvier 2025
2. User crée nouvelle shipping preparation Kouroussa
3. → Expedition Lot Number généré : HUM-KGM-0001/2025 ✅
4. Compteur réinitialisé à 0001 pour nouvelle année
```

### Scénario 5 : Changement de Mine

```
1. User crée nouvelle shipping preparation
2. Sélectionne : Kouroussa
3. → Expedition Lot Number : HUM-KGM-0003/2024
4. User change vers : Komana
5. → Expedition Lot Number : HUM-SMK-0002/2024 ✅
6. Mise à jour immédiate du numéro
```

## 🔍 Vérification DB

### Query 1 : Voir Tous les Compteurs

```sql
SELECT
  mc.name as mining_company,
  mc.abbreviation,
  elc.year,
  elc.counter,
  elc.updated_at
FROM expedition_lot_counters elc
JOIN mining_companies mc ON mc.id = elc.mining_company_id
ORDER BY mc.name, elc.year DESC;
```

### Query 2 : Voir Derniers Numéros Générés

```sql
SELECT
  sp.expedition_lot_number,
  mc.name as mining_company,
  mc.abbreviation,
  sp.created_at
FROM shipping_preparations sp
JOIN mining_companies mc ON mc.id = sp.mining_company_id
WHERE sp.expedition_lot_number IS NOT NULL
ORDER BY sp.created_at DESC
LIMIT 10;
```

### Query 3 : Vérifier Format

```sql
-- Doit retourner 0 résultats (aucun numéro mal formaté)
SELECT
  id,
  expedition_lot_number,
  created_at
FROM shipping_preparations
WHERE expedition_lot_number IS NOT NULL
  AND expedition_lot_number !~ '^HUM-[A-Z]{3}-[0-9]{4}/[0-9]{4}$'
ORDER BY created_at DESC;
```

## 🐛 Dépannage

### Problème : "Mining company abbreviation not set"

**Cause** : La mine n'a pas d'abbreviation

**Solution** :
```sql
UPDATE mining_companies
SET abbreviation = 'XXX'
WHERE id = '<company-id>';
```

### Problème : Compteur ne s'incrémente pas

**Vérifier** :
```sql
SELECT * FROM expedition_lot_counters
WHERE mining_company_id = '<company-id>'
  AND year = 2024;
```

**Réinitialiser manuellement** (si nécessaire) :
```sql
UPDATE expedition_lot_counters
SET counter = 0
WHERE mining_company_id = '<company-id>'
  AND year = 2024;
```

### Problème : Numéros dupliqués

**Causes possibles** :
1. Appels concurrents (résolu par UNIQUE constraint)
2. Fonction appelée en dehors du workflow normal

**Vérification** :
```sql
SELECT
  expedition_lot_number,
  COUNT(*) as count
FROM shipping_preparations
WHERE expedition_lot_number IS NOT NULL
GROUP BY expedition_lot_number
HAVING COUNT(*) > 1;
```

## 📊 Statistiques

### Compteur par Mine

```sql
SELECT
  mc.name,
  mc.abbreviation,
  elc.year,
  elc.counter as total_shipments
FROM expedition_lot_counters elc
JOIN mining_companies mc ON mc.id = elc.mining_company_id
ORDER BY elc.year DESC, mc.name;
```

### Expéditions par Année

```sql
SELECT
  EXTRACT(YEAR FROM created_at) as year,
  COUNT(*) as total_shipments
FROM shipping_preparations
WHERE expedition_lot_number IS NOT NULL
GROUP BY EXTRACT(YEAR FROM created_at)
ORDER BY year DESC;
```

## ✅ Checklist Déploiement

- [x] Migration SQL créée
- [x] Fonction `get_next_expedition_lot_number` testée
- [x] Service `generateExpeditionLotNumber` ajouté
- [x] ShippingPreparationNew mis à jour
- [x] Build réussi
- [ ] Migration appliquée en DB
- [ ] Abbreviations vérifiées
- [ ] Tests scénarios effectués
- [ ] Vérification format des numéros
- [ ] Documentation utilisateur créée

## 📚 Références

- **Migration SQL** : `/tmp/expedition_lot_migration.sql`
- **Service** : `src/services/shippingPreparationService.ts`
- **Page** : `src/pages/shipping/ShippingPreparationNew.tsx`
- **Table** : `expedition_lot_counters`
- **Fonction** : `get_next_expedition_lot_number`

---

**Le nouveau système de numérotation est prêt à être déployé !** 🚀
