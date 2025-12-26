-- ============================================================================
-- INSERTION DONNÉES TEST - ARTISANS MINIERS BURKINA FASO (VERSION CORRIGÉE)
-- ============================================================================
-- Exécutez APRÈS avoir exécuté diagnose-and-fix-artisans.sql
-- ============================================================================

-- Nettoyer les données existantes (optionnel)
TRUNCATE TABLE "SNP_artisans_miniers" CASCADE;

-- Exploitants (7 personnes physiques)
INSERT INTO "SNP_artisans_miniers" (
  type_personne, type_artisan, nom, prenoms, date_naissance, lieu_naissance,
  sexe, nationalite, pays, telephone, email, adresse, commune, region,
  type_piece_identite, numero_piece_identite, date_delivrance_piece,
  date_expiration_piece, lieu_delivrance_piece, observations
) VALUES
('physique', 'exploitant', 'OUEDRAOGO', 'Jean-Baptiste', '1985-03-15',
  'Ouagadougou', 'M', 'Burkinabé', 'Burkina Faso',
  '+226 70 12 34 56', 'jb.ouedraogo@email.bf', 'Secteur 15, Avenue Kwame Nkrumah',
  'Ouagadougou', 'Centre', 'CNI', 'B123456789', '2020-01-15',
  '2030-01-15', 'Ouagadougou', 'Exploitant actif depuis 2010'),

('physique', 'exploitant', 'KABORE', 'Marie-Claire', '1990-07-22',
  'Bobo-Dioulasso', 'F', 'Burkinabé', 'Burkina Faso',
  '+226 71 23 45 67', 'mc.kabore@email.bf', 'Quartier Lafiabougou',
  'Bobo-Dioulasso', 'Hauts-Bassins', 'CNI', 'B234567890', '2021-05-10',
  '2031-05-10', 'Bobo-Dioulasso', 'Spécialisée dans l''or alluvionnaire'),

('physique', 'exploitant', 'TRAORE', 'Moussa', '1982-11-08',
  'Dori', 'M', 'Burkinabé', 'Burkina Faso',
  '+226 72 34 56 78', 'moussa.traore@email.bf', 'Quartier Peulh',
  'Dori', 'Sahel', 'CNI', 'B345678901', '2019-08-20',
  '2029-08-20', 'Dori', 'Exploite dans la région du Sahel'),

('physique', 'exploitant', 'YE', 'Jacques', '1993-01-29',
  'Gaoua', 'M', 'Burkinabé', 'Burkina Faso',
  '+226 70 11 22 33', 'jacques.ye@email.bf', 'Quartier administratif',
  'Gaoua', 'Sud-Ouest', 'Passeport', 'BF2023001234', '2023-01-10',
  '2033-01-10', 'Ouagadougou', 'Jeune exploitant, formation technique'),

('physique', 'exploitant', 'BARRY', 'Seydou', '1988-09-21',
  'Djibo', 'M', 'Burkinabé', 'Burkina Faso',
  '+226 73 44 55 66', 'seydou.barry@email.bf', 'Quartier Sangha',
  'Djibo', 'Sahel', 'CNI', 'B334455667', '2020-02-17',
  '2030-02-17', 'Djibo', 'Exploitation artisanale familiale'),

('physique', 'exploitant', 'CONGO', 'Rosalie', '1987-05-30',
  'Pô', 'F', 'Burkinabé', 'Burkina Faso',
  '+226 74 55 66 77', 'rosalie.congo@email.bf', 'Centre-ville',
  'Pô', 'Centre-Sud', 'CNI', 'B445566778', '2021-08-12',
  '2031-08-12', 'Pô', 'Exploitante indépendante'),

('physique', 'exploitant', 'SANFO', 'André', '1985-12-24',
  'Léo', 'M', 'Burkinabé', 'Burkina Faso',
  '+226 75 66 77 88', 'andre.sanfo@email.bf', 'Secteur 3',
  'Léo', 'Centre-Ouest', 'CNI', 'B556677889', '2019-11-28',
  '2029-11-28', 'Léo', 'Membre coopérative artisans miniers');

