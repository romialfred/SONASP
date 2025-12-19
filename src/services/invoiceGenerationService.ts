import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  saleNumber: string;
  saleDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerCountry: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTaxId: string;
  items: Array<{
    description: string;
    batchNumber: string;
    metalType: string;
    quantity: number;
    unit: string;
    fineness: number;
    fineWeight: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  royaltyRate: number;
  royaltyAmount: number;
  freightCost: number;
  otherCosts: number;
  totalAmount: number;
  currency: string;
  paymentTerms: string;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    swiftCode: string;
    iban: string;
  };
  notes: string;
  customerLogoUrl?: string;
  sellerLogoUrl?: string;
  miningCompanyName?: string;
}

async function loadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }

    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

export async function generateInvoicePDF(invoiceData: InvoiceData): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const primaryColor: [number, number, number] = [184, 134, 11];
  const secondaryColor: [number, number, number] = [71, 85, 105];
  const lightGray: [number, number, number] = [245, 245, 245];

  let yPosition = 20;

  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  let logoXPosition = 15;

  if (invoiceData.sellerLogoUrl) {
    try {
      const logoData = await loadImageAsBase64(invoiceData.sellerLogoUrl);
      if (logoData) {
        doc.addImage(logoData, 'PNG', 15, 8, 30, 12);
        logoXPosition = 50;
      }
    } catch (error) {
      console.error('Error loading seller logo:', error);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', logoXPosition, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceData.invoiceNumber, logoXPosition, 28);

  if (invoiceData.miningCompanyName) {
    doc.setFontSize(8);
    doc.text(`From: ${invoiceData.miningCompanyName}`, logoXPosition, 33);
  }

  let customerLogoXPosition = pageWidth - 15;
  if (invoiceData.customerLogoUrl) {
    try {
      const customerLogoData = await loadImageAsBase64(invoiceData.customerLogoUrl);
      if (customerLogoData) {
        doc.addImage(customerLogoData, 'PNG', pageWidth - 45, 8, 30, 12);
        customerLogoXPosition = pageWidth - 50;
      }
    } catch (error) {
      console.error('Error loading customer logo:', error);
    }
  }

  doc.setFontSize(9);
  doc.text('Mansa Resources', customerLogoXPosition, 25, { align: 'right' });
  doc.text(invoiceData.companyAddress, customerLogoXPosition, 30, { align: 'right' });
  doc.text(`Tel: ${invoiceData.companyPhone}`, customerLogoXPosition, 35, { align: 'right' });

  yPosition = 50;

  doc.setFillColor(...lightGray);
  doc.rect(15, yPosition, (pageWidth - 30) / 2 - 5, 35, 'F');
  doc.rect(pageWidth / 2 + 5, yPosition, (pageWidth - 30) / 2 - 5, 35, 'F');

  doc.setTextColor(...secondaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 20, yPosition + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(invoiceData.customerName, 20, yPosition + 14);
  doc.text(invoiceData.customerEmail, 20, yPosition + 19);
  doc.text(invoiceData.customerPhone || '', 20, yPosition + 24);
  doc.text(`${invoiceData.customerAddress}, ${invoiceData.customerCountry}`, 20, yPosition + 29);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('INVOICE DETAILS', pageWidth / 2 + 10, yPosition + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Invoice Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2 + 10, yPosition + 14);
  doc.text(`Due Date: ${new Date(invoiceData.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2 + 10, yPosition + 19);
  doc.text(`Sale Number: ${invoiceData.saleNumber}`, pageWidth / 2 + 10, yPosition + 24);
  doc.text(`Sale Date: ${new Date(invoiceData.saleDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2 + 10, yPosition + 29);

  yPosition += 45;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('LINE ITEMS', 15, yPosition);

  yPosition += 5;

  const tableData = invoiceData.items.map((item) => [
    item.description,
    item.batchNumber,
    `${item.quantity.toFixed(3)} ${item.unit}`,
    `${item.fineness}%`,
    `${item.fineWeight.toFixed(3)} oz`,
    formatCurrency(item.unitPrice, invoiceData.currency),
    formatCurrency(item.total, invoiceData.currency),
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Description', 'Batch #', 'Quantity', 'Fineness', 'Fine Weight', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 25 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: 15, right: 15 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  const summaryX = pageWidth - 80;
  const summaryWidth = 65;

  doc.setDrawColor(...secondaryColor);
  doc.setLineWidth(0.1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...secondaryColor);

  const summaryItems = [
    { label: 'Subtotal:', value: formatCurrency(invoiceData.subtotal, invoiceData.currency) },
  ];

  if (invoiceData.freightCost > 0) {
    summaryItems.push({ label: 'Freight Cost:', value: formatCurrency(invoiceData.freightCost, invoiceData.currency) });
  }

  if (invoiceData.otherCosts > 0) {
    summaryItems.push({ label: 'Other Costs:', value: formatCurrency(invoiceData.otherCosts, invoiceData.currency) });
  }

  if (invoiceData.royaltyAmount > 0) {
    summaryItems.push({
      label: `Royalty (${invoiceData.royaltyRate}%):`,
      value: formatCurrency(invoiceData.royaltyAmount, invoiceData.currency)
    });
  }

  if (invoiceData.taxAmount > 0) {
    summaryItems.push({
      label: `Tax (${invoiceData.taxRate}%):`,
      value: formatCurrency(invoiceData.taxAmount, invoiceData.currency)
    });
  }

  summaryItems.forEach((item, index) => {
    doc.text(item.label, summaryX, yPosition + (index * 6));
    doc.text(item.value, summaryX + summaryWidth, yPosition + (index * 6), { align: 'right' });
  });

  yPosition += summaryItems.length * 6 + 2;

  doc.setFillColor(...primaryColor);
  doc.rect(summaryX - 2, yPosition - 2, summaryWidth + 4, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL AMOUNT:', summaryX, yPosition + 5);
  doc.text(formatCurrency(invoiceData.totalAmount, invoiceData.currency), summaryX + summaryWidth, yPosition + 5, { align: 'right' });

  yPosition += 20;

  if (yPosition > pageHeight - 60) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('PAYMENT TERMS', 15, yPosition);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...secondaryColor);
  yPosition += 6;
  doc.text(invoiceData.paymentTerms, 15, yPosition);

  yPosition += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('BANK DETAILS', 15, yPosition);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...secondaryColor);
  yPosition += 6;
  doc.text(`Bank Name: ${invoiceData.bankDetails.bankName}`, 15, yPosition);
  yPosition += 5;
  doc.text(`Account Number: ${invoiceData.bankDetails.accountNumber}`, 15, yPosition);
  yPosition += 5;
  doc.text(`SWIFT Code: ${invoiceData.bankDetails.swiftCode}`, 15, yPosition);
  yPosition += 5;
  doc.text(`IBAN: ${invoiceData.bankDetails.iban}`, 15, yPosition);

  if (invoiceData.notes) {
    yPosition += 10;

    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('NOTES', 15, yPosition);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...secondaryColor);
    yPosition += 6;
    const splitNotes = doc.splitTextToSize(invoiceData.notes, pageWidth - 30);
    doc.text(splitNotes, 15, yPosition);
  }

  const footerY = pageHeight - 20;
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.5);
  doc.line(15, footerY, pageWidth - 15, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('This is a computer-generated invoice and does not require a signature.', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, footerY + 10, { align: 'center' });
  doc.text(`Tax ID: ${invoiceData.companyTaxId}`, pageWidth / 2, footerY + 15, { align: 'center' });

  return doc.output('blob');
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function generateAndUploadInvoice(
  saleId: string,
  paymentId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        customer:customers!inner(
          name,
          email,
          phone,
          address,
          country,
          contact_person
        )
      `)
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      throw new Error('Sale not found');
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error('Payment not found');
    }

    const { data: lineItems, error: lineItemsError } = await supabase
      .from('sale_line_items')
      .select(`
        *,
        batch:batches(batch_number)
      `)
      .eq('sale_id', saleId);

    if (lineItemsError) {
      console.error('Error fetching line items:', lineItemsError);
    }

    const invoiceNumber = `INV-${sale.sale_number}-${new Date().getFullYear()}`;
    const invoiceDate = payment.actual_date || payment.expected_date || new Date().toISOString();
    const dueDate = new Date(new Date(invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const items = (lineItems || []).map((item: any) => ({
      description: `${item.metal_type} - Fine Gold`,
      batchNumber: item.batch?.batch_number || 'N/A',
      metalType: item.metal_type,
      quantity: item.quantity_oz,
      unit: 'oz',
      fineness: item.fineness_percentage || 99.9,
      fineWeight: item.fine_weight_oz,
      unitPrice: item.unit_price,
      total: item.line_total,
    }));

    const royaltyRate = 3;
    const royaltyAmount = (sale.final_proceeds || 0) * (royaltyRate / 100);

    const invoiceData: InvoiceData = {
      invoiceNumber,
      invoiceDate,
      dueDate,
      saleNumber: sale.sale_number,
      saleDate: sale.sale_date,
      customerName: sale.customer?.name || 'Unknown Customer',
      customerEmail: sale.customer?.email || '',
      customerPhone: sale.customer?.phone || '',
      customerAddress: sale.customer?.address || '',
      customerCountry: sale.customer?.country || '',
      companyName: 'Mansa Resources',
      companyAddress: 'Conakry, Guinea',
      companyPhone: '+224 123 456 789',
      companyEmail: 'info@mansaresources.com',
      companyTaxId: 'GN-TAX-123456789',
      items,
      subtotal: sale.gross_proceeds || 0,
      taxRate: 0,
      taxAmount: 0,
      royaltyRate,
      royaltyAmount,
      freightCost: sale.freight_cost || 0,
      otherCosts: sale.other_costs || 0,
      totalAmount: sale.final_proceeds || 0,
      currency: sale.currency || 'USD',
      paymentTerms: 'Payment due within 30 days of invoice date. Late payments may incur additional charges.',
      bankDetails: {
        bankName: 'International Bank of Commerce',
        accountNumber: '****1234',
        swiftCode: 'IBCGNGNA',
        iban: 'GN89 1234 5678 9012 3456 7890',
      },
      notes: payment.notes || 'Thank you for your business. For any questions regarding this invoice, please contact our finance department.',
    };

    const pdfBlob = await generateInvoicePDF(invoiceData);

    const fileName = `${invoiceNumber}.pdf`;
    const filePath = `invoices/${saleId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    return {
      success: true,
      url: urlData.publicUrl,
    };

  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate invoice',
    };
  }
}
