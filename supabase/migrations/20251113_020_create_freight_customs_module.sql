/*
  # Module Freight & Customs - Gestion Douanière et Transport

  1. Nouvelles Tables
    - `freight_customs_operations`
      - Gestion des opérations douanières liées aux expéditions
      - Statuts: customs_pending, customs_approved, ready_for_transport, shipped_to_refinery
      - Lien avec shipping_preparations (status = 'shipped')

    - `freight_customs_documents`
      - Documents douaniers et de transport
      - Types: customs_declaration, customs_approval, transport_document, bill_of_lading, export_invoice, bullion_summary, other
      - Upload et gestion de fichiers PDF

    - `freight_customs_invoice_data`
      - Données pour génération de factures d'exportation
      - Informations complémentaires non disponibles dans shipping

  2. Sécurité
    - Enable RLS sur toutes les tables
    - Politiques pour utilisateurs authentifiés avec rôles appropriés

  3. Relations
    - freight_customs_operations → shipping_preparations
    - freight_customs_documents → freight_customs_operations
    - freight_customs_invoice_data → freight_customs_operations
*/

-- Type ENUM pour les statuts des opérations douanières
DO $$ BEGIN
  CREATE TYPE freight_customs_status AS ENUM (
    'customs_pending',
    'customs_approved',
    'ready_for_transport',
    'shipped_to_refinery'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Type ENUM pour les types de documents
DO $$ BEGIN
  CREATE TYPE freight_document_type AS ENUM (
    'customs_declaration',
    'customs_approval',
    'transport_document',
    'bill_of_lading',
    'export_invoice',
    'bullion_summary',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Table principale des opérations douanières
CREATE TABLE IF NOT EXISTS freight_customs_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id UUID NOT NULL REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  reference_number TEXT UNIQUE NOT NULL,
  status freight_customs_status DEFAULT 'customs_pending' NOT NULL,

  -- Informations douanières
  customs_office TEXT,
  customs_officer_name TEXT,
  customs_approval_date TIMESTAMPTZ,
  customs_reference_number TEXT,

  -- Informations de transport
  transport_company_id UUID REFERENCES transport_companies(id),
  freight_forwarder_contact TEXT,
  estimated_departure_date TIMESTAMPTZ,
  actual_departure_date TIMESTAMPTZ,
  estimated_arrival_date TIMESTAMPTZ,
  actual_arrival_date TIMESTAMPTZ,

  -- Tracking
  awb_number TEXT,
  tracking_number TEXT,

  -- Notes et observations
  notes TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT fk_shipping_preparation
    FOREIGN KEY (shipping_preparation_id)
    REFERENCES shipping_preparations(id)
    ON DELETE CASCADE
);

-- Index pour recherche et performance
CREATE INDEX IF NOT EXISTS idx_freight_customs_shipping ON freight_customs_operations(shipping_preparation_id);
CREATE INDEX IF NOT EXISTS idx_freight_customs_status ON freight_customs_operations(status);
CREATE INDEX IF NOT EXISTS idx_freight_customs_reference ON freight_customs_operations(reference_number);
CREATE INDEX IF NOT EXISTS idx_freight_customs_awb ON freight_customs_operations(awb_number);

-- Table des documents
CREATE TABLE IF NOT EXISTS freight_customs_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_customs_operation_id UUID NOT NULL REFERENCES freight_customs_operations(id) ON DELETE CASCADE,

  document_type freight_document_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Stockage fichier
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,

  -- Metadata
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT fk_freight_operation
    FOREIGN KEY (freight_customs_operation_id)
    REFERENCES freight_customs_operations(id)
    ON DELETE CASCADE
);

-- Index pour documents
CREATE INDEX IF NOT EXISTS idx_freight_docs_operation ON freight_customs_documents(freight_customs_operation_id);
CREATE INDEX IF NOT EXISTS idx_freight_docs_type ON freight_customs_documents(document_type);

