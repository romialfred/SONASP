import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

// Cartographie documentaire : aucune exécution/importation du code applicatif.
const root = process.cwd();
const out = path.join(root, 'docs/amelioration/lot-artisanat');
const baseline = '83f8c74ea83c81a2734ef9e086c2edd211573ebe';
const candidateCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const files = new Map();
const read = (p) => { if (!files.has(p)) files.set(p, fs.readFileSync(path.join(root, p), 'utf8')); return files.get(p); };
const loc = (p, token, start = 0) => {
  const data = read(p), i = data.indexOf(token, start);
  if (i < 0) throw new Error(`Ancre absente : ${p} / ${token}`);
  return `${p}:${data.slice(0, i).split('\n').length}`;
};
const parsed = new Map();
function tree(p) {
  if (!parsed.has(p)) parsed.set(p, ts.createSourceFile(p, read(p), ts.ScriptTarget.Latest, true, p.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
  return parsed.get(p);
}
function callLoc(p, name, key) {
  let found;
  const visit = (n) => {
    if (!found && ts.isCallExpression(n) && n.expression.getText(tree(p)) === name && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === key) found = `${p}:${tree(p).getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    ts.forEachChild(n, visit);
  };
  visit(tree(p));
  return found;
}
function objectKeys(p, name) {
  let result;
  const visit = n => {
    if (ts.isVariableDeclaration(n) && n.name.getText() === name && n.initializer && ts.isObjectLiteralExpression(n.initializer)) result = n.initializer.properties.filter(ts.isPropertyAssignment).map(v => v.name.getText().replaceAll('"', '').replaceAll("'", ''));
    ts.forEachChild(n, visit);
  };
  visit(tree(p)); return result;
}
const P = {
  site: 'src/pages/artisanal-sites/ArtisanalSiteForm.tsx', siteService: 'src/services/artisanalSiteService.ts', siteDetail: 'src/pages/artisanal-sites/ArtisanalSiteDetails.tsx', siteSQL: 'supabase/migrations/20260906093115_sites_artisanaux_formalisation_aea.sql',
  artisan: 'src/components/artisan/ArtisanDossierFields.tsx', artisanForm: 'src/components/artisan/ArtisanMinierForm.tsx', artisanLib: 'src/lib/artisanDossier.ts', artisanService: 'src/services/artisanDossierService.ts', artisanDetail: 'src/components/artisan/ArtisanDossierSummary.tsx', artisanSQL: 'supabase/migrations/20260906111030_refonte_dossier_artisan.sql',
  collector: 'src/pages/collector/CollectorForm.tsx', collectorLib: 'src/lib/collectorDossier.ts', collectorService: 'src/services/collectorService.ts', collectorDetail: 'src/pages/collector/CollectorDetails.tsx', collectorSQL: 'supabase/migrations/20260906145430_collecteurs_comptoirs_ventes.sql',
  comptoir: 'src/pages/collector/ComptoirForm.tsx', comptoirLib: 'src/lib/comptoirDossier.ts', comptoirService: 'src/services/comptoirService.ts', comptoirSQL: 'supabase/migrations/20260906174800_dossiers_comptoirs_entreprises.sql',
  documents: 'src/components/artisan/ArtisanDocuments.tsx', docService: 'src/services/artisanDocumentService.ts', moyenService: 'src/services/artisanMoyenPaiementService.ts',
  moyenSQL: 'supabase/migrations/20260824235950_lot_4b_separation_fonctions_et_integrite_reglementaire.sql',
};
const rows = [];
function add(formulaire, champ, data) {
  rows.push({ id: `MAP-${formulaire}-${champ.replaceAll(/[^a-zA-Z0-9_.-]/g, '_')}`, formulaire, champ, nature: 'SAISIE_METIER', variante: 'Création et modification', libelle: champ, controle_id: '', obligation_enregistrement: 'Facultatif ; contrôles de format si renseigné', payload: '', rpc_service: '', stockage: '', transformation_relation: '', restitution_detail: 'RESTITUE_STATIQUEMENT', ecart_detail: '', source_ui_candidat: '', source_payload_candidat: '', source_stockage_candidat: '', source_detail_candidat: '', statut: 'REVUE_STATIQUE_CHAMP; UI_API_BASE_NON_EXECUTE', ...data });
}

// Site : 20 valeurs métier hors AEA, puis 3 champs AEA et deux contrôles de fichiers.
const siteFields = [
 ['name','Nom du site','name','Requis'], ['status','Statut','status','Requis ; planned par défaut'], ['formalization','Catégorie du site','formalization','Requis'],
 ['region','Région','region','Requis'], ['province','Province','province','Requis'], ['locality','Localité','locality','Requis'],
 ['areaHectares','Superficie (hectares)','area_hectares','Requis ; > 0'], ['latitude','Latitude','latitude','Requis ; 9 à 16'], ['longitude','Longitude','longitude','Requis ; -6 à 3'],
 ['authorizedMiners','Artisans autorisés','authorized_miners','Requis ; entier >= 0'], ['activeMiners','Artisans actifs','active_miners','Requis ; entier >= 0 et <= autorisés'],
 ['averageHoleDepthMeters','Profondeur moyenne (m)','average_hole_depth_m','Requis ; >= 0'], ['authorizedChemicals','Produits chimiques autorisés','authorized_chemicals','Facultatif ; cases existantes'], ['notes','Notes et observations','notes','Facultatif'],
];
for (const [key,label,column,required] of siteFields) add('SITE', key, {
 libelle:label, controle_id: key === 'status' ? 'name=site-status' : key === 'formalization' ? 'name=formalization' : 'Sans id explicite ; label englobant', obligation_enregistrement:required,
 payload:`p_site.${column}`, rpc_service:'snp_save_artisanal_site', stockage:`artisanal_sites.${column}`,
 transformation_relation:key === 'region' ? 'Le changement de région efface province/localité ; clic carte renseigne région/province/GPS.' : key === 'formalization' ? 'formalized / non_formalized ; branche non formalisée efface les références AEA côté payload/trigger.' : '',
 source_ui_candidat: key === 'formalization' ? loc(P.site,'name="formalization"') : key === 'status' ? loc(P.site,'name="site-status"') : key === 'authorizedChemicals' ? loc(P.site,'checked={form.authorizedChemicals') : loc(P.site,`value={form.${key}`),
 source_payload_candidat:loc(P.siteService,`${column}:`), source_stockage_candidat:loc(P.siteSQL,'INSERT INTO public.artisanal_sites'), source_detail_candidat:loc(P.siteDetail, key === 'formalization' ? 'FORMALIZATION_LABELS[site.formalization' : `site.${key}`, read(P.siteDetail).indexOf('return <NationalDashboardLayout><div className="site-detail">')),
});
for (const [role,roleDB] of [['manager','site_manager'],['collectionOfficer','collection_officer']]) for (const [key,label,column] of [['fullName','Nom complet','full_name'],['phone','Téléphone','phone'],['email','Adresse e-mail','email']]) add('SITE', `${role}.${key}`, {
 libelle:`${role === 'manager' ? 'Responsable du site' : 'Chargé de collecte'} — ${label}`, controle_id:'Sans id explicite ; label englobant dans chaque carte responsable', obligation_enregistrement:key === 'email' ? 'Facultatif ; e-mail' : 'Requis',
 payload:`p_assignments[role=${roleDB}].${column}`, rpc_service:'snp_save_artisanal_site', stockage:`artisanal_site_assignments.${column}`, transformation_relation:`Relation site_id + role=${roleDB}; UPSERT sur (site_id,role).`,
 source_ui_candidat:loc(P.site,`value={contact.${key}`), source_payload_candidat:loc(P.siteService,'const assignments'), source_stockage_candidat:loc(P.siteSQL,'INSERT INTO public.artisanal_site_assignments'), source_detail_candidat:loc(P.siteDetail,`contact.${key}`),
});
for (const [key,label,column] of [['number','Numéro de l’AEA','aea_number'],['issuedOn','Date d’émission','aea_issued_on'],['durationMonths','Durée de validité (mois)','aea_duration_months']]) add('SITE',`aea.${key}`,{
 libelle:label,variante:'Site formalisé uniquement',controle_id:'Sans id explicite ; label englobant',obligation_enregistrement:'Requis pour site formalisé ; absent du payload non formalisé',payload:`p_site.${column}`,rpc_service:'snp_save_artisanal_site',stockage:`artisanal_sites.${column}`,transformation_relation:key==='number'?'trim ; longueur 1 à 120':key==='durationMonths'?'Nombre entier de mois, 1 à 1200 ; date d’expiration calculée, pas saisie.':'Date ISO ; validation AEA existante.',
 source_ui_candidat:loc(P.site,`value={form.aea?.${key}`),source_payload_candidat:loc(P.siteService,`${column}:`),source_stockage_candidat:loc(P.siteSQL,'INSERT INTO public.artisanal_sites'),source_detail_candidat:loc(P.siteDetail,`site.aea.${key}`),
});
add('SITE','aeaFile',{nature:'FICHIER',libelle:'Justificatif AEA',variante:'Site formalisé uniquement',controle_id:'aea-file',obligation_enregistrement:'Justificatif nouveau ou déjà rattaché requis',payload:'saveSite(input,aeaFile) puis p_site.aea_document_path/name',rpc_service:'siteAeaDocumentService.upload puis snp_save_artisanal_site',stockage:'storage.objects[artisanal-site-aea] + artisanal_sites.aea_document_path / aea_document_name',transformation_relation:'PDF/JPEG/PNG <= 10 Mo ; dépôt avant RPC ; suppression de brouillon si sauvegarde échoue selon protection serveur.',source_ui_candidat:loc(P.site,'id="aea-file"'),source_payload_candidat:loc(P.siteService,'siteAeaDocumentService.upload'),source_stockage_candidat:loc(P.siteSQL,'INSERT INTO public.artisanal_sites'),source_detail_candidat:loc(P.siteDetail,'site-detail-document')});
add('SITE','photos',{nature:'FICHIER',libelle:'Photos du site',controle_id:'Sans id explicite ; label englobant',payload:'p_site.photos[]',rpc_service:'uploadSitePhoto puis snp_save_artisanal_site',stockage:'artisanal_sites.photos ; Storage ou repli data URL dans sitePhotoService',transformation_relation:'Sélection multiple, compression ; compteur MAX_SITE_PHOTOS. Voir SITE-DOC-007 pour les erreurs de dépôt/lecture.',restitution_detail:'RESTITUE_SOUS_RESERVE_LECTURE',source_ui_candidat:loc(P.site,'multiple onChange={addPhotos}'),source_payload_candidat:loc(P.siteService,'photos: input.photos'),source_stockage_candidat:loc(P.siteSQL,'INSERT INTO public.artisanal_sites'),source_detail_candidat:loc(P.siteDetail,'Photos du site')});

// Artisan : champs communs, branches juridique/identité et responsable distinct.
const common = [
 ['type_personne','Qualité juridique','Requis ; figé en édition'],['type_artisan','Rôle dans la filière','Requis ; transition confirmée en édition'],
 ['pays','Pays','Requis'],['region','Région','Requis'],['commune','Commune','Requis'],['adresse','Adresse du lieu d’exercice','Facultatif'],['telephone','Téléphone','Requis'],['whatsapp','Téléphone WhatsApp','Facultatif'],['whatsapp_identique','Identique au téléphone','Facultatif'],['email','E-mail','Facultatif'],['artisanal_site_id','Site artisanal de rattachement','Facultatif hors aide exploitant'],['exploitant_id','Exploitant de rattachement','Requis pour aide exploitant'],['observations','Observations','Facultatif'],
];
const physical = [
 ['nom','Nom','Requis'],['prenoms','Prénom(s)','Facultatif'],['date_naissance','Date de naissance','Requis ; adulte >= 18 ans'],['lieu_naissance','Lieu de naissance','Facultatif'],['sexe','Sexe','Facultatif ; M/F uniquement dans la liste'],['nationalite','Nationalité','Facultatif'],['type_piece_identite','Type de pièce','Requis'],['numero_piece_identite','Numéro de pièce','Requis'],['date_delivrance_piece','Date de délivrance','Facultatif ; pas future'],['date_expiration_piece','Date d’expiration','Facultatif ; >= délivrance'],['lieu_delivrance_piece','Lieu de délivrance','Facultatif'],
];
const company = [ ['raison_sociale','Raison sociale'],['numero_registre_commerce','Numéro RCCM'],['numero_ifu','Numéro IFU'],['siege_pays','Pays du siège'],['siege_region','Région du siège'],['siege_commune','Commune du siège'],['siege_adresse','Adresse complète du siège'] ];
const responsible = [ ['nom','Nom'],['prenoms','Prénom(s)'],['date_naissance','Date de naissance'],['telephone','Téléphone'],['whatsapp','WhatsApp'],['whatsapp_identique','WhatsApp identique au téléphone'],['email','E-mail'],['fonction','Fonction'],['type_piece_identite','Type de pièce'],['numero_piece_identite','Numéro de pièce'],['date_delivrance_piece','Date de délivrance'],['date_expiration_piece','Date d’expiration'],['lieu_delivrance_piece','Lieu de délivrance'] ];
function artisanUILoc(key) {
 const direct = callLoc(P.artisan,'text',key) || callLoc(P.artisan,'select',key);
 if (direct) return direct;
 const base = key.replace(/^responsable\./,'').replace(/^siege_/, '');
 if (key==='type_personne') return loc(P.artisan,'name="type-personne"');
 if (key==='type_artisan') return loc(P.artisan,'name="type-artisan"');
 if (['pays','region','commune'].includes(base) || base.includes('piece')) return loc(P.artisan,'${prefix}'+base);
 if (base==='telephone'||base==='whatsapp') return loc(P.artisan,'id={`${prefix}'+base);
 if (base==='whatsapp_identique') return loc(P.artisan,'write(`${prefix}whatsapp_identique`');
 if (key==='artisanal_site_id') return loc(P.artisan,'value={v.artisanal_site_id}');
 if (key==='exploitant_id') return loc(P.artisan,'id="exploitant_id"');
 if (key==='observations') return loc(P.artisan,'id="observations"');
 throw new Error('UI artisan non cartographiée : '+key);
}
function artisanDetail(key) {
 const base = key.replace(/^responsable\./,'');
 if (key.startsWith('responsable.')) return base==='whatsapp_identique' ? loc(P.artisanDetail,'r.whatsapp') : loc(P.artisanDetail,`r.${base}`);
 if (key==='whatsapp_identique') return loc(P.artisanDetail,'artisan.whatsapp');
 if (key==='nom'||key==='prenoms'||key==='raison_sociale') return loc(P.artisanDetail,'["Nom", artisanFullName(artisan)]');
 return loc(P.artisanDetail,`artisan.${key}`);
}
for (const [key,label,req] of [...common,...physical,...company.map(([k,l])=>[k,l,'Requis pour personne morale']),...responsible.map(([k,l])=>[`responsable.${k}`,`${l} du responsable`,['nom','prenoms','date_naissance','telephone','fonction','type_piece_identite','numero_piece_identite'].includes(k)?'Requis pour personne morale':'Facultatif'])]) {
 const isResponsible = key.startsWith('responsable.'), isCompany = company.some(([k])=>k===key), isPhysical=physical.some(([k])=>k===key);
 let detail = artisanDetail(key);
 add('ARTISAN',key,{
  libelle:label,controle_id:key==='type_personne'?'name=type-personne':key==='type_artisan'?'name=type-artisan ; role-{valeur}':key.endsWith('whatsapp_identique')?'Sans id explicite ; label englobant':key==='artisanal_site_id'?'ComboBox — id généré par le composant':key,
  variante:isResponsible?'Personne morale — responsable':isCompany?'Personne morale':isPhysical?'Personne physique':key==='exploitant_id'?'Aide exploitant':key==='artisanal_site_id'?'Tous rôles hors aide exploitant':'Branches physique/morale', obligation_enregistrement:req,
  payload:`p_dossier.${key}`,rpc_service:'artisanDossierPayload puis snp_save_artisan_dossier',stockage:isResponsible?`snp_artisan_responsables.${key.slice(12)}`:`snp_artisans_miniers.${key}`,
  transformation_relation:isResponsible?'Objet responsable lié par artisan_id ; champs vides des dates pièce convertis à null.':key==='exploitant_id'?'Relation vers exploitant existant ; recherche puis choix, texte de recherche non persisté.':key==='artisanal_site_id'?'Relation vers artisanal_sites.id ; null envoyé pour aide exploitant (site hérité).':key==='whatsapp'||key==='whatsapp_identique'?'WhatsApp reprend le téléphone lorsque la case est cochée.':'Seule la branche juridique active est transmise ; les champs de l’autre branche ne sont pas envoyés.',
  restitution_detail:key.endsWith('whatsapp_identique')?'RESTITUTION_DERIVEE':'RESTITUE_STATIQUEMENT',source_ui_candidat:artisanUILoc(key), source_payload_candidat:isResponsible?loc(P.artisanLib,'...v.responsable,'):loc(P.artisanLib,`${key}:`,read(P.artisanLib).indexOf('export function artisanDossierPayload')),source_stockage_candidat:loc(P.artisanSQL,isResponsible?'INSERT INTO public.snp_artisan_responsables(artisan_id':'INSERT INTO public.snp_artisans_miniers(id'),source_detail_candidat:detail,
 });
}

// Sous-formulaires documentaires : les propriétaires et les branches sont distincts.
for (const owner of ['artisan','societe','responsable']) for (const field of ['type','title','file']) add('ARTISAN',`documents.${owner}.${field}`,{
 nature:field==='file'?'FICHIER':'SAISIE_DOCUMENTAIRE',libelle:field==='type'?'Type de justificatif':field==='title'?'Titre des pièces':'Fichiers justificatifs',variante:owner==='artisan'?'Personne physique':`Personne morale — ${owner}`,controle_id:field==='file'?`files-${owner}-documents`:'Sans id explicite ; label englobant',obligation_enregistrement:'Facultatif dans la création principale ; validé si déposé',
 payload:field==='type'?'metadata.documentType':field==='title'?'metadata.title':'file (binaire)',rpc_service:'artisanDocumentService.upload / sensitiveUploadGateway / snp_register_artisan_document',stockage:`snp_artisan_documents.${field==='type'?'type_document':field==='title'?'titre':'chemin_fichier'}${field==='file'?' + Storage artisan-dossiers':''}`,transformation_relation:`owner_kind=${owner}; artisan_id ; responsable_id pour owner responsable. ${field==='title'?'Titre vide remplacé par nom du fichier.':''}`,source_ui_candidat:loc(P.documents,field==='type'?'value={type}':field==='title'?'value={title}':'id={inputId}'),source_payload_candidat:loc(P.docService,field==='type'?'documentType:':field==='title'?'title:':'await uploadSensitiveFile('),source_stockage_candidat:loc(P.artisanSQL,'INSERT INTO public.snp_artisan_documents(id'),source_detail_candidat:loc(P.artisanDetail,'documents.map((doc)'),
});
add('ARTISAN','photoFile',{nature:'FICHIER',libelle:'Photo d’identité',variante:'Personne physique uniquement',controle_id:'files-artisan-photo',payload:'file + metadata.documentType=photo',rpc_service:'artisanDocumentService.upload / snp_register_artisan_document',stockage:'snp_artisan_documents + Storage artisan-dossiers ; snp_artisans_miniers.photo_url mis à jour côté serveur',transformation_relation:'JPEG/PNG <= 2 Mo ; section photo absente de la branche personne morale.',restitution_detail:'RESTITUE_COMME_DOCUMENT',source_ui_candidat:loc(P.artisanForm,'!company && documentBlock("artisan", true)'),source_payload_candidat:loc(P.docService,'await uploadSensitiveFile('),source_stockage_candidat:loc(P.artisanSQL,"IF d.type_document='photo' THEN UPDATE"),source_detail_candidat:loc(P.artisanDetail,'documents.map((doc)')});
const moyenFields = [['type','Type'],['titulaire','Titulaire du compte'],['numero_telephone','Numéro de téléphone'],['banque','Banque'],['numero_compte','Numéro de compte'],['code_swift','Code SWIFT'],['est_principal','Principal']];
for (const [key,label] of moyenFields) add('ARTISAN',`moyens.${key}`,{
 libelle:label,variante:['numero_telephone'].includes(key)?'Moyen mobile': ['banque','numero_compte','code_swift'].includes(key)?'Virement bancaire ou chèque':'Tous moyens ; habilitation requise pour modifier',controle_id:key==='est_principal'?'name=moyen-principal':'Sans id explicite ; label englobant',obligation_enregistrement:key==='code_swift'||key==='est_principal'?'Facultatif':'Requis selon type du moyen',payload:`p_${key}`,rpc_service:'artisanMoyenPaiementService.remplacerPourArtisan / snp_upsert_artisan_moyen_paiement',stockage:`snp_artisan_moyens_paiement.${key}`,transformation_relation:'Sauvegarde séparée après le dossier ; reprise explicite en cas d’échec. Révision distincte avant règlement.',restitution_detail:'ABSENT_DU_DETAIL_PRINCIPAL',ecart_detail:'Aucun bloc moyens de paiement dans ArtisanDossierSummary ou ArtisanMinierDetails ; relisible en édition, pas dans ce détail.',source_ui_candidat:loc(P.artisanForm,key==='est_principal'?'checked={Boolean(moyen.est_principal)}':`value={moyen.${key}`),source_payload_candidat:loc(P.moyenService,`p_${key}:`),source_stockage_candidat:loc(P.moyenService,"const TABLE = 'snp_artisan_moyens_paiement'"),source_detail_candidat:loc(P.artisanDetail,'export function ArtisanDossierSummary'),
});
add('ARTISAN','reviewReason',{nature:'SAISIE_ACTION_REVUE',libelle:'Motif de rejet d’un moyen',variante:'Moyen sauvegardé, actif, non vérifié ; habilitation requise',controle_id:'review-reason-{moyen.id}',obligation_enregistrement:'Au moins 10 caractères pour rejeter ; action distincte de sauvegarde dossier',payload:'p_motif',rpc_service:'artisanMoyenPaiementService.verifier / snp_verifier_artisan_moyen_paiement',stockage:'Motif de décision du moyen ; RPC à relire pour colonnes d’audit',restitution_detail:'ABSENT_DU_DETAIL_PRINCIPAL',ecart_detail:'Décision accessible dans le formulaire, pas de bloc de restitution dans le détail principal.',source_ui_candidat:loc(P.artisanForm,'id={`review-reason-${moyen.id}`}'),source_payload_candidat:loc(P.moyenService,"'snp_verifier_artisan_moyen_paiement'",read(P.moyenService).indexOf('export const artisanMoyenPaiementService')),source_stockage_candidat:loc(P.moyenService,"const TABLE = 'snp_artisan_moyens_paiement'"),source_detail_candidat:loc(P.artisanDetail,'export function ArtisanDossierSummary')});

// Collecteur : identité physique partagée, contrôle géographique dédié, plusieurs sites/un organisme.
const collectorFields = [...common.filter(([k])=>!['type_personne','type_artisan','artisanal_site_id','exploitant_id'].includes(k)),...physical,['site_ids','Sites de collecte','Au moins un site'],['organization_id','Organisme de rattachement','Requis']];
const collectorOmissions = new Set(['date_naissance','lieu_naissance','sexe','nationalite','type_piece_identite','numero_piece_identite','date_delivrance_piece','date_expiration_piece','lieu_delivrance_piece','observations']);
for (const [key,label,req] of collectorFields) {
 const relational = key==='site_ids'||key==='organization_id';
 const ui = callLoc(P.collector,'text',key) || (key==='site_ids'?loc(P.collector,'set("site_ids", [...new Set'):key==='organization_id'?loc(P.collector,'value={values.organization_id}'):key==='observations'?loc(P.collector,'value={values.observations}'):key==='whatsapp_identique'?loc(P.collector,'checked={values.whatsapp_identique}'):loc(P.collector,`values.${key}`,read(P.collector).indexOf('<fieldset disabled={busy}')));
 const detail = collectorOmissions.has(key)?loc(P.collectorDetail,'title="Identité et coordonnées"'):key==='site_ids'?loc(P.collectorDetail,'record.sites.map'):key==='organization_id'?loc(P.collectorDetail,'record.organization_name'):key==='nom'||key==='prenoms'?loc(P.collectorDetail,'artisanFullName(a)'):key==='whatsapp_identique'?loc(P.collectorDetail,'a.whatsapp_identique'):loc(P.collectorDetail,`a.${key}`);
 add('COLLECTEUR',key,{libelle:label,controle_id:['region','commune','site_ids','organization_id'].includes(key)?'ComboBox — id généré par le composant':key==='whatsapp_identique'?'Sans id explicite ; label englobant':`collector-${key}`,obligation_enregistrement:req,payload:relational?`p_dossier.${key}`:`p_dossier.identity.${key}`,rpc_service:'collectorPayload / snp_save_collector',stockage:key==='site_ids'?'snp_collector_sites.site_id':key==='organization_id'?'snp_collectors.organization_id':`snp_artisans_miniers.${key}`,transformation_relation:key==='site_ids'?'Dédupliqué ; références artisanal_sites ; historique valid_from/valid_until conservé.':key==='organization_id'?'Un organisme actif SONASP ou comptoir ; compte/ventes existants contraignent les changements.':'Identité forcée physique/collecteur ; payload partagé artisanDossierPayload.',restitution_detail:collectorOmissions.has(key)?'ABSENT_DU_DETAIL_PRINCIPAL':key==='whatsapp_identique'?'RESTITUTION_DERIVEE':'RESTITUE_STATIQUEMENT',ecart_detail:collectorOmissions.has(key)?'Saisi et transmis ; aucune restitution de ce champ dans CollectorDetails.':'',source_ui_candidat:ui,source_payload_candidat:loc(P.collectorLib,'export function collectorPayload'),source_stockage_candidat:loc(P.collectorSQL,key==='site_ids'?'INSERT INTO public.snp_collector_sites':key==='organization_id'?'INSERT INTO public.snp_collectors(id':'INSERT INTO public.snp_artisans_miniers(id'),source_detail_candidat:detail});
}
for (const photo of [false,true]) add('COLLECTEUR',photo?'photoFile':'identityFiles',{nature:'FICHIER',libelle:photo?'Photo du collecteur':'Pièces du collecteur',controle_id:`aria-label=${photo?'Photo du collecteur':'Pièces du collecteur'}`,payload:'file + owner=artisan + documentType/photo',rpc_service:'artisanDocumentService.upload / snp_register_artisan_document',stockage:'snp_artisan_documents + Storage artisan-dossiers'+(photo?' ; snp_artisans_miniers.photo_url':''),transformation_relation:photo?'JPEG/PNG <= 2 Mo ; une photo':'JPG/PNG/PDF <= 5 Mo par fichier ; type dérivé du type de pièce, titre imposé',restitution_detail:'ABSENT_DU_DETAIL_PRINCIPAL',ecart_detail:'Pièces relisibles dans CollectorForm ; aucun chargement/galerie de pièces ou photo réelle dans CollectorDetails.',source_ui_candidat:loc(P.collector,'aria-label={photo ? "Photo du collecteur"'),source_payload_candidat:loc(P.docService,'await uploadSensitiveFile('),source_stockage_candidat:loc(P.artisanSQL,'INSERT INTO public.snp_artisan_documents(id'),source_detail_candidat:loc(P.collectorDetail,'title="Identité et coordonnées"')});

// Comptoir : toutes les clés déclarées, en distinguant les 32 saisies du pays BF imposé.
let comptoirLabels;
const visitLabels=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText()==='COMPTOIR_FIELD_LABELS'&&n.initializer&&ts.isObjectLiteralExpression(n.initializer))comptoirLabels=Object.fromEntries(n.initializer.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(),p.initializer.text]));ts.forEachChild(n,visitLabels);};visitLabels(tree(P.comptoirLib));
const mirrors={name:'name',short_name:'short_name',legal_form:'legal_form',phone:'phone',email:'email',website:'website',region:'administrative_region',notes:'notes',city:'address (concaténée)',district:'address (concaténée)',street:'address (concaténée)'};
for (const [key,label] of Object.entries(comptoirLabels)) {
 const ui=callLoc(P.comptoir,'text',key)||callLoc(P.comptoir,'select',key)||(key==='tax_office_code'?loc(P.comptoir,'value={values.tax_office_code}'):key==='notes'?loc(P.comptoir,'id="comptoir-notes"'):loc(P.comptoir,'<span>Pays du siège</span>'));
 add('COMPTOIR',key,{nature:key==='country'?'VALEUR_IMPOSEE':'SAISIE_METIER',libelle:label,controle_id:key==='country'?'Aucun contrôle ; Burkina Faso affiché':key==='tax_office_code'?'ComboBox — id généré par le composant':`comptoir-${key}`,obligation_enregistrement:['name','legal_form','city'].includes(key)?'Requis pour sauvegarder':key==='country'?'BF imposé et contrôlé serveur':'Facultatif pour sauvegarder ; peut compter dans la complétude',payload:`p_values.${key}`,rpc_service:'comptoirService.save / snp_save_comptoir_dossier',stockage:`snp_comptoir_dossiers.data->>'${key}'`+(mirrors[key]?` ; miroir snp_organizations.${mirrors[key]}`:''),transformation_relation:key==='tax_office_code'?'Référence code vers snp_comptoir_tax_offices ; liste locale affichée.':key==='country'?'BF fixe dans le formulaire et dans la relecture RPC.':'JSON métier de chaînes ; trim côté RPC ; même composant en lecture seule.',source_ui_candidat:ui,source_payload_candidat:loc(P.comptoirService,'p_values: values'),source_stockage_candidat:loc(P.comptoirSQL,'INSERT INTO public.snp_comptoir_dossiers(organization_id,data'),source_detail_candidat:key==='tax_office_code'?loc(P.comptoir,'COMPTOIR_TAX_OFFICES.find',read(P.comptoir).indexOf('{select("tax_regime"')):key==='notes'?loc(P.comptoir,'<p>{values.notes'):key==='country'?ui:loc(P.comptoir,'readOnly ? (')});
}
for (const [kind,label] of [['logo','Logo de la société'],['rccm','Extrait RCCM'],['ifu','Attestation IFU'],['purchase_authorization','Autorisation d’achat d’or'],['representative_identity','Pièce d’identité du responsable'],['representative_photo','Photo d’identité du responsable'],['other','Autre justificatif']]) add('COMPTOIR',`documents.${kind}`,{nature:'FICHIER',libelle:label,controle_id:`Bloc comptoir-document-${kind} ; input aria-label=Joindre — ${label}`,obligation_enregistrement:'Facultatif pour enregistrer ; certaines pièces contribuent à la complétude',payload:`file + metadata.documentKind=${kind}`,rpc_service:'comptoirService.upload / passerelle comptoir-document / snp_register_comptoir_document_gateway',stockage:'snp_comptoir_documents + Storage comptoir-dossiers',transformation_relation:'Relation organization_id ; document typé ; empreinte SHA256, MIME et taille contrôlés ; retrait = archivage.',source_ui_candidat:callLoc(P.comptoir,'slot',kind),source_payload_candidat:loc(P.comptoirService,'documentKind: document.kind'),source_stockage_candidat:loc(P.comptoirSQL,'CREATE TABLE public.snp_comptoir_documents'),source_detail_candidat:loc(P.comptoir,'{saved.map((d) =>')});

for (const row of rows.filter(r => r.formulaire === 'ARTISAN' && r.champ.startsWith('moyens.'))) {
  row.source_stockage_candidat = loc(P.moyenSQL, 'INSERT INTO public.snp_artisan_moyens_paiement(');
}
const reviewRow = rows.find(r => r.formulaire === 'ARTISAN' && r.champ === 'reviewReason');
reviewRow.stockage = 'snp_artisan_moyens_paiement.observations (rejet) + événement de workflow reviewed';
reviewRow.source_stockage_candidat = loc(P.moyenSQL, 'observations=CASE WHEN p_approuve');

// Métadonnées et dérivés : séparés des champs saisis pour ne pas gonfler leur dénominateur.
const metas = [
 ['SITE','id','p_site.id','artisanal_sites.id','UUID nouveau ou identifiant de route existant',P.siteService,'const siteId ='],
 ['SITE','code','p_site.code','artisanal_sites.code','Code généré ; en-tête en lecture seule',P.site,'code:'],
 ['SITE','exploitationType','p_site.exploitation_type','artisanal_sites.exploitation_type','artisanale imposé ; aucun choix mixte/semi-mécanisé',P.siteService,"exploitation_type: 'artisanale'"],
 ['SITE','aea.documentPath','p_site.aea_document_path','artisanal_sites.aea_document_path','Chemin retourné par upload ; non saisi',P.siteService,'aea_document_path:'],
 ['SITE','aea.documentName','p_site.aea_document_name','artisanal_sites.aea_document_name','Nom de fichier retourné par upload ; non saisi',P.siteService,'aea_document_name:'],
 ['SITE','aea.expiresOn','Aucun champ persistant supplémentaire','Calcul aeaExpiryDate','Dérivé de date émission + durée mois',P.siteDetail,'aeaExpiryDate(site.aea.issuedOn'],
 ['SITE','assignments.user_id','p_assignments[].user_id','artisanal_site_assignments.user_id','Pas de sélecteur utilisateur dans le formulaire ; référence existante préservée',P.siteService,'user_id: userId'],
 ['ARTISAN','id','p_id / p_creation_id','snp_artisans_miniers.id','Identité de dossier/idempotence ; non saisi',P.artisanService,'p_creation_id:'],
 ['ARTISAN','expectedUpdatedAt','p_expected_updated_at','snp_artisans_miniers.updated_at','Verrou optimiste ; non saisi',P.artisanService,'p_expected_updated_at:'],
 ['ARTISAN','confirmTransition','p_confirm_transition','Événement/transition de rôle ; historique conservé','Confirmation explicite lors changement de rôle/exploitant',P.artisanService,'p_confirm_transition:'],
 ['ARTISAN','responsable.id','responsable renvoyé après RPC','snp_artisan_responsables.id / artisan_id','Généré serveur, réutilisé pour pièces du responsable',P.artisanService,'responsable:'],
 ['ARTISAN','photo_url','Hors artisanDossierPayload','snp_artisans_miniers.photo_url','Héritage relu ; actualisé par le dépôt photo',P.artisanLib,"photo_url: ''"],
 ['ARTISAN','piece_identite_url','Hors artisanDossierPayload','snp_artisans_miniers.piece_identite_url','Ancienne référence portée dans le modèle ; aucune saisie URL',P.artisanLib,"piece_identite_url: ''"],
 ['ARTISAN','document.metadata','uploadId,artisanId,ownerKind,responsableId,fileName,mimeType','snp_artisan_documents.id / artisan_id / owner_kind / responsable_id / nom_fichier / type_mime / taille_fichier / chemin_fichier / storage_bucket / sha256','Métadonnées dérivées du dossier/fichier ; pas des contrôles additionnels',P.docService,'uploadId:'],
 ['ARTISAN','moyen.metadata','p_moyen_id,p_artisan_id,p_actif','snp_artisan_moyens_paiement.id / artisan_id / actif ; verifie_le/par calculés lors revue','ID, activation/archivage et audit distincts des coordonnées',P.moyenService,'p_moyen_id:'],
 ['COLLECTEUR','id','p_id','snp_artisans_miniers.id = snp_collectors.id','Même UUID pour identité et dossier collecteur',P.collectorService,'p_id: id'],
 ['COLLECTEUR','version','p_expected_version','snp_collectors.version','Verrou optimiste ; version serveur',P.collectorService,'p_expected_version: version'],
 ['COLLECTEUR','legacyUpdatedAt','p_dossier.legacy_updated_at','snp_artisans_miniers.updated_at','Seulement dossier historique version 0 ; aucune conversion implicite',P.collectorService,'legacy_updated_at:'],
 ['COLLECTEUR','type_personne','p_dossier.identity.type_personne','snp_artisans_miniers.type_personne','physique imposé',P.collectorLib,'type_personne: "physique"'],
 ['COLLECTEUR','type_artisan','p_dossier.identity.type_artisan','snp_artisans_miniers.type_artisan','collecteur imposé',P.collectorLib,'type_artisan: "collecteur"'],
 ['COLLECTEUR','documents.metadata','uploadId,ownerKind,documentType,title','snp_artisan_documents ; owner_kind=artisan','Type dérivé de pièce/photo, titre imposé par formulaire',P.collector,'type: photo ? "photo"'],
 ['COMPTOIR','id','p_id','snp_organizations.id = snp_comptoir_dossiers.organization_id','UUID du dossier ; code de comptoir généré serveur',P.comptoirService,'p_id: id'],
 ['COMPTOIR','version','p_expected_version','snp_comptoir_dossiers.version','Verrou optimiste ; non saisi',P.comptoirService,'p_expected_version:'],
 ['COMPTOIR','organizationUpdatedAt','p_expected_organization_updated_at','snp_organizations.updated_at','Protection des écritures concurrentes organisation',P.comptoirService,'p_expected_organization_updated_at:'],
 ['COMPTOIR','requestId','p_request_id','snp_comptoir_dossiers.last_request_id','Clé de reprise idempotente ; non saisie',P.comptoirService,'p_request_id:'],
 ['COMPTOIR','document.metadata','uploadId,organizationId,documentKind,fileName,mimeType','snp_comptoir_documents.id / organization_id / kind / file_name / path / mime_type / size_bytes / sha256','Métadonnées dérivées du fichier et du dossier',P.comptoirService,'uploadId: document.id'],
];
for (const [form,key,payload,stockage,relation,file,token] of metas) add(form,key,{nature:'METADONNEE_OU_DERIVE',libelle:key,controle_id:'Aucun champ de saisie indépendant',obligation_enregistrement:'Géré par le logiciel ou dérivé',payload,stockage,transformation_relation:relation,restitution_detail:'NON_APPLICABLE_COMME_SAISIE',source_ui_candidat:loc(file,token),source_payload_candidat:loc(file,token)});

// Contrôles de couverture sur des ensembles définis, sans prétendre couvrir les autres modules.
const artisanModel = objectKeys(P.artisanLib,'EMPTY_ARTISAN_FORM');
const responsibleModel=objectKeys(P.artisanLib,'EMPTY_RESPONSABLE');
const artisanMapped=new Set(rows.filter(r=>r.formulaire==='ARTISAN').map(r=>r.champ));
const missingArtisanModel=artisanModel.filter(k=>k!=='responsable'&&!artisanMapped.has(k));
const missingResponsible=responsibleModel.filter(k=>!artisanMapped.has(`responsable.${k}`));
const missingComptoir=Object.keys(comptoirLabels).filter(k=>!rows.some(r=>r.formulaire==='COMPTOIR'&&r.champ===k));
if(missingArtisanModel.length||missingResponsible.length||missingComptoir.length)throw new Error(JSON.stringify({missingArtisanModel,missingResponsible,missingComptoir}));
const duplicates=rows.map(r=>r.id).filter((id,i,list)=>list.indexOf(id)!==i);if(duplicates.length)throw new Error('IDs dupliqués: '+duplicates.join(','));
const versions = [...files].map(([p,text])=>{
  const old=execFileSync('git',['show',`${baseline}:${p}`],{cwd:root,encoding:'utf8'});
  return {path:p,candidateSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),baselineGitBlob:execFileSync('git',['rev-parse',`${baseline}:${p}`],{cwd:root,encoding:'utf8'}).trim(),sameTextIgnoringLineEndings:text.replaceAll('\r\n','\n')===old.replaceAll('\r\n','\n')};
});
for (const row of rows) {
 const file=row.source_ui_candidat.replace(/:\d+$/,'');
 const version=versions.find(v=>v.path===file);
 row.source_baseline=version?.sameTextIgnoringLineEndings?`${baseline.slice(0,8)}:${row.source_ui_candidat} (texte identique)`:`${baseline.slice(0,8)}:${file} (écart candidat, voir manifeste)`;
 row.source_version_candidat=version?.candidateSha256||'';
 row.candidate_commit=candidateCommit;
 row.statut='A_CONTROLER — correspondance statique relue ; UI_API_BASE_NON_EXECUTE';
}
const csv=(items)=>{const keys=Object.keys(items[0]);return [keys,...items.map(r=>keys.map(k=>r[k]??''))].map(a=>a.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';};
fs.writeFileSync(path.join(out,'MAPPING_CHAMPS.csv'),'\uFEFF'+csv(rows));
const counts=Object.fromEntries(['SITE','ARTISAN','COLLECTEUR','COMPTOIR'].map(form=>[form,Object.fromEntries([...new Set(rows.filter(r=>r.formulaire===form).map(r=>r.nature))].map(n=>[n,rows.filter(r=>r.formulaire===form&&r.nature===n).length]))]));
const summary={generatedAt:new Date().toISOString(),baseline,candidateCommit,rows:rows.length,counts,controlledSets:{artisanDeclaredKeys:artisanModel.length,artisanResponsibleKeys:responsibleModel.length,comptoirDeclaredKeys:Object.keys(comptoirLabels).length,missingArtisanModel,missingResponsible,missingComptoir},omissions:rows.filter(r=>r.restitution_detail==='ABSENT_DU_DETAIL_PRINCIPAL').map(r=>r.id),limitations:['Couverture bornée à ces quatre formulaires et sous-formulaires inspectés ; pas à tous les modules artisanat.','Une ligne par champ logique/variante ; les boucles de fichiers/moyens ne sont pas comptées pour chaque enregistrement.','Les métadonnées agrégées ne sont pas un inventaire exhaustif du schéma.','Les sources SQL sont les migrations du dépôt ; leur présence/application en environnement n’est pas validée.','Aucune saisie navigateur, persistance, RLS, suppression ou validation intégrée exécutée.'],sources:versions};
fs.writeFileSync(path.join(out,'MAPPING_CHAMPS.manifest.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({rows:summary.rows,counts,controlledSets:summary.controlledSets,omissions:summary.omissions.length},null,2));
