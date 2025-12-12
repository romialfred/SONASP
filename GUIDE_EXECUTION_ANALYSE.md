# GUIDE D'EXÉCUTION - ANALYSE VENTES & PAIEMENTS

## Étape 1: Exécuter l'Analyse SQL

### Dans Supabase Dashboard:

1. Allez sur votre projet Supabase: https://boolqagzdqbahqnpawpb.supabase.co
2. Cliquez sur "SQL Editor" dans le menu de gauche
3. Cliquez sur "+ New query"
4. Copiez le contenu du fichier: `ANALYSE_COMPLETE_VENTES_PAIEMENTS.sql`
5. Collez dans l'éditeur SQL
6. Cliquez sur "Run" ou appuyez sur Ctrl+Enter

### Résultats Attendus

Le script va retourner 10 sections:

1. **ENUMS DE STATUT** - Liste de toutes les valeurs d'enum
2. **STRUCTURE gold_sales** - Toutes les colonnes avec types
3. **STRUCTURE payments** - Toutes les colonnes avec types
4. **TRIGGERS gold_sales** - Liste des triggers
5. **TRIGGERS payments** - Liste des triggers
6. **FONCTIONS TRIGGER gold_sales** - Code complet
7. **FONCTIONS TRIGGER payments** - Code complet
8. **CONTRAINTES** - CHECK et FK
9. **POLITIQUES RLS** - Sécurité
10. **INDEX** - Performance

---

## Étape 2: Partager les Résultats

### Copiez les résultats importants:

#### Section 1: ENUMS
Recherchez dans les résultats:
```
enum_name: sale_status
enum_value: ???
```

**Questions clés:**
- Existe-t-il un enum `sale_status`?
- Quelles sont les valeurs exactes?
- Y a-t-il `pending_management_approval`?
- Y a-t-il `management_approved`?

#### Section 6: Code du Trigger handle_sales_status_change
Recherchez:
```sql
CREATE OR REPLACE FUNCTION handle_sales_status_change()
```

**Questions clés:**
- Le trigger existe-t-il?
- Quelles valeurs de statut utilise-t-il?
- Est-ce qu'elles correspondent aux ENUM?

---

## Étape 3: Analyse Rapide

### Vérification 1: Enum sale_status

**Valeurs ATTENDUES (selon le code TypeScript):**
```
pending_management_approval
management_approved
management_rejected
pending_for_customer_approval
customer_approved
customer_rejected
waiting_for_payment
virtual_payment
payment_received
completed
```

**Comparez avec les résultats de la Section 1**

### Vérification 2: Structure gold_sales

**Colonnes ATTENDUES:**
- `status` de type `sale_status` (ENUM)
- Valeur par défaut: `'pending_management_approval'`

**Comparez avec les résultats de la Section 2**

### Vérification 3: Triggers

**Trigger ATTENDU:**
- Nom: contient "status" ou "sales"
- Fonction: `handle_sales_status_change()`
- Type: BEFORE UPDATE ou AFTER UPDATE

**Comparez avec les résultats des Sections 4 et 6**

---

## Étape 4: Identifier les Problèmes

### Problème Type A: ENUM Incomplet

**Symptôme:** L'ENUM `sale_status` ne contient pas toutes les valeurs

**Solution:**
```sql
ALTER TYPE sale_status ADD VALUE IF NOT EXISTS 'pending_management_approval';
ALTER TYPE sale_status ADD VALUE IF NOT EXISTS 'management_approved';
-- etc.
```

### Problème Type B: ENUM Inexistant

**Symptôme:** Aucun ENUM `sale_status` trouvé

**Solution:** Créer l'ENUM complet (migration nécessaire)

### Problème Type C: Trigger Incorrect

**Symptôme:** Le trigger utilise des valeurs qui ne sont pas dans l'ENUM

**Solution:** Corriger le code du trigger

### Problème Type D: Statut par Défaut Incorrect

**Symptôme:** La colonne `status` a une autre valeur par défaut

**Solution:**
```sql
ALTER TABLE gold_sales
ALTER COLUMN status SET DEFAULT 'pending_management_approval';
```

---

## Étape 5: Créer les Corrections

Une fois les problèmes identifiés, je créerai:

1. **Migration SQL** avec toutes les corrections
2. **Script de test** pour valider
3. **Guide de déploiement**

---

## Format de Réponse Souhaité

Partagez les résultats en copiant directement depuis Supabase:

```
Section 1 - ENUMS:
[Coller les résultats]

Section 2 - Structure gold_sales:
[Coller les résultats]

Section 4 - Triggers gold_sales:
[Coller les résultats]

Section 6 - Code trigger:
[Coller le code complet]
```

Ou simplement: "Aucun résultat" si la section est vide.

---

## En Cas d'Erreur SQL

Si le script génère une erreur:

1. Notez l'erreur exacte
2. Notez la section qui a échoué
3. Je créerai une version simplifiée

---

## Après l'Analyse

Une fois l'analyse terminée, nous pourrons:

1. Créer la migration de correction
2. Tester la création de vente
3. Valider le workflow complet
4. Vérifier les paiements
5. Build de production

---

**Prêt à exécuter le script SQL?**

Fichier: `ANALYSE_COMPLETE_VENTES_PAIEMENTS.sql`
