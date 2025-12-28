# Module de Suivi des Paiements des Ventes d'Or Artisanal

## Présentation

Ce module complet permet de gérer les paiements des ventes d'or artisanal de manière professionnelle et rigoureuse. Il automatise la génération de factures définitives, le suivi des paiements, et la comptabilisation des taxes retenues.

## Fonctionnalités Principales

### 1. Génération Automatique de Factures Définitives
- Après validation d'une vente, une facture définitive est générée automatiquement
- Calcul automatique des taxes (TVA 18%, Retenue à la source 1.5%)
- Numérotation automatique des factures (format: FACT-YYYY-MM-XXXX)
- Génération de PDF professionnel avec toutes les informations

### 2. Gestion des Paiements
- **Types de paiement supportés:**
  - Virement bancaire
  - Cash
  - Orange Money
  - Mobile Money
  - Moov Money
  - Wave
  - Chèque

- **Workflow de paiement:**
  - En attente → En traitement → Validé → Complété
  - Statut mis à jour automatiquement dans la vente
  - Génération automatique de référence de paiement (format: PAY-YYYYMMDD-XXXX)

### 3. Comptabilité des Taxes
- Enregistrement automatique des taxes retenues lors du paiement
- Suivi par type de taxe (TVA, Retenue à la source, etc.)
- Période fiscale et exercice fiscal automatiquement renseignés
- Statut de reversement aux autorités (À reverser, En cours, Reversé, Comptabilisé)

### 4. Dashboard et Reporting
- Vue d'ensemble des ventes en attente de paiement
- Statistiques en temps réel (montants, délais, etc.)
- Filtres avancés par artisan, statut, période
- Export des données

## Installation

### Étape 1: Appliquer la Migration SQL

Exécutez le script SQL suivant dans votre base de données Supabase:

```bash
# Via l'interface Supabase
1. Connectez-vous à votre projet Supabase
2. Allez dans l'onglet "SQL Editor"
3. Ouvrez le fichier: scripts/20251228_003_SYSTEME_PAIEMENTS_ARTISANS.sql
4. Copiez tout le contenu et collez-le dans l'éditeur SQL
5. Cliquez sur "Run" pour exécuter la migration

# Ou via la ligne de commande (si vous avez l'accès direct à PostgreSQL)
psql -h your-supabase-host -U postgres -d your-database < scripts/20251228_003_SYSTEME_PAIEMENTS_ARTISANS.sql
```

### Étape 2: Vérifier l'Installation

Vérifiez que les tables ont été créées correctement:

```sql
-- Vérifier les tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'artisan_%';

-- Devrait afficher:
-- artisan_factures_definitives
-- artisan_paiements
-- artisan_taxes_retenues
```

### Étape 3: Configurer les Taux de Taxes (Optionnel)

Si vous souhaitez modifier les taux de taxes par défaut:

```sql
-- Les taux par défaut sont:
-- TVA: 18%
-- Retenue à la source: 1.5%

-- Pour les modifier, ajustez la fonction calculer_taxes_vente
-- dans la migration SQL avant de l'exécuter
```

## Utilisation

### Accès au Module

1. Dans le menu de navigation, cliquez sur **"Or Artisanal"**
2. Sélectionnez **"Paiements des Ventes"**

### Workflow Complet

#### 1. Validation d'une Vente

Lorsqu'une vente est validée dans le module "Ventes d'Or":
- Une facture définitive est automatiquement créée
- Le statut de paiement passe à "Facture émise"
- La vente apparaît dans la liste "Paiements en attente"

#### 2. Effectuer un Paiement

1. Dans la page "Paiements des Ventes", trouvez la vente à payer
2. Cliquez sur le bouton "Payer"
3. Remplissez le formulaire de paiement:
   - Sélectionnez le type de paiement
   - Remplissez les détails selon le type:
     - **Virement:** IBAN, Banque, BIC, Référence
     - **Mobile Money:** Numéro téléphone, Nom titulaire, Référence transaction
     - **Cash:** Reçu par, Lieu paiement, Numéro reçu
     - **Chèque:** Numéro chèque, Banque émettrice, Date
4. Le montant net à payer est calculé automatiquement (montant brut - taxes)
5. Ajoutez des notes si nécessaire
6. Cliquez sur "Enregistrer le paiement"

#### 3. Validation et Completion

- Le statut du paiement passe à "En attente"
- Un responsable peut valider le paiement
- Une fois validé, le paiement passe à "Complété"
- Le statut de la vente est automatiquement mis à jour à "Payé"
- Les taxes sont automatiquement enregistrées dans le système comptable

### Consulter les Statistiques

Le dashboard affiche:
- Nombre de ventes en attente de paiement
- Montant total à payer
- Nombre de paiements en cours
- Nombre de paiements complétés
- Total des taxes retenues
- Taxes à reverser aux autorités

### Recherche et Filtres

