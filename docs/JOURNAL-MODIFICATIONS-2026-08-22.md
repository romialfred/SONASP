# Journal des modifications de finalisation

## Identité et administration

- autorisation fondée sur le profil actif, le rôle en base et `aal2` ;
- session éphémère avec avertissement et expiration ;
- enrôlement MFA obligatoire ;
- création/réinitialisation par liens GoTrue sans mot de passe exposé ;
- administration Owner protégée et sélection multi-mines bornée.

## Sécurité des données

- migrations de verrouillage des profils, périmètres, notifications et documents ;
- RPC atomiques pour approbations, décisions client et créations de ventes ;
- contrôles SONASP/client/raffinerie ;
- suppression des écritures directes et services génériques dangereux.

## Données et conformité

- retrait des replis aléatoires sur cours de l'or et devises ;
- authentification service-role des tâches financières ;
- retrait des fonctions de courriel fictives et contenus hérités ;
- déplacement des jeux artisanaux vers les fixtures de test ;
- migration de nettoyage strictement ciblée, sans suppression heuristique des
  budgets ;
- maintien explicite de la mention « spécimen » sur les factures non homologuées.

## UX, performance et maintenance

- suppression de l'Assistant IA et des analyses simulées ;
- centre d'aide réécrit en français et navigation nettoyée ;
- devis de vente calculé sur action explicite, sans requêtes à chaque frappe ;
- découpage de Recharts et scripts de nettoyage portables Windows ;
- génération des types Supabase ; lint revenu à zéro, mais typecheck strict
  encore rouge sur les contrats historiques désalignés.

## Validation

- 881 tests réussis dans 108 fichiers ;
- TypeScript strict : échec, dette historique à corriger ;
- ESLint : 0 erreur ;
- build Vite/PWA réussi ;
- aucun commit ni déploiement des corrections locales de ce journal.
