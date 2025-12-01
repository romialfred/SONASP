# 🔢 Guide: Démarrer la Numérotation BAR Reference à 1204

## 🎯 Problème

Quand vous créez une nouvelle production pour Kouroussa, le système génère `HUMSMK-0001` au lieu de `HUMSMK-1204`.

## 💡 Solution

Le système génère automatiquement le prochain numéro en cherchant la dernière référence dans la base de données. Pour commencer à 1204, il faut que la base contienne déjà `HUMSMK-1203`.

## 🚀 Méthodes

### Méthode 1: Si Vous Avez des Productions Existantes avec HUMKGM

Si vous avez déjà des productions Kouroussa avec l'ancien préfixe `HUMKGM-xxxx`, le script les convertira automatiquement en `HUMSMK-xxxx`.

**Exemple**:
```
HUMKGM-1201 → HUMSMK-1201
HUMKGM-1202 → HUMSMK-1202
HUMKGM-1203 → HUMSMK-1203
```

Prochaine production générée: `HUMSMK-1204` ✅

### Méthode 2: Si Vous N'Avez Aucune Production Existante

Le script créera une production "placeholder" avec `HUMSMK-1203` pour forcer la prochaine à être `HUMSMK-1204`.

**Note**: Cette production sera créée avec le statut `prepared` et une note explicative. Vous pourrez la supprimer après si nécessaire.

## 📝 Exécution du Script

### Étape 1: Ouvrir Supabase SQL Editor

1. Aller sur https://supabase.com/dashboard/project/_/sql
2. Créer un nouveau query

### Étape 2: Copier le Script

Copier **TOUT** le contenu de `SET_BAR_REFERENCE_START_NUMBER.sql`

### Étape 3: Exécuter

Cliquer sur **RUN**

### Étape 4: Observer le Rapport

Le script affichera:
```
Kouroussa ID: [uuid]
Productions avec HUMKGM trouvées: X
✅ X productions mises à jour: HUMKGM -> HUMSMK
Plus haute référence HUMSMK actuelle: HUMSMK-1203

==============================================
VÉRIFICATION FINALE
==============================================
Total productions HUMSMK: X
Plus haute référence HUMSMK: HUMSMK-1203

🎯 La prochaine production générera: HUMSMK-1204
==============================================
```

## ✅ Vérification

Après l'exécution, le script affichera une liste de toutes les productions HUMSMK:

```
production_date | bar_reference | bullion_grams | estimated_oz | status | notes
----------------|---------------|---------------|--------------|--------|-------
2025-10-26      | HUMSMK-1203  | 1000.00       | 29.57        | prepared | Production placeholder...
```

## 🧪 Test

1. Aller dans l'application
2. Créer une nouvelle production
3. Sélectionner "Kouroussa"
4. Vérifier que le BAR Reference généré est: **HUMSMK-1204** ✅

## 🔄 Comment Ça Marche

Le code dans `DailyProductionFormEnhanced.tsx` (lignes 191-223) fonctionne comme suit:

```typescript
// 1. Cherche la dernière référence HUMSMK-*
const { data } = await supabase
  .from('daily_production')
  .select('bar_reference')
  .like('bar_reference', `HUMSMK-%`)
  .order('created_at', { ascending: false })
  .limit(1);

// 2. Extrait le numéro
const lastRef = data[0].bar_reference;  // "HUMSMK-1203"
const match = lastRef.match(/-(\d+)$/); // ["1203"]
nextNumber = parseInt(match[1], 10) + 1; // 1204

// 3. Génère la nouvelle référence
return `HUMSMK-${nextNumber.toString().padStart(4, '0')}`; // "HUMSMK-1204"
```

## ⚠️ Notes Importantes

### Si Vous Avez Déjà HUMSMK-1204 ou Plus

Le script détecte automatiquement si la numérotation est déjà correcte:

```
✅ La numérotation est déjà à 1204 ou plus. Aucune action nécessaire.
```

### Suppression du Placeholder (Optionnel)

Si vous avez créé un placeholder et voulez le supprimer après:

```sql
DELETE FROM daily_production 
WHERE bar_reference = 'HUMSMK-1203' 
AND notes LIKE '%placeholder%';
```

**Attention**: Ceci réinitialisera la numérotation !

### Pour d'Autres Sociétés

Le même principe s'applique pour:
- Komana (SMK) → `HUMSMK-xxxx`
- Dugbe → `HUMDUG-xxxx`
- Mansa Resource → `HUMMRL-xxxx`

Modifiez simplement le préfixe dans le script.

## 📊 Résumé des Options

| Scénario | Action du Script | Résultat |
|----------|------------------|----------|
| Vous avez HUMKGM-1203 | Convertit en HUMSMK-1203 | Prochaine: HUMSMK-1204 ✅ |
| Vous avez HUMKGM-0001 à 1202 | Convertit tous + crée 1203 | Prochaine: HUMSMK-1204 ✅ |
| Vous n'avez rien | Crée HUMSMK-1203 placeholder | Prochaine: HUMSMK-1204 ✅ |
| Vous avez déjà HUMSMK-1204+ | Rien | Continue normalement ✅ |

## 🎯 Résultat Final

Après l'exécution du script et la création d'une nouvelle production:

```
Date: 27/10/2025
Mining Company: Kouroussa
Bar Reference: HUMSMK-1204 ✅
```

---

**Fichiers**:
- `SET_BAR_REFERENCE_START_NUMBER.sql` - Script SQL à exécuter
- `BAR_REFERENCE_START_GUIDE.md` - Ce guide

**Durée d'exécution**: ~2 secondes  
**Réversible**: Oui (voir section Suppression du Placeholder)  
**Impact**: Aucun sur les autres fonctionnalités
