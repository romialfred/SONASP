# Restriction de Domaine - Configuration

## Vue d'ensemble
Cette application inclut une sécurité de restriction de domaine pour garantir qu'elle n'est accessible que depuis les domaines autorisés.

## Configuration Actuelle

### Domaines Autorisés
- `global-shipping.org` (Production)
- `www.global-shipping.org` (Production avec www)
- `localhost` (Développement local)
- `127.0.0.1` (Développement local)

### Domaines Bloqués
- **URLs de Prévisualisation WebContainer**: Toutes les URLs contenant:
  - `webcontainer`
  - `local-credentialless`
  - `.local-`

- **Autres Domaines Non Autorisés**: Tout domaine non présent dans la liste autorisée

## Fonctionnement

La restriction de domaine est implémentée dans `/src/components/auth/DomainRestriction.tsx` et enveloppe l'application entière dans `/src/App.tsx`.

Lorsqu'un utilisateur tente d'accéder à l'application depuis un domaine non autorisé:
1. L'application détecte le nom d'hôte
2. Vérifie par rapport aux domaines autorisés
3. Si non autorisé, affiche une page de sécurité professionnelle avec:
   - Message "Accès Refusé" en français
   - Bouton "Cliquez Ici pour accéder" pointant vers `https://global-shipping.org`
   - Informations de contact:
     - Email: infos@business-tech.net
     - Téléphone: +225 07 67 34 47 11
   - Design professionnel en bleu (pas violet)
4. Empêche le chargement de l'application

## Design de la Page de Restriction

La page de restriction présente un design professionnel avec:
- **Couleurs**: Dégradé bleu professionnel (#1e3a8a → #2563eb)
- **Carte blanche** centrée avec ombrage élégant
- **En-tête bleu** avec icône de cadenas
- **Alerte jaune** pour la notice de sécurité
- **Bouton d'accès bleu** avec effet hover
- **Section contact** avec icônes email et téléphone
- **Footer** avec copyright et mention de sécurité

## Pour le Développement

Durant le développement local sur `localhost` ou `127.0.0.1`, l'application fonctionne normalement. Cela permet aux développeurs de tester l'application localement tout en bloquant les URLs de prévisualisation non autorisées.

## Ajouter de Nouveaux Domaines

Pour ajouter un nouveau domaine autorisé, éditez `/src/components/auth/DomainRestriction.tsx`:

```typescript
const ALLOWED_DOMAINS = [
  'global-shipping.org',
  'www.global-shipping.org',
  'votre-nouveau-domaine.com',  // Ajouter ici
  'localhost',
  '127.0.0.1'
];
```

## Notice de Sécurité

Cette restriction aide à prévenir:
- L'accès non autorisé via les URLs de prévisualisation de développement
- L'accès depuis des déploiements clonés ou copiés
- Les tentatives de phishing utilisant des domaines similaires

La restriction est côté client et sert de couche de sécurité supplémentaire. Assurez-vous toujours que vos APIs backend valident également l'origine de la requête.

## Contact Support

En cas de problème d'accès, les utilisateurs peuvent contacter:
- **Email**: infos@business-tech.net
- **Téléphone**: +225 07 67 34 47 11

Ces informations sont affichées directement sur la page de restriction pour faciliter l'assistance.
