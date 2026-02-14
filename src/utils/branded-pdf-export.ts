import jsPDF from 'jspdf';
import { BrandConfig } from '@/hooks/useBrandedConfig';
import { RiskItem } from '@/utils/risk-detector';
import { ICPInsight } from '@/hooks/use-icp-insights';

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
    revenueRange?: string;
    leadCount?: number;
  }>;

  // Page 7 – AI Insights
  insights: ICPInsight[];

  // Page 8 – Risks & Next Steps
  risks: RiskItem[];

  // Lead stats
  leadStats?: {
    totalLeads: number;
    leadCoverage: number;
    leadsPerAccount: number;
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
  geo: Array<{ country: string; accounts: number; percentage: number }>
): Array<{ country: string; accounts: number; percentage: number }> {
  const merged = new Map<string, number>();
  geo.forEach(g => {
    const name = normalizeCountryName(g.country);
    merged.set(name, (merged.get(name) || 0) + g.accounts);
  });
  const totalAccounts = Array.from(merged.values()).reduce((s, v) => s + v, 0);
  return Array.from(merged.entries())
    .map(([country, accounts]) => ({
      country,
      accounts,
      percentage: totalAccounts > 0 ? (accounts / totalAccounts) * 100 : 0,
    }))
    .sort((a, b) => b.accounts - a.accounts);
}

