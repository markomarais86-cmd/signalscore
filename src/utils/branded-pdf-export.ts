import jsPDF from 'jspdf';
import { BrandConfig } from '@/hooks/useBrandedConfig';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrandedReportData {
  companyName: string;
  generatedAt: string;
  logoBase64: string | null;

  // Page 2 – Executive Summary
  metrics: {
    totalAccounts: number;
    scoredAccounts: number;
    highFitAccounts: number;
    mediumFitAccounts: number;
    lowFitAccounts: number;
    campaignReadyAccounts: number;
    dataCompleteness: number;
  };
  icpProfileCount: number;
  icpProfileNames: string[];

  // Page 3 – ICP Profile Summary
  icpProfiles: Array<{
    name: string;
    targetIndustries: string[];
    companySizes: string[];
    geographies: string[];
    matchCount: number;
    tamEstimate: number;
    confidence: number;
  }>;

  // Page 4 – TAM / SAM / SOM
  tam: number;
  sam: number;
  som: number;
  industryBreakdown: Array<{ name: string; accounts: number; percentage: number }>;
  sizeBreakdown: Array<{ name: string; accounts: number; percentage: number }>;

  // Page 5 – Geography
  geographyDistribution: Array<{ country: string; accounts: number; percentage: number }>;

  // Page 6 – Top Prospects
  topProspects: Array<{
    name: string;
    industry: string;
    size: string;
    country: string;
    fitScore: number;
    intentScore: number;
    overallScore: number;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_PRIMARY: [number, number, number] = [8, 51, 105]; // LaunchPulse navy
const DEFAULT_SECONDARY: [number, number, number] = [60, 241, 174]; // LaunchPulse green

function hexToRgb(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null;
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return null;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

function getBrandColors(brand: BrandConfig | null) {
  const primary = hexToRgb(brand?.brand_primary_color) ?? DEFAULT_PRIMARY;
  const secondary = hexToRgb(brand?.brand_secondary_color) ?? DEFAULT_SECONDARY;
  return { primary, secondary };
}

function lightenRgb(rgb: [number, number, number], factor = 0.85): [number, number, number] {
  return rgb.map(c => Math.round(c + (255 - c) * factor)) as [number, number, number];
}

// ─── PDF Generator ───────────────────────────────────────────────────────────

export async function generateBrandedPDF(
  data: BrandedReportData,
  brand: BrandConfig | null
): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15; // margin
  const CW = W - 2 * M; // content width
  const { primary, secondary } = getBrandColors(brand);
  const lightBg = lightenRgb(primary, 0.92);
  const companyName = brand?.company_name || data.companyName || 'Organization';

  // ─── Shared helpers ──────────────────────────────────────────────────────

  let y = M;

  const addHeader = (title: string) => {
    doc.setFillColor(...primary);
    doc.rect(0, 0, W, 12, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(companyName, M, 8);
    doc.text(title, W - M, 8, { align: 'right' });
    y = 22;
  };

  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${pageNum} of ${totalPages}`, W / 2, H - 8, { align: 'center' });
    doc.text('Confidential', W - M, H - 8, { align: 'right' });
    doc.text(`Prepared by LaunchPulse`, M, H - 8);
  };

  const sectionTitle = (text: string) => {
    doc.setFontSize(16);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text(text, M, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
  };

  const tableHeader = (cols: { label: string; x: number }[]) => {
    doc.setFillColor(...primary);
    doc.rect(M, y - 5, CW, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    cols.forEach(c => doc.text(c.label, c.x, y));
    y += 6;
    doc.setFont('helvetica', 'normal');
  };

  const tableRow = (cols: { text: string; x: number }[], idx: number) => {
    if (idx % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(M, y - 4, CW, 7, 'F');
    }
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    cols.forEach(c => doc.text(c.text, c.x, y));
    y += 7;
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > H - 20) {
      doc.addPage();
      y = M;
      return true;
    }
    return false;
  };

  // ─── Page 1: Cover ───────────────────────────────────────────────────────

  // Full-height brand bar
  doc.setFillColor(...primary);
  doc.rect(0, 0, W, 80, 'F');

  // Logo or company name
  if (data.logoBase64) {
    try {
      doc.addImage(data.logoBase64, 'PNG', W / 2 - 20, 15, 40, 20);
    } catch {
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      doc.text(companyName, W / 2, 30, { align: 'center' });
    }
  } else {
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text(companyName, W / 2, 30, { align: 'center' });
  }

  // Subtitle on cover
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('ICP & Market Intelligence Report', W / 2, 55, { align: 'center' });

  // Secondary accent line
  doc.setFillColor(...secondary);
  doc.rect(W / 2 - 30, 65, 60, 2, 'F');

  // Date & attribution
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`Prepared by LaunchPulse`, W / 2, 100, { align: 'center' });
  doc.text(data.generatedAt, W / 2, 108, { align: 'center' });

  // ─── Page 2: Executive Summary ────────────────────────────────────────────

  doc.addPage();
  addHeader('Executive Summary');

  sectionTitle('Executive Summary');

  // Metrics grid (2 columns)
  const m = data.metrics;
  const highFitPct = m.scoredAccounts > 0 ? Math.round((m.highFitAccounts / m.scoredAccounts) * 100) : 0;

  const metricItems = [
    { label: 'Total Accounts', value: m.totalAccounts.toLocaleString() },
    { label: 'Scored Accounts', value: m.scoredAccounts.toLocaleString() },
    { label: 'High-Fit Accounts', value: `${m.highFitAccounts.toLocaleString()} (${highFitPct}%)` },
    { label: 'Medium-Fit Accounts', value: m.mediumFitAccounts.toLocaleString() },
    { label: 'Campaign-Ready', value: m.campaignReadyAccounts.toLocaleString() },
    { label: 'Data Completeness', value: `${m.dataCompleteness}%` },
  ];

  metricItems.forEach((item, i) => {
    const col = i % 2;
    if (i % 2 === 0 && i > 0) y += 2;
    const xBase = M + col * (CW / 2);

    doc.setFillColor(...lightBg);
    doc.roundedRect(xBase, y - 4, CW / 2 - 4, 16, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, xBase + 4, y + 1);

    doc.setFontSize(13);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, xBase + 4, y + 9);
    doc.setFont('helvetica', 'normal');

    if (col === 1) y += 18;
  });
  if (metricItems.length % 2 !== 0) y += 18;

  y += 6;

  // ICP profiles overview
  doc.setFontSize(12);
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.text(`Active ICP Profiles: ${data.icpProfileCount}`, M, y);
  doc.setFont('helvetica', 'normal');
  y += 7;

  if (data.icpProfileNames.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    data.icpProfileNames.forEach(name => {
      doc.text(`• ${name}`, M + 4, y);
      y += 5;
    });
  }

  // Score distribution bar
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Score Distribution', M, y);
  doc.setFont('helvetica', 'normal');
  y += 6;

  const total = m.highFitAccounts + m.mediumFitAccounts + m.lowFitAccounts;
  if (total > 0) {
    const barW = CW;
    const barH = 10;
    const hW = (m.highFitAccounts / total) * barW;
    const mW = (m.mediumFitAccounts / total) * barW;
    const lW = (m.lowFitAccounts / total) * barW;

    doc.setFillColor(34, 197, 94); // green
    doc.roundedRect(M, y, hW, barH, 2, 2, 'F');
    doc.setFillColor(250, 204, 21); // yellow
    doc.rect(M + hW, y, mW, barH, 'F');
    doc.setFillColor(239, 68, 68); // red
    doc.roundedRect(M + hW + mW, y, lW, barH, 2, 2, 'F');

    y += barH + 5;
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(`High: ${m.highFitAccounts}  |  Medium: ${m.mediumFitAccounts}  |  Low: ${m.lowFitAccounts}`, M, y);
  }

  // ─── Page 3: ICP Profile Summary ──────────────────────────────────────────

  doc.addPage();
  addHeader('ICP Profile Summary');
  sectionTitle('ICP Profile Summary');

  if (data.icpProfiles.length > 0) {
    const cols = [
      { label: 'Profile Name', x: M },
      { label: 'Industries', x: M + 45 },
      { label: 'Sizes', x: M + 95 },
      { label: 'Matches', x: M + 135 },
      { label: 'Confidence', x: M + 160 },
    ];
    tableHeader(cols);

    data.icpProfiles.forEach((p, i) => {
      checkPageBreak(8);
      tableRow([
        { text: (p.name || 'Unnamed').substring(0, 22), x: M },
        { text: (p.targetIndustries || []).slice(0, 2).join(', ').substring(0, 24), x: M + 45 },
        { text: (p.companySizes || []).slice(0, 2).join(', ').substring(0, 18), x: M + 95 },
        { text: p.matchCount.toLocaleString(), x: M + 135 },
        { text: `${Math.round(p.confidence * 100)}%`, x: M + 160 },
      ], i);
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No active ICP profiles found.', M, y);
  }

  // ─── Page 4: TAM / SAM / SOM ──────────────────────────────────────────────

  doc.addPage();
  addHeader('TAM / SAM / SOM Analysis');
  sectionTitle('Total Addressable Market');

  // TAM/SAM/SOM cards
  const tamItems = [
    { label: 'TAM (Total Addressable Market)', value: data.tam.toLocaleString(), desc: 'Total external database accounts' },
    { label: 'SAM (Serviceable Available Market)', value: data.sam.toLocaleString(), desc: 'High + medium fit accounts' },
    { label: 'SOM (Serviceable Obtainable Market)', value: data.som.toLocaleString(), desc: 'Campaign-ready accounts' },
  ];

  tamItems.forEach(item => {
    doc.setFillColor(...lightBg);
    doc.roundedRect(M, y - 4, CW, 20, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, M + 4, y + 1);

    doc.setFontSize(16);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, M + 4, y + 11);
    doc.setFont('helvetica', 'normal');

    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(item.desc, M + 60, y + 11);

    y += 24;
  });

  // Industry breakdown
  y += 4;
  if (data.industryBreakdown.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text('Industry Breakdown (Top 10)', M, y);
    doc.setFont('helvetica', 'normal');
    y += 8;

    const indCols = [
      { label: 'Industry', x: M },
      { label: 'Accounts', x: M + 100 },
      { label: '% Share', x: M + 140 },
    ];
    tableHeader(indCols);

    data.industryBreakdown.slice(0, 10).forEach((item, i) => {
      checkPageBreak(8);
      tableRow([
        { text: item.name.substring(0, 45), x: M },
        { text: item.accounts.toLocaleString(), x: M + 100 },
        { text: `${item.percentage.toFixed(1)}%`, x: M + 140 },
      ], i);
    });
  }

  // Size breakdown
  y += 6;
  if (data.sizeBreakdown.length > 0 && !checkPageBreak(40)) {
    doc.setFontSize(12);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text('Company Size Breakdown', M, y);
    doc.setFont('helvetica', 'normal');
    y += 8;

    const sizeCols = [
      { label: 'Size Range', x: M },
      { label: 'Accounts', x: M + 100 },
      { label: '% Share', x: M + 140 },
    ];
    tableHeader(sizeCols);

    data.sizeBreakdown.forEach((item, i) => {
      checkPageBreak(8);
      tableRow([
        { text: item.name.substring(0, 45), x: M },
        { text: item.accounts.toLocaleString(), x: M + 100 },
        { text: `${item.percentage.toFixed(1)}%`, x: M + 140 },
      ], i);
    });
  }

  // ─── Page 5: Geographic Analysis ──────────────────────────────────────────

  doc.addPage();
  addHeader('Geographic Analysis');
  sectionTitle('Geographic Distribution');

  if (data.geographyDistribution.length > 0) {
    // Concentration summary
    const top3 = data.geographyDistribution.slice(0, 3);
    const top3Pct = top3.reduce((sum, g) => sum + g.percentage, 0);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Top 3 markets represent ${top3Pct.toFixed(1)}% of all accounts`, M, y);
    y += 10;

    const geoCols = [
      { label: 'Country', x: M },
      { label: 'Accounts', x: M + 100 },
      { label: '% Share', x: M + 140 },
    ];
    tableHeader(geoCols);

    data.geographyDistribution.slice(0, 15).forEach((item, i) => {
      checkPageBreak(8);
      tableRow([
        { text: item.country.substring(0, 45), x: M },
        { text: item.accounts.toLocaleString(), x: M + 100 },
        { text: `${item.percentage.toFixed(1)}%`, x: M + 140 },
      ], i);
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No geographic data available.', M, y);
  }

  // ─── Page 6: Top Prospects ────────────────────────────────────────────────

  doc.addPage();
  addHeader('Top Prospects');
  sectionTitle('Top 20 Prospects by Overall Score');

  if (data.topProspects.length > 0) {
    const prospCols = [
      { label: 'Company', x: M },
      { label: 'Industry', x: M + 42 },
      { label: 'Size', x: M + 82 },
      { label: 'Country', x: M + 102 },
      { label: 'Fit', x: M + 132 },
      { label: 'Intent', x: M + 148 },
      { label: 'Overall', x: M + 165 },
    ];
    tableHeader(prospCols);

    data.topProspects.slice(0, 20).forEach((p, i) => {
      checkPageBreak(8);
      tableRow([
        { text: (p.name || 'N/A').substring(0, 20), x: M },
        { text: (p.industry || 'N/A').substring(0, 18), x: M + 42 },
        { text: (p.size || 'N/A').substring(0, 10), x: M + 82 },
        { text: (p.country || 'N/A').substring(0, 14), x: M + 102 },
        { text: String(p.fitScore || 0), x: M + 132 },
        { text: String(p.intentScore || 0), x: M + 148 },
        { text: String(p.overallScore || 0), x: M + 165 },
      ], i);
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No scored prospects available.', M, y);
  }

  // ─── Footers on all pages ─────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  // Save
  const fileName = `${companyName.replace(/\s+/g, '_')}_ICP_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
