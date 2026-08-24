import { describe, expect, it } from 'vitest';
import { buildExcelWorkbook } from './excelExport';

describe('excelExport', () => {
  it('génère un classeur xlsx sans parser de contenu externe', async () => {
    const blob = await buildExcelWorkbook([
      {
        name: 'Synthèse/SONASP',
        rows: [
          { Indicateur: 'Production', Valeur: 42.5 },
          { Indicateur: 'Taxes', Valeur: 1_250_000 },
        ],
      },
    ]);

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(blob.size).toBeGreaterThan(1_000);
  });
});
