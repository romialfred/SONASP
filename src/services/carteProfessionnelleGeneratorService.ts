import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { ArtisanMinier } from './artisanMinierService';
import { CarteProfessionnelle } from './carteProfessionnelleService';
import { artisanDocumentService } from './artisanDocumentService';

const CARTE_WIDTH = 85.6;
const CARTE_HEIGHT = 53.98;

export const carteProfessionnelleGeneratorService = {
  /**
   * Génère un VRAI QR code scannable encodant `data` (audit C-01/Q1).
   * Auparavant : bruit aléatoire non scannable. Désormais via la lib `qrcode`.
   */
  async generateQRCode(data: string): Promise<string> {
    return QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 200,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  },

  async generateCarteRecto(
    artisan: ArtisanMinier,
    carte: CarteProfessionnelle,
  ): Promise<string> {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [CARTE_WIDTH, CARTE_HEIGHT],
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
    pdf.text("CARTE D'ARTISAN MINIER", pageWidth / 2, 12, { align: 'center' });

    pdf.setFontSize(7);
    pdf.setTextColor(220, 38, 38);
    pdf.text('Secteur Minier Artisanal', pageWidth / 2, 16, {
      align: 'center',
    });

    const photoX = pageWidth - 20;
    const photoY = 18;
    const photoWidth = 17;
    const photoHeight = 22;

    if (artisan.type_personne === 'physique') {
      if (artisan.photo_url) {
        try {
          let photo = artisan.photo_url;
          if (!photo.startsWith('data:')) {
            const source = photo.startsWith('blob:')
              ? photo
              : await artisanDocumentService.photoUrl(photo);
            const response = await fetch(source, {
              referrerPolicy: 'no-referrer',
            });
            if (!response.ok) throw new Error('Photo indisponible');
            photo = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              void response
                .blob()
                .then((blob) => reader.readAsDataURL(blob), reject);
            });
          }
          pdf.addImage(photo, 'JPEG', photoX, photoY, photoWidth, photoHeight);
        } catch (e) {
          pdf.setFillColor(200, 200, 200);
          pdf.rect(photoX, photoY, photoWidth, photoHeight, 'F');
        }
      } else {
        pdf.setFillColor(200, 200, 200);
        pdf.rect(photoX, photoY, photoWidth, photoHeight, 'F');
        pdf.setFontSize(6);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Photo', photoX + photoWidth / 2, photoY + photoHeight / 2, {
          align: 'center',
        });
      }

      pdf.setDrawColor(100, 100, 100);
      pdf.rect(photoX, photoY, photoWidth, photoHeight);
    }

    let yPos = 20;
    const leftMargin = 5;
    const labelColor: [number, number, number] = [0, 0, 0];
    const valueColor: [number, number, number] = [16, 185, 129];

    pdf.setFontSize(7);
    pdf.setTextColor(...labelColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      artisan.type_personne === 'morale' ? 'RAISON SOCIALE:' : 'NOM & PRÉNOMS:',
      leftMargin,
      yPos,
    );
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...valueColor);
    const nomComplet =
      artisan.type_personne === 'physique'
        ? `${artisan.nom || ''} ${artisan.prenoms || ''}`.trim()
        : artisan.raison_sociale || '';
    pdf.text(nomComplet.toUpperCase(), leftMargin + 25, yPos);

    yPos += 5;
    pdf.setTextColor(...labelColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text('TYPE DE CARTE:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 140, 0);
    const typeLabel =
      {
        exploitant: 'Exploitant',
        collecteur: 'Collecteur',
        intermediaire: 'Intermédiaire',
        fournisseur: 'Fournisseur',
        aide_exploitant: 'Aide exploitant',
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
    pdf.text('RÉGION:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...valueColor);
    pdf.text(artisan.region || 'N/A', leftMargin + 25, yPos);

    yPos += 5;
    pdf.setTextColor(...labelColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text('DÉLIVRÉE LE:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...valueColor);
    const dateDelivrance = carte.date_delivrance
      ? new Date(carte.date_delivrance).toLocaleDateString('fr-FR')
      : 'N/A';
    pdf.text(dateDelivrance, leftMargin + 25, yPos);

    yPos += 3.5;
    pdf.setTextColor(...labelColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text('EXPIRE LE:', leftMargin, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...valueColor);
    const dateExpiration = new Date(carte.date_expiration).toLocaleDateString(
      'fr-FR',
    );
    pdf.text(dateExpiration, leftMargin + 25, yPos);

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
    pdf.text(
      carte.numero_securite || '0000000000',
      pageWidth - 25,
      footerY + 3.5,
    );

    return pdf.output('dataurlstring');
  },

  async generateCarteVerso(
    artisan: ArtisanMinier,
    carte: CarteProfessionnelle,
  ): Promise<string> {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [CARTE_WIDTH, CARTE_HEIGHT],
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
    pdf.text('Scanner pour', qrX + qrSize / 2, qrY + qrSize + 3, {
      align: 'center',
    });
    pdf.text('vérification', qrX + qrSize / 2, qrY + qrSize + 6, {
      align: 'center',
    });

    const textX = qrX + qrSize + 8;
    let yPos = 10;

    pdf.setFontSize(9);
    pdf.setTextColor(16, 185, 129);
    pdf.setFont('helvetica', 'bold');
    pdf.text("CARTE D'ARTISAN MINIER", textX, yPos);

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
      "l'or exclusivement dans les circuits formels",
      'agréés par la SONASP.',
    ];

    texteInfo.forEach((ligne) => {
      pdf.text(ligne, textX, yPos);
      yPos += 3.5;
    });

    const footerY = pageHeight - 8;
    pdf.setFontSize(5.5);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.text(
      artisan.type_personne === 'morale'
        ? 'CARTE DE SOCIÉTÉ - NON CESSIBLE'
        : 'CARTE PERSONNELLE - NON CESSIBLE',
      pageWidth / 2,
      footerY,
      { align: 'center' },
    );
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      'TOUTE FALSIFICATION EST PUNIE PAR LA LOI',
      pageWidth / 2,
      footerY + 3,
      { align: 'center' },
    );

    return pdf.output('dataurlstring');
  },

  async generateCartePDF(
    artisan: ArtisanMinier,
    carte: CarteProfessionnelle,
  ): Promise<Blob> {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: false,
    });

    const rectoData = await this.generateCarteRecto(artisan, carte);
    const versoData = await this.generateCarteVerso(artisan, carte);

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const carteDisplayWidth = CARTE_WIDTH * 2.5;
    const carteDisplayHeight = CARTE_HEIGHT * 2.5;

    const xRecto = (pageWidth / 2 - carteDisplayWidth) / 2;
    const y = (pageHeight - carteDisplayHeight) / 2;

    pdf.addImage(
      rectoData,
      'PNG',
      xRecto,
      y,
      carteDisplayWidth,
      carteDisplayHeight,
      undefined,
      'FAST',
    );

    const xVerso = pageWidth / 2 + (pageWidth / 2 - carteDisplayWidth) / 2;
    pdf.addImage(
      versoData,
      'PNG',
      xVerso,
      y,
      carteDisplayWidth,
      carteDisplayHeight,
      undefined,
      'FAST',
    );

    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text('RECTO', pageWidth / 4, y - 5, { align: 'center' });
    pdf.text('VERSO', (pageWidth * 3) / 4, y - 5, { align: 'center' });

    pdf.setFontSize(8);
    pdf.text(
      `Carte N°: ${carte.numero_carte}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' },
    );
    pdf.text(
      `Généré le: ${new Date().toLocaleDateString('fr-FR')}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' },
    );

    return pdf.output('blob');
  },

  dataURLtoBlob(dataURL: string): Blob {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  },

  async generateAndUploadCartePDF(
    artisan: ArtisanMinier,
    carte: CarteProfessionnelle,
    supabase: any,
  ): Promise<{ pdfUrl: string; rectoUrl: string; versoUrl: string }> {
    try {
      console.log('Début de la génération des cartes pour upload...');

      const pdfBlob = await this.generateCartePDF(artisan, carte);
      console.log('PDF généré, taille:', pdfBlob.size);

      const rectoData = await this.generateCarteRecto(artisan, carte);
      const versoData = await this.generateCarteVerso(artisan, carte);
      console.log('Recto et Verso générés');

      const fileName = `carte_${carte.numero_carte.replace(/\//g, '_')}_${Date.now()}`;

      const rectoBlob = this.dataURLtoBlob(rectoData);
      const versoBlob = this.dataURLtoBlob(versoData);
      console.log(
        'Blobs créés - Recto:',
        rectoBlob.size,
        'Verso:',
        versoBlob.size,
      );

      console.log('Upload du PDF...');
      const { data: pdfData, error: pdfError } = await supabase.storage
        .from('cartes-professionnelles')
        .upload(`${fileName}.pdf`, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true,
        });

      if (pdfError) {
        console.error('Erreur upload PDF:', pdfError);
        throw pdfError;
      }
      console.log('PDF uploadé avec succès');

      console.log('Upload du Recto...');
      const { data: rectoUpload, error: rectoError } = await supabase.storage
        .from('cartes-professionnelles')
        .upload(`${fileName}_recto.png`, rectoBlob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true,
        });

      if (rectoError) {
        console.error('Erreur upload Recto:', rectoError);
        throw rectoError;
      }
      console.log('Recto uploadé avec succès');

      console.log('Upload du Verso...');
      const { data: versoUpload, error: versoError } = await supabase.storage
        .from('cartes-professionnelles')
        .upload(`${fileName}_verso.png`, versoBlob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true,
        });

      if (versoError) {
        console.error('Erreur upload Verso:', versoError);
        throw versoError;
      }
      console.log('Verso uploadé avec succès');

      const {
        data: { publicUrl: pdfUrl },
      } = supabase.storage
        .from('cartes-professionnelles')
        .getPublicUrl(pdfData.path);

      const {
        data: { publicUrl: rectoUrl },
      } = supabase.storage
        .from('cartes-professionnelles')
        .getPublicUrl(rectoUpload.path);

      const {
        data: { publicUrl: versoUrl },
      } = supabase.storage
        .from('cartes-professionnelles')
        .getPublicUrl(versoUpload.path);

      console.log('URLs publiques générées:', { pdfUrl, rectoUrl, versoUrl });

      return { pdfUrl, rectoUrl, versoUrl };
    } catch (error) {
      console.error(
        'Erreur lors de la génération et upload de la carte:',
        error,
      );
      throw error;
    }
  },

  async generatePreviewDataUrl(
    artisan: Partial<ArtisanMinier>,
    carte: Partial<CarteProfessionnelle>,
  ): Promise<string> {
    const tempArtisan: ArtisanMinier = {
      id: '',
      numero_carte: carte.numero_carte || 'SONASP/AM/2025/000000',
      type_personne: artisan.type_personne || 'physique',
      type_artisan: artisan.type_artisan || 'exploitant',
      nom: artisan.nom || 'NOM',
      prenoms: artisan.prenoms || 'PRÉNOMS',
      telephone: artisan.telephone || '',
      adresse: artisan.adresse || '',
      photo_url: artisan.photo_url,
      region: artisan.region,
      raison_sociale: artisan.raison_sociale,
    };

    const tempCarte: CarteProfessionnelle = {
      id: '',
      artisan_id: '',
      numero_carte: carte.numero_carte || 'SONASP/AM/2025/000000',
      statut: carte.statut || 'en_cours',
      date_delivrance:
        carte.date_delivrance || new Date().toISOString().split('T')[0],
      date_expiration:
        carte.date_expiration ||
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      numero_securite: carte.numero_securite || '0000000000',
      qr_code_data:
        carte.qr_code_data ||
        JSON.stringify({ numero_carte: tempArtisan.numero_carte }),
    };

    return await this.generatePreviewRectoVerso(tempArtisan, tempCarte);
  },

  async generatePreviewRectoVerso(
    artisan: ArtisanMinier,
    carte: CarteProfessionnelle,
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

    const { renderCardPdf } = await import('@/lib/cardPdfPreview');
    const [recto, verso] = await Promise.all([
      renderCardPdf(rectoData, cardWidthPx),
      renderCardPdf(versoData, cardWidthPx),
    ]);
    ctx.drawImage(recto, 0, 50, cardWidthPx, cardHeightPx);
    ctx.drawImage(verso, cardWidthPx + gap, 50, cardWidthPx, cardHeightPx);
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RECTO · APERÇU', cardWidthPx / 2, 35);
    ctx.fillText('VERSO · APERÇU', cardWidthPx + gap + cardWidthPx / 2, 35);
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText(
      `Aperçu sans valeur de délivrance · Carte N° : ${carte.numero_carte}`,
      canvas.width / 2,
      cardHeightPx + 80,
    );
    return canvas.toDataURL('image/png');
  },
};