-- Collecteurs (4 personnes physiques)
INSERT INTO "SNP_artisans_miniers" (
  type_personne, type_artisan, nom, prenoms, date_naissance, lieu_naissance,
  sexe, nationalite, pays, telephone, email, adresse, commune, region,
  type_piece_identite, numero_piece_identite, date_delivrance_piece,
  date_expiration_piece, lieu_delivrance_piece, observations
) VALUES
('physique', 'collecteur', 'SAWADOGO', 'Ibrahim', '1988-05-17',
  'Koudougou', 'M', 'Burkinabé', 'Burkina Faso',
  '+226 73 45 67 89', 'ibrahim.sawadogo@email.bf', 'Zone industrielle',
  'Koudougou', 'Centre-Ouest', 'CNI', 'B456789012', '2020-03-12',
  '2030-03-12', 'Koudougou', 'Collecteur agréé, réseau de 50+ artisans'),

('physique', 'collecteur', 'ZONGO', 'Fatimata', '1992-09-25',
  'Ouahigouya', 'F', 'Burkinabé', 'Burkina Faso',
  '+226 74 56 78 90', 'fatimata.zongo@email.bf', 'Avenue de l''Indépendance',
  'Ouahigouya', 'Nord', 'CNI', 'B567890123', '2021-11-05',
  '2031-11-05', 'Ouahigouya', 'Collectrice région Nord depuis 2015'),

('physique', 'collecteur', 'DIALLO', 'Amadou', '1986-02-14',
  'Banfora', 'M', 'Burkinabé', 'Burkina Faso',
  '+226 75 67 89 01', 'amadou.diallo@email.bf', 'Route de Sindou',
  'Banfora', 'Cascades', 'CNI', 'B678901234', '2020-07-18',
  '2030-07-18', 'Banfora', 'Collecteur zone Cascades'),

('physique', 'collecteur', 'NACRO', 'Aminata', '1986-10-16',
  'Dédougou', 'F', 'Burkinabé', 'Burkina Faso',
  '+226 71 22 33 44', 'aminata.nacro@email.bf', 'Zone commerciale',
  'Dédougou', 'Boucle du Mouhoun', 'CNI', 'B112233445', '2020-06-25',
  '2030-06-25', 'Dédougou', 'Réseau collecteurs Mouhoun');

-- Intermédiaires (3 personnes physiques)
INSERT INTO "SNP_artisans_miniers" (
  type_personne, type_artisan, nom, prenoms, date_naissance, lieu_naissance,
  sexe, nationalite, pays, telephone, email, adresse, commune, region,
  type_piece_identite, numero_piece_identite, date_delivrance_piece,
  date_expiration_piece, lieu_delivrance_piece, observations
) VALUES
('physique', 'intermediaire', 'SOME', 'Paul', '1987-12-03',
  'Tenkodogo', 'M', 'Burkinabé', 'Burkina Faso',
  '+226 76 78 90 12', 'paul.some@email.bf', 'Centre-ville',
  'Tenkodogo', 'Centre-Est', 'CNI', 'B789012345', '2019-10-22',
  '2029-10-22', 'Tenkodogo', 'Intermédiaire certifié'),

('physique', 'intermediaire', 'COMPAORE', 'Sophie', '1991-04-19',
  'Kaya', 'F', 'Burkinabé', 'Burkina Faso',
  '+226 77 89 01 23', 'sophie.compaore@email.bf', 'Quartier commercial',
  'Kaya', 'Centre-Nord', 'CNI', 'B890123456', '2021-02-28',
  '2031-02-28', 'Kaya', 'Intermédiation or et pierres précieuses'),

('physique', 'intermediaire', 'ILBOUDO', 'Boureima', '1990-03-12',
  'Ziniaré', 'M', 'Burkinabé', 'Burkina Faso',
  '+226 72 33 44 55', 'boureima.ilboudo@email.bf', 'Avenue de la Poste',
  'Ziniaré', 'Plateau-Central', 'CNI', 'B223344556', '2021-09-08',
  '2031-09-08', 'Ziniaré', 'Transactions importantes');

