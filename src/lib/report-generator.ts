import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';

// ─── Data Fetching ─────────────────────────────────────────

interface ReportData {
  accounts: any[];
  leads: any[];
  deals: any[];
  icpProfiles: any[];
  signals: any[];
  orgName: string;
}

export async function fetchReportData(orgId: string): Promise<ReportData> {
  const [accountsRes, leadsRes, dealsRes, icpRes, signalsRes, orgRes] = await Promise.all([
    supabase.from('accounts').select('name, domain, industry_norm, employee_count, revenue_range, icp_qualified, propensity_score, enriched_at, country, state_province').eq('org_id', orgId).limit(500),
    supabase.from('Leads').select('first_name, last_name, email, title, company_name, lead_score, data_source').eq('org_id', orgId).limit(500),
    supabase.from('deals').select('name, stage, amount, probability, owner_name, expected_close_date, created_at').eq('org_id', orgId).limit(200),
    supabase.from('icp_profiles').select('name, description, criteria, is_active').eq('org_id', orgId),
    supabase.from('account_signals').select('signal_type, signal_priority, title, account_name, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
    supabase.from('organizations').select('name').eq('id', orgId).single(),
  ]);

  return {
    accounts: accountsRes.data || [],
    leads: leadsRes.data || [],
    deals: dealsRes.data || [],
    icpProfiles: icpRes.data || [],
    signals: signalsRes.data || [],
    orgName: orgRes.data?.name || 'Organization',
  };
}

// ─── PDF Generation ────────────────────────────────────────

function addHeader(doc: jsPDF, title: string, orgName: string) {
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 25);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`${orgName} — Generated ${new Date().toLocaleDateString()}`, 20, 33);
  doc.setTextColor(0, 0, 0);
  doc.line(20, 37, 190, 37);
}

function addSection(doc: jsPDF, title: string, y: number): number {
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  return y + 8;
}

function addKpiRow(doc: jsPDF, items: { label: string; value: string }[], y: number): number {
  if (y > 260) { doc.addPage(); y = 20; }
  const colW = 170 / items.length;
  items.forEach((item, i) => {
    const x = 20 + i * colW;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, x, y);
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, x, y + 7);
    doc.setFont('helvetica', 'normal');
  });
  return y + 16;
}

function addTable(doc: jsPDF, headers: string[], rows: string[][], startY: number): number {
  let y = startY;
  const colW = 170 / headers.length;

  // header row
  doc.setFillColor(240, 240, 240);
  doc.rect(20, y - 4, 170, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  headers.forEach((h, i) => doc.text(h, 22 + i * colW, y));
  doc.setFont('helvetica', 'normal');
  y += 6;

  for (const row of rows) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(8);
    row.forEach((cell, i) => {
      const text = (cell || '—').substring(0, Math.floor(colW / 2));
      doc.text(text, 22 + i * colW, y);
    });
    y += 5;
  }
  return y + 4;
}

