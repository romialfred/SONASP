import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Rasterizes our generated PDF before it is drawn into the card preview. */
export async function renderCardPdf(
  dataUrl: string,
  width: number,
): Promise<HTMLCanvasElement> {
  if (!/^data:application\/pdf;[^,]*base64,/u.test(dataUrl)) {
    throw new Error('Le document de carte ne peut pas être prévisualisé.');
  }
  const bytes = Uint8Array.from(
    atob(dataUrl.slice(dataUrl.indexOf(',') + 1)),
    (char) => char.charCodeAt(0),
  );
  const task = getDocument({ data: bytes });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / original.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return canvas;
  } finally {
    await task.destroy();
  }
}
