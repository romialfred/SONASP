import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const folder=process.argv[2];
if(!folder) throw new Error('Audit folder required');
const scenarios=['iam_owner_administration_flow','admin_module_permissions_flow','comptoir_finance_habilitations','account_creation_compensation','interportal_iam_flow','conciliation_evidence_impacts','international_partial_payment_flow','international_sales_scope','account_deletion_dependencies','access_control_matrix','workflow_integrity_regression','stock_reserve_integrity','reserve_allocations_workflow','institutional_fiscal_reserve_boundaries','owner_module_continuity','national_reserve_catalog'];
const sqlTests=scenarios.map(name=>{
  const log=readFileSync(path.join(folder,name+'_test.sql.staging.log'),'utf8');
  if(/(^|\n)\s*not ok \d|Looks like you failed|ERROR:/.test(log)) throw new Error('Unresolved SQL test: '+name);
  return {name,assertions:(log.match(/(^|\n)\s*ok \d/g)||[]).length};
});
const read=name=>JSON.parse(readFileSync(path.join(folder,name),'utf8'));
const source=read('frontend-source.json');
const receipt={at:new Date().toISOString(),site:'https://sonasp.data-univers.com',
 deploymentId:'dpl_BHgY3cssVueQ86YtsSHrUddCSE2U',buildId:'f37a3f7f2c3a-mtge6ddc',sourceHash:source.sourceHash,
 backup:'C:/Users/romia/.codex/backups/sonasp/release-20260830T2213',
 sql:read('apply-receipt.json'),services:read('services-after.json').map(({slug,version,status})=>({slug,version,status})),
 validations:{vitest:{files:254,tests:1980},migrationTests:10,sqlTests,sqlAssertions:sqlTests.reduce((sum,t)=>sum+t.assertions,0),services:read('services-smoke.json'),frontend:read('frontend-smoke.json')},
 limitations:['No real user invitation or SMTP delivery test.','No payment or business write used as an online smoke test.','Scheduled functions published; no cron enabled and CRON_SECRET remains unconfigured.']};
writeFileSync('docs/audits/full-deployment-2026-08-30.receipt.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify({deploymentId:receipt.deploymentId,buildId:receipt.buildId,sqlScenarios:sqlTests.length,sqlAssertions:receipt.validations.sqlAssertions,services:receipt.services.length,serviceChecks:receipt.validations.services.results.length,frontendChecks:receipt.validations.frontend.results.length}));
