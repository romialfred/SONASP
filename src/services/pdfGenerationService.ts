import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
  title: string;
  period: string;
  generatedDate: string;
  sections: ReportSection[];
  insights: string[];
  recommendations: string[];
}

interface ReportSection {
  title: string;
  type: 'metrics' | 'table' | 'text';
  data: any;
}

export class PDFGenerationService {
  private doc: jsPDF;
  private currentY: number = 0;
  private pageHeight: number = 297;
  private margin: number = 20;

  constructor() {
    this.doc = new jsPDF();
    this.currentY = this.margin;
  }

  generateExecutiveSummary(): void {
    const data: ReportData = {
      title: 'Executive Summary Report',
      period: 'January - December 2025',
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      sections: [
        {
          title: 'Key Performance Indicators',
          type: 'metrics',
          data: [
            { metric: 'Total Revenue', value: '$9,945,000', change: '+24%', status: 'Good' },
            { metric: 'Active Customers', value: '18', change: '+20%', status: 'Good' },
            { metric: 'Batches Processed', value: '337', change: '+18%', status: 'Good' },
            { metric: 'Average Processing Time', value: '4.3 days', change: '-12%', status: 'Good' },
            { metric: 'Customer Retention Rate', value: '94%', change: '+2%', status: 'Excellent' },
            { metric: 'Profit Margin', value: '18.5%', change: '+2.3%', status: 'Good' }
          ]
        },
        {
          title: 'Revenue Breakdown by Quarter',
          type: 'table',
          data: {
            headers: ['Quarter', 'Revenue', 'Growth', 'Batches', 'Avg Price/oz'],
            rows: [
              ['Q1 2025', '$2,145,000', '+18%', '78', '$2,410'],
              ['Q2 2025', '$2,380,000', '+22%', '82', '$2,430'],
              ['Q3 2025', '$2,520,000', '+26%', '88', '$2,450'],
              ['Q4 2025', '$2,900,000', '+28%', '89', '$2,470']
            ]
          }
        }
      ],
      insights: [
        'Strong revenue growth of 24% year-over-year driven by volume increase and improved pricing',
        'Customer retention rate at 94% indicates excellent relationship management',
        'Processing efficiency improved by 12% through operational optimization',
        'Q4 showed strongest performance with 28% growth, indicating positive momentum'
      ],
      recommendations: [
        'Continue focus on customer retention programs to maintain 94%+ retention',
        'Invest in additional processing capacity to handle growing demand',
        'Explore opportunities to reduce processing time further below 4 days',
        'Develop strategic partnerships with top 3 customers for volume growth'
      ]
    };

    this.createCoverPage(data.title, data.period, data.generatedDate);
    this.addNewPage();
    this.addExecutiveSummaryPage(data);
    this.addNewPage();
    this.addDetailedAnalysisPage(data);
    this.addNewPage();
    this.addInsightsAndRecommendations(data);
    this.addFooters();
  }

  generateSalesPerformance(): void {
    const data: ReportData = {
      title: 'Sales Performance Report',
      period: 'January - December 2025',
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      sections: [
        {
          title: 'Sales Pipeline Health',
          type: 'metrics',
          data: [
            { metric: 'Pipeline Value', value: '$4.2M', change: '+32%', status: 'Good' },
            { metric: 'Conversion Rate', value: '68%', change: '+5%', status: 'Good' },
            { metric: 'Average Deal Size', value: '$124,500', change: '+8%', status: 'Good' },
            { metric: 'Sales Cycle', value: '18 days', change: '-3 days', status: 'Good' }
          ]
        },
        {
          title: 'Top Customers by Revenue',
          type: 'table',
          data: {
            headers: ['Customer', 'Revenue', 'Volume (oz)', 'Avg Price', 'Growth'],
            rows: [
              ['Auramet Trading LLC', '$3,245,000', '1,340', '$2,420', '+28%'],
              ['StoneX Bullion', '$2,890,000', '1,195', '$2,418', '+22%'],
              ['Asahi Refining', '$1,680,000', '695', '$2,417', '+18%'],
              ['Metalor Technologies', '$1,245,000', '515', '$2,417', '+15%'],
              ['PAMP Suisse', '$885,000', '365', '$2,425', '+12%']
            ]
          }
        }
      ],
      insights: [
        'Sales pipeline grew 32% with strong conversion rate of 68%',
        'Top 5 customers represent 78% of total revenue, indicating concentration risk',
        'Average deal size increased 8% due to larger order volumes',
        'Sales cycle reduced by 3 days through improved customer engagement'
      ],
      recommendations: [
        'Diversify customer base to reduce concentration risk below 70%',
        'Implement tiered pricing strategy to incentivize larger orders',
        'Focus on mid-tier customers to grow their share of revenue',
        'Develop automated follow-up system to further reduce sales cycle'
      ]
    };

    this.createCoverPage(data.title, data.period, data.generatedDate);
    this.addNewPage();
    this.addExecutiveSummaryPage(data);
    this.addNewPage();
    this.addDetailedAnalysisPage(data);
    this.addNewPage();
    this.addInsightsAndRecommendations(data);
    this.addFooters();
  }