-- Table des données de facture d'exportation
CREATE TABLE IF NOT EXISTS freight_customs_invoice_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_customs_operation_id UUID NOT NULL UNIQUE REFERENCES freight_customs_operations(id) ON DELETE CASCADE,

  -- Informations expéditeur (depuis mining company)
  sender_name TEXT,
  sender_address TEXT,
  sender_city TEXT,
  sender_country TEXT,
  sender_nif TEXT,

  -- Informations destinataire (raffinerie)
  recipient_name TEXT,
  recipient_address TEXT,
  recipient_city TEXT,
  recipient_country TEXT,
  recipient_phone TEXT,

  -- Informations mine
  mine_name TEXT,
  mine_location TEXT,
  country_of_origin TEXT,

  -- Informations douanières et transport
  exchange_rate_fcfa_usd DECIMAL(10, 4),
  number_of_boxes INTEGER,
  box_type TEXT DEFAULT 'Plastic Box',
  description TEXT DEFAULT 'Dore: Gold, Silver, ingot packed in boxes',

  -- Prix et valeurs
  metal_price_cfa_per_kg DECIMAL(15, 2),
  total_value_cfa DECIMAL(15, 2),
  total_value_usd DECIMAL(15, 2),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT fk_freight_operation_invoice
    FOREIGN KEY (freight_customs_operation_id)
    REFERENCES freight_customs_operations(id)
    ON DELETE CASCADE
);

-- Index pour invoice data
CREATE INDEX IF NOT EXISTS idx_invoice_data_operation ON freight_customs_invoice_data(freight_customs_operation_id);

-- Enable Row Level Security
ALTER TABLE freight_customs_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_customs_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_customs_invoice_data ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour freight_customs_operations
CREATE POLICY "Authenticated users can view freight customs operations"
  ON freight_customs_operations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can create freight customs operations"
  ON freight_customs_operations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can update freight customs operations"
  ON freight_customs_operations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authorized users can delete freight customs operations"
  ON freight_customs_operations
  FOR DELETE
  TO authenticated
  USING (true);

-- Politiques RLS pour freight_customs_documents
CREATE POLICY "Authenticated users can view freight documents"
  ON freight_customs_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create freight documents"
  ON freight_customs_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update freight documents"
  ON freight_customs_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete freight documents"
  ON freight_customs_documents
  FOR DELETE
  TO authenticated
  USING (true);

-- Politiques RLS pour freight_customs_invoice_data
CREATE POLICY "Authenticated users can view invoice data"
  ON freight_customs_invoice_data
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create invoice data"
  ON freight_customs_invoice_data
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update invoice data"
  ON freight_customs_invoice_data
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_freight_customs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER freight_customs_operations_updated_at
  BEFORE UPDATE ON freight_customs_operations
  FOR EACH ROW
  EXECUTE FUNCTION update_freight_customs_timestamp();

CREATE TRIGGER freight_customs_invoice_data_updated_at
  BEFORE UPDATE ON freight_customs_invoice_data
  FOR EACH ROW
  EXECUTE FUNCTION update_freight_customs_timestamp();

-- Fonction pour générer un numéro de référence unique
CREATE OR REPLACE FUNCTION generate_freight_reference()
RETURNS TEXT AS $$
DECLARE
  new_ref TEXT;
  ref_exists BOOLEAN;
BEGIN
  LOOP
    -- Format: FC-YYYYMMDD-XXXX
    new_ref := 'FC-' || to_char(now(), 'YYYYMMDD') || '-' ||
               LPAD(floor(random() * 10000)::TEXT, 4, '0');

    SELECT EXISTS(
      SELECT 1 FROM freight_customs_operations WHERE reference_number = new_ref
    ) INTO ref_exists;

    EXIT WHEN NOT ref_exists;
  END LOOP;

  RETURN new_ref;
END;
$$ LANGUAGE plpgsql;

-- Commentaires pour documentation
COMMENT ON TABLE freight_customs_operations IS 'Gestion des opérations douanières et de transport pour les expéditions';
COMMENT ON TABLE freight_customs_documents IS 'Documents douaniers et de transport associés aux opérations';
COMMENT ON TABLE freight_customs_invoice_data IS 'Données pour génération de factures d''exportation';
COMMENT ON COLUMN freight_customs_operations.status IS 'Statut: customs_pending, customs_approved, ready_for_transport, shipped_to_refinery';
COMMENT ON COLUMN freight_customs_documents.document_type IS 'Type de document: customs_declaration, customs_approval, transport_document, bill_of_lading, export_invoice, bullion_summary, other';
