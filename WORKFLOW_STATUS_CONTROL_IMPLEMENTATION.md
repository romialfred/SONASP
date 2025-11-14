# Implémentation du Contrôle Strict des Statuts par Module ✅

## 📋 Vue d'Ensemble

Cette implémentation établit un **système de contrôle rigoureux** des changements de statut basé sur le module/phase où se trouve chaque entité. Une fois qu'une entité passe à une phase suivante, le module précédent **NE PEUT PLUS** modifier son statut.

## 🎯 Règle Fondamentale

> **Une entité ne peut être modifiée QUE par le module responsable de sa phase actuelle.**

### Matrice de Contrôle par Module/Phase

| Phase | Étape 1 | Étape 2 | Étape 3 |
|-------|---------|---------|---------|
| **Production** | Préparé | Prêt pour la douane | - |
| **Shipping Préparation** | Prêt pour la douane | Approuvé par la douane | Prêt pour Expédition |
| **Freight & Customs** | Prêt pour Expédition | Expédié à la raffinerie | - |
| **Refinery** | Expédié à la raffinerie | Raffinée | - |
| **Inventory** | En inventaire | - | - |
| **Sale** | En vente | Vendu | Payé |

## 🏗️ Architecture de l'Implémentation

### 1. Service Central de Contrôle

**Fichier:** `/src/services/statusTransitionControlService.ts`

Ce service contient toute la logique de contrôle:

```typescript
// Modules du système
enum WorkflowModule {
  PRODUCTION = 'production',
  SHIPPING_PREPARATION = 'shipping_preparation',
  FREIGHT_CUSTOMS = 'freight_customs',
  REFINERY = 'refinery',
  INVENTORY = 'inventory',
  SALE = 'sale'
}

// Matrice de contrôle stricte
const STATUS_MODULE_CONTROL_MATRIX: Record<WorkflowModule, string[]> = {
  [WorkflowModule.PRODUCTION]: ['prepared', 'ready_for_customs'],
  [WorkflowModule.SHIPPING_PREPARATION]: ['ready_for_customs', 'customs_approved', 'ready_for_expedition'],
  // ... autres modules
};
```

#### Fonctions Principales

##### `canModuleChangeStatus(module, currentStatus)`
Vérifie si un module peut modifier un statut donné.

```typescript
canModuleChangeStatus(WorkflowModule.PRODUCTION, 'prepared'); // true
canModuleChangeStatus(WorkflowModule.PRODUCTION, 'customs_approved'); // false
```

##### `canModuleTransitionStatus(module, currentStatus, newStatus)`
Vérifie si une transition est autorisée pour un module.

```typescript
const result = canModuleTransitionStatus(
  WorkflowModule.PRODUCTION,
  'prepared',
  'ready_for_customs'
);
// { allowed: true }

const result2 = canModuleTransitionStatus(
  WorkflowModule.PRODUCTION,
  'customs_approved',
  'ready_for_expedition'
);
// { allowed: false, reason: "Le statut ne peut être modifié que par..." }
```

##### `getAvailableTransitions(module, currentStatus)`
Retourne les transitions possibles pour un module.

```typescript
getAvailableTransitions(WorkflowModule.PRODUCTION, 'prepared');
// ['ready_for_customs', 'cancelled']

getAvailableTransitions(WorkflowModule.PRODUCTION, 'customs_approved');
// [] - Aucune transition possible depuis Production
```

### 2. Hook React

**Fichier:** `/src/hooks/useStatusTransitionControl.ts`

Interface simple pour utiliser le contrôle dans les composants:

```typescript
const transitionControl = useStatusTransitionControl(
  WorkflowModule.PRODUCTION,
  'ready_for_customs'
);

// Permissions
transitionControl.canChangeStatus        // true/false
transitionControl.shouldShowButton       // true/false
transitionControl.availableTransitions   // ['customs_approved', ...]
transitionControl.checkTransition('customs_approved') // true/false

// Information
transitionControl.responsibilityMessage  // "Ce statut est géré par..."
transitionControl.nextRecommendedStatus  // 'customs_approved'
transitionControl.isFinished             // false
```

### 3. Composant de Workflow en Lecture Seule

**Fichier:** `/src/components/common/ReadOnlyStatusWorkflow.tsx`

Composant affichant le workflow complet avec historique, utilisable dans **TOUS** les modules:

```tsx
<ReadOnlyStatusWorkflow
  currentStatus={production.status}
  history={statusHistory}
/>
```

**Fonctionnalités:**
- ✅ Affichage du statut actuel
- ✅ Module responsable
- ✅ Ligne de progression visuelle
- ✅ Historique complet des changements
- ✅ Aucun bouton de modification
- ✅ Réutilisable partout

### 4. Composant de Workflow Modifiable

**Fichier:** `/src/components/production/ProductionStatusWorkflow.tsx`

