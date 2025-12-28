import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { ArtisanMinier } from './artisanMinierService';
import { CarteProfessionnelle } from './carteProfessionnelleService';

const CARTE_WIDTH = 85.6;
const CARTE_HEIGHT = 53.98;

export const carteProfessionnelleGeneratorService = {
  async generateQRCode(data: string): Promise<string> {
    try {
      const qrDataUrl = await QRCode.toDataURL(data, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  },

  async generateCarteRecto(
    artisan: ArtisanMinier,
    carte: CarteProfessionnelle
  ): Promise<string> {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [CARTE_WIDTH, CARTE_HEIGHT]
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setFillColor(245, 245, 240);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    pdf.setDrawColor(16, 185, 129);
    pdf.setLineWidth(0.5);
    pdf.rect(1, 1, pageWidth - 2, pageHeight - 2);

    pdf.setFontSize(7);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.text('BURKINA FASO', pageWidth / 2, 5, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setTextColor(16, 185, 129);
    pdf.text('CARTE D\'ARTISAN MINIER', pageWidth / 2, 12, { align: 'center' });

    pdf.setFontSize(7);
    pdf.setTextColor(220, 38, 38);
    pdf.text('Secteur Minier Artisanal', pageWidth / 2, 16, { align: 'center' });

    const photoX = pageWidth - 20;
    const photoY = 18;
    const photoWidth = 17;
    const photoHeight = 22;

    if (artisan.photo_url) {
      try {
        pdf.addImage(artisan.photo_url, 'JPEG', photoX, photoY, photoWidth, photoHeight);
      } catch (e) {
        pdf.setFillColor(200, 200, 200);
        pdf.rect(photoX, photoY, photoWidth, photoHeight, 'F');
      }
    } else {
      pdf.setFillColor(200, 200, 200);
      pdf.rect(photoX, photoY, photoWidth, photoHeight, 'F');
      pdf.setFontSize(6);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Photo', photoX + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
    }

    pdf.setDrawColor(100, 100, 100);
    pdf.rect(photoX, photoY, photoWidth, photoHeight);

    let yPos = 20;
    const leftMargin = 5;
    const labelColor: [number, number, number] = [0, 0, 0];
    const valueColor: [number, number, number] = [16, 185, 129];

    pdf.setFontSize(7);
    pdf.setTextColor(...labelColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text('NOM & PRÉNOMS:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...valueColor);
    const nomComplet = artisan.type_personne === 'physique'
      ? `${artisan.nom || ''} ${artisan.prenoms || ''}`.trim()
      : artisan.raison_sociale || '';
    pdf.text(nomComplet.toUpperCase(), leftMargin + 25, yPos);

    yPos += 5;
    pdf.setTextColor(...labelColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text('TYPE DE CARTE:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 140, 0);
    const typeLabel = {
      exploitant: 'Exploitant',
      collecteur: 'Collecteur',
      intermediaire: 'Intermédiaire',
      fournisseur: 'Fournisseur'
    }[artisan.type_artisan] || artisan.type_artisan;
    pdf.text(typeLabel, leftMargin + 25, yPos);

    yPos += 5;
    pdf.setTextColor(...labelColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text('N° DE CARTE:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...valueColor);
    pdf.text(carte.numero_carte, leftMargin + 25, yPos);

    yPos += 5;
    pdf.setTextColor(...labelColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text('SITE:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...valueColor);
    pdf.text(artisan.site_exploitation || artisan.region || 'N/A', leftMargin + 25, yPos);

    yPos += 5;
    pdf.setTextColor(...labelColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text('DÉLIVRÉE LE:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...valueColor);
    const dateDelivrance = new Date(carte.date_delivrance).toLocaleDateString('fr-FR');
    pdf.text(dateDelivrance, leftMargin + 25, yPos);

    yPos += 0.5;
    pdf.setTextColor(...labelColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text('EXPIRE LE:', leftMargin + 45, yPos - 0.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...valueColor);
    const dateExpiration = new Date(carte.date_expiration).toLocaleDateString('fr-FR');
    pdf.text(dateExpiration, leftMargin + 60, yPos - 0.5);

    const footerY = pageHeight - 6;
    pdf.setFillColor(16, 185, 129);
    pdf.rect(0, footerY, pageWidth, 6, 'F');

    pdf.setDrawColor(16, 185, 129);
    pdf.setFillColor(255, 255, 255);
    const lockX = 4;
    pdf.circle(lockX + 1, footerY + 3, 1.5, 'FD');

    pdf.setFontSize(6);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CARTE OFFICIELLE', lockX + 4, footerY + 3.5);

    pdf.setFont('helvetica', 'normal');
    pdf.text(carte.numero_securite || '0000000000', pageWidth - 25, footerY + 3.5);

    return pdf.output('dataurlstring');
  },

  async generateCarteVerso(
    artisan: ArtisanMinier,
    carte: CarteProfessionnelle
  ): Promise<string> {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [CARTE_WIDTH, CARTE_HEIGHT]
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setFillColor(245, 245, 240);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    pdf.setDrawColor(16, 185, 129);
    pdf.setLineWidth(0.5);
    pdf.rect(1, 1, pageWidth - 2, pageHeight - 2);

    const qrSize = 25;
    const qrX = 8;
    const qrY = 8;

    if (carte.qr_code_data) {
      try {
        const qrDataUrl = await this.generateQRCode(carte.qr_code_data);
        pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      } catch (e) {
        pdf.setFillColor(200, 200, 200);
        pdf.rect(qrX, qrY, qrSize, qrSize, 'F');
      }
    }

    pdf.setFontSize(6);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Scanner pour', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });
    pdf.text('vérification', qrX + qrSize / 2, qrY + qrSize + 6, { align: 'center' });

    const textX = qrX + qrSize + 8;
    let yPos = 10;

    pdf.setFontSize(9);
    pdf.setTextColor(16, 185, 129);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CARTE D\'ARTISAN MINIER', textX, yPos);

    yPos += 5;
    pdf.setFontSize(7);
    pdf.setTextColor(220, 38, 38);
    pdf.text('Secteur Minier Artisanal', textX, yPos);

    yPos += 6;
    pdf.setFontSize(6.5);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    const texteInfo = [
      'Cette carte est délivrée conformément au',
      'Code minier du Burkina Faso.',
      '',
      'Elle autorise son titulaire à exercer des',
      'activités minières artisanales et à vendre',
      'l\'or exclusivement dans les circuits formels',
      'agréés par la SONASP.'
    ];

    texteInfo.forEach(ligne => {
      pdf.text(ligne, textX, yPos);
      yPos += 3.5;
    });

    yPos += 2;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(6);
    pdf.text('Oumar Zongo', textX, yPos);
    yPos += 3;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Directeur Général', textX, yPos);

    const sealX = pageWidth - 15;
    const sealY = pageHeight / 2 - 5;
    pdf.setDrawColor(16, 185, 129);
    pdf.setFillColor(245, 245, 240);
    pdf.circle(sealX, sealY, 10, 'FD');

    pdf.setFontSize(5);
    pdf.setTextColor(16, 185, 129);
    pdf.setFont('helvetica', 'bold');
    pdf.text('SCEAU', sealX, sealY - 1, { align: 'center' });
    pdf.text('OFFICIEL', sealX, sealY + 2, { align: 'center' });
    pdf.text('SONASP', sealX, sealY + 5, { align: 'center' });

    const footerY = pageHeight - 8;
    pdf.setFontSize(5.5);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CARTE PERSONNELLE - NON CESSIBLE', pageWidth / 2, footerY, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.text('TOUTE FALSIFICATION EST PUNIE PAR LA LOI', pageWidth / 2, footerY + 3, { align: 'center' });

    return pdf.output('dataurlstring');
  },

  async generateCartePDF(
    artisan: ArtisanMinier,
    carte: CarteProfessionnelle
  ): Promise<Blob> {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const rectoData = await this.generateCarteRecto(artisan, carte);
    const versoData = await this.generateCarteVerso(artisan, carte);

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const carteDisplayWidth = CARTE_WIDTH * 2;
    const carteDisplayHeight = CARTE_HEIGHT * 2;

    const xRecto = (pageWidth / 2 - carteDisplayWidth) / 2;
    const y = (pageHeight - carteDisplayHeight) / 2;

    pdf.addImage(rectoData, 'PNG', xRecto, y, carteDisplayWidth, carteDisplayHeight);

    const xVerso = pageWidth / 2 + (pageWidth / 2 - carteDisplayWidth) / 2;
    pdf.addImage(versoData, 'PNG', xVerso, y, carteDisplayWidth, carteDisplayHeight);

    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text('RECTO', pageWidth / 4, y - 5, { align: 'center' });
    pdf.text('VERSO', (pageWidth * 3) / 4, y - 5, { align: 'center' });

    pdf.setFontSize(8);
    pdf.text(`Carte N°: ${carte.numero_carte}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, pageHeight - 6, { align: 'center' });

    return pdf.output('blob');
  },

  async generatePreviewDataUrl(
    artisan: Partial<ArtisanMinier>,
    carte: Partial<CarteProfessionnelle>
  ): Promise<string> {
    const tempArtisan: ArtisanMinier = {
      id: '',
      numero_carte: carte.numero_carte || 'SONASP/AM/2025/000000',
      type_personne: artisan.type_personne || 'physique',
      type_artisan: artisan.type_artisan || 'exploitant',
      nom: artisan.nom || 'NOM',
      prenoms: artisan.prenoms || 'PRÉNOMS',
      telephone: artisan.telephone || '',
      adresse_complete: artisan.adresse_complete || '',
      photo_url: artisan.photo_url,
      site_exploitation: artisan.site_exploitation,
      region: artisan.region,
      raison_sociale: artisan.raison_sociale
    };

    const tempCarte: CarteProfessionnelle = {
      id: '',
      artisan_id: '',
      numero_carte: carte.numero_carte || 'SONASP/AM/2025/000000',
      statut: carte.statut || 'en_cours',
      date_delivrance: carte.date_delivrance || new Date().toISOString().split('T')[0],
      date_expiration: carte.date_expiration || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      numero_securite: carte.numero_securite || '0000000000',
      qr_code_data: carte.qr_code_data || JSON.stringify({ numero_carte: tempArtisan.numero_carte })
    };

    return await this.generatePreviewRectoVerso(tempArtisan, tempCarte);
  },

  async generatePreviewRectoVerso(
    artisan: ArtisanMinier,
    carte: CarteProfessionnelle
  ): Promise<string> {
    const rectoData = await this.generateCarteRecto(artisan, carte);
    const versoData = await this.generateCarteVerso(artisan, carte);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to get canvas context');

    const cardWidthPx = 800;
    const cardHeightPx = 500;
    const gap = 40;

    canvas.width = cardWidthPx * 2 + gap;
    canvas.height = cardHeightPx + 100;

    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rectoImg = new Image();
    const versoImg = new Image();

    return new Promise((resolve, reject) => {
      let loadedImages = 0;

      const checkBothLoaded = () => {
        loadedImages++;
        if (loadedImages === 2) {
          ctx.drawImage(rectoImg, 0, 50, cardWidthPx, cardHeightPx);
          ctx.drawImage(versoImg, cardWidthPx + gap, 50, cardWidthPx, cardHeightPx);

          ctx.fillStyle = '#374151';
          ctx.font = 'bold 24px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('RECTO', cardWidthPx / 2, 35);
          ctx.fillText('VERSO', cardWidthPx + gap + cardWidthPx / 2, 35);

          ctx.fillStyle = '#6b7280';
          ctx.font = '16px Inter, sans-serif';
          ctx.fillText(
            `Carte N°: ${carte.numero_carte}`,
            canvas.width / 2,
            cardHeightPx + 80
          );

          resolve(canvas.toDataURL('image/png'));
        }
      };

      rectoImg.onload = checkBothLoaded;
      versoImg.onload = checkBothLoaded;
      rectoImg.onerror = () => reject(new Error('Failed to load recto image'));
      versoImg.onerror = () => reject(new Error('Failed to load verso image'));

      rectoImg.src = rectoData;
      versoImg.src = versoData;
    });
  }
};
