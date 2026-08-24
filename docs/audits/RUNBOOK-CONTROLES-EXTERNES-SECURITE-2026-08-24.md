# Runbook — contrôles externes de sécurité non simulables localement

Date de référence : 24 août 2026. Ce document couvre les contrôles qui exigent
un service de plateforme, un moteur antivirus/CDR ou un contrat serveur tiers.
Il ne constitue pas une preuve que ces contrôles sont actifs en production.

## 1. Signification exacte de `format-validated`

La passerelle `sensitive-upload` authentifie l'acteur, vérifie sa session
applicative, son AAL/capability et son tenant, borne le flux, normalise le nom et
contrôle extension, MIME déclaré et signature binaire. Le préfixe
`format-validated/` signifie uniquement que ces contrôles structurels ont
réussi. Il ne signifie jamais « antivirus OK », « CDR effectué » ou « document
sûr ».

Les buckets restent privés et les nouveaux certificats d'analyse sont créés en
`parsing_status=pending` et `approval_status=pending`. Ces états métier ne sont
pas un état antivirus : aucun écran ni export ne doit les présenter comme tels.

## 2. Gate de mise en production AV/CDR — fail-closed

Tant qu'un résultat signé de scanner n'est pas relié à chaque objet sensible :

1. si l'antivirus/CDR est une exigence réglementaire, bloquer au WAF la requête
   `POST /functions/v1/sensitive-upload` pour le profil concerné ; ne pas ouvrir
   le flux « temporairement » ;
2. à défaut d'exigence réglementaire formelle, limiter le dépôt aux rôles AAL2
   déjà autorisés, maintenir le bucket privé et imposer une analyse manuelle
   hors bande avant approbation ou diffusion ;
3. ne jamais rendre public, joindre à un courriel, exporter ou transmettre à un
   tiers un objet qui n'a pas de preuve d'analyse ;
4. si le scanner est indisponible, conserver l'objet inaccessible à tout flux
   aval ou refuser le dépôt. Une réponse « propre par défaut » est interdite.

Le raccordement cible doit disposer d'un état dédié (`pending`, `clean`,
`infected`, `scan_error`), de l'identifiant/version du moteur et d'une preuve
horodatée. Le scanner lit depuis une zone privée, exécute AV puis CDR si le type
le permet, et seul un résultat `clean` autorise une promotion atomique. Toute
erreur, timeout, format inconnu ou signature invalide produit un refus. Cette
évolution nécessite un modèle de données et une migration séparée ; elle n'est
pas simulée dans le code actuel.

En cas de détection : isoler l'objet, révoquer ses URL signées, consigner
uniquement identifiants/hachage (jamais les octets ni un jeton), bloquer les
objets de même empreinte et ouvrir un incident SecOps.

## 3. WAF et limitation de débit

Configurer sur la plateforme, avant l'Edge Function :

- méthodes autorisées `POST` et `OPTIONS` seulement ;
- taille corps alignée sur le profil (10 Mio certificat, 15 Mio document de
  société), sans tolérance supérieure à la limite applicative ;
- rejet des corps compressés et des content-types absents ;
- quotas courts par IP et quotas par identité Supabase validée, puis blocage
  exponentiel des échecs 401/403/413/415 ;
- aucune mise en cache des requêtes/réponses, aucun corps binaire dans les logs
  CDN et aucune valeur `Authorization`, `apikey` ou métadonnée originale dans
  la télémétrie ;
- alerte sur hausse des refus de signature, tailles limites répétées et
  tentatives multi-tenant.

Tester depuis une origine autorisée et une origine hostile, avec fichier trop
grand, contenu compressé, MIME trompeur, double extension, session révoquée et
tenant différent. Conserver l'export horodaté des règles WAF comme preuve.

## 4. Promotion de la CSP progressive

La politique appliquée reste volontairement compatible (`https:`/`wss:` sur
certaines directives) tandis qu'une politique plus étroite est en
`Content-Security-Policy-Report-Only`. COOP/CORP sont `same-origin`, HSTS inclut
les sous-domaines, le shell HTML est `no-store` et les assets empreintés sont
immuables.

Avant de promouvoir la politique étroite :

1. raccorder `report-to`/`report-uri` à un collecteur qui supprime URL, jetons et
   données personnelles ;
2. observer au moins un cycle fonctionnel complet de chaque portail et PWA ;
3. inventorier chaque domaine réellement nécessaire et son propriétaire ;
4. corriger les violations, puis déplacer les allowlists validées dans la CSP
   appliquée ;
5. rejouer les tests du shell, du service worker, des URL Supabase signées et
   des exports PDF.

Une violation ne doit jamais être contournée par l'ajout global d'un nouveau
`https:` ou de `unsafe-eval`.

## 5. Appel fiscal DGI depuis le navigateur

Ne pas configurer en production les variables client `VITE_DGI_SECEF_*` dans
l'état actuel. Le code navigateur envoie la facture vers une URL configurable
et réalise ensuite des transitions de certification depuis le client. Le
raccordement cible doit être une Edge Function/server adapter avec allowlist
HTTPS fixe, authentification serveur, secret en coffre, timeout, anti-rejeu,
validation stricte de la réponse, idempotence et transition SQL atomique. Le
navigateur ne doit recevoir ni identifiant technique DGI ni capacité de choisir
la destination réseau.

## 6. Preuves de clôture attendues

- export des règles WAF actives et test de refus ;
- preuve du moteur AV/CDR, version des signatures et cas EICAR rejeté ;
- preuve qu'une indisponibilité scanner bloque le flux ;
- rapport CSP sans violation non expliquée puis test de la CSP appliquée ;
- test bout en bout DGI via serveur avec anti-rejeu et sans secret dans le
  bundle, les logs ou le navigateur.
