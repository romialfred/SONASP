import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const read = (path) =>
  fs.readFile(new URL("../" + path, import.meta.url), "utf8");
const q = (sql, args = []) => db.query(sql, args);
const one = async (sql, args = []) => (await q(sql, args)).rows[0];
let checks = 0;
const deny = async (sql, args, pattern) => {
  await assert.rejects(() => q(sql, args), pattern);
  checks++;
};
const actor = async (id, role = "authenticated") => {
  await db.exec("RESET ROLE");
  await q(
    "SELECT set_config('test.uid',$1,false),set_config('test.auth_role',$2,false),set_config('test.session','active',false),set_config('request.jwt.claim.aal','aal2',false)",
    [id, role],
  );
  await db.exec(`SET ROLE ${role}`);
};
try {
  await db.exec(
    `CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.auth_role',true),''),'authenticated') $$; CREATE SCHEMA extensions; CREATE FUNCTION extensions.digest(bytea,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256($1) $$;`,
  );
  const baseline = (
    await read("supabase/tests/fixtures/lot_4i_disposable_baseline.sql")
  )
    .replace(/CREATE EXTENSION IF NOT EXISTS \w+ WITH SCHEMA extensions;/g, "")
    .replaceAll("p_artisan uuid", "p_artisan_id uuid")
    .replaceAll("a.artisan_id=p_artisan", "a.artisan_id=p_artisan_id");
  await db.exec(baseline);
  await db.exec(
    await read(
      "supabase/migrations/20260825000005_lot_4i_paiements_artisans_atomiques.sql",
    ),
  );
  await db.exec(await read("supabase/tests/fixtures/collector-overlay.sql"));
  await db.exec(
    await read(
      "supabase/migrations/20260906145430_collecteurs_comptoirs_ventes.sql",
    ),
  );
  const registry = randomUUID(),
    agent = randomUUID(),
    buyer = randomUUID(),
    checker = randomUUID(),
    foreign = randomUUID();
  const org = randomUUID(),
    otherOrg = randomUUID(),
    sonasp = randomUUID(),
    site = randomUUID(),
    site2 = randomUUID(),
    otherSite = randomUUID(),
    collector = randomUUID(),
    member = randomUUID(),
    otherMember = randomUUID();
  for (const [id, role, caps] of [
    [registry, "owner", []],
    [agent, "collector", ["collector.operate"]],
    [
      buyer,
      "comptoir",
      [
        "comptoir.manage",
        "comptoir.invoices.issue",
        "comptoir.payments.execute",
      ],
    ],
    [checker, "comptoir", ["comptoir.manage", "comptoir.payments.reconcile"]],
    [foreign, "comptoir", ["comptoir.manage", "comptoir.payments.execute"]],
  ]) {
    await q("INSERT INTO auth.users VALUES($1)", [id]);
    await q("INSERT INTO user_profiles(id,email,role) VALUES($1,$2,$3)", [
      id,
      `fixture-${id}@example.test`,
      role,
    ]);
    for (const code of caps) {
      await q(
        "INSERT INTO snp_capability_catalog(code,domain,sensitive) VALUES($1,'test',true) ON CONFLICT DO NOTHING",
        [code],
      );
      await q(
        "INSERT INTO snp_user_capabilities(user_id,capability_code,allowed) VALUES($1,$2,true)",
        [id, code],
      );
    }
  }
  for (const [id, code, kind] of [
    [org, "COMPTOIR-A", "comptoir"],
    [otherOrg, "COMPTOIR-B", "comptoir"],
    [sonasp, "SONASP", "sonasp"],
  ])
    await q(
      "INSERT INTO snp_organizations(id,code,name,organization_type) VALUES($1,$2,$2,$3)",
      [id, code, kind],
    );
  for (const [id, orgId] of [
    [buyer, org],
    [checker, org],
    [foreign, otherOrg],
  ])
    await q(
      "INSERT INTO snp_user_organization_memberships(user_id,organization_id) VALUES($1,$2)",
      [id, orgId],
    );
  for (const [id, name] of [
    [site, "Site Alpha"],
    [site2, "Site Beta"],
    [otherSite, "Site étranger"],
  ])
    await q(
      "INSERT INTO artisanal_sites VALUES($1,$2,'Localité distincte','Centre')",
      [id, name],
    );
  const identity = {
    type_personne: "physique",
    type_artisan: "collecteur",
    nom: "Collecteur de test",
    prenoms: "Fixture",
    date_naissance: "1990-01-01",
    telephone: "+22670000000",
    pays: "Burkina Faso",
    region: "Centre",
    commune: "Ouagadougou",
    type_piece_identite: "CNI",
    numero_piece_identite: "COL-TEST-1",
    email: "collector@example.test",
  };
  const dossier = { identity, organization_id: org, site_ids: [site, site2] };
  await actor(registry);
  await deny(
    "SELECT snp_save_collector($1,NULL,$2)",
    [
      collector,
      JSON.stringify({
        ...dossier,
        identity: { ...identity, type_personne: "morale" },
      }),
    ],
    /personne physique/,
  );
  await deny(
    "SELECT snp_save_collector($1,NULL,$2)",
    [collector, JSON.stringify({ ...dossier, site_ids: [] })],
    /au moins un site/,
  );
  await deny(
    "SELECT snp_save_collector($1,NULL,$2)",
    [collector, JSON.stringify({ ...dossier, organization_id: null })],
    /comptoir actif/,
  );
  await q("SELECT snp_save_collector($1,NULL,$2)", [
    collector,
    JSON.stringify(dossier),
  ]);
  await q("SELECT snp_save_collector($1,NULL,$2)", [
    collector,
    JSON.stringify(dossier),
  ]);
  assert.equal(
    Number((await one("SELECT count(*) n FROM snp_collectors")).n),
    1,
  );
  checks++;
  assert.equal(
    Number(
      (
        await one(
          "SELECT count(*) n FROM snp_collector_sites WHERE valid_until IS NULL",
        )
      ).n,
    ),
    2,
  );
  checks++;
  await deny(
    "SELECT snp_save_collector($1,0,$2)",
    [collector, JSON.stringify(dossier)],
    /fiche a changé/,
  );
  await q("SELECT snp_save_collector($1,1,$2)", [
    collector,
    JSON.stringify({ ...dossier, site_ids: [site] }),
  ]);
  assert.equal(
    Number(
      (
        await one(
          "SELECT count(*) n FROM snp_collector_sites WHERE valid_until IS NOT NULL",
        )
      ).n,
    ),
    1,
  );
  checks++;
  await q(
    "SELECT snp_link_collector_account($1,$2,$3,'Rattachement pour test isolé')",
    [agent, collector, org],
  );
  await db.exec("RESET ROLE");
  // Conflicting primary membership must never override a collector's employer.
  await q(
    "INSERT INTO snp_user_organization_memberships(user_id,organization_id) VALUES($1,$2)",
    [agent, otherOrg],
  );
  for (const [id, siteId, num] of [
    [member, site, "ART-1"],
    [otherMember, otherSite, "ART-2"],
  ]) {
    await q(
      "INSERT INTO snp_artisans_miniers(id,type_personne,type_artisan,nom,telephone,date_naissance,pays,region,commune,type_piece_identite,numero_piece_identite,artisanal_site_id,dossier_version,email) VALUES($1,'physique','exploitant','Artisan test','+22671111111','1990-01-01','Burkina Faso','Centre','Ouagadougou','CNI',$2,$3,1,'artisan@example.test')",
      [id, num, siteId],
    );
    await q("INSERT INTO test_member_eligibility VALUES($1,true)", [id]);
  }
  const legacySale = randomUUID();
  await q(
    "INSERT INTO snp_artisan_ventes_or(id,artisan_id,date_vente,quantite_grammes,type_or,purete_karat,prix_kg_fcfa,montant_brut_fcfa,tva_taux,tva_montant_fcfa,taxe_dev_comm_taux,taxe_dev_comm_montant_fcfa,montant_total_fcfa,statut,comptoir_organization_id) VALUES($1,$2,CURRENT_DATE,10,'poudre',22,50000000,500000,18,90000,1,5000,595000,'en_attente',$3)",
    [legacySale, member, otherOrg],
  );
  // Real workflow, scope and accounting triggers, in addition to the new guards.
  await db.exec(
    "CREATE TRIGGER snp_00_artisan_gold_sale_workflow_guard BEFORE INSERT OR UPDATE OR DELETE ON snp_artisan_ventes_or FOR EACH ROW EXECUTE FUNCTION snp_guard_artisan_gold_sale_workflow()",
  );
  const taxSource = await read(
    "supabase/migrations/20260827203000_integrite_ventes_or_artisanales.sql",
  );
  await db.exec(
    taxSource.slice(
      taxSource.indexOf(
        "CREATE OR REPLACE FUNCTION public.snp_4h_calculer_vente_or_artisanale()",
      ),
      taxSource.indexOf(
        "FOR EACH ROW EXECUTE FUNCTION public.snp_4h_calculer_vente_or_artisanale();",
      ) +
        "FOR EACH ROW EXECUTE FUNCTION public.snp_4h_calculer_vente_or_artisanale();"
          .length,
    ),
  );
  await actor(agent);
  assert.equal(
    (await one("SELECT snp_current_organization_id() org")).org,
    org,
  );
  checks++;
  assert.equal(
    (await q("SELECT * FROM snp_collector_sale_artisans()")).rows.length,
    1,
  );
  checks++;
  assert.equal(
    (await q("SELECT * FROM snp_artisan_ventes_or WHERE id=$1", [legacySale]))
      .rows.length,
    0,
  );
  checks++;
  assert.equal(
    (await q("SELECT * FROM snp_collector_workspace_artisans()")).rows.length,
    1,
  );
  checks++;
  await deny(
    "SELECT snp_save_collector($1,2,$2)",
    [collector, JSON.stringify(dossier)],
    /DGMG/,
  );
  const saleId = randomUUID();
  const sale = {
    artisan_id: member,
    site_id: site,
    date: new Date().toISOString().slice(0, 10),
    quantity: 20,
    gold_type: "poudre",
    purity: 22,
    price: 50000000,
    observations: "Test isolé",
  };
  await deny(
    "SELECT snp_collector_submit_sale($1,$2)",
    [
      randomUUID(),
      JSON.stringify({ ...sale, artisan_id: otherMember, site_id: otherSite }),
    ],
    /site autorisé/,
  );
  await deny(
    "SELECT snp_collector_submit_sale($1,$2)",
    [randomUUID(), JSON.stringify({ ...sale, quantity: "NaN" })],
    /invalides/,
  );
  await deny(
    "SELECT snp_collector_submit_sale($1,$2)",
    [randomUUID(), JSON.stringify({ ...sale, quantity: 0 })],
    /invalides/,
  );
  await q("SELECT set_config('request.jwt.claim.aal','aal1',false)");
  await deny(
    "SELECT snp_collector_submit_sale($1,$2)",
    [saleId, JSON.stringify(sale)],
    /authentification forte/,
  );
  await actor(agent);
  await q("SELECT snp_collector_submit_sale($1,$2)", [
    saleId,
    JSON.stringify(sale),
  ]);
  await q("SELECT snp_collector_submit_sale($1,$2)", [
    saleId,
    JSON.stringify(sale),
  ]);
  assert.equal(
    Number((await one("SELECT count(*) n FROM snp_collector_sales")).n),
    1,
  );
  checks++;
  assert.equal(
    (
      await one(
        "SELECT statut,montant_total_fcfa FROM snp_artisan_ventes_or WHERE id=$1",
        [saleId],
      )
    ).statut,
    "en_attente",
  );
  checks++;
  assert.equal(
    Number(
      (
        await one(
          "SELECT montant_total_fcfa total FROM snp_artisan_ventes_or WHERE id=$1",
          [saleId],
        )
      ).total,
    ),
    1190000,
  );
  checks++;
  await deny(
    "SELECT snp_collector_decide_sale($1,1,'approved',NULL)",
    [saleId],
    /autre acteur/,
  );
  await deny(
    "UPDATE snp_collector_sales SET status='approved' WHERE id=$1",
    [saleId],
    /permission denied/,
  );
  await deny(
    "UPDATE snp_artisan_ventes_or SET statut='validee' WHERE id=$1",
    [saleId],
    /approbation|row-level security/,
  );
  await actor(foreign);
  assert.equal((await q("SELECT * FROM snp_collector_sales")).rows.length, 0);
  checks++;
  assert.equal(
    (await q("SELECT * FROM snp_artisan_ventes_or WHERE id=$1", [saleId])).rows
      .length,
    0,
  );
  checks++;
  await deny(
    "SELECT snp_collector_decide_sale($1,1,'approved',NULL)",
    [saleId],
    /autre acteur/,
  );
  await actor(buyer);
  await deny(
    "SELECT snp_collector_decide_sale($1,1,'rejected','non')",
    [saleId],
    /10 caractères/,
  );
  await db.exec("RESET ROLE");
  await q(
    "UPDATE test_member_eligibility SET eligible=false WHERE artisan_id=$1",
    [member],
  );
  await actor(buyer);
  await deny(
    "SELECT snp_collector_decide_sale($1,1,'approved',NULL)",
    [saleId],
    /affiliation/,
  );
  await db.exec("RESET ROLE");
  await q(
    "UPDATE test_member_eligibility SET eligible=true WHERE artisan_id=$1",
    [member],
  );
  await actor(buyer);
  await q("SELECT snp_collector_decide_sale($1,1,'approved',NULL)", [saleId]);
  await q("SELECT snp_collector_decide_sale($1,1,'approved',NULL)", [saleId]);
  assert.equal(
    (
      await one("SELECT statut FROM snp_artisan_ventes_or WHERE id=$1", [
        saleId,
      ])
    ).statut,
    "validee",
  );
  checks++;
  await db.exec("RESET ROLE");
  assert.equal(
    Number(
      (
        await one(
          "SELECT count(*) n FROM snp_notifications WHERE objet_id=$1",
          [saleId],
        )
      ).n,
    ),
    2,
  );
  checks++;
  assert.equal(
    Number(
      (
        await one(
          "SELECT count(*) n FROM snp_notifications_livraisons WHERE canal='courriel'",
        )
      ).n,
    ),
    2,
  );
  checks++;
  await actor(agent);
  assert.equal(
    (await one("SELECT snp_collector_can_pay($1) allowed", [saleId])).allowed,
    false,
  );
  checks++;
  await deny(
    "SELECT snp_collector_set_payment_authorization($1,now()+interval '1 day','Je me donne le droit')",
    [collector],
    /Seul l’organisme/,
  );
  await actor(foreign);
  await deny(
    "SELECT snp_collector_set_payment_authorization($1,now()+interval '1 day','Délégation étrangère')",
    [collector],
    /Seul l’organisme/,
  );
  await actor(buyer);
  await q(
    "SELECT snp_collector_set_payment_authorization($1,now()+interval '1 day','Mandat de paiement vérifié')",
    [collector],
  );
  await actor(agent);
  assert.equal(
    (await one("SELECT snp_collector_can_pay($1) allowed", [saleId])).allowed,
    false,
  );
  checks++;
  await db.exec("RESET ROLE");
  await q(
    "INSERT INTO snp_user_capabilities(user_id,capability_code,allowed) VALUES($1,'collector.payments.execute',true)",
    [agent],
  );
  await actor(agent);
  assert.equal(
    (await one("SELECT snp_collector_can_pay($1) allowed", [saleId])).allowed,
    true,
  );
  checks++;
  // Execute the actual existing invoice/payment RPCs with collector delegation.
  await actor(buyer);
  const invoiceResult = (
    await one(
      "SELECT snp_artisan_emettre_facture($1,'validee',1,$2,NULL) result",
      [saleId, randomUUID()],
    )
  ).result;
  const invoice = invoiceResult.invoice_id,
    method = randomUUID();
  await actor(agent);
  await deny(
    "SELECT snp_artisan_creer_paiement($1,'emise',0,$2,$3,NULL)",
    [invoice, method, randomUUID()],
    /certifiée DGI/,
  );
  await db.exec("RESET ROLE");
  await q("SELECT set_config('sonasp.artisan_finance_rpc','1',false)");
  await q(
    "UPDATE snp_artisan_factures_definitives SET certification_dgi_status='certified' WHERE id=$1",
    [invoice],
  );
  await q(
    "INSERT INTO snp_artisan_moyens_paiement(id,artisan_id,type,titulaire,verifie_le,actif) VALUES($1,$2,'cash','Artisan de test',now(),true)",
    [method, member],
  );
  await q("SELECT set_config('sonasp.artisan_finance_rpc','0',false)");
  await actor(agent);
  const paymentKey = randomUUID();
  const payment = (
    await one(
      "SELECT snp_artisan_creer_paiement($1,'emise',0,$2,$3,NULL) result",
      [invoice, method, paymentKey],
    )
  ).result;
  const replay = (
    await one(
      "SELECT snp_artisan_creer_paiement($1,'emise',0,$2,$3,NULL) result",
      [invoice, method, paymentKey],
    )
  ).result;
  assert.equal(payment.payment_id, replay.payment_id);
  checks++;
  await q(
    "SELECT snp_artisan_transition_paiement($1,'en_attente',0,'en_traitement',$2,NULL)",
    [payment.payment_id, randomUUID()],
  );
  await deny(
    "SELECT snp_artisan_transition_paiement($1,'en_traitement',1,'valide',$2,NULL)",
    [payment.payment_id, randomUUID()],
    /contrôle du paiement/,
  );
  await actor(checker);
  await q(
    "SELECT snp_artisan_transition_paiement($1,'en_traitement',1,'valide',$2,NULL)",
    [payment.payment_id, randomUUID()],
  );
  await actor(agent);
  await deny(
    "SELECT snp_artisan_transition_paiement($1,'valide',2,'complete',$2,NULL)",
    [payment.payment_id, randomUUID()],
    /preuve de paiement/,
  );
  await actor(foreign);
  await deny(
    "SELECT snp_artisan_transition_paiement($1,'valide',2,'complete',$2,NULL)",
    [payment.payment_id, randomUUID()],
    /hors du comptoir/,
  );
  await actor(buyer);
  await q(
    "SELECT snp_collector_set_payment_authorization($1,NULL,'Révocation du mandat de test')",
    [collector],
  );
  await actor(agent);
  assert.equal(
    (await one("SELECT snp_collector_can_pay($1) allowed", [saleId])).allowed,
    false,
  );
  checks++;
  await actor(registry);
  await deny(
    "SELECT snp_save_collector($1,4,$2)",
    [collector, JSON.stringify({ ...dossier, organization_id: sonasp })],
    /Clôturez/,
  );
  await db.exec("RESET ROLE");
  await deny(
    "UPDATE snp_artisans_miniers SET type_personne='morale' WHERE id=$1",
    [collector],
    /personne physique|qualité juridique/,
  );
  await deny(
    "UPDATE snp_artisans_miniers SET type_artisan='exploitant' WHERE id=$1",
    [collector],
    /collecteur/,
  );
  await actor(agent);
  await deny(
    "SELECT snp_claim_collection_mail($1)",
    [saleId],
    /permission denied/,
  );
  await actor(foreign);
  assert.equal(
    (await one("SELECT snp_collection_mail_allowed($1) allowed", [saleId]))
      .allowed,
    false,
  );
  checks++;
  await actor(buyer);
  assert.equal(
    (await one("SELECT snp_collection_mail_allowed($1) allowed", [saleId]))
      .allowed,
    true,
  );
  checks++;
  const notificationState = (await q("SELECT * FROM snp_collector_sales()"))
    .rows[0].snp_collector_sales;
  assert.ok(
    notificationState.notifications.every((n) => n.status === "en_attente"),
  );
  checks++;
  await actor(buyer, "service_role");
  const leased = (
    await q("SELECT * FROM snp_claim_collection_mail($1)", [saleId])
  ).rows.map((r) => r.snp_claim_collection_mail);
  assert.equal(leased.length, 2);
  checks++;
  assert.equal(
    (await q("SELECT * FROM snp_claim_collection_mail($1)", [saleId])).rows
      .length,
    0,
  );
  checks++;
  await deny(
    "SELECT snp_finish_collection_mail($1,$2,true)",
    [leased[0].id, randomUUID()],
    /Bail/,
  );
  await q("SELECT snp_finish_collection_mail($1,$2,false)", [
    leased[0].id,
    leased[0].lease,
  ]);
  const retry = (
    await one("SELECT snp_claim_collection_mail($1) job", [saleId])
  ).job;
  assert.notEqual(retry.lease, leased[0].lease);
  checks++;
  await q("SELECT snp_finish_collection_mail($1,$2,true)", [
    retry.id,
    retry.lease,
  ]);
  await q("SELECT snp_finish_collection_mail($1,$2,true)", [
    leased[1].id,
    leased[1].lease,
  ]);
  assert.equal(
    (await q("SELECT * FROM snp_claim_collection_mail($1)", [saleId])).rows
      .length,
    0,
  );
  checks++;
  // SONASP follows the same approval boundary, with its own organization.
  const sonaspAgent = randomUUID(),
    sonaspBuyer = randomUUID(),
    sonaspCollector = randomUUID();
  await db.exec("RESET ROLE");
  for (const [uid, role, caps] of [
    [sonaspAgent, "collector", ["collector.operate"]],
    [sonaspBuyer, "sonasp", ["sonasp.approve", "sonasp.finance.execute"]],
  ]) {
    await q("INSERT INTO auth.users VALUES($1)", [uid]);
    await q("INSERT INTO user_profiles(id,email,role) VALUES($1,$2,$3)", [
      uid,
      `fixture-${uid}@example.test`,
      role,
    ]);
    for (const code of caps) {
      await q(
        "INSERT INTO snp_capability_catalog(code,domain,sensitive) VALUES($1,'test',true) ON CONFLICT DO NOTHING",
        [code],
      );
      await q(
        "INSERT INTO snp_user_capabilities(user_id,capability_code,allowed) VALUES($1,$2,true)",
        [uid, code],
      );
    }
  }
  await q(
    "INSERT INTO snp_user_organization_memberships(user_id,organization_id) VALUES($1,$2)",
    [sonaspBuyer, sonasp],
  );
  await actor(registry);
  await q("SELECT snp_save_collector($1,NULL,$2)", [
    sonaspCollector,
    JSON.stringify({
      ...dossier,
      organization_id: sonasp,
      identity: { ...identity, numero_piece_identite: "SONASP-COL-TEST" },
    }),
  ]);
  await q(
    "SELECT snp_link_collector_account($1,$2,$3,'Rattachement SONASP de test')",
    [sonaspAgent, sonaspCollector, sonasp],
  );
  await actor(sonaspAgent);
  assert.equal(
    (await one("SELECT snp_current_organization_id() org")).org,
    sonasp,
  );
  checks++;
  const sonaspSale = randomUUID();
  await q("SELECT snp_collector_submit_sale($1,$2)", [
    sonaspSale,
    JSON.stringify(sale),
  ]);
  await actor(buyer);
  await deny(
    "SELECT snp_collector_decide_sale($1,1,'approved',NULL)",
    [sonaspSale],
    /autre acteur/,
  );
  await actor(sonaspBuyer);
  await q("SELECT snp_collector_decide_sale($1,1,'approved',NULL)", [
    sonaspSale,
  ]);
  assert.equal(
    (
      await one(
        "SELECT statut,comptoir_organization_id FROM snp_artisan_ventes_or WHERE id=$1",
        [sonaspSale],
      )
    ).statut,
    "validee",
  );
  checks++;
  await actor(sonaspAgent);
  assert.equal(
    (await one("SELECT snp_collector_can_pay($1) allowed", [sonaspSale]))
      .allowed,
    false,
  );
  checks++;
  await actor(registry, "anon");
  await deny("SELECT snp_list_collectors()", [], /permission denied/);
  await actor(agent);
  await q("SELECT set_config('request.jwt.claim.aal','aal1',false)");
  assert.equal((await q("SELECT * FROM snp_collectors")).rows.length, 0);
  checks++;
  assert.equal((await q("SELECT * FROM snp_collector_sales")).rows.length, 0);
  checks++;
  assert.equal(
    (await q("SELECT * FROM snp_artisan_ventes_or WHERE id=$1", [saleId])).rows
      .length,
    0,
  );
  checks++;
  await db.exec("RESET ROLE");
  const legacyPhysical = randomUUID(),
    legacyCorporate = randomUUID();
  // Seed the pre-existing v0 state; restore the real guard before testing upgrades.
  await db.exec(
    "ALTER TABLE public.snp_artisans_miniers DISABLE TRIGGER aaa_guard_artisan_dossier",
  );
  for (const [id, kind, doc] of [
    [legacyPhysical, "physique", "LEGACY-PHYSICAL"],
    [legacyCorporate, "morale", "LEGACY-CORPORATE"],
  ]) {
    await q(
      "INSERT INTO snp_artisans_miniers(id,type_personne,type_artisan,nom,numero_piece_identite,dossier_version,updated_at) VALUES($1,$2,'collecteur','Dossier historique',$3,0,'2026-01-01T00:00:00Z')",
      [id, kind, doc],
    );
  }
  await db.exec(
    "ALTER TABLE public.snp_artisans_miniers ENABLE TRIGGER aaa_guard_artisan_dossier",
  );
  await actor(registry);
  const historic = (await q("SELECT * FROM snp_list_collectors()")).rows
    .map((r) => r.snp_list_collectors)
    .filter((r) => r.is_legacy);
  assert.equal(historic.length, 2);
  checks++;
  const upgrade = {
    ...dossier,
    identity: { ...identity, numero_piece_identite: "LEGACY-PHYSICAL" },
    legacy_updated_at: "2026-01-01T00:00:00Z",
  };
  await deny(
    "SELECT snp_save_collector($1,0,$2)",
    [
      legacyPhysical,
      JSON.stringify({ ...upgrade, legacy_updated_at: "2025-01-01T00:00:00Z" }),
    ],
    /historique a changé/,
  );
  const upgraded = (
    await one("SELECT snp_save_collector($1,0,$2) result", [
      legacyPhysical,
      JSON.stringify(upgrade),
    ])
  ).result;
  assert.equal(upgraded.id, legacyPhysical);
  checks++;
  assert.equal(upgraded.site_ids.length, 2);
  checks++;
  assert.equal(
    (
      await one("SELECT snp_save_collector($1,0,$2) result", [
        legacyPhysical,
        JSON.stringify(upgrade),
      ])
    ).result.version,
    1,
  );
  checks++;
  await deny(
    "SELECT snp_save_collector($1,0,$2)",
    [
      legacyCorporate,
      JSON.stringify({
        ...upgrade,
        identity: { ...identity, numero_piece_identite: "LEGACY-CORPORATE" },
      }),
    ],
    /historique.*personne physique/,
  );
  console.log(`${checks} collector SQL contracts passed.`);
} catch (e) {
  console.error(e.message);
  if (e.query && e.position)
    console.error(
      e.query.slice(
        Math.max(0, Number(e.position) - 180),
        Number(e.position) + 150,
      ),
    );
  if (e.detail) console.error(e.detail);
  if (e.where) console.error(e.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
