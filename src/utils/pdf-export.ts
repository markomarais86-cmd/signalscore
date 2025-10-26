import jsPDF from 'jspdf';
import { formatCurrency } from './tam-calculator';

interface TAMExportData {
  totalAccounts: number;
  highSignalAccounts: number;
  qualifiedLeads: number;
  tamValue: number;
  conversionRate: number;
  industryBreakdown: Array<{
    industry: string;
    accounts: number;
    value: number;
    avgScore: number;
  }>;
  sizeBreakdown: Array<{
    size: string;
    accounts: number;
    value: number;
    avgScore: number;
  }>;
  geoBreakdown: Array<{
    country: string;
    accounts: number;
    value: number;
    avgScore: number;
  }>;
  insights: string[];
  recommendations: string[];
}

/**
 * Generate comprehensive TAM Intelligence PDF Report
 */
export async function generateTAMReport(data: TAMExportData, orgName: string = 'Organization'): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Helper to add new page if needed
  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  };

  // Title Page
  doc.setFillColor(8, 51, 105); // LaunchPulse Dark Navy
  doc.rect(0, 0, pageWidth, 70, 'F');
  
  doc.setFontSize(28);
  doc.setTextColor(60, 241, 174); // LaunchPulse Green
  doc.text('LaunchPulse', pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text('TAM Intelligence Report', pageWidth / 2, 45, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setTextColor(200, 200, 200);
  doc.text('Where GTM Meets ICP Precision', pageWidth / 2, 55, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(107, 114, 128);
  doc.text(orgName, pageWidth / 2, 85, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`, pageWidth / 2, 93, { align: 'center' });

  // Executive Summary Box
  doc.setFillColor(92, 244, 188); // LaunchPulse Accent Green (light)
  doc.roundedRect(margin, 105, pageWidth - 2 * margin, 80, 3, 3, 'F');
  
  doc.setFontSize(16);
  doc.setTextColor(8, 51, 105); // Dark Navy
  doc.text('Executive Summary', pageWidth / 2, 117, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);
  
  const summaryLines = [
    `Total Addressable Market: ${formatCurrency(data.tamValue)}`,
    `Total Accounts: ${data.totalAccounts.toLocaleString()}`,
    `High-Signal Accounts: ${data.highSignalAccounts.toLocaleString()} (${Math.round((data.highSignalAccounts / data.totalAccounts) * 100)}%)`,
    `Qualified Leads: ${data.qualifiedLeads.toLocaleString()}`,
    `Conversion Rate: ${data.conversionRate.toFixed(1)}%`
  ];
  
  summaryLines.forEach((line, index) => {
    doc.text(line, pageWidth / 2, 130 + (index * 8), { align: 'center' });
  });

  // Page 2: Industry Breakdown
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55);
  doc.text('Industry Analysis', margin, yPos);
  yPos += 12;
  
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('TAM breakdown by industry segment', margin, yPos);
  yPos += 15;

  // Industry table
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  
  // Table headers
  const col1X = margin;
  const col2X = margin + 70;
  const col3X = margin + 110;
  const col4X = margin + 150;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Industry', col1X, yPos);
  doc.text('Accounts', col2X, yPos);
  doc.text('TAM Value', col3X, yPos);
  doc.text('Avg Score', col4X, yPos);
  yPos += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
  
  data.industryBreakdown.slice(0, 12).forEach((item, index) => {
    checkPageBreak(8);
    
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 7, 'F');
    }
    
    doc.text(item.industry.substring(0, 30), col1X, yPos);
    doc.text(item.accounts.toLocaleString(), col2X, yPos);
    doc.text(formatCurrency(item.value), col3X, yPos);
    doc.text(item.avgScore.toString(), col4X, yPos);
    yPos += 8;
  });

  // Page 3: Geographic Breakdown
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55);
  doc.text('Geographic Analysis', margin, yPos);
  yPos += 12;
  
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('TAM distribution by country/region', margin, yPos);
  yPos += 15;

  // Geographic table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Country', col1X, yPos);
  doc.text('Accounts', col2X, yPos);
  doc.text('TAM Value', col3X, yPos);
  doc.text('Avg Score', col4X, yPos);
  yPos += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
  
  data.geoBreakdown.slice(0, 12).forEach((item, index) => {
    checkPageBreak(8);
    
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 7, 'F');
    }
    
    doc.text(item.country, col1X, yPos);
    doc.text(item.accounts.toLocaleString(), col2X, yPos);
    doc.text(formatCurrency(item.value), col3X, yPos);
    doc.text(item.avgScore.toString(), col4X, yPos);
    yPos += 8;
  });

  // Page 4: Company Size Analysis
  if (data.sizeBreakdown.length > 0) {
    doc.addPage();
    yPos = margin;
    
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text('Company Size Analysis', margin, yPos);
    yPos += 12;
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text('TAM by company employee count', margin, yPos);
    yPos += 15;

    // Size table
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Range', col1X, yPos);
    doc.text('Accounts', col2X, yPos);
    doc.text('TAM Value', col3X, yPos);
    doc.text('Avg Score', col4X, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
    
    data.sizeBreakdown.forEach((item, index) => {
      checkPageBreak(8);
      
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 7, 'F');
      }
      
      doc.text(`${item.size} employees`, col1X, yPos);
      doc.text(item.accounts.toLocaleString(), col2X, yPos);
      doc.text(formatCurrency(item.value), col3X, yPos);
      doc.text(item.avgScore.toString(), col4X, yPos);
      yPos += 8;
    });
  }

  // Page 5: Insights & Recommendations
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55);
  doc.text('Insights & Recommendations', margin, yPos);
  yPos += 15;

  if (data.insights.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(55, 65, 81);
    doc.text('Key Insights', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    
    data.insights.forEach((insight) => {
      checkPageBreak(15);
      const lines = doc.splitTextToSize(`• ${insight}`, pageWidth - 2 * margin - 5);
      lines.forEach((line: string) => {
        doc.text(line, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 2;
    });
  }

  yPos += 10;

  if (data.recommendations.length > 0) {
    checkPageBreak(25);
    
    doc.setFontSize(14);
    doc.setTextColor(55, 65, 81);
    doc.text('Strategic Recommendations', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    
    data.recommendations.forEach((rec) => {
      checkPageBreak(15);
      const lines = doc.splitTextToSize(`• ${rec}`, pageWidth - 2 * margin - 5);
      lines.forEach((line: string) => {
        doc.text(line, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 2;
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'TAM Intelligence Report - Confidential',
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // Save the PDF
  doc.save(`TAM_Intelligence_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}
