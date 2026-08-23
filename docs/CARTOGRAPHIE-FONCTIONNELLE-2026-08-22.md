# Cartographie fonctionnelle et technique SONASP

État observé le 22 août 2026 dans le dépôt `SONASP_2026` et, uniquement pour
les vérifications signalées comme telles, dans le projet Supabase lié. Cette
cartographie précède toute refonte métier ou migration de production.

## 1. Périmètres applicatifs

| Périmètre | Entrée | Population | Finalité observée |
|---|---|---|---|
| Vitrine institutionnelle | `/` | public | Présentation, actualités, assistance et pages légales |
| Identité | `/login`, récupération, callback, changement de mot de passe | tous les comptes | Authentification GoTrue, mot de passe personnel et TOTP obligatoire |
| Portail national SONASP | `/dashboard` et navigation principale | Owner, administration, direction opérationnelle | Pilotage national, référentiels, validations, achats, ventes, paiements et rapports |
| Portail société minière | `/portail-mine` | compte `mine`; Owner en consultation d'un périmètre choisi | Prévisions, production, documents, demandes SONASP et réception des règlements |
| Portail Direction | `/portail-direction` | `manager` | Consultation transversale sans écriture |
| Espaces spécialisés historiques | tableaux de bord usine, aéroport, raffinerie et client | `factory`, `airport`, `refinery`, `customer` | Traitements ponctuels hérités de l'ancien modèle logistique |
| Filière artisanale et semi-mécanisée | `/artisan-sites`, `/artisan-minier/*` | agents autorisés | Sites, artisans, cartes, ventes, infractions, paiements et rapports |

Le routeur privé déclare **144 chemins**. La navigation visible n'en expose
qu'une partie ; plusieurs chemins de détail, création, modification et anciens
tableaux de bord restent atteignables directement.

## 2. Rôles et portée

| Rôle | Portée attendue | Écriture attendue |
|---|---|---|
| `owner` | nationale et inter-sociétés | complète, mais via opérations serveur contrôlées |
| `admin` | administration interne | comptes, référentiels et paramètres autorisés |
| `management` | validation et pilotage SONASP | workflows qui lui sont explicitement attribués |
| `manager` | direction transversale | aucune écriture métier |
| `mine` | une société issue de `user_profiles.mining_company_id` | uniquement les RPC du Portail Mine |
| `factory` | traitements de production/usine | selon workflow et périmètre serveur |
| `airport` | réception et contrôle aéroportuaire | selon workflow serveur |
| `refinery` | réception et raffinage | selon workflow serveur |
| `customer` | ventes et paiements qui le concernent | actions client explicitement autorisées |

Le rôle faisant foi est `user_profiles.role`, avec profil actif. Une adresse
électronique, une route, un paramètre `mine` ou `app_metadata.role` ne doit
jamais accorder un privilège.

## 3. Modules visibles dans la navigation nationale

### Mines semi-mécanisées et artisanales

- sites miniers et productions ;
- artisans miniers, cartes, validations et expirations ;
- ventes d'or artisanales, paiements, historique et rapports.

### Mines industrielles

- collecte : production journalière, achats aux mines, or en coffre, licences,
  budgets et prévisions ;
- achats : contrats, engagements, plans mensuels, demandes, réquisitions,
  règlements et comptes des mines ;
- expéditions : préparations, fret et formalités douanières ;
- raffinage, lots réceptionnés et stocks ;
- marché : négoce, cours de l'or et taux de change ;
- ventes, clients et paiements ;
- sociétés minières, approbateurs, transporteurs et raffineries ;
- certificats d'essai et rapports.

### Administration et pilotage

- paramètres généraux, ventes, statuts et circuit de traçabilité ;
- utilisateurs, modules, messagerie, publications et approbations ;
- analyses des ventes, production, rapports institutionnels et performance.

L'ancien menu « Assistant IA » et les écrans d'analytique simulés ont été retirés.
Ils ne pourront être réintroduits qu'avec un modèle validé, des sources traçables,
une gouvernance des données et des limites expliquées aux utilisateurs.

## 4. Chaînes métier observées

### Production industrielle et sortie

```text
Budget / prévision
  → production journalière
  → préparation d'expédition
  → fret
  → formalités douanières
  → réception / analyse
  → raffinage
  → stock
  → vente
  → facture / paiement / rapprochement
```

Le code récent contient des RPC de portail et des contrôles ciblés. Les services
historiques peuvent encore écrire directement certains statuts. Les vocabulaires
`waiting_for_customs_approval`, `approved_by_customs`, `customs_approved` et
`in_sale` coexistent ; la machine à états n'est pas encore unique.