Composant avec contrôle strict intégré:

```typescript
// Intègre le contrôle automatiquement
const transitionControl = useStatusTransitionControl(
  WorkflowModule.PRODUCTION,
  currentStatus
);

// Affiche le bouton UNIQUEMENT si autorisé
{nextStatus && !isLocked && transitionControl.checkTransition(nextStatus) && (
  <Button onClick={() => setShowConfirmModal(true)}>
    Passer à: {nextStatus}
  </Button>
)}

// Affiche un message si verrouillé
{isLocked && (
  <div className="bg-amber-50 border-2 border-amber-300">
    <AlertCircle />
    Statut verrouillé pour le module Production
    {transitionControl.responsibilityMessage}
  </div>
)}
```

## 🎨 Interface Utilisateur

### État 1: Statut Modifiable
Quand le module PEUT modifier le statut:

```
┌─────────────────────────────────────────────────┐
│ ℹ️  Dernière étape modifiable depuis Production │
│                                                  │
│ Après validation, la production sera gérée      │
│ par le module Préparation d'Expédition.         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Statut Actuel: Prêt pour la Douane             │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ [Bouton] Passer à: Approuvé par la Douane      │
└─────────────────────────────────────────────────┘
```

### État 2: Statut Verrouillé
Quand le module NE PEUT PAS modifier:

```
┌─────────────────────────────────────────────────┐
│ ⚠️  Statut verrouillé pour le module Production │
│                                                  │
│ Ce statut est géré par le module:               │
│ Préparation d'Expédition                        │
│                                                  │
│ Les modifications doivent être effectuées       │
│ depuis le module approprié.                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🔒 Changement de statut verrouillé              │
│    Géré par un autre module                     │
└─────────────────────────────────────────────────┘
```

## 🔄 Flux de Travail Complet

### Exemple: Production → Expédition → Raffinerie

#### Phase 1: Module PRODUCTION

```typescript
// ✅ Peut faire: Préparé → Prêt pour la Douane
canModuleTransitionStatus(
  WorkflowModule.PRODUCTION,
  'prepared',
  'ready_for_customs'
); // { allowed: true }

// ❌ Ne peut PAS faire: Après "Prêt pour la Douane"
canModuleTransitionStatus(
  WorkflowModule.PRODUCTION,
  'ready_for_customs',
  'customs_approved'
); // { allowed: false, reason: "..." }
```

#### Phase 2: Module SHIPPING_PREPARATION

```typescript
// ✅ Prend le relais
canModuleTransitionStatus(
  WorkflowModule.SHIPPING_PREPARATION,
  'ready_for_customs',
  'customs_approved'
); // { allowed: true }

// ✅ Continue
canModuleTransitionStatus(
  WorkflowModule.SHIPPING_PREPARATION,
  'customs_approved',
  'ready_for_expedition'
); // { allowed: true }
```

#### Phase 3: Module FREIGHT_CUSTOMS

```typescript
// ✅ Gère l'expédition
canModuleTransitionStatus(
  WorkflowModule.FREIGHT_CUSTOMS,
  'ready_for_expedition',
  'shipped_to_refinery'
); // { allowed: true }
```

#### Phase 4: Module REFINERY

```typescript
// ✅ Gère le raffinage
canModuleTransitionStatus(
  WorkflowModule.REFINERY,
  'shipped_to_refinery',
  'refined'
); // { allowed: true }
```

## 📊 Diagramme de Flux

```
┌─────────────┐
│ PRODUCTION  │
│             │
│ Préparé ────────────┐
│             │       │
│ Prêt pour   │       │ MODULE PRODUCTION
│ la Douane ──────────┘ peut modifier
│             │
│ [VERROUILLÉ]│ ← Plus de modification possible
└─────────────┘

┌─────────────────────┐
│ SHIPPING            │
│ PREPARATION         │
│                     │
│ Prêt pour ──────────┐
│ la Douane           │
│                     │ MODULE SHIPPING
│ Approuvé ───────────┤ PREPARATION
│ par Douane          │ peut modifier
│                     │
│ Prêt pour ──────────┘
│ Expédition          │
│                     │
│ [VERROUILLÉ]        │ ← Plus de modification
└─────────────────────┘

┌─────────────────────┐
│ FREIGHT & CUSTOMS   │
│                     │
│ Prêt pour ──────────┐
│ Expédition          │ MODULE FREIGHT
│                     │ CUSTOMS
│ Expédié à ──────────┘ peut modifier
│ la Raffinerie       │
│                     │
│ [VERROUILLÉ]        │
└─────────────────────┘
```

## 🛡️ Sécurité et Validation

### Validation Côté Backend

Le service peut être utilisé côté backend pour valider:

