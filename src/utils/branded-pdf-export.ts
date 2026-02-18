import jsPDF from 'jspdf';
import { BrandConfig } from '@/hooks/useBrandedConfig';
import { RiskItem } from '@/utils/risk-detector';
import { ICPInsight } from '@/hooks/use-icp-insights';
import { formatCurrency, deriveStageReadiness, deriveNextAction, deriveSegmentAction, deriveGeoTag, DEFAULT_ACV, DEFAULT_CONVERSION_RATE } from '@/utils/revenue-modeling';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AIReportNarratives {
  executiveSummary: string;
  keyFindings: Array<{ title: string; detail: string; impact: string }>;
  strategicRecommendations: Array<{ action: string; rationale: string; priority: string }>;
  riskAssessment: Array<{ risk: string; severity: string; mitigation: string }>;
  industryInsights: string;
  geoInsights: string;
  tamNarrative: string;
  icpAnalysis?: string;
}

export interface ICPProfileDetail {
  name: string;
  description: string;
  industries: string[];
  companySizes: string[];
  geographies: string[];
  personaJobTitles: string[];
  personaSeniorityLevels: string[];
  personaDepartments: string[];
  techStack: string[];
  buyingSignals: string[];
  painPoints: string[];
  confidenceScore: number;
}

export interface BrandedReportData {
  companyName: string;
  generatedAt: string;
  logoBase64: string | null;

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

  icpProfiles: Array<{
    name: string;
    targetIndustries: string[];
    companySizes: string[];
    geographies: string[];
    matchCount: number;
    tamEstimate: number;
    confidence: number;
  }>;

  // Revenue-framed TAM/SAM/SOM (in dollars)
  tam: number;
  sam: number;
  som: number;

  industryBreakdown: Array<{
    name: string;
    accounts: number;
    percentage: number;
    highFitCount?: number;
    highFitPct?: number;
    avgScore?: number;
  }>;
  sizeBreakdown: Array<{ name: string; accounts: number; percentage: number }>;
  revenueRangeBreakdown?: Array<{ name: string; accounts: number; percentage: number }>;

  geographyDistribution: Array<{
    country: string;
    accounts: number;
    percentage: number;
    avgScore?: number;
  }>;

  topProspects: Array<{
    name: string;
    industry: string;
    size: string;
    country: string;
    fitScore: number;
    intentScore: number;
    overallScore: number;
    revenueRange?: string;
    leadCount?: number;
    estimatedValue?: number;
    bedCount?: number | null;
  }>;

  insights: ICPInsight[];
  risks: RiskItem[];

  leadStats?: {
    totalLeads: number;
    leadCoverage: number;
    leadsPerAccount: number;
  };

  revenueModeling?: {
    acv: number;
    conversionRate: number;
    pipelinePotential: number;
    revenueAtRisk: number;
    unscoredAccounts: number;
    lowDataAccounts: number;
  };

  aiNarratives?: AIReportNarratives;
  icpProfileDetail?: ICPProfileDetail;
  chartImages?: {
    icpDonut?: string;
    scoreBar?: string;
    tamFunnel?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_PRIMARY: [number, number, number] = [60, 241, 174];
const DEFAULT_SECONDARY: [number, number, number] = [15, 15, 15];
const DEFAULT_DARK: [number, number, number] = [0, 0, 0];

const COUNTRY_CODE_MAP: Record<string, string> = {
  'us': 'United States', 'gb': 'United Kingdom', 'uk': 'United Kingdom',
  'de': 'Germany', 'fr': 'France', 'es': 'Spain', 'it': 'Italy',
  'nl': 'Netherlands', 'be': 'Belgium', 'ch': 'Switzerland', 'at': 'Austria',
  'se': 'Sweden', 'no': 'Norway', 'dk': 'Denmark', 'fi': 'Finland',
  'pl': 'Poland', 'cz': 'Czechia', 'ro': 'Romania', 'bg': 'Bulgaria',
  'pt': 'Portugal', 'ie': 'Ireland', 'gr': 'Greece', 'hu': 'Hungary',
  'hr': 'Croatia', 'sk': 'Slovakia', 'si': 'Slovenia', 'lt': 'Lithuania',
  'lv': 'Latvia', 'ee': 'Estonia', 'ca': 'Canada', 'au': 'Australia',
  'nz': 'New Zealand', 'jp': 'Japan', 'kr': 'South Korea', 'cn': 'China',
  'in': 'India', 'br': 'Brazil', 'mx': 'Mexico', 'ar': 'Argentina',
  'za': 'South Africa', 'sg': 'Singapore', 'hk': 'Hong Kong',
  'ae': 'United Arab Emirates', 'il': 'Israel', 'tr': 'Turkey',
  'ru': 'Russia', 'ua': 'Ukraine', 'th': 'Thailand', 'ph': 'Philippines',
  'my': 'Malaysia', 'id': 'Indonesia', 'vn': 'Vietnam', 'tw': 'Taiwan',
  'co': 'Colombia', 'cl': 'Chile', 'pe': 'Peru',
};

function normalizeCountryName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return COUNTRY_CODE_MAP[lower] || (raw.charAt(0).toUpperCase() + raw.slice(1));
}

function normalizeAndMergeGeo(
  geo: Array<{ country: string; accounts: number; percentage: number; avgScore?: number }>
): Array<{ country: string; accounts: number; percentage: number; avgScore: number }> {
  const merged = new Map<string, { accounts: number; totalScore: number; scoredCount: number }>();
  geo.forEach(g => {
    const name = normalizeCountryName(g.country);
    const entry = merged.get(name) || { accounts: 0, totalScore: 0, scoredCount: 0 };
    entry.accounts += g.accounts;
    if (g.avgScore) {
      entry.totalScore += g.avgScore * g.accounts;
      entry.scoredCount += g.accounts;
    }
    merged.set(name, entry);
  });
  const totalAccounts = Array.from(merged.values()).reduce((s, v) => s + v.accounts, 0);
  return Array.from(merged.entries())
    .map(([country, d]) => ({
      country,
      accounts: d.accounts,
      percentage: totalAccounts > 0 ? (d.accounts / totalAccounts) * 100 : 0,
      avgScore: d.scoredCount > 0 ? Math.round(d.totalScore / d.scoredCount) : 0,
    }))
    .sort((a, b) => b.accounts - a.accounts);
}

function hexToRgb(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null;
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return null;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

function getBrandColors(brand: BrandConfig | null, isLaunchPulse: boolean) {
  // Force LaunchPulse teal palette regardless of DB overrides
  if (isLaunchPulse) {
    return { primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY, dark: DEFAULT_DARK };
  }
  const primary = hexToRgb(brand?.brand_primary_color) ?? DEFAULT_PRIMARY;
  const secondary = hexToRgb(brand?.brand_secondary_color) ?? DEFAULT_SECONDARY;
  const dark = DEFAULT_DARK;
  return { primary, secondary, dark };
}

function lightenRgb(rgb: [number, number, number], factor = 0.85): [number, number, number] {
  return rgb.map(c => Math.round(c + (255 - c) * factor)) as [number, number, number];
}

function safeNum(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// ─── PDF Generator ───────────────────────────────────────────────────────────

export async function generateBrandedPDF(
  data: BrandedReportData,
  brand: BrandConfig | null
): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15;
  const CW = W - 2 * M;
  const rawName = brand?.company_name || data.companyName || 'Organization';
  const companyName = rawName.toLowerCase().replace(/\s/g, '') === 'launchpulse' ? 'LaunchPulse' : rawName;
  const isLaunchPulse = companyName === 'LaunchPulse';
  const { primary, secondary, dark } = getBrandColors(brand, isLaunchPulse);
  const lightBg = lightenRgb(primary, 0.92);

  const acv = data.revenueModeling?.acv || DEFAULT_ACV;
  const convRate = data.revenueModeling?.conversionRate || DEFAULT_CONVERSION_RATE;

  let y = M;

  // ─── Shared helpers ──────────────────────────────────────────────────────

  const addHeader = (title: string) => {
    doc.setFillColor(...dark);
    doc.rect(0, 0, W, 12, 'F');
    doc.setFillColor(...primary);
    doc.rect(0, 12, W, 1, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...primary);
    doc.text(companyName, M, 8);
    doc.setTextColor(255, 255, 255);
    doc.text(title, W - M, 8, { align: 'right' });
    y = 22;
  };

  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${pageNum} of ${totalPages}`, W / 2, H - 8, { align: 'center' });
    doc.text('Confidential', W - M, H - 8, { align: 'right' });
    const footerText = isLaunchPulse ? 'Powered by LaunchPulse' : `Prepared by ${companyName} using LaunchPulse`;
    doc.text(footerText, M, H - 8);
  };

  const sectionTitle = (text: string) => {
    doc.setFontSize(16);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text(text, M, y);
    y += 2;
    doc.setFillColor(...primary);
    doc.rect(M, y, 40, 1.5, 'F');
    y += 8;
    doc.setFont('helvetica', 'normal');
  };

  const tableHeader = (cols: { label: string; x: number; align?: string }[]) => {
    doc.setFillColor(...dark);
    doc.rect(M, y - 5, CW, 8, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primary);
    cols.forEach(c => doc.text(c.label, c.x, y, c.align === 'right' ? { align: 'right' } : undefined));
    y += 6;
    doc.setFont('helvetica', 'normal');
  };

  const tableRow = (cols: { text: string; x: number; align?: string; color?: [number, number, number]; bold?: boolean }[], idx: number) => {
    if (idx % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(M, y - 4, CW, 8, 'F');
    }
    doc.setFontSize(7);
    cols.forEach(c => {
      doc.setTextColor(...(c.color || [50, 50, 50]));
      if (c.bold) doc.setFont('helvetica', 'bold');
      doc.text(c.text, c.x, y, c.align === 'right' ? { align: 'right' } : undefined);
      if (c.bold) doc.setFont('helvetica', 'normal');
    });
    y += 8;
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > H - 20) {
      doc.addPage();
      y = M;
      return true;
    }
    return false;
  };

  const kpiCard = (label: string, value: string, xBase: number, width: number, subtitle?: string) => {
    doc.setFillColor(...lightBg);
    doc.roundedRect(xBase, y, width, subtitle ? 20 : 16, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(label, xBase + 4, y + 5);
    doc.setFontSize(14);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text(value, xBase + 4, y + 13);
    doc.setFont('helvetica', 'normal');
    if (subtitle) {
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(subtitle, xBase + 4, y + 18);
    }
  };

  const severityColor = (severity: string): [number, number, number] => {
    switch (severity) {
      case 'critical': return [220, 38, 38];
      case 'high': return [234, 88, 12];
      case 'medium': return [202, 138, 4];
      case 'low': return [22, 163, 74];
      default: return [100, 100, 100];
    }
  };

  /** Draw pill/tag items in a wrapping grid */
  const drawPills = (items: string[], startY: number, pillColor: [number, number, number], textColor: [number, number, number] = [255, 255, 255]) => {
    let px = M;
    let py = startY;
    const pillH = 6;
    const pillPad = 3;
    const gap = 2;
    doc.setFontSize(6.5);

    items.forEach(item => {
      const tw = doc.getTextWidth(item) + pillPad * 2;
      if (px + tw > W - M) {
        px = M;
        py += pillH + gap;
      }
      doc.setFillColor(...pillColor);
      doc.roundedRect(px, py, tw, pillH, 2, 2, 'F');
      doc.setTextColor(...textColor);
      doc.text(item, px + pillPad, py + 4.2);
      px += tw + gap;
    });
    return py + pillH + gap;
  };

  /** Draw a confidence arc gauge */
  const drawConfidenceGauge = (score: number, cx: number, cy: number, radius: number) => {
    const gaugeColor: [number, number, number] = score >= 70 ? [34, 197, 94] : score >= 50 ? [250, 204, 21] : [239, 68, 68];
    // Background arc
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(2.5);
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;
    // Draw background arc segments
    for (let a = startAngle; a < endAngle; a += 0.05) {
      const x1 = cx + radius * Math.cos(a);
      const y1 = cy + radius * Math.sin(a);
      const x2 = cx + radius * Math.cos(a + 0.05);
      const y2 = cy + radius * Math.sin(a + 0.05);
      doc.line(x1, y1, x2, y2);
    }
    // Filled arc
    doc.setDrawColor(...gaugeColor);
    const fillEnd = startAngle + (endAngle - startAngle) * (score / 100);
    for (let a = startAngle; a < fillEnd; a += 0.05) {
      const x1 = cx + radius * Math.cos(a);
      const y1 = cy + radius * Math.sin(a);
      const x2 = cx + radius * Math.cos(Math.min(a + 0.05, fillEnd));
      const y2 = cy + radius * Math.sin(Math.min(a + 0.05, fillEnd));
      doc.line(x1, y1, x2, y2);
    }
    doc.setLineWidth(0.2);
    // Score text
    doc.setFontSize(14);
    doc.setTextColor(...gaugeColor);
    doc.setFont('helvetica', 'bold');
    doc.text(`${score}%`, cx, cy + 2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text('confidence', cx, cy + 6, { align: 'center' });
  };

  // ─── Page 1: Cover ───────────────────────────────────────────────────────

  doc.setFillColor(...dark);
  doc.rect(0, 0, W, H, 'F');

  doc.setFillColor(...primary);
  doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
  for (let i = 0; i < 8; i++) {
    doc.rect(0, i * 38, W, 1, 'F');
  }
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  if (data.logoBase64) {
    try {
      doc.addImage(data.logoBase64, 'PNG', W / 2 - 25, 50, 50, 25);
    } catch {
      doc.setFontSize(36);
      doc.setTextColor(...primary);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, W / 2, 70, { align: 'center' });
    }
  } else {
    doc.setFontSize(36);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, W / 2, 70, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFillColor(...primary);
  doc.rect(W / 2 - 40, 90, 80, 3, 'F');

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('Strategic Growth', W / 2, 115, { align: 'center' });
  doc.text('Intelligence Brief', W / 2, 127, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(160, 170, 180);
  doc.text(data.generatedAt, W / 2, 150, { align: 'center' });

  // Strategic thesis line
  const pipelinePotential = data.revenueModeling?.pipelinePotential || data.som;
  doc.setFontSize(10);
  doc.setTextColor(...primary);
  const thesis = `${formatCurrency(pipelinePotential)} pipeline potential across ${data.metrics.highFitAccounts.toLocaleString()} high-fit accounts`;
  doc.text(thesis, W / 2, 165, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(100, 110, 120);
  const coverFooter = isLaunchPulse ? 'Powered by LaunchPulse' : `Prepared by ${companyName} using LaunchPulse`;
  doc.text(coverFooter, W / 2, H - 25, { align: 'center' });

  // ─── Page 2: Table of Contents ────────────────────────────────────────────

  doc.addPage();
  addHeader('Table of Contents');
  sectionTitle('Table of Contents');

  // Build TOC entries dynamically based on which sections are present
  const tocEntries: Array<{ title: string; page: number }> = [];
  let tocPage = 3; // starts after Cover + TOC

  if (data.icpProfileDetail) {
    tocEntries.push({ title: 'Ideal Customer Profile', page: tocPage });
    tocPage++;
  }
  tocEntries.push({ title: 'Strategic Position', page: tocPage }); tocPage++;
  tocEntries.push({ title: 'Revenue Model', page: tocPage }); tocPage++;
  tocEntries.push({ title: 'Segment Prioritization', page: tocPage }); tocPage++;
  tocEntries.push({ title: 'Geographic Strategy', page: tocPage }); tocPage++;
  tocEntries.push({ title: 'Top 10 Revenue Opportunities', page: tocPage }); tocPage++;
  tocEntries.push({ title: 'Revenue Leakage & Risk Assessment', page: tocPage }); tocPage++;
  if (data.aiNarratives?.strategicRecommendations && data.aiNarratives.strategicRecommendations.length > 0) {
    tocEntries.push({ title: 'Strategic Recommendations', page: tocPage });
    tocPage++;
  }
  tocEntries.push({ title: '90-Day Execution Plan', page: tocPage });

  // Render TOC rows with dotted leaders
  const tocStartY = y;
  const tocRowH = 10;
  const tocLeftX = M + 4;
  const tocRightX = W - M - 4;

  tocEntries.forEach((entry, idx) => {
    const rowY = tocStartY + idx * tocRowH;

    // Alternating row background
    if (idx % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(M, rowY - 4, CW, tocRowH, 'F');
    }

    // Section title
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'normal');
    doc.text(entry.title, tocLeftX, rowY + 2);

    // Page number (brand color)
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text(String(entry.page), tocRightX, rowY + 2, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    // Dotted leader line
    const titleWidth = doc.getTextWidth(entry.title);
    const pageNumWidth = doc.getTextWidth(String(entry.page));
    const dotsStartX = tocLeftX + titleWidth + 4;
    const dotsEndX = tocRightX - pageNumWidth - 4;
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    let dotX = dotsStartX;
    while (dotX < dotsEndX) {
      doc.text('.', dotX, rowY + 2);
      dotX += 2.2;
    }
  });

  y = tocStartY + tocEntries.length * tocRowH + 8;

  // ─── Page: ICP Profile ──────────────────────────────────────────────────

  if (data.icpProfileDetail) {
    const icp = data.icpProfileDetail;
    doc.addPage();
    addHeader('Ideal Customer Profile');
    sectionTitle('Ideal Customer Profile');

    // Profile name + confidence gauge side by side
    doc.setFontSize(14);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text(icp.name, M, y);
    doc.setFont('helvetica', 'normal');

    // Confidence gauge on the right
    drawConfidenceGauge(icp.confidenceScore, W - M - 20, y - 2, 12);
    y += 6;

    // Description
    if (icp.description) {
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);
      const descLines = doc.splitTextToSize(icp.description, CW - 50);
      doc.text(descLines, M, y);
      y += descLines.length * 4 + 6;
    }

    // Target Industries
    if (icp.industries.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'bold');
      doc.text('Target Industries', M, y);
      doc.setFont('helvetica', 'normal');
      y += 5;
      y = drawPills(icp.industries, y, primary);
      y += 4;
    }

    // Company Sizes & Geographies side by side
    const halfW = (CW - 6) / 2;
    if (icp.companySizes.length > 0 || icp.geographies.length > 0) {
      const savedY = y;

      if (icp.companySizes.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(...dark);
        doc.setFont('helvetica', 'bold');
        doc.text('Company Sizes', M, y);
        doc.setFont('helvetica', 'normal');
        y += 5;
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        icp.companySizes.forEach(size => {
          doc.text(`• ${size}`, M + 2, y);
          y += 4;
        });
      }

      const leftEndY = y;
      y = savedY;

      if (icp.geographies.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(...dark);
        doc.setFont('helvetica', 'bold');
        doc.text('Target Geographies', M + halfW + 6, y);
        doc.setFont('helvetica', 'normal');
        y += 5;
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        icp.geographies.forEach(geo => {
          doc.text(`• ${geo}`, M + halfW + 8, y);
          y += 4;
        });
      }

      y = Math.max(leftEndY, y) + 4;
    }

    // Persona Breakdown
    checkPageBreak(40);
    if (icp.personaJobTitles.length > 0 || icp.personaSeniorityLevels.length > 0 || icp.personaDepartments.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'bold');
      doc.text('Persona Targeting', M, y);
      doc.setFont('helvetica', 'normal');
      y += 6;

      // Seniority Levels
      if (icp.personaSeniorityLevels.length > 0) {
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'bold');
        doc.text('Seniority:', M, y);
        doc.setFont('helvetica', 'normal');
        doc.text(icp.personaSeniorityLevels.join(', '), M + 22, y);
        y += 5;
      }

      // Departments
      if (icp.personaDepartments.length > 0) {
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'bold');
        doc.text('Departments:', M, y);
        doc.setFont('helvetica', 'normal');
        const deptText = doc.splitTextToSize(icp.personaDepartments.join(', '), CW - 30);
        doc.text(deptText, M + 28, y);
        y += deptText.length * 4 + 3;
      }

      // Job Titles as pills
      if (icp.personaJobTitles.length > 0) {
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Titles:', M, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
        y = drawPills(icp.personaJobTitles.slice(0, 20), y, secondary, primary);
        y += 2;
      }
    }

    // Tech Stack
    checkPageBreak(30);
    if (icp.techStack.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'bold');
      doc.text('Technology Stack', M, y);
      doc.setFont('helvetica', 'normal');
      y += 5;
      y = drawPills(icp.techStack, y, [59, 130, 246], [255, 255, 255]);
      y += 4;
    }

    // Buying Signals & Pain Points side by side
    checkPageBreak(40);
    if (icp.buyingSignals.length > 0 || icp.painPoints.length > 0) {
      const savedY2 = y;

      if (icp.buyingSignals.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(...dark);
        doc.setFont('helvetica', 'bold');
        doc.text('Buying Signals', M, y);
        doc.setFont('helvetica', 'normal');
        y += 5;
        doc.setFontSize(8);
        icp.buyingSignals.forEach(signal => {
          doc.setTextColor(34, 197, 94);
          doc.text('▲', M + 2, y);
          doc.setTextColor(60, 60, 60);
          doc.text(signal, M + 6, y);
          y += 4.5;
        });
      }

      const leftEnd2 = y;
      y = savedY2;

      if (icp.painPoints.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(...dark);
        doc.setFont('helvetica', 'bold');
        doc.text('Pain Points', M + halfW + 6, y);
        doc.setFont('helvetica', 'normal');
        y += 5;
        doc.setFontSize(8);
        icp.painPoints.forEach(pain => {
          doc.setTextColor(239, 68, 68);
          doc.text('●', M + halfW + 8, y);
          doc.setTextColor(60, 60, 60);
          const painLines = doc.splitTextToSize(pain, halfW - 10);
          doc.text(painLines[0], M + halfW + 12, y);
          y += 4.5;
        });
      }

      y = Math.max(leftEnd2, y) + 4;
    }

    // AI ICP Analysis narrative
    if (data.aiNarratives?.icpAnalysis) {
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'bold');
      doc.text('AI ICP Analysis', M, y);
      doc.setFont('helvetica', 'normal');
      y += 2;
      doc.setFillColor(...primary);
      doc.rect(M, y, 30, 1, 'F');
      y += 5;

      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const analysisLines = doc.splitTextToSize(data.aiNarratives.icpAnalysis, CW);
      // Check if we need a new page for long analysis
      if (y + analysisLines.length * 4 > H - 20) {
        doc.addPage();
        addHeader('ICP Analysis (cont.)');
        y = 22;
      }
      doc.text(analysisLines, M, y);
      y += analysisLines.length * 4 + 4;
    }
  }

  // ─── Page: Strategic Position ────────────────────────────────────────────

  doc.addPage();
  addHeader('Strategic Position');
  sectionTitle('Strategic Position');

  // Revenue-framed narrative
  const met = data.metrics;
  const rm = data.revenueModeling;
  const samVal = data.sam;
  const somVal = data.som;
  const highFitPct = met.scoredAccounts > 0 ? Math.round((met.highFitAccounts / met.scoredAccounts) * 100) : 0;
  const marketCoverage = met.totalAccounts > 0 ? Math.round((met.scoredAccounts / met.totalAccounts) * 100) : 0;

  let narrative = '';
  if (data.aiNarratives?.executiveSummary) {
    narrative = data.aiNarratives.executiveSummary;
  } else {
    narrative = `Your addressable pipeline contains ${formatCurrency(samVal)} in modelled revenue across ${(met.highFitAccounts + met.mediumFitAccounts).toLocaleString()} qualified accounts. `;
    if (met.campaignReadyAccounts > 0) {
      narrative += `Of these, ${met.campaignReadyAccounts.toLocaleString()} are campaign-ready, representing ${formatCurrency(somVal)} in near-term pipeline at ${Math.round(convRate * 100)}% conversion and ${formatCurrency(acv)} ACV. `;
    }
    if (rm && rm.revenueAtRisk > 0) {
      narrative += `An estimated ${formatCurrency(rm.revenueAtRisk)} in pipeline value is at risk due to ${rm.unscoredAccounts.toLocaleString()} unscored and ${rm.lowDataAccounts.toLocaleString()} low-data accounts. `;
    }
    if (met.dataCompleteness >= 80) {
      narrative += `Data quality is strong at ${met.dataCompleteness}% completeness.`;
    } else {
      narrative += `Data completeness at ${met.dataCompleteness}% requires enrichment to unlock full pipeline value.`;
    }
  }

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const narrativeLines = doc.splitTextToSize(narrative, CW);
  doc.text(narrativeLines, M, y);
  y += narrativeLines.length * 5 + 8;

  // 4 Strategic KPIs
  const kpiWidth = (CW - 6) / 2;
  kpiCard('Pipeline Potential', formatCurrency(somVal), M, kpiWidth, `${met.campaignReadyAccounts.toLocaleString()} campaign-ready accounts`);
  kpiCard('Revenue at Risk', formatCurrency(rm?.revenueAtRisk || 0), M + kpiWidth + 6, kpiWidth, `${(rm?.unscoredAccounts || 0).toLocaleString()} unscored accounts`);
  y += 24;
  kpiCard('Market Coverage', `${marketCoverage}%`, M, kpiWidth, `${met.scoredAccounts.toLocaleString()} of ${met.totalAccounts.toLocaleString()} scored`);
  kpiCard('Data Readiness', `${met.dataCompleteness}%`, M + kpiWidth + 6, kpiWidth, `Across 6 key fields`);
  y += 24;

  // Score distribution bar with dollar values
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text('Score Distribution by Revenue Impact', M, y);
  doc.setFont('helvetica', 'normal');
  y += 6;

  const total = met.highFitAccounts + met.mediumFitAccounts + met.lowFitAccounts;
  if (total > 0) {
    const barW = CW;
    const barH = 10;
    const hW = (met.highFitAccounts / total) * barW;
    const mW = (met.mediumFitAccounts / total) * barW;
    const lW = (met.lowFitAccounts / total) * barW;

    doc.setFillColor(34, 197, 94);
    doc.roundedRect(M, y, hW, barH, 2, 2, 'F');
    doc.setFillColor(250, 204, 21);
    doc.rect(M + hW, y, mW, barH, 'F');
    doc.setFillColor(239, 68, 68);
    doc.roundedRect(M + hW + mW, y, lW, barH, 2, 2, 'F');

    y += barH + 5;
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    const highRev = formatCurrency(met.highFitAccounts * acv);
    const medRev = formatCurrency(met.mediumFitAccounts * acv);
    const lowRev = formatCurrency(met.lowFitAccounts * acv);
    doc.text(`High: ${met.highFitAccounts.toLocaleString()} (${highRev})  |  Medium: ${met.mediumFitAccounts.toLocaleString()} (${medRev})  |  Low: ${met.lowFitAccounts.toLocaleString()} (${lowRev})`, M, y);
  }

  // ─── Page: Revenue Model ────────────────────────────────────────────────

  doc.addPage();
  addHeader('Revenue Model');
  sectionTitle('Revenue Model');

  // TAM/SAM/SOM funnel with dollar values
  const funnelData = [
    { label: 'TAM — Total Addressable Market', value: data.tam, count: met.totalAccounts, color: lightenRgb(primary, 0.6) },
    { label: 'SAM — Serviceable Available Market', value: data.sam, count: met.highFitAccounts + met.mediumFitAccounts, color: lightenRgb(primary, 0.3) },
    { label: 'SOM — Serviceable Obtainable Market', value: data.som, count: met.campaignReadyAccounts, color: primary },
  ];
  const maxFunnelW = CW - 20;
  const funnelH = 24;

  funnelData.forEach((item, i) => {
    const ratio = data.tam > 0 ? Math.max(item.value / data.tam, 0.15) : (1 - i * 0.3);
    const barWidth = maxFunnelW * ratio;
    const xOffset = M + (maxFunnelW - barWidth) / 2 + 10;

    doc.setFillColor(...item.color);
    doc.roundedRect(xOffset, y, barWidth, funnelH, 3, 3, 'F');

    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(item.value), xOffset + barWidth / 2, y + 10, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.count.toLocaleString()} accounts`, xOffset + barWidth / 2, y + 16, { align: 'center' });
    doc.setFontSize(6);
    doc.text(item.label, xOffset + barWidth / 2, y + 21, { align: 'center' });

    y += funnelH + 5;
  });

  // AI TAM narrative
  if (data.aiNarratives?.tamNarrative) {
    y += 2;
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const tamLines = doc.splitTextToSize(data.aiNarratives.tamNarrative, CW);
    doc.text(tamLines, M, y);
    y += tamLines.length * 4 + 4;
  }

  y += 4;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(M, y, CW, 18, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'bold');
  doc.text('Modeling Assumptions', M + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Average Contract Value (ACV): ${formatCurrency(acv)}  |  Conversion Rate: ${Math.round(convRate * 100)}%  |  Pipeline = Accounts × ACV × Conv%`, M + 4, y + 13);
  y += 24;

  // Revenue range breakdown (more meaningful for B2B)
  if (data.revenueRangeBreakdown && data.revenueRangeBreakdown.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text('Market by Revenue Range', M, y);
    doc.setFont('helvetica', 'normal');
    y += 8;

    const revCols = [
      { label: 'Revenue Range', x: M },
      { label: 'Accounts', x: M + 80 },
      { label: '% Share', x: M + 120 },
      { label: 'Est. Pipeline', x: W - M, align: 'right' },
    ];
    tableHeader(revCols);

    data.revenueRangeBreakdown.slice(0, 10).forEach((item, i) => {
      checkPageBreak(9);
      const estPipeline = formatCurrency(item.accounts * acv * convRate);
      tableRow([
        { text: item.name, x: M },
        { text: safeNum(item.accounts).toLocaleString(), x: M + 80 },
        { text: `${safeNum(item.percentage).toFixed(1)}%`, x: M + 120 },
        { text: estPipeline, x: W - M, align: 'right' },
      ], i);
    });
    y += 6;
  }

  // Size breakdown
  if (data.sizeBreakdown.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text('Market by Company Size', M, y);
    doc.setFont('helvetica', 'normal');
    y += 8;

    const sizeCols = [
      { label: 'Size Range', x: M },
      { label: 'Accounts', x: M + 80 },
      { label: '% Share', x: M + 120 },
      { label: 'Est. Pipeline', x: W - M, align: 'right' },
    ];
    tableHeader(sizeCols);

    data.sizeBreakdown.filter(s => s.name !== 'Unknown').forEach((item, i) => {
      checkPageBreak(9);
      const estPipeline = formatCurrency(item.accounts * acv * convRate);
      tableRow([
        { text: item.name, x: M },
        { text: safeNum(item.accounts).toLocaleString(), x: M + 80 },
        { text: `${safeNum(item.percentage).toFixed(1)}%`, x: M + 120 },
        { text: estPipeline, x: W - M, align: 'right' },
      ], i);
    });
  }

  // ─── Page: Segment Prioritization ───────────────────────────────────────

  doc.addPage();
  addHeader('Segment Prioritization');
  sectionTitle('Segment Prioritization');

  if (data.aiNarratives?.industryInsights) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const insightLines = doc.splitTextToSize(data.aiNarratives.industryInsights, CW);
    doc.text(insightLines, M, y);
    y += insightLines.length * 4 + 4;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Industries ranked by modelled revenue potential. Action recommendations based on high-fit concentration and volume.', M, y);
    y += 8;
  }

  if (data.industryBreakdown.length > 0) {
    const medianCount = data.industryBreakdown.length > 0
      ? data.industryBreakdown[Math.floor(data.industryBreakdown.length / 2)].accounts
      : 0;

    const segCols = [
      { label: 'Industry', x: M },
      { label: 'Accts', x: M + 58 },
      { label: 'Hi-Fit %', x: M + 78 },
      { label: 'Avg Score', x: M + 100 },
      { label: 'Model Rev', x: M + 125 },
      { label: 'Action', x: W - M, align: 'right' },
    ];
    tableHeader(segCols);

    data.industryBreakdown.slice(0, 10).forEach((item, i) => {
      checkPageBreak(8);
      const hfPct = item.highFitPct || 0;
      const modelledRev = (item.highFitCount || 0) * acv * convRate;
      const action = deriveSegmentAction(hfPct, item.accounts, medianCount);
      const actionColor: [number, number, number] = action === 'Focus' ? [34, 197, 94] : action === 'Expand' ? [59, 130, 246] : action === 'Maintain' ? [202, 138, 4] : [239, 68, 68];

      tableRow([
        { text: item.name.substring(0, 30), x: M },
        { text: safeNum(item.accounts).toLocaleString(), x: M + 58 },
        { text: `${hfPct.toFixed(0)}%`, x: M + 78 },
        { text: String(item.avgScore || 0), x: M + 100 },
        { text: formatCurrency(modelledRev), x: M + 125 },
        { text: action, x: W - M, align: 'right', color: actionColor, bold: true },
      ], i);
    });
  }

  // ─── Page: Geographic Strategy ──────────────────────────────────────────

  doc.addPage();
  addHeader('Geographic Strategy');
  sectionTitle('Geographic Strategy');

  const normalizedGeo = normalizeAndMergeGeo(data.geographyDistribution);

  if (normalizedGeo.length > 0) {
    if (data.aiNarratives?.geoInsights) {
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const geoLines = doc.splitTextToSize(data.aiNarratives.geoInsights, CW);
      doc.text(geoLines, M, y);
      y += geoLines.length * 4 + 4;
    } else {
      const top3 = normalizedGeo.slice(0, 3);
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      top3.forEach((g, i) => {
        const tag = deriveGeoTag(g.percentage, g.avgScore);
        const tagLabel = tag === 'Core' ? '● Core Market' : tag === 'Growth' ? '▲ Growth Opportunity' : tag === 'Review' ? '◆ Under Review' : '○ Monitor';
        doc.text(`${i + 1}. ${g.country}: ${tagLabel} — ${g.accounts.toLocaleString()} accounts, avg score ${g.avgScore}`, M, y);
        y += 5;
      });
    }
    y += 4;

    const geoCols = [
      { label: 'Country', x: M },
      { label: 'Accounts', x: M + 55 },
      { label: '% Share', x: M + 82 },
      { label: 'Avg Score', x: M + 105 },
      { label: 'Est. Pipeline', x: M + 130 },
      { label: 'Strategy', x: W - M, align: 'right' },
    ];
    tableHeader(geoCols);

    normalizedGeo.slice(0, 12).forEach((item, i) => {
      checkPageBreak(8);
      const tag = deriveGeoTag(item.percentage, item.avgScore);
      const estPipeline = formatCurrency(item.accounts * acv * convRate * (item.avgScore / 100));
      const tagColor: [number, number, number] = tag === 'Core' ? [34, 197, 94] : tag === 'Growth' ? [59, 130, 246] : tag === 'Review' ? [202, 138, 4] : [100, 100, 100];

      tableRow([
        { text: item.country.substring(0, 22), x: M },
        { text: item.accounts.toLocaleString(), x: M + 55 },
        { text: `${item.percentage.toFixed(1)}%`, x: M + 82 },
        { text: String(item.avgScore), x: M + 105 },
        { text: estPipeline, x: M + 130 },
        { text: tag, x: W - M, align: 'right', color: tagColor, bold: true },
      ], i);
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No geographic data available.', M, y);
  }

  // ─── Page: Top 10 Revenue Opportunities ─────────────────────────────────

  doc.addPage();
  addHeader('Top Revenue Opportunities');
  sectionTitle('Top 10 Revenue Opportunities');

  if (data.topProspects.length > 0) {
    const prospCols = [
      { label: 'Company', x: M },
      { label: 'Industry', x: M + 32 },
      { label: 'Revenue', x: M + 62 },
      { label: 'Fit', x: M + 88 },
      { label: 'Intent', x: M + 100 },
      { label: 'Leads', x: M + 115 },
      { label: 'Readiness', x: M + 132 },
      { label: 'Next Action', x: W - M, align: 'right' },
    ];
    tableHeader(prospCols);

    data.topProspects.slice(0, 10).forEach((p, i) => {
      checkPageBreak(8);

      const readiness = deriveStageReadiness(safeNum(p.intentScore));
      const nextAction = deriveNextAction(safeNum(p.fitScore), safeNum(p.intentScore), p.leadCount || 0);
      const readinessColor: [number, number, number] = readiness === 'Ready' ? [34, 197, 94] : readiness === 'Warming' ? [250, 204, 21] : [100, 100, 100];
      const actionColor: [number, number, number] = nextAction === 'Engage Now' ? [34, 197, 94] : nextAction === 'Accelerate' ? [59, 130, 246] : nextAction === 'Source Contacts' ? [239, 68, 68] : [202, 138, 4];

      tableRow([
        { text: (p.name || 'N/A').substring(0, 22), x: M },
        { text: (p.industry || 'N/A').substring(0, 18), x: M + 32 },
        { text: (p.revenueRange || 'N/A').substring(0, 14), x: M + 62 },
        { text: String(safeNum(p.fitScore)), x: M + 88 },
        { text: String(safeNum(p.intentScore)), x: M + 100 },
        { text: String(p.leadCount ?? 0), x: M + 115 },
        { text: readiness, x: M + 132, color: readinessColor, bold: true },
        { text: nextAction, x: W - M, align: 'right', color: actionColor, bold: true },
      ], i);
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No scored prospects available.', M, y);
  }

  // ─── Page: Revenue Leakage & Risk ──────────────────────────────────────

  doc.addPage();
  addHeader('Revenue Leakage & Risk');
  sectionTitle('Revenue Leakage & Risk');

  const leakageVal = rm?.revenueAtRisk || 0;
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(M, y, CW, 22, 3, 3, 'F');
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(M, y, 4, 22, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setTextColor(220, 38, 38);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTIMATED REVENUE LEAKAGE', M + 10, y + 7);
  doc.setFontSize(18);
  doc.text(formatCurrency(leakageVal), M + 10, y + 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 70, 70);
  doc.text(`${(rm?.unscoredAccounts || 0).toLocaleString()} unscored + ${(rm?.lowDataAccounts || 0).toLocaleString()} low-data accounts × ${formatCurrency(acv)} ACV × ${Math.round(convRate * 100)}% conv`, M + 10, y + 22, { maxWidth: CW - 20 });
  y += 30;

  // Risks with dollar impact
  if (data.risks.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text('Identified Risks', M, y);
    doc.setFont('helvetica', 'normal');
    y += 8;

    data.risks.forEach((risk) => {
      checkPageBreak(22);

      const sColor = severityColor(risk.severity);
      doc.setFillColor(...sColor);
      doc.roundedRect(M, y - 3, CW, 1.5, 0.5, 0.5, 'F');
      y += 2;

      doc.setFillColor(...sColor);
      doc.roundedRect(M, y - 3, 22, 7, 2, 2, 'F');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(risk.severity.toUpperCase(), M + 2, y + 1);

      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(risk.title, M + 26, y + 1);

      const riskDollar = risk.count * acv * convRate;
      doc.setFontSize(8);
      doc.setTextColor(220, 38, 38);
      doc.text(`~${formatCurrency(riskDollar)} at risk`, W - M, y + 1, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 7;

      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const riskLines = doc.splitTextToSize(risk.description, CW - 8);
      doc.text(riskLines, M + 4, y);
      y += riskLines.length * 4 + 4;
    });
  }

  // AI key findings
  y += 4;
  checkPageBreak(30);

  if (data.aiNarratives?.keyFindings && data.aiNarratives.keyFindings.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text('AI Key Findings', M, y);
    doc.setFont('helvetica', 'normal');
    y += 8;

    data.aiNarratives.keyFindings.slice(0, 5).forEach((finding) => {
      checkPageBreak(20);
      doc.setFillColor(...lightenRgb(primary, 0.92));
      doc.roundedRect(M, y - 3, CW, 18, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.text(finding.title, M + 4, y + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(70, 70, 70);
      const detailLines = doc.splitTextToSize(finding.detail, CW - 12);
      doc.text(detailLines.slice(0, 2), M + 4, y + 7);
      doc.setFontSize(7);
      doc.setTextColor(...primary);
      doc.text(`Impact: ${finding.impact}`, M + 4, y + 14);
      y += 22;
    });
  } else if (data.insights.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text('Strategic Intelligence', M, y);
    doc.setFont('helvetica', 'normal');
    y += 8;

    const topInsights = data.insights.slice(0, 3);
    topInsights.forEach((insight) => {
      checkPageBreak(16);
      doc.setFillColor(...lightenRgb(primary, 0.92));
      doc.roundedRect(M, y - 3, CW, 14, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.text(insight.title, M + 4, y + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(70, 70, 70);
      const descLines = doc.splitTextToSize(insight.description, CW - 12);
      doc.text(descLines.slice(0, 2), M + 4, y + 7);
      y += 18;
    });
  }

  // AI Risk Assessment
  if (data.aiNarratives?.riskAssessment && data.aiNarratives.riskAssessment.length > 0) {
    checkPageBreak(30);
    y += 4;
    doc.setFontSize(12);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text('AI Risk Assessment', M, y);
    doc.setFont('helvetica', 'normal');
    y += 8;

    data.aiNarratives.riskAssessment.forEach((risk) => {
      checkPageBreak(18);
      const sColor = severityColor(risk.severity);
      doc.setFillColor(...sColor);
      doc.roundedRect(M, y - 3, CW, 1.5, 0.5, 0.5, 'F');
      y += 2;

      doc.setFillColor(...sColor);
      doc.roundedRect(M, y - 3, 22, 7, 2, 2, 'F');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(risk.severity.toUpperCase(), M + 2, y + 1);

      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(risk.risk.substring(0, 90), M + 26, y + 1);
      doc.setFont('helvetica', 'normal');
      y += 7;

      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const mitLines = doc.splitTextToSize(`Mitigation: ${risk.mitigation}`, CW - 8);
      doc.text(mitLines, M + 4, y);
      y += mitLines.length * 4 + 4;
    });
  }

  // ─── Page: Strategic Recommendations ──────────────────────────────────

  if (data.aiNarratives?.strategicRecommendations && data.aiNarratives.strategicRecommendations.length > 0) {
    doc.addPage();
    addHeader('Strategic Recommendations');
    sectionTitle('AI Strategic Recommendations');

    data.aiNarratives.strategicRecommendations.forEach((rec, i) => {
      checkPageBreak(24);

      const priorityColor: [number, number, number] =
        rec.priority === 'critical' ? [220, 38, 38] :
        rec.priority === 'high' ? [234, 88, 12] : [202, 138, 4];

      doc.setFillColor(...priorityColor);
      doc.roundedRect(M, y - 2, 22, 7, 2, 2, 'F');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(rec.priority.toUpperCase(), M + 2, y + 2);

      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const actionLines = doc.splitTextToSize(rec.action, CW - 30);
      doc.text(actionLines[0], M + 26, y + 2);
      doc.setFont('helvetica', 'normal');
      y += 9;

      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const rationaleLines = doc.splitTextToSize(rec.rationale, CW - 8);
      doc.text(rationaleLines, M + 4, y);
      y += rationaleLines.length * 4 + 8;
    });
  }

  // ─── Page: 90-Day Execution Plan ────────────────────────────────────────

  doc.addPage();
  addHeader('90-Day Execution Plan');
  sectionTitle('90-Day Execution Plan');

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Phased plan to convert data intelligence into pipeline and revenue.', M, y);
  y += 8;

  const unscoredCount = rm?.unscoredAccounts || 0;
  const lowDataCount = rm?.lowDataAccounts || 0;
  const campaignReady = met.campaignReadyAccounts;
  const highFitNoLeads = data.risks.find(r => r.id === 'high-fit-no-leads')?.count || 0;

  const underservedSegments = data.industryBreakdown
    .filter(i => (i.highFitPct || 0) >= 30 && i.accounts < 200)
    .slice(0, 3)
    .map(i => i.name);

  const phases = [
    {
      title: 'PHASE 1: Foundation (Days 1–30)',
      color: [59, 130, 246] as [number, number, number],
      actions: [
        { action: `Score remaining ${unscoredCount.toLocaleString()} unscored accounts`, target: unscoredCount.toLocaleString(), impact: formatCurrency(unscoredCount * acv * convRate) },
        { action: `Enrich ${lowDataCount.toLocaleString()} low-data accounts to improve scoring accuracy`, target: lowDataCount.toLocaleString(), impact: 'Improved accuracy' },
        { action: 'Validate ICP criteria against latest closed-won data', target: '—', impact: 'Scoring precision' },
      ],
    },
    {
      title: 'PHASE 2: Activation (Days 31–60)',
      color: [34, 197, 94] as [number, number, number],
      actions: [
        { action: `Launch campaigns targeting ${campaignReady.toLocaleString()} campaign-ready accounts`, target: campaignReady.toLocaleString(), impact: formatCurrency(somVal) },
        { action: `Source contacts for ${highFitNoLeads.toLocaleString()} high-fit accounts missing leads`, target: highFitNoLeads.toLocaleString(), impact: formatCurrency(highFitNoLeads * acv * convRate) },
        { action: 'Activate intent-based triggers for "Ready" accounts', target: '—', impact: 'Faster conversion' },
      ],
    },
    {
      title: 'PHASE 3: Expansion (Days 61–90)',
      color: [168, 85, 247] as [number, number, number],
      actions: [
        { action: `Expand into underserved segments: ${underservedSegments.length > 0 ? underservedSegments.join(', ') : 'TBD'}`, target: '—', impact: 'New pipeline' },
        { action: 'Deploy multi-threading strategy for top 10 accounts', target: '10', impact: 'Deal velocity' },
        { action: 'Review and optimize ICP scoring model based on 60-day results', target: '—', impact: 'Continuous improvement' },
      ],
    },
  ];

  phases.forEach((phase) => {
    checkPageBreak(50);

    doc.setFillColor(...phase.color);
    doc.roundedRect(M, y - 2, CW, 10, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(phase.title, M + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    y += 14;

    const phaseCols = [
      { label: 'Action', x: M },
      { label: 'Target', x: M + 115 },
      { label: 'Revenue Impact', x: W - M, align: 'right' },
    ];
    tableHeader(phaseCols);

    phase.actions.forEach((a, i) => {
      checkPageBreak(8);
      const actionLines = doc.splitTextToSize(a.action, 105);
      tableRow([
        { text: actionLines[0], x: M },
        { text: a.target, x: M + 115 },
        { text: a.impact, x: W - M, align: 'right', color: [34, 197, 94] },
      ], i);
      if (actionLines.length > 1) {
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.text(actionLines.slice(1), M, y - 3);
        y += (actionLines.length - 1) * 4;
      }
    });

    y += 6;
  });

  // Owner placeholder
  checkPageBreak(12);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(M, y, CW, 10, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'italic');
  doc.text('Owner: ______________________    Reviewed: ______________________    Next Review: ______________________', M + 4, y + 6);
  doc.setFont('helvetica', 'normal');

  // ─── Footers on all pages ─────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  const fileName = `${companyName.replace(/\s+/g, '_')}_Strategic_Brief_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
