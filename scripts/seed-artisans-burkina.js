import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const artisans = [
  {
    type_personne: 'physique',
    type_artisan: 'exploitant',
    nom: 'OUEDRAOGO',
    prenoms: 'Jean-Baptiste',
    date_naissance: '1985-03-15',
    lieu_naissance: 'Ouagadougou, Burkina Faso',
    sexe: 'M',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 70 12 34 56',
    email: 'jb.ouedraogo@email.bf',
    adresse: 'Secteur 15, Avenue Kwame Nkrumah',
    commune: 'Ouagadougou',
    region: 'Centre',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B123456789',
    date_delivrance_piece: '2020-01-15',
    date_expiration_piece: '2030-01-15',
    lieu_delivrance_piece: 'Ouagadougou',
    observations: 'Exploitant actif depuis 2010'
  },
  {
    type_personne: 'physique',
    type_artisan: 'exploitant',
    nom: 'KABORE',
    prenoms: 'Marie-Claire',
    date_naissance: '1990-07-22',
    lieu_naissance: 'Bobo-Dioulasso, Burkina Faso',
    sexe: 'F',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 71 23 45 67',
    email: 'mc.kabore@email.bf',
    adresse: 'Quartier Lafiabougou',
    commune: 'Bobo-Dioulasso',
    region: 'Hauts-Bassins',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B234567890',
    date_delivrance_piece: '2021-05-10',
    date_expiration_piece: '2031-05-10',
    lieu_delivrance_piece: 'Bobo-Dioulasso',
    observations: 'Spécialisée dans l\'or alluvionnaire'
  },
  {
    type_personne: 'physique',
    type_artisan: 'exploitant',
    nom: 'TRAORE',
    prenoms: 'Moussa',
    date_naissance: '1982-11-08',
    lieu_naissance: 'Dori, Burkina Faso',
    sexe: 'M',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 72 34 56 78',
    email: 'moussa.traore@email.bf',
    adresse: 'Quartier Peulh',
    commune: 'Dori',
    region: 'Sahel',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B345678901',
    date_delivrance_piece: '2019-08-20',
    date_expiration_piece: '2029-08-20',
    lieu_delivrance_piece: 'Dori',
    observations: 'Exploite dans la région du Sahel'
  },
  {
    type_personne: 'physique',
    type_artisan: 'collecteur',
    nom: 'SAWADOGO',
    prenoms: 'Ibrahim',
    date_naissance: '1988-05-17',
    lieu_naissance: 'Koudougou, Burkina Faso',
    sexe: 'M',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 73 45 67 89',
    email: 'ibrahim.sawadogo@email.bf',
    adresse: 'Zone industrielle',
    commune: 'Koudougou',
    region: 'Centre-Ouest',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B456789012',
    date_delivrance_piece: '2020-03-12',
    date_expiration_piece: '2030-03-12',
    lieu_delivrance_piece: 'Koudougou',
    observations: 'Collecteur agréé, réseau de 50+ artisans'
  },
  {
    type_personne: 'physique',
    type_artisan: 'collecteur',
    nom: 'ZONGO',
    prenoms: 'Fatimata',
    date_naissance: '1992-09-25',
    lieu_naissance: 'Ouahigouya, Burkina Faso',
    sexe: 'F',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 74 56 78 90',
    email: 'fatimata.zongo@email.bf',
    adresse: 'Avenue de l\'Indépendance',
    commune: 'Ouahigouya',
    region: 'Nord',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B567890123',
    date_delivrance_piece: '2021-11-05',
    date_expiration_piece: '2031-11-05',
    lieu_delivrance_piece: 'Ouahigouya',
    observations: 'Collectrice région Nord depuis 2015'
  },
  {
    type_personne: 'physique',
    type_artisan: 'collecteur',
    nom: 'DIALLO',
    prenoms: 'Amadou',
    date_naissance: '1986-02-14',
    lieu_naissance: 'Banfora, Burkina Faso',
    sexe: 'M',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 75 67 89 01',
    email: 'amadou.diallo@email.bf',
    adresse: 'Route de Sindou',
    commune: 'Banfora',
    region: 'Cascades',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B678901234',
    date_delivrance_piece: '2020-07-18',
    date_expiration_piece: '2030-07-18',
    lieu_delivrance_piece: 'Banfora',
    observations: 'Collecteur zone Cascades'
  },
  {
    type_personne: 'physique',
    type_artisan: 'intermediaire',
    nom: 'SOME',
    prenoms: 'Paul',
    date_naissance: '1987-12-03',
    lieu_naissance: 'Tenkodogo, Burkina Faso',
    sexe: 'M',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 76 78 90 12',
    email: 'paul.some@email.bf',
    adresse: 'Centre-ville',
    commune: 'Tenkodogo',
    region: 'Centre-Est',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B789012345',
    date_delivrance_piece: '2019-10-22',
    date_expiration_piece: '2029-10-22',
    lieu_delivrance_piece: 'Tenkodogo',
    observations: 'Intermédiaire certifié'
  },
  {
    type_personne: 'physique',
    type_artisan: 'intermediaire',
    nom: 'COMPAORE',
    prenoms: 'Sophie',
    date_naissance: '1991-04-19',
    lieu_naissance: 'Kaya, Burkina Faso',
    sexe: 'F',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 77 89 01 23',
    email: 'sophie.compaore@email.bf',
    adresse: 'Quartier commercial',
    commune: 'Kaya',
    region: 'Centre-Nord',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B890123456',
    date_delivrance_piece: '2021-02-28',
    date_expiration_piece: '2031-02-28',
    lieu_delivrance_piece: 'Kaya',
    observations: 'Intermédiation or et pierres précieuses'
  },
  {
    type_personne: 'physique',
    type_artisan: 'fournisseur',
    nom: 'OUATTARA',
    prenoms: 'Abdoulaye',
    date_naissance: '1984-08-11',
    lieu_naissance: 'Fada N\'Gourma, Burkina Faso',
    sexe: 'M',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 78 90 12 34',
    email: 'abdoulaye.ouattara@email.bf',
    adresse: 'Zone commerciale',
    commune: 'Fada N\'Gourma',
    region: 'Est',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B901234567',
    date_delivrance_piece: '2020-09-14',
    date_expiration_piece: '2030-09-14',
    lieu_delivrance_piece: 'Fada N\'Gourma',
    observations: 'Fournisseur équipements miniers'
  },
  {
    type_personne: 'physique',
    type_artisan: 'fournisseur',
    nom: 'KONATE',
    prenoms: 'Mariam',
    date_naissance: '1989-06-07',
    lieu_naissance: 'Manga, Burkina Faso',
    sexe: 'F',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 79 01 23 45',
    email: 'mariam.konate@email.bf',
    adresse: 'Marché central',
    commune: 'Manga',
    region: 'Centre-Sud',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B012345678',
    date_delivrance_piece: '2021-04-30',
    date_expiration_piece: '2031-04-30',
    lieu_delivrance_piece: 'Manga',
    observations: 'Fournitures et consommables'
  },
  {
    type_personne: 'physique',
    type_artisan: 'exploitant',
    nom: 'YE',
    prenoms: 'Jacques',
    date_naissance: '1993-01-29',
    lieu_naissance: 'Gaoua, Burkina Faso',
    sexe: 'M',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 70 11 22 33',
    email: 'jacques.ye@email.bf',
    adresse: 'Quartier administratif',
    commune: 'Gaoua',
    region: 'Sud-Ouest',
    type_piece_identite: 'Passeport',
    numero_piece_identite: 'BF2023001234',
    date_delivrance_piece: '2023-01-10',
    date_expiration_piece: '2033-01-10',
    lieu_delivrance_piece: 'Ouagadougou',
    observations: 'Jeune exploitant, formation technique'
  },
  {
    type_personne: 'physique',
    type_artisan: 'collecteur',
    nom: 'NACRO',
    prenoms: 'Aminata',
    date_naissance: '1986-10-16',
    lieu_naissance: 'Dédougou, Burkina Faso',
    sexe: 'F',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 71 22 33 44',
    email: 'aminata.nacro@email.bf',
    adresse: 'Zone commerciale',
    commune: 'Dédougou',
    region: 'Boucle du Mouhoun',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B112233445',
    date_delivrance_piece: '2020-06-25',
    date_expiration_piece: '2030-06-25',
    lieu_delivrance_piece: 'Dédougou',
    observations: 'Réseau collecteurs Mouhoun'
  },
  {
    type_personne: 'physique',
    type_artisan: 'intermediaire',
    nom: 'ILBOUDO',
    prenoms: 'Boureima',
    date_naissance: '1990-03-12',
    lieu_naissance: 'Ziniaré, Burkina Faso',
    sexe: 'M',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 72 33 44 55',
    email: 'boureima.ilboudo@email.bf',
    adresse: 'Avenue de la Poste',
    commune: 'Ziniaré',
    region: 'Plateau-Central',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B223344556',
    date_delivrance_piece: '2021-09-08',
    date_expiration_piece: '2031-09-08',
    lieu_delivrance_piece: 'Ziniaré',
    observations: 'Transactions importantes'
  },
  {
    type_personne: 'morale',
    type_artisan: 'exploitant',
    raison_sociale: 'Burkina Gold Mining SARL',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 50 30 40 50',
    email: 'contact@burkina-gold-mining.bf',
    adresse: 'Zone industrielle de Kossodo',
    commune: 'Ouagadougou',
    region: 'Centre',
    type_piece_identite: 'Autre',
    numero_piece_identite: 'RCCM-BF-2018-001',
    date_delivrance_piece: '2018-03-15',
    date_expiration_piece: '2028-03-15',
    lieu_delivrance_piece: 'Ouagadougou',
    observations: 'Société exploitation minière - 150 employés'
  },
  {
    type_personne: 'morale',
    type_artisan: 'collecteur',
    raison_sociale: 'Or du Sahel SA',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 50 31 41 51',
    email: 'info@ordusahel.bf',
    adresse: 'Boulevard Charles de Gaulle',
    commune: 'Ouagadougou',
    region: 'Centre',
    type_piece_identite: 'Autre',
    numero_piece_identite: 'RCCM-BF-2019-045',
    date_delivrance_piece: '2019-07-20',
    date_expiration_piece: '2029-07-20',
    lieu_delivrance_piece: 'Ouagadougou',
    observations: 'Collecteur majeur - 300+ artisans partenaires'
  },
  {
    type_personne: 'morale',
    type_artisan: 'intermediaire',
    raison_sociale: 'Négoce Or Burkina',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 50 32 42 52',
    email: 'contact@negocebf.bf',
    adresse: 'Zone commerciale',
    commune: 'Bobo-Dioulasso',
    region: 'Hauts-Bassins',
    type_piece_identite: 'Autre',
    numero_piece_identite: 'RCCM-BF-2020-089',
    date_delivrance_piece: '2020-11-10',
    date_expiration_piece: '2030-11-10',
    lieu_delivrance_piece: 'Bobo-Dioulasso',
    observations: 'Intermédiation nationale et internationale'
  },
  {
    type_personne: 'morale',
    type_artisan: 'fournisseur',
    raison_sociale: 'Équipements Miniers BF',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 50 33 43 53',
    email: 'ventes@equipminiers.bf',
    adresse: 'Route de l\'Aéroport',
    commune: 'Ouagadougou',
    region: 'Centre',
    type_piece_identite: 'Autre',
    numero_piece_identite: 'RCCM-BF-2017-123',
    date_delivrance_piece: '2017-05-08',
    date_expiration_piece: '2027-05-08',
    lieu_delivrance_piece: 'Ouagadougou',
    observations: 'Fourniture matériel et équipements miniers'
  },
  {
    type_personne: 'physique',
    type_artisan: 'exploitant',
    nom: 'BARRY',
    prenoms: 'Seydou',
    date_naissance: '1988-09-21',
    lieu_naissance: 'Djibo, Burkina Faso',
    sexe: 'M',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 73 44 55 66',
    email: 'seydou.barry@email.bf',
    adresse: 'Quartier Sangha',
    commune: 'Djibo',
    region: 'Sahel',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B334455667',
    date_delivrance_piece: '2020-02-17',
    date_expiration_piece: '2030-02-17',
    lieu_delivrance_piece: 'Djibo',
    observations: 'Exploitation artisanale familiale'
  },
  {
    type_personne: 'physique',
    type_artisan: 'exploitant',
    nom: 'Congo',
    prenoms: 'Rosalie',
    date_naissance: '1987-05-30',
    lieu_naissance: 'Pô, Burkina Faso',
    sexe: 'F',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 74 55 66 77',
    email: 'rosalie.congo@email.bf',
    adresse: 'Centre-ville',
    commune: 'Pô',
    region: 'Centre-Sud',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B445566778',
    date_delivrance_piece: '2021-08-12',
    date_expiration_piece: '2031-08-12',
    lieu_delivrance_piece: 'Pô',
    observations: 'Exploitante indépendante'
  },
  {
    type_personne: 'physique',
    type_artisan: 'exploitant',
    nom: 'SANFO',
    prenoms: 'André',
    date_naissance: '1985-12-24',
    lieu_naissance: 'Léo, Burkina Faso',
    sexe: 'M',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
    telephone: '+226 75 66 77 88',
    email: 'andre.sanfo@email.bf',
    adresse: 'Secteur 3',
    commune: 'Léo',
    region: 'Centre-Ouest',
    type_piece_identite: 'CNI',
    numero_piece_identite: 'B556677889',
    date_delivrance_piece: '2019-11-28',
    date_expiration_piece: '2029-11-28',
    lieu_delivrance_piece: 'Léo',
    observations: 'Membre coopérative artisans miniers'
  }
];

