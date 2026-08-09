import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export interface BullionSummaryData {
  reportDate: string;
  shipmentNumber: string;
  bars: Array<{
    barNo: string;
    datePoured: string;
    dateShipped: string;
    doreWeight: number;
    smkGoldAssay: number;
    smkSilverAssay: number;
    auContent: number;
    agContent: number;
    auContentTroyOz: number;
    agContentTroyOz: number;
    valueUSD: number;
  }>;
  signatures: Array<{
    position: string;
    name: string;
  }>;
}

export interface ExportInvoiceData {
  shipmentDate: string;
  invoiceNumber: string;

  // Sender (From)
  senderName: string;
  senderAddress: string;
  senderCity: string;
  senderCountry: string;
  senderNIF: string;

  // Recipient (Shipped to)
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  recipientCountry: string;
  recipientPhone: string;

  // Mine info
  countryOfOrigin: string;
  mineName: string;

  // Shipment details
  awbNumber: string;
  lotNumber: string;
  numberOfBoxes: number;
  boxType: string;
  description: string;

  // Metal details
  metal: string;
  netWeightKg: number;
  weightTroyOz: number;
  metalPriceCFAPerKg: number;
  estimatedValueCFA: number;

  // Box references
  boxReferences: string;

  // Exchange rate
  exchangeRateFCFAUSD: number;

  // Totals
  totalPriceCFA: number;
  totalPriceUSD: number;
}