Vous pouvez filtrer les paiements par:
- Nom de l'artisan
- Numéro de carte professionnelle
- Référence de vente
- Numéro de facture
- Statut de paiement

## Structure de la Base de Données

### Table: artisan_factures_definitives
Stocke les factures définitives générées après validation des ventes.

**Colonnes principales:**
- `numero_facture`: Numéro unique généré automatiquement
- `montant_brut`: Montant de la vente avant taxes
- `montant_taxe_tva`: Montant de la TVA
- `montant_taxe_retenue_source`: Montant de la retenue à la source
- `montant_net_a_payer`: Montant à verser à l'artisan
- `statut`: emise | en_paiement | payee | annulee

### Table: artisan_paiements
Enregistre tous les paiements effectués aux artisans.

**Colonnes principales:**
- `reference_paiement`: Référence unique générée automatiquement
- `type_paiement`: virement_bancaire | cash | orange_money | mobile_money | moov_money | wave | cheque
- `montant_paye`: Montant effectivement payé
- `details_paiement`: Objet JSON avec les détails selon le type
- `statut`: en_attente | en_traitement | valide | complete | annule | echec

### Table: artisan_taxes_retenues
Comptabilise les taxes retenues sur chaque paiement.

**Colonnes principales:**
- `type_taxe`: tva | retenue_source | taxe_municipale | taxe_regionale | autre
- `montant_taxe`: Montant de la taxe
- `statut_reversement`: a_reverser | en_cours | reverse | comptabilise
- `periode_fiscale`: Format YYYY-MM
- `exercice_fiscal`: Format YYYY

## Fonctions SQL Utiles

### Générer un Numéro de Facture
```sql
SELECT generer_numero_facture();
-- Retourne: FACT-2024-12-0001
```

### Calculer les Taxes
```sql
SELECT * FROM calculer_taxes_vente(
  1000000,  -- Montant brut en FCFA
  18.0,     -- Taux TVA
  1.5       -- Taux retenue à la source
);
-- Retourne: montant_tva, montant_retenue_source, montant_total_taxes, montant_net
```

### Consulter les Taxes à Reverser
```sql
SELECT * FROM v_taxes_a_reverser
WHERE statut_reversement = 'a_reverser';
```

### Résumé des Paiements par Artisan
```sql
SELECT * FROM v_artisan_paiements_resume
WHERE artisan_id = 'xxx-xxx-xxx';
```

## Sécurité et Permissions

- **Row Level Security (RLS)** activé sur toutes les tables
- Seuls les utilisateurs authentifiés peuvent accéder aux données
- Les politiques RLS empêchent les modifications non autorisées
- Audit trail complet de toutes les opérations

## Maintenance

### Vérifier l'Intégrité des Données
```sql
-- Vérifier les ventes sans facture
SELECT v.id, v.reference_vente, v.statut_validation
FROM artisan_ventes_or v
LEFT JOIN artisan_factures_definitives f ON f.vente_or_id = v.id
WHERE v.statut_validation = 'validee' AND f.id IS NULL;

-- Vérifier les paiements sans taxes enregistrées
SELECT p.id, p.reference_paiement, p.statut
FROM artisan_paiements p
LEFT JOIN artisan_taxes_retenues t ON t.paiement_id = p.id
WHERE p.statut = 'complete' AND t.id IS NULL;
```

### Nettoyer les Paiements en Erreur
```sql
-- Annuler les paiements en échec
UPDATE artisan_paiements
SET statut = 'annule'
WHERE statut = 'echec' AND date_paiement < NOW() - INTERVAL '30 days';
```

## Dépannage

### Problème: La facture n'est pas générée automatiquement
**Solution:** Vérifiez que:
1. La vente a bien le statut "validée"
2. L'utilisateur a les permissions nécessaires
3. Les fonctions SQL sont correctement installées

### Problème: Les taxes ne sont pas enregistrées
**Solution:** Vérifiez que:
1. Le paiement a le statut "complete" ou "valide"
2. La facture contient bien les montants de taxes
3. Le trigger `trigger_creer_taxes_retenues` est actif

### Problème: Le statut de la vente ne se met pas à jour
**Solution:** Vérifiez que:
1. Le trigger `trigger_update_statut_paiement` est actif
2. Le paiement est bien lié à la bonne vente
3. Les permissions RLS permettent la mise à jour

## Support

Pour toute question ou problème:
1. Consultez les logs de la base de données
2. Vérifiez les erreurs dans la console du navigateur
3. Contactez l'équipe technique SONASP

## Notes de Version

**Version 1.0.0 (28/12/2024)**
- Création du module complet de paiements
- Support de 7 types de paiement
- Génération automatique de factures PDF
- Comptabilité des taxes intégrée
- Dashboard et statistiques en temps réel

---

**IMPORTANT:** Assurez-vous d'avoir une sauvegarde de votre base de données avant d'appliquer la migration SQL.
