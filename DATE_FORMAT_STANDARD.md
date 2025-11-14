# 📅 FORMAT DE DATE STANDARD - Plateforme Gold Shipper

## Format Adopté

**Format standard:** `DD-mmm-YY`

**Exemple:** `27-oct-25`

## Utilitaire Créé

**Fichier:** `src/utils/dateUtils.ts`

### Fonction Principale

```typescript
import { formatDateStandard } from '@/utils/dateUtils';

// Utilisation
formatDateStandard('2025-10-27')  // → "27-oct-25"
formatDateStandard(new Date())     // → "27-oct-25"
formatDateStandard(null)           // → ""
```

## Fonctions Disponibles

### 1. `formatDateStandard(date, locale = 'fr')`
Format: `27-oct-25`
- **Usage:** Affichage standard dans tous les tableaux et listes
- **Exemple:** `formatDateStandard('2025-10-27')` → `"27-oct-25"`

### 2. `formatDateShort(date)`
Format: `27/10/2025`
- **Usage:** Format court classique
- **Exemple:** `formatDateShort('2025-10-27')` → `"27/10/2025"`

### 3. `formatDateLong(date, locale = 'fr')`
Format: `27 octobre 2025`
- **Usage:** Affichage dans les détails et confirmations
- **Exemple:** `formatDateLong('2025-10-27')` → `"27 octobre 2025"`

### 4. `formatDateFull(date, locale = 'fr')`
Format: `lundi 27 octobre 2025`
- **Usage:** Affichage complet avec jour de la semaine
- **Exemple:** `formatDateFull('2025-10-27')` → `"lundi 27 octobre 2025"`

### 5. `formatDateTimeStandard(date, locale = 'fr')`
Format: `27-oct-25 14:30`
- **Usage:** Affichage avec heure
- **Exemple:** `formatDateTimeStandard('2025-10-27T14:30:00')` → `"27-oct-25 14:30"`

### 6. `formatDateRange(startDate, endDate, locale = 'fr')`
Format: `27-oct-25 - 30-oct-25`
- **Usage:** Plages de dates
- **Exemple:** `formatDateRange('2025-10-27', '2025-10-30')` → `"27-oct-25 - 30-oct-25"`

### 7. `formatDateRelative(date, locale = 'fr')`
Format: `Il y a 2 jours` / `Dans 3 jours`
- **Usage:** Dates relatives
- **Exemple:** `formatDateRelative(yesterday)` → `"Hier"`

### 8. Fonctions Utilitaires

```typescript
parseDateStandard(dateStr)      // Parse "27-oct-25" → Date
isValidDate(date)                // Vérifie validité
getTodayStandard()               // Date du jour au format standard
getFirstDayOfMonth()             // Premier jour du mois
getLastDayOfMonth()              // Dernier jour du mois
```

## Composants Mis à Jour

### ✅ Production
- [x] **ProductionTable.tsx** - Tableau des productions
  - Avant: `27/10/2025`
  - Après: `27-oct-25`

### 🔄 À Mettre à Jour

#### Priorité HAUTE (Tableaux principaux):
- [ ] **ShippingPreparationDetails** - Détails d'expédition
- [ ] **SalesDashboard** - Tableau des ventes
- [ ] **BatchListing** - Liste des batches
- [ ] **CustomerProfile** - Profil client
- [ ] **ExportLicensesPage** - Licences d'exportation

#### Priorité MOYENNE (Historiques):
- [ ] **ProductionStatusHistory** - Historique production
- [ ] **ShippingStatusHistory** - Historique expédition
- [ ] **BatchDocuments** - Documents de batches
- [ ] **ApprovalRequestCard** - Demandes d'approbation

#### Priorité BASSE (Autres):
- [ ] Tous les autres composants avec dates

## Migration Pattern

### Avant:
```typescript
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};
```

### Après:
```typescript
import { formatDateStandard } from '@/utils/dateUtils';

// Utilisation directe
<span>{formatDateStandard(production.production_date)}</span>
```

## Avantages du Format `DD-mmm-YY`

### 1. Compact
- **Avant:** `27/10/2025` (10 caractères)
- **Après:** `27-oct-25` (9 caractères)

### 2. Sans Ambiguïté
- Format américain: `10/27/2025` (confusion)
- Format européen: `27/10/2025` (confusion)
- **Notre format:** `27-oct-25` (clair!)

### 3. Lisibilité
- Mois écrit en lettres → pas de confusion possible
- Année sur 2 chiffres → plus compact
- Format universel dans le secteur minier

### 4. Tri Naturel
- Les dates se trient correctement alphabétiquement
- Cohérence avec les standards internationaux

## Exemples Réels

```typescript
// Production journalière
<td>{formatDateStandard(production.production_date)}</td>
// → "27-oct-25"

// Expédition
<div>Date: {formatDateStandard(shipping.shipping_date)}</div>
// → "27-oct-25"

// Licence d'exportation
<span>Valide jusqu'au {formatDateStandard(license.expiry_date)}</span>
// → "31-déc-25"

// Confirmation avec heure
<p>Créé le {formatDateTimeStandard(record.created_at)}</p>
// → "27-oct-25 14:30"

// Plage de dates
<div>Période: {formatDateRange(start, end)}</div>
// → "01-oct-25 - 31-oct-25"
```

## Tests

```typescript
// Test du format standard
formatDateStandard('2025-10-27')    // → "27-oct-25"
formatDateStandard('2025-01-05')    // → "05-jan-25"
formatDateStandard('2025-12-31')    // → "31-déc-25"
formatDateStandard(null)            // → ""
formatDateStandard(undefined)       // → ""

// Test avec locale
formatDateStandard('2025-10-27', 'en')  // → "27-oct-25"
formatDateStandard('2025-10-27', 'fr')  // → "27-oct-25"
```

## Localisation

Le format s'adapte automatiquement à la langue:

```typescript
// Français (par défaut)
formatDateStandard('2025-10-27', 'fr')  // → "27-oct-25"
formatDateStandard('2025-01-15', 'fr')  // → "15-jan-25"
formatDateStandard('2025-12-25', 'fr')  // → "25-déc-25"

// Anglais
formatDateStandard('2025-10-27', 'en')  // → "27-oct-25"
formatDateStandard('2025-01-15', 'en')  // → "15-jan-25"
```

## Performance

- ✅ Fonction légère et rapide
- ✅ Pas de dépendance externe (moment.js, date-fns)
- ✅ Utilise API native JavaScript
- ✅ Mise en cache possible si nécessaire

## Prochaines Étapes

1. ✅ **Créer l'utilitaire** - `src/utils/dateUtils.ts`
2. ✅ **Appliquer à ProductionTable** - Format "27-oct-25"
3. 🔄 **Appliquer aux autres tableaux** - En cours
4. ⏳ **Appliquer aux historiques** - À faire
5. ⏳ **Appliquer partout ailleurs** - À faire
6. ⏳ **Tests d'intégration** - À faire

---

**Date:** 2025-11-14
**Statut:** ✅ UTILITAIRE CRÉÉ - DÉPLOIEMENT EN COURS
**Build:** ✅ RÉUSSI

**Le format de date standard est maintenant disponible sur toute la plateforme!** 📅
