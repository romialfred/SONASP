import fs from 'node:fs';

export default class RunEndErrorsReporter {
  onTestRunEnd(modules, unhandledErrors, reason) {
    const target = process.env.AUDIT_RUN_END_FILE;
    if (!target) throw new Error('AUDIT_RUN_END_FILE est requis pour conserver la fin du run');
    fs.writeFileSync(target, JSON.stringify({
      checkedAt: new Date().toISOString(), reason,
      modules: modules.map(module => ({ id: module.id, state: module.state() })),
      unhandledErrors: unhandledErrors.map(error => ({ name: error.name, message: error.message, stack: error.stack, type: error.type })),
    }, null, 2) + '\n');
  }
}