export function generateExecutivePdf(data: ReportData): jsPDF {
  const doc = new jsPDF();
  addHeader(doc, 'Executive Summary', data.orgName);

  let y = 48;
  const icpCount = data.accounts.filter(a => a.icp_qualified).length;
  const enrichedCount = data.accounts.filter(a => a.enriched_at).length;
  const pipelineValue = data.deals.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  y = addKpiRow(doc, [
    { label: 'Total Accounts', value: String(data.accounts.length) },
    { label: 'ICP Qualified', value: `${icpCount} (${data.accounts.length ? Math.round(icpCount / data.accounts.length * 100) : 0}%)` },
    { label: 'Enriched', value: String(enrichedCount) },
    { label: 'Pipeline Value', value: `$${(pipelineValue / 1000).toFixed(0)}k` },
  ], y);

  y = addKpiRow(doc, [
    { label: 'Total Contacts', value: String(data.leads.length) },
    { label: 'Active Deals', value: String(data.deals.length) },
    { label: 'Active Signals', value: String(data.signals.length) },
    { label: 'ICP Profiles', value: String(data.icpProfiles.length) },
  ], y);

  // Industry breakdown
  y = addSection(doc, 'Industry Breakdown', y + 4);
  const industries: Record<string, number> = {};
  data.accounts.forEach(a => { if (a.industry_norm) industries[a.industry_norm] = (industries[a.industry_norm] || 0) + 1; });
  const topIndustries = Object.entries(industries).sort((a, b) => b[1] - a[1]).slice(0, 10);
  y = addTable(doc, ['Industry', 'Count', '% of Total'], topIndustries.map(([ind, cnt]) => [ind, String(cnt), `${Math.round(cnt / data.accounts.length * 100)}%`]), y);

  // Top accounts
  y = addSection(doc, 'Top Accounts by Propensity Score', y);
  const topAccounts = [...data.accounts].filter(a => a.propensity_score != null).sort((a, b) => (b.propensity_score || 0) - (a.propensity_score || 0)).slice(0, 15);
  y = addTable(doc, ['Account', 'Industry', 'Score', 'ICP'], topAccounts.map(a => [a.name || '—', a.industry_norm || '—', String(a.propensity_score ?? '—'), a.icp_qualified ? 'Yes' : 'No']), y);

  // Pipeline
  y = addSection(doc, 'Deal Pipeline', y);
  const stageGroups: Record<string, { count: number; value: number }> = {};
  data.deals.forEach(d => {
    const s = d.stage || 'Unknown';
    if (!stageGroups[s]) stageGroups[s] = { count: 0, value: 0 };
    stageGroups[s].count++;
    stageGroups[s].value += Number(d.amount) || 0;
  });
  y = addTable(doc, ['Stage', 'Deals', 'Value'], Object.entries(stageGroups).map(([stage, g]) => [stage, String(g.count), `$${(g.value / 1000).toFixed(0)}k`]), y);

  // Recent signals
  if (data.signals.length > 0) {
    y = addSection(doc, 'Recent Signals', y);
    y = addTable(doc, ['Signal', 'Account', 'Priority', 'Date'], data.signals.slice(0, 15).map(s => [s.title || '—', s.account_name || '—', s.signal_priority || '—', new Date(s.created_at).toLocaleDateString()]), y);
  }

  return doc;
}

export function generateSalesPdf(data: ReportData): jsPDF {
  const doc = new jsPDF();
  addHeader(doc, 'Sales Performance Report', data.orgName);
  let y = 48;

  const totalPipeline = data.deals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const wonDeals = data.deals.filter(d => d.stage === 'closed_won');
  const wonValue = wonDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const lostDeals = data.deals.filter(d => d.stage === 'closed_lost');
  const winRate = (wonDeals.length + lostDeals.length) > 0 ? Math.round(wonDeals.length / (wonDeals.length + lostDeals.length) * 100) : 0;

  y = addKpiRow(doc, [
    { label: 'Total Pipeline', value: `$${(totalPipeline / 1000).toFixed(0)}k` },
    { label: 'Won Revenue', value: `$${(wonValue / 1000).toFixed(0)}k` },
    { label: 'Win Rate', value: `${winRate}%` },
    { label: 'Active Deals', value: String(data.deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length) },
  ], y);

  y = addSection(doc, 'Pipeline by Stage', y + 4);
  const stages: Record<string, { count: number; value: number }> = {};
  data.deals.forEach(d => {
    const s = d.stage || 'Unknown';
    if (!stages[s]) stages[s] = { count: 0, value: 0 };
    stages[s].count++;
    stages[s].value += Number(d.amount) || 0;
  });
  y = addTable(doc, ['Stage', 'Count', 'Value', 'Avg Deal'], Object.entries(stages).map(([stage, g]) => [stage, String(g.count), `$${(g.value / 1000).toFixed(0)}k`, `$${g.count ? (g.value / g.count / 1000).toFixed(0) : 0}k`]), y);

  y = addSection(doc, 'Deals Detail', y);
  y = addTable(doc, ['Deal', 'Stage', 'Amount', 'Owner', 'Close Date'],
    data.deals.slice(0, 30).map(d => [d.name || '—', d.stage || '—', `$${((Number(d.amount) || 0) / 1000).toFixed(0)}k`, d.owner_name || '—', d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : '—']),
    y);

  return doc;
}

