import { describe, expect, it, vi } from 'vitest';

const parserProbe = vi.hoisted(() => ({
  loads: 0,
  extractTextFromPDF: vi.fn().mockResolvedValue({
    text: 'Certificate No: BF-2026-001',
    pageCount: 1,
    confidence: 1,
  }),
}));

vi.mock('./pdfParsingService', () => {
  parserProbe.loads += 1;
  return {
    extractTextFromPDF: parserProbe.extractTextFromPDF,
    extractAssayData: vi.fn(),
  };
});

describe('assayCertificateService - chargement différé', () => {
  it('ne charge pdf.js qu’au lancement explicite de l’analyse PDF', async () => {
    const { parsePDFText } = await import('./assayCertificateService');

    expect(parserProbe.loads).toBe(0);

    const text = await parsePDFText({} as File);

    expect(text).toBe('Certificate No: BF-2026-001');
    expect(parserProbe.loads).toBe(1);
    expect(parserProbe.extractTextFromPDF).toHaveBeenCalledOnce();
  });
});
