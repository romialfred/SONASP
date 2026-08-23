# Registre de sécurité — SONASP

État au 22 août 2026. La colonne « local » ne signifie pas « actif en production ».

| ID | Risque | Criticité | Mesure implémentée | État | Preuve attendue avant GO |
|---|---|---:|---|---|---|
| SEC-01 | élévation de rôle par profil ou metadata | critique | rôle autoritaire en base, trigger de protection, fonctions admin contrôlées | local | tentative d'auto-promotion refusée en recette |
| SEC-02 | accès sans MFA | critique | enrôlement TOTP obligatoire, route `aal2`, policy restrictive préparée | local + client | matrice pré-MFA/aal1/aal2 par rôle |
| SEC-03 | session persistante ou inactive | élevée | `sessionStorage`, alerte à 9 min, logout à 10 min | client testé | test E2E onglet fermé/inactivité/reprise |
| SEC-04 | accès inter-sociétés | critique | périmètre mine côté serveur, sélecteur Owner borné | local | tests croisés A→B sur chaque table métier |
| SEC-05 | mot de passe temporaire exposé | critique | liens GoTrue, aucun secret dans réponse/log/courriel | déployé | inspection logs + réception sur boîte de recette |
| SEC-06 | création de compte partielle | élevée | compensation Auth/profil/habilitations si échec d'envoi | déployé | panne SMTP simulée, absence de compte résiduel |
| SEC-07 | émission libre de notifications | élevée | appel générique retiré, droits révoqués par migration | local | appel direct refusé pour compte standard |
| SEC-08 | double décision ou écriture partielle de vente | critique | RPC, verrouillage, validation et audit atomiques | local | concurrence et double soumission |
| SEC-09 | documents de vente hors périmètre | élevée | association obligatoire à une vente autorisée | local | téléchargement croisé refusé |
| SEC-10 | cours financiers inventés | élevée | aucun aléatoire, sources et nature des cours explicites | local | indisponibilité fournisseur sans valeur fabriquée |
| SEC-11 | clé anonyme pour tâche planifiée | critique | authentification service-role exacte | local | appels anon/utilisateur refusés |
| SEC-12 | données de démonstration mêlées au réel | élevée | retrait ciblé, aucune suppression heuristique des budgets | local | sauvegarde + comparaison métier avant/après |
| SEC-13 | politiques RLS permissives historiques | critique | sept migrations correctives locales | ouvert | inventaire RLS post-recette sans accès transversal |
| SEC-14 | dépendances vulnérables | élevée | audit tenté | ouvert | `npm audit` lorsque le registre est joignable |

## Règles opérationnelles

- Une permission React ne vaut jamais autorisation de données.
- Toute transition financière ou réglementaire sensible passe par une RPC.
- Toute action d'administration exige un profil interne actif et `aal2`.
- Le service-role ne doit jamais être exposé au navigateur.
- Toute migration destructive est précédée d'une sauvegarde restaurable et d'un
  comptage avant/après validé par le métier.
