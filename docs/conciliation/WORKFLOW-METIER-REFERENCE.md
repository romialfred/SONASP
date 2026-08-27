# Workflow métier de référence — énoncé du commanditaire, 27 août 2026

Chaîne complète, telle que décrite par le commanditaire. Ce document est la
référence : toute implémentation de traçabilité s'y rapporte.

## La chaîne

```text
PRODUCTION (usine, mines industrielles)
   |
   v
ENLÈVEMENT — transfert de la production de l'usine à la mine
   |          (mines industrielles)
   v
VENTE LOCALE                          VENTE INTERNATIONALE
   Comptoir -> SONASP (OBLIGATOIRE)      (mines industrielles seulement)
   Mine     -> SONASP                        |
                                             v
                                     EXPÉDITION vers une raffinerie
                                             |
                                             |-- le jour de l'expédition :
                                             |   PAIEMENT par la raffinerie ou
                                             |   le client final — montant
                                             |   possiblement PARTIEL (avance)
                                             v
                                     ANALYSE par la raffinerie
                                       résultats saisis dans la plateforme
                                             |
                                             v
                                     CONCILIATION
                                       déclaré vs reconnu par la raffinerie
                                             |
                                             v
                                     SUIVI DES COMPTES
                                       - avances reçues
                                       - déductions des différences
                                         après conciliation
                                     SUIVI DES COMPTES DE TAXES
                                       - montant payé à l'expédition
                                       - vs montant réel dû après analyse
```

## Correspondance avec l'existant en base

| Étape métier | Support existant |
|---|---|
| Production | `daily_production`, `production_documents` |
| Enlèvement | `snp_requisitions`, `snp_requisitions_enlevements` |
| Vente locale (comptoir/mine -> SONASP) | `snp_achats_mines`, achats comptoir, `snp_artisan_ventes_or` |
| Vente internationale | `sales` (`seller_type='mining_company'`), RPC `snp_creer_vente_export_mine` |
| Expédition | `shipping_preparations` (porte `refinery_id`), fret |
| Paiement à l'expédition (avance possible) | `payments` (`sale_id`), preuves privées |
| Analyse raffinerie | `assay_certificates`, `snp_analyses_teneur` |
| Conciliation | `snp_conciliations` + écarts |
| Suivi des comptes | `snp_grand_livre_commercial` (avances, écarts), avoirs |
| Suivi des taxes | `snp_grand_livre_fiscal` (payé vs dû) |

## Exigence de traçabilité

Depuis un dossier de production, de vente, de paiement, de raffinage,
d'expédition ou de conciliation, on doit voir :
- tous les documents, organisés par étape de la chaîne ;
- la chronologie des événements à chaque niveau.
