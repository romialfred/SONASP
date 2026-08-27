import { jsPDF } from 'jspdf';
import { formatCurrency } from '@/utils/salesUtils';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;

  // Seller Information
  sellerName: string;
  sellerAddress: string;
  sellerCity: string;
  sellerCountry: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerTaxId?: string;
  sellerLogoUrl?: string;

  // Customer Information
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerCountry: string;
  customerPhone?: string;
  customerEmail?: string;
  customerTaxId?: string;
  customerLogoUrl?: string;

  // Sale Details
  quantityOz: number;
  quantityGrams: number;
  pricePerOz: number;
  currency: string;

  // Pricing Details
  grossProceeds: number;
  freightCost: number;
  otherCosts: number;
  netProceeds: number;
  royaltiesPercentage: number;
  royaltiesAmount: number;
  finalAmount: number;

  // Additional Info
  mechanismType?: string;
  mechanismDisplayName?: string;
  paymentTerms?: string;
  notes?: string;
}

export async function generateSaleInvoicePDF(invoiceData: InvoiceData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Colors - Professional palette matching application design
  const primaryColor: [number, number, number] = [184, 134, 11]; // Deep Gold #B8860B
  const secondaryColor: [number, number, number] = [71, 85, 105]; // Slate Blue
  const textColor: [number, number, number] = [31, 41, 55]; // Gray-800
  const lightGray: [number, number, number] = [243, 244, 246]; // Gray-100

  // ===== HEADER WITH LOGOS =====
  // Top border
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 8, 'F');

  yPosition = 20;

  // Company Logos Section
  const logoSize = 25;
  const logoY = yPosition;

  // Seller Logo (Left)
  if (invoiceData.sellerLogoUrl) {
    try {
      doc.addImage(invoiceData.sellerLogoUrl, 'PNG', margin, logoY, logoSize, logoSize);
    } catch (error) {
      console.warn('Could not load seller logo');
    }
  } else {
    // Placeholder for seller logo
    doc.setFillColor(...lightGray);
    doc.rect(margin, logoY, logoSize, logoSize, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...secondaryColor);
    doc.text('SELLER', margin + logoSize / 2, logoY + logoSize / 2, { align: 'center' });
  }

  // Customer Logo (Right)
  const customerLogoX = pageWidth - margin - logoSize;
  if (invoiceData.customerLogoUrl) {
    try {
      doc.addImage(invoiceData.customerLogoUrl, 'PNG', customerLogoX, logoY, logoSize, logoSize);
    } catch (error) {
      console.warn('Could not load customer logo');
    }
  } else {
    // Placeholder for customer logo
    doc.setFillColor(...lightGray);
    doc.rect(customerLogoX, logoY, logoSize, logoSize, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...secondaryColor);
    doc.text('CUSTOMER', customerLogoX + logoSize / 2, logoY + logoSize / 2, { align: 'center' });
  }

  yPosition = logoY + logoSize + 15;

  // ===== INVOICE TITLE =====
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('INVOICE', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text(`Invoice #: ${invoiceData.invoiceNumber}`, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 5;
  doc.text(`Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}`, pageWidth / 2, yPosition, { align: 'center' });

  if (invoiceData.mechanismDisplayName) {
    yPosition += 5;
    doc.setFontSize(9);
    doc.setTextColor(...secondaryColor);
    doc.text(`Pricing Mechanism: ${invoiceData.mechanismDisplayName}`, pageWidth / 2, yPosition, { align: 'center' });
  }

  yPosition += 12;

  // ===== SELLER & CUSTOMER INFORMATION =====
  const columnWidth = (pageWidth - 3 * margin) / 2;

  // Seller Information Box
  doc.setFillColor(...lightGray);
  doc.rect(margin, yPosition, columnWidth, 35, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('FROM (SELLER)', margin + 3, yPosition + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(invoiceData.sellerName, margin + 3, yPosition + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(invoiceData.sellerAddress, margin + 3, yPosition + 16);
  doc.text(`${invoiceData.sellerCity}, ${invoiceData.sellerCountry}`, margin + 3, yPosition + 20);

  if (invoiceData.sellerEmail) {
    doc.text(`Email: ${invoiceData.sellerEmail}`, margin + 3, yPosition + 24);
  }
  if (invoiceData.sellerPhone) {
    doc.text(`Phone: ${invoiceData.sellerPhone}`, margin + 3, yPosition + 28);
  }
  if (invoiceData.sellerTaxId) {
    doc.text(`Tax ID: ${invoiceData.sellerTaxId}`, margin + 3, yPosition + 32);
  }

  // Customer Information Box
  const customerBoxX = pageWidth - margin - columnWidth;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.rect(customerBoxX, yPosition, columnWidth, 35, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('TO (CUSTOMER)', customerBoxX + 3, yPosition + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(invoiceData.customerName, customerBoxX + 3, yPosition + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(invoiceData.customerAddress, customerBoxX + 3, yPosition + 16);
  doc.text(`${invoiceData.customerCity}, ${invoiceData.customerCountry}`, customerBoxX + 3, yPosition + 20);

  if (invoiceData.customerEmail) {
    doc.text(`Email: ${invoiceData.customerEmail}`, customerBoxX + 3, yPosition + 24);
  }
  if (invoiceData.customerPhone) {
    doc.text(`Phone: ${invoiceData.customerPhone}`, customerBoxX + 3, yPosition + 28);
  }
  if (invoiceData.customerTaxId) {
    doc.text(`Tax ID: ${invoiceData.customerTaxId}`, customerBoxX + 3, yPosition + 32);
  }

  yPosition += 45;

  // ===== LINE ITEMS TABLE =====
  const tableData = [
    ['Product/Service', 'Quantity', 'Unit Price', 'Amount'],
    [
      'Fine Gold',
      `${invoiceData.quantityOz.toFixed(3)} oz\n(${invoiceData.quantityGrams.toFixed(2)} g)`,
      `${formatCurrency(invoiceData.pricePerOz)}/oz`,
      formatCurrency(invoiceData.grossProceeds)
    ]
  ];

  doc.autoTable({
    startY: yPosition,
    head: [tableData[0]],
    body: [tableData[1]],
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 60 },
      1: { halign: 'center', cellWidth: 40 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 40 }
    },
    margin: { left: margin, right: margin }
  });

  yPosition = doc.lastAutoTable.finalY + 10;

  // ===== CALCULATION BREAKDOWN =====
  const calculationsX = pageWidth - margin - 70;
  const labelX = calculationsX - 60;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);

  // Gross Proceeds
  doc.setFont('helvetica', 'bold');
  doc.text('Gross Proceeds:', labelX, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(invoiceData.grossProceeds), calculationsX, yPosition, { align: 'right' });
  yPosition += 6;

  // Freight Cost
  if (invoiceData.freightCost > 0) {
    doc.setTextColor(...secondaryColor);
    doc.text('Freight Cost:', labelX, yPosition);
    doc.text(`-${formatCurrency(invoiceData.freightCost)}`, calculationsX, yPosition, { align: 'right' });
    yPosition += 6;
  }

  // Other Costs
  if (invoiceData.otherCosts > 0) {
    doc.setTextColor(...secondaryColor);
    doc.text('Other Costs:', labelX, yPosition);
    doc.text(`-${formatCurrency(invoiceData.otherCosts)}`, calculationsX, yPosition, { align: 'right' });
    yPosition += 6;
  }

  // Net Proceeds (subtotal line)
  doc.setDrawColor(...secondaryColor);
  doc.setLineWidth(0.3);
  doc.line(labelX, yPosition, calculationsX, yPosition);
  yPosition += 5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text('Net Proceeds:', labelX, yPosition);
  doc.text(formatCurrency(invoiceData.netProceeds), calculationsX, yPosition, { align: 'right' });
  yPosition += 8;

  // Royalties
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  doc.text(`Royalties (${invoiceData.royaltiesPercentage}%):`, labelX, yPosition);
  doc.text(`-${formatCurrency(invoiceData.royaltiesAmount)}`, calculationsX, yPosition, { align: 'right' });
  yPosition += 6;

  // Total line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.8);
  doc.line(labelX, yPosition, calculationsX, yPosition);
  yPosition += 6;

  // Final Amount
  doc.setFillColor(...primaryColor);
  doc.rect(labelX - 2, yPosition - 5, calculationsX - labelX + 2, 10, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL AMOUNT:', labelX, yPosition);
  doc.text(formatCurrency(invoiceData.finalAmount), calculationsX, yPosition, { align: 'right' });

  yPosition += 15;

  // ===== PAYMENT TERMS =====
  if (invoiceData.paymentTerms) {
    doc.setFillColor(...lightGray);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 12, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('PAYMENT TERMS:', margin + 3, yPosition + 4);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(invoiceData.paymentTerms, margin + 3, yPosition + 8);

    yPosition += 15;
  }

  // ===== NOTES =====
  if (invoiceData.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryColor);
    doc.text('NOTES:', margin, yPosition);
    yPosition += 4;

    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(invoiceData.notes, pageWidth - 2 * margin);
    doc.text(notesLines, margin, yPosition);
    yPosition += notesLines.length * 4;
  }

  // ===== FOOTER =====
  const footerY = pageHeight - 20;
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFontSize(7);
  doc.setTextColor(...secondaryColor);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'This invoice is generated electronically and is valid without signature.',
    pageWidth / 2,
    footerY + 4,
    { align: 'center' }
  );
  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-US')} | Page 1 of 1`,
    pageWidth / 2,
    footerY + 8,
    { align: 'center' }
  );

  // Bottom border
  doc.setFillColor(...primaryColor);
  doc.rect(0, pageHeight - 5, pageWidth, 5, 'F');

  return doc.output('blob');
}
/*
 * Le televersement des factures a ete retire, deliberement.
 *
 * L'ancien code deposait le PDF dans un bucket 'sale-documents' et en
 * publiait l'URL PUBLIQUE PERMANENTE via getPublicUrl : quiconque possedait
 * l'URL lisait la facture sans authentification. Le chemin etait d'ailleurs
 * mort de bout en bout : aucun appelant, bucket inexistant, colonnes
 * invoice_pdf_path/invoice_pdf_url absentes de la table sales.
 *
 * Si l'archivage des factures devient un besoin, il passe par la table
 * sales_documents, le profil 'sensitive-upload' et le garde
 * snp_storage_can_read_object — jamais par une URL publique.
 */

export function downloadInvoicePDF(pdfBlob: Blob, invoiceNumber: string) {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Invoice_${invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