function hexToRgb(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null;
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return null;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

function getBrandColors(brand: BrandConfig | null) {
  const primary = hexToRgb(brand?.brand_primary_color) ?? DEFAULT_PRIMARY;
  const secondary = hexToRgb(brand?.brand_secondary_color) ?? DEFAULT_SECONDARY;
  const dark = DEFAULT_DARK;
  return { primary, secondary, dark };
}

function lightenRgb(rgb: [number, number, number], factor = 0.85): [number, number, number] {
  return rgb.map(c => Math.round(c + (255 - c) * factor)) as [number, number, number];
}

function normalizeConfidence(val: number): number {
  if (val > 1) return Math.min(Math.round(val), 100);
  return Math.round(val * 100);
}

function safeNum(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/** Generate enriched executive narrative */
function generateNarrative(data: BrandedReportData): string {
  const m = data.metrics;
  const highPct = m.scoredAccounts > 0 ? Math.round((m.highFitAccounts / m.scoredAccounts) * 100) : 0;
  const scoredPct = m.totalAccounts > 0 ? Math.round((m.scoredAccounts / m.totalAccounts) * 100) : 0;

  let narrative = `Your ICP analysis covers ${m.totalAccounts.toLocaleString()} accounts`;
  if (m.scoredAccounts > 0) {
    narrative += `, of which ${m.scoredAccounts.toLocaleString()} (${scoredPct}%) have been scored`;
  }
  narrative += '. ';

  // TAM/SAM context
  if (data.tam > 0) {
    narrative += `Your Total Addressable Market spans ${data.tam.toLocaleString()} accounts, with ${data.sam.toLocaleString()} in your Serviceable Available Market (high and medium-fit). `;
  }

  if (highPct >= 50) {
    narrative += `${highPct}% are high-fit, indicating strong market alignment. `;
  } else if (highPct >= 20) {
    narrative += `${highPct}% are high-fit, showing a focused addressable market. `;
  } else {
    narrative += `Only ${highPct}% are high-fit — consider refining your ICP criteria for better targeting. `;
  }

  if (m.campaignReadyAccounts > 0) {
    narrative += `${m.campaignReadyAccounts.toLocaleString()} accounts are campaign-ready for immediate outreach. `;
  }

  // ICP profile context
  if (data.icpProfiles.length > 0) {
    const topIcp = data.icpProfiles[0];
    const conf = normalizeConfidence(topIcp.confidence);
    narrative += `Your active ICP profile "${topIcp.name}" matches ${safeNum(topIcp.matchCount).toLocaleString()} accounts at ${conf}% confidence. `;
  }

  // Geographic headline
  if (data.geographyDistribution.length > 0) {
    const uniqueCountries = new Set(data.geographyDistribution.map(g => g.country)).size;
    const top3 = data.geographyDistribution.slice(0, 3);
    const top3Pct = top3.reduce((s, g) => s + g.percentage, 0);
    narrative += `Operations span ${uniqueCountries} countries, with ${top3Pct.toFixed(0)}% concentration in the top 3 markets. `;
  }

  if (data.leadStats && data.leadStats.totalLeads > 0) {
    narrative += `Your database includes ${data.leadStats.totalLeads.toLocaleString()} leads (${data.leadStats.leadsPerAccount}x per account). `;
  }

  if (m.dataCompleteness < 60) {
    narrative += `Data completeness is at ${m.dataCompleteness}% — enrichment is recommended to improve scoring accuracy.`;
  } else if (m.dataCompleteness < 80) {
    narrative += `Data completeness stands at ${m.dataCompleteness}%, with room for improvement through targeted enrichment.`;
  } else {
    narrative += `Data quality is strong at ${m.dataCompleteness}% completeness.`;
  }

  return narrative;
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
  const { primary, secondary, dark } = getBrandColors(brand);
  const lightBg = lightenRgb(primary, 0.92);
  const companyName = brand?.company_name || data.companyName || 'Organization';
  const isLaunchPulse = companyName.toLowerCase().replace(/\s/g, '') === 'launchpulse';

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

  const tableHeader = (cols: { label: string; x: number }[]) => {
    doc.setFillColor(...dark);
    doc.rect(M, y - 5, CW, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primary);
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

  const severityColor = (severity: string): [number, number, number] => {
    switch (severity) {
      case 'critical': return [220, 38, 38];
      case 'high': return [234, 88, 12];
      case 'medium': return [202, 138, 4];
      case 'low': return [22, 163, 74];
      default: return [100, 100, 100];
    }
  };

  const priorityColor = (priority: string): [number, number, number] => {
    switch (priority) {
      case 'high': return [220, 38, 38];
      case 'medium': return [202, 138, 4];
      case 'low': return [22, 163, 74];
      default: return [100, 100, 100];
    }
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
  doc.text('ICP & Market Intelligence', W / 2, 115, { align: 'center' });
  doc.text('Board Report', W / 2, 127, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(160, 170, 180);
  doc.text(data.generatedAt, W / 2, 150, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(100, 110, 120);
  const coverFooter = isLaunchPulse ? 'Powered by LaunchPulse' : `Prepared by ${companyName} using LaunchPulse`;
  doc.text(coverFooter, W / 2, H - 25, { align: 'center' });

  // ─── Page 2: Executive Summary ────────────────────────────────────────────

  doc.addPage();
  addHeader('Executive Summary');
  sectionTitle('Executive Summary');

  const narrative = generateNarrative(data);
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const narrativeLines = doc.splitTextToSize(narrative, CW);
  doc.text(narrativeLines, M, y);
  y += narrativeLines.length * 5 + 6;

  const met = data.metrics;
  const highFitPct = met.scoredAccounts > 0 ? Math.round((met.highFitAccounts / met.scoredAccounts) * 100) : 0;

  const metricItems = [
    { label: 'Total Accounts', value: met.totalAccounts.toLocaleString() },
    { label: 'Scored Accounts', value: met.scoredAccounts.toLocaleString() },
    { label: 'High-Fit Accounts', value: `${met.highFitAccounts.toLocaleString()} (${highFitPct}%)` },
    { label: 'Medium-Fit Accounts', value: met.mediumFitAccounts.toLocaleString() },
    { label: 'Campaign-Ready', value: met.campaignReadyAccounts.toLocaleString() },
    { label: 'Data Completeness', value: `${met.dataCompleteness}%` },
    ...(data.leadStats ? [
      { label: 'Total Leads', value: data.leadStats.totalLeads.toLocaleString() },
      { label: 'Leads per Account', value: data.leadStats.leadsPerAccount ? `${data.leadStats.leadsPerAccount}x` : `${data.leadStats.leadCoverage}%` },
    ] : []),
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
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, xBase + 4, y + 9);
    doc.setFont('helvetica', 'normal');

    if (col === 1) y += 18;
  });
  if (metricItems.length % 2 !== 0) y += 18;

  y += 6;

  // Score distribution bar
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text('Score Distribution', M, y);
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
    doc.text(`High: ${met.highFitAccounts}  |  Medium: ${met.mediumFitAccounts}  |  Low: ${met.lowFitAccounts}`, M, y);
  }

  // ─── Page 3: ICP Profile Deep Dive ────────────────────────────────────────

  doc.addPage();
  addHeader('ICP Profile Deep Dive');
  sectionTitle('ICP Profile Deep Dive');

  if (data.icpProfiles.length > 0) {
    data.icpProfiles.forEach((p, idx) => {
      if (idx > 0) checkPageBreak(60);

      // Profile card header
      doc.setFillColor(...lightenRgb(primary, 0.88));
      doc.roundedRect(M, y - 4, CW, 10, 2, 2, 'F');
      doc.setFontSize(11);
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'bold');
      doc.text(p.name || 'Unnamed Profile', M + 4, y + 3);
      // Confidence badge
      const conf = normalizeConfidence(p.confidence);
      const confColor: [number, number, number] = conf >= 70 ? [34, 197, 94] : conf >= 40 ? [250, 204, 21] : [239, 68, 68];
      doc.setFillColor(...confColor);
      doc.roundedRect(W - M - 30, y - 3, 26, 8, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`${conf}% conf`, W - M - 28, y + 2);
      doc.setFont('helvetica', 'normal');
      y += 12;

      // Details grid
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      if (p.targetIndustries.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Target Industries:', M + 4, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
        doc.text(p.targetIndustries.slice(0, 8).join(', '), M + 8, y);
        y += 5;
      }
      if (p.companySizes.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Company Sizes:', M + 4, y);
        doc.setFont('helvetica', 'normal');
        doc.text(p.companySizes.join(', '), M + 40, y);
        y += 5;
      }
      if (p.geographies.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Geographies:', M + 4, y);
        doc.setFont('helvetica', 'normal');
        doc.text(p.geographies.slice(0, 8).join(', '), M + 38, y);
        y += 5;
      }

      // Key metrics row
      y += 2;
      const metricsRow = [
        `Matching Accounts: ${safeNum(p.matchCount).toLocaleString()}`,
        `TAM Estimate: ${safeNum(p.tamEstimate).toLocaleString()}`,
      ];
      if (data.tam > 0 && p.tamEstimate > 0) {
        metricsRow.push(`TAM Coverage: ${((p.tamEstimate / data.tam) * 100).toFixed(1)}%`);
      }
      doc.setFillColor(...lightenRgb(primary, 0.95));
      doc.roundedRect(M + 2, y - 3, CW - 4, 8, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'bold');
      doc.text(metricsRow.join('   |   '), M + 6, y + 2);
      doc.setFont('helvetica', 'normal');
      y += 14;
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

  // Visual funnel
  const funnelData = [
    { label: 'TAM — Total Addressable Market', value: data.tam, color: lightenRgb(primary, 0.6) },
    { label: 'SAM — Serviceable Available Market', value: data.sam, color: lightenRgb(primary, 0.3) },
    { label: 'SOM — Serviceable Obtainable Market', value: data.som, color: primary },
  ];
  const maxFunnelW = CW - 20;
  const funnelH = 22;

  funnelData.forEach((item, i) => {
    const ratio = data.tam > 0 ? Math.max(item.value / data.tam, 0.15) : (1 - i * 0.3);
    const barWidth = maxFunnelW * ratio;
    const xOffset = M + (maxFunnelW - barWidth) / 2 + 10;

    doc.setFillColor(...item.color);
    doc.roundedRect(xOffset, y, barWidth, funnelH, 3, 3, 'F');

    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`${safeNum(item.value).toLocaleString()}`, xOffset + barWidth / 2, y + 9, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, xOffset + barWidth / 2, y + 16, { align: 'center' });

    y += funnelH + 4;
  });

  y += 6;

  // Industry breakdown
  if (data.industryBreakdown.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text('Industry Breakdown (Scored Accounts)', M, y);
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
        { text: safeNum(item.accounts).toLocaleString(), x: M + 100 },
        { text: `${safeNum(item.percentage).toFixed(1)}%`, x: M + 140 },
      ], i);
    });
  }

  // Size breakdown
  y += 6;
  if (data.sizeBreakdown.length > 0 && !checkPageBreak(40)) {
    doc.setFontSize(12);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text('Company Size Breakdown (Scored Accounts)', M, y);
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
        { text: safeNum(item.accounts).toLocaleString(), x: M + 100 },
        { text: `${safeNum(item.percentage).toFixed(1)}%`, x: M + 140 },
      ], i);
    });
  }

  // ─── Page 5: Geographic Analysis ──────────────────────────────────────────

  doc.addPage();
  addHeader('Geographic Analysis');
  sectionTitle('Geographic Distribution');

  const normalizedGeo = normalizeAndMergeGeo(data.geographyDistribution);

  if (normalizedGeo.length > 0) {
    const top3 = normalizedGeo.slice(0, 3);
    const top3Pct = top3.reduce((sum, g) => sum + safeNum(g.percentage), 0);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Top 3 markets represent ${top3Pct.toFixed(1)}% of all accounts`, M, y);
    y += 10;

    normalizedGeo.slice(0, 10).forEach((item, i) => {
      checkPageBreak(12);
      const pct = safeNum(item.percentage);
      const barWidth = (pct / 100) * (CW - 60);

      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      doc.text(item.country.substring(0, 20), M, y + 3);

      doc.setFillColor(...lightenRgb(primary, 0.7));
      doc.roundedRect(M + 50, y - 1, Math.max(barWidth, 1), 6, 1, 1, 'F');

      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text(`${safeNum(item.accounts).toLocaleString()} (${pct.toFixed(1)}%)`, M + 55 + barWidth, y + 3);

      y += 10;
    });

    if (normalizedGeo.length > 10) {
      y += 4;
      const geoCols = [
        { label: 'Country', x: M },
        { label: 'Accounts', x: M + 100 },
        { label: '% Share', x: M + 140 },
      ];
      tableHeader(geoCols);
      normalizedGeo.slice(10, 25).forEach((item, i) => {
        checkPageBreak(8);
        tableRow([
          { text: item.country.substring(0, 45), x: M },
          { text: safeNum(item.accounts).toLocaleString(), x: M + 100 },
          { text: `${safeNum(item.percentage).toFixed(1)}%`, x: M + 140 },
        ], i);
      });
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No geographic data available.', M, y);
  }

  // ─── Page 6: Top 10 Priority Accounts ─────────────────────────────────────

  doc.addPage();
  addHeader('Top Priority Accounts');
  sectionTitle('Top 10 Priority Accounts');

  if (data.topProspects.length > 0) {
    const prospCols = [
      { label: 'Company', x: M },
      { label: 'Industry', x: M + 38 },
      { label: 'Size', x: M + 72 },
      { label: 'Revenue', x: M + 92 },
      { label: 'Leads', x: M + 118 },
      { label: 'Fit', x: M + 134 },
      { label: 'Intent', x: M + 148 },
      { label: 'Score', x: M + 165 },
    ];
    tableHeader(prospCols);

    data.topProspects.slice(0, 10).forEach((p, i) => {
      checkPageBreak(8);

      const scoreColor: [number, number, number] = safeNum(p.overallScore) >= 70
        ? [34, 197, 94] : safeNum(p.overallScore) >= 40
        ? [250, 204, 21] : [239, 68, 68];

      if (i % 2 === 0) {
        doc.setFillColor(...lightBg);
        doc.rect(M, y - 4, CW, 7, 'F');
      }
      doc.setFontSize(7);
      doc.setTextColor(50, 50, 50);
      doc.text((p.name || 'N/A').substring(0, 18), M, y);
      doc.text((p.industry || 'N/A').substring(0, 16), M + 38, y);
      doc.text((p.size || 'N/A').substring(0, 10), M + 72, y);
      doc.text((p.revenueRange || 'N/A').substring(0, 12), M + 92, y);
      doc.text(String(p.leadCount ?? 0), M + 118, y);
      doc.text(String(safeNum(p.fitScore)), M + 134, y);
      doc.text(String(safeNum(p.intentScore)), M + 148, y);

      doc.setTextColor(...scoreColor);
      doc.setFont('helvetica', 'bold');
      doc.text(String(safeNum(p.overallScore)), M + 165, y);
      doc.setFont('helvetica', 'normal');
      y += 7;
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No scored prospects available.', M, y);
  }

  // ─── Page 7: AI Insights & Risks (consolidated) ──────────────────────────

  doc.addPage();
  addHeader('AI Insights & Recommendations');
  sectionTitle('AI-Powered Insights');

  if (data.insights.length > 0) {
    // Cap to top 6 insights (2 high, 2 medium, 2 low) to fit one page
    const byPriority: Record<string, ICPInsight[]> = { high: [], medium: [], low: [] };
    data.insights.forEach(ins => {
      const key = ins.priority || 'medium';
      if (!byPriority[key]) byPriority[key] = [];
      byPriority[key].push(ins);
    });

    const capped: ICPInsight[] = [
      ...byPriority.high.slice(0, 2),
      ...byPriority.medium.slice(0, 2),
      ...byPriority.low.slice(0, 2),
    ];

    (['high', 'medium', 'low'] as const).forEach(prio => {
      const items = capped.filter(i => (i.priority || 'medium') === prio);
      if (items.length === 0) return;

      checkPageBreak(20);

      const prioLabel = prio.charAt(0).toUpperCase() + prio.slice(1) + ' Priority';
      doc.setFillColor(...priorityColor(prio));
      doc.roundedRect(M, y - 3, 4, 8, 1, 1, 'F');
      doc.setFontSize(11);
      doc.setTextColor(...priorityColor(prio));
      doc.setFont('helvetica', 'bold');
      doc.text(prioLabel, M + 8, y + 2);
      doc.setFont('helvetica', 'normal');
      y += 10;

      items.forEach(insight => {
        checkPageBreak(22);

        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        doc.setFont('helvetica', 'bold');
        doc.text(`${insight.title}`, M + 4, y + 1);
        doc.setFont('helvetica', 'normal');
        y += 5;

        doc.setFontSize(8);
        doc.setTextColor(70, 70, 70);
        const descLines = doc.splitTextToSize(insight.description, CW - 12);
        doc.text(descLines, M + 4, y);
        y += descLines.length * 4;

        if (insight.impact) {
          doc.setTextColor(...dark);
          doc.setFont('helvetica', 'italic');
          doc.text(`Impact: ${insight.impact}`, M + 4, y + 1);
          doc.setFont('helvetica', 'normal');
          y += 5;
        }

        // Strip nextAction — don't render internal action IDs
        y += 4;
      });
      y += 2;
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No AI insights available. Generate insights from the dashboard first.', M, y);
  }

  // ─── Risks section (same page or next) ────────────────────────────────────

  y += 6;
  checkPageBreak(30);
  sectionTitle('Risks & Action Items');

  if (data.risks.length > 0) {
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

      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(risk.title, M + 26, y + 1);
      doc.setFont('helvetica', 'normal');
      y += 7;

      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const riskLines = doc.splitTextToSize(risk.description, CW - 8);
      doc.text(riskLines, M + 4, y);
      y += riskLines.length * 4;

      if (risk.impact) {
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'italic');
        doc.text(`Impact: ${risk.impact}`, M + 4, y + 1);
        doc.setFont('helvetica', 'normal');
        y += 5;
      }

      if (risk.fix) {
        doc.setTextColor(...secondary);
        doc.text(`Recommended: ${risk.fix.label}`, M + 4, y + 1);
        y += 5;
      }

      y += 4;
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No risks detected — your data is in good shape!', M, y);
  }

  // No redundant "Data Quality Summary" — already covered in Executive Summary

  // ─── Footers on all pages ─────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  const fileName = `${companyName.replace(/\s+/g, '_')}_Board_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
