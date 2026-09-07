// Audit indépendant du contrat SQL. Base PGlite jetable en mémoire uniquement.
// Aucune connexion Supabase, API, session Auth/MFA réelle ou mutation de production.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFile(new URL('../../../' + path, import.meta.url), 'utf8');
const payload = label => ({
  name: `Audit ${label}`, email: `audit-${label}@example.invalid`, phone: '+226 00000000',
  country: 'Burkina Faso', address: 'Adresse synthétique', contact_person: 'Contact synthétique',
  tax_id: '', payment_terms: 'Net 30 days', credit_limit: 0, status: 'pending',
});
const bank = (label, extra = {}) => ({
  bank_name: `Audit banque ${label}`, country: 'Burkina Faso', city: 'Ouagadougou', currency: 'XOF',
  account_number: `QA-${label}`, iban: null, swift_code: null, is_primary: false, is_active: true, ...extra,
});

test('Audit indépendant : limites et invariants du dossier client, PGlite sans Auth réelle', async t => {
  const db = new PGlite();
  const q = (sql, params = []) => db.query(sql, params);
  const one = async (sql, params = []) => (await q(sql, params)).rows[0];
  const actor = async (capability = 'sonasp.prepare') => {
    await db.exec('RESET ROLE');
    await q("SELECT set_config('test.uid',$1,false),set_config('test.capability',$2,false),set_config('test.aal','aal2',false),set_config('test.session','active',false)", ['ac000000-0000-4000-8000-000000000001', capability]);
    await db.exec('SET ROLE authenticated');
  };
  const admin = async fn => { await db.exec('RESET ROLE'); try { return await fn(); } finally { await actor(); } };
  const save = async (id, customer, banks = []) => (await one('SELECT public.save_customer_dossier($1,$2,$3) AS id', [id, JSON.stringify(customer), JSON.stringify(banks)])).id;
  const banksOf = async id => (await q('SELECT * FROM public.customer_banks WHERE customer_id=$1 ORDER BY bank_name', [id])).rows;
  const deny = (promise, code = '22023') => assert.rejects(promise, error => error.code === code);
  try {
    await db.exec(await read('supabase/tests/fixtures/customer-dossier-baseline.sql'));
    const permissions = await read('supabase/migrations/20260823180000_capacites_et_separation_fonctions.sql');
    const helper = permissions.match(/CREATE OR REPLACE FUNCTION public\.snp_est_agent_sonasp\(\)[\s\S]*?\$fn\$;/)?.[0];
    assert.ok(helper);
    await db.exec(helper);
    await db.exec(await read('supabase/migrations/20260905000000_durcir_rls_clients.sql'));
    await db.exec(await read('supabase/migrations/20260907044811_enregistrer_dossier_client_atomique.sql'));
    await actor();

    await t.test('inversion du compte principal dans les deux ordres du payload', async () => {
      for (const order of ['ancien-premier', 'nouveau-premier']) {
        const id = await save(null, payload(order), [bank('A', { is_primary: true }), bank('B')]);
        const [a, b] = await banksOf(id);
        const next = [bank('A', { id: a.id }), bank('B', { id: b.id, is_primary: true })];
        await save(id, payload(order), order === 'ancien-premier' ? next : [...next].reverse());
        const saved = await banksOf(id);
        assert.deepEqual(saved.map(item => [item.id, item.is_primary]), [[a.id, false], [b.id, true]]);
      }
    });

    await t.test('banque omise déjà inactive inchangée et réactivation explicite conservant son ID', async () => {
      const id = await save(null, payload('reactivation'), [bank('A', { is_primary: true }), bank('B')]);
      const [a, b] = await banksOf(id);
      await save(id, payload('reactivation'), [bank('A', { id: a.id, is_primary: true })]);
      const inactive = (await banksOf(id)).find(item => item.id === b.id);
      await save(id, payload('reactivation'), [bank('A', { id: a.id, is_primary: true })]);
      assert.deepEqual((await banksOf(id)).find(item => item.id === b.id), inactive);
      await save(id, payload('reactivation'), [bank('A', { id: a.id }), bank('B', { id: b.id, is_primary: true })]);
      const restored = (await banksOf(id)).find(item => item.id === b.id);
      assert.equal(restored.is_active, true);
      assert.deepEqual(restored.created_at, b.created_at);
    });

    await t.test('trigger ignorant INSERT enfant : parent entièrement annulé', async () => {
      await admin(() => db.exec('CREATE FUNCTION public.qa_audit_skip_bank_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$; CREATE TRIGGER qa_audit_skip_bank_insert BEFORE INSERT ON public.customer_banks FOR EACH ROW EXECUTE FUNCTION public.qa_audit_skip_bank_insert()'));
      try {
        await deny(save(null, payload('skip-insert'), [bank('A')]), '42501');
        assert.equal((await one('SELECT count(*)::int AS n FROM public.customers WHERE email=$1', [payload('skip-insert').email])).n, 0);
      } finally { await admin(() => db.exec('DROP TRIGGER qa_audit_skip_bank_insert ON public.customer_banks; DROP FUNCTION public.qa_audit_skip_bank_insert()')); }
    });

    await t.test('trigger ignorant UPDATE enfant : parent et banque restaurés', async () => {
      const id = await save(null, payload('skip-child-update'), [bank('A')]);
      const before = await banksOf(id);
      await admin(() => db.exec('CREATE FUNCTION public.qa_audit_skip_bank_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$; CREATE TRIGGER qa_audit_skip_bank_update BEFORE UPDATE ON public.customer_banks FOR EACH ROW EXECUTE FUNCTION public.qa_audit_skip_bank_update()'));
      try {
        await deny(save(id, { ...payload('skip-child-update'), name: 'Ne doit pas persister' }, [bank('A', { id: before[0].id, city: 'Bobo-Dioulasso' })]), '42501');
        assert.equal((await one('SELECT name FROM public.customers WHERE id=$1', [id])).name, payload('skip-child-update').name);
        assert.deepEqual(await banksOf(id), before);
      } finally { await admin(() => db.exec('DROP TRIGGER qa_audit_skip_bank_update ON public.customer_banks; DROP FUNCTION public.qa_audit_skip_bank_update()')); }
    });

    await t.test('types parent et options bancaires invalides refusés avant écriture', async () => {
      for (const bad of [null, [], 'texte', true, 4]) await deny(save(null, bad));
      for (const field of ['name', 'email', 'phone', 'country', 'address', 'contact_person']) {
        for (const value of [null, 3, [], {}]) await deny(save(null, { ...payload('types'), [field]: value }));
      }
      for (const field of ['is_primary', 'is_active']) {
        for (const value of [null, 0, 'false']) await deny(save(null, payload('types'), [bank('A', { [field]: value })]));
      }
      assert.equal((await one('SELECT count(*)::int AS n FROM public.customers WHERE email=$1', [payload('types').email])).n, 0);
    });

    await t.test('capacités SONASP existantes : comportement RLS préservé sans inventer un rôle', async () => {
      for (const capability of ['sonasp.prepare', 'sonasp.approve', 'sonasp.finance.execute', 'sonasp.finance.reconcile']) {
        await actor(capability);
        assert.match(await save(null, payload(capability.replaceAll('.', '-'))), /^[0-9a-f-]{36}$/);
      }
      await actor('sonasp.workflow.read');
      await deny(save(null, payload('read-only')), '42501');
      await actor();
    });

    await t.test('statuts existants acceptés et défaut supposé non imposé par le RPC', async () => {
      for (const status of ['pending', 'active', 'inactive']) {
        const id = await save(null, { ...payload(`status-${status}`), status });
        assert.equal((await one('SELECT status FROM public.customers WHERE id=$1', [id])).status, status);
      }
    });

    await t.test('table temporaire homonyme ne capture pas les mises à jour du trigger historique', async () => {
      const id = await save(null, payload('temp-shadow'), [bank('A', { is_primary: true }), bank('B')]);
      const [a, b] = await banksOf(id);
      await admin(() => db.exec('CREATE TEMP TABLE customer_banks AS SELECT * FROM public.customer_banks WITH NO DATA; GRANT SELECT,INSERT,UPDATE,DELETE ON pg_temp.customer_banks TO authenticated'));
      await save(id, payload('temp-shadow'), [bank('B', { id: b.id, is_primary: true }), bank('A', { id: a.id })]);
      const saved = await banksOf(id);
      assert.deepEqual(saved.map(item => item.is_primary), [false, true]);
      assert.equal((await one('SELECT count(*)::int AS n FROM pg_temp.customer_banks')).n, 0);
    });
  } finally { await db.close(); }
});