export function generateIcpPdf(data: ReportData): jsPDF {
  const doc = new jsPDF();
  addHeader(doc, 'ICP Analysis Report', data.orgName);
  let y = 48;

  const icpCount = data.accounts.filter(a => a.icp_qualified).length;
  const avgScore = data.accounts.filter(a => a.propensity_score != null).reduce((s, a) => s + a.propensity_score, 0) / (data.accounts.filter(a => a.propensity_score != null).length || 1);

  y = addKpiRow(doc, [
    { label: 'ICP Qualified', value: `${icpCount} / ${data.accounts.length}` },
    { label: 'Qualification Rate', value: `${data.accounts.length ? Math.round(icpCount / data.accounts.length * 100) : 0}%` },
    { label: 'Avg Propensity Score', value: avgScore.toFixed(1) },
    { label: 'ICP Profiles', value: String(data.icpProfiles.length) },
  ], y);

  // Score distribution
  y = addSection(doc, 'Score Distribution', y + 4);
  const buckets = [{ r: '0-20', min: 0, max: 20 }, { r: '21-40', min: 21, max: 40 }, { r: '41-60', min: 41, max: 60 }, { r: '61-80', min: 61, max: 80 }, { r: '81-100', min: 81, max: 100 }];
  const scoreDist = buckets.map(b => {
    const count = data.accounts.filter(a => a.propensity_score != null && a.propensity_score >= b.min && a.propensity_score <= b.max).length;
    return [b.r, String(count), `${data.accounts.length ? Math.round(count / data.accounts.length * 100) : 0}%`];
  });
  y = addTable(doc, ['Score Range', 'Accounts', '% of Total'], scoreDist, y);

  // ICP profiles
  if (data.icpProfiles.length > 0) {
    y = addSection(doc, 'Active ICP Profiles', y);
    y = addTable(doc, ['Profile', 'Status', 'Description'], data.icpProfiles.map(p => [p.name, p.is_active ? 'Active' : 'Inactive', (p.description || '—').substring(0, 40)]), y);
  }

  // Top ICP accounts
  y = addSection(doc, 'Top ICP-Qualified Accounts', y);
  const icpAccounts = data.accounts.filter(a => a.icp_qualified).sort((a, b) => (b.propensity_score || 0) - (a.propensity_score || 0)).slice(0, 20);
  y = addTable(doc, ['Account', 'Industry', 'Score', 'Country'], icpAccounts.map(a => [a.name || '—', a.industry_norm || '—', String(a.propensity_score ?? '—'), a.country || '—']), y);

  return doc;
}

export function generatePipelinePdf(data: ReportData): jsPDF {
  const doc = new jsPDF();
  addHeader(doc, 'Pipeline Health Report', data.orgName);
  let y = 48;

  const openDeals = data.deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const totalOpen = openDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const weighted = openDeals.reduce((s, d) => s + (Number(d.amount) || 0) * ((Number(d.probability) || 0) / 100), 0);

  y = addKpiRow(doc, [
    { label: 'Open Deals', value: String(openDeals.length) },
    { label: 'Unweighted Pipeline', value: `$${(totalOpen / 1000).toFixed(0)}k` },
    { label: 'Weighted Pipeline', value: `$${(weighted / 1000).toFixed(0)}k` },
    { label: 'Avg Deal Size', value: `$${openDeals.length ? ((totalOpen / openDeals.length) / 1000).toFixed(0) : 0}k` },
  ], y);

  y = addSection(doc, 'Stage Funnel', y + 4);
  const stages: Record<string, number> = {};
  data.deals.forEach(d => { stages[d.stage || 'Unknown'] = (stages[d.stage || 'Unknown'] || 0) + 1; });
  y = addTable(doc, ['Stage', 'Deal Count', '% of Total'], Object.entries(stages).map(([s, c]) => [s, String(c), `${Math.round(c / data.deals.length * 100)}%`]), y);

  y = addSection(doc, 'Aging — Deals Open 30+ Days', y);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const agingDeals = openDeals.filter(d => new Date(d.created_at) < thirtyDaysAgo);
  if (agingDeals.length) {
    y = addTable(doc, ['Deal', 'Stage', 'Amount', 'Days Open'], agingDeals.slice(0, 20).map(d => {
      const days = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
      return [d.name || '—', d.stage || '—', `$${((Number(d.amount) || 0) / 1000).toFixed(0)}k`, String(days)];
    }), y);
  } else {
    doc.text('No deals older than 30 days.', 22, y); y += 8;
  }

  return doc;
}

