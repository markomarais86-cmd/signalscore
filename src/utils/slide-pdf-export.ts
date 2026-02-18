import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Renders a list of slide elements to a multi-page landscape PDF.
 * Each slide is captured at 1920x1080 and added as a full-bleed page.
 */
export async function exportSlidesToPdf(
  slideElements: HTMLElement[],
  filename: string = 'pitch-deck.pdf'
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080] });

  for (let i = 0; i < slideElements.length; i++) {
    const el = slideElements[i];

    const canvas = await html2canvas(el, {
      width: 1920,
      height: 1080,
      scale: 1,
      useCORS: true,
      backgroundColor: null,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    if (i > 0) pdf.addPage([1920, 1080], 'landscape');
    pdf.addImage(imgData, 'JPEG', 0, 0, 1920, 1080);
  }

  pdf.save(filename);
}