  generateBatchOperations(): void {
    const data: ReportData = {
      title: 'Batch Operations Report',
      period: 'January - December 2025',
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      sections: [
        {
          title: 'Processing Efficiency Metrics',
          type: 'metrics',
          data: [
            { metric: 'Total Batches', value: '337', change: '+18%', status: 'Good' },
            { metric: 'On-Time Processing', value: '94%', change: '+3%', status: 'Good' },
            { metric: 'Quality Score', value: '96.8%', change: '+1.2%', status: 'Excellent' },
            { metric: 'Avg Cycle Time', value: '4.3 days', change: '-12%', status: 'Good' }
          ]
        },
        {
          title: 'Processing Performance by Site',
          type: 'table',
          data: {
            headers: ['Site', 'Batches', 'Avg Time', 'Quality', 'Variance'],
            rows: [
              ['Guinea Factory', '145', '4.1 days', '97.2%', '0.8%'],
              ['Mali Factory', '112', '4.3 days', '96.8%', '1.1%'],
              ['Côte d\'Ivoire Factory', '80', '4.6 days', '96.2%', '1.3%']
            ]
          }
        }
      ],
      insights: [
        'Batch processing increased 18% while maintaining quality above 96%',
        'Guinea factory demonstrates best performance with 4.1 day cycle time',
        'Quality variance remains well within acceptable limits across all sites',
        'On-time processing improved to 94% through better coordination'
      ],
      recommendations: [
        'Share Guinea factory best practices with other sites to standardize excellence',
        'Invest in additional refining capacity at Côte d\'Ivoire site',
        'Implement predictive maintenance to maintain quality improvements',
        'Target 95%+ on-time processing through enhanced scheduling systems'
      ]
    };

    this.createCoverPage(data.title, data.period, data.generatedDate);
    this.addNewPage();
    this.addExecutiveSummaryPage(data);
    this.addNewPage();
    this.addDetailedAnalysisPage(data);
    this.addNewPage();
    this.addInsightsAndRecommendations(data);
    this.addFooters();
  }

  generateCustomerAnalysis(): void {
    const data: ReportData = {
      title: 'Customer Analysis Report',
      period: 'January - December 2025',
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      sections: [
        {
          title: 'Customer Relationship Metrics',
          type: 'metrics',
          data: [
            { metric: 'Active Customers', value: '18', change: '+20%', status: 'Good' },
            { metric: 'Retention Rate', value: '94%', change: '+2%', status: 'Excellent' },
            { metric: 'Avg Payment Time', value: '3.2 days', change: '-0.5 days', status: 'Good' },
            { metric: 'Customer LTV', value: '$552,500', change: '+15%', status: 'Good' }
          ]
        },
        {
          title: 'Customer Segmentation',
          type: 'table',
          data: {
            headers: ['Segment', 'Customers', '% Revenue', 'Avg Order', 'Frequency'],
            rows: [
              ['Platinum (>$1M)', '5', '62%', '$238,000', '12/year'],
              ['Gold ($500K-$1M)', '4', '23%', '$142,000', '8/year'],
              ['Silver ($100K-$500K)', '6', '12%', '$52,000', '5/year'],
              ['Bronze (<$100K)', '3', '3%', '$28,000', '3/year']
            ]
          }
        }
      ],
      insights: [
        'Top tier customers (Platinum) drive 62% of revenue with high frequency orders',
        'Customer lifetime value increased 15% through better retention strategies',
        'Payment behavior improved with average settlement time under 3.5 days',
        'Strong retention rate of 94% indicates excellent customer satisfaction'
      ],
      recommendations: [
        'Develop loyalty program for Platinum customers to maintain high engagement',
        'Focus growth efforts on upgrading Silver customers to Gold tier',
        'Implement early warning system for at-risk customer relationships',
        'Expand customer base in Bronze tier to diversify revenue sources'
      ]
    };

    this.createCoverPage(data.title, data.period, data.generatedDate);
    this.addNewPage();
    this.addExecutiveSummaryPage(data);
    this.addNewPage();
    this.addDetailedAnalysisPage(data);
    this.addNewPage();
    this.addInsightsAndRecommendations(data);
    this.addFooters();
  }

