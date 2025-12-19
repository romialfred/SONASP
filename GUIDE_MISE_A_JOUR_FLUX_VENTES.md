# Guide de Mise à Jour du Flux de Ventes d'Or

## Résumé des Changements

Le flux de ventes a été mis à jour pour refléter la structure réelle:

### Flux 1: KGM (Kourousa Guinea Mining)
```
KGM vend 100% → MMME (Mansa Management Middle East)
  └─ MMME redistribue:
     ├─ 93% → Auranet International
     ├─  5% → Aurion Trading
     └─  2% → Coris Investment Group (CIG)
```

### Flux 2: SMK (Société des Mines Komana)
```
SMK vend 100% → HBR (Hummingbird Resources)
  └─ HBR redistribue:
     └─ 100% → Auramet
```

## Étapes d'Installation

### 1. Appliquer les Scripts SQL

Dans Supabase SQL Editor, exécuter **dans cet ordre**:

#### A. Créer les nouveaux clients et relations primaires
```
Fichier: SETUP_NEW_SALES_FLOW.sql
```
Ce script va:
- Créer 5 nouveaux clients (MMME, HBR, Auranet, Aurion, CIG)
- Configurer KGM → MMME
- Configurer SMK → HBR

#### B. Créer le système de distribution secondaire
```
Fichier: CREATE_SECONDARY_DISTRIBUTION_TABLE.sql
```
Ce script va:
- Créer la table `secondary_distributions`
- Configurer MMME → Auranet (93%), Aurion (5%), CIG (2%)
- Configurer HBR → Auramet (100%)

### 2. Vérifier l'Installation

```sql
-- Vérifier les nouveaux clients
SELECT name, country FROM customers
WHERE name IN (
  'Mansa Management Middle East',
  'Hummingbird Resources',
  'Auranet International',
  'Aurion Trading',
  'Coris Investment Group'
);

-- Vérifier les distributions secondaires
SELECT
  ic.name as intermediaire,
  ec.name as client_final,
  sd.distribution_percentage as pourcentage
FROM secondary_distributions sd
JOIN customers ic ON ic.id = sd.intermediary_customer_id
JOIN customers ec ON ec.id = sd.end_customer_id
WHERE sd.is_active = true
ORDER BY ic.name, sd.distribution_percentage DESC;
```

### 3. Tester l'Interface

1. Rafraîchir l'application (Ctrl+F5)
2. Aller dans Gold Trade Space ou Sales
3. Vérifier le nouveau diagramme de flux

## Ce Qui a Changé

### Base de Données

1. **5 Nouveaux Clients**
   - MMME (Émirats Arabes Unis)
   - HBR (Royaume-Uni)
   - Auranet (États-Unis)
   - Aurion (Suisse)
   - CIG (Burkina Faso)

2. **Nouvelle Table: `secondary_distributions`**
   - Gère les distributions des intermédiaires vers les clients finaux
   - Validation automatique: total ne peut pas dépasser 100%
   - Historique complet avec audit trail

### Interface Utilisateur

Le diagramme `GoldSalesFlowDiagram` affiche maintenant:
- **2 sections distinctes** pour les deux flux
- **Section bleue** pour KGM avec 3 clients finaux
- **Section verte** pour SMK avec 1 client final
- **Statistiques résumées** en bas

## Validation des Données

Le système inclut des validations automatiques:

### ✅ Validation des Pourcentages
- Le total des distributions d'un intermédiaire ne peut pas dépasser 100%
- Exemple: MMME distribue 93% + 5% + 2% = 100% ✓

### ✅ Prévention des Erreurs
- Un intermédiaire ne peut pas se distribuer à lui-même
- Les pourcentages doivent être > 0 et ≤ 100
- Les relations doivent pointer vers des clients valides

## Structure Technique

### Relations Primaires (gold_sales_settings)
```
Mine → Intermédiaire [100%]
- KGM → MMME
- SMK → HBR
```

### Relations Secondaires (secondary_distributions)
```
Intermédiaire → Clients Finaux [pourcentages multiples]
- MMME → Auranet (93%)
- MMME → Aurion (5%)
- MMME → CIG (2%)
- HBR → Auramet (100%)
```

## Vérifications de Sécurité

Toutes les tables ont des politiques RLS (Row Level Security):
- ✅ Seuls les utilisateurs authentifiés peuvent accéder aux données
- ✅ Tous les changements sont audités
- ✅ Les permissions sont contrôlées au niveau de la base de données

## Dépannage

### Problème: Les clients ne sont pas créés
**Solution:**
- Vérifier que le script SQL s'est exécuté sans erreur
- Vérifier les permissions sur la table customers
- Vérifier qu'il n'y a pas de conflit d'emails

### Problème: Le diagramme ne s'affiche pas correctement
**Solution:**
- Vider le cache du navigateur (Ctrl+Shift+Delete)
- Faire un hard refresh (Ctrl+F5)
- Vérifier la console du navigateur pour les erreurs

### Problème: Les distributions ne s'affichent pas
**Solution:**
- Vérifier que la table secondary_distributions existe
- Vérifier que is_active = true pour les distributions
- Vérifier que les IDs des clients correspondent

## Statut du Build

✅ **Build réussi** sans erreurs
✅ **Vérifications TypeScript** passées
✅ **Composant UI** mis à jour
✅ **Scripts SQL** prêts à être appliqués

## Prochaines Étapes

1. ✅ Corriger l'erreur RLS sur customers (déjà fait)
2. ⏳ Appliquer les scripts SQL dans Supabase
3. ⏳ Tester le flux dans l'interface
4. ⏳ Vérifier la création de ventes avec la nouvelle structure

## Fichiers Créés

- `SETUP_NEW_SALES_FLOW.sql` - Création des clients et relations primaires
- `CREATE_SECONDARY_DISTRIBUTION_TABLE.sql` - Système de distribution secondaire
- `GOLD_SALES_FLOW_IMPLEMENTATION_COMPLETE.md` - Documentation complète (EN)
- `GUIDE_MISE_A_JOUR_FLUX_VENTES.md` - Ce guide (FR)

## Support

Si vous rencontrez des problèmes:
1. Vérifier les logs Supabase
2. Vérifier la console du navigateur
3. Vérifier que tous les scripts SQL ont été appliqués dans l'ordre