async function seedArtisans() {
  console.log('Début de l\'insertion des données de test...\n');

  console.log('Vérification des artisans existants du Burkina Faso...');
  const { data: existing, error: checkError } = await supabase
    .from('snp_artisans_miniers')
    .select('id, nom, prenoms, raison_sociale, pays')
    .eq('pays', 'Burkina Faso');

  if (checkError) {
    console.error('Erreur lors de la vérification:', checkError);
    process.exit(1);
  }

  console.log(`Artisans existants: ${existing?.length || 0}\n`);

  let inserted = 0;
  let skipped = 0;

  for (const artisan of artisans) {
    const identifier = artisan.nom ?
      `${artisan.nom} ${artisan.prenoms}` :
      artisan.raison_sociale;

    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .insert(artisan)
      .select();

    if (error) {
      if (error.code === '23505') {
        console.log(`⚠️  ${identifier} - Déjà existant (ignoré)`);
        skipped++;
      } else {
        console.error(`❌ ${identifier} - Erreur:`, error.message);
      }
    } else {
      console.log(`✅ ${identifier} - Inséré avec succès`);
      inserted++;
    }
  }

  console.log('\n=== RÉSUMÉ ===');
  console.log(`Artisans insérés: ${inserted}`);
  console.log(`Artisans ignorés (déjà existants): ${skipped}`);
  console.log(`Total: ${artisans.length}`);

  console.log('\nVérification finale...');
  const { data: final, error: finalError } = await supabase
    .from('snp_artisans_miniers')
    .select('id, nom, prenoms, raison_sociale, type_artisan, region')
    .eq('pays', 'Burkina Faso')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!finalError && final) {
    console.log(`\n${final.length} artisans du Burkina Faso dans la base:\n`);
    final.forEach(a => {
      const name = a.nom ? `${a.nom} ${a.prenoms}` : a.raison_sociale;
      console.log(`  - ${name} (${a.type_artisan}) - ${a.region}`);
    });
  }
}

seedArtisans()
  .then(() => {
    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });
