import jsPDF from 'jspdf';

interface ICP10Entry {
  rank: number;
  persona: string;
  subIndustry: string;
  country: string;
  companySize: string;
  revenueRange: string;
  employeeRange: string;
  signalScore: number;
  accountCount: number;
  tamValue: number;
  conversionRate: number;
  avgDealSize: number;
  salesCycle: number;
}

/**
 * Generate ICP-10 Report PDF
 */
export async function generateICP10PDF(data: ICP10Entry[], orgName: string = 'Organization'): Promise<void> {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for wider table
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Title Page
  doc.setFillColor(8, 51, 105); // LaunchPulse Dark Navy
  doc.rect(0, 0, pageWidth, 65, 'F');
  
  doc.setFontSize(28);
  doc.setTextColor(60, 241, 174); // LaunchPulse Green
  doc.text('LaunchPulse', pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text('ICP-10 Report', pageWidth / 2, 35, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setTextColor(200, 200, 200);
  doc.text('Where GTM Meets ICP Precision', pageWidth / 2, 45, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(107, 114, 128);
  doc.text(orgName, pageWidth / 2, 58, { align: 'center' });
  doc.text(`Top 10 Ideal Customer Profiles - Generated: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`, pageWidth / 2, 66, { align: 'center' });

  yPos = 80;

  // Summary Box
  doc.setFillColor(92, 244, 188); // LaunchPulse Accent Green
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 3, 3, 'F');
  
  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);
  
  const totalTAM = data.reduce((sum, item) => sum + item.tamValue, 0);
  const totalAccounts = data.reduce((sum, item) => sum + item.accountCount, 0);
  const avgConversion = data.reduce((sum, item) => sum + item.conversionRate, 0) / data.length;

  doc.text(`Total TAM: $${(totalTAM / 1000000).toFixed(1)}M`, margin + 10, yPos + 12);
  doc.text(`Total Accounts: ${totalAccounts.toLocaleString()}`, margin + 10, yPos + 22);
  doc.text(`Avg Conversion Rate: ${avgConversion.toFixed(1)}%`, pageWidth / 2 + 20, yPos + 12);
  doc.text(`Avg Deal Size: $${(data.reduce((sum, item) => sum + item.avgDealSize, 0) / data.length / 1000).toFixed(0)}K`, pageWidth / 2 + 20, yPos + 22);

  // Main Table
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text('Top 10 ICP Profiles - Ranked by Signal Score', margin, yPos);
  yPos += 12;

  // Table headers
  const colPositions = {
    rank: margin,
    persona: margin + 15,
    subIndustry: margin + 50,
    country: margin + 95,
    size: margin + 130,
    revenue: margin + 165,
    score: margin + 205,
    accounts: margin + 230,
    tam: margin + 260
  };

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  
  doc.text('#', colPositions.rank, yPos);
  doc.text('Persona', colPositions.persona, yPos);
  doc.text('Sub-Industry', colPositions.subIndustry, yPos);
  doc.text('Country', colPositions.country, yPos);
  doc.text('Size', colPositions.size, yPos);
  doc.text('Revenue', colPositions.revenue, yPos);
  doc.text('Score', colPositions.score, yPos);
  doc.text('Accts', colPositions.accounts, yPos);
  doc.text('TAM', colPositions.tam, yPos);
  
  yPos += 3;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  // Table rows
  doc.setFont('helvetica', 'normal');
  
  data.slice(0, 10).forEach((item, index) => {
    checkPageBreak(10);
    
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, yPos - 4, pageWidth - 2 * margin, 8, 'F');
    }
    
    doc.setTextColor(31, 41, 55);
    doc.text(item.rank.toString(), colPositions.rank + 2, yPos);
    doc.text(item.persona.substring(0, 18), colPositions.persona, yPos);
    doc.text(item.subIndustry.substring(0, 22), colPositions.subIndustry, yPos);
    doc.text(item.country.substring(0, 18), colPositions.country, yPos);
    doc.text(item.companySize, colPositions.size, yPos);
    doc.text(item.revenueRange.substring(0, 15), colPositions.revenue, yPos);
    
    // Color code signal score
    if (item.signalScore >= 80) {
      doc.setTextColor(34, 197, 94); // Green
    } else if (item.signalScore >= 60) {
      doc.setTextColor(251, 146, 60); // Orange
    } else {
      doc.setTextColor(239, 68, 68); // Red
    }
    doc.text(item.signalScore.toString(), colPositions.score, yPos);
    
    doc.setTextColor(31, 41, 55);
    doc.text(item.accountCount.toLocaleString(), colPositions.accounts, yPos);
    doc.text(`$${(item.tamValue / 1000000).toFixed(1)}M`, colPositions.tam, yPos);
    
    yPos += 8;
  });

  // Detailed breakdown page
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text('Detailed ICP Metrics', margin, yPos);
  yPos += 15;

  data.slice(0, 10).forEach((item, index) => {
    if (checkPageBreak(35)) {
      doc.setFontSize(16);
      doc.setTextColor(31, 41, 55);
      doc.text('Detailed ICP Metrics (continued)', margin, yPos);
      yPos += 15;
    }
    
    // ICP Card
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 2, 2, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(`#${item.rank} - ${item.persona}`, margin + 5, yPos + 7);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    
    const detailsX1 = margin + 5;
    const detailsX2 = margin + 95;
    const detailsX3 = margin + 185;
    let detailY = yPos + 14;
    
    doc.text(`Sub-Industry: ${item.subIndustry}`, detailsX1, detailY);
    doc.text(`Conversion Rate: ${item.conversionRate}%`, detailsX2, detailY);
    doc.text(`Signal Score: ${item.signalScore}`, detailsX3, detailY);
    
    detailY += 5;
    doc.text(`Country: ${item.country}`, detailsX1, detailY);
    doc.text(`Avg Deal Size: $${(item.avgDealSize / 1000).toFixed(0)}K`, detailsX2, detailY);
    doc.text(`Accounts: ${item.accountCount}`, detailsX3, detailY);
    
    detailY += 5;
    doc.text(`Company Size: ${item.companySize}`, detailsX1, detailY);
    doc.text(`Sales Cycle: ${item.salesCycle} days`, detailsX2, detailY);
    doc.text(`TAM: $${(item.tamValue / 1000000).toFixed(1)}M`, detailsX3, detailY);
    
    yPos += 35;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
    doc.text(
      'ICP-10 Report - Confidential',
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  // Save
  doc.save(`ICP10_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}