### Achats industriels de la SONASP

```text
Contrat et engagements
  → plan mensuel
  → demande adressée à une mine
  → réponse de la mine
  → réquisition / livraison / analyse
  → facture d'achat
  → règlement
  → confirmation ou contestation par la mine
  → rapprochement
```

Cette famille est la plus proche de l'architecture cible : plusieurs transitions
sont déjà centralisées dans des RPC et utilisent verrouillage, motif et audit.
Elle doit servir de référence aux anciens workflows.

### Filière artisanale

```text
Site minier
  → artisan / carte professionnelle
  → production ou vente d'or
  → contrôle / infraction éventuelle
  → facture
  → paiement
  → rapports et taxes
```

Des écrans et données historiques associent encore le produit à plusieurs pays
ou à l'ancien projet Gold Shipper. La nationalité d'un artisan peut être
étrangère, mais les lieux d'opération, banques, expéditeurs et règles SONASP ne
doivent pas être dérivés de constantes guinéennes ou maliennes.

### Gestion d'un compte

```text
Administrateur actif + JWT aal2
  → création Auth, profil et habilitations
  → génération du lien GoTrue
  → courriel de bienvenue confirmé
  → choix du mot de passe personnel
  → enrôlement TOTP
  → vérification aal2
  → accès au seul portail et périmètre autorisés
```

Une création dont le courriel échoue est compensée par la suppression des
écritures Auth/profil/habilitations. Aucun mot de passe provisoire n'est rendu
au navigateur.

## 5. Architecture d'autorisation

```text
Route React / permission d'affichage
              │
              ▼
JWT GoTrue vérifié ─ profil actif ─ mot de passe personnel ─ TOTP ─ aal2
              │
              ▼
RLS de périmètre ou RPC SECURITY DEFINER contrôlée
              │
              ▼
Verrouillage + validation + écriture métier + audit + notification
```

L'interface ne constitue pas une frontière de sécurité. L'Owner peut consulter
les périmètres, mais les sociétés ne doivent jamais choisir leur organisation
dans l'URL. Le paramètre `mine` n'est pris en compte que pour un profil Owner.

## 6. Écarts structurants confirmés

| Référence | Preuve | Conséquence |
|---|---|---|
| MAP-01 | 110 migrations locales et historique distant non aligné | déploiement SQL non reproductible |
| MAP-02 | le type Supabase a été régénéré, révélant de nombreux contrats historiques désalignés | typecheck strict rouge ; correction module par module requise |
| MAP-03 | le relevé initial montrait 65 tables et 149 politiques d'écriture permissives | migrations correctives locales ; preuve post-déploiement requise |
| MAP-04 | décisions de ventes/approbations historiquement multi-écritures côté client | RPC atomiques ajoutées pour les décisions et créations sensibles |
| MAP-05 | anciennes fonctions `send-email` et `send-activation-email` fictives | supprimées ; chaîne SONASP dédiée déployée séparément |
| MAP-06 | 144 routes privées pour un routeur de plus de 1 300 lignes | contrôle des rôles difficile à vérifier et maintenir |
| MAP-07 | deux générations de navigation et plusieurs tableaux de bord spécialisés | parcours et habilitations incohérents |

## 7. Validation automatisée du lot d'identité

| Contrôle | Résultat |
|---|---|
| Suite Vitest complète | 108 fichiers, 881 tests réussis |
| ESLint global | réussi, 0 erreur |
| Build Vite/PWA production | réussi, 3 342 modules, 32,85 s |
| TypeScript strict | échec : dette historique et ressources absentes du schéma généré |
| Migration de sécurité en base de recette | non exécutée, environnement de recette reproductible absent |
| Courriel SMTP de bienvenue réel | non rejoué pour éviter la création d'un compte ou l'envoi non sollicité |

## 8. Séquence de correction sûre

1. construire un baseline SQL du projet lié dans une base de recette jetable ;
2. appliquer et tester la barrière profil/MFA et la matrice inter-sociétés ;
3. aligner chaque ressource frontend sur le schéma réel ou retirer l'écran
   non implémenté de la navigation ;
4. migrer les transitions sensibles restantes vers des RPC atomiques ;
5. consolider notifications et journalisation par outbox ;
6. corriger le typecheck, puis le lint, module par module ;
7. mesurer les requêtes et charger à la demande les blocs PDF/XLSX/graphiques ;
8. exécuter la recette E2E par rôle et workflow avant toute décision de GO.