// ─── Excel Generation ──────────────────────────────────────

async function loadXLSX(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).XLSX) { resolve((window as any).XLSX); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error('Failed to load SheetJS'));
    document.head.appendChild(script);
  });
}

export async function generateExcelReport(data: ReportData, templateId: string): Promise<Blob> {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [
    ['Report Summary', '', '', ''],
    ['Organization', data.orgName, '', ''],
    ['Generated', new Date().toLocaleString(), '', ''],
    ['Template', templateId, '', ''],
    ['', '', '', ''],
    ['Metric', 'Value'],
    ['Total Accounts', data.accounts.length],
    ['ICP Qualified', data.accounts.filter(a => a.icp_qualified).length],
    ['Enriched', data.accounts.filter(a => a.enriched_at).length],
    ['Total Contacts', data.leads.length],
    ['Total Deals', data.deals.length],
    ['Pipeline Value', data.deals.reduce((s, d) => s + (Number(d.amount) || 0), 0)],
    ['Active Signals', data.signals.length],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Accounts sheet
  if (data.accounts.length > 0) {
    const accRows = [['Name', 'Domain', 'Industry', 'Employees', 'Revenue', 'ICP Qualified', 'Score', 'Country']];
    data.accounts.forEach(a => accRows.push([a.name, a.domain, a.industry_norm, a.employee_count, a.revenue_range, a.icp_qualified ? 'Yes' : 'No', a.propensity_score, a.country]));
    const accWs = XLSX.utils.aoa_to_sheet(accRows);
    accWs['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, accWs, 'Accounts');
  }

  // Contacts sheet
  if (data.leads.length > 0) {
    const leadRows = [['First Name', 'Last Name', 'Email', 'Title', 'Company', 'Score', 'Source']];
    data.leads.forEach(l => leadRows.push([l.first_name, l.last_name, l.email, l.title, l.company_name, l.lead_score, l.data_source]));
    const leadWs = XLSX.utils.aoa_to_sheet(leadRows);
    leadWs['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, leadWs, 'Contacts');
  }

  // Deals sheet
  if (data.deals.length > 0) {
    const dealRows = [['Deal', 'Stage', 'Amount', 'Probability', 'Owner', 'Expected Close']];
    data.deals.forEach(d => dealRows.push([d.name, d.stage, Number(d.amount) || 0, Number(d.probability) || 0, d.owner_name, d.expected_close_date]));
    const dealWs = XLSX.utils.aoa_to_sheet(dealRows);
    dealWs['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, dealWs, 'Deals');
  }

  // Signals sheet
  if (data.signals.length > 0) {
    const sigRows = [['Signal', 'Account', 'Type', 'Priority', 'Date']];
    data.signals.forEach(s => sigRows.push([s.title, s.account_name, s.signal_type, s.signal_priority, new Date(s.created_at).toLocaleDateString()]));
    const sigWs = XLSX.utils.aoa_to_sheet(sigRows);
    sigWs['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, sigWs, 'Signals');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ─── Dispatcher ────────────────────────────────────────────

export const TEMPLATE_GENERATORS: Record<string, (data: ReportData) => jsPDF> = {
  executive: generateExecutivePdf,
  sales: generateSalesPdf,
  icp: generateIcpPdf,
  pipeline: generatePipelinePdf,
  capital: generateExecutivePdf, // fallback to executive
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
