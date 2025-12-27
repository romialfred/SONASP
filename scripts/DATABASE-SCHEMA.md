# Schéma de Base de Données

**Date:** 2025-12-27

## Tables Existantes

### mining_companies

- **Nombre de lignes:** 4
- **Colonnes:**
  - `id`
  - `name`
  - `code`
  - `country`
  - `address`
  - `city`
  - `postal_code`
  - `contact_person_name`
  - `contact_person_email`
  - `contact_person_phone`
  - `website`
  - `default_currency`
  - `tax_id`
  - `registration_number`
  - `is_active`
  - `notes`
  - `created_by`
  - `created_at`
  - `updated_at`
  - `abbreviation`

### snp_artisan_ventes_or

- **Nombre de lignes:** 0
- **Colonnes:**

### snp_artisans_miniers

- **Nombre de lignes:** 61
- **Colonnes:**
  - `id`
  - `type_personne`
  - `type_artisan`
  - `nom`
  - `prenoms`
  - `date_naissance`
  - `lieu_naissance`
  - `sexe`
  - `nationalite`
  - `raison_sociale`
  - `telephone`
  - `email`
  - `adresse`
  - `commune`
  - `region`
  - `type_piece_identite`
  - `numero_piece_identite`
  - `date_delivrance_piece`
  - `date_expiration_piece`
  - `lieu_delivrance_piece`
  - `photo_url`
  - `piece_identite_url`
  - `collecteur_id`
  - `numero_carte`
  - `observations`
  - `created_at`
  - `updated_at`
  - `created_by`
  - `pays`
  - `updated_by`
  - `telephone_secondaire`
  - `numero_registre_commerce`
  - `quantite_or_vendu_grammes`
  - `chiffre_affaires_fcfa`
  - `nombre_transactions`
  - `derniere_transaction_date`

### snp_cartes_professionnelles

- **Nombre de lignes:** 21
- **Colonnes:**
  - `id`
  - `artisan_id`
  - `numero_carte`
  - `date_emission`
  - `date_expiration`
  - `date_validation`
  - `date_suspension`
  - `statut`
  - `qr_code_data`
  - `numero_securite`
  - `validee_par`
  - `motif_suspension`
  - `observations`
  - `created_at`
  - `updated_at`
  - `suspendue_par`
  - `qr_code_url`
  - `carte_recto_url`
  - `carte_verso_url`

### snp_carte_statistics

- **Nombre de lignes:** 7
- **Colonnes:**
  - `id`
  - `carte_id`
  - `nombre_ventes`
  - `nombre_achats`
  - `quantite_totale_grammes`
  - `montant_total`
  - `derniere_activite`
  - `updated_at`

### snp_artisan_activities

- **Nombre de lignes:** 5
- **Colonnes:**
  - `id`
  - `artisan_id`
  - `carte_id`
  - `type_activite`
  - `description`
  - `quantite_grammes`
  - `montant`
  - `devise`
  - `date_activite`
  - `created_at`
  - `created_by`

### daily_production

- **Nombre de lignes:** 4
- **Colonnes:**
  - `id`
  - `production_date`
  - `bullion_grams`
  - `estimated_fineness_pct`
  - `pure_gold_grams`
  - `estimated_oz`
  - `bar_reference`
  - `notes`
  - `site_id`
  - `created_by`
  - `created_at`
  - `updated_at`
  - `mining_company_id`
  - `status_old_backup`
  - `estimated_gold_pct`
  - `estimated_silver_pct`
  - `silver_content_grams`
  - `status`

### sales

- **Nombre de lignes:** 5
- **Colonnes:**
  - `id`
  - `sale_number`
  - `customer_id`
  - `quantity_oz`
  - `london_am_rate`
  - `freight_cost`
  - `other_costs`
  - `gross_proceeds`
  - `net_proceeds`
  - `royalty_amount`
  - `final_proceeds`
  - `created_by`
  - `created_at`
  - `updated_at`
  - `salesperson_id`
  - `salesperson_name`
  - `contract_id`
  - `payment_terms`
  - `payment_schedule_type`
  - `discount_percentage`
  - `discount_amount`
  - `price_adjustment`
  - `customer_approved_at`
  - `customer_approved_by`
  - `completed_at`
  - `internal_notes`
  - `customer_notes`
  - `metadata`
  - `sale_date`
  - `currency`
  - `total_amount`
  - `metal_type`
  - `pricing_mechanism`
  - `spot_pricing_date`
  - `spot_value_date`
  - `forward_days`
  - `forward_rate_adjustment`
  - `forward_value_date`
  - `in_process_refinery_id`
  - `final_price_per_oz`
  - `order_type`
  - `buyer_notice_days`
  - `mechanism_type`
  - `seller_id`
  - `seller_type`
  - `is_internal_sale`
  - `management_approved_at`
  - `management_approved_by`
  - `management_rejected_at`
  - `management_rejected_by`
  - `status`
  - `management_approval_notes`
  - `management_rejection_notes`
  - `customer_approval_notes`
  - `customer_rejected_by`
  - `customer_rejected_at`
  - `customer_rejection_notes`
  - `payment_amount`
  - `payment_date`
  - `payment_method`
  - `payment_proof_url`
  - `payment_notes`
  - `payment_received_at`

### customers

- **Nombre de lignes:** 3
- **Colonnes:**
  - `id`
  - `name`
  - `email`
  - `phone`
  - `country`
  - `address`
  - `contact_person`
  - `tax_id`
  - `payment_terms`
  - `credit_limit`
  - `status`
  - `created_at`
  - `updated_at`
  - `is_active`
  - `company`

### shipping_preparations

- **Nombre de lignes:** 8
- **Colonnes:**
  - `id`
  - `daily_production_id`
  - `expedition_lot_number`
  - `seal_number`
  - `packing_list_url`
  - `shipped_to_company`
  - `shipped_to_address`
  - `shipped_to_country`
  - `prepared_at`
  - `shipped_at`
  - `notes`
  - `created_at`
  - `updated_at`
  - `created_by`
  - `packing_list_document_id`
  - `total_net_weight_grams`
  - `total_gross_weight_grams`
  - `total_boxes`
  - `mining_company_id`
  - `license_id`
  - `total_weight_oz`
  - `status_old_backup`
  - `status`
  - `refinery_id`
  - `freight_company_id`
  - `export_license_id`

### export_licenses

- **Nombre de lignes:** 2
- **Colonnes:**
  - `id`
  - `license_number`
  - `mining_company_id`
  - `request_date`
  - `start_date`
  - `end_date`
  - `issuing_institution`
  - `authorized_quantity_grams`
  - `used_quantity_grams`
  - `remaining_quantity_grams`
  - `average_sale_price`
  - `status`
  - `comments`
  - `notes`
  - `created_at`
  - `updated_at`
  - `created_by`
  - `updated_by`

## Tables Non Trouvées

- ❌ `SNP_artisans_miniers`
- ❌ `artisans_miniers`
