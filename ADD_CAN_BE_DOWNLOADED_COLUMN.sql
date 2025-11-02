/*
  MIGRATION: Ajouter la colonne can_be_downloaded

  Description:
  Ajoute une colonne boolean 'can_be_downloaded' à la table batch_documents
  pour contrôler si un document peut être téléchargé ou seulement consulté
  sur la plateforme.

  Par défaut: true (permettre le téléchargement)
*/

-- Ajouter la colonne si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_documents'
    AND column_name = 'can_be_downloaded'
  ) THEN
    ALTER TABLE batch_documents
    ADD COLUMN can_be_downloaded boolean DEFAULT true NOT NULL;

    RAISE NOTICE '✅ Colonne can_be_downloaded ajoutée à batch_documents';
  ELSE
    RAISE NOTICE '✅ Colonne can_be_downloaded existe déjà';
  END IF;
END $$;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN batch_documents.can_be_downloaded IS
'Controls whether the document can be downloaded. If false, document can only be viewed on platform.';

-- Vérifier que la colonne existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_documents'
    AND column_name = 'can_be_downloaded'
  ) THEN
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '  MIGRATION RÉUSSIE';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '✅ La colonne can_be_downloaded est maintenant disponible';
    RAISE NOTICE '✅ Valeur par défaut: true (téléchargement autorisé)';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ ERREUR: La colonne n''a pas été créée correctement';
    RAISE NOTICE '';
  END IF;
END $$;
