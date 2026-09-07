# Revue indépendante du tableau de bord Artisan

7 septembre 2026. Lot `ART-DASH-002/003`, base de travail `4d6d828d76515dee68266c6db85504923c364eec`. Revue sans navigateur ni accès aux données distantes.

## Périmètre

Les quatre fichiers applicatifs/test de l'implémenteur sont `ArtisanMinierDashboard.tsx`, son test, `artisanTerritoryInsights.ts` et son test. Le correctif remplace les erreurs silencieuses de chaque chargement par un état indisponible cohérent pour le tableau de bord et permet une reprise. La portée de session provoque un remontage du contenu, sans réutiliser les résultats tardifs. Le rattachement et les filtres de site/province utilisent les identifiants explicites ; l'aide passe par son exploitant présent dans le périmètre lu.

Le formulaire Artisan et les règles serveur ne sont pas modifiés. Les contrôles de cartes actives, échéances, historiques, régions et volumétrie des services ne sont pas globalement recertifiés par cette revue.

## Contrôle de la règle aide → exploitant

La migration `20260906111030_refonte_dossier_artisan.sql` exige un `exploitant_id` distinct de l'aide et un `artisanal_site_id` NULL pour ce rôle. Le trigger vérifie le parent exploitant actif et interdit sa désactivation/changement de rôle tant que des aides lui sont rattachés. La capture d'origine des ventes lit le site du parent ; son fallback historique par commune a une portée particulière et ne constitue pas une règle générale d'affectation du registre.

La migration `20260906235254_affiliation_payment_evidence_and_paid_generation.sql` lit également le site du parent pour la carte ; la création de son instantané exige un exploitant actif. Ces exigences d'émission ne doivent pas être confondues avec la simple agrégation du registre « Artisans enregistrés », qui ne filtre pas historiquement les fiches inactives.

Le helper relu ne déduit pas le site d'une localité, ne suit pas une chaîne d'aides, ne sort pas du périmètre fourni et n'utilise pas le propre site éventuellement incohérent d'un aide. Un parent absent, sans site ou d'un autre rôle ne donne aucun rattachement. L'index complet des artisans lus est conservé lorsque les filtres type/statut retirent le parent des lignes sélectionnées. Un parent exploitant visible avec `actif=false` reste une relation du registre selon le contrat conservé ; cela ne l'autorise pas à exercer ou à émettre une carte. Une telle incohérence historique doit être examinée sur les données si elle est rencontrée, sans modification silencieuse de la règle d'activité.

## Exécution et preuves

[Le runner indépendant](run-artisan-dashboard-audit.mjs) a exécuté trois fichiers entre **07:20:28 et 07:21:03 UTC** : **55/55 tests réussis, dont 42 de l'implémenteur et 13 indépendants**. Les 17 fichiers d'entrée empreintés sont restés stables. [La preuve JSON](artisan-dashboard-independent.evidence.json) conserve version, commande, empreintes avant/après et code 0 ; [le journal](artisan-dashboard-independent.txt) contient les assertions nommées.

Les treize cas indépendants vérifient :

1. Pour chacune des trois sources, une première erreur avec les autres lectures encore pendantes, puis une reprise réussie : les anciennes réponses n'altèrent pas le nouveau résultat (3 cas).
2. Pour chacune des trois sources, son rejet tardif après changement d'organisme ne remplace pas les données du nouveau contexte (3 cas).
3. Changement isolé de `site_ids`, `responsibilities`, `module_domains`, `access_portal_code` et `actor_category_code` : anciens résultats ignorés, absence de faux zéro avant la nouvelle réponse, vrai zéro seulement après listes effectivement reçues (5 cas).
4. Cumul site/type/statut avec deux sites de même localité : seul l'aide du parent explicitement rattaché au site choisi reste compté, même si ce parent est absent de la sélection (1 cas).
5. Aucune localité, homonymie ou donnée propre incohérente de l'aide ne supplée l'identifiant de son parent ; parent hors périmètre → site inconnu (1 cas).

Un premier passage des seuls tests d'audit a échoué sur un sélecteur de test nommé « Statut » au lieu du label réel « Statut de la carte » (12 cas réussis, 1 échec du test). Seul ce sélecteur de test a été corrigé avant le passage complet ci-dessus ; aucun défaut applicatif n'est imputé à cet échec. Un appel ESLint complémentaire a annoncé que le fichier TSX d'audit était ignoré par sa configuration : cet appel n'est pas présenté comme validation lint du test.

## Avis borné

Aucun défaut supplémentaire n'a été confirmé dans les 55 cas exécutés. Les sources peuvent poursuivre l'intégration technique ; les tests indépendants sont figés. Les composants, Auth, services, shell, carte et graphiques sont simulés en tout ou partie dans ce banc jsdom. Les migrations ont été lues pour établir le contrat, pas exécutées par ce runner.

**Aucune interface réelle, session MFA, permission serveur ou chaîne de persistance n'est VALIDÉE par cette preuve.** La base en ligne désormais autorisée doit recevoir les contrôles réels une fois son service revenu. La complétude des listes au-delà des plafonds REST, les autres cartes/agrégats et les formulaires restent dans l'inventaire, sans être retirés du dénominateur.
