import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { FactureDefinitive } from './artisanPaiementsService';

interface ArtisanInfo {
  nom: string;
  prenom: string;
  numero_carte: string;
  telephone?: string;
  adresse?: string;
}

interface VenteInfo {
  reference_vente: string;
  date_vente: string;
  poids_grammes: number;
  prix_gramme_fcfa: number;
}

const factureDefinitivePdfService = {
  async genererFacturePDF(
    facture: FactureDefinitive,
    artisan: ArtisanInfo,
    vente: VenteInfo
  ): Promise<Blob> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(16, 185, 129);
    pdf.text('SONASP', 15, 20);

    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Système National de Collecte et du Suivi', 15, 26);
    pdf.text('de la Traçabilité de l\'Or - Burkina Faso', 15, 31);

    const logoX = pageWidth - 50;
    try {
      const logoUrl = '/sonasp_logo.png';
      pdf.addImage(logoUrl, 'PNG', logoX, 10, 35, 35);
    } catch (error) {
      console.warn('Logo non chargé:', error);
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(0, 0, 0);
    pdf.text('FACTURE DÉFINITIVE', pageWidth / 2, 55, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(16, 185, 129);
    pdf.text(facture.numero_facture, pageWidth / 2, 62, { align: 'center' });

    pdf.setDrawColor(220, 220, 220);
    pdf.line(15, 67, pageWidth - 15, 67);

    let yPos = 75;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text('INFORMATIONS ARTISAN', 15, yPos);

    yPos += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Nom complet: ${artisan.nom} ${artisan.prenom}`, 15, yPos);

    yPos += 6;
    pdf.text(`Numéro de carte: ${artisan.numero_carte}`, 15, yPos);

    if (artisan.telephone) {
      yPos += 6;
      pdf.text(`Téléphone: ${artisan.telephone}`, 15, yPos);
    }

    if (artisan.adresse) {
      yPos += 6;
      pdf.text(`Adresse: ${artisan.adresse}`, 15, yPos);
    }

    yPos += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('INFORMATIONS FACTURE', 15, yPos);

    yPos += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const dateEmission = facture.date_emission
      ? new Date(facture.date_emission).toLocaleDateString('fr-FR')
      : 'Non renseignée';
    pdf.text(`Date d'émission: ${dateEmission}`, 15, yPos);

    if (facture.date_echeance) {
      yPos += 6;
      pdf.text(`Date d'échéance: ${new Date(facture.date_echeance).toLocaleDateString('fr-FR')}`, 15, yPos);
    }

    yPos += 6;
    pdf.text(`Référence vente: ${vente.reference_vente}`, 15, yPos);

    yPos += 6;
    pdf.text(`Date de vente: ${new Date(vente.date_vente).toLocaleDateString('fr-FR')}`, 15, yPos);

    yPos += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('DÉTAIL DE LA VENTE', 15, yPos);

    yPos += 7;
    const detailsTableData = [
      ['Poids vendu', `${vente.poids_grammes.toFixed(2)} g`],
      ['Prix par gramme', `${vente.prix_gramme_fcfa.toLocaleString('fr-FR')} FCFA`],
      ['Montant brut', `${facture.montant_brut.toLocaleString('fr-FR')} FCFA`]
    ];

    (pdf as any).autoTable({
      startY: yPos,
      head: [],
      body: detailsTableData,
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: 3
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { halign: 'right', cellWidth: 60 }
      },
      margin: { left: 15 }
    });

    yPos = (pdf as any).lastAutoTable.finalY + 10;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('CALCUL DES TAXES', 15, yPos);

    yPos += 7;
    const taxesTableData = [
      [
        `TVA (${facture.taux_tva}%)`,
        `${facture.montant_taxe_tva.toLocaleString('fr-FR')} FCFA`
      ],
      [
        `Retenue à la source (${facture.taux_retenue_source}%)`,
        `${facture.montant_taxe_retenue_source.toLocaleString('fr-FR')} FCFA`
      ]
    ];

    if (facture.montant_autres_taxes > 0) {
      taxesTableData.push([
        'Autres taxes',
        `${facture.montant_autres_taxes.toLocaleString('fr-FR')} FCFA`
      ]);
    }

    taxesTableData.push([
      'TOTAL TAXES',
      `${facture.montant_total_taxes.toLocaleString('fr-FR')} FCFA`
    ]);

    (pdf as any).autoTable({
      startY: yPos,
      head: [],
      body: taxesTableData,
      theme: 'striped',
      styles: {
        fontSize: 10,
        cellPadding: 3
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 90 },
        1: { halign: 'right', cellWidth: 60 }
      },
      margin: { left: 15 },
      didParseCell: (data: any) => {
        if (data.row.index === taxesTableData.length - 1) {
          data.cell.styles.fillColor = [16, 185, 129];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    yPos = (pdf as any).lastAutoTable.finalY + 15;

    pdf.setFillColor(16, 185, 129);
    pdf.rect(15, yPos, pageWidth - 30, 20, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text('MONTANT NET À PAYER', 20, yPos + 8);

    pdf.setFontSize(16);
    pdf.text(
      `${facture.montant_net_a_payer.toLocaleString('fr-FR')} FCFA`,
      pageWidth - 20,
      yPos + 8,
      { align: 'right' }
    );

    const montantEnLettres = this.nombreEnLettres(facture.montant_net_a_payer);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.text(`Arrêté à: ${montantEnLettres} francs CFA`, 20, yPos + 15);

    yPos += 30;

    if (facture.notes) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Notes:', 15, yPos);

      yPos += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const notesLines = pdf.splitTextToSize(facture.notes, pageWidth - 30);
      pdf.text(notesLines, 15, yPos);
      yPos += notesLines.length * 5;
    }

    const footerY = pdf.internal.pageSize.getHeight() - 30;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      'Cette facture définitive est émise après validation de la vente d\'or artisanal.',
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    pdf.text(
      'Les taxes sont retenues conformément à la réglementation fiscale en vigueur.',
      pageWidth / 2,
      footerY + 5,
      { align: 'center' }
    );

    pdf.setDrawColor(220, 220, 220);
    pdf.line(15, footerY + 10, pageWidth - 15, footerY + 10);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text('SONASP - Système National de Collecte et du Suivi de la Traçabilité de l\'Or', pageWidth / 2, footerY + 15, { align: 'center' });
    pdf.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, footerY + 19, { align: 'center' });

    return pdf.output('blob');
  },

  nombreEnLettres(nombre: number): string {
    const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const dizaines = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    const exceptions = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];

    if (nombre === 0) return 'zéro';
    if (nombre < 0) return 'moins ' + this.nombreEnLettres(-nombre);

    let result = '';

    const millions = Math.floor(nombre / 1000000);
    const milliers = Math.floor((nombre % 1000000) / 1000);
    const centaines = nombre % 1000;

    if (millions > 0) {
      if (millions === 1) {
        result += 'un million ';
      } else {
        result += this.nombreEnLettres(millions) + ' millions ';
      }
    }

    if (milliers > 0) {
      if (milliers === 1) {
        result += 'mille ';
      } else {
        result += this.nombreEnLettres(milliers) + ' mille ';
      }
    }

    if (centaines > 0) {
      const c = Math.floor(centaines / 100);
      const reste = centaines % 100;

      if (c > 0) {
        if (c === 1 && reste === 0) {
          result += 'cent';
        } else if (c === 1) {
          result += 'cent ';
        } else {
          result += unites[c] + ' cent' + (reste === 0 ? 's' : ' ');
        }
      }

      if (reste > 0) {
        if (reste < 10) {
          result += unites[reste];
        } else if (reste < 17) {
          result += exceptions[reste - 10];
        } else if (reste < 20) {
          result += 'dix-' + unites[reste - 10];
        } else {
          const d = Math.floor(reste / 10);
          const u = reste % 10;

          if (d === 7 || d === 9) {
            result += dizaines[d] + '-' + exceptions[u + (d === 7 ? 0 : 10)];
          } else if (u === 0) {
            result += dizaines[d] + (d === 8 ? 's' : '');
          } else if (u === 1 && d < 8) {
            result += dizaines[d] + ' et ' + unites[u];
          } else {
            result += dizaines[d] + '-' + unites[u];
          }
        }
      }
    }

    return result.trim();
  }
};

export default factureDefinitivePdfService;
