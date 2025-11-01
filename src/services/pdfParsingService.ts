import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface ParsedPDFData {
  text: string;
  pageCount: number;
  confidence: number;
}

/**
 * Extract text from PDF file using pdf.js
 */
export async function extractTextFromPDF(file: File): Promise<ParsedPDFData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: typedArray });
    const pdf = await loadingTask.promise;
    
    const pageCount = pdf.numPages;
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }
    
    // Calculate confidence based on text length and structure
    const confidence = calculateConfidence(fullText);
    
    return {
      text: fullText,
      pageCount,
      confidence
    };
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Failed to extract text from PDF: ' + (error as Error).message);
  }
}

/**
 * Calculate parsing confidence based on extracted text
 */
function calculateConfidence(text: string): number {
  let confidence = 0.0;
  
  // Check for minimum text length
  if (text.length > 100) confidence += 0.2;
  if (text.length > 500) confidence += 0.1;
  
  // Check for key terms
  const keyTerms = [
    /certificate/i,
    /assay/i,
    /laboratory/i,
    /gold|au/i,
    /sample/i,
    /analysis/i
  ];
  
  keyTerms.forEach(term => {
    if (term.test(text)) confidence += 0.1;
  });
  
  // Check for numeric values
  if (/\d+\.?\d*\s*(?:g\/t|gpt|ppm|%)/i.test(text)) {
    confidence += 0.15;
  }
  
  // Check for dates
  if (/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(text)) {
    confidence += 0.05;
  }
  
  return Math.min(confidence, 1.0);
}

/**
 * Extract assay data patterns from text
 */
export interface ExtractedAssayData {
  certificateNumber: string | null;
  certificateDate: string | null;
  laboratoryName: string | null;
  sampleId: string | null;
  sampleWeight: number | null;
  
  goldContent: {
    ppm: number | null;
    gpt: number | null;
    percent: number | null;
  };
  
  silverContent: {
    ppm: number | null;
    gpt: number | null;
    percent: number | null;
  };
  
  platinumPpm: number | null;
  palladiumPpm: number | null;
  
  fineness: number | null;
  purity: number | null;
  
  deleteriousElements: {
    arsenic?: number;
    mercury?: number;
    lead?: number;
    antimony?: number;
    bismuth?: number;
    cadmium?: number;
  };
  
  baseMetals: {
    copper?: number;
    iron?: number;
    zinc?: number;
    nickel?: number;
  };
  
  confidence: number;
}

