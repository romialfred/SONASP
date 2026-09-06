import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderCardPdf } from './cardPdfPreview';
const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  render: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('pdfjs-dist', () => ({
  getDocument: mocks.getDocument,
  GlobalWorkerOptions: {},
}));
afterEach(() => vi.clearAllMocks());
const input =
  'data:application/pdf;filename=carte.pdf;base64,' + btoa('%PDF-1.7\n%%EOF');
function setup(reject = false) {
  mocks.render.mockImplementation(() => ({
    promise: reject
      ? Promise.reject(new Error('render failed'))
      : Promise.resolve(),
  }));
  mocks.getDocument.mockReturnValue({
    promise: Promise.resolve({
      getPage: async () => ({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 100 * scale,
          height: 60 * scale,
        }),
        render: mocks.render,
      }),
    }),
    destroy: mocks.destroy.mockResolvedValue(undefined),
  });
}
describe('aperçu PDF de carte', () => {
  it('décode le PDF généré et produit un canevas aux dimensions attendues', async () => {
    setup();
    const canvas = await renderCardPdf(input, 800);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(480);
    expect(mocks.getDocument.mock.calls[0][0].data).toBeInstanceOf(Uint8Array);
    expect(mocks.render.mock.calls[0][0].canvas).toBe(canvas);
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it('libère le worker après un échec de rendu', async () => {
    setup(true);
    await expect(renderCardPdf(input, 800)).rejects.toThrow('render failed');
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it('refuse une référence qui ne contient pas le PDF produit', async () => {
    await expect(
      renderCardPdf('https://example.test/carte.pdf', 800),
    ).rejects.toThrow('prévisualisé');
    expect(mocks.getDocument).not.toHaveBeenCalled();
  });
});
