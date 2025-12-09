import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { roundUpToFixed } from '@/utils/numberUtils';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface PackingListData {
  expeditionLotNumber: string;
  productionDate: string;
  miningCompany: string;
  refineryName: string;
  refineryAddress: string;
  refineryCountry: string;
  freightCompany?: string;
  ingots: Array<{
    ingotBoxNumber: string;
    netWeight: number;
    grossWeight: number;
    sealNumber1: string;
    sealNumber2: string;
  }>;
  signatories: Array<{
    position: string;
    name: string;
  }>;
}

export class PackingListPdfService {
  /**
   * Génère un PDF du Packing List conforme au format gouvernemental
   */
  static generatePDF(data: PackingListData): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Format de date conforme: 31-Oct-25
    const formattedDate = new Date(data.productionDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    }).replace(/ /g, '-');

    // Couleurs
    const goldColor = [198, 156, 61]; // #C69C3D
    const lightBlueColor = [173, 216, 230]; // #ADD8E6

    let yPos = margin;

    // En-tête - Raffinerie (gauche) et Mining Company (droite)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(data.refineryName.toUpperCase(), margin, yPos);

    // Mining Company (encadré) - droite
    doc.setFontSize(12);
    doc.setDrawColor(180, 134, 11); // Jaune foncé
    doc.setLineWidth(0.5);
    doc.rect(pageWidth - margin - 70, yPos - 5, 70, 15);
    doc.text(data.miningCompany, pageWidth - margin - 35, yPos, { align: 'center' });
    doc.setFontSize(8);
    doc.text('HUMMINGBIRD RESOURCES', pageWidth - margin - 35, yPos + 5, { align: 'center' });

    yPos += 10;

    // Shipped to (gauche)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Shipped to:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    doc.text(data.refineryAddress, margin, yPos);
    yPos += 5;
    doc.text(data.refineryCountry, margin, yPos);

    // From (droite)
    const fromX = pageWidth - margin - 60;
    let fromY = yPos - 10;
    doc.setFont('helvetica', 'bold');
    doc.text('From:', fromX, fromY);
    doc.setFont('helvetica', 'normal');
    fromY += 5;
    doc.text('Societe des Mines de Komana SA', fromX, fromY);
    fromY += 4;
    doc.text('Magnambougou Faso Kanu', fromX, fromY);
    fromY += 4;
    doc.text('Commune VI', fromX, fromY);
    fromY += 4;
    doc.text('Bamako, Mali', fromX, fromY);

    yPos += 15;

    // PACKING LIST (titre encadré)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setDrawColor(0);
    doc.setLineWidth(0.8);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 10);
    doc.text('PACKING LIST', pageWidth / 2, yPos + 7, { align: 'center' });

    yPos += 15;

    // DATE et EXPEDITION / LOT No
    doc.setFontSize(9);
    doc.text(`DATE: ${formattedDate}`, margin, yPos);
    doc.text(`EXPEDITION / LOT No: ${data.expeditionLotNumber}`, pageWidth / 2 + 10, yPos);

    yPos += 10;

    // Tableau des Ingots
    const totalNetWeight = data.ingots.reduce((sum, ingot) => sum + ingot.netWeight, 0);
    const totalGrossWeight = data.ingots.reduce((sum, ingot) => sum + ingot.grossWeight, 0);

    const ingotRows = data.ingots.map(ingot => [
      ingot.ingotBoxNumber,
      roundUpToFixed(ingot.netWeight, 2),
      roundUpToFixed(ingot.grossWeight, 2),
      `✓ ${ingot.sealNumber1}`,
      `✓ ${ingot.sealNumber2}`,
    ]);

    // Ajouter la ligne TOTAL
    ingotRows.push([
      'TOTAL',
      roundUpToFixed(totalNetWeight, 2),
      roundUpToFixed(totalGrossWeight, 2),
      '',
      '',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [[
        'Ingot & Box #',
        'Ingot Net\nWeight (g)',
        'Ingot Gross\nWeight (g)',
        'Seal Number 1',
        'Seal Number 2',
      ]],
      body: ingotRows,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        halign: 'center',
        valign: 'middle',
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: goldColor,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: 0.3,
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'normal' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
      },
      didParseCell: function (data: any) {
        // Ligne TOTAL avec fond jaune
        if (data.row.index === ingotRows.length - 1) {
          data.cell.styles.fillColor = goldColor;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.lineWidth = 0.3;
        }
        // Première colonne de la ligne TOTAL alignée à gauche
        if (data.row.index === ingotRows.length - 1 && data.column.index === 0) {
          data.cell.styles.halign = 'left';
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Freight Company
    if (data.freightCompany) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Freight Company:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(data.freightCompany, margin + 35, yPos);
      yPos += 8;
    }

    // Tableau des Signatures
    const signatureRows = data.signatories.map(sig => [
      sig.position,
      sig.name,
      '', // Signature vide
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['POSITION', 'NAME', 'SIGNATURE']],
      body: signatureRows,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 5,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: lightBlueColor,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: 0.3,
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 60 },
        1: { halign: 'center', fontStyle: 'bold', cellWidth: 60 },
        2: { halign: 'center', cellWidth: 'auto' },
      },
    });

    return doc;
  }

  /**
   * Génère et télécharge le PDF
   */
  static async downloadPDF(data: PackingListData, filename?: string): Promise<void> {
    const doc = this.generatePDF(data);
    const finalFilename = filename || `Packing_List_${data.expeditionLotNumber.replace(/\//g, '_')}.pdf`;
    doc.save(finalFilename);
  }

  /**
   * Génère le PDF et retourne le blob pour envoi email
   */
  static async generatePDFBlob(data: PackingListData): Promise<Blob> {
    const doc = this.generatePDF(data);
    return doc.output('blob');
  }

  /**
   * Ouvre Outlook avec le PDF en pièce jointe
   * Note: Cette méthode fonctionne uniquement sur Windows avec Outlook installé
   */
  static async sendViaOutlook(data: PackingListData): Promise<void> {
    try {
      // Générer le PDF
      const doc = this.generatePDF(data);
      const pdfBlob = doc.output('blob');

      // Créer un nom de fichier
      const filename = `Packing_List_${data.expeditionLotNumber.replace(/\//g, '_')}.pdf`;

      // Créer un lien de téléchargement temporaire
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;

      // Télécharger le fichier
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Nettoyer l'URL
      setTimeout(() => URL.revokeObjectURL(url), 100);

      // Créer le sujet et le corps de l'email
      const subject = `Packing List - ${data.expeditionLotNumber}`;
      const body = `Dear Sir/Madam,

Please find attached the Packing List for expedition ${data.expeditionLotNumber}.

Details:
- Date: ${new Date(data.productionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
- Mining Company: ${data.miningCompany}
- Refinery: ${data.refineryName}
- Total Net Weight: ${roundUpToFixed(data.ingots.reduce((sum, i) => sum + i.netWeight, 0), 2)} g
- Total Gross Weight: ${roundUpToFixed(data.ingots.reduce((sum, i) => sum + i.grossWeight, 0), 2)} g
- Number of Ingots: ${data.ingots.length}

Best regards,
${data.miningCompany}`;

      // Ouvrir le client email par défaut avec mailto
      // Note: La pièce jointe doit être ajoutée manuellement par l'utilisateur
      const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      // Ouvrir dans une nouvelle fenêtre
      window.open(mailtoLink, '_blank');

      // Afficher un message à l'utilisateur
      alert(`Le PDF "${filename}" a été téléchargé.\n\nVotre client email va s'ouvrir. Veuillez ajouter le PDF téléchargé en pièce jointe et choisir vos destinataires.`);

    } catch (error) {
      console.error('Erreur lors de l\'envoi via email:', error);
      throw error;
    }
  }
}