export function extractAssayData(text: string): ExtractedAssayData {
  const data: ExtractedAssayData = {
    certificateNumber: null,
    certificateDate: null,
    laboratoryName: null,
    sampleId: null,
    sampleWeight: null,
    goldContent: { ppm: null, gpt: null, percent: null },
    silverContent: { ppm: null, gpt: null, percent: null },
    platinumPpm: null,
    palladiumPpm: null,
    fineness: null,
    purity: null,
    deleteriousElements: {},
    baseMetals: {},
    confidence: 0
  };
  
  let fieldsFound = 0;
  
  // Certificate Number
  const certPatterns = [
    /certificate\s+(?:no|number|#)[:\s]+([A-Z0-9\/-]+)/i,
    /cert[.:\s]+([A-Z0-9\/-]+)/i,
    /report\s+(?:no|number)[:\s]+([A-Z0-9\/-]+)/i,
    /reference[:\s]+([A-Z0-9\/-]+)/i
  ];
  
  for (const pattern of certPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.certificateNumber = match[1].trim();
      fieldsFound++;
      break;
    }
  }
  
  // Date
  const datePatterns = [
    /date[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/,
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.certificateDate = match[1];
      fieldsFound++;
      break;
    }
  }
  
  // Laboratory
  const labPatterns = [
    /laboratory[:\s]+([^\n]{3,50})/i,
    /lab[:\s]+([^\n]{3,50})/i,
    /analyzed\s+by[:\s]+([^\n]{3,50})/i
  ];
  
  for (const pattern of labPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.laboratoryName = match[1].trim().split(/[,.\n]/)[0];
      fieldsFound++;
      break;
    }
  }
  
  // Sample ID
  const samplePattern = /sample\s+(?:id|no|number)[:\s]+([A-Z0-9\/-]+)/i;
  const sampleMatch = text.match(samplePattern);
  if (sampleMatch) {
    data.sampleId = sampleMatch[1].trim();
    fieldsFound++;
  }
  
  // Sample Weight
  const weightPatterns = [
    /(?:sample\s+)?weight[:\s]+(\d+\.?\d*)\s*(?:g|grams)/i,
    /mass[:\s]+(\d+\.?\d*)\s*(?:g|grams)/i
  ];
  
  for (const pattern of weightPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.sampleWeight = parseFloat(match[1]);
      fieldsFound++;
      break;
    }
  }
  
  // Gold Content
  const goldPatterns = [
    /(?:gold|au)[:\s]+(\d+\.?\d*)\s*(?:g\/t|gpt)/i,
    /(?:gold|au)[:\s]+(\d+\.?\d*)\s*ppm/i,
    /(?:gold|au)[:\s]+(\d+\.?\d*)\s*%/i
  ];
  
  goldPatterns.forEach((pattern, index) => {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (index === 0) data.goldContent.gpt = value;
      else if (index === 1) data.goldContent.ppm = value;
      else if (index === 2) data.goldContent.percent = value;
      fieldsFound++;
    }
  });
  
  // Silver Content
  const silverPatterns = [
    /(?:silver|ag)[:\s]+(\d+\.?\d*)\s*(?:g\/t|gpt)/i,
    /(?:silver|ag)[:\s]+(\d+\.?\d*)\s*ppm/i,
    /(?:silver|ag)[:\s]+(\d+\.?\d*)\s*%/i
  ];
  
  silverPatterns.forEach((pattern, index) => {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (index === 0) data.silverContent.gpt = value;
      else if (index === 1) data.silverContent.ppm = value;
      else if (index === 2) data.silverContent.percent = value;
      fieldsFound++;
    }
  });
  
  // Platinum
  const ptMatch = text.match(/(?:platinum|pt)[:\s]+(\d+\.?\d*)\s*(?:ppm|g\/t)/i);
  if (ptMatch) {
    data.platinumPpm = parseFloat(ptMatch[1]);
    fieldsFound++;
  }
  
  // Palladium
  const pdMatch = text.match(/(?:palladium|pd)[:\s]+(\d+\.?\d*)\s*(?:ppm|g\/t)/i);
  if (pdMatch) {
    data.palladiumPpm = parseFloat(pdMatch[1]);
    fieldsFound++;
  }
  
  // Fineness
  const finenessMatch = text.match(/fineness[:\s]+(\d+\.?\d*)/i);
  if (finenessMatch) {
    data.fineness = parseFloat(finenessMatch[1]);
    fieldsFound++;
  }
  
  // Purity
  const purityMatch = text.match(/purity[:\s]+(\d+\.?\d*)\s*%/i);
  if (purityMatch) {
    data.purity = parseFloat(purityMatch[1]);
    fieldsFound++;
  }
  
  // Deleterious Elements
  const deleteriousPatterns = {
    arsenic: /(?:arsenic|as)[:\s]+(\d+\.?\d*)/i,
    mercury: /(?:mercury|hg)[:\s]+(\d+\.?\d*)/i,
    lead: /(?:lead|pb)[:\s]+(\d+\.?\d*)/i,
    antimony: /(?:antimony|sb)[:\s]+(\d+\.?\d*)/i,
    bismuth: /(?:bismuth|bi)[:\s]+(\d+\.?\d*)/i,
    cadmium: /(?:cadmium|cd)[:\s]+(\d+\.?\d*)/i
  };
  
  for (const [element, pattern] of Object.entries(deleteriousPatterns)) {
    const match = text.match(pattern);
    if (match) {
      data.deleteriousElements[element as keyof typeof data.deleteriousElements] = parseFloat(match[1]);
      fieldsFound++;
    }
  }
  
  // Base Metals
  const baseMetalPatterns = {
    copper: /(?:copper|cu)[:\s]+(\d+\.?\d*)/i,
    iron: /(?:iron|fe)[:\s]+(\d+\.?\d*)/i,
    zinc: /(?:zinc|zn)[:\s]+(\d+\.?\d*)/i,
    nickel: /(?:nickel|ni)[:\s]+(\d+\.?\d*)/i
  };
  
  for (const [metal, pattern] of Object.entries(baseMetalPatterns)) {
    const match = text.match(pattern);
    if (match) {
      data.baseMetals[metal as keyof typeof data.baseMetals] = parseFloat(match[1]);
      fieldsFound++;
    }
  }
  
  // Calculate confidence
  data.confidence = Math.min(fieldsFound / 15, 1.0);
  
  return data;
}
