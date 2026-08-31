# Registre des paiements clients — 30 août 2026

## Périmètre

Refonte de `/payments` à partir de la maquette fournie : indicateurs compacts, filtres séparés du tableau, colonnes et badges, accents de ligne, actions et pagination. Conservation du chrome national et du formulaire de versement existant.

Ajouts : regroupement par client, statut, banque ou devise ; tri par création, échéance, montant (devises séparées) ou client ; filtres combinables sur recherche, statut, période d'échéance, dates, client, devise, banque et mode de paiement.

## Corrections de cohérence

- Les échéances utilisent `virtual_due_date` pour un engagement virtuel, puis `due_date` et `expected_date`. Aucun délai arbitraire de trente jours n'est ajouté dans l'interface.
- `approved` réel = encaissé ; `processing` réel = à confirmer ; `pending` = à recevoir, éventuellement en retard. Rejets, annulations, échecs et états inconnus sont distingués.
- Un règlement encaissé n'est plus présenté comme actuellement en retard. Sa date de réception est affichée séparément.
- Les engagements virtuels ne sont jamais comptabilisés dans les encaissements. Le solde d'engagement déjà réduit par le RPC de paiement partiel est lu tel quel ; aucun recalcul ou double ajout du montant synthétique de la vente.
- Les indicateurs sont recalculés sur les lignes filtrées, avec sous-totaux séparés par devise et conservation des centimes. Le total encaissable correspond aux engagements à recevoir ; l'indicateur « En attente » aux versements à confirmer.
- Aucune facture, devise, échéance, variation ou courbe n'est inventée. Les petites courbes représentent les lignes filtrées par mois, et non un historique de soldes reconstitué.
- L'échec réseau est distinct d'un registre vide ; les indicateurs indisponibles ne deviennent pas des zéros.

## Accès et cycle de vie

- Lecture avec le client Supabase authentifié et RLS, champs explicites, jointure interne sur la vente autorisée. Pas de clé privilégiée, de catalogue global des clients ni de surcharge du tenant.
- Lecture paginée au-delà de la limite PostgREST ; recherche des factures uniquement parmi les ventes déjà visibles, par lots d'identifiants.
- Enregistrement conditionné par la capacité sensible `FINANCE_EXECUTE`. L'action de versement depuis une ligne exige également une vente SONASP dans un statut payable. Les RPC, justificatifs privés et contrôles serveur du formulaire restent inchangés.
- Aucun chargement au focus/retour d'onglet. Actualisation manuelle sans masquer les lignes ni perdre les filtres. Changement réel d'identité/périmètre : annulation des requêtes et retrait immédiat des anciennes lignes.
- Aucune migration, écriture de paiement, mutation de permission ou opération de déploiement dans ce lot.

## Vérification

- Tests ciblés : 89 tests réussis (registre, formulaire, reprise de preuve, statut et solde, service et capacités).
- Contrôles navigateur sur le vrai composant dans une entrée QA séparée : filtre client, regroupement, tableau et responsive. Données synthétiques exclusivement dans les fixtures de tests ; elles ne sont pas importées par la page authentifiée.
- Largeurs utiles contrôlées : 375, 768, 1280 et 1688 px. Aucun débordement global ; le tableau dispose de son propre défilement horizontal sur petit écran.
- Suite globale : 249 fichiers, 1 916 tests réussis en 410,24 secondes. Après l'affinement de l'état d'erreur, les 33 tests spécifiques du registre ont également été rejoués avec succès.
- Lint et contrôle TypeScript réussis. Build de production réussi ; la version compilée est servie en local sur le port 5180, sans ajout d'actualisation automatique.

Limites : comparaison visuelle de structure et de rendu, pas certification pixel par pixel. Pas de confirmation de paiement réelle, ni de session authentifiée inter-tenant exercée dans le navigateur pour ce lot ; les garanties serveur existantes n'ont pas été modifiées.
