// Browser-only scenarios. Never imported by the production application.
export const collectorActivityService = {
  async get(id: string) {
    if (new URLSearchParams(window.location.search).has('activity-error')) throw new Error('Erreur de recette');
    const empty = id === 'qa-incomplete';
    return { declarations: empty ? 0 : 12, approved: empty ? 0 : 8, pending: empty ? 0 : 3, rejected: empty ? 0 : 1, cancelled: 0, paid: empty ? 0 : 6, turnover: empty ? 0 : 28450000, taxes: empty ? 0 : 5405500, quantity: empty ? 0 : 569, lastDeclaration: empty ? null : '2026-09-06' };
  },
};