export const freightInvoiceGenerationService = {
  /**
   * Génère le Bullion Summary PDF
   */
  generateBullionSummary(data: BullionSummaryData): jsPDF {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Logo (placeholder - vous pouvez ajouter votre vrai logo ici)
    doc.setFontSize(10);
    doc.setTextColor(100, 180, 50);
    doc.text('LA SOCIÉTÉ DES', 20, 15);
    doc.text('MINES DE KOMANA', 20, 20);
    doc.setFontSize(8);
    doc.text('HUMMINGBIRD RESOURCES', 20, 25);

    // Titre
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('BULLION SUMMARY', pageWidth / 2, 20, { align: 'center' });

    // En-têtes
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORT DATE:', 20, 35);
    doc.setFont('helvetica', 'normal');
    doc.text(data.reportDate, 60, 35);

    doc.setFont('helvetica', 'bold');
    doc.text('SHIPMENT No:', pageWidth - 80, 35);
    doc.setFont('helvetica', 'normal');
    doc.text(data.shipmentNumber, pageWidth - 40, 35);

    // Tableau des barres
    const tableData = data.bars.map(bar => [
      bar.barNo,
      bar.datePoured,
      bar.dateShipped,
      bar.doreWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      bar.smkGoldAssay.toFixed(2),
      bar.smkSilverAssay.toFixed(2),
      bar.auContent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      bar.agContent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      bar.auContentTroyOz.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      bar.agContentTroyOz.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      bar.valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ]);

    // Calcul des totaux
    const totals = data.bars.reduce((acc, bar) => ({
      doreWeight: acc.doreWeight + bar.doreWeight,
      auContent: acc.auContent + bar.auContent,
      agContent: acc.agContent + bar.agContent,
      auContentTroyOz: acc.auContentTroyOz + bar.auContentTroyOz,
      agContentTroyOz: acc.agContentTroyOz + bar.agContentTroyOz,
      valueUSD: acc.valueUSD + bar.valueUSD
    }), { doreWeight: 0, auContent: 0, agContent: 0, auContentTroyOz: 0, agContentTroyOz: 0, valueUSD: 0 });

    const avgGoldAssay = data.bars.reduce((sum, bar) => sum + bar.smkGoldAssay, 0) / data.bars.length;
    const avgSilverAssay = data.bars.reduce((sum, bar) => sum + bar.smkSilverAssay, 0) / data.bars.length;

    autoTable(doc, {
      startY: 45,
      head: [[
        'Bar No.',
        'Date Poured',
        'Date Shipped',
        'Dore Weight\n(g)',
        'SMK Gold\nAssay (%)',
        'SMK Silver\nAssay (%)',
        'Au Content (g)',
        'Ag Content (g)',
        'Au Content\n(troy oz)',
        'Ag Content\n(troy oz)',
        'Value USD'
      ]],
      body: tableData,
      foot: [[
        '', '', '',
        totals.doreWeight.toLocaleString('en-US', { minimumFractionDigits: 2 }),
        avgGoldAssay.toFixed(2),
        avgSilverAssay.toFixed(2),
        totals.auContent.toLocaleString('en-US', { minimumFractionDigits: 2 }),
        totals.agContent.toLocaleString('en-US', { minimumFractionDigits: 2 }),
        totals.auContentTroyOz.toLocaleString('en-US', { minimumFractionDigits: 2 }),
        totals.agContentTroyOz.toLocaleString('en-US', { minimumFractionDigits: 2 }),
        totals.valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      bodyStyles: {
        fontSize: 8,
        halign: 'right'
      },
      footStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'right'
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 25 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 20 }
      }
    });

    // Section signatures
    const sigStartY = doc.lastAutoTable.finalY + 20;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('POSITION', 20, sigStartY);
    doc.text('NAME', 100, sigStartY);
    doc.text('SIGNATURE', 200, sigStartY);

    data.signatures.forEach((sig, index) => {
      const yPos = sigStartY + 10 + (index * 15);
      doc.setFont('helvetica', 'normal');
      doc.text(sig.position, 20, yPos);
      doc.text(sig.name, 100, yPos);
      doc.line(200, yPos + 2, 260, yPos + 2);
    });

    return doc;
  },

  /**
   * Génère la facture d'exportation PDF (Invoice pour besoins de la douane)
   */
  generateExportInvoice(data: ExportInvoiceData): jsPDF {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Border
    doc.setLineWidth(0.5);
    doc.rect(10, 10, pageWidth - 20, 277);

    // Titre
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', pageWidth / 2, 25, { align: 'center' });
    doc.setFontSize(12);
    doc.text('POUR BESOINS DE LA DOUANE', pageWidth / 2, 32, { align: 'center' });

    // En-tête avec date, numéro et logo
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SHIPMENT DATE:', 15, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(data.shipmentDate, 55, 45);

    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE No:', pageWidth - 80, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(data.invoiceNumber, pageWidth - 45, 45, { align: 'right' });

    // Logo central (placeholder)
    doc.setFontSize(9);
    doc.setTextColor(100, 180, 50);
    doc.text('LA SOCIÉTÉ DES', pageWidth / 2, 50, { align: 'center' });
    doc.text('MINES DE KOMANA', pageWidth / 2, 55, { align: 'center' });
    doc.setFontSize(7);
    doc.text('HUMMINGBIRD RESOURCES', pageWidth / 2, 59, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // From (Sender)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('From:', 15, 70);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(data.senderName, 15, 75);
    doc.text(data.senderAddress, 15, 80);
    doc.text(data.senderCity, 15, 85);
    doc.text(data.senderCountry, 15, 90);
    doc.setFont('helvetica', 'bold');
    doc.text('NIF', 15, 95);
    doc.setFont('helvetica', 'normal');
    doc.text(data.senderNIF, 30, 95);

    // Shipped to (Recipient)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Shipped to:', pageWidth - 80, 70);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(data.recipientName, pageWidth - 80, 75);
    doc.text(data.recipientAddress, pageWidth - 80, 80);
    doc.text(data.recipientCity, pageWidth - 80, 85);
    doc.text(data.recipientCountry, pageWidth - 80, 90);
    doc.text(`Tel: ${data.recipientPhone}`, pageWidth - 80, 95);

    // Country and Mine info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text("Pays d'Origine:", 15, 105);
    doc.setFont('helvetica', 'normal');
    doc.text(data.countryOfOrigin, 50, 105);

    doc.setFont('helvetica', 'bold');
    doc.text('Mine:', 15, 110);
    doc.setFont('helvetica', 'normal');
    doc.text(data.mineName, 30, 110);

    // Tableau principal
    const tableStartY = 120;

    autoTable(doc, {
      startY: tableStartY,
      head: [[
        'AWB #',
        'Lot #',
        '# de Boîtes',
        'Type de\nBoîtes',
        'Description',
        'Metal',
        'Net Weight\n(kg)',
        'Weight\n(Troy Oz)',
        'Metal Price\n(CFA/kg)',
        'Estimated Value\n(CFA)'
      ]],
      body: [[
        data.awbNumber,
        data.lotNumber,
        data.numberOfBoxes.toString(),
        data.boxType,
        data.description,
        data.metal,
        data.netWeightKg.toFixed(3),
        data.weightTroyOz.toFixed(2),
        data.metalPriceCFAPerKg.toLocaleString('fr-FR'),
        data.estimatedValueCFA.toLocaleString('fr-FR')
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 18 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 20 },
        4: { cellWidth: 35 },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 18, halign: 'right' },
        8: { cellWidth: 22, halign: 'right' },
        9: { cellWidth: 25, halign: 'right' }
      }
    });

    let currentY = doc.lastAutoTable.finalY + 5;

    // Total Net Weight avec description
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Net Weight (kg):', 15, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.netWeightKg.toFixed(3), 80, currentY, { align: 'right' });

    // Box references
    currentY += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(`Box No: ${data.boxReferences}`, 15, currentY);

    // Conversion rates
    currentY += 10;
    doc.text('Conversion: 1 troy oz = 31.1034768 g', 15, currentY);
    currentY += 5;
    doc.text('Unit: 1 kg = 32.1507 troy oz', 35, currentY);

    // Exchange rate et totaux (alignés à droite)
    currentY += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('EXCHANGE RATE FCFA/USD:', pageWidth - 80, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.exchangeRateFCFAUSD.toFixed(4), pageWidth - 15, currentY, { align: 'right' });

    currentY += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Total prix CFA', pageWidth - 80, currentY);
    doc.text(data.totalPriceCFA.toLocaleString('fr-FR'), pageWidth - 15, currentY, { align: 'right' });

    currentY += 6;
    doc.text('Total prix US$', pageWidth - 80, currentY);
    doc.text(data.totalPriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2 }), pageWidth - 15, currentY, { align: 'right' });

    return doc;
  },

  /**
   * Télécharge le PDF
   */
  downloadPDF(doc: jsPDF, filename: string): void {
    doc.save(filename);
  },

  /**
   * Retourne le PDF en blob pour upload
   */
  getPDFBlob(doc: jsPDF): Blob {
    return doc.output('blob');
  }
};