-- Fournisseurs (2 personnes physiques)
INSERT INTO "SNP_artisans_miniers" (
  type_personne, type_artisan, nom, prenoms, date_naissance, lieu_naissance,
  sexe, nationalite, pays, telephone, email, adresse, commune, region,
  type_piece_identite, numero_piece_identite, date_delivrance_piece,
  date_expiration_piece, lieu_delivrance_piece, observations
) VALUES
('physique', 'fournisseur', 'OUATTARA', 'Abdoulaye', '1984-08-11',
  'Fada N''Gourma', 'M', 'Burkinabé', 'Burkina Faso',
  '+226 78 90 12 34', 'abdoulaye.ouattara@email.bf', 'Zone commerciale',
  'Fada N''Gourma', 'Est', 'CNI', 'B901234567', '2020-09-14',
  '2030-09-14', 'Fada N''Gourma', 'Fournisseur équipements miniers'),

('physique', 'fournisseur', 'KONATE', 'Mariam', '1989-06-07',
  'Manga', 'F', 'Burkinabé', 'Burkina Faso',
  '+226 79 01 23 45', 'mariam.konate@email.bf', 'Marché central',
  'Manga', 'Centre-Sud', 'CNI', 'B012345678', '2021-04-30',
  '2031-04-30', 'Manga', 'Fournitures et consommables');

-- Personnes morales (4 sociétés)
INSERT INTO "SNP_artisans_miniers" (
  type_personne, type_artisan, raison_sociale, nationalite, pays,
  telephone, email, adresse, commune, region,
  type_piece_identite, numero_piece_identite, date_delivrance_piece,
  date_expiration_piece, lieu_delivrance_piece, observations
) VALUES
('morale', 'exploitant', 'Burkina Gold Mining SARL', 'Burkinabé', 'Burkina Faso',
  '+226 50 30 40 50', 'contact@burkina-gold-mining.bf', 'Zone industrielle de Kossodo',
  'Ouagadougou', 'Centre', 'Autre', 'RCCM-BF-2018-001',
  '2018-03-15', '2028-03-15', 'Ouagadougou', 'Société exploitation minière - 150 employés'),

('morale', 'collecteur', 'Or du Sahel SA', 'Burkinabé', 'Burkina Faso',
  '+226 50 31 41 51', 'info@ordusahel.bf', 'Boulevard Charles de Gaulle',
  'Ouagadougou', 'Centre', 'Autre', 'RCCM-BF-2019-045',
  '2019-07-20', '2029-07-20', 'Ouagadougou',
  'Collecteur majeur - 300+ artisans partenaires'),

('morale', 'intermediaire', 'Négoce Or Burkina', 'Burkinabé', 'Burkina Faso',
  '+226 50 32 42 52', 'contact@negocebf.bf', 'Zone commerciale',
  'Bobo-Dioulasso', 'Hauts-Bassins', 'Autre', 'RCCM-BF-2020-089',
  '2020-11-10', '2030-11-10', 'Bobo-Dioulasso',
  'Intermédiation nationale et internationale'),

('morale', 'fournisseur', 'Équipements Miniers BF', 'Burkinabé', 'Burkina Faso',
  '+226 50 33 43 53', 'ventes@equipminiers.bf', 'Route de l''Aéroport',
  'Ouagadougou', 'Centre', 'Autre', 'RCCM-BF-2017-123',
  '2017-05-08', '2027-05-08', 'Ouagadougou',
  'Fourniture matériel et équipements miniers');

-- Vérification finale
SELECT
  COUNT(*) as total_artisans,
  COUNT(*) FILTER (WHERE type_artisan = 'exploitant') as exploitants,
  COUNT(*) FILTER (WHERE type_artisan = 'collecteur') as collecteurs,
  COUNT(*) FILTER (WHERE type_artisan = 'intermediaire') as intermediaires,
  COUNT(*) FILTER (WHERE type_artisan = 'fournisseur') as fournisseurs,
  COUNT(*) FILTER (WHERE type_personne = 'physique') as personnes_physiques,
  COUNT(*) FILTER (WHERE type_personne = 'morale') as personnes_morales
FROM "SNP_artisans_miniers"
WHERE pays = 'Burkina Faso';

-- Afficher les 5 premiers artisans
SELECT
  id,
  numero_carte,
  type_personne,
  type_artisan,
  COALESCE(nom, raison_sociale) as nom,
  telephone,
  commune,
  region
FROM "SNP_artisans_miniers"
ORDER BY created_at DESC
LIMIT 5;
