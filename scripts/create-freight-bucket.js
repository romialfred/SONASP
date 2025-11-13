import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createFreightBucket() {
  console.log('🚀 Création du bucket freight-customs-documents...\n');

  try {
    // Vérifier si le bucket existe déjà
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Erreur lors de la vérification des buckets:', listError.message);
      process.exit(1);
    }

    const bucketExists = buckets.some(b => b.id === 'freight-customs-documents');

    if (bucketExists) {
      console.log('✅ Le bucket "freight-customs-documents" existe déjà');
      return;
    }

    // Créer le bucket
    const { data, error } = await supabase.storage.createBucket('freight-customs-documents', {
      public: false,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png'
      ]
    });

    if (error) {
      console.error('❌ Erreur lors de la création du bucket:', error.message);

      // Afficher des instructions pour le faire manuellement
      console.log('\n📋 Veuillez exécuter le SQL suivant dans Supabase Dashboard → SQL Editor:\n');
      console.log(`
-- Créer le bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'freight-customs-documents',
  'freight-customs-documents',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS
CREATE POLICY IF NOT EXISTS "Authenticated users can upload freight documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'freight-customs-documents');

CREATE POLICY IF NOT EXISTS "Authenticated users can view freight documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'freight-customs-documents');

CREATE POLICY IF NOT EXISTS "Authenticated users can update freight documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'freight-customs-documents');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete freight documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'freight-customs-documents');
      `);

      process.exit(1);
    }

    console.log('✅ Bucket "freight-customs-documents" créé avec succès!');
    console.log('📄 Nom:', data.name);
    console.log('🔒 Public:', data.public);
    console.log('📏 Limite de taille:', '50MB');
    console.log('📎 Types autorisés: PDF, JPEG, PNG');

    console.log('\n⚠️  N\'oubliez pas d\'appliquer les politiques RLS dans Supabase Dashboard → SQL Editor!');
    console.log('Voir: scripts/create-freight-bucket.sql\n');

  } catch (error) {
    console.error('❌ Erreur inattendue:', error.message);
    process.exit(1);
  }
}

createFreightBucket();
