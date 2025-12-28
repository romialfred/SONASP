import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FactureDefinitive, PaiementArtisan } from './artisanPaiementsService';

interface FactureData {
  facture: FactureDefinitive;
  paiement: PaiementArtisan;
  artisan: {
    nom: string;
    prenom: string;
    adresse?: string;
    telephone?: string;
    numero_carte?: string;
  };
  venteOr: {
    poids_grammes: number;
    poids_onces: number;
    prix_unitaire_fcfa: number;
    purete_pourcentage: number;
  };
}

export class FactureArtisanPdfService {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  public genererFacture(data: FactureData): jsPDF {
    this.ajouterEnTete();
    this.ajouterInformationsVendeur();
    this.ajouterInformationsClient(data.artisan);
    this.ajouterDetailsFacture(data.facture);
    this.ajouterTableauProduits(data.venteOr, data.facture);
    this.ajouterTotaux(data.facture);
    this.ajouterInformationsComplementaires(data.paiement);
    this.ajouterPiedPage();

    return this.doc;
  }

  private ajouterEnTete(): void {
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('FACTURE NORMALISÉE – VENTE D\'OR', this.pageWidth / 2, 20, { align: 'center' });

    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, 25, this.pageWidth - this.margin, 25);
  }

  private ajouterInformationsVendeur(): void {
    let yPos = 35;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Vendeur :', this.margin, yPos);

    this.doc.setFont('helvetica', 'normal');
    yPos += 6;
    this.doc.text('Société Nationale des Substances Précieuses (SONASP)', this.margin, yPos);
    yPos += 5;
    this.doc.text('Adresse : Ouagadougou, Burkina Faso', this.margin, yPos);
    yPos += 5;
    this.doc.text('IFU : 000000000', this.margin, yPos);
    yPos += 5;
    this.doc.text('Téléphone : +226 XX XX XX XX', this.margin, yPos);
  }

  private ajouterInformationsClient(artisan: FactureData['artisan']): void {
    let yPos = 70;

    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Client :', this.margin, yPos);

    this.doc.setFont('helvetica', 'normal');
    yPos += 6;
    this.doc.text(`${artisan.nom} ${artisan.prenom}`, this.margin, yPos);

    if (artisan.adresse) {
      yPos += 5;
      this.doc.text(`Adresse : ${artisan.adresse}`, this.margin, yPos);
    }

    if (artisan.telephone) {
      yPos += 5;
      this.doc.text(`Téléphone : ${artisan.telephone}`, this.margin, yPos);
    }

    if (artisan.numero_carte) {
      yPos += 5;
      this.doc.text(`N° Carte Artisan : ${artisan.numero_carte}`, this.margin, yPos);
    }
  }

  private ajouterDetailsFacture(facture: FactureDefinitive): void {
    const yPos = 105;

    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`Facture N° :`, this.margin, yPos);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(facture.numero_facture || 'N/A', this.margin + 30, yPos);

    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Date :', this.margin, yPos + 6);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(new Date(facture.date_emission).toLocaleDateString('fr-FR'), this.margin + 30, yPos + 6);

    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Devise :', this.margin, yPos + 12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('FCFA', this.margin + 30, yPos + 12);
  }

  private ajouterTableauProduits(venteOr: FactureData['venteOr'], facture: FactureDefinitive): void {
    const poidsKg = (venteOr.poids_grammes / 1000).toFixed(3);

    autoTable(this.doc, {
      startY: 125,
      head: [['Description', 'Quantité (Kg)', 'Prix Unitaire (FCFA)', 'Montant (FCFA)']],
      body: [
        [
          `Or brut – Pureté ${venteOr.purete_pourcentage}%`,
          poidsKg,
          venteOr.prix_unitaire_fcfa.toLocaleString('fr-FR'),
          facture.montant_brut.toLocaleString('fr-FR')
        ]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      bodyStyles: {
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      styles: {
        fontSize: 10,
        cellPadding: 5
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 40, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' }
      }
    });
  }

  private ajouterTotaux(facture: FactureDefinitive): void {
    const finalY = (this.doc as any).lastAutoTable.finalY || 150;
    let yPos = finalY + 10;

    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Total HT :', this.margin, yPos);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`${facture.montant_brut.toLocaleString('fr-FR')} FCFA`, this.pageWidth - this.margin, yPos, { align: 'right' });

    yPos += 6;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`TVA :`, this.margin, yPos);
    this.doc.setFont('helvetica', 'normal');

    let tvaText = 'Exonérée (Exportation)';
    if (facture.montant_taxe_tva > 0) {
      tvaText = `${facture.taux_tva}% - ${facture.montant_taxe_tva.toLocaleString('fr-FR')} FCFA`;
    }
    this.doc.text(tvaText, this.pageWidth - this.margin, yPos, { align: 'right' });

    if (facture.montant_taxe_retenue_source > 0) {
      yPos += 6;
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`Retenue à la source (${facture.taux_retenue_source}%) :`, this.margin, yPos);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`-${facture.montant_taxe_retenue_source.toLocaleString('fr-FR')} FCFA`, this.pageWidth - this.margin, yPos, { align: 'right' });
    }

    yPos += 8;
    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, yPos - 2, this.pageWidth - this.margin, yPos - 2);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(12);
    this.doc.text('Total TTC :', this.margin, yPos + 2);
    this.doc.text(`${facture.montant_net_a_payer.toLocaleString('fr-FR')} FCFA`, this.pageWidth - this.margin, yPos + 2, { align: 'right' });

    this.doc.setFontSize(10);
  }

  private ajouterInformationsComplementaires(paiement: PaiementArtisan): void {
    const finalY = (this.doc as any).lastAutoTable.finalY || 150;
    let yPos = finalY + 45;

    const modePaiementText = this.getModePaiementText(paiement.type_paiement);

    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Mode de paiement : ${modePaiementText}`, this.margin, yPos);

    yPos += 6;
    this.doc.text('Conditions de livraison : FOB – Aéroport de Ouagadougou', this.margin, yPos);

    yPos += 6;
    this.doc.text('Référence légale : Facture conforme à la réglementation fiscale du Burkina Faso.', this.margin, yPos);
  }

  private getModePaiementText(type: string): string {
    const types: Record<string, string> = {
      'virement_bancaire': 'Virement bancaire',
      'orange_money': 'Orange Money',
      'moov_money': 'Moov Money',
      'wave': 'Wave',
      'mobile_money': 'Mobile Money',
      'cash': 'Espèces',
      'cheque': 'Chèque'
    };
    return types[type] || type;
  }

  private ajouterPiedPage(): void {
    const yPos = this.pageHeight - 50;

    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Signature et cachet du vendeur', this.margin, yPos);

    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, yPos + 20, this.margin + 60, yPos + 20);
  }

  public telecharger(nomFichier: string = 'facture.pdf'): void {
    this.doc.save(nomFichier);
  }

  public obtenirBlob(): Blob {
    return this.doc.output('blob');
  }

  public obtenirDataUrl(): string {
    return this.doc.output('dataurlstring');
  }
}

export const genererFacturePaiementArtisan = (data: FactureData): jsPDF => {
  const service = new FactureArtisanPdfService();
  return service.genererFacture(data);
};

export const telechargerFacturePaiementArtisan = (data: FactureData, nomFichier?: string): void => {
  const service = new FactureArtisanPdfService();
  service.genererFacture(data);
  service.telecharger(nomFichier || `facture_${data.facture.numero_facture}.pdf`);
};