```typescript
// Dans une fonction Edge ou un trigger
import { validateTransition, WorkflowModule } from '@/services/statusTransitionControlService';

try {
  validateTransition(
    WorkflowModule.PRODUCTION,
    currentStatus,
    newStatus
  );
  // ✅ Transition autorisée - procéder
} catch (error) {
  // ❌ Transition refusée - rejeter
  if (error instanceof StatusTransitionError) {
    return { error: error.message };
  }
}
```

### Gestion des Erreurs

```typescript
class StatusTransitionError extends Error {
  constructor(
    public module: WorkflowModule,
    public currentStatus: string,
    public attemptedStatus: string,
    message: string
  ) {
    super(message);
    this.name = 'StatusTransitionError';
  }
}
```

## 🧪 Tests et Validation

### Tests Unitaires Recommandés

```typescript
describe('statusTransitionControlService', () => {
  describe('Production Module', () => {
    it('should allow transition from prepared to ready_for_customs', () => {
      const result = canModuleTransitionStatus(
        WorkflowModule.PRODUCTION,
        'prepared',
        'ready_for_customs'
      );
      expect(result.allowed).toBe(true);
    });

    it('should deny transition from customs_approved', () => {
      const result = canModuleTransitionStatus(
        WorkflowModule.PRODUCTION,
        'customs_approved',
        'ready_for_expedition'
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('Shipping Preparation Module', () => {
    it('should allow transition from ready_for_customs', () => {
      const result = canModuleTransitionStatus(
        WorkflowModule.SHIPPING_PREPARATION,
        'ready_for_customs',
        'customs_approved'
      );
      expect(result.allowed).toBe(true);
    });
  });
});
```

## 📚 Utilisation dans d'Autres Modules

### Exemple: Module Shipping Preparation

```tsx
import { WorkflowModule, useStatusTransitionControl } from '@/hooks/useStatusTransitionControl';

function ShippingPreparationDetails({ shipping }) {
  const transitionControl = useStatusTransitionControl(
    WorkflowModule.SHIPPING_PREPARATION,  // ← Module SHIPPING
    shipping.status
  );

  return (
    <div>
      {/* Workflow avec contrôle */}
      {transitionControl.canChangeStatus ? (
        <StatusChangeButton
          availableTransitions={transitionControl.availableTransitions}
        />
      ) : (
        <LockedStatusMessage
          message={transitionControl.responsibilityMessage}
        />
      )}
    </div>
  );
}
```

### Exemple: Module Freight & Customs

```tsx
function FreightCustomsDetails({ freight }) {
  const transitionControl = useStatusTransitionControl(
    WorkflowModule.FREIGHT_CUSTOMS,  // ← Module FREIGHT
    freight.status
  );

  // Même logique, module différent
}
```

## ✅ Avantages de Cette Implémentation

### 1. **Séparation Claire des Responsabilités**
Chaque module gère UNIQUEMENT ses propres phases.

### 2. **Prévention des Erreurs**
Impossible de modifier un statut depuis le mauvais module.

### 3. **Traçabilité**
Historique complet visible partout, modifications contrôlées.

### 4. **Réutilisabilité**
Le même système s'applique à TOUS les modules.

### 5. **Maintenabilité**
Logique centralisée dans un seul service.

### 6. **Expérience Utilisateur**
Messages clairs sur qui peut modifier quoi.

## 🔧 Configuration et Déploiement

### Étape 1: Vérifier les Imports
Tous les fichiers doivent importer correctement:
```typescript
import { WorkflowModule, useStatusTransitionControl } from '@/hooks/useStatusTransitionControl';
```

### Étape 2: Build
```bash
npm run build
```

### Étape 3: Tester
1. Créer une production avec statut "Préparé"
2. ✅ Vérifier qu'on peut passer à "Prêt pour la Douane"
3. Passer à "Prêt pour la Douane"
4. ✅ Vérifier qu'on peut encore modifier depuis Production
5. Passer à "Approuvé par la Douane" (depuis Shipping)
6. ❌ Vérifier qu'on NE PEUT PLUS modifier depuis Production
7. ✅ Vérifier le message de verrouillage

## 📝 Checklist de Validation

- [ ] Service `statusTransitionControlService.ts` créé
- [ ] Hook `useStatusTransitionControl.ts` créé
- [ ] Composant `ReadOnlyStatusWorkflow.tsx` créé
- [ ] Composant `ProductionStatusWorkflow.tsx` modifié
- [ ] Messages de verrouillage affichés
- [ ] Messages d'information affichés
- [ ] Boutons désactivés quand verrouillé
- [ ] Historique visible partout
- [ ] Build réussi
- [ ] Tests manuels passés

---

**Date:** 2025-11-14
**Status:** ✅ IMPLÉMENTÉ ET DOCUMENTÉ
**Impact:** Contrôle strict et professionnel des workflows inter-modules