  generateFinancialAnalysis(): void {
    const data: ReportData = {
      title: 'Financial Analysis Report',
      period: 'January - December 2025',
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      sections: [
        {
          title: 'Financial Performance Metrics',
          type: 'metrics',
          data: [
            { metric: 'Total Revenue', value: '$9,945,000', change: '+24%', status: 'Good' },
            { metric: 'Gross Margin', value: '22.3%', change: '+1.8%', status: 'Good' },
            { metric: 'Net Profit', value: '$1,839,825', change: '+28%', status: 'Good' },
            { metric: 'Operating Cash Flow', value: '$2,145,000', change: '+22%', status: 'Good' }
          ]
        },
        {
          title: 'Profit & Loss Statement Summary',
          type: 'table',
          data: {
            headers: ['Category', 'Amount', '% Revenue', 'YoY Change'],
            rows: [
              ['Revenue', '$9,945,000', '100%', '+24%'],
              ['Cost of Goods Sold', '$7,725,000', '77.7%', '+23%'],
              ['Gross Profit', '$2,220,000', '22.3%', '+28%'],
              ['Operating Expenses', '$248,625', '2.5%', '+8%'],
              ['Net Profit', '$1,839,825', '18.5%', '+32%']
            ]
          }
        }
      ],
      insights: [
        'Revenue growth of 24% exceeded industry average of 18%',
        'Gross margin improved 1.8% through operational efficiencies',
        'Net profit margin at 18.5% demonstrates strong profitability',
        'Operating cash flow remains healthy with 22% growth'
      ],
      recommendations: [
        'Continue cost optimization initiatives to maintain margin improvements',
        'Evaluate pricing strategy to capture additional value from market conditions',
        'Invest surplus cash flow in capacity expansion for continued growth',
        'Monitor FX exposure and implement hedging strategies where appropriate'
      ]
    };

    this.createCoverPage(data.title, data.period, data.generatedDate);
    this.addNewPage();
    this.addExecutiveSummaryPage(data);
    this.addNewPage();
    this.addDetailedAnalysisPage(data);
    this.addNewPage();
    this.addInsightsAndRecommendations(data);
    this.addFooters();
  }

  generateOperationsReport(): void {
    const data: ReportData = {
      title: 'Operations Performance Report',
      period: 'January - December 2025',
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      sections: [
        {
          title: 'Operational Efficiency Metrics',
          type: 'metrics',
          data: [
            { metric: 'Overall Efficiency', value: '92.4%', change: '+4.2%', status: 'Good' },
            { metric: 'Resource Utilization', value: '88.5%', change: '+3.5%', status: 'Good' },
            { metric: 'Cost per Batch', value: '$22,920', change: '-8%', status: 'Good' },
            { metric: 'Revenue per Employee', value: '$552,500', change: '+18%', status: 'Good' }
          ]
        },
        {
          title: 'Key Operational Indicators',
          type: 'table',
          data: {
            headers: ['Metric', 'Target', 'Actual', 'Performance', 'Trend'],
            rows: [
              ['Processing Time', '4.5 days', '4.3 days', '104.7%', 'Improving'],
              ['Quality Score', '95%', '96.8%', '101.9%', 'Improving'],
              ['On-Time Delivery', '90%', '94%', '104.4%', 'Improving'],
              ['Cost Efficiency', '$24,000', '$22,920', '104.5%', 'Improving'],
              ['Capacity Utilization', '85%', '88.5%', '104.1%', 'Stable']
            ]
          }
        }
      ],
      insights: [
        'Operational efficiency improved 4.2% through process optimization',
        'All key metrics exceed targets, demonstrating operational excellence',
        'Cost per batch reduced 8% while maintaining quality standards',
        'Resource utilization at optimal level of 88.5%'
      ],
      recommendations: [
        'Document and standardize best practices across all operational sites',
        'Invest in automation to further reduce processing time and costs',
        'Implement continuous improvement program to maintain momentum',
        'Monitor capacity utilization to identify optimal expansion timing'
      ]
    };

    this.createCoverPage(data.title, data.period, data.generatedDate);
    this.addNewPage();
    this.addExecutiveSummaryPage(data);
    this.addNewPage();
    this.addDetailedAnalysisPage(data);
    this.addNewPage();
    this.addInsightsAndRecommendations(data);
    this.addFooters();
  }

  private createCoverPage(title: string, period: string, generatedDate: string): void {
    this.doc.setFillColor(184, 134, 11);
    this.doc.rect(0, 0, 210, 297, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(36);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Mansa Resources', 105, 80, { align: 'center' });

    this.doc.setFontSize(28);
    this.doc.text(title, 105, 120, { align: 'center' });

    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(period, 105, 145, { align: 'center' });

    this.doc.setFontSize(12);
    this.doc.text(`Generated: ${generatedDate}`, 105, 260, { align: 'center' });

    this.doc.setFontSize(10);
    this.doc.text('CONFIDENTIAL - For Management Use Only', 105, 280, { align: 'center' });
  }

  private addExecutiveSummaryPage(data: ReportData): void {
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Executive Summary', this.margin, this.currentY);

    this.currentY += 15;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');

    const summaryText = `This report provides a comprehensive analysis of ${data.title.toLowerCase()} for the period ${data.period}. The analysis includes key performance indicators, detailed metrics, trends, and strategic recommendations for Direction Générale.`;

    const splitText = this.doc.splitTextToSize(summaryText, 170);
    this.doc.text(splitText, this.margin, this.currentY);
    this.currentY += splitText.length * 5 + 10;

    if (data.sections[0]?.type === 'metrics') {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(data.sections[0].title, this.margin, this.currentY);
      this.currentY += 10;

      autoTable(this.doc, {
        startY: this.currentY,
        head: [['Metric', 'Value', 'Change', 'Status']],
        body: data.sections[0].data.map((m: any) => [m.metric, m.value, m.change, m.status]),
        theme: 'striped',
        headStyles: { fillColor: [184, 134, 11], textColor: 255 },
        margin: { left: this.margin },
        styles: { fontSize: 9 }
      });

      this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    }
  }

  private addDetailedAnalysisPage(data: ReportData): void {
    this.currentY = this.margin;

    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Detailed Analysis', this.margin, this.currentY);
    this.currentY += 15;

    for (const section of data.sections.slice(1)) {
      if (this.currentY > this.pageHeight - 60) {
        this.addNewPage();
      }

      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(section.title, this.margin, this.currentY);
      this.currentY += 10;

      if (section.type === 'table' && section.data.headers && section.data.rows) {
        autoTable(this.doc, {
          startY: this.currentY,
          head: [section.data.headers],
          body: section.data.rows,
          theme: 'striped',
          headStyles: { fillColor: [71, 85, 105], textColor: 255 },
          margin: { left: this.margin },
          styles: { fontSize: 9 }
        });

        this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
      }
    }
  }

  private addInsightsAndRecommendations(data: ReportData): void {
    this.currentY = this.margin;

    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Key Insights & Recommendations', this.margin, this.currentY);
    this.currentY += 15;

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Strategic Insights', this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');

    data.insights.forEach((insight, index) => {
      if (this.currentY > this.pageHeight - 30) {
        this.addNewPage();
      }

      const bulletText = `${index + 1}. ${insight}`;
      const splitText = this.doc.splitTextToSize(bulletText, 165);
      this.doc.text(splitText, this.margin + 5, this.currentY);
      this.currentY += splitText.length * 5 + 3;
    });

    this.currentY += 10;

    if (this.currentY > this.pageHeight - 60) {
      this.addNewPage();
    }

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Strategic Recommendations', this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');

    data.recommendations.forEach((rec, index) => {
      if (this.currentY > this.pageHeight - 30) {
        this.addNewPage();
      }

      const bulletText = `${index + 1}. ${rec}`;
      const splitText = this.doc.splitTextToSize(bulletText, 165);
      this.doc.text(splitText, this.margin + 5, this.currentY);
      this.currentY += splitText.length * 5 + 3;
    });
  }

  private addNewPage(): void {
    this.doc.addPage();
    this.currentY = this.margin;
  }

  private addFooters(): void {
    const pageCount = this.doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);

      if (i > 1) {
        this.doc.setFontSize(8);
        this.doc.setTextColor(128, 128, 128);
        this.doc.text(
          `Page ${i} of ${pageCount}`,
          105,
          this.pageHeight - 10,
          { align: 'center' }
        );

        this.doc.text(
          'Mansa Resources - Confidential',
          this.margin,
          this.pageHeight - 10
        );

        this.doc.text(
          new Date().toLocaleDateString(),
          210 - this.margin,
          this.pageHeight - 10,
          { align: 'right' }
        );
      }
    }
  }

  public save(filename: string): void {
    this.doc.save(filename);
  }

  public getBlob(): Blob {
    return this.doc.output('blob');
  }
}

export const generatePDF = (reportType: string): void => {
  const service = new PDFGenerationService();

  switch (reportType) {
    case 'executive':
      service.generateExecutiveSummary();
      break;
    case 'sales':
      service.generateSalesPerformance();
      break;
    case 'batch':
      service.generateBatchOperations();
      break;
    case 'customer':
      service.generateCustomerAnalysis();
      break;
    case 'financial':
      service.generateFinancialAnalysis();
      break;
    case 'operations':
      service.generateOperationsReport();
      break;
    default:
      service.generateExecutiveSummary();
  }

  const filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`;
  service.save(filename);
};
